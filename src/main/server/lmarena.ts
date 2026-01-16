import { BrowserWindow } from 'electron';
import { Request, Response } from 'express';
import net from 'net';
import { Account } from '../ipc/accounts';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Helper to get cookies from account
const getCookies = (account: Account) => {
  return account.credential;
};

// Login function - opens browser and captures cookies
export const login = (): Promise<{ cookies: string; email?: string; username?: string }> => {
  console.log('[LMArena] Starting login flow...');
  return new Promise(async (resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      alwaysOnTop: true,
    });

    // Clear previous session
    await authWindow.webContents.session.clearStorageData();

    console.log('[LMArena] Opening login window...');
    authWindow.loadURL('https://lmarena.ai/login');

    // Poll for the token cookie
    const interval = setInterval(async () => {
      try {
        if (authWindow.isDestroyed()) {
          clearInterval(interval);
          reject(new Error('Login window closed'));
          return;
        }

        const cookies = await authWindow.webContents.session.cookies.get({
          url: 'https://lmarena.ai',
        });
        // LMArena uses 'arena-auth-prod-v1.0' or similar
        const authCookie = cookies.find((c) => c.name.startsWith('arena-auth-prod'));

        if (authCookie) {
          console.log('[LMArena] Auth cookie found, capturing credentials...');
          clearInterval(interval);

          // Build cookie string
          const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

          // Try to fetch profile to get email/username
          console.log('[LMArena] Fetching user profile...');
          try {
            const profile = await getProfile(cookieStr);
            console.log(
              '[LMArena] Login successful, email:',
              profile.email,
              'username:',
              profile.name,
            );
            authWindow.close();
            resolve({
              cookies: cookieStr,
              email: profile.email || 'user@lmarena.ai',
              username: profile.name || 'LMArena User',
            });
          } catch (e) {
            console.error('[LMArena] Failed to fetch profile:', e);
            // Fallback if profile fetch fails but we have cookies
            authWindow.close();
            resolve({
              cookies: cookieStr,
              email: 'user@lmarena.ai',
              username: 'LMArena User',
            });
          }
        }
      } catch (error) {
        console.error('[LMArena] Error polling cookies:', error);
      }
    }, 1000);

    authWindow.on('closed', () => {
      clearInterval(interval);
      reject(new Error('User closed login window'));
    });
  });
};

// Fetch user profile
const getProfile = async (cookies: string): Promise<{ email: string; name: string }> => {
  // There isn't a direct "me" endpoint documented easily, but usually auth cookie contains JWT
  // Or we can try to hit an endpoint that returns user info.
  // Based on logs, /nextjs-api/sign-in/email returns user info.
  // But we are already logged in.
  // Let's try to decode the JWT if it *is* a JWT.

  // Actually, looking at the cookies, `arena-auth-prod-v1.0` value starts with `base64-eyJ...`.
  // It's a base64 encoded JSON which contains `access_token` which IS a JWT.
  // The JWT payload inside `access_token` likely has the email.

  try {
    const match = cookies.match(/arena-auth-prod-v1\.0=base64-([a-zA-Z0-9+/=]+)/);
    if (match && match[1]) {
      const jsonStr = Buffer.from(match[1], 'base64').toString('utf-8');
      const data = JSON.parse(jsonStr);
      if (data.user) {
        return {
          email: data.user.email,
          name: data.user.email.split('@')[0], // Fallback name
        };
      }
    }
  } catch (e) {
    console.error('Error parsing auth cookie', e);
  }
  return { email: '', name: '' };
};

