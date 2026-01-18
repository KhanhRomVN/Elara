import { net, app } from 'electron';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';
import { randomUUID } from 'crypto';

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
    '--proxy-server=http=127.0.0.1:22122;https=127.0.0.1:22122',
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

  return new Promise<{ cookies: string; headers: Record<string, string>; email?: string }>(
    (resolve, reject) => {
      let resolved = false;
      let capturedCookies = '';
      let capturedHeaders: Record<string, string> = {};

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          chromeProcess.kill();
          stopProxy();
          proxyEvents.off('qwen-cookies', onCookies);
          proxyEvents.off('qwen-headers', onHeaders);
        }
      };

      let cookiesFoundTime = 0;

      // ...

      const checkResolved = () => {
        if (capturedCookies) {
          if (!cookiesFoundTime) cookiesFoundTime = Date.now();

          // Wait for bx-ua if we don't have it yet, unless it's been too long (30s)
          const hasBxUa = capturedHeaders['bx-ua'];
          const timeElapsed = Date.now() - cookiesFoundTime;

          if (hasBxUa || timeElapsed > 30000) {
            if (!hasBxUa)
              console.warn(
                '[Qwen] Warning: Timed out waiting for bx-ua header. Bot detection might be triggered.',
              );
            else console.log('[Qwen] Anti-Bot headers captured successfully.');

            // Try to extract x-csrf-token from cookies if missing from headers
            if (!capturedHeaders['x-csrf-token']) {
              const csrfMatch = capturedCookies.match(/csrfToken=([^;]+)/);
              if (csrfMatch) {
                console.log('[Qwen] Extracted x-csrf-token from cookies');
                capturedHeaders['x-csrf-token'] = csrfMatch[1];
              } else {
                console.warn('[Qwen] Warning: Could not find x-csrf-token in headers or cookies');
              }
            }

            // Fetch Profile
            const fetchProfile = () => {
              const req = net.request({
                method: 'GET',
                url: 'https://chat.qwen.ai/api/v1/account', // Hypothesized endpoint from general knowledge of Qwen/Other providers, or use /api/v2/chk_login
                partition: 'persist:qwen',
              });
              req.setHeader('Cookie', capturedCookies);
              req.setHeader(
                'User-Agent',
                capturedHeaders['User-Agent'] ||
                  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
              );

              req.on('response', (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk.toString()));
                res.on('end', () => {
                  let email = 'qwen@user.com';
                  try {
                    // Try to parse user info
                    const json = JSON.parse(data);
                    if (json.data && json.data.email) {
                      email = json.data.email;
                    }
                  } catch (e) {}

                  setTimeout(() => {
                    cleanup();
                    resolve({ cookies: capturedCookies, headers: capturedHeaders, email }); // Need to update return type of promise
                  }, 500);
                });
              });
              req.on('error', () => {
                setTimeout(() => {
                  cleanup();
                  resolve({ cookies: capturedCookies, headers: capturedHeaders });
                }, 500);
              });
              req.end();
            };

            fetchProfile();
          } else {
            console.log(
              `[Qwen] Waiting for Anti-Bot headers... (${Math.round(timeElapsed / 1000)}s)`,
            );
          }
        }
      };

      const onCookies = (cookies: string) => {
        console.log('[Qwen] Cookies captured!');
        capturedCookies = cookies;
        checkResolved();
      };

      const onHeaders = (headers: Record<string, string>) => {
        console.log('[Qwen] Headers captured:', Object.keys(headers));
        capturedHeaders = { ...capturedHeaders, ...headers };
        // If we got bx-ua, check if we can resolve
        if (headers['bx-ua'] && capturedCookies) {
          checkResolved();
        }
      };

      proxyEvents.on('qwen-cookies', onCookies);
      proxyEvents.on('qwen-headers', onHeaders);

      chromeProcess.on('close', (code) => {
        if (!resolved) {
          if (capturedCookies) {
            checkResolved();
          } else {
            console.log('[Qwen] Chrome closed with code:', code);
            cleanup();
            reject(new Error('Chrome user closed the window before login completed'));
          }
        }
      });
    },
  );
}

// Helper to create a new chat
async function createChat(cookies: string, headers?: Record<string, string>): Promise<string> {
  // const { v4: uuidv4 } = require('uuid');
  const tokenMatch = cookies.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: 'https://chat.qwen.ai/api/v2/chats/new',
      partition: 'persist:qwen',
    });

    const finalHeaders = {
      'Content-Type': 'application/json',
      'User-Agent':
        headers?.['User-Agent'] ||
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      Origin: 'https://chat.qwen.ai',
      Referer: 'https://chat.qwen.ai/c/new-chat',
      'x-request-id': randomUUID(),
      Cookie: cookies,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    } as Record<string, any>;

    // Clean headers
    Object.keys(finalHeaders).forEach((key) => {
      if (!finalHeaders[key]) delete finalHeaders[key];
    });

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.data && json.data.id) {
              resolve(json.data.id);
            } else {
              reject(new Error('Failed to create chat: No ID in response'));
            }
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`Create chat failed: ${response.statusCode} ${data}`));
        }
      });
      response.on('error', reject);
    });

    request.on('error', reject);

    // Set headers
    Object.entries(finalHeaders).forEach(([k, v]) => request.setHeader(k, v as string));

    const payload = {
      title: 'New Chat',
      models: ['qwen3-max-2025-09-23'],
      chat_mode: 'normal',
      chat_type: 't2t',
      timestamp: Date.now(),
      project_id: '',
    };

    request.write(JSON.stringify(payload));
    request.end();
  });
}

