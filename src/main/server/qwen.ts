import { BrowserWindow, session, net, app } from 'electron';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';

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
    throw new Error('Chrome or Chromium not found. Please install it to use Qwen.');
  }

  const profilePath = join(app.getPath('userData'), 'profiles', 'qwen');
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  console.log('[Qwen] Starting Proxy...');
  await startProxy();

  console.log('[Qwen] Spawning Chrome at:', chromePath);

  const args = [
    // Explicitly set proxy for both HTTP and HTTPS
    '--proxy-server=http=127.0.0.1:8080;https=127.0.0.1:8080',
    // Ensure localhost (if used) doesn't bypass, though usually unrelated to external sites
    '--proxy-bypass-list=<-loopback>',
    '--ignore-certificate-errors',
    `--user-data-dir=${profilePath}`,
    '--disable-http2',
    '--disable-quic',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage', // Docker/low-mem fix
    '--class=qwen-browser', // Help window manager identify it
    'https://chat.qwen.ai/auth',
  ];

  const chromeProcess = spawn(chromePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr
  });

  if (chromeProcess.stdout) {
    chromeProcess.stdout.on('data', (data) => console.log(`[Qwen Chrome Out]: ${data}`));
  }
  if (chromeProcess.stderr) {
    chromeProcess.stderr.on('data', (data) => console.error(`[Qwen Chrome Err]: ${data}`));
  }

  return new Promise<{ cookies: string }>((resolve, reject) => {
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        chromeProcess.kill();
        stopProxy();
        proxyEvents.off('qwen-cookies', onCookies);
      }
    };

    const onCookies = (cookies: string) => {
      console.log('[Qwen] Cookies captured!');
      cleanup();
      resolve({ cookies });
    };

    proxyEvents.on('qwen-cookies', onCookies);

    chromeProcess.on('close', (code) => {
      if (!resolved) {
        console.log('[Qwen] Chrome closed with code:', code);
        cleanup();
        reject(new Error('Chrome user closed the window before login completed'));
      }
    });
  });
}

export async function getProfile(cookies: string) {
  // Extract token if needed for Authorization header, though usually Cookie is enough
  // Qwen log shows: Authorization: Bearer <token> is NOT used in the request log provided?
  // Actually, look at qwen.md line 26 (signin request) -> set-cookie.
  // Line 55 (GET auths) -> Cookie header only.
  // Wait, let's check log...
  // Line 96 (GET auths response) -> token is in `data.token`.
  // Line 66 (GET auths request) -> Cookie field.

  // It seems Qwen uses Cookie authentication primarily.

  return new Promise<{ name: string; avatar: string; email: string } | null>((resolve) => {
    const request = net.request({
      method: 'GET',
      url: 'https://chat.qwen.ai/api/v1/auths/',
      partition: 'persist:qwen',
    });

    request.setHeader('Cookie', cookies);
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.data) {
              const { name, email, profile_image_url } = json.data;
              resolve({
                name: name || 'Qwen User',
                avatar: profile_image_url || '',
                email: email || '',
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    request.on('error', () => resolve(null));
    request.end();
  });
}

export async function sendMessage(
  cookies: string,
  model: string,
  messages: any[],
  onProgress: (content: string) => void,
) {
  // Qwen sendMessage implementation
  // Endpoint: POST https://chat.qwen.ai/api/v2/chat/completions?chat_id=...
  // Payload involves `chat_id`, `parent_id` (null for new), `messages`.
  // It seems complex to manage chat_id/parent_id state merely from a simple sendMessage call.
  // For now, let's try a stateless approach or generate a new chat_id for each conversation if needed,
  // but usually we want to append.

  // Simplification: We'll create a new conversation for each message for now (or handle state later),
  // BUT wait, looking at the log (line 99), `chat_id` is passed in query param.
  // Payload includes `parent_id`.

  // For a quick integration, let's try to just hit the endpoint.
  // Requirement: We need a valid `chat_id`? Or can we omit it?
  // Usually these web UIs create a chat ID first or generate one.
  // Let's assume we can generate a UUID if needed.

  const { v4: uuidv4 } = require('uuid');
  const chatId = uuidv4(); // Or reuse if we had context
  const parentId = null; // New chat

  // Prepare messages. Qwen expects:
  // { "role": "user", "content": "..." }
  // In the log (line 150):
  // messages: [{ "id": "...", "role": "user", "content": "...", ... }]

  const qwenMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
    id: uuidv4(), // Generate ID for message
    timestamp: Math.floor(Date.now() / 1000),
  }));

  const payload = {
    stream: true,
    version: '2.1',
    incremental_output: true,
    chat_id: chatId,
    chat_mode: 'normal',
    model: model || 'qwen3-max-2025-09-23', // Default from log
    parent_id: parentId,
    messages: qwenMessages,
    timestamp: Math.floor(Date.now() / 1000),
  };

  return new Promise<void>((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: `https://chat.qwen.ai/api/v2/chat/completions?chat_id=${chatId}`,
      partition: 'persist:qwen',
    });

    request.setHeader('Cookie', cookies);
    request.setHeader('Content-Type', 'application/json');
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    request.setHeader('Origin', 'https://chat.qwen.ai');
    request.setHeader('Referer', `https://chat.qwen.ai/c/${chatId}`);

    request.write(JSON.stringify(payload));

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        console.error(`[Qwen] API Error: ${response.statusCode}`);
        // consume data to see error
        response.on('data', (d) => console.error(d.toString()));
        reject(new Error(`Qwen API returned ${response.statusCode}`));
        return;
      }

      response.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();
            if (jsonStr === '[DONE]') return;
            try {
              const json = JSON.parse(jsonStr);
              // Log format: {"choices": [{"delta": {"content": "..."}}]}
              if (json.choices && json.choices.length > 0) {
                const delta = json.choices[0].delta;
                if (delta && delta.content) {
                  onProgress(delta.content);
                }
              }
            } catch (e) {
              // ignore parse error for partial chunks
            }
          }
        }
      });

      response.on('end', () => {
        resolve();
      });

      response.on('error', (e: any) => reject(e));
    });

    request.on('error', (e) => reject(e));
    request.end();
  });
}
