import { Request, Response } from 'express';
import { Account } from '../ipc/accounts';
import { net, app } from 'electron';
import { join } from 'path';

// Helper to get cookies from account
const getCookies = (account: Account) => {
  try {
    const cookies = JSON.parse(account.credential);
    return cookies;
  } catch {
    return account.credential;
  }
};

// Helper to build cookie header string
const buildCookieHeader = (cookies: any): string => {
  if (typeof cookies === 'string') return cookies;
  if (Array.isArray(cookies)) {
    return cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
  }
  return '';
};

// Helper to fetch JSON
const fetchJson = (url: string, cookies: string) => {
  return new Promise<any>((resolve) => {
    const request = net.request({
      method: 'GET',
      url,
    });
    request.setHeader('Cookie', cookies);
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    );
    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        try {
          // Handle potential prefix if any (though unlikely for API)
          resolve(JSON.parse(data));
        } catch (e) {
          console.error(`[HuggingChat] Error parsing JSON from ${url}:`, e);
          resolve({});
        }
      });
    });
    request.on('error', (e) => {
      console.error(`[HuggingChat] Request error for ${url}:`, e);
      resolve({});
    });
    request.end();
  });
};

// Fetch user profile
export const getProfile = async (
  cookies: string,
): Promise<{ email: string | null; name: string | null; avatar: string | null }> => {
  try {
    // 1. Try Chat Profile API first
    const chatProfile = await fetchJson('https://huggingface.co/chat/api/v2/user', cookies);
    const chatData = chatProfile.json || chatProfile; // Handle potential wrapper

    let email = chatData.email || null;
    let name = chatData.username || null;
    let avatar = chatData.avatarUrl || null;

    // 2. If email is missing, try generic HF API
    if (!email) {
      console.log('[HuggingChat] Email missing from chat profile, trying /api/whoami-v2...');
      const hfProfile = await fetchJson('https://huggingface.co/api/whoami-v2', cookies);
      if (hfProfile.email) {
        email = hfProfile.email;
        console.log('[HuggingChat] Found email in whoami-v2:', email);
      }
      if (!name && hfProfile.name) name = hfProfile.name;
      if (!avatar && hfProfile.avatarUrl) avatar = hfProfile.avatarUrl;
    }

    console.log('[HuggingChat] Final Profile - username:', name, 'email:', email);
    return { email, name, avatar };
  } catch (e) {
    console.error('[HuggingChat] getProfile failed:', e);
    return { email: null, name: null, avatar: null };
  }
};

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';

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
export const login = (): Promise<{ cookies: string; email?: string; username?: string }> => {
  console.log('[HuggingChat] Starting Real Browser login flow...');

  const chromePath = findChrome();
  if (!chromePath) {
    return Promise.reject(
      new Error('Chrome or Chromium not found. Please install it to use HuggingChat.'),
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
    const profilePath = join(app.getPath('userData'), 'profiles', 'huggingchat');
    if (fs.existsSync(profilePath)) {
      console.log('[HuggingChat] Clearing old profile...');
      fs.rmSync(profilePath, { recursive: true, force: true });
    }
    fs.mkdirSync(profilePath, { recursive: true });

    // 3. Spawn Chrome
    console.log('[HuggingChat] Spawning Chrome at:', chromePath);
    const args = [
      '--proxy-server=http=127.0.0.1:22122;https=127.0.0.1:22122',
      '--proxy-bypass-list=<-loopback>',
      '--ignore-certificate-errors',
      `--user-data-dir=${profilePath}`,
      '--disable-http2',
      '--disable-quic',
      '--disable-ipv6', // Force IPv4 to avoid proxy errors
      '--dns-result-order=ipv4first',
      '--no-first-run',
      '--no-default-browser-check',
      '--class=huggingchat-browser',
      'https://huggingface.co/chat/login',
    ];

    const chromeProcess = spawn(chromePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (chromeProcess.stdout) {
      chromeProcess.stdout.on('data', (data) => console.log(`[HuggingChat Chrome Out]: ${data}`));
    }
    if (chromeProcess.stderr) {
      chromeProcess.stderr.on('data', (data) => console.error(`[HuggingChat Chrome Err]: ${data}`));
    }

    // 4. Listen for Proxy Events
    let capturedCookies = '';
    let capturedUserInfo: any = null;
    let capturedLoginEmail: string | null = null;
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
        proxyEvents.off('hugging-chat-cookies', onCookies);
        proxyEvents.off('hugging-chat-user-info', onUserInfo);
        proxyEvents.off('hugging-chat-login-data', onLoginData);
      }
    };

    const finalize = () => {
      if (resolved) return;

      let email = capturedLoginEmail || 'huggingchat@user.com';
      let username = 'User';

      if (capturedUserInfo) {
        email = capturedUserInfo.email || email;
        username = capturedUserInfo.username || username;
      }

      cleanup();

      resolve({
        cookies: capturedCookies,
        email,
        username,
      });
    };

    const checkForCompletion = () => {
      if (capturedCookies && capturedUserInfo) {
        console.log('[HuggingChat] All critical data captured! Finalizing...');
        if (finishTimer) clearTimeout(finishTimer);
        finishTimer = setTimeout(finalize, 2000);
      }
    };

    const attemptVerifyCookies = async (cookies: string) => {
      console.log('[HuggingChat] verifying captured cookies...');
      try {
        const profile = await getProfile(cookies);
        if (profile.name && profile.name !== 'unknown') {
          console.log('[HuggingChat] Active profile fetch success:', profile.email);
          capturedUserInfo = {
            email: profile.email,
            username: profile.name,
            avatarUrl: profile.avatar,
          };
          checkForCompletion();
        } else {
          console.log(
            '[HuggingChat] Active profile fetch returned empty/guest profile. Waiting...',
          );
        }
      } catch (e) {
        console.error('[HuggingChat] Active profile fetch failed:', e);
      }
    };

    const onCookies = (cookies: string) => {
      // Avoid spamming verification
      const isNew = !capturedCookies;
      capturedCookies = cookies;

      if (isNew || !capturedUserInfo) {
        // Debounce slightly to avoid verifying every single request's cookie update
        // But for now direct call is fine as getProfile is lightweight enough (1 req)
        attemptVerifyCookies(cookies);
      }

      checkForCompletion();
    };

    const onUserInfo = (userInfo: any) => {
      console.log('[HuggingChat] User Info captured:', userInfo.email);
      capturedUserInfo = userInfo;
      checkForCompletion();
    };

    const onLoginData = (email: string) => {
      console.log('[HuggingChat] Login email captured:', email);
      capturedLoginEmail = email;
      // Note: we don't trigger completion here, we still need cookies/user info validation
    };

    proxyEvents.on('hugging-chat-cookies', onCookies);
    proxyEvents.on('hugging-chat-user-info', onUserInfo);
    proxyEvents.on('hugging-chat-login-data', onLoginData);

    // Hard limit 3 minutes
    setTimeout(() => {
      if (!resolved) {
        if (capturedCookies) {
          console.log('[HuggingChat] Timeout, but cookies found. Resolving...');
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
          console.log('[HuggingChat] Chrome closed with code:', code);
          cleanup();
          reject(new Error('User closed login window'));
        }
      }
    });
  });
};

