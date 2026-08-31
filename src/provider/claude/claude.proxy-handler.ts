/**
 * ------------------------------------------------------------------
 * Claude Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies và login info từ Claude AI.
 * Lắng nghe Authorization header, login email, và login token.
 *
 * Main features:
 * - onRequest()       : Capture Authorization header
 * - onRequestData()   : Capture login email từ request body
 * - onResponseBody()  : Capture login token từ response body
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('claude.ai')) {
      logger.debug(`[Proxy] Claude Request: ${url}`);
      const auth = ctx.clientToProxyRequest.headers['authorization'];

      if (auth) {
        logger.debug('[Proxy] Intercepting Claude request with Authorization header');
        proxyEvents.emit('claude-auth-header', auth);
      }
    }
    callback();
  },

  onRequestData: (
    ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('claude.ai') && url.includes('/api/auth')) {
      const bodyStr = chunk.toString();
      try {
        const json = JSON.parse(bodyStr);
        if (json.email) {
          logger.info(`[Proxy] Captured Claude Login Email: ${json.email}`);
          proxyEvents.emit('claude-login-email', { email: json.email });
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }
    callback(null, chunk);
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('claude.ai') && url.includes('/api/auth')) {
      try {
        const json = JSON.parse(body);
        if (json.token) {
          logger.info('[Proxy] Captured Claude Login Token');
          proxyEvents.emit('claude-login-token', { cookies: json.token });
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Claude Login Response:', e);
      }
    }
  },
};