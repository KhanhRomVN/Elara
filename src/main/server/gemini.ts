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
  const sid = getCookieValue(cookies, '__Secure-1PSID'); // or f.sid from account data
  const snlm0e = account.metadata?.snlm0e; // We need to store this in account
  const bl = account.metadata?.bl || 'boq_assistant-bard-web-server_20240319.13_p0'; // Fallback or dynamic

  // Validations
  if (!sid || !snlm0e) {
    res.status(401).json({ error: 'Missing credentials (SID or SNlM0e)' });
    return;
  }

  try {
    const { messages, model } = req.body;
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
    const params = new URLSearchParams();
    params.append('f.req', fReq);
    params.append('at', account.metadata?.at || ''); // xsrf token

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
      console.error('Gemini API Error:', response.status, errorText);
      res.status(response.status).json({ error: errorText });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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
        // Process buffer line by line
        // Google keeps sending chunks.
        // ...
        // Sends back to client
        res.write(
          `data: ${JSON.stringify({
            id: 'chatcmpl-' + randomUUID(),
            object: 'chat.completion.chunk',
            created: Date.now() / 1000,
            model: model,
            choices: [{ delta: { content: '...' }, index: 0, finish_reason: null }],
          })}\n\n`,
        );
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
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  console.log('[Gemini] Starting Proxy...');
  await startProxy();

  console.log('[Gemini] Spawning Chrome at:', chromePath);

  const args = [
    '--proxy-server=http=127.0.0.1:8080;https=127.0.0.1:8080',
    '--proxy-bypass-list=<-loopback>',
    '--ignore-certificate-errors',
    `--user-data-dir=${profilePath}`,
    '--disable-http2',
    '--disable-quic',
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

  return new Promise<{ cookies: string; email: string }>((resolve, reject) => {
    let resolved = false;
    let capturedCookies = '';

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        chromeProcess.kill();
        stopProxy();
        proxyEvents.off('gemini-cookies', onCookies);
      }
    };

    const onCookies = (cookies: string) => {
      console.log('[Gemini] Cookies captured!');
      capturedCookies = cookies;
      // Wait a bit to ensure potential other headers (not used yet) are captured if needed,
      // or just enough for user to be fully logged in.
      // For Google, sometimes multiple cookie sets come.

      // We'll resolve after a short delay
      setTimeout(() => {
        cleanup();
        resolve({ cookies: capturedCookies, email: 'gemini@user.com' });
      }, 2000);
    };

    proxyEvents.on('gemini-cookies', onCookies);

    chromeProcess.on('close', (code) => {
      if (!resolved) {
        if (capturedCookies) {
          cleanup();
          resolve({ cookies: capturedCookies, email: 'gemini@user.com' });
        } else {
          console.log('[Gemini] Chrome closed with code:', code);
          cleanup();
          reject(new Error('Chrome user closed the window before login completed'));
        }
      }
    });
  });
}
