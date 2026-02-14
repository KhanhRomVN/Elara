import { request as httpRequest } from 'https';
import { Account } from '../../../ipc/accounts';
import { HEADERS_COMMON, buildCookieHeader } from './api';
import { Request, Response } from 'express';

// MODELS: Get Models
export const getModels = async (cookies: any): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const cookieHeader = buildCookieHeader(cookies);
    const postData = JSON.stringify({});

    const options = {
      method: 'POST',
      hostname: 'stepfun.ai',
      path: '/api/agent/capy.agent.v1.AgentService/GetChatConfig',
      headers: {
        ...HEADERS_COMMON,
        cookie: cookieHeader,
        'content-length': Buffer.byteLength(postData),
      },
    };

    const req = httpRequest(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.modelList && Array.isArray(json.modelList)) {
            // Map to standard format
            const models = json.modelList.map((m: any) => ({
              id: m.model,
              name: m.displayName,
              description: m.description,
              owned_by: 'StepFun',
              tags: m.tags,
            }));
            resolve(models);
          } else {
            resolve([]);
          }
        } catch (e) {
          console.error('[StepFun] GetModels parse error:', e);
          resolve([]);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
};

// Helper: Create Chat Session
const createChatSession = (cookieHeader: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({});
    const options = {
      method: 'POST',
      hostname: 'stepfun.ai',
      path: '/api/agent/capy.agent.v1.AgentService/CreateChatSession',
      headers: {
        ...HEADERS_COMMON,
        cookie: cookieHeader,
        'content-length': Buffer.byteLength(postData),
      },
    };

    const req = httpRequest(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Check deep structure based on doc usually it returns ChatSession object
          if (json.chatSession && json.chatSession.chatSessionId) {
            resolve(json.chatSession.chatSessionId);
          } else {
            console.error('[StepFun] CreateSession resp:', json);
            reject(new Error('No chatSessionId returned'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

// CHAT: Stream
export const chatCompletionStream = async (req: Request, res: Response, account: Account) => {
  const { messages, model, conversation_id, parent_message_id } = req.body;
  let cookies: any;
  try {
    cookies = JSON.parse(account.credential);
  } catch {
    cookies = account.credential; // fallback if string
  }
  const cookieHeader = buildCookieHeader(cookies);

  // 1. Ensure Session ID
  let chatSessionId = conversation_id;
  if (!chatSessionId || chatSessionId === 'new-session') {
    try {
      chatSessionId = await createChatSession(cookieHeader);
      // Send the session ID to client
      const convoEvent = { type: 'conversation', id: chatSessionId };
      res.write(`data: ${JSON.stringify(convoEvent)}\n\n`);
    } catch (e) {
      console.error('[StepFun] Failed to create session:', e);
      return res.status(500).json({ error: 'Failed to create chat session' });
    }
  }

  // 2. Prepare Message
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage.content;

  // Use user-provided prompt structure from docs
  const payload = {
    message: {
      chatSessionId: chatSessionId,
      content: {
        userMessage: {
          qa: {
            content: content,
          },
        },
      },
    },
    config: {
      model: model,
      enableSearch: true,
    },
  };

  const postData = JSON.stringify(payload);

  const options = {
    method: 'POST',
    hostname: 'stepfun.ai',
    path: '/api/agent/capy.agent.v1.AgentService/ChatStream',
    headers: {
      ...HEADERS_COMMON,
      'content-type': 'application/connect+json', // Important as per doc
      cookie: cookieHeader,
      'content-length': Buffer.byteLength(postData),
      'connect-protocol-version': '1',
    },
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const proxyReq = httpRequest(options, (proxyRes) => {
    proxyRes.on('data', (chunk: Buffer) => {
      // Parse ConnectRPC/gRPC-Web frames
      // Format: [1 byte flags] [4 bytes length (BE)] [Payload]
      let cursor = 0;
      while (cursor < chunk.length) {
        if (cursor + 5 > chunk.length) break; // Incomplete header

        const flags = chunk[cursor]; // 0=data, 1=end/trailer
        const length = chunk.readUInt32BE(cursor + 1);
        const start = cursor + 5;
        const end = start + length;

        if (end > chunk.length) {
          // Incomplete payload in this chunk.
          break;
        }

        const payloadBuf = chunk.subarray(start, end);
        cursor = end;

        if (flags === 0 || flags === 2) {
          // 0 or 2 data? Connect proctocol usually 0.
          try {
            const jsonStr = payloadBuf.toString('utf-8');
            const data = JSON.parse(jsonStr);

            // Extract text from StepFun event structure
            if (data.data && data.data.event) {
              const evt = data.data.event;

              if (evt.textEvent && evt.textEvent.text) {
                const text = evt.textEvent.text;
                const encoded = JSON.stringify({
                  choices: [{ delta: { content: text } }],
                });
                res.write(`data: ${encoded}\n\n`);
              } else if (evt.reasoningEvent && evt.reasoningEvent.text) {
                const text = evt.reasoningEvent.text;
                // Just send as content for now to be safe
                res.write(
                  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
                );
              }
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    });

    proxyRes.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });

  proxyReq.on('error', (e) => {
    console.error('[StepFun] Stream error:', e);
    res.write(`data: {"error": "${e.message}"}\n\n`);
    res.end();
  });

  proxyReq.write(postData);
  proxyReq.end();
};
