import { Request, Response } from 'express';
import { net } from 'electron';
import { Account } from '../ipc/accounts';
import { app } from 'electron';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';
import { randomBytes } from 'crypto';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

// Manual UUIDv7 generator (time-based UUID)
const uuidv7 = (): string => {
  const timestamp = Date.now();
  const bytes = randomBytes(16);

  // Set timestamp (48 bits = 6 bytes)
  // JS bitwise operators truncate to 32 bits, so we use math instead
  bytes[0] = Math.floor(timestamp / 0x10000000000) & 0xff;
  bytes[1] = Math.floor(timestamp / 0x100000000) & 0xff;
  bytes[2] = Math.floor(timestamp / 0x1000000) & 0xff;
  bytes[3] = Math.floor(timestamp / 0x10000) & 0xff;
  bytes[4] = Math.floor(timestamp / 0x100) & 0xff;
  bytes[5] = timestamp & 0xff;

  // Set version 7 (4 bits)
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // Set variant (2 bits)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [
    bytes.subarray(0, 4).toString('hex'),
    bytes.subarray(4, 6).toString('hex'),
    bytes.subarray(6, 8).toString('hex'),
    bytes.subarray(8, 10).toString('hex'),
    bytes.subarray(10, 16).toString('hex'),
  ].join('-');
};

// Helper to get cookies from account
const getCookies = (account: Account) => {
  return account.credential;
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
export const login = (): Promise<{
  cookies: string;
  email?: string;
}> => {
  console.log('[LMArena] Starting Real Browser login flow...');

  const chromePath = findChrome();
  if (!chromePath) {
    return Promise.reject(
      new Error('Chrome or Chromium not found. Please install it to use LMArena.'),
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
    const profilePath = join(app.getPath('userData'), 'profiles', 'lmarena');
    if (fs.existsSync(profilePath)) {
      console.log('[LMArena] Clearing old profile...');
      fs.rmSync(profilePath, { recursive: true, force: true });
    }
    fs.mkdirSync(profilePath, { recursive: true });

    // 3. Spawn Chrome
    console.log('[LMArena] Spawning Chrome at:', chromePath);
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
      '--class=lmarena-browser',
      'https://lmarena.ai/',
    ];

    const chromeProcess = spawn(chromePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (chromeProcess.stdout) {
      chromeProcess.stdout.on('data', (data) => console.log(`[LMArena Chrome Out]: ${data}`));
    }
    if (chromeProcess.stderr) {
      chromeProcess.stderr.on('data', (data) => console.error(`[LMArena Chrome Err]: ${data}`));
    }

    // 4. Listen for Proxy Events
    let capturedCookies = '';
    let email = '';
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
        proxyEvents.off('lmarena-cookies', onCookies);
        proxyEvents.off('lmarena-login-success', onLoginSuccess);
      }
    };

    const finalize = () => {
      if (resolved) return;

      // Final check for user info if not already set
      if (!email && capturedCookies) {
        const profile = getProfile(capturedCookies);
        if (profile.email) {
          email = profile.email;
        }
      }

      // Fallback defaults
      if (!email) email = 'user@lmarena.ai';
      // Fallback defaults
      if (!email) email = 'user@lmarena.ai';

      cleanup();

      resolve({
        cookies: capturedCookies,
        email,
      });
    };

    const attemptResolve = () => {
      if (email && capturedCookies) {
        console.log('[LMArena] Email and cookies secured. Finalizing...');
        if (finishTimer) clearTimeout(finishTimer);
        finishTimer = setTimeout(finalize, 1500);
      }
    };

    const onCookies = (cookies: string) => {
      const profile = getProfile(cookies);
      capturedCookies = cookies;

      if (profile.email) {
        console.log('[LMArena] Valid login cookies captured! Email:', profile.email);
        email = profile.email;
        console.log('[LMArena] Valid login cookies captured! Email:', profile.email);
        email = profile.email;
        attemptResolve();
      } else {
        // Maybe we got cookies but not the email yet (guest cookie?), allow update
        if (email) attemptResolve();
      }
    };

    const onLoginSuccess = (user: any) => {
      console.log('[LMArena] API Login Success Event:', user.email);
      if (user.email) {
        email = user.email;
        email = user.email;
        attemptResolve();
      }
    };

    proxyEvents.on('lmarena-cookies', onCookies);
    proxyEvents.on('lmarena-login-success', onLoginSuccess);

    // Hard limit 3 minutes
    setTimeout(() => {
      if (!resolved) {
        if (capturedCookies) {
          console.log('[LMArena] Timeout, but cookies found. Resolving...');
          finalize();
        } else {
          cleanup();
          reject(new Error('Login timed out'));
        }
      }
    }, 180000);

    chromeProcess.on('close', (code) => {
      if (!resolved) {
        if (capturedCookies && email) {
          finalize();
        } else {
          console.log('[LMArena] Chrome closed with code:', code);
          cleanup();
          reject(new Error('User closed login window'));
        }
      }
    });
  });
};

