import { Request, Response } from 'express';
import { Account } from '../ipc/accounts';
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
    return [];
  }
};

const getToken = (account: Account) => {
  // We store the token in the credential field for Zai (it's a Bearer token or cookie string)
  // If it's a JSON cookie array, we might look for a specific cookie, but Zai uses Bearer token mostly.
  // Our login flow will just store the token string directly if possible, or the full cookie string.
  // Let's assume we store the token info in account.metadata.token or just use credential as the token if it's a string.
  if (account.metadata?.token) return account.metadata.token;
  return '';
};

export const chatCompletionStream = async (req: Request, res: Response, account: Account) => {
  const token = getToken(account);
  console.log('[Zai] Token present:', !!token);

  if (!token) {
    res.status(401).json({ error: 'Missing Zai token' });
    return;
  }

  try {
    const { messages, model, stream } = req.body;

    // Transform messages to Zai format if needed, but standard OpenAI format often works or needs minor tweaks.
    // Zai API expects "messages": [{ "role": "user", "content": "..." }]

    // Construct payload
    const payload = {
      model: model || 'glm-4.7',
      messages: messages,
      stream: true,
      // Default params observed in logs
      enable_thinking: true,
      auto_web_search: true,
    };

    console.log('[Zai] Sending chat request:', JSON.stringify(payload));

    const response = await fetch('https://chat.z.ai/api/v2/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent':
          account.userAgent ||
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        Origin: 'https://chat.z.ai',
        Referer: 'https://chat.z.ai/',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Zai] API Error:', response.status, errorText);
      res.status(response.status).json({ error: errorText });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        // Zai sends SSE format: "data: {...}"
        // We can just forward the chunk if it matches OpenAI format,
        // or we parse and re-emit.
        // Zai seems to use standard SSE but let's parse to be safe and ensure format compatibility.

        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }
            try {
              const data = JSON.parse(dataStr);
              // Zai response format might need mapping to standard OpenAI if standard client is used
              // Assuming Zai mimics OpenAI structure based on endpoint name
              // If Zai returns { id:..., choices: [...] }, we can just forward.
              res.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch (e) {
              // ignore partial json
            }
          }
        }
      }
    }

    res.end();
  } catch (error: any) {
    console.error('Zai Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getModels = async (req: Request, res: Response, account: Account) => {
  // Return hardcoded models for now as Zai seems to have a fixed set or we verify later
  const models = [
    { id: 'glm-4.7', object: 'model', owned_by: 'Zai', name: 'GLM 4.7' },
    { id: 'glm-4.6', object: 'model', owned_by: 'Zai', name: 'GLM 4.6' },
    { id: 'gemini-1.5-pro', object: 'model', owned_by: 'Zai', name: 'Gemini 1.5 Pro' },
  ];
  res.json({ object: 'list', data: models });
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
  return null;
};

export async function login() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome or Chromium not found.');
  }

  const profilePath = join(app.getPath('userData'), 'profiles', 'zai');
  if (fs.existsSync(profilePath)) {
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
  fs.mkdirSync(profilePath, { recursive: true });

  await startProxy();

  const args = [
    '--proxy-server=http=127.0.0.1:22122;https=127.0.0.1:22122',
    '--proxy-bypass-list=<-loopback>',
    '--ignore-certificate-errors',
    `--user-data-dir=${profilePath}`,
    '--no-first-run',
    '--no-default-browser-check',
    'https://chat.z.ai/auth',
  ];

  const chromeProcess = spawn(chromePath, args, {
    detached: false,
    stdio: 'ignore',
  });

  return new Promise<{
    cookies: string;
    email: string;
    name?: string;
    avatar?: string;
    metadata?: any;
  }>((resolve, reject) => {
    let resolved = false;
    let capturedToken = '';
    let capturedUserInfo: any = null;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        chromeProcess.kill();
        stopProxy();
        proxyEvents.off('zai-token', onToken);
        proxyEvents.off('zai-user-info', onUserInfo);
      }
    };

    const finalize = () => {
      if (resolved) return;
      cleanup();
      resolve({
        cookies: '', // We use token primarily
        email: capturedUserInfo?.email || 'zai_user@example.com',
        name: capturedUserInfo?.name || 'Zai User',
        avatar: capturedUserInfo?.avatar || '',
        metadata: {
          token: capturedToken,
        },
      });
    };

    const onToken = (token: string) => {
      console.log('[Zai] Token captured');
      capturedToken = token;
      if (capturedUserInfo) finalize();
    };

    const onUserInfo = (info: any) => {
      console.log('[Zai] User info captured');
      capturedUserInfo = info;
      if (capturedToken) finalize();
    };

    // Listen for events from proxy (need to update proxy.ts to emit these)
    // For now, we assume proxy.ts will be updated or we perform generic header interception if proxy supports it.
    // The current proxy.ts likely has specific event emitters for Gemini etc.
    // We'll need to update proxy.ts first or assume it emits generic events?
    // Looking at gemini.ts, it imports `proxyEvents`.

    // We will need to MODIFY proxy.ts to intercept Zai specific headers.

    proxyEvents.on('zai-token', onToken);
    proxyEvents.on('zai-user-info', onUserInfo);

    setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('Login timed out'));
      }
    }, 120000); // 2 mins

    chromeProcess.on('close', () => {
      if (!resolved && capturedToken) finalize();
      else if (!resolved) {
        cleanup();
        reject(new Error('Window closed'));
      }
    });
  });
}
