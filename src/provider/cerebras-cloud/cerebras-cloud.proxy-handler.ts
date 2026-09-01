/**
 * ------------------------------------------------------------------
 * Cerebras Cloud Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies và user info từ Cerebras Cloud.
 * Lắng nghe session-token cookie và user email từ /api/auth/session.
 *
 * Main features:
 * - onRequest()       : Capture authjs.session-token cookie
 * - onResponseBody()  : Capture user email từ session API
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import { CEREBRAS_EVENTS } from './cerebras-cloud.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CerebrasProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('cloud.cerebras.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('authjs.session-token')) {
        proxyEvents.emit(CEREBRAS_EVENTS.COOKIES, reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('cloud.cerebras.ai') &&
      url.includes('/api/auth/session')
    ) {
      try {
        const json = JSON.parse(body);
        if (json?.user?.email) {
          proxyEvents.emit(CEREBRAS_EVENTS.USER_INFO, {
            email: json.user.email,
            name: json.user.name,
            id: json.user.id,
          });
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  },
};
