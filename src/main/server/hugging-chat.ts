import { Request, Response } from 'express';
import { Account } from '../ipc/accounts';
import { app } from 'electron';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';
import { request as httpRequest } from 'https';

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

// Helper to fetch JSON with full browser headers using HTTPS module
const fetchJson = (url: string, cookies: string) => {
  return new Promise<any>((resolve) => {
    const urlObj = new URL(url);
    const options = {
      method: 'GET',
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        Cookie: cookies,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://huggingface.co',
        Referer: 'https://huggingface.co/chat/',
      },
    };

    const req = httpRequest(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          // If response is empty or not JSON, handle gracefully
          if (!data.trim()) {
            resolve({});
            return;
          }
          resolve(JSON.parse(data));
        } catch (e) {
          console.error(`[HuggingChat] Error parsing JSON from ${url}:`, e);
          resolve({});
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[HuggingChat] Request error for ${url}:`, e);
      resolve({});
    });
    req.end();
  });
};

// Fetch user profile

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
export const login = (): Promise<{ cookies: string; email?: string }> => {
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

      if (capturedUserInfo && capturedUserInfo.email) {
        email = capturedUserInfo.email;
      }

      cleanup();

      resolve({
        cookies: capturedCookies,
        email,
      });
    };

    const checkForCompletion = () => {
      if (capturedCookies && capturedUserInfo) {
        console.log('[HuggingChat] All critical data captured! Finalizing...');
        if (finishTimer) clearTimeout(finishTimer);
        // Wait a tiny bit to ensure events are processed
        finishTimer = setTimeout(finalize, 2000);
      }
    };

    const onCookies = (cookies: string) => {
      const isNew = !capturedCookies;
      capturedCookies = cookies;

      if (isNew) {
        // If we have cookies, wait a bit for user info to arrive from proxy
        // If it doesn't arrive in time, we might still proceed, but let's give it a chance
        console.log('[HuggingChat] Cookies captured, waiting for user info...');
        // Set a "fallback" timer to finish if we never get user info
        if (!finishTimer) {
          finishTimer = setTimeout(() => {
            console.log('[HuggingChat] User info timeout, finalizing with what we have...');
            finalize();
          }, 10000);
        }
      }
    };

    const onUserInfo = (userInfo: any) => {
      console.log('[HuggingChat] User Info captured:', userInfo.email);
      capturedUserInfo = userInfo;
      checkForCompletion();
    };

    const onLoginData = (email: string) => {
      console.log('[HuggingChat] Login email captured:', email);
      capturedLoginEmail = email;
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
  return new Promise(async (resolve, reject) => {
    try {
      const json = await fetchJson('https://huggingface.co/chat/api/v2/models', cookies);
      const models = json.json || json || [];
      resolve(models);
    } catch (e) {
      console.error('[HuggingChat] Error fetching models:', e);
      reject(e);
    }
  });
};

// Get conversation list
export const getConversations = (cookies: string, page: number = 0): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    try {
      const json = await fetchJson(
        `https://huggingface.co/chat/api/v2/conversations?p=${page}`,
        cookies,
      );
      resolve(json);
    } catch (e) {
      console.error('[HuggingChat] Error fetching conversations:', e);
      reject(e);
    }
  });
};

// Get specific conversation detail
export const getConversation = (cookies: string, conversationId: string): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    try {
      const json = await fetchJson(
        `https://huggingface.co/chat/api/v2/conversations/${conversationId}`,
        cookies,
      );
      resolve(json);
    } catch (e) {
      console.error('[HuggingChat] Error fetching conversation:', e);
      reject(e);
    }
  });
};

// Create a new conversation
const createConversation = (cookies: string, model: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log('[HuggingChat] Creating new conversation...');

    // Use proper HTTPS request
    const postData = JSON.stringify({ model, preprompt: '' });

    const options = {
      method: 'POST',
      hostname: 'huggingface.co',
      path: '/chat/conversation',
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://huggingface.co',
        Referer: 'https://huggingface.co/chat/',
      },
    };

    const req = httpRequest(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.conversationId) {
            console.log('[HuggingChat] New conversation created:', json.conversationId);
            resolve(json.conversationId);
          } else {
            console.error('[HuggingChat] Failed to create conversation, response:', json);
            reject(new Error('Failed to create conversation'));
          }
        } catch (e) {
          console.error('[HuggingChat] Error parsing create conversation response:', e);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[HuggingChat] Create conversation error:', e);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
};

