/**
 * ------------------------------------------------------------------
 * DeepSeek SSE Parser
 * ------------------------------------------------------------------
 * Parse DeepSeek SSE response stream. Xử lý thinking mode,
 * response content, metadata, và phát hiện response bị truncate.
 *
 * Main features:
 * - parseSSEStream()     : Parse stream và emit content/thinking/metadata
 * - detectPartialToolcall(): Phát hiện tool call bị cắt ngang
 * - Auto-continue support : Hỗ trợ deduplicate content từ /chat/continue
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { countTokens } from '../../utils/tokenizer';
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DeepSeekSSE');

// ─── Functions ──────────────────────────────────────────────────────────

export function detectPartialToolcall(content: string): {
  hasPartial: boolean;
  toolType: string | null;
} {
  const TOOL_NAMES = [
    'write_to_file',
    'replace_in_file',
    'read_file',
    'run_command',
    'list_files',
    'search_files',
    'delete_file',
    'delete_folder',
    'execute_agent_action',
  ];

  for (const tool of TOOL_NAMES) {
    const openTagRegex = new RegExp(`<${tool}(?:\\s[^>]*)?>`, 'i');
    const closeTagRegex = new RegExp(`</${tool}>`, 'i');
    if (openTagRegex.test(content) && !closeTagRegex.test(content)) {
      return { hasPartial: true, toolType: tool };
    }
  }
  return { hasPartial: false, toolType: null };
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: any) => void;
  onRaw?: (data: string) => void;
  sessionId: string;
  promptTokens: number;
  completionTokensRef: { value: number };
  currentModeRef: { value: 'THINK' | 'RESPONSE' };
  priorContentLength?: number;
}

export interface ParseSSEResult {
  incomplete: boolean;
  responseMessageId: number | null;
  accumulatedContent: string;
}

// ─── Main Parser ────────────────────────────────────────────────────────

export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<ParseSSEResult> {
  const {
    onContent,
    onThinking,
    onMetadata,
    onRaw,
    sessionId,
    promptTokens,
    completionTokensRef,
    currentModeRef,
    priorContentLength = 0,
  } = opts;

  let buffer = '';
  let currentEventType = '';
  let isIncomplete = false;
  let responseMessageId: number | null = null;
  let contentChunkCount = 0;
  let totalBytesProcessed = 0;
  let accumulatedContent = '';
  let snapshotSeenLength = 0;
  let snapshotMode = priorContentLength > 0;

  for await (const chunk of responseBody) {
    const chunkStr = chunk.toString();
    totalBytesProcessed += chunkStr.length;
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEventType = line.substring(7).trim();
        continue;
      }

      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.substring(6).trim();
      if (jsonStr === '[DONE]') {
        logger.debug(
          `[DeepSeek] [DONE] received | session=${sessionId}`,
        );
        return { incomplete: false, responseMessageId, accumulatedContent };
      }

      try {
        const json = JSON.parse(jsonStr);

        if (currentEventType === 'ready') {
          if (json.response_message_id !== undefined) {
            responseMessageId = json.response_message_id;
            if (onMetadata) {
              onMetadata({
                response_message_id: json.response_message_id,
                chat_session_id: sessionId,
              });
            }
          }
          currentEventType = '';
          continue;
        }

        if (currentEventType === 'title') {
          if (json.content && onMetadata) {
            onMetadata({ conversation_title: json.content });
          }
          currentEventType = '';
          continue;
        }

        if (currentEventType === 'close') {
          currentEventType = '';
          continue;
        }

        if (currentEventType === 'hint') {
          if (json.type === 'error') {
            const hintMsg =
              json.content || 'Unknown DeepSeek server hint error';
            logger.error(
              `[DeepSeek] Server hint error | session=${sessionId} | message=${hintMsg}`,
            );
            const err: any = new Error(hintMsg);
            throw err;
          }
          currentEventType = '';
          continue;
        }

        currentEventType = '';

        if (json.p === 'response/status' && json.v === 'INCOMPLETE') {
          isIncomplete = true;
          const { hasPartial, toolType } =
            detectPartialToolcall(accumulatedContent);
          logger.info(
            `[DeepSeek] INCOMPLETE detected | session=${sessionId} | hasPartialTool=${hasPartial}`,
          );
          if (onMetadata) {
            onMetadata({
              incomplete_has_partial_tool: hasPartial,
              incomplete_partial_tool_type: toolType,
            });
          }
          continue;
        }

        if (
          json.p === 'response' &&
          json.o === 'BATCH' &&
          Array.isArray(json.v)
        ) {
          for (const item of json.v) {
            if (item.p === 'quasi_status' && item.v === 'INCOMPLETE') {
              isIncomplete = true;
              const { hasPartial, toolType } =
                detectPartialToolcall(accumulatedContent);
              logger.info(
                `[DeepSeek] INCOMPLETE detected (BATCH) | session=${sessionId}`,
              );
              if (onMetadata) {
                onMetadata({
                  incomplete_has_partial_tool: hasPartial,
                  incomplete_partial_tool_type: toolType,
                });
              }
            }
            if (item.p === 'accumulated_token_usage' && onMetadata) {
              onMetadata({ total_token: item.v });
            }
          }
          continue;
        }

        if (json.choices?.[0]?.delta?.content) {
          const deltaText = json.choices[0].delta.content;
          completionTokensRef.value += countTokens(deltaText);
          accumulatedContent += deltaText;
          onContent(deltaText);
          contentChunkCount++;
          if (onMetadata) {
            onMetadata({
              total_token: promptTokens + completionTokensRef.value,
            });
          }
          continue;
        }

        const path = json.p;
        const value = json.v;

        const emitContentChunk = (text: string, fromSnapshot: boolean) => {
          if (fromSnapshot && priorContentLength > 0) {
            const alreadySeen = snapshotSeenLength;
            snapshotSeenLength += text.length;
            if (snapshotSeenLength <= priorContentLength) {
              return;
            }
            if (alreadySeen < priorContentLength) {
              text = text.slice(priorContentLength - alreadySeen);
            }
          }
          completionTokensRef.value += countTokens(text);
          accumulatedContent += text;
          onContent(text);
          contentChunkCount++;
          if (onMetadata) {
            onMetadata({
              total_token: promptTokens + completionTokensRef.value,
            });
          }
        };

        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          value.response?.fragments
        ) {
          if (value.response?.message_id != null) {
            responseMessageId = value.response.message_id;
          }
          snapshotMode = true;
          if (snapshotSeenLength === 0) {
            snapshotSeenLength = 0;
          }

          for (const fragment of value.response.fragments) {
            if (fragment.type === 'THINK') {
              currentModeRef.value = 'THINK';
              if (fragment.content) {
                if (onThinking) onThinking(fragment.content);
                else {
                  onContent(`[Thinking] ${fragment.content}\n`);
                  contentChunkCount++;
                }
              }
            } else if (fragment.type === 'RESPONSE') {
              currentModeRef.value = 'RESPONSE';
              if (fragment.content) {
                emitContentChunk(fragment.content, true);
              }
            }
          }
          if (value.response?.status === 'INCOMPLETE') {
            isIncomplete = true;
          }
          continue;
        }

        if (Array.isArray(value)) {
          const fragment = value[0];
          if (fragment) {
            if (fragment.type === 'THINK') {
              currentModeRef.value = 'THINK';
              if (fragment.content) {
                if (onThinking) onThinking(fragment.content);
                else {
                  onContent(`[Thinking] ${fragment.content}\n`);
                  contentChunkCount++;
                }
              }
            } else if (fragment.type === 'RESPONSE') {
              currentModeRef.value = 'RESPONSE';
              if (fragment.content) {
                emitContentChunk(fragment.content, snapshotMode);
              }
            }
          }
          continue;
        }

        if (typeof value === 'string') {
          if (path?.includes('thinking_content')) {
            currentModeRef.value = 'THINK';
            completionTokensRef.value += countTokens(value);
            if (onThinking) onThinking(value);
            else {
              onContent(`[Thinking] ${value}\n`);
              contentChunkCount++;
            }
            if (onMetadata) {
              onMetadata({
                total_token: promptTokens + completionTokensRef.value,
              });
            }
          } else if (
            path === 'response/content' ||
            path?.endsWith('/content')
          ) {
            if (path === 'response/content') {
              currentModeRef.value = 'RESPONSE';
            }
            if (currentModeRef.value === 'THINK') {
              completionTokensRef.value += countTokens(value);
              if (onThinking) onThinking(value);
              else {
                onContent(`[Thinking] ${value}\n`);
                contentChunkCount++;
              }
              if (onMetadata) {
                onMetadata({
                  total_token: promptTokens + completionTokensRef.value,
                });
              }
            } else {
              emitContentChunk(value, snapshotMode);
            }
          } else if (!path) {
            if (currentModeRef.value === 'THINK') {
              completionTokensRef.value += countTokens(value);
              if (onThinking) onThinking(value);
              else {
                onContent(`[Thinking] ${value}\n`);
                contentChunkCount++;
              }
              if (onMetadata) {
                onMetadata({
                  total_token: promptTokens + completionTokensRef.value,
                });
              }
            } else {
              emitContentChunk(value, snapshotMode);
            }
          }
        } else if (
          path?.endsWith('/elapsed_secs') ||
          path?.endsWith('thinking_elapsed_secs')
        ) {
          if (onMetadata) {
            onMetadata({ thinking_elapsed: value });
          }
        }
      } catch (e) {
        const err = e as any;
        logger.error(
          `[DeepSeek] SSE parse error | session=${sessionId} | line="${line.slice(0, 200)}"`,
          {
            message: err?.message || 'Unknown parse error',
            linePreview: line.slice(0, 500),
          }
        );
      }
    }
  }

  return { incomplete: isIncomplete, responseMessageId, accumulatedContent };
}