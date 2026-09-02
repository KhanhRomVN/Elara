import { countTokens } from '../../utils/tokenizer';
import { createLogger } from '../../utils/logger';

const logger = createLogger('DeepSeekSSE');

// =============================================================================
// TOOL CALL DETECTION
// Checks if accumulated content ends with a partial (unclosed) tool tag.
// Used to detect when INCOMPLETE cuts off mid-toolcall.
// =============================================================================

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
    // Check for unclosed opening tag: <tool_name> exists but </tool_name> does not
    const openTagRegex = new RegExp(`<${tool}(?:\\s[^>]*)?>`, 'i');
    const closeTagRegex = new RegExp(`</${tool}>`, 'i');
    if (openTagRegex.test(content) && !closeTagRegex.test(content)) {
      return { hasPartial: true, toolType: tool };
    }
  }
  return { hasPartial: false, toolType: null };
}

// =============================================================================
// SSE STREAM PARSER
// Parses a DeepSeek SSE response body and emits content/thinking/metadata.
// Returns an object indicating whether the response was INCOMPLETE and the
// response_message_id needed to call /chat/continue.
// =============================================================================

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: any) => void;
  onRaw?: (data: string) => void;
  sessionId: string;
  promptTokens: number;
  completionTokensRef: { value: number };
  currentModeRef: { value: 'THINK' | 'RESPONSE' };
  /**
   * Length (in chars) of content already accumulated from previous stream(s).
   * When DeepSeek's /chat/continue returns a full snapshot of the entire response
   * (not just the new delta), this offset lets us skip content we've already
   * emitted and only forward the genuinely new suffix to onContent().
   * Set to 0 for the initial stream.
   */
  priorContentLength?: number;
}

