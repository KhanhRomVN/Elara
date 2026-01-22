import { Request, Response } from 'express';
import { getAccountSelector } from '../services/account-selector';
import { providerRegistry } from '../provider/registry';
import { SendMessageOptions } from '../provider/types';

function generateId(prefix: string = 'msg_'): string {
  return `${prefix}${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
}

const sessionStore = new Map<string, string>();

// Request Queue: Map<ApiKey, Promise<void>>
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

function isResetCommand(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
    const cmd = lastMsg.content.trim().toLowerCase();
    return cmd === '/reset' || cmd === '!reset';
  }
  return false;
}

export const messagesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const sessionKey = getSessionKey(req);

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

      // 1. Account Selection
      const selector = getAccountSelector();
      const accounts = selector.getActiveAccounts();
      let account: any | undefined;

      // Try to find provider by model
      let targetProviderId: string | undefined;
      if (model) {
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

      if (!account) {
        res.status(401).json({
          error: {
            type: 'authentication_error',
            message: 'No active account found for this request',
          },
        });
        return;
      }

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

      // 3. Set Headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const msgId = generateId();

      const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // 4. Send Initial Events
      if (stream) {
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

      const options: SendMessageOptions = {
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: model || provider.defaultModel || 'default',
        thinking: false,
        messages: providerMessages,
        stream: true,
        conversationId: currentSessionId || undefined,

        onContent: (content: string) => {
          if (stream) {
            sendEvent('content_block_delta', {
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: content },
            });
          }
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
              usage: { output_tokens: 0 },
            });
            sendEvent('message_stop', { type: 'message_stop' });
            res.end();
          } else {
            res.end();
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

  // Update the queue
  requestQueue.set(
    sessionKey,
    newRequestPromise.catch(() => {}),
  );
};
