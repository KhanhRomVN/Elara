import express from 'express';
import { getAccountSelector } from '../../services/account-selector';
import { chatCompletionStream as deepseekChat } from '../../services/chat/deepseek.service';

const router = express.Router();

function generateId(prefix: string = 'msg_'): string {
  return `${prefix}${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
}

// Session store: Map<ApiKey, DeepSeekSessionId>
const sessionStore = new Map<string, string>();

// Request Queue: Map<ApiKey, Promise<void>>
const requestQueue = new Map<string, Promise<void>>();

function getSessionKey(req: express.Request): string {
  // Prefer x-api-key (Anthropic standard)
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string') return apiKey;

  // Fallback to Authorization (Bearer token)
  const auth = req.headers['authorization'];
  if (auth) return auth;

  // Fallback to IP standard (least reliable for local multiple terms, but safe fallback)
  return req.ip || 'default';
}

// Helper to check for reset command
function isResetCommand(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
    const cmd = lastMsg.content.trim().toLowerCase();
    return cmd === '/reset' || cmd === '!reset';
  }
  return false;
}

router.post('/', async (req, res) => {
  const sessionKey = getSessionKey(req);

  // Get the current tail of the queue for this session
  const currentQueue = requestQueue.get(sessionKey) || Promise.resolve();

  // Create a new promise that chains onto the current queue
  const newRequestPromise = currentQueue.then(async () => {
    try {
      const { model, messages, system, stream, max_tokens } = req.body;
      let currentDeepSeekSessionId = sessionStore.get(sessionKey) || null;

      console.log(
        `[Messages] Request from key: ${sessionKey.substring(0, 10)}... | Current Session: ${currentDeepSeekSessionId}`,
      );

      // 0. Handle Reset Command
      if (isResetCommand(messages)) {
        sessionStore.delete(sessionKey);
        currentDeepSeekSessionId = null;
        console.log(`[Messages] Session reset for key: ${sessionKey}`);
        if (stream) {
          // Mock response for reset
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

      // 1. Account Selection (Prioritize DeepSeek)
      const selector = getAccountSelector();
      const accounts = selector.getActiveAccounts();

      // Explicitly look for a DeepSeek account
      let account = accounts.find(
        (a) => a.provider === 'DeepSeek' && a.status === 'Active',
      );

      if (!account) {
        res.status(401).json({
          error: {
            type: 'authentication_error',
            message: 'No active DeepSeek account found',
          },
        });
        return;
      }

      // 2. Adapt Request (Anthropic -> DeepSeek/OpenAI format)
      const deepseekMessages = [];
      if (system) {
        // Handle system message (can be string or array in Anthropic)
        let systemContent = '';
        if (Array.isArray(system)) {
          systemContent = system
            .map((block: any) => block.text || '')
            .join('\n');
        } else {
          systemContent = system;
        }
        deepseekMessages.push({ role: 'system', content: systemContent });
      }
      // Append user/assistant messages
      if (Array.isArray(messages)) {
        const formattedMessages = messages.map((msg: any) => {
          let content = msg.content;
          if (Array.isArray(content)) {
            // Flatten content blocks to single string
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

        // IMPORTANT: If we are reusing a session, we should ideally NOT send the full history again
        // because DeepSeek API might duplicate it or get confused if we are not careful.
        // However, DeepSeek's `chat/completion` endpoint is stateless-ish unless we use `conversation_id`.
        // If `conversation_id` is passed, DeepSeek appends the NEW messages to that session.
        // So we should ONLY send the *newest* message(s) if we are reusing a session.

        if (currentDeepSeekSessionId) {
          // Filter to only get the last message (User prompt)
          // Assumption: Claude Code sends full history, so the last one is the new prompt.
          if (formattedMessages.length > 0) {
            const lastMsg = formattedMessages[formattedMessages.length - 1];
            deepseekMessages.push(lastMsg);
            console.log(
              `[Messages] Reusing session ${currentDeepSeekSessionId}. Sending only last message.`,
            );
          }
        } else {
          // New session: Send full history
          deepseekMessages.push(...formattedMessages);
          console.log(
            `[Messages] New session. Sending full history (${formattedMessages.length} msgs).`,
          );
        }
      }

      // 3. Set Headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const msgId = generateId();

      // Helper to write SSE event
      const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // 4. Send Initial Events (Anthropic style)
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
            usage: { input_tokens: 0, output_tokens: 0 }, // Mock usage
          },
        });
        sendEvent('content_block_start', {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        });
        sendEvent('ping', { type: 'ping' });
      }

      // 5. Call DeepSeek Service
      await deepseekChat(
        account.credential,
        {
          model: 'deepseek-chat', // Enforce deepseek-chat (V3) to avoid reasoning/thinking model (R1)
          thinking: false,
          messages: deepseekMessages,
          stream: true,
          conversation_id: currentDeepSeekSessionId || undefined,
          // Optional: pass conversation_id if available or generate one to maybe keep internal state?
          // For now, stateless as per service limit (uses last msg).
        },
        account.userAgent,
        {
          onContent: (content: string) => {
            if (stream) {
              sendEvent('content_block_delta', {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: content },
              });
            } else {
              // Buffer for non-stream not implemented here fully as primary use case is stream
            }
          },
          onSessionCreated: (sessionId) => {
            if (!currentDeepSeekSessionId) {
              // Store new session ID in the map
              sessionStore.set(sessionKey, sessionId);
              console.log(
                `[Messages] Captured new DeepSeek Session ID: ${sessionId} for key: ${sessionKey}`,
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
                usage: { output_tokens: 0 }, // Mock
              });
              sendEvent('message_stop', { type: 'message_stop' });
              res.end();
            } else {
              res.end();
            }
          },
          onError: (err: Error) => {
            console.error('DeepSeek Error:', err);
            // If session expired or invalid, clear it so next request starts fresh
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
        },
      );
    } catch (error: any) {
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: { type: 'api_error', message: error.message } });
      }
    }
  });

  // Update the queue with the new promise (automagically handles success or failure of previous requests)
  requestQueue.set(
    sessionKey,
    newRequestPromise.catch(() => {}),
  );
});

export default router;