// Get available models
export const getModels = (cookies: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url: 'https://huggingface.co/chat/api/v2/models',
    });

    request.setHeader('Cookie', cookies);
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    );

    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          const models = json.json || json || [];
          resolve(models);
        } catch (e) {
          console.error('[HuggingChat] Error parsing models:', e);
          reject(e);
        }
      });
    });

    request.on('error', (e) => {
      console.error('[HuggingChat] Models request error:', e);
      reject(e);
    });

    request.end();
  });
};

// Get conversation list
export const getConversations = (cookies: string, page: number = 0): Promise<any> => {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url: `https://huggingface.co/chat/api/v2/conversations?p=${page}`,
    });

    request.setHeader('Cookie', cookies);
    request.setHeader('Content-Type', 'application/json');
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    );

    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          console.error('[HuggingChat] Error parsing conversations:', e);
          reject(e);
        }
      });
    });

    request.on('error', (e) => {
      console.error('[HuggingChat] Conversations request error:', e);
      reject(e);
    });

    request.end();
  });
};

// Get specific conversation detail
export const getConversation = (cookies: string, conversationId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url: `https://huggingface.co/chat/api/v2/conversations/${conversationId}`,
    });

    request.setHeader('Cookie', cookies);
    request.setHeader('Content-Type', 'application/json');
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    );

    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          console.error('[HuggingChat] Error parsing conversation:', e);
          reject(e);
        }
      });
    });

    request.on('error', (e) => {
      console.error('[HuggingChat] Conversation request error:', e);
      reject(e);
    });

    request.end();
  });
};

