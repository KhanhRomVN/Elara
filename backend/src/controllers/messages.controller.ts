import { Request, Response } from 'express';
import { getAccountSelector } from '../services/account-selector';
import { providerRegistry } from '../provider/registry';
import { SendMessageOptions } from '../provider/types';
import { countTokens, countMessagesTokens } from '../utils/tokenizer';

import * as crypto from 'crypto';

function generateId(prefix: string = 'msg_'): string {
  return `${prefix}${crypto.randomUUID()}`;
}

const sessionStore = new Map<string, string>();

/**
 * Resolves Claude Code CLI model names to user preferred models from DB.
 */
function resolveClaudeModelMapping(originalModel: string): {
  providerId?: string;
  modelId?: string;
} | null {
  const db = require('../services/db').getDb();
  const getConfig = (key: string) =>
    db.prepare('SELECT value FROM config WHERE key = ?').get(key)?.value;

  let preferredModel: string | undefined;

  if (originalModel.includes('opus')) {
    preferredModel = getConfig('claudecode_opus_model');
  } else if (originalModel.includes('sonnet')) {
    preferredModel = getConfig('claudecode_main_model');
  } else if (originalModel.includes('haiku')) {
    preferredModel = getConfig('claudecode_haiku_model');
  } else if (
    originalModel.startsWith('claude-3') ||
    originalModel.startsWith('claude-2')
  ) {
    // Generic claude request
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

// Request Queue: Map<string, Promise<void>>
const requestQueue = new Map<string, Promise<void>>();

function getSessionKey(req: Request): string {
  // Prefer x-api-key (Anthropic standard)
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string') return apiKey;

  // Fallback to Authorization (Bearer token)
  const auth = req.headers['authorization'];
  if (auth) return auth;

  // Fallback to IP standard
  return req.ip || 'default';
}

/**
 * Generates a unique session fingerprint based on the API Key AND the content of the first conversation turn.
 * This allows multiple "independent" terminals to share the same API Key but maintain separate backend sessions.
 */
function generateSessionFingerprint(apiKey: string, messages: any[]): string {
  // 1. Find the first user message
  let firstUserMsg = '';
  if (messages && messages.length > 0) {
    // We scan up to the first 5 messages to find a user message (skipping system/prefill)
    for (const msg of messages.slice(0, 5)) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          firstUserMsg = msg.content;
        } else if (Array.isArray(msg.content)) {
          // Extract text from blocks
          firstUserMsg = msg.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join(' ');
        }
        break;
      }
    }
  }

  // 2. Normalize: If message is too short (likely a probe like "hi"), don't rely on it heavily for uniqueness
  // OR rely MORE on it? For now, we mix it in.
  // Ideally, different terminals starting different tasks will have different first prompts.
  const contentHash = crypto
    .createHash('sha256')
    .update(firstUserMsg.trim())
    .digest('hex')
    .substring(0, 16);

  // 3. Combine with API Key (so different users don't collide even with same prompt)
  const keyHash = crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex')
    .substring(0, 8);

  return `sess_${keyHash}_${contentHash}`;
}

function isResetCommand(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
    const cmd = lastMsg.content.trim().toLowerCase();
    return cmd === '/reset' || cmd === '!reset';
  }
  return false;
}

/**
 * Detects if the request is a "Probe" request from Claude Code (Warmup or Count).
 * Claude Code sends these every ~10 seconds.
 */
