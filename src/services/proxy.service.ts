/**
 * ------------------------------------------------------------------
 * Proxy Service
 * ------------------------------------------------------------------
 * Service quản lý proxy server (http-mitm-proxy) để intercept và
 * capture cookies/tokens từ các provider. Hỗ trợ SSL interception,
 * decompression, và event-based handlers.
 *
 * Main functions:
 * - start()          : Khởi động proxy server
 * - stop()           : Dừng proxy server
 * - registerHandler(): Đăng ký handler để xử lý request/response
 * - getConfig()      : Lấy cấu hình proxy
 * - updateConfig()   : Cập nhật cấu hình
 * - getServerInfo()  : Lấy thông tin server
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { EventEmitter } from 'events';

// ── Utils ──
import { createLogger } from '../utils/logger';
import { getCertificateManager } from '../utils/cert-manager';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ProxyService');

const DEFAULT_CONFIG: ProxyConfig = {
  enabled: false,
  port: 22122,
  interceptSSL: true,
};

const CONFIG_FILE = path.join(os.homedir(), '.elara', 'proxy-config.json');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProxyConfig {
  enabled: boolean;
  port: number;
  interceptSSL: boolean;
}

export interface ProxyHandler {
  onRequest?: (ctx: any, callback: () => void) => void;
  onRequestData?: (ctx: any, chunk: Buffer, callback: () => void) => void;
  onResponse?: (ctx: any, callback: () => void) => void;
  onResponseBody?: (ctx: any, body: string) => void;
}

// ─── Config Helpers ────────────────────────────────────────────────────

function loadProxyConfig(): ProxyConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    logger.error('Failed to load proxy config:', error);
  }
  return { ...DEFAULT_CONFIG };
}

function saveProxyConfig(config: ProxyConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    logger.error('Failed to save proxy config:', error);
    throw error;
  }
}

// ─── Class ──────────────────────────────────────────────────────────────

export class ProxyService {
  private isRunning = false;
  private proxy: any = null;
  private handlers: ProxyHandler[] = [];
  private config: ProxyConfig;

  constructor() {
    this.config = loadProxyConfig();
  }

  registerHandler(handler: ProxyHandler) {
    this.handlers.push(handler);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      let MitmProxyModule;
      try {
        MitmProxyModule = require('http-mitm-proxy');
      } catch (e) {
        logger.warn('http-mitm-proxy not installed. Proxy feature disabled.');
        return;
      }

      const MitmProxy = MitmProxyModule.Proxy || MitmProxyModule;
      this.proxy = new MitmProxy();

      const config = this.getConfig();
      const certManager = getCertificateManager();
      const certsDir = certManager.getCertificateDir();

      this.proxy.onError((ctx: any, err: any) => {
        if (
          err &&
          (err.code === 'ECONNRESET' || err.message?.includes('socket hang up'))
        )
          return;
        logger.error('Proxy Error:', err);
      });

      this.proxy.onRequest(async (ctx: any, callback: any) => {
        for (const handler of this.handlers) {
          if (handler.onRequest) {
            try {
              handler.onRequest(ctx, () => {});
            } catch (e) {
              logger.error('Error in handler onRequest:', e);
            }
          }
        }
        return callback();
      });

      this.proxy.onRequestData(
        async (ctx: any, chunk: Buffer, callback: any) => {
          for (const handler of this.handlers) {
            if (handler.onRequestData) {
              try {
                handler.onRequestData(ctx, chunk, () => {});
              } catch (e) {
                logger.error('Error in handler onRequestData:', e);
              }
            }
          }
          return callback(null, chunk);
        },
      );

      this.proxy.onResponse((ctx: any, callback: any) => {
        for (const handler of this.handlers) {
          if (handler.onResponse) {
            try {
              handler.onResponse(ctx, () => {});
            } catch (e) {
              logger.error('Error in handler onResponse:', e);
            }
          }
        }

        const encoding = ctx.serverToProxyResponse.headers['content-encoding'];
        const contentType =
          ctx.serverToProxyResponse.headers['content-type'] || '';

        if (
          contentType.includes('text/') ||
          contentType.includes('application/json') ||
          contentType.includes('application/javascript')
        ) {
          const stream = ctx.serverToProxyResponse;
          let decoder: any;

          if (encoding === 'gzip') {
            decoder = zlib.createGunzip();
          } else if (encoding === 'br') {
            decoder = zlib.createBrotliDecompress();
          } else if (encoding === 'deflate') {
            decoder = zlib.createInflate();
          }

          if (decoder) {
            stream.pipe(decoder);
            let body = '';
            decoder.on(
              'data',
              (chunk: Buffer) => (body += chunk.toString('utf8')),
            );
            decoder.on('end', () => {
              for (const handler of this.handlers) {
                if (handler.onResponseBody) {
                  try {
                    handler.onResponseBody(ctx, body);
                  } catch (e) {
                    logger.error('Error in handler onResponseBody:', e);
                  }
                }
              }
            });
          } else {
            let body = '';
            ctx.serverToProxyResponse.on(
              'data',
              (chunk: Buffer) => (body += chunk.toString('utf8')),
            );
            ctx.serverToProxyResponse.on('end', () => {
              for (const handler of this.handlers) {
                if (handler.onResponseBody) {
                  try {
                    handler.onResponseBody(ctx, body);
                  } catch (e) {
                    logger.error(
                      'Error in handler onResponseBody (uncompressed):',
                      e,
                    );
                  }
                }
              }
            });
          }
        }
        return callback();
      });

      this.proxy.listen(
        { port: config.port, sslCaDir: certsDir, host: '0.0.0.0' },
        (err: any) => {
          if (err) {
            logger.error('Failed to start proxy:', err);
          } else {
            this.isRunning = true;
          }
        },
      );
    } catch (err) {
      logger.error('Error starting proxy service:', err);
    }
  }

  stop(): void {
    if (this.isRunning && this.proxy) {
      this.proxy.close();
      this.isRunning = false;
    }
  }

  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ProxyConfig>): void {
    const updated = { ...this.config, ...updates };
    this.config = updated;
    saveProxyConfig(this.config);

    if (this.isRunning) {
      this.stop();
      if (updated.enabled) {
        this.start();
      }
    } else if (updated.enabled) {
      this.start();
    }
  }

  getServerInfo() {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
    };
  }
}

// ─── Export ─────────────────────────────────────────────────────────────

export const proxyEvents = new EventEmitter();
export const proxyService = new ProxyService();