// Chat completion stream
export const chatCompletionStream = (req: Request, res: Response, account: Account) => {
  const { messages, model, conversation_id } = req.body;
  console.log(
    '[HuggingChat] Starting chat stream, model:',
    model,
    'conversation_id:',
    conversation_id,
  );
  const cookies = getCookies(account);
  const cookieHeader = buildCookieHeader(cookies);

  // Get the last user message
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    res.status(400).json({ error: 'Last message must be from user' });
    return;
  }

  const userContent = lastMessage.content;
  console.log('[HuggingChat] User message:', userContent.substring(0, 100) + '...');

  // Determine conversation ID - use existing or let server create new one
  const targetConversationId = conversation_id || '';

  // Build multipart form data
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let formData = '';

  // Add message content
  formData += `--${boundary}\r\n`;
  formData += `Content-Disposition: form-data; name="data"\r\n\r\n`;
  formData += JSON.stringify({ inputs: userContent, files: [] }) + '\r\n';

  formData += `--${boundary}--\r\n`;

  const request = net.request({
    method: 'POST',
    url: `https://huggingface.co/chat/conversation/${targetConversationId}`,
  });

  console.log(
    '[HuggingChat] Sending request to:',
    `https://huggingface.co/chat/conversation/${targetConversationId}`,
  );
  console.log('[HuggingChat] Cookies length:', cookieHeader.length, 'chars');
  console.log('[HuggingChat] Cookies preview:', cookieHeader.substring(0, 100) + '...');

  request.setHeader('Cookie', cookieHeader);
  request.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`);
  request.setHeader(
    'User-Agent',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  );

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  request.on('response', (response) => {
    console.log('[HuggingChat] Response status:', response.statusCode);
    console.log('[HuggingChat] Response headers:', response.headers);

    response.on('data', (chunk) => {
      const rawData = chunk.toString();
      // Remove null bytes that HuggingFace adds for padding
      const cleanedData = rawData.replace(/\\u0000/g, '');
      const lines = cleanedData.split('\\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          // Parse JSONL format
          const parsed = JSON.parse(line);
          console.log('[HuggingChat] Stream data received, type:', parsed.type);

          // Forward the cleaned line to client for processing
          res.write(`data: ${line}\\n\\n`);
        } catch (e) {
          // If not JSON, might be HTML (auth error) or malformed
          console.error('[HuggingChat] Error parsing line:', e);
          console.error('[HuggingChat] Raw line (first 200 chars):', line.substring(0, 200));
        }
      }
    });

    response.on('end', () => {
      res.write('data: [DONE]\\n\\n');
      res.end();
    });
  });

  request.on('error', (e) => {
    console.error('[HuggingChat] Stream error:', e);
    res.write(`data: ${JSON.stringify({ error: e.message })}\\n\\n`);
    res.end();
  });

  request.write(formData);
  request.end();
};
