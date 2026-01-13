import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import crypto from 'crypto';
import { ChatPayload } from './deepseek';
import { CloudflareBypasser } from '../utils/cloudflare-bypass';

const BASE_URL = 'https://chatgpt.com';

class ChatGPTWorker {
  private window: BrowserWindow | null = null;
  private activeRequestId: string | null = null;
  private pendingRequests: Map<
    string,
    {
      onContent: (content: string) => void;
      onDone: () => void;
      onError: (error: Error) => void;
      lastText: string;
    }
  > = new Map();

  constructor() {
    this.setupIPC();
  }

  private setupIPC() {
    ipcMain.on('chatgpt:stream-chunk', (_, payload: { requestId: string; text: string }) => {
      let { requestId, text } = payload;
      // The preload script uses 'latest' for captured streams
      if (requestId === 'latest' && this.activeRequestId) {
        requestId = this.activeRequestId;
      }

      const callback = this.pendingRequests.get(requestId);
      if (callback) {
        // API response stream usually gives full text or delta depending on how preload handles it.
        // auth-preload.ts parses 'data: ...' chunks.
        // If the preload sends the *content* field from the JSON, it's usually the accumulated text or delta?
        // Looking at auth-preload.ts: `const text = data.message.content.parts[0];`
        // ChatGPT API usually sends the FULL text in each chunk for the current node.
        // So we need to calculate delta effectively if we want to stream delta,
        // OR if the callback expects delta.
        // The existing code did `const delta = text.slice(callback.lastText.length);`
        // This expects `text` to be increasing full text.
        // So we keep this logic.

        const delta = text.slice(callback.lastText.length);
        if (delta) {
          callback.onContent(delta);
          callback.lastText = text;
        }
      }
    });

    ipcMain.on('chatgpt:stream-error', (_, payload: { requestId: string; error: string }) => {
      let { requestId, error } = payload;
      if (requestId === 'latest' && this.activeRequestId) {
        requestId = this.activeRequestId;
      }

      const callback = this.pendingRequests.get(requestId);
      if (callback) {
        callback.onError(new Error(error));
        this.pendingRequests.delete(requestId);
        if (this.activeRequestId === requestId) this.activeRequestId = null;
      }
    });

    ipcMain.on('chatgpt:stream-end', (_, payload: { requestId: string }) => {
      let { requestId } = payload;
      if (requestId === 'latest' && this.activeRequestId) {
        requestId = this.activeRequestId;
      }

      const callback = this.pendingRequests.get(requestId);
      if (callback) {
        callback.onDone();
        this.pendingRequests.delete(requestId);
        if (this.activeRequestId === requestId) this.activeRequestId = null;
      }
    });

    ipcMain.on('chatgpt:log', (_, payload: any) => {
      console.log('[ChatGPT Worker Log]:', payload);
    });
  }

  private async getWindow(): Promise<BrowserWindow> {
    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }

    const preloadPath = path.join(__dirname, '../preload/auth-preload.js');

    const userAgent =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

