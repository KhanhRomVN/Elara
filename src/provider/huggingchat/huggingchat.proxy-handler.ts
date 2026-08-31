/**
 * ------------------------------------------------------------------
 * HuggingChat Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies và email từ HuggingChat.
 *
 * Main features:
 * - onRequest()       : Capture token cookie
 * - onResponseBody()  : Capture email từ login response
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('HuggingChatProvider');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('huggingface.co')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('token')) {
        proxyEvents.emit('hugging-chat-cookies', reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('huggingface.co') &&
      url.includes('/chat/login')
    ) {
      try {
        const json = JSON.parse(body);
        if (json.email) proxyEvents.emit('hugging-chat-login-data', json.email);
      } catch (e) {
        const emailMatch = body.match(/"email":"([^"]+)"/);
        if (emailMatch && emailMatch[1]) {
          proxyEvents.emit('hugging-chat-login-data', emailMatch[1]);
        }
      }
    }
  },
};