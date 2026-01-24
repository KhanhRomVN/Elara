import express, { Request, Response } from 'express';
import { getDb } from '@backend/services/db';
import { sendMessage } from '@backend/services/chat.service';
import { extendedToolService } from '@backend/services/extended-tool.service';

const router = express.Router();

/**
 * Anthropic/Claude standard API: POST /chat/messages or /chat/message
 */
router.post(['/messages', '/message'], async (req: Request, res: Response) => {
  try {
    const { model, messages, stream, max_tokens, temperature } = req.body;

    // 1. Get configuration for Claude Code
    const config = extendedToolService.getByToolId('claude_code');

    if (!config || !config.provider_id) {
      // Fallback or error? The user said it might be "auto"
      // We'll try to find any valid account if not configured
    }

    const db = getDb();
    let account;

    if (config?.provider_id && config.provider_id !== 'auto') {
      // Find account by provider_id
      account = db
        .prepare('SELECT * FROM accounts WHERE provider_id = ?')
        .get(config.provider_id) as any;
    }

    // Resolving model: "auto" (Global Auto)
    // If request model is "auto" OR config model is "auto"
    let targetModel = config?.model_id && config.model_id !== 'auto' ? config.model_id : model;

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

        // If we don't have a specific account forced by config, stick to this provider
        if (!config?.provider_id || config.provider_id === 'auto') {
          account = db
            .prepare('SELECT * FROM accounts WHERE provider_id = ? LIMIT 1')
            .get(bestSequence.provider_id) as any;
        }
      } else {
        console.warn('[Claude API] "auto" requested but no model sequences found.');
      }
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

export default router;
