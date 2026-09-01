/**
 * ------------------------------------------------------------------
 * Z.AI Browser WebSocket Manager
 * ------------------------------------------------------------------
 * Quản lý WebSocket connection với Z.AI Bridge extension.
 * Xử lý reconnect, message parsing, và request tracking.
 *
 * Main features:
 * - connect()            : Kết nối WebSocket với extension
 * - sendPrompt()         : Gửi prompt qua WebSocket
 * - registerRequestHandler(): Đăng ký handler cho request
 * - resetPage()          : Reset page trong browser
 * - Auto-reconnect       : Tự động reconnect khi mất kết nối
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import {
  ZaiBrowserSession,
  ZaiBrowserConfig,
  DEFAULT_ZAI_BROWSER_CONFIG,
} from './zai-browser.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ZaiBrowserWebSocket');

// ─── Class ──────────────────────────────────────────────────────────────

export class ZaiBrowserWebSocketManager extends EventEmitter {
  private session: ZaiBrowserSession;
  private config: ZaiBrowserConfig;
  private requestIdCounter: number = 0;

  constructor(config?: Partial<ZaiBrowserConfig>) {
    super();
    this.config = { ...DEFAULT_ZAI_BROWSER_CONFIG, ...config };
    this.session = {
      ws: null,
      currentRequestId: null,
      isConnected: false,
      reconnectAttempts: 0,
      reconnectTimer: null,
      pendingRequests: new Map(),
    };
  }

  // ─── Request ID ─────────────────────────────────────────────────────

  private generateRequestId(): string {
    this.requestIdCounter++;
    return `req_${Date.now()}_${this.requestIdCounter}`;
  }

  // ─── Connect ────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.session.ws && this.session.ws.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        logger.error(`[WebSocket] Connection timeout after ${this.config.extensionReadyTimeout}ms`);
        reject(
          new Error(
            `Extension WebSocket connection timeout after ${this.config.extensionReadyTimeout}ms`,
          ),
        );
      }, this.config.extensionReadyTimeout);

      const ws = new WebSocket(
        `ws://localhost:${this.config.wsPort}?client=server`,
      );

      ws.on('open', () => {
        clearTimeout(timeout);
        this.session.ws = ws;
        this.session.isConnected = true;
        this.session.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      ws.on('error', (err) => {
        logger.error('[WebSocket] Connection error:', err.message);
        if (this.session.reconnectTimer) {
          clearTimeout(this.session.reconnectTimer);
          this.session.reconnectTimer = null;
        }
        this.emit('error', err);
      });

      ws.on('close', () => {
        logger.warn('[WebSocket] Connection closed');
        this.session.isConnected = false;
        this.session.ws = null;
        this.emit('disconnected');
        this.scheduleReconnect();
      });
    });
  }

  // ─── Reconnect ──────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.session.reconnectTimer) return;
    if (this.session.reconnectAttempts >= this.config.reconnectAttempts) {
      logger.error(
        `[WebSocket] Max reconnect attempts (${this.config.reconnectAttempts}) reached`,
      );
      this.emit('max_reconnect_reached');
      return;
    }

    const delay = Math.min(
      this.config.reconnectDelayMs *
        Math.pow(1.5, this.session.reconnectAttempts),
      60000,
    );
    this.session.reconnectAttempts++;

    this.session.reconnectTimer = setTimeout(async () => {
      this.session.reconnectTimer = null;
      try {
        await this.connect();
      } catch (err) {
        logger.error('[WebSocket] Reconnect failed:', err);
      }
    }, delay);
  }

  // ─── Message Handling ──────────────────────────────────────────────

  private handleMessage(rawStr: string): void {
    const lines = rawStr.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        const requestId = msg.requestId;

        if (msg.type === 'stream_chunk' && requestId) {
          const pending = this.session.pendingRequests.get(requestId);
          if (pending) {
            this.parseStreamChunk(msg.chunk, pending);
          }
        } else if (msg.type === 'stream_end' && requestId) {
          const pending = this.session.pendingRequests.get(requestId);
          if (pending) {
            if (msg.error) {
              pending.onError(new Error(msg.error));
            } else {
              pending.onDone();
            }
            this.session.pendingRequests.delete(requestId);
          }
        } else if (msg.type === 'usage' && msg.usage && requestId) {
          const pending = this.session.pendingRequests.get(requestId);
          if (pending && pending.onUsage) {
            pending.onUsage(msg.usage);
          }
        } else if (msg.type === 'waf_block') {
          logger.warn(`[WebSocket] WAF block detected: status=${msg.status}`);
          this.emit('waf_block', msg);
        } else if (msg.type === 'page_ready') {
          this.emit('page_ready', msg);
        }
      } catch (e) {
        logger.error('[WebSocket] Failed to parse message:', e);
      }
    }
  }

  private parseStreamChunk(chunkStr: string, pending: any): void {
    const lines = chunkStr.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const json = JSON.parse(jsonStr);
          let content = '';
          let phase = '';

          if (json.data) {
            content = json.data.delta_content || '';
            phase = json.data.phase || '';
          }

          if (content) {
            if (phase === 'thinking') {
              if (pending.onThinking) pending.onThinking(content);
            } else {
              pending.onContent(content);
            }
          }
        } catch (e) {
          logger.warn('[WebSocket] Failed to parse stream chunk line:', e);
        }
      }
    }
  }

  // ─── Send Prompt ────────────────────────────────────────────────────

  async sendPrompt(
    prompt: string,
    isNewChat: boolean,
    isSearch: boolean,
  ): Promise<string> {
    if (
      !this.session.isConnected ||
      !this.session.ws ||
      this.session.ws.readyState !== WebSocket.OPEN
    ) {
      throw new Error(
        'WebSocket not connected. Please ensure Z.AI Bridge extension is installed and running.',
      );
    }

    const requestId = this.generateRequestId();
    this.session.currentRequestId = requestId;

    const message = JSON.stringify({
      action: 'send_prompt',
      prompt,
      isNewChat,
      isSearch,
      requestId,
    });

    this.session.ws.send(message);
    return requestId;
  }

  // ─── Register Request Handler ──────────────────────────────────────

  registerRequestHandler(
    requestId: string,
    handlers: {
      onContent: (chunk: string) => void;
      onThinking?: (chunk: string) => void;
      onDone: () => void;
      onError: (err: Error) => void;
      onUsage?: (usage: any) => void;
    },
  ): void {
    this.session.pendingRequests.set(requestId, handlers as any);
  }

  // ─── Reset Page ─────────────────────────────────────────────────────

  async resetPage(): Promise<void> {
    if (!this.session.isConnected || !this.session.ws) return;
    this.session.ws.send(JSON.stringify({ action: 'reset_page' }));
  }

  // ─── Status ─────────────────────────────────────────────────────────

  isConnected(): boolean {
    return (
      this.session.isConnected &&
      !!this.session.ws &&
      this.session.ws.readyState === WebSocket.OPEN
    );
  }

  // ─── Disconnect ─────────────────────────────────────────────────────

  async disconnect(): Promise<void> {
    if (this.session.reconnectTimer) {
      clearTimeout(this.session.reconnectTimer);
      this.session.reconnectTimer = null;
    }
    if (this.session.ws) {
      this.session.ws.close();
      this.session.ws = null;
    }
    this.session.isConnected = false;
    this.session.pendingRequests.clear();
  }
}
