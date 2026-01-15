import { Request, Response } from 'express';
import { Account } from '../ipc/accounts';
import { net, app, BrowserWindow } from 'electron';
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

// Fetch user profile
export const getProfile = (
  cookies: string,
): Promise<{ email: string | null; name: string | null; avatar: string | null }> => {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: 'https://huggingface.co/chat/api/v2/user',
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
          const email = json.json?.email || json.email || null;
          const name = json.json?.username || json.username || null;
          const avatar = json.json?.avatarUrl || json.avatarUrl || null;
          resolve({ email, name, avatar });
        } catch (e) {
          console.error('[HuggingChat] Error parsing profile:', e);
          resolve({ email: null, name: null, avatar: null });
        }
      });
    });

    request.on('error', (e) => {
      console.error('[HuggingChat] Profile request error:', e);
      resolve({ email: null, name: null, avatar: null });
    });

    request.end();
  });
};

// Login function - opens browser and captures cookies
export const login = (): Promise<{ cookies: string; email?: string; username?: string }> => {
  console.log('[HuggingChat] Starting login flow...');
  return new Promise(async (resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      title: 'Login to Hugging Chat',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:huggingchat',
        preload: join(__dirname, '../preload/auth-preload.js'),
      },
    });

    authWindow.webContents.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    );

    // Clear previous session
    await authWindow.webContents.session.clearStorageData();

    console.log('[HuggingChat] Opening login window...');
    authWindow.loadURL('https://huggingface.co/login');

    // Poll for the token cookie
    const interval = setInterval(async () => {
      if (authWindow.isDestroyed()) {
        clearInterval(interval);
        reject(new Error('Window closed'));
        return;
      }

      try {
        const cookies = await authWindow.webContents.session.cookies.get({
          domain: '.huggingface.co',
        });

        const tokenCookie = cookies.find((c) => c.name === 'token');

        if (tokenCookie) {
          console.log('[HuggingChat] Token cookie found, capturing credentials...');
          clearInterval(interval);

          // Build cookie string
          const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

          // Try to fetch profile to get email/username
          console.log('[HuggingChat] Fetching user profile...');
          const profile = await getProfile(cookieStr);

          authWindow.close();
          console.log(
            '[HuggingChat] Login successful, email:',
            profile.email,
            'username:',
            profile.name,
          );
          resolve({
            cookies: cookieStr,
            email: profile.email || undefined,
            username: profile.name || undefined,
          });
        }
      } catch (e) {
        console.error('[HuggingChat] Error during login polling:', e);
      }
    }, 1000);

    authWindow.on('closed', () => {
      clearInterval(interval);
      reject(new Error('Window closed'));
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
    response.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          // Parse JSONL format
          const parsed = JSON.parse(line);
          console.log('[HuggingChat] Stream data received, type:', parsed.type);

          // Forward the raw line to client for processing
          res.write(`data: ${line}\n\n`);
        } catch (e) {
          // If not JSON, might be plain text or error
          console.error('[HuggingChat] Error parsing line:', e, line);
        }
      }
    });

    response.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });

  request.on('error', (e) => {
    console.error('[HuggingChat] Stream error:', e);
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  });

  request.write(formData);
  request.end();
};
