import express, { Request, Response } from 'express';
import { getDb } from '@backend/services/db';
import { sendMessage } from '@backend/services/chat.service';
import * as crypto from 'crypto';

const router = express.Router();

/**
 * Detects if the request is a "Probe" request from Claude Code (Warmup, Count, Title, or File Metadata).
 */
function isProbeRequest(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];
  const content = lastMsg.content;

  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (
      (trimmed.startsWith('Warmup') && content.length < 100) ||
      trimmed === 'count' ||
      trimmed.includes('Files modified by user:') ||
      trimmed.includes('Please write a 5-10 word title for the following conversation')
    ) {
      return true;
    }
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'text') {
        const trimmed = (block.text || '').trim();
        if (
          trimmed === 'Warmup' ||
          trimmed.startsWith('Warmup\n') ||
          trimmed === 'count' ||
          trimmed.includes('Files modified by user:') ||
          trimmed.includes('Please write a 5-10 word title for the following conversation')
        ) {
          return true;
        }
      } else if (block.type === 'tool_result') {
        const contentStr =
          typeof block.content === 'string' ? block.content : JSON.stringify(block.content || '');
        if (block.is_error && contentStr.trim().startsWith('Warmup')) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Creates a mock response for Warmup requests to save quota.
 */
function createWarmupResponse(res: Response, stream: boolean, model: string) {
  const messageId = `msg_warmup_${Date.now()}`;

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Warmup-Intercepted', 'true');

    const events = [
      `event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 0 },
        },
      })}\n\n`,
      `event: content_block_start\ndata: ${JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'OK' },
      })}\n\n`,
      `event: content_block_stop\ndata: ${JSON.stringify({
        type: 'content_block_stop',
        index: 0,
      })}\n\n`,
      `event: message_delta\ndata: ${JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 1 },
      })}\n\n`,
      `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
    ];

    res.write(events.join(''));
    res.end();
  } else {
    res
      .status(200)
      .set('X-Warmup-Intercepted', 'true')
      .json({
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'OK' }],
        model: model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      });
  }
}

/**
 * Resolves Claude Code CLI model names to user preferred models from DB.
 */
function resolveClaudeModelMapping(originalModel: string): {
  providerId?: string;
  modelId?: string;
} | null {
  const db = getDb();
  const getConfig = (key: string) =>
    (db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined)
      ?.value;

  let preferredModel: string | undefined;

  if (originalModel.includes('opus')) {
    preferredModel = getConfig('claudecode_opus_model');
  } else if (originalModel.includes('sonnet')) {
    preferredModel = getConfig('claudecode_main_model');
  } else if (originalModel.includes('haiku')) {
    preferredModel = getConfig('claudecode_haiku_model');
  } else if (originalModel.startsWith('claude-3') || originalModel.startsWith('claude-2')) {
    preferredModel = getConfig('claudecode_main_model');
  }

  if (preferredModel && preferredModel !== 'auto') {
    if (preferredModel.includes('/')) {
      const [p, m] = preferredModel.split('/');
      return { providerId: p, modelId: m };
    }
    return { modelId: preferredModel };
  }

  return null;
}

/**
 * Generates a unique session fingerprint.
 */
function generateSessionFingerprint(apiKey: string, messages: any[]): string {
  let firstUserMsg = '';
  if (messages && messages.length > 0) {
    for (const msg of messages.slice(0, 5)) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          firstUserMsg = msg.content;
        } else if (Array.isArray(msg.content)) {
          // Extract text from blocks (compatible with string | ContentBlock[])
          firstUserMsg = msg.content
            .map((b: any) => (typeof b === 'string' ? b : b.text || ''))
            .join(' ');
        }
        break;
      }
    }
  }

  const contentHash = crypto
    .createHash('sha256')
    .update(firstUserMsg.trim())
    .digest('hex')
    .substring(0, 16);
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 8);

  return `sess_${keyHash}_${contentHash}`;
}

/**
 * Anthropic/Claude standard API: POST /chat/messages or /chat/message
 */
router.post(['/messages', '/message'], async (req: Request, res: Response) => {
  try {
    const { model, messages, stream, temperature } = req.body;

    // 0. Handle Probe Request
    if (isProbeRequest(messages)) {
      console.log(`[Claude API] 🔍 Intercepted Probe request`);
      createWarmupResponse(res, !!stream, model);
      return;
    }

    // 1. Tool configuration logic removed (extended_tools)
    const db = getDb();
    let account;

    // Priority: Mapping (from DB) > config.model (if not auto) > request.model
    let targetModel = model;
    let targetProviderId = undefined;

    // 0.7 Model Mapping logic (Inspired by Antigravity-Manager)
    const mapped = resolveClaudeModelMapping(model || '');
    if (mapped) {
      if (mapped.providerId) targetProviderId = mapped.providerId;
      if (mapped.modelId) targetModel = mapped.modelId;
      console.log(
        `[Claude API] Model Mapping: ${model} -> ${targetProviderId ? targetProviderId + '/' : ''}${targetModel}`,
      );
    }

    // fallback check removed (config gone)

    // Parse "provider/model" format if extracted from config or request
    if (!mapped && targetModel && targetModel.includes('/')) {
      const parts = targetModel.split('/');
      targetProviderId = parts[0];
      targetModel = parts.slice(1).join('/');
      console.log(
        `[Claude API] Parsed format - Provider: ${targetProviderId}, Model: ${targetModel}`,
      );
    }

    if (targetModel === 'auto') {
      // Find the GLOBALLY best model from sequences
      const bestSequence = db
        .prepare('SELECT * FROM model_sequences ORDER BY sequence ASC LIMIT 1')
        .get() as { provider_id: string; model_id: string } | undefined;

      if (bestSequence) {
        console.log(
          `[Claude API] Global auto-selected: ${bestSequence.provider_id}/${bestSequence.model_id}`,
        );
        targetModel = bestSequence.model_id;
        targetProviderId = bestSequence.provider_id;
      } else {
        console.warn('[Claude API] "auto" requested but no model sequences found.');
      }
    }

    // Find account
    if (targetProviderId) {
      account = db
        .prepare('SELECT * FROM accounts WHERE provider_id = ? LIMIT 1')
        .get(targetProviderId) as any;
    }

    // Fallback if no account found (either specific provider failed, or auto resolution failed/skipped)
    if (!account) {
      account = db.prepare('SELECT * FROM accounts LIMIT 1').get() as any;
    }

    if (!account) {
      res.status(401).json({
        error: {
          type: 'authentication_error',
          message: 'No accounts configured in Elara. Please add an account first.',
        },
      });
      return;
    }

    // Set up SSE headers if streaming
    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
    }

    let accumulatedContent = '';

    // Generate Session ID for Isolation
    // For embedded server, we might not have 'x-api-key' from headers if not sent by client,
    // but typically Claude Code sends it. We'll use a default if missing.
    const apiKey = (req.headers['x-api-key'] as string) || 'embedded-default';
    const conversationId = generateSessionFingerprint(apiKey, messages);

    try {
      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: targetModel,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        stream: !!stream,
        temperature: temperature,
        conversationId: conversationId, // Pass the fingerprint session ID
        onContent: (content) => {
          if (stream) {
            // Anthropic stream format
            const data = {
              type: 'content_block_delta',
              index: 0,
              delta: {
                type: 'text_delta',
                text: content,
              },
            };
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          } else {
            accumulatedContent += content;
          }
        },
        onDone: () => {
          if (stream) {
            // Anthropic end events
            res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
            res.end();
          } else {
            res.status(200).json({
              id: `msg_${Date.now()}`,
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: accumulatedContent }],
              model: model,
              usage: { input_tokens: 0, output_tokens: 0 },
            });
          }
        },
        onError: (error) => {
          console.error('[Claude API] Stream error', error);
          if (stream) {
            res.write(
              `data: ${JSON.stringify({ type: 'error', error: { message: error.message } })}\n\n`,
            );
            res.end();
          } else {
            if (!res.headersSent) {
              res.status(500).json({ error: { type: 'api_error', message: error.message } });
            }
          }
        },
      });
    } catch (error: any) {
      console.error('[Claude API] Error in sendMessage', error);
      if (!res.headersSent) {
        res.status(500).json({ error: { type: 'api_error', message: error.message } });
      }
    }
  } catch (error) {
    console.error('[Claude API] Unexpected error', error);
    if (!res.headersSent) {
      res.status(500).json({ error: { type: 'api_error', message: 'Internal server error' } });
    }
  }
});

/**
 * Endpoint for token counting (to avoid 404)
 */
router.post('/count_tokens', async (_req: Request, res: Response) => {
  res.json({
    input_tokens: 100, // Return a mock value to satisfy CLI
  });
});

export default router;