    this.window = new BrowserWindow({
      show: false, // Hidden window for API worker
      width: 1000,
      height: 800,
      webPreferences: {
        partition: 'persist:chatgpt',
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.window.webContents.setUserAgent(userAgent);

    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`[ChatGPT Worker] Loading URL... (${4 - retries}/3)`);
        await this.window.loadURL(BASE_URL);
        console.log('[ChatGPT Worker] URL loaded successfully');

        // Wait for Cloudflare/Turnstile to clear
        await new CloudflareBypasser().ensureBypass(this.window.webContents);
        break;
      } catch (e: any) {
        console.error(`[ChatGPT Worker] Failed to load URL (Attempt ${4 - retries}/3):`, e.message);
        retries--;
        if (retries === 0) {
          console.error('[ChatGPT Worker] All retries failed.');
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    return this.window;
  }

  public async login(email: string, pass: string): Promise<boolean> {
    const window = await this.getWindow();

    try {
      // 0. Get CSRF Token from NextAuth
      // We fetch the csrf endpoint.
      const csrfData = await window.webContents.executeJavaScript(`
            fetch('https://chatgpt.com/api/auth/csrf').then(res => res.json())
        `);
      const csrfToken = csrfData.csrfToken;
      if (!csrfToken) throw new Error('Failed to get CSRF token');

      // 1. Sign In (Auth0 initiation)
      // Matches Step 1 in chatgpt.md
      const callbackUrl = 'https://chatgpt.com/';
      const signinBody = new URLSearchParams({
        callbackUrl,
        csrfToken,
        json: 'true',
      }).toString();

      const signinResponse = await window.webContents.executeJavaScript(`
            fetch('https://chatgpt.com/api/auth/signin/openai?prompt=login&login_hint=${encodeURIComponent(email)}', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: '${signinBody}'
            }).then(res => res.json())
        `);

      // The response contains the authorization URL
      // "url": "https://auth.openai.com/api/accounts/authorize?..."
      const authUrl = signinResponse.url;
      if (!authUrl) throw new Error('Failed to get authorization URL');

      // 2. Password Verify
      // Matches Step 2 in chatgpt.md
      // We need to parse state or other params from authUrl if needed,
      // but Step 2 is a POST to verify password.
      // It seems Step 2 relies on an intermediate state.
      // Simple flow: Navigate to authUrl, then headers are set?
      // BUT the user provided a direct POST to `password/verify`.
      // This implies we skip the interstitial load?
      // HOWEVER, `password/verify` usually needs a state token which comes from the initial authorize request.
      // Let's assume we need to extract state/params from the `authUrl`.
      // Step 2 Body in MD: {"username": "...", "password": "...", "state": "..."?}
      // Wait, the MD Step 2 body is:
      // "{\"username\":\"thienbaovn2468@gmail.com\",\"password\":\"...\"}"
      // It DOES NOT show a 'state' param in the body.
      // BUT the REQUEST URL `password/verify` usually needs cookies/headers established by `authorize`.

      // Let's trying loading the authUrl first to establish context (cookies on auth.openai.com).
      // If we just POST, we might lack the `openai-sentinel-token` or session cookies.
      // The user's MD shows `openai-sentinel-token` in headers. This is hard to fake.
      // It's generated by their anti-bot JS.
      // If I try to just POST, it will likely fail.

      // User instruction: "2 are for login account add account".
      // Maybe the user accepts that I automate the FORM filling on `authUrl`?
      // OR I try to use the `password/verify` endpoint.
      // Given the complexity of Sentinel, the SAFEST way (and probably what user intended by 'optimized')
      // is to follow the API *endpoints* but maybe we need to be on the page?

      // Actually, if we navigate the window to `authUrl`, it will show the login page.
      // If I can just use `insertText` on the login page, it's safer.
      // But user asked for "new way in chatgpt.md" which documents API.
      // I will Attempt the API POST. If it fails, I might need to note that.
      // But to do the API POST to `auth.openai.com`, we must be on that origin or use CORS.
      // `window.loadURL` to `auth.openai.com`...

      // Let's extract the `state` query param from `authUrl` just in case, though not in body.
      // Wait, `signinResponse.url` is `https://auth.openai.com/api/accounts/authorize?...`
      // If we FETCH this URL, we might get the login page HTML.

      // Let's try navigating to `authUrl` and then running the POST from there?
      // Or straightforward:
      await window.loadURL(authUrl);
      // Now we are on auth.openai.com (presumably).
      // Execute the POST to verify password.
      const verifyResponse = await window.webContents.executeJavaScript(`
            fetch('https://auth.openai.com/api/accounts/password/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: '${email}',
                    password: '${pass}'
                })
            }).then(res => res.json())
        `);

      // Check result.
      // "continue_url": "..."
      if (verifyResponse.continue_url) {
        // 3. Finalize
        // GET https://chatgpt.com/ (follow the continue_url effectively)
        await window.loadURL(verifyResponse.continue_url);
        return true;
      } else {
        throw new Error('Login failed: No continue_url');
      }
    } catch (e: any) {
      console.error('ChatGPT Login workflow failed:', e);
      return false;
    }
  }

  public async getConversations(offset = 0, limit = 20): Promise<any> {
    const window = await this.getWindow();
    try {
      const result = await window.webContents.executeJavaScript(`
            fetch('${BASE_URL}/backend-api/conversations?offset=${offset}&limit=${limit}').then(res => res.json())
        `);
      return result;
    } catch (e) {
      console.error('Failed to get conversations:', e);
      return { items: [], total: 0 };
    }
  }

  public async stream(
    payload: ChatPayload,
    callbacks: {
      onContent: (content: string) => void;
      onDone: () => void;
      onError: (error: Error) => void;
    },
  ) {
    try {
      console.log(
        '[ChatGPT Worker] Stream requested with payload:',
        JSON.stringify(payload, null, 2),
      );
      const window = await this.getWindow();

      const requestId = crypto.randomUUID();
      this.activeRequestId = requestId;
      this.pendingRequests.set(requestId, {
        ...callbacks,
        lastText: '',
      });

      console.log(`[ChatGPT Worker] Assigned Request ID: ${requestId}`);

      // Prepare Payload for backend-api/conversation
      // We need to construct the standard payload.
      // Assuming 'text-davinci-002-render-sha' or 'auto' maps to default.

      const model = 'text-davinci-002-render-sha'; // Default for free tier, or 'gpt-4' if plus.
      // Ideally we check account status or use what's passed. payload.model might be 'gpt-4'.
      // payload.model from index.ts might be 'ChatGPT', we need mapping.

      const apiModel = payload.model === 'gpt-4' ? 'gpt-4' : 'text-davinci-002-render-sha';

      const messageId = crypto.randomUUID();
      const parentId = payload.parent_message_id || crypto.randomUUID(); // If new, random.

      const content = payload.messages[payload.messages.length - 1].content;

      const requestBody = {
        action: 'next',
        messages: [
          {
            id: messageId,
            author: { role: 'user' },
            content: { content_type: 'text', parts: [content] },
            metadata: {},
          },
        ],
        parent_message_id: parentId,
        model: apiModel,
        timezone_offset_min: -420, // fixed or dynamic
        conversation_mode: { kind: 'primary_assistant' },
        force_paragen: false,
        force_rate_limit: false,
        // conversation_id: payload.conversation_id // If exists?
      };

      if (payload.conversation_id) {
        (requestBody as any).conversation_id = payload.conversation_id;
      }

      console.log('[ChatGPT Worker] Executing fetch to backend-api/conversation...');

      // Execute Fetch
      // Execute Fetch and Manual Stream Reading
      await window.webContents.executeJavaScript(`
        (async () => {
          try {
            const response = await fetch('${BASE_URL}/backend-api/conversation', {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json'
                   // Authorization removed to let cookies handle it
               },
               body: JSON.stringify(${JSON.stringify(requestBody)})
            });

            if (!response.ok) {
              const text = await response.text();
              throw new Error('HTPP ' + response.status + ': ' + text);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6);
                  if (dataStr === '[DONE]') continue;
                  try {
                    const data = JSON.parse(dataStr);
                    if (data.message?.content?.parts?.[0]) {
                      const text = data.message.content.parts[0];
                      // Send chunk via exposed API
                      if (window.electronAPI) {
                        window.electronAPI.streamChunk({ requestId: '${requestId}', text });
                      }
                    }
                  } catch (e) {}
                }
              }
            }
            
            if (window.electronAPI) {
              window.electronAPI.streamEnd({ requestId: '${requestId}' });
            }

          } catch (err) {
             console.error('Fetch/Stream error:', err);
             if (window.electronAPI) {
               window.electronAPI.streamError({ requestId: '${requestId}', error: err.toString() });
             }
          }
        })()
      `);

      // Note: The preload script intercepts the response and pipes it to ipcMain events.
    } catch (e: any) {
      console.error('[ChatGPT Worker] Stream setup error:', e);
      callbacks.onError(e);
      this.pendingRequests.delete(this.activeRequestId || '');
      this.activeRequestId = null;
    }
  }
}

const worker = new ChatGPTWorker();

export async function chatCompletionStream(
  token: string, // Maybe unused with this flow
  payload: ChatPayload,
  userAgent: string | undefined,
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  return worker.stream(payload, callbacks);
}

export async function login(email: string, pass: string) {
  return worker.login(email, pass);
}

export async function getConversations(offset?: number, limit?: number) {
  return worker.getConversations(offset, limit);
}