// Chat completion stream
export const chatCompletionStream = async (req: Request, res: Response, account: Account) => {
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
  let targetConversationId = conversation_id;

  if (!targetConversationId) {
    try {
      targetConversationId = await createConversation(cookieHeader, model);
    } catch (e: any) {
      console.error('[HuggingChat] Failed to create new conversation:', e);
      res.status(500).json({ error: 'Failed to create new conversation: ' + e.message });
      return;
    }
  }

  // ---------------------------------------------------------------------
  // CRITICAL STEP: Fetch conversation details to get the REAL parent ID
  // ---------------------------------------------------------------------
  let parentMessageId = '';
  try {
    console.log('[HuggingChat] Fetching details for conversation:', targetConversationId);
    const convoDetails = await getConversation(cookieHeader, targetConversationId);
    const details = convoDetails.json || convoDetails; // Handle potential wrapper

    // Logic to find parent ID from message history
    if (details.messages && details.messages.length > 0) {
      // The last message in the array is usually the one we want to reply to
      const lastMsg = details.messages[details.messages.length - 1];
      parentMessageId = lastMsg.id;
      console.log('[HuggingChat] Found parent message ID from history:', parentMessageId);
    } else if (details.rootMessageId) {
      // If no messages yet (just created), use rootMessageId
      parentMessageId = details.rootMessageId;
      console.log('[HuggingChat] Using root message ID:', parentMessageId);
    } else {
      console.warn('[HuggingChat] No parent ID found, using random UUID (might fail)');
      parentMessageId = randomUUID();
    }
  } catch (e) {
    console.error('[HuggingChat] Failed to fetch conversation details:', e);
    // Fallback
    parentMessageId = randomUUID();
  }

  // Build multipart form data
  const boundary =
    '----WebKitFormBoundary' +
    Math.random().toString(36).substring(2, 14) +
    Math.random().toString(36).substring(2, 14);
  let formData = '';

  // Construct proper payload matching user sample EXACTLY
  const payload = {
    inputs: userContent,
    id: parentMessageId, // <--- Using the fetched parent ID
    is_retry: false,
    is_continue: false,
    selectedMcpServerNames: [],
    selectedMcpServers: [],
  };

  // Add message content - PAY ATTENTION TO CRLF
  formData += `--${boundary}\r\n`;
  formData += `Content-Disposition: form-data; name="data"\r\n\r\n`;
  formData += JSON.stringify(payload) + '\r\n';
  formData += `--${boundary}--\r\n`;

  // Use Buffer to get exact byte length
  const formBuffer = Buffer.from(formData, 'utf-8');

  // Use Node.js HTTPS module instead of Electron net Request
  const match = targetConversationId.match(/[a-zA-Z0-9]+/);
  const path = `/chat/conversation/${targetConversationId}`;

  const options = {
    method: 'POST',
    hostname: 'huggingface.co',
    path: path,
    headers: {
      Cookie: cookieHeader,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': formBuffer.length, // EXPLICIT CONTENT LENGTH
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://huggingface.co',
      Referer: `https://huggingface.co/chat/conversation/${targetConversationId}`,
      Priority: 'u=1, i',
    },
  };

  console.log('[HuggingChat] Sending HTTPS request to:', 'https://huggingface.co' + path);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (targetConversationId) {
    const convoEvent = { type: 'conversation', id: targetConversationId };
    res.write(`data: ${JSON.stringify(convoEvent)}\n\n`);
  }

  // Make request
  const reqStream = httpRequest(options, (response) => {
    console.log('[HuggingChat] Response status:', response.statusCode);

    response.on('data', (chunk) => {
      const rawData = chunk.toString();
      // Remove null bytes that HuggingFace adds for padding
      const cleanedData = rawData.replace(/\\u0000/g, '');

      // Fix: split by actual newline character to handle concatenated JSONs
      const lines = cleanedData.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          // Log only important events to reduce noise
          if (parsed.type === 'finalAnswer') {
            console.log('[HuggingChat] Final answer received');
          } else if (parsed.error) {
            console.error('[HuggingChat] Stream error message:', parsed);
          }

          // Forward the cleaned line to client
          // Use actual newlines for SSE format
          res.write(`data: ${line}\n\n`);
        } catch (e) {
          console.error('[HuggingChat] Error parsing line:', e);
          // Don't log the full line to avoid spam, just the error
        }
      }
    });

    response.on('end', () => {
      res.write('data: [DONE]\\n\\n');
      res.end();
    });
  });

  reqStream.on('error', (e) => {
    console.error('[HuggingChat] Stream request error:', e);
    res.write(`data: ${JSON.stringify({ error: e.message })}\\n\\n`);
    res.end();
  });

  reqStream.write(formBuffer);
  reqStream.end();
};

// Summarize conversation
export const summarizeConversation = (cookies: string, conversationId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log('[HuggingChat] Summarizing conversation:', conversationId);

    const match = conversationId.match(/[a-zA-Z0-9]+/);
    const path = `/chat/conversation/${conversationId}/summarize`;

    const options = {
      method: 'POST',
      hostname: 'huggingface.co',
      path: path,
      headers: {
        Cookie: cookies,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://huggingface.co',
        Referer: `https://huggingface.co/chat/conversation/${conversationId}`,
        Priority: 'u=1, i',
      },
    };

    const req = httpRequest(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.title) {
            console.log('[HuggingChat] Conversation summarized:', json.title);
            resolve(json.title);
          } else {
            console.error('[HuggingChat] Failed to summarize, response:', json);
            reject(new Error('Failed to summarize conversation'));
          }
        } catch (e) {
          console.error('[HuggingChat] Error parsing summarize response:', e);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[HuggingChat] Summarize request error:', e);
      reject(e);
    });

    req.end();
  });
};
