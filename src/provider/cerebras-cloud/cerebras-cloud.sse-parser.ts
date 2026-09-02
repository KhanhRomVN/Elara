/**
 * ------------------------------------------------------------------
 * Cerebras Cloud SSE Parser
 * ------------------------------------------------------------------
 * Parse OpenAI-compatible SSE stream từ Cerebras API.
 * Hỗ trợ cả delta.content (nội dung) và delta.reasoning (thinking).
 *
 * Main features:
 * - parseSSEStream() : Parse stream và emit content, thinking, metadata
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CerebrasSSE');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseSSEOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: any) => void;
  onRaw?: (data: string) => void;
}

// ─── Functions ──────────────────────────────────────────────────────────

export async function parseSSEStream(
  responseBody: NodeJS.ReadableStream,
  opts: ParseSSEOptions,
): Promise<void> {
  const { onContent, onThinking, onMetadata, onRaw } = opts;

  let buffer = '';

  for await (const chunk of responseBody) {
    const chunkStr = chunk.toString();
    if (onRaw) onRaw(chunkStr);
    buffer += chunkStr;

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine === 'data: [DONE]') {
        return;
      }

      if (!trimmedLine.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmedLine.substring(6));
        const delta = json.choices?.[0]?.delta;

        if (!delta) continue;

        if (delta.reasoning !== undefined && delta.reasoning !== null) {
          if (onThinking) {
            onThinking(delta.reasoning);
          } else {
            onContent(`[Thinking] ${delta.reasoning}`);
          }
        }

        if (delta.content) {
          onContent(delta.content);
        }

        if (json.usage && onMetadata) {
          onMetadata({
            total_token: json.usage.total_tokens,
            prompt_tokens: json.usage.prompt_tokens,
            completion_tokens: json.usage.completion_tokens,
            reasoning_tokens:
              json.usage.completion_tokens_details?.reasoning_tokens,
          });
        }

        if (json.time_info && onMetadata) {
          onMetadata({
            time_info: json.time_info,
          });
        }

        const finishReason = json.choices?.[0]?.finish_reason;
        if (finishReason && onMetadata) {
          onMetadata({ finish_reason: finishReason });
        }
      } catch (_e) {
        logger.warn('[CerebrasCloud] Failed to parse SSE line:', _e);
      }
    }
  }
}