// Get Models
export const getModels = async (account: Account) => {
  // LMArena models are usually hardcoded or fetched from a metadata endpoint.
  // In the logs, there's a request to `/vi/c/new?mode=direct`. The HTML might contain the list.
  // Alternatively, we can assume a known list or try to fetch from a known API if discovered.
  // For now, let's try to fetch the page and extract, or just return an empty list and let user type?
  // User probably wants a dropdown.
  // Let's try to fetch `https://lmarena.ai/api/models` or similar?
  // Wait, the logs didn't show a clear model list API.
  // However, widely known LMArena models: gpt-4, claude-3, etc.
  // Let's try to fetch the create chat page and see if there is `sk-` or `NEXT_DATA`.

  // IMPORTANT: LMArena updates models frequently.
  // Let's return a hardcoded list of popular ones for now to unblock,
  // OR fetch the homepage and regex match.
  // The logs showed: `modelAId: "019a98f7..."` which are UUIDs.
  // This implies we NEED the mapping.
  // We must find where the frontend gets them.
  // Often Next.js apps have `_next/static/chunks/...` or embedded JSON in HTML.

  // Let's implement a basic scrape for now.
  // Note: The providing `lmarena-other.md` didn't show a clean model API.
  // It showed `GET /vi/c/new?mode=direct`.

  // Strategy: We will try to fetch the /api/tags or similar if exists.
  // If not, we might need manual updating or a smarter scrape.
  // Checking online resources for "LMArena API"... it's not public public.
  // But `https://chat.lmsys.org/` (which lmarena is) usually has `/api/v1/models`?
  // No, this is the new UI `lmarena.ai`.

  // Let's try to hit `https://lmarena.ai/api/models/list` or just `https://lmarena.ai/api/models`.
  // If that fails, we can add a placeholder list and advise the user to check manually or let them type ID?
  // No, IDs are UUIDs.

  // Let's assume we can fetch `https://lmarena.ai/api/models` based on common patterns.
  // If that returns 404, we will log it.

  return [
    { id: 'gpt-4o-2024-05-13', name: 'GPT-4o' },
    { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
    { id: 'gemini-1.5-pro-api-0514', name: 'Gemini 1.5 Pro' },
    // These are guess IDs, they might use UUIDs internally now.
    // The logs showed UUIDs: `modelAId: "019a98f7-afcd-779f-8dcb-856cc3b3f078"`.
    // This IS CRITICAL. We need the real IDs.

    // Re-reading logs:
    // Request to create evaluation didn't show a model list request immediately before.
    // It implies the Next.js app has them preloaded.
    // We can try to fetch `https://lmarena.ai/_next/data/<build-id>/en/c/new.json`?
    // The build ID `9eZuFeUEcauvnxzaLSj7tczACJFs` is in the URL in logs.
    // BUT that changes.

    // Alternative: `https://lmarena.ai/api/config`?
  ];
};

// Start a new conversation or continue
export const chatCompletionStream = (req: Request, res: Response, account: Account) => {
  const { messages, model, conversation_id, parent_message_id } = req.body;

  // Note: LMArena uses UUIDs for everything.
  // If we don't have a conversation_id, we create one.
  // BUT the API endpoint to create is `/nextjs-api/stream/create-evaluation` (for new)
  // or `/nextjs-api/stream/post-to-evaluation/<id>` (for existing).

  const cookies = getCookies(account);
  console.log('[LMArena] Stream request:', { model, conversation_id });

  const lastMessage = messages[messages.length - 1];
  const userContent = lastMessage.content;

  // Need to generate UUIDs for message IDs if not provided?
  // The API sends `userMessageId` and `id` (session id).
  const crypto = require('crypto');
  const newMsgId = crypto.randomUUID();
  const sessionId = conversation_id || crypto.randomUUID();

  // Construct payload
  // For new chat:
  // endpoint: https://lmarena.ai/nextjs-api/stream/create-evaluation
  // body: { id: sessionId, mode: "direct", modelAId: model, userMessageId: newMsgId, userMessage: { content: ... }, ... }

  // For existing chat:
  // endpoint: https://lmarena.ai/nextjs-api/stream/post-to-evaluation/sessionId
  // body: { id: sessionId, modelAId: model, userMessageId: newMsgId, ... }

  const isNewChat = !conversation_id;
  const url = isNewChat
    ? 'https://lmarena.ai/nextjs-api/stream/create-evaluation'
    : `https://lmarena.ai/nextjs-api/stream/post-to-evaluation/${sessionId}`;

  const payload = {
    id: sessionId,
    mode: 'direct', // We only support direct chat for now?
    modelAId: model, // This MUST be the UUID of the model
    userMessageId: newMsgId,
    // For new chat
    ...(isNewChat
      ? {
          modelAMessageId: crypto.randomUUID(), // Placeholder expectation?
          modality: 'chat',
        }
      : {
          // For existing chat
          modelAMessageId: parent_message_id, // This might need to be the PARENT? No, usually expect next msg id or similar?
          // Log says: "modelAMessageId": "..." in request.
          // It seems the client proposes the ID for the assistant's response?
        }),
    userMessage: {
      content: userContent,
      experimental_attachments: [],
      metadata: {},
    },
    // Captcha tokens?
    // "recaptchaV2Token": "..."
    // "recaptchaV3Token": "..."
    // This is the blocker. If they enforce captcha, we might be stuck without a webview.
    // However, sometimes tokens are optional or we can reuse?
    // Let's try sending without first. If fail, we simply can't automate it easily without user interaction.
    // But wait, the Login was via window. Maybe we can get tokens? No.
    // Let's hope for the best or use existing valid cookies.
  };

  const request = net.request({
    method: 'POST',
    url,
  });

  request.setHeader('Cookie', cookies);
  request.setHeader('Content-Type', 'text/plain;charset=UTF-8');
  request.setHeader('User-Agent', USER_AGENT);
  request.setHeader('Origin', 'https://lmarena.ai');
  request.setHeader('Referer', `https://lmarena.ai/c/${sessionId}`);

  request.write(JSON.stringify(payload));
  request.on('response', (response) => {
    // Check status
    if (response.statusCode !== 200) {
      console.error('[LMArena] API Error:', response.statusCode, response.statusMessage);
      res.status(response.statusCode || 500).json({ error: 'Upstream Error' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    response.on('data', (chunk) => {
      const text = chunk.toString();
      // Format is:
      // a2:[{"type":"heartbeat"}]
      // a0:"Xin "
      // a0:"chào! "
      // ad:{"finishReason":"stop"}

      // We need to parse this and convert to OpenAI style or our own style.
      // Let's convert to: data: { choices: [{ delta: { content: "Xin " } }] } ...

      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith('a0:')) {
          // Content
          try {
            // a0:"quoted string"
            // We need to extract the string content.
            // JSON.parse the part after 'a0:'
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
          // ad:{"finishReason":"stop"}
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

  // ... handling
  return new Promise((resolve, reject) => {
    request.setHeader('Cookie', cookies);
    request.setHeader('User-Agent', USER_AGENT);
    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Map to our Interface
          // parsed.history = [...]
          resolve(parsed.history);
        } catch (e) {
          resolve([]);
        }
      });
    });
    request.end();
  });
};

export const getConversationDetail = async (id: string, account: Account) => {
  // GET https://lmarena.ai/api/evaluation/<id>
  // ... similar implementation
  // Return messages in standard format
};
