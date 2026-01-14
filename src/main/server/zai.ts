import { Request, Response } from 'express';
import { Account } from '../ipc/accounts';
import { app } from 'electron';
import { join } from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';
import crypto from 'crypto';

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
    const { messages, model } = req.body;

    // Transform messages to Zai format if needed, but standard OpenAI format often works or needs minor tweaks.
    // Zai API expects "messages": [{ "role": "user", "content": "..." }]

    // Construct payload matching the user's working example
    const payload = {
      stream: true,
      model: model || 'glm-4.7',
      messages: messages,
      signature_prompt: messages.length > 0 ? messages[messages.length - 1].content : '',
      params: {},
      extra: {},
      features: {
        image_generation: false,
        web_search: false,
        auto_web_search: false,
        preview_mode: true,
        flags: [],
        enable_thinking: true,
      },
      variables: {
        '{{USER_NAME}}': 'User',
        '{{USER_LOCATION}}': 'Unknown',
        '{{CURRENT_DATETIME}}': new Date().toISOString().replace('T', ' ').split('.')[0],
        '{{CURRENT_DATE}}': new Date().toISOString().split('T')[0],
        '{{CURRENT_TIME}}': new Date().toTimeString().split(' ')[0],
        '{{CURRENT_WEEKDAY}}': new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        '{{CURRENT_TIMEZONE}}': Intl.DateTimeFormat().resolvedOptions().timeZone,
        '{{USER_LANGUAGE}}': 'en-US',
      },
      // Generate UUIDs for IDs if not provided
      chat_id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      current_user_message_id: crypto.randomUUID(),
      current_user_message_parent_id: null,
      background_tasks: {
        title_generation: true,
        tags_generation: true,
      },
    };

    console.log('[Zai] Sending chat request payload:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://chat.z.ai/api/v2/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent':
          account.userAgent ||
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'Accept-Encoding': 'identity', // Keep identity to avoid manual decompression issues
        Origin: 'https://chat.z.ai',
        Referer: 'https://chat.z.ai/',
        'x-fe-version': 'prod-fe-1.0.200', // Added from user log
        'sec-ch-ua-platform': '"Linux"',
        'accept-language': 'en-US',
        // Try faking signature with a previously valid one or a random hex string
        'x-signature': '4f8e5f2e8a6297d08437ce49647f5f9ccf66b802adf434900a2a3b7cfc4c53f1',
      },
      body: JSON.stringify(payload),
    });

    console.log('[Zai] API Response Status:', response.status);
    console.log('[Zai] API Response Headers:', JSON.stringify([...response.headers.entries()]));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Zai] API Error Body:', errorText);
      res.status(response.status).json({ error: errorText });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const decoder = new TextDecoder();

    if (response.headers.get('content-encoding') === 'br') {
      // Handle Brotli decompression manually for Node.js fetch
      const zlib = require('zlib');
      const { Readable } = require('stream');

      // Convert Web Stream to Node Stream
      // @ts-ignore
      const nodeStream = Readable.fromWeb(response.body);
      const decompress = zlib.createBrotliDecompress();
      const pipeline = nodeStream.pipe(decompress);

      pipeline.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        // parse SSE from text
        const lines = text.split('\n');
        for (const line of lines) {
          processLine(line, res);
        }
      });

      pipeline.on('end', () => {
        res.end();
      });

      pipeline.on('error', (err: any) => {
        console.error('[Zai] Decompression Error:', err);
        res.end();
      });

      // Return early as we are handling stream via events
      return;
    }

    const reader = response.body?.getReader();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);

        const lines = chunk.split('\n');
        for (const line of lines) {
          processLine(line, res);
        }
      }
    }

    res.end();
  } catch (error: any) {
    console.error('Zai Error:', error);
    res.status(500).json({ error: error.message });
  }
};

const processLine = (line: string, res: Response) => {
  if (line.startsWith('data: ')) {
    const dataStr = line.slice(6).trim();
    if (dataStr === '[DONE]') {
      res.write('data: [DONE]\n\n');
      return;
    }
    try {
      const data = JSON.parse(dataStr);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // ignore partial json
    }
  }
};

export const getModels = async (_req: Request, res: Response, _account: Account) => {
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
      console.log('[Zai] Token captured. Length:', token.length);
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
