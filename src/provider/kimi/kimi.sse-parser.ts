/**
 * ------------------------------------------------------------------
 * Kimi SSE Parser
 * ------------------------------------------------------------------
 * Parse Kimi's gRPC-Web Connect stream frames.
 * Hỗ trợ 5-byte header prefix (1 byte flags + 4 bytes length),
 * thinking mode với StreamingThinkingParser, và multi-stage events.
 *
 * Main functions:
 * - parseKimiSSE() : Parse stream và emit content/thinking/metadata
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Utils ──
import { createLogger } from '../../utils/logger';
import { StreamingThinkingParser } from '../../utils/thinking-parser';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KimiSSEParser');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseOptions {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onMetadata?: (meta: any) => void;
  onError?: (err: Error) => void;
  onRaw?: (data: string) => void;
  conversationId?: string;
}

export interface ParseResult {
  conversationId: string;
  accumulatedContent: string;
  isComplete: boolean;
  error?: string;
}

// ─── Main Parser ────────────────────────────────────────────────────────

export async function parseKimiSSE(
  stream: NodeJS.ReadableStream,
  options: ParseOptions,
): Promise<ParseResult> {
  const { onContent, onThinking, onMetadata, onError, onRaw } = options;

  let accumulatedContent = '';
  let accumulatedThinking = '';
  let conversationId = options.conversationId || '';
  let isComplete = false;
  let streamError: string | undefined;

  const thinkingParser = new StreamingThinkingParser(
    (chunk: string) => {
      accumulatedContent += chunk;
      if (onContent) onContent(chunk);
    },
    (chunk: string) => {
      accumulatedThinking += chunk;
      if (onThinking) onThinking(chunk);
    },
  );

  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);

    stream.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 5) {
        const frameLen = buffer.readUInt32BE(1);

        if (buffer.length < 5 + frameLen) {
          break;
        }

        const frameData = buffer.subarray(5, 5 + frameLen);
        buffer = buffer.subarray(5 + frameLen);

        const frameStr = frameData.toString('utf8').trim();
        if (!frameStr) continue;

        try {
          const event = JSON.parse(frameStr);
          processKimiEvent(event);
        } catch (e) {
          logger.warn('[Kimi] Failed to parse SSE frame:', e);
          if (onRaw) onRaw(frameStr);
        }
      }
    });

    stream.on('end', () => {
      thinkingParser.flush();
      resolve({
        conversationId,
        accumulatedContent,
        isComplete,
        error: streamError,
      });
    });

    stream.on('error', (err) => {
      logger.error('[Kimi] SSE stream error:', err);
      reject(err);
    });

    function processKimiEvent(event: any) {
      if (onRaw) onRaw(JSON.stringify(event));

      if (event.done !== undefined) {
        isComplete = true;
        return;
      }

      if (event.heartbeat !== undefined) {
        return;
      }

      if (event.error) {
        const errMsg =
          event.error.details?.[0]?.debug?.localizedMessage?.message ||
          event.error.message ||
          event.error.code ||
          'Kimi API Error';
        logger.warn('[Kimi] Stream Error event:', errMsg);
        streamError = errMsg;
        if (onMetadata) {
          onMetadata({ error: errMsg });
        }
        return;
      }

      if (event.chat?.lastRequest?.id) {
        conversationId = event.chat.lastRequest.id;
        if (onMetadata) {
          onMetadata({
            conversation_id: conversationId,
            conversation_title: event.chat.lastRequest.name || 'New Chat',
          });
        }
      } else if (event.chat?.id) {
        conversationId = event.chat.id;
        if (onMetadata) {
          onMetadata({ conversation_id: conversationId });
        }
      }

      const textChunk =
        event.block?.text?.content ??
        (event.mask === 'block.text.content' ? event.block?.text?.content : undefined);

      if (textChunk && typeof textChunk === 'string') {
        thinkingParser.feed(textChunk);
      }

      const thinkChunk =
        event.block?.think?.content ??
        (event.mask === 'block.think.content' ? event.block?.think?.content : undefined);

      if (thinkChunk && typeof thinkChunk === 'string') {
        accumulatedThinking += thinkChunk;
        if (onThinking) onThinking(thinkChunk);
      }

      if (event.block?.multiStage) {
        const stage = event.block.multiStage;
        if (stage.stage === 'STAGE_NAME_THINKING' && onMetadata) {
          onMetadata({ thinking_stage: stage.status });
        }
      }

      if (event.message?.status === 'MESSAGE_STATUS_COMPLETED' && onMetadata) {
        onMetadata({ message_status: 'completed' });
      }
    }
  });
}