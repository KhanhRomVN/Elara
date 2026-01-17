import { Request, Response } from 'express';
import { Account } from '../ipc/accounts';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';

const getCookies = (account: Account) => {
  if (!account.credential) return [];
  try {
    return JSON.parse(account.credential);
  } catch (error) {
    return account.credential.split(';').map((c) => {
      const parts = c.trim().split('=');
      const name = parts[0];
      const value = parts.slice(1).join('=');
      return { name, value };
    });
  }
};

const getCookieValue = (cookies: any[], name: string) => {
  const cookie = cookies.find((c: any) => c.name === name);
  return cookie ? cookie.value : '';
};

export const chatCompletionStream = async (req: Request, res: Response, account: Account) => {
  const cookies = getCookies(account);
  console.log('[Gemini] Account:', account.email);
  console.log('[Gemini] Cookies count:', cookies.length);

  const sid = getCookieValue(cookies, '__Secure-1PSID'); // or f.sid from account data
  const snlm0e = account.metadata?.snlm0e; // We need to store this in account
  const bl = account.metadata?.bl || 'boq_assistant-bard-web-server_20240319.13_p0'; // Fallback or dynamic

  console.log('[Gemini] Extracted credentials:', {
    sid: sid ? 'REDACTED (Present)' : 'MISSING',
    snlm0e: snlm0e ? 'REDACTED (Present)' : 'MISSING',
    bl,
  });

  // Validations
  if (!sid || !snlm0e) {
    res.status(401).json({ error: 'Missing credentials (SID or SNlM0e)' });
    return;
  }

  try {
    const { messages, model } = req.body;
    console.log('[Gemini] Request body:', JSON.stringify(req.body, null, 2));
    const prompt = messages[messages.length - 1].content; // Simplified for now

    // Construct f.req payload
    // This is a complex nested array structure.
    // [null,"[[prompt],null,[conversation_id, rpc_id, null]]",null,null]
    // We need to reverse engineer the exact structure.
    // Based on open source reverse engineering of Gemini/Bard:
    const reqBody = [
      null,
      JSON.stringify([
        [prompt],
        null,
        [account.metadata?.conversationContext || '', '', ''], // Context, rpc, etc.
      ]),
      null,
      null,
    ];

    const fReq = JSON.stringify(reqBody);
    console.log('[Gemini] f.req payload:', fReq);
    const params = new URLSearchParams();
    params.append('f.req', fReq);
    params.append('at', account.metadata?.snlm0e || ''); // xsrf token (SNlM0e)

    const response = await fetch(
      `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=${bl}&f.sid=${account.metadata?.f_sid || ''}&hl=en&_reqid=${Date.now()}&rt=c`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Cookie: account.credential, // Full cookie string
          'User-Agent': account.userAgent || '',
          Origin: 'https://gemini.google.com',
          Referer: 'https://gemini.google.com/',
          'X-Same-Domain': '1',
        },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API Error:', response.status, errorText);
      res.status(response.status).json({ error: errorText });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log('[Gemini] Response OK, starting stream...');

    // Parse streaming response (it's batched JSON)
    // We need a helper to parse Google's ")]}'\n" prefixed JSON stream
    // For now, we can just pipe raw or implement a simple transform.
    // Ideally we stream simplified chunks.

    // For MVP, let's just buffer and send one chunk or pipe raw?
    // Piping raw might break the playground which expects OpenAI format.
    // We need to transform.

    // Let's implement a basic accumulated response for now or streaming if possible.
    // Given complexity, let's assume we read text and parse.

    // ... Transformation logic ...
    // Since this is complex, I will implement a placeholder that calls the API and logs the response to debug first,
    // or tries to do a best-effort streaming.

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process line by line
        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          // Skip garbage or keep-alive
          if (line.includes(")]}'")) continue;

          try {
            const json = JSON.parse(line);

            // Skip numeric headers (length prefixes)
            if (typeof json === 'number') continue;

            // Normalize to array of chunks
            // Sometimes it is `["w", ...]` (legacy?) but verification shows `[["wrb.fr", ...]]`
            const chunks = Array.isArray(json) && Array.isArray(json[0]) ? json : [json];

            for (const item of chunks) {
              // Check for valid data wrapper
              if (Array.isArray(item) && typeof item[0] === 'string') {
                const messageId = item[0];
                // console.log('[Gemini] Chunk identifier:', messageId);

                const payload = item[2];
                if (typeof payload === 'string') {
                  const innerJson = JSON.parse(payload);

                  // Debug log structure
                  // console.log('[Gemini] Inner JSON root type:', Array.isArray(innerJson) ? 'Array' : typeof innerJson);
                  // if (Array.isArray(innerJson)) {
                  //   console.log('[Gemini] Inner JSON length:', innerJson.length);
                  //   // Safely log the structure structure
                  //   console.log(
                  //     '[Gemini] Inner JSON dump:',
                  //     JSON.stringify(innerJson).substring(0, 300) + '...',
                  //   );
                  // }

                  let textChunk = null;

                  if (Array.isArray(innerJson)) {
                    // Standard generic extraction attempt

                    // Strategy 1: Look for "rc_" updates (standard streaming content)
                    // Structure: [null, [ids], null, null, [[ "rc_...", ["text content"] ]]]
                    // innerJson[4] is the updates array
                    try {
                      const candidates = innerJson?.[4];
                      if (Array.isArray(candidates)) {
                        for (const candidate of candidates) {
                          if (Array.isArray(candidate) && candidate.length >= 2) {
                            // candidate[0] is usually messageId "rc_..."
                            const msgContent = candidate[1];
                            if (Array.isArray(msgContent) && msgContent.length > 0) {
                              if (typeof msgContent[0] === 'string') {
                                textChunk = msgContent[0];
                                break; // Found one
                              }
                            }
                          }
                        }
                      }
                    } catch (e) {
                      // console.log('[Gemini] Error extraction path 1:', e);
                    }

                    // Strategy 2: Fallback path (sometimes observed in older traces or full sync)
                    if (!textChunk) {
                      const altChunk = innerJson?.[0]?.[1]?.[0];
                      if (typeof altChunk === 'string') textChunk = altChunk;
                    }
                  }

                  if (textChunk) {
                    // console.log('[Gemini] Extracted text chunk length:', textChunk.length);
                    res.write(
                      `data: ${JSON.stringify({
                        id: 'chatcmpl-' + randomUUID(),
                        object: 'chat.completion.chunk',
                        created: Date.now() / 1000,
                        model: model,
                        choices: [{ delta: { content: textChunk }, index: 0, finish_reason: null }],
                      })}\n\n`,
                    );
                  }
                }
              } else {
                // console.log('[Gemini] Ignored chunk structure:', JSON.stringify(item).substring(0, 50));
              }
            }
          } catch (e) {
            // console.error('Error parsing JSON chunk', e);
          }
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getConversations = async (_req: Request, res: Response, _account: Account) => {
  // Placeholder
  res.json([]);
};

export const getConversation = async (_req: Request, res: Response, _account: Account) => {
  // Placeholder
  res.json({});
};

export const getModels = async (req: Request, res: Response, account: Account) => {
  const cookies = getCookies(account);
  console.log('[Gemini] Fetching models for:', account.email);

  const bl = account.metadata?.bl || 'boq_assistant-bard-web-server_20240319.13_p0';
  const f_sid = account.metadata?.f_sid || '';
  const snlm0e = account.metadata?.snlm0e || '';

  if (!snlm0e) {
    res.status(401).json({ error: 'Missing SNlM0e token' });
    return;
  }

  try {
    const fReq = JSON.stringify([[['otAQ7b', '[]', null, 'generic']]]);
    const params = new URLSearchParams();
    params.append('f.req', fReq);
    params.append('at', snlm0e);

    const response = await fetch(
      `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=otAQ7b&source-path=%2Fapp&bl=${bl}&f.sid=${f_sid}&hl=en&_reqid=${Date.now()}&rt=c`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Cookie: account.credential,
          'User-Agent': account.userAgent || '',
          Origin: 'https://gemini.google.com',
          Referer: 'https://gemini.google.com/',
          'X-Same-Domain': '1',
        },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const text = await response.text();
    // Parse the response
    const lines = text.split('\n');
    let models: any[] = [];

    for (const line of lines) {
      if (line.includes(")]}'")) continue;
      try {
        const json = JSON.parse(line);
        // Normalize to array of chunks
        const chunks = Array.isArray(json) && Array.isArray(json[0]) ? json : [json];

        for (const item of chunks) {
          if (Array.isArray(item) && item[0] === 'wrb.fr' && item[1] === 'otAQ7b') {
            const payload = item[2];
            if (typeof payload === 'string') {
              const innerJson = JSON.parse(payload);
              // The structure based on inspection:
              // innerJson[15] appears to be the list of models?
              // Let's traverse to find the list.
              // Based on sample:
              // inner[15] -> array of models.
              // Each model: [id, name, description, ...]

              // Verification from sample:
              // "fbb..." -> Nhanh
              // "5bf..." -> Tư duy
              // "9d8..." -> Pro

              // We will try to find this array.
              // It seems to be at a high index, let's look for known IDs or patterns.
              if (Array.isArray(innerJson)) {
                for (const el of innerJson) {
                  if (Array.isArray(el) && el.length > 0 && Array.isArray(el[0])) {
                    // Potential candidate for list of models
                    // Check if elements look like models
                    const first = el[0];
                    if (
                      Array.isArray(first) &&
                      typeof first[1] === 'string' &&
                      typeof first[2] === 'string'
                    ) {
                      // Looks like a model list
                      models = el.map((m: any) => ({
                        id: m[0], // "fbb127bbb056c959"
                        name: m[1], // "Nhanh"
                        description: m[2], // "Trả lời nhanh"
                        isDefault: m[19] === true || false,
                      }));
                    }
                  }
                }

                // Hardcoded fallback index 15 as per some traces
                if (models.length === 0 && Array.isArray(innerJson[15])) {
                  models = innerJson[15].map((m: any) => ({
                    id: m[0],
                    name: m[1],
                    description: m[2],
                  }));
                }
              }
            }
          }
        }
      } catch (e) {}
    }

    console.log('[Gemini] Found models:', models);
    res.json(models);
  } catch (error) {
    console.error('Gemini Models Error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
};

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

export async function login() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome or Chromium not found. Please install it to use Gemini.');
  }

  const profilePath = join(app.getPath('userData'), 'profiles', 'gemini');
  if (fs.existsSync(profilePath)) {
    console.log('[Gemini] Clearing old profile...');
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
  fs.mkdirSync(profilePath, { recursive: true });

  console.log('[Gemini] Starting Proxy...');
  await startProxy();

  console.log('[Gemini] Spawning Chrome at:', chromePath);

  const args = [
    '--proxy-server=http=127.0.0.1:22122;https=127.0.0.1:22122',
    '--proxy-bypass-list=<-loopback>',
    '--ignore-certificate-errors',
    `--user-data-dir=${profilePath}`,
    '--disable-http2', // Force HTTP/1.1 to simplify interception
    '--disable-quic', // connection resiliency
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--class=gemini-browser',
    'https://gemini.google.com',
  ];

  const chromeProcess = spawn(chromePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (chromeProcess.stdout) {
    chromeProcess.stdout.on('data', (data) => console.log(`[Gemini Chrome Out]: ${data}`));
  }
  if (chromeProcess.stderr) {
    chromeProcess.stderr.on('data', (data) => console.error(`[Gemini Chrome Err]: ${data}`));
  }

  return new Promise<{
    cookies: string;
    email: string;
    metadata?: any;
  }>((resolve, reject) => {
    let resolved = false;
    let capturedCookies = '';
    let capturedMetadata: any = {};
    let capturedUserInfo: any = null;
    let finishTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        if (finishTimer) clearTimeout(finishTimer);
        chromeProcess.kill();
        stopProxy();
        proxyEvents.off('gemini-cookies', onCookies);
        proxyEvents.off('gemini-metadata', onMetadata);
        proxyEvents.off('gemini-user-info', onUserInfo);
      }
    };

    const finalize = () => {
      if (resolved) return;

      // Default values
      let email = 'gemini@user.com';

      if (capturedUserInfo) {
        email = capturedUserInfo.email || email;
      }

      cleanup();

      resolve({
        cookies: capturedCookies,
        email,
        metadata: capturedMetadata,
      });
    };

    const checkForCompletion = () => {
      // If we have everything, we can finish quickly
      if (capturedCookies && capturedMetadata.snlm0e && capturedMetadata.bl && capturedUserInfo) {
        console.log(
          '[Gemini] All critical data captured (Cookies, SNlM0e, BL, UserInfo)! Finalizing...',
        );
        // Give a tiny buffer for any last moment updates, then finish
        if (finishTimer) clearTimeout(finishTimer);
        finishTimer = setTimeout(finalize, 2000);
        return;
      }

      // If we have cookies and tokens but no UserInfo, wait a bit longer then finish
      if (capturedCookies && capturedMetadata.snlm0e && capturedMetadata.bl) {
        console.log(
          '[Gemini] Credentials captured (Cookies, SNlM0e, BL). Waiting for UserInfo or timeout...',
        );
        if (!finishTimer) {
          finishTimer = setTimeout(finalize, 8000); // Wait 8s for User Info
        }
      }
    };

    const restartInactivityTimer = () => {
      // If we have some data but haven't finished, ensure we don't wait forever
      // Every time we get data, we extend the "inactivity" timeout
      if (finishTimer) clearTimeout(finishTimer);

      // If we already have cookies, set a "sufficient" timeout
      // If we don't have cookies yet, we just wait (global timeout handles the rest)
      if (capturedCookies) {
        finishTimer = setTimeout(finalize, 15000); // 15s inactivity timeout
      }
    };

    const onMetadata = (metadata: any) => {
      console.log('[Gemini] Metadata captured:', metadata);
      capturedMetadata = { ...capturedMetadata, ...metadata };
      checkForCompletion();
    };

    const onUserInfo = (userInfo: any) => {
      console.log('[Gemini] User Info captured:', userInfo.email);
      capturedUserInfo = userInfo;
      checkForCompletion();
    };

    const onCookies = (cookies: string) => {
      // Only log if it's the first time or significantly different (simplified verification)
      if (!capturedCookies) console.log('[Gemini] Cookies captured!');
      capturedCookies = cookies;

      // We got cookies, trigger checks
      checkForCompletion();

      // Also ensure we have a fallback timer running if this is the first cookie
      if (!finishTimer) {
        restartInactivityTimer();
      }
    };

    proxyEvents.on('gemini-cookies', onCookies);
    proxyEvents.on('gemini-metadata', onMetadata);
    proxyEvents.on('gemini-user-info', onUserInfo);

    // Hard limit 2 minutes
    setTimeout(() => {
      if (!resolved) {
        if (capturedCookies) {
          console.log('[Gemini] Hard timeout reached, but have cookies. resolving...');
          finalize();
        } else {
          cleanup();
          reject(new Error('Login timed out (no cookies captured)'));
        }
      }
    }, 120000);

    chromeProcess.on('close', (code) => {
      if (!resolved) {
        if (capturedCookies) {
          console.log('[Gemini] Chrome closed, resolving with captured data.');
          finalize();
        } else {
          console.log('[Gemini] Chrome closed with code:', code);
          cleanup();
          reject(new Error('Chrome user closed the window before login completed'));
        }
      }
    });
  });
}