function isProbeRequest(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];

  // We only care if the *current* trigger (last message) is a Probe
  const content = lastMsg.content;

  if (typeof content === 'string') {
    const trimmed = content.trim();
    // Check if simple text starts with Warmup, is exactly 'count', or contains file modification metadata
    if (
      (trimmed.startsWith('Warmup') && content.length < 100) ||
      trimmed === 'count' ||
      trimmed.includes('Files modified by user:') ||
      trimmed.includes(
        'Please write a 5-10 word title for the following conversation',
      )
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
          trimmed.includes(
            'Please write a 5-10 word title for the following conversation',
          )
        ) {
          return true;
        }
      } else if (block.type === 'tool_result') {
        // Check tool result errors
        const contentStr =
          typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content || '');
        // If it's an error and starts with Warmup, it's a warmup signal
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
      // message_start
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

      // content_block_start
      `event: content_block_start\ndata: ${JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      })}\n\n`,

      // content_block_delta
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'OK' },
      })}\n\n`,

      // content_block_stop
      `event: content_block_stop\ndata: ${JSON.stringify({
        type: 'content_block_stop',
        index: 0,
      })}\n\n`,

      // message_delta
      `event: message_delta\ndata: ${JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 1 },
      })}\n\n`,

      // message_stop
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

export const messagesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const apiKey = getSessionKey(req);
  const { model, messages, system, stream, max_tokens } = req.body;

  // 0.5 Handle Probe Request (Claude Code) BEFORE Session Logic
  if (isProbeRequest(messages)) {
    console.log(
      `[Messages] 🔍 Intercepted Probe request ('warmup'/'count') from key: ${apiKey.substring(0, 10)}...`,
    );
    createWarmupResponse(res, stream, model);
    return;
  }

  // Use Fingerprint as Session Key
  const sessionKey = generateSessionFingerprint(apiKey, messages);

  // Get the current tail of the queue for this session
  const currentQueue = requestQueue.get(sessionKey) || Promise.resolve();

  // Create a new promise that chains onto the current queue
  const newRequestPromise = currentQueue.then(async () => {
    try {
      const { model, messages, system, stream, max_tokens } = req.body;
      let currentSessionId = sessionStore.get(sessionKey) || null;

      console.log(
        `[Messages] Request from key: ${sessionKey.substring(0, 10)}... | Current Session: ${currentSessionId}`,
      );

      // 0. Handle Reset Command
      if (isResetCommand(messages)) {
        sessionStore.delete(sessionKey);
        currentSessionId = null;
        console.log(`[Messages] Session reset for key: ${sessionKey}`);
        if (stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.write(
            `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: generateId(), type: 'message', role: 'assistant', content: [], usage: { input_tokens: 0, output_tokens: 0 } } })}\n\n`,
          );
          res.write(
            `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`,
          );
          res.write(
            `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Conversation history has been reset for this terminal.' } })}\n\n`,
          );
          res.write(
            `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`,
          );
          res.write(
            `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
          );
          res.end();
          return;
        } else {
          res.json({
            content: [{ type: 'text', text: 'Conversation history reset.' }],
          });
          return;
        }
      }

      // 0.5 Handle Probe Request (Claude Code)
      if (isProbeRequest(messages)) {
        console.log(
          `[Messages] 🔍 Intercepted Probe request from key: ${sessionKey.substring(0, 10)}...`,
        );
        createWarmupResponse(res, stream, model);
        return;
      }

      // 1. Account Selection
      const db = require('../services/db').getDb();
      const selector = getAccountSelector();
      const accounts = selector.getActiveAccounts();
      let account: any | undefined;

      let targetProviderId: string | undefined;
      let targetModelId: string | undefined = model;

      // 0.7 Model Mapping logic (Inspired by Antigravity-Manager)
      const mapped = resolveClaudeModelMapping(model || '');
      if (mapped) {
        if (mapped.providerId) targetProviderId = mapped.providerId;
        if (mapped.modelId) targetModelId = mapped.modelId;
        console.log(
          `[Messages] Model Mapping: ${model} -> ${targetProviderId ? targetProviderId + '/' : ''}${targetModelId}`,
        );
      }

      // Handle "auto" or "provider/model" format (Skip if already mapped)
      if (!mapped && model === 'auto') {
        // Resolve best model from sequences
        const bestSequence = db
          .prepare(
            'SELECT provider_id, model_id FROM model_sequences ORDER BY sequence ASC LIMIT 1',
          )
          .get() as { provider_id: string; model_id: string } | undefined;

        if (bestSequence) {
          targetProviderId = bestSequence.provider_id;
          targetModelId = bestSequence.model_id;
          console.log(
            `[Messages] Auto-selected: ${targetProviderId}/${targetModelId}`,
          );
        }
      } else if (model && model.includes('/')) {
        const parts = model.split('/');
        targetProviderId = parts[0];
        targetModelId = parts.slice(1).join('/'); // In case model name has slashes
        console.log(
          `[Messages] Parsed Provider: ${targetProviderId}, Model: ${targetModelId}`,
        );
      } else if (model) {
        // Legacy behavior: lookup provider by model id
        const inferredProvider = providerRegistry.getProviderForModel(model);
        if (inferredProvider) {
          targetProviderId = inferredProvider.name;
        }
      }

      if (targetProviderId) {
        account = accounts.find(
          (a) =>
            a.provider_id.toLowerCase() === targetProviderId!.toLowerCase(),
        );
      }

      // Default to first account if still nothing
      if (!account && accounts.length > 0) {
        account = accounts[0];
        console.log(
          `[Messages] Fallback to first available account: ${account?.provider_id}`,
        );
      }

      if (!account) {
        res.status(401).json({
          error: {
            type: 'authentication_error',
            message: 'No active account found for this request',
          },
        });
        return;
      }

      // Ensure targetModelId is set for the provider call
      const finalModel = targetModelId || model;

      // 2. Adapt Request
      const providerMessages: any[] = [];
      if (system) {
        let systemContent = '';
        if (Array.isArray(system)) {
          systemContent = system
            .map((block: any) => block.text || '')
            .join('\n');
        } else {
          systemContent = system;
        }
        providerMessages.push({ role: 'system', content: systemContent });
      }

      if (Array.isArray(messages)) {
        const formattedMessages = messages.map((msg: any) => {
          let content = msg.content;
          if (Array.isArray(content)) {
            content = content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n');
          }
          return {
            role: msg.role,
            content: content,
          };
        });

        if (currentSessionId) {
          if (formattedMessages.length > 0) {
            const lastMsg = formattedMessages[formattedMessages.length - 1];
            providerMessages.push(lastMsg);
            console.log(
              `[Messages] Reusing session ${currentSessionId}. Sending only last message.`,
            );
          }
        } else {
          providerMessages.push(...formattedMessages);
          console.log(
            `[Messages] New session. Sending full history (${formattedMessages.length} msgs).`,
          );
        }
      }

      const msgId = generateId();
      const sendEvent = (event: string, data: any) => {
        if (stream) {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      };

      // 3. Set Headers and 4. Initial Events (Only for Stream)
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        sendEvent('message_start', {
          type: 'message_start',
          message: {
            id: msgId,
            type: 'message',
            role: 'assistant',
            model: model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        });
        sendEvent('content_block_start', {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        });
        sendEvent('ping', { type: 'ping' });
      }

      // 5. Call Provider via Registry
      const provider = providerRegistry.getProvider(account.provider_id);
      if (!provider) {
        throw new Error(`Provider ${account.provider_id} not loaded`);
      }

      const inputTokens = countMessagesTokens(providerMessages);
      let outputTokens = 0;
      let accumulatedContent = '';

      const options: SendMessageOptions = {
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: finalModel || provider.defaultModel || 'default',
        thinking: false,
        messages: providerMessages,
        stream: true,
        conversationId: currentSessionId || undefined,

        onContent: (content: string) => {
          accumulatedContent += content;
          outputTokens += countTokens(content);
          sendEvent('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: content },
          });
        },
        onSessionCreated: (sessionId: string) => {
          if (!currentSessionId) {
            sessionStore.set(sessionKey, sessionId);
            console.log(
              `[Messages] Captured new Provider Session ID: ${sessionId} for key: ${sessionKey}`,
            );
          }
        },
        onDone: () => {
          if (stream) {
            sendEvent('content_block_stop', {
              type: 'content_block_stop',
              index: 0,
            });
            sendEvent('message_delta', {
              type: 'message_delta',
              delta: { stop_reason: 'end_turn', stop_sequence: null },
              usage: { output_tokens: outputTokens },
            });
            sendEvent('message_stop', { type: 'message_stop' });
            res.end();
          } else {
            res.status(200).json({
              id: msgId,
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: accumulatedContent }],
              model: finalModel || model,
              stop_reason: 'end_turn',
              stop_sequence: null,
              usage: {
                input_tokens: inputTokens,
                output_tokens: outputTokens,
              },
            });
          }
        },
        onError: (err: Error) => {
          console.error('[Messages] Provider Error:', err);
          if (
            err.message &&
            (err.message.includes('404') || err.message.includes('session'))
          ) {
            console.warn(
              `[Messages] Session error detected for key ${sessionKey}, clearing stored session ID.`,
            );
            sessionStore.delete(sessionKey);
          }

          if (stream) {
            sendEvent('error', {
              type: 'error',
              error: { type: 'api_error', message: err.message },
            });
            res.end();
          } else {
            if (!res.headersSent) {
              res
                .status(500)
                .json({ error: { type: 'api_error', message: err.message } });
            }
          }
        },
      };

      await provider.handleMessage(options);
    } catch (error: any) {
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: { type: 'api_error', message: error.message } });
      }
    }
  });

  requestQueue.set(
    sessionKey,
    newRequestPromise.catch(() => {}),
  );
};

export const countTokensController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { messages } = req.body;
    const tokensCount = countMessagesTokens(messages || []);

    // Claude Code expects a response that includes an estimation or overhead
    // We return a mock buffer of 100 tokens to ensure it doesn't hit limits unexpectedly
    res.json({
      input_tokens: tokensCount + 100,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
