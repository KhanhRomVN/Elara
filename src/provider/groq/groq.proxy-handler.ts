/**
 * ------------------------------------------------------------------
 * Groq Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture stytch_session_jwt cookie từ Groq.
 *
 * Main features:
 * - onRequest() : Capture stytch_session_jwt cookie
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import { GROQ_EVENTS, SESSION_COOKIE_NAME } from './groq.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GroqProvider');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('console.groq.com')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes(SESSION_COOKIE_NAME)) {
        proxyEvents.emit(GROQ_EVENTS.COOKIES, reqCookies);
      }
    }
    callback();
  },
};