// Get chat history
export async function getChats(cookies: string, headers?: Record<string, string>): Promise<any[]> {
  // const { v4: uuidv4 } = require('uuid');
  const tokenMatch = cookies.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url: 'https://chat.qwen.ai/api/v2/chats/?page=1&exclude_project=true',
      partition: 'persist:qwen',
    });

    const finalHeaders = {
      'Content-Type': 'application/json',
      'User-Agent':
        headers?.['User-Agent'] ||
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      Origin: 'https://chat.qwen.ai',
      Referer: 'https://chat.qwen.ai/',
      'x-request-id': randomUUID(),
      Cookie: cookies,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    } as Record<string, any>;

    // Clean headers
    Object.keys(finalHeaders).forEach((key) => {
      if (!finalHeaders[key]) delete finalHeaders[key];
    });

    Object.entries(finalHeaders).forEach(([k, v]) => request.setHeader(k, v as string));

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.data && Array.isArray(json.data)) {
              resolve(json.data);
            } else {
              resolve(json.data || []);
            }
          } catch (e) {
            console.error('[Qwen] getChats Parse Error:', e);
            resolve([]);
          }
        } else {
          console.error(`[Qwen] getChats failed: ${response.statusCode} ${data}`);
          resolve([]);
        }
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.end();
  });
}

export async function sendMessage(
  cookies: string,
  _model: string,
  messages: any[],
  onProgress: (content: string) => void,
  headers?: Record<string, string>,
) {
  // const { v4: uuidv4 } = require('uuid');

  // 1. Create chat if needed
  let chatId: string = '';
  try {
    console.log('[Qwen] Creating new chat session...');
    chatId = await createChat(cookies, headers);
    console.log('[Qwen] New Chat ID Obtained:', chatId);
    if (!chatId) {
      throw new Error('Chat ID obtained is empty or invalid');
    }
  } catch (e) {
    console.error('[Qwen] Failed to create chat:', e);
    // Attempting without ID will likely fail, but let's see.
    // Actually we should throw here to stop execution and show error to user.
    throw e;
  }

  const parentId = null;

  // Qwen internal API message structure
  const qwenMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
    models: ['qwen3-max-2025-09-23'],
    chat_type: 't2t',
    feature_config: {
      thinking_enabled: false,
      output_schema: 'phase',
      research_mode: 'normal',
    },
    extra: { meta: { subChatType: 't2t' } },
    sub_chat_type: 't2t',
    parent_id: null,
    files: [],
  }));

  const payload = {
    stream: true,
    version: '2.1',
    incremental_output: true,
    chat_id: chatId,
    chat_mode: 'normal',
    model: 'qwen3-max-2025-09-23',
    parent_id: parentId,
    messages: qwenMessages,
    timestamp: Date.now(),
  };

  // Extract token from cookies for Authorization header
  const tokenMatch = cookies.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  return new Promise<void>((resolve, reject) => {
    const url = `https://chat.qwen.ai/api/v2/chat/completions?chat_id=${chatId}`;

    const finalHeaders = {
      'Content-Type': 'application/json',
      'User-Agent':
        headers?.['User-Agent'] ||
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      Origin: 'https://chat.qwen.ai',
      Referer: `https://chat.qwen.ai/c/${chatId}`, // Use the new chat ID in referer
      'x-request-id': randomUUID(),
      'x-accel-buffering': 'no',
      Cookie: cookies,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    } as Record<string, any>;

    // Ensure no undefined headers
    Object.keys(finalHeaders).forEach((key) => {
      if (!finalHeaders[key]) delete finalHeaders[key];
    });

    const request = net.request({
      method: 'POST',
      url,
      partition: 'persist:qwen',
      headers: finalHeaders as Record<string, string>,
    });

    request.on('error', (error) => {
      console.error('[Qwen] Request Error:', error);
      reject(error);
    });

    request.on('response', (response) => {
      response.on('error', (err: any) => {
        console.error('[Qwen] Stream Error:', err);
        reject(err);
      });

      if (response.statusCode && response.statusCode >= 400) {
        console.error(`[Qwen] API Error: ${response.statusCode}`);
        let errorBody = '';
        response.on('data', (chunk) => {
          errorBody += chunk.toString();
        });

        response.on('end', () => {
          console.error('[Qwen] Error Body:', errorBody);
          reject(new Error(`Qwen API returned ${response.statusCode}: ${errorBody.slice(0, 200)}`));
        });
        return;
      }

      response.on('data', (chunk) => {
        // Raw logging preserved for verification
        const chunkStr = chunk.toString();
        console.log('[Qwen] Stream Data:', chunkStr);

        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();
            if (jsonStr === '[DONE]') return;
            try {
              const json = JSON.parse(jsonStr);
              if (json.choices && json.choices.length > 0) {
                const delta = json.choices[0].delta;
                if (delta && delta.content) {
                  console.log('[Qwen] Chunk:', delta.content);
                  onProgress(delta.content);
                }
              }
            } catch (e) {
              // ignore
            }
          }
        }
      });

      response.on('end', () => {
        console.log('[Qwen] Stream ended');
        resolve();
      });
    });

    request.write(JSON.stringify(payload));
    request.end();
  });
}
