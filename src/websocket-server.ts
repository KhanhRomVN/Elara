/**
 * ------------------------------------------------------------------
 * WebSocket Server
 * ------------------------------------------------------------------
 * WebSocket server cho Z.AI Browser extension communication.
 * Hỗ trợ content và background connections, session management,
 * và request queuing.
 *
 * Main features:
 * - start()               : Khởi động WebSocket server
 * - stop()                : Dừng WebSocket server
 * - sendPrompt()          : Gửi prompt qua WebSocket
 * - registerRequestHandler(): Đăng ký handler cho request
 * - resetPage()           : Reset page trong browser
 * - isConnected()         : Kiểm tra session đã kết nối
 * - getAnyConnectedContentSession(): Lấy session đang connected
 * - updateSessionId()     : Cập nhật session ID
 * - setAccountId()        : Gửi account ID tới extension
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

// ── Utils ──
import { createLogger } from './utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('WebSocketServer');

// ─── Types ──────────────────────────────────────────────────────────────

interface ConnectionPair {
  contentWs: WebSocket | null;
  backgroundWs: WebSocket | null;
  pendingRequests: Map<string, PendingRequest>;
  currentRequestId: string | null;
  requestLock: Promise<void>;
}

interface PendingRequest {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  onUsage?: (usage: any) => void;
}

// ─── Class ──────────────────────────────────────────────────────────────

export class ExtensionWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, ConnectionPair>();
  private port: number;

  constructor(port: number = 8899) {
    super();
    this.port = port;
  }

  // ─── Start ───────────────────────────────────────────────────────────

  start(): void {
    if (this.wss) {
      logger.warn('[WebSocketServer] Already running');
      return;
    }

    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const client = url.searchParams.get('client');
      let sessionId = url.searchParams.get('sessionId') || 'default';

      if (!this.connections.has(sessionId)) {
        this.connections.set(sessionId, {
          contentWs: null,
          backgroundWs: null,
          pendingRequests: new Map(),
          currentRequestId: null,
          requestLock: Promise.resolve(),
        });
      }

      const connection = this.connections.get(sessionId)!;

      if (client === 'background') {
        connection.backgroundWs = ws;

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'request_proxy_config') {
              this.emit('proxy_config_request', sessionId);
            } else if (msg.type === 'session_ready') {
              if (msg.sessionId && msg.sessionId !== sessionId) {
                this.updateSessionId(sessionId, msg.sessionId);
                sessionId = msg.sessionId;
              }
            }
          } catch (e) {
            logger.error(
              '[WebSocketServer] Failed to parse background message:',
              e,
            );
          }
        });

        ws.on('close', () => {
          connection.backgroundWs = null;
          this.cleanupSession(sessionId);
        });
      } else {
        connection.contentWs = ws;

        ws.send(
          JSON.stringify({
            action: 'session_info',
            sessionId: sessionId,
            message: 'Temporary session ID assigned',
          }),
        );

        ws.on('message', (data) => {
          this.handleMessage(sessionId, data.toString());
        });

        ws.on('close', () => {
          connection.contentWs = null;
          this.cleanupSession(sessionId);
        });

        ws.on('error', (err) => {
          logger.error(
            `[WebSocketServer] WebSocket error for session ${sessionId}:`,
            err,
          );
        });

        this.emit('connected', sessionId);
      }
    });

    this.wss.on('error', (err) => {
      logger.error('[WebSocketServer] Server error:', err);
    });
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  private cleanupSession(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    if (!connection.contentWs && !connection.backgroundWs) {
      this.connections.delete(sessionId);
      this.emit('session_closed', sessionId);
    }
  }

  // ─── Session Management ─────────────────────────────────────────────

  updateSessionId(oldSessionId: string, newSessionId: string): void {
    if (oldSessionId === newSessionId) return;

    const connection = this.connections.get(oldSessionId);
    if (!connection) {
      logger.warn(
        `[WebSocketServer] Cannot update session: ${oldSessionId} not found`,
      );
      return;
    }

    this.connections.delete(oldSessionId);
    this.connections.set(newSessionId, connection);
    this.emit('session_updated', { old: oldSessionId, new: newSessionId });
  }

  setAccountId(sessionId: string, accountId: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection || !connection.contentWs) {
      logger.warn(
        `[WebSocketServer] Cannot set accountId: session ${sessionId} not found`,
      );
      return;
    }

    connection.contentWs.send(
      JSON.stringify({
        action: 'set_session_id',
        sessionId: accountId,
      }),
    );
  }

  // ─── Message Handler ─────────────────────────────────────────────────

  private handleMessage(sessionId: string, rawStr: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    const lines = rawStr.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        const requestId = msg.requestId;

        if (msg.type === 'stream_chunk' && requestId) {
          const pending = connection.pendingRequests.get(requestId);
          if (pending) {
            this.parseStreamChunk(msg.chunk, pending);
          }
        } else if (msg.type === 'stream_end' && requestId) {
          const pending = connection.pendingRequests.get(requestId);
          if (pending) {
            if (msg.error) {
              pending.onError(new Error(msg.error));
            } else {
              pending.onDone();
            }
            connection.pendingRequests.delete(requestId);
          }
        } else if (msg.type === 'usage' && msg.usage && requestId) {
          const pending = connection.pendingRequests.get(requestId);
          if (pending && pending.onUsage) {
            pending.onUsage(msg.usage);
          }
        } else if (msg.type === 'waf_block') {
          logger.warn(
            `[WebSocketServer] WAF block detected for session ${sessionId}: status=${msg.status}`,
          );
          this.emit('waf_block', sessionId, msg);
        } else if (msg.type === 'page_ready') {
          this.emit('page_ready', sessionId, msg);
        }
      } catch (e) {
        logger.error('[WebSocketServer] Failed to parse message:', e);
      }
    }
  }

  private parseStreamChunk(chunkStr: string, pending: PendingRequest): void {
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
          // Ignore parse errors
        }
      }
    }
  }

  // ─── Send Prompt ────────────────────────────────────────────────────

  async sendPrompt(
    sessionId: string,
    prompt: string,
    isNewChat: boolean,
    isSearch: boolean,
  ): Promise<string> {
    const connection = this.connections.get(sessionId);
    if (
      !connection ||
      !connection.contentWs ||
      connection.contentWs.readyState !== WebSocket.OPEN
    ) {
      throw new Error(
        `Extension not connected for session ${sessionId}. Please ensure browser is open and extension is loaded.`,
      );
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const previousLock = connection.requestLock;
    let resolveLock!: () => void;
    connection.requestLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    await previousLock;

    if (
      !connection.contentWs ||
      connection.contentWs.readyState !== WebSocket.OPEN
    ) {
      resolveLock();
      throw new Error(
        `Extension disconnected while waiting for queue slot for session ${sessionId}.`,
      );
    }

    connection.currentRequestId = requestId;

    const message = JSON.stringify({
      action: 'send_prompt',
      prompt,
      isNewChat,
      isSearch,
      requestId,
    });

    connection.contentWs.send(message);
    (connection as any).__pendingResolveLock = resolveLock;

    return requestId;
  }

  // ─── Register Handler ──────────────────────────────────────────────

  registerRequestHandler(
    sessionId: string,
    requestId: string,
    handlers: PendingRequest,
  ): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    const resolveLock: (() => void) | undefined = (connection as any)
      .__pendingResolveLock;
    if (resolveLock) {
      delete (connection as any).__pendingResolveLock;
    }

    const releaseLock = () => {
      if (resolveLock) resolveLock();
    };

    connection.pendingRequests.set(requestId, {
      ...handlers,
      onDone: () => {
        handlers.onDone();
        releaseLock();
      },
      onError: (err: Error) => {
        handlers.onError(err);
        releaseLock();
      },
    });
  }

  // ─── Reset Page ─────────────────────────────────────────────────────

  async resetPage(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (
      !connection ||
      !connection.contentWs ||
      connection.contentWs.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    connection.contentWs.send(JSON.stringify({ action: 'reset_page' }));
  }

  // ─── Status ─────────────────────────────────────────────────────────

  isConnected(sessionId: string): boolean {
    const connection = this.connections.get(sessionId);
    return (
      !!connection &&
      !!connection.contentWs &&
      connection.contentWs.readyState === WebSocket.OPEN
    );
  }

  getSessionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  getAnyConnectedContentSession(): string | null {
    for (const [sessionId, connection] of this.connections.entries()) {
      if (
        connection.contentWs &&
        connection.contentWs.readyState === WebSocket.OPEN
      ) {
        return sessionId;
      }
    }
    return null;
  }

  // ─── Stop ───────────────────────────────────────────────────────────

  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.connections.clear();
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────

let wsServerInstance: ExtensionWebSocketServer | null = null;

export const getWebSocketServer = (port?: number): ExtensionWebSocketServer => {
  if (!wsServerInstance) {
    const wsPort = process.env.WEBSOCKET_PORT
      ? parseInt(process.env.WEBSOCKET_PORT)
      : port || 8899;
    wsServerInstance = new ExtensionWebSocketServer(wsPort);
  }
  return wsServerInstance;
};

export const startWebSocketServer = (port?: number): void => {
  const server = getWebSocketServer(port);
  server.start();
};
