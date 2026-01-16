import { Request, Response } from 'express';
import { Account } from '../ipc/accounts';
import { request as httpRequest } from 'https';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';

// Constants
const API_BASE = 'https://stepfun.ai';
const HEADERS_COMMON = {
  'content-type': 'application/json',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  origin: 'https://stepfun.ai',
  referer: 'https://stepfun.ai/',
  'accept-language': 'en-US,en;q=0.9',
};

// Helper: Build Cookie Header
const buildCookieHeader = (cookies: any): string => {
  if (typeof cookies === 'string') return cookies;
  if (Array.isArray(cookies)) {
    return cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
  }
  return '';
};

// Find system Chrome/Chromium
const findChrome = (): string | null => {
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  try {
    const output = execSync('which google-chrome || which chromium', { encoding: 'utf-8' });
    if (output.trim()) return output.trim();
  } catch (e) {
    // ignore
  }

  return null;
};

// Login function - spawns Real Chrome via Proxy and captures cookies
export const login = (): Promise<{ cookies: string; email: string }> => {
  console.log('[StepFun] Starting Real Browser login flow...');

  const chromePath = findChrome();
  if (!chromePath) {
    return Promise.reject(
      new Error('Chrome or Chromium not found. Please install it to use StepFun.'),
    );
  }

  return new Promise(async (resolve, reject) => {
    // 1. Start Proxy
    try {
      await startProxy();
    } catch (e) {
      reject(new Error('Failed to start proxy: ' + e));
      return;
    }

    // 2. Prepare Profile Dir
    const profilePath = join(app.getPath('userData'), 'profiles', 'stepfun');
    if (fs.existsSync(profilePath)) {
      console.log('[StepFun] Clearing old profile...');
      fs.rmSync(profilePath, { recursive: true, force: true });
    }
    fs.mkdirSync(profilePath, { recursive: true });

    // 3. Spawn Chrome
    console.log('[StepFun] Spawning Chrome at:', chromePath);
    const args = [
      '--proxy-server=http=127.0.0.1:22122;https=127.0.0.1:22122',
      '--proxy-bypass-list=<-loopback>',
      '--ignore-certificate-errors',
      `--user-data-dir=${profilePath}`,
      '--disable-http2',
      '--disable-quic',
      '--disable-ipv6',
      '--dns-result-order=ipv4first',
      '--no-first-run',
      '--no-default-browser-check',
      '--class=stepfun-browser',
      'https://stepfun.ai/chats/new',
    ];

    const chromeProcess = spawn(chromePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (chromeProcess.stdout) {
      chromeProcess.stdout.on('data', (data) => console.log(`[StepFun Chrome Out]: ${data}`));
    }
    if (chromeProcess.stderr) {
      chromeProcess.stderr.on('data', (data) => console.error(`[StepFun Chrome Err]: ${data}`));
    }

    // 4. Listen for Proxy Events
    let capturedCookies = '';
    let capturedEmail = 'stepfun@user.com';
    let resolved = false;
    let finishTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        if (finishTimer) clearTimeout(finishTimer);
        try {
          chromeProcess.kill();
        } catch (e) {}
        stopProxy();
        proxyEvents.off('stepfun-cookies', onCookies);
      }
    };

    const finalize = () => {
      if (resolved) return;
      cleanup();
      resolve({
        cookies: capturedCookies,
        email: capturedEmail,
      });
    };

    const onCookies = async (cookies: string) => {
      console.log('[StepFun] Cookies intercepted, checking authentication...');

      // First, extract and verify JWT authentication status
      const tokenMatch = cookies.match(/Oasis-Token=([^;]+)/);
      if (!tokenMatch || !tokenMatch[1]) {
        console.log('[StepFun] No Oasis-Token in cookies, ignoring');
        return;
      }

      let isAuthenticated = false;
      try {
        // Decode JWT to check authentication
        const parts = tokenMatch[1].split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          console.log('[StepFun] Token payload:', payload);
          // authenticated = activated:true AND mode:2 (from log analysis)
          isAuthenticated = payload.activated === true && payload.mode === 2;
        }
      } catch (e) {
        console.error('[StepFun] JWT decode failed:', e);
        return;
      }

      if (!isAuthenticated) {
        console.log('[StepFun] ⏳ Token not authenticated (guest token), waiting...');
        return;
      }

      console.log('[StepFun] ✓ Authenticated token! Verifying API access...');
      capturedCookies = cookies;

      // Try to verify/fetch email
      try {
        const models = await getModels(cookies);
        if (models.length > 0) {
          console.log('[StepFun] Validated cookies via getModels');
          // Unfortunately StepFun doesn't give email in getModels or basic JWT easily without decode
          // For now we use placeholder or try to decode if JWT
          // Extract JWT from cookie
          const match = cookies.match(/Oasis-Token=([^;]+)/);
          if (match && match[1]) {
            // Basic JWT decode (if not encrypted)
            try {
              const parts = match[1].split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                console.log('[StepFun] Token Payload:', payload);
                // Payload from earlier log: {"activated":false..."oasis_id":...} - No email.
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn('[StepFun] Cookie validation failed (could be temporary):', e);
      }

      if (finishTimer) clearTimeout(finishTimer);
      finishTimer = setTimeout(finalize, 5000); // 5 seconds to ensure stable connection
    };

    proxyEvents.on('stepfun-cookies', onCookies);

    // Separate handler for authenticated cookies from login response (bypass verification)
    const onAuthenticatedCookies = async (cookies: string) => {
      console.log(
        '[StepFun] ✓✓ Received AUTHENTICATED cookies from login response! (bypassing verification)',
      );
      capturedCookies = cookies;

      // Still verify with API to be safe
      try {
        const models = await getModels(cookies);
        if (models.length > 0) {
          console.log(
            '[StepFun] ✓✓✓ Authenticated cookies verified via getModels!',
            models.length,
            'models found',
          );
        }
      } catch (e) {
        console.warn('[StepFun] Authenticated cookie API check failed:', e);
      }

      if (finishTimer) clearTimeout(finishTimer);
      finishTimer = setTimeout(finalize, 5000);
    };

    proxyEvents.on('stepfun-authenticated-cookies', onAuthenticatedCookies);

    // Capture User Info (Email)
    const onUserInfo = (userInfo: any) => {
      console.log('[StepFun] Received User Info:', userInfo);
      if (userInfo && userInfo.email) {
        capturedEmail = userInfo.email;
        console.log('[StepFun] ✓ Captured real email:', capturedEmail);
      }
    };
    proxyEvents.on('stepfun-user-info', onUserInfo);

    // Hard limit 3 minutes
    setTimeout(() => {
      if (!resolved) {
        if (capturedCookies) {
          finalize();
        } else {
          cleanup();
          reject(new Error('Login timed out'));
        }
      }
    }, 180000);

    chromeProcess.on('close', (code) => {
      if (!resolved) {
        if (capturedCookies) {
          finalize();
        } else {
          console.log('[StepFun] Chrome closed with code:', code);
          cleanup();
          reject(new Error('User closed login window'));
        }
      }
    });
  });
};

/* 
   REMOVED: sendOTP, sendOTPHandler, loginHandler 
   They are replaced by the real browser flow.
*/

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
      // If we have a parent message (for replies setup), StepFun might use it implicitly via session
      // but the `stepfun-ask.md` example doesn't explicitly show `parentMessageId` in the request body for `ChatStream`.
      // It shows `chatSessionId` and `content`.
      // The RESPONSE contains `parentMessageId`.
      // However, for multi-turn, the session ID is key.
    },
    config: {
      model: model, // e.g. "deepseek-r1"
      enableSearch: true,
      // enableReasoning: true // deepseek might need this
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
            // Structure from doc:
            // { "data": { "event": { "textEvent": { "text": "..." } } } }
            // { "data": { "event": { "reasoningEvent": { "text": "..." } } } }

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