// Fetch user profile from cookie
const getProfile = (cookies: string): { email: string } => {
  try {
    // Support both v1.0 and v1.1
    // v1.0: arena-auth-prod-v1.0=base64(...)
    // v1.1: arena-auth-prod-v1.1=base64(...)
    const match = cookies.match(/arena-auth-prod-v1\.[0-9]+=([a-zA-Z0-9+/=]+)/);
    if (match && match[1]) {
      let jsonStr = Buffer.from(match[1], 'base64').toString('utf-8');

      // Attempt to clean up JSON if it contains extra characters or is URI encoded
      try {
        // v1.1 might need decoding? Usually base64 is enough.
        // Some cookies might be URI encoded first.
        if (jsonStr.includes('%')) jsonStr = decodeURIComponent(jsonStr);

        let data = JSON.parse(jsonStr);

        // If array, take first element (common in some auth providers)
        if (Array.isArray(data)) {
          data = data[0];
        }

        if (data.email || (data.user && data.user.email)) {
          const email = data.email || data.user.email;
          return {
            email,
          };
        }
      } catch (innerE) {
        // ignore
      }
    }
  } catch (e) {
    console.error('[LMArena] Error parsing auth cookie:', e);
  }
  return { email: '' };
};

// Get Models via Next.js Server Action
export const getModels = async (account: Account) => {
  const cookies = getCookies(account);
  // Default to the email in account if available, or fetch it?
  // The log shows sending the email as an argument: ["email"]
  // We'll use account.email (it's in the account object if we saved it login).
  // If not, we might need to rely on what we have.
  // The account object usually has user info in `account.name` or `metadata`.
  // Let's assume account.email is available or we pass a placeholder.
  // Actually the log showed `["thienbaovn2468@gmail.com"]`.
  // If we don't have the email, we might fail.
  // But wait, the login flow 'finalize' sets 'email'.

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

    // Body is a JSON array containing the arguments for the action.
    // Here it seems to be just the email?
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

    // Extract initialModels using Regex
    // Looking for: "initialModels":[{...}]
    // The response is RSC, so it might be messy.
    // We'll look for the JSON array after "initialModels":
    // Regex: /"initialModels":(\[.*?\])(?:,"|})/
    // Since it's a huge JSON, we might need a robust way.
    // The array ends when brackets verify?
    // Let's try a simple regex first.

    const match = responseBody.match(/"initialModels":(\[.*?\])(?:,"|})/);
    if (match && match[1]) {
      // The captured group is the array string.
      // However, it might contain escaped quotes inside strings.
      // RSC format is usually valid JSON parts.
      // But verify if it's truncated or nested.
      // The log sample shows it as a clean JSON array inside the RSC line.
      // 6:["$","$L15",null,{"initialState":"$undefined","children":["$","$L16",null,{"initialModels":[...]
      // So simple JSON.parse on the array string should work if regex captures correctly.
      // Be careful of greedy matching if there are multiple arrays.
      // We will assume "initialModels":[ ... ] is uniquely identifiable.

      // Better regex to handle potential closing bracket issues?
      // Actually, we can just find the start, count brackets to find end.

      // Let's stick to regex for now, if it fails we can refine.
      // Using non-greedy match for content? JSON array can contain objects.

      // Manual extraction might be safer:
      const startStr = '"initialModels":';
      const startIndex = responseBody.indexOf(startStr);
      if (startIndex !== -1) {
        let arrayStart = startIndex + startStr.length;
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

  // Note: LMArena uses UUIDs for everything.
  // If we don't have a conversation_id, we create one.
  // BUT the API endpoint to create is `/nextjs-api/stream/create-evaluation` (for new)
  // or `/nextjs-api/stream/post-to-evaluation/<id>` (for existing).

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
  return new Promise((resolve) => {
    request.setHeader('Cookie', cookies);
    request.setHeader('User-Agent', USER_AGENT);
    let data = '';
    request.on('response', (response: Electron.IncomingMessage) => {
      response.on('data', (chunk: Buffer) => (data += chunk.toString()));
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

export const getConversationDetail = async (_id: string, _account: Account) => {
  // GET https://lmarena.ai/api/evaluation/<id>
  // ... similar implementation
  // Return messages in standard format
};
