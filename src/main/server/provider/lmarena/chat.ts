import { Request, Response } from 'express';
import { net } from 'electron';
import { Account } from '../../../ipc/accounts';
import { getCookies, USER_AGENT } from './api';
import { uuidv7 } from './utils';
import { LMArenaStreamParser } from './parser';

// Get Models via Next.js Server Action
export const getModels = async (account: Account) => {
  const cookies = getCookies(account);
  // Note: This action ID might change with LMArena updates.
  const NEXT_ACTION_ID = '60dd5def2cd15cb0c3eb89a128f43e18bcf6d48eb0';

  try {
    const request = net.request({
      method: 'POST',
      url: 'https://lmarena.ai/vi?mode=direct',
    });

    request.setHeader('Cookie', cookies);
    request.setHeader('Content-Type', 'text/plain;charset=UTF-8');
    request.setHeader('User-Agent', USER_AGENT);
    request.setHeader('Next-Action', NEXT_ACTION_ID);

    const body = JSON.stringify([account.email || '']);
    request.write(body);

    const responseBody = await new Promise<string>((resolve, reject) => {
      let data = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          data += chunk.toString();
        });
        response.on('end', () => resolve(data));
        response.on('error', (err: any) => reject(err));
      });
      request.on('error', (err) => reject(err));
      request.end();
    });

    // Manual extraction
    const startStr = '"initialModels":';
    const startIndex = responseBody.indexOf(startStr);
    if (startIndex !== -1) {
      const arrayStart = startIndex + startStr.length;
      let arrayEnd = arrayStart;
      let stack = 0;
      let inString = false;

      // Walk forward to find the matching closing bracket
      for (let i = arrayStart; i < responseBody.length; i++) {
        const char = responseBody[i];
        if (char === '"' && responseBody[i - 1] !== '\\') {
          inString = !inString;
        }
        if (!inString) {
          if (char === '[') stack++;
          else if (char === ']') {
            stack--;
            if (stack === 0) {
              arrayEnd = i + 1;
              break;
            }
          }
        }
      }

      if (arrayEnd > arrayStart) {
        const arrayStr = responseBody.substring(arrayStart, arrayEnd);
        const models = JSON.parse(arrayStr);
        return models.map((m: any) => ({
          id: m.id,
          name: m.name || m.publicName || m.displayName,
          organization: m.organization,
          provider: m.provider,
          publicName: m.publicName,
          displayName: m.displayName,
          capabilities: m.capabilities,
          rank: m.rank,
          rankByModality: m.rankByModality,
        }));
      }
    }

    console.warn('[LMArena] Could not parse models from response, falling back to static list.');
  } catch (e) {
    console.error('[LMArena] Failed to fetch models:', e);
  }

  // Fallback
  return [
    { id: 'gpt-4o-2024-05-13', name: 'GPT-4o' },
    { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
    { id: 'gemini-1.5-pro-api-0514', name: 'Gemini 1.5 Pro' },
  ];
};

// Start a new conversation or continue
export const chatCompletionStream = (req: Request, res: Response, account: Account) => {
  const { messages, model, conversation_id } = req.body;

  const cookies = getCookies(account);
  console.log('[LMArena] Stream request:', { model, conversation_id });

  const lastMessage = messages[messages.length - 1];
  const userContent = lastMessage.content;

  const newMsgId = uuidv7();
  const sessionId = conversation_id || uuidv7();

  const isNewChat = !conversation_id;
  const url = isNewChat
    ? 'https://lmarena.ai/nextjs-api/stream/create-evaluation'
    : `https://lmarena.ai/nextjs-api/stream/post-to-evaluation/${sessionId}`;

  const payload = {
    id: sessionId,
    mode: 'direct', // We only support direct chat for now?
    modelAId: model, // This MUST be the UUID of the model
    userMessageId: newMsgId,
    modelAMessageId: uuidv7(), // Always new UUID for the upcoming response
    ...(isNewChat ? { modality: 'chat' } : {}),
    userMessage: {
      content: userContent,
      experimental_attachments: [],
      metadata: {},
    },
  };

  const request = net.request({
    method: 'POST',
    url,
  });

  const headers = {
    Cookie: cookies,
    'Content-Type': 'text/plain;charset=UTF-8',
    'User-Agent': USER_AGENT,
    Origin: 'https://lmarena.ai',
    Referer: `https://lmarena.ai/c/${sessionId}`,
  };

  request.setHeader('Cookie', headers.Cookie);
  request.setHeader('Content-Type', headers['Content-Type']);
  request.setHeader('User-Agent', headers['User-Agent']);
  request.setHeader('Origin', headers.Origin);
  request.setHeader('Referer', headers.Referer);

  const payloadStr = JSON.stringify(payload);

  console.log('[LMArena] Sending Request:', {
    url,
    headers: { ...headers, Cookie: '***' }, // Hide cookie in logs
    payload,
  });

  request.write(payloadStr);
  request.on('response', (response: Electron.IncomingMessage) => {
    // Check status
    if (response.statusCode !== 200) {
      console.error('[LMArena] API Error:', response.statusCode, response.statusMessage);

      // Read error body
      let errData = '';
      response.on('data', (chunk) => {
        errData += chunk.toString();
      });
      response.on('end', () => {
        console.error('[LMArena] Error Response Body:', errData);
        res.status(response.statusCode || 500).json({
          error: 'Upstream Error',
          details: errData,
          statusCode: response.statusCode,
        });
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    response.on('data', (chunk: Buffer) => {
      const text = chunk.toString();

      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith('a0:')) {
          // Content
          try {
            const contentStr = line.substring(3);
            const content = JSON.parse(contentStr);

            const msg = {
              choices: [{ delta: { content: content } }],
            };
            res.write(`data: ${JSON.stringify(msg)}\n\n`);
          } catch (e) {
            console.error('Error parsing a0 line', line);
          }
        } else if (line.startsWith('ad:')) {
          // Metadata / Finish
          const msg = {
            choices: [{ delta: {}, finish_reason: 'stop' }],
          };
          res.write(`data: ${JSON.stringify(msg)}\n\n`);
          res.write('data: [DONE]\n\n');
        }
      }
    });

    response.on('end', () => {
      res.end();
    });
  });

  request.end();
};

export const getConversations = async (account: Account) => {
  // GET https://lmarena.ai/api/history/list?limit=20
  const cookies = getCookies(account);
  const request = net.request({
    method: 'GET',
    url: 'https://lmarena.ai/api/history/list?limit=50',
  });

  return new Promise((resolve) => {
    request.setHeader('Cookie', cookies);
    request.setHeader('User-Agent', USER_AGENT);
    let data = '';
    request.on('response', (response: Electron.IncomingMessage) => {
      response.on('data', (chunk: Buffer) => (data += chunk.toString()));
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.history);
        } catch (e) {
          resolve([]);
        }
      });
    });
    request.end();
  });
};

export const getConversationDetail = async (_id: string, _account: Account) => {
  // Placeholder for detail retrieval if needed
};