export interface ParseSSEResult {
  incomplete: boolean;
  responseMessageId: number | null;
  accumulatedContent: string;
}

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

  // Tracks how many chars of the reconstructed full-snapshot we have seen so far.
  // Used to deduplicate the snapshot content that overlaps with priorContentLength.
  let snapshotSeenLength = 0;
  // If priorContentLength > 0, this is a continuation stream. DeepSeek's /chat/continue
  // replays ALL content from char 0 (not just the new delta), so we must deduplicate
  // regardless of whether we see a {response: {fragments}} object up front.
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
        // Explicit [DONE] means complete — not INCOMPLETE
        logger.debug(
          `[DeepSeek] [DONE] received | session=${sessionId} | contentChunks=${contentChunkCount} | accLen=${accumulatedContent.length}`,
        );
        return { incomplete: false, responseMessageId, accumulatedContent };
      }

      try {
        const json = JSON.parse(jsonStr);

        // ── event: ready ──────────────────────────────────────────────────
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

        // ── event: title ──────────────────────────────────────────────────
        if (currentEventType === 'title') {
          if (json.content && onMetadata) {
            onMetadata({ conversation_title: json.content });
          }
          currentEventType = '';
          continue;
        }

        // ── event: close ─────────────────────────────────────────────────
        // DeepSeek sends `event: close` with auto_resume info when INCOMPLETE
        if (currentEventType === 'close') {
          currentEventType = '';
          continue;
        }

        // ── event: hint ───────────────────────────────────────────────────
        // DeepSeek sends `event: hint` for server-side notices, e.g. length limits or busy warnings
        if (currentEventType === 'hint') {
          if (json.type === 'error') {
            const hintMsg =
              json.content || 'Unknown DeepSeek server hint error';
            const finishReason = json.finish_reason || '';

            // Check if this is a non-fatal length limit notification (DeepSeek still generates truncated response)
            if (
              finishReason === 'context_length_exceeded' ||
              hintMsg.toLowerCase().includes('length limit') ||
              hintMsg.toLowerCase().includes('can only read')
            ) {
              logger.warn(
                `[DeepSeek] Server context length limit hint (non-fatal warning): ${hintMsg} | session=${sessionId}`,
              );
              currentEventType = '';
              continue; // Don't abort the stream! Let DeepSeek continue streaming the generated response!
            }

            // Log full error details with logger.error for fatal errors
            logger.error(
              `[DeepSeek] Fatal server hint error | session=${sessionId} | finish_reason=${finishReason} | message=${hintMsg}`,
              {
                fullJson: json,
                sessionId,
                finishReason,
                hintMsg,
              },
            );
            const err: any = new Error(hintMsg);
            if (finishReason) err.code = finishReason;
            throw err;
          }
          currentEventType = '';
          continue;
        }

        currentEventType = '';

        // ── Detect INCOMPLETE status ──────────────────────────────────────
        // Pattern 1: {"p":"response/status","o":"SET","v":"INCOMPLETE"}
        if (json.p === 'response/status' && json.v === 'INCOMPLETE') {
          isIncomplete = true;
          const { hasPartial, toolType } =
            detectPartialToolcall(accumulatedContent);
          logger.info(
            `[DeepSeek] INCOMPLETE detected (Pattern 1) | session=${sessionId} | msgId=${responseMessageId} | contentChunks=${contentChunkCount} | bytesProcessed=${totalBytesProcessed} | hasPartialTool=${hasPartial} | toolType=${toolType ?? 'none'}`,
          );
          if (onMetadata) {
            onMetadata({
              incomplete_has_partial_tool: hasPartial,
              incomplete_partial_tool_type: toolType,
            });
          }
          continue;
        }

        // Pattern 2: batch update containing quasi_status=INCOMPLETE
        // {"p":"response","o":"BATCH","v":[...,{"p":"quasi_status","v":"INCOMPLETE"}]}
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
                `[DeepSeek] INCOMPLETE detected (Pattern 2/BATCH) | session=${sessionId} | msgId=${responseMessageId} | contentChunks=${contentChunkCount} | bytesProcessed=${totalBytesProcessed} | hasPartialTool=${hasPartial} | toolType=${toolType ?? 'none'}`,
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

        // ── OpenAI-compat delta ───────────────────────────────────────────
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

        // ── Helper: emit a content chunk, skipping the priorContentLength prefix
        // when this stream is replaying a full snapshot from /chat/continue.
        const emitContentChunk = (text: string, fromSnapshot: boolean) => {
          if (fromSnapshot && priorContentLength > 0) {
            // The snapshot replays everything from char 0. Skip chars we already saw.
            const alreadySeen = snapshotSeenLength;
            snapshotSeenLength += text.length;
            if (snapshotSeenLength <= priorContentLength) {
              // Entire chunk is old content — skip silently
              logger.debug(
                `[DeepSeek] emitContentChunk SKIP (all old) | session=${sessionId} | seen=${snapshotSeenLength} | prior=${priorContentLength} | chunkLen=${text.length}`,
              );
              return;
            }
            if (alreadySeen < priorContentLength) {
              // Chunk straddles the boundary — only emit the new suffix
              const originalLen = text.length;
              text = text.slice(priorContentLength - alreadySeen);
              logger.debug(
                `[DeepSeek] emitContentChunk TRIM (straddle boundary) | session=${sessionId} | seen=${snapshotSeenLength} | prior=${priorContentLength} | originalLen=${originalLen} | emitLen=${text.length}`,
              );
            }
            // If snapshotSeenLength > priorContentLength and alreadySeen >= priorContentLength,
            // the whole chunk is new → fall through and emit normally.
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

        // ── Initial full object: {"v":{"response":{"fragments":[...]}}} ───
        // DeepSeek sends this at the START of a /chat/continue stream as a
        // full replay of everything generated so far (prior + new content).
        // We must deduplicate using priorContentLength to avoid double-emit.
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          value.response?.fragments
        ) {
          // Also capture response_message_id from initial snapshot
          if (value.response?.message_id != null) {
            responseMessageId = value.response.message_id;
          }
          // Mark that this stream is operating in snapshot-replay mode.
          // All RESPONSE content from this point is deduplicated via emitContentChunk.
          snapshotMode = true;
          // Reset snapshotSeenLength only if we haven't started counting yet
          // (i.e. this is the first fragments object in this stream).
          // Do NOT reset if incremental lines already advanced snapshotSeenLength.
          if (snapshotSeenLength === 0) {
            snapshotSeenLength = 0; // explicit no-op: already 0, kept for clarity
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
                emitContentChunk(fragment.content, true /* fromSnapshot */);
              }
            }
          }
          // Check if initial snapshot already shows INCOMPLETE
          if (value.response?.status === 'INCOMPLETE') {
            isIncomplete = true;
          }
          continue;
        }

        // ── Array fragment ────────────────────────────────────────────────
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

        // ── String value (incremental delta) ─────────────────────────────
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
        } else if (contentChunkCount === 0) {
          // Unhandled path — silently ignore
        }
      } catch (e) {
        // Log all parse errors with full details for debugging
        const err = e as any;
        logger.error(
          `[DeepSeek] SSE parse error | session=${sessionId} | line="${line.slice(0, 200)}"`,
          {
            message: err?.message || 'Unknown parse error',
            stack: err?.stack,
            linePreview: line.slice(0, 500),
          }
        );
      }
    }
  }

  return { incomplete: isIncomplete, responseMessageId, accumulatedContent };
}
