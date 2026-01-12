import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import crypto from 'crypto';
import { ChatPayload } from './deepseek';

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
      if (requestId === 'latest' && this.activeRequestId) {
        requestId = this.activeRequestId;
      }

      const callback = this.pendingRequests.get(requestId);
      if (callback) {
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

    // User Agent must be clean Chrome
    const userAgent =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    this.window = new BrowserWindow({
      show: true, // Show for debugging
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

    try {
      await this.window.loadURL(BASE_URL);
    } catch (e) {
      console.error('Failed to load ChatGPT URL in worker:', e);
    }

    return this.window;
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
      const window = await this.getWindow();

      const requestId = crypto.randomUUID();
      this.activeRequestId = requestId;
      this.pendingRequests.set(requestId, {
        ...callbacks,
        lastText: '',
      });

      const userContent = payload.messages[payload.messages.length - 1].content;

      // 1. Focus the textarea
      try {
        await window.webContents.executeJavaScript(`
          (async () => {
             const el = document.querySelector('#prompt-textarea');
             if(el) el.focus();
             else throw new Error('Textarea not found');
          })()
        `);
      } catch (e: any) {
        throw new Error('Failed to focus textarea: ' + e.message);
      }

      // 2. Insert text natively (mimics typing/paste)
      // This bypasses React's "Illegal Invocation" issues with property descriptors
      await window.webContents.insertText(userContent);

      // 3. Click send button
      await new Promise((r) => setTimeout(r, 500)); // Short delay for React state update

      await window.webContents.executeJavaScript(`
        (async () => {
             const btn = document.querySelector('[data-testid="send-button"]');
             if(btn) {
                if(!btn.disabled) btn.click();
                else throw new Error('Send button disabled');
             } else throw new Error('Send button not found');
        })()
      `);
    } catch (e: any) {
      callbacks.onError(e);
      this.pendingRequests.delete(this.activeRequestId || '');
      this.activeRequestId = null;
    }
  }
}

const worker = new ChatGPTWorker();

export async function chatCompletionStream(
  token: string,
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
