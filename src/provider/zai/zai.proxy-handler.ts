/**
 * ------------------------------------------------------------------
 * Z.AI Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture token, cookies, và user-agent từ Z.AI.
 * Lắng nghe Authorization header, cookie, và token từ auths API.
 *
 * Main features:
 * - onRequest()       : Capture token, cookies, user-agent
 * - onResponseBody()  : Capture token từ auths API response
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ZAIProvider');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    if (host && host.includes('chat.z.ai')) {
      const cookieHeader = ctx.clientToProxyRequest.headers['cookie'];
      const userAgentHeader = ctx.clientToProxyRequest.headers['user-agent'];
      if (cookieHeader) ctx.capturedZaiCookie = cookieHeader;
      if (userAgentHeader) ctx.capturedZaiUserAgent = userAgentHeader;

      const auth = ctx.clientToProxyRequest.headers['authorization'];
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.replace('Bearer ', '').trim();
        let cookiesVal = token;
        if (cookieHeader) {
          cookiesVal += `|||${cookieHeader}`;
          if (userAgentHeader) {
            cookiesVal += `|||${userAgentHeader}`;
          }
        }
        logger.info('[Proxy] Captured Z.AI token, cookies and user-agent');
        proxyEvents.emit('zai-token', { cookies: cookiesVal });
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('chat.z.ai')) {
      if (url?.includes('/api/v1/auths')) {
        try {
          const json = JSON.parse(body);
          if (json.token) {
            logger.info('[Proxy] Captured Z.AI Login Token from auths API');
            let cookiesVal = json.token;
            if (ctx.capturedZaiCookie) {
              cookiesVal += `|||${ctx.capturedZaiCookie}`;
              if (ctx.capturedZaiUserAgent) {
                cookiesVal += `|||${ctx.capturedZaiUserAgent}`;
              }
            }
            proxyEvents.emit('zai-token', {
              cookies: cookiesVal,
              email: json.email,
            });
          }
        } catch (e) {
          logger.error('[Proxy] Failed to parse Z.AI auths response:', e);
        }
      }
    }
  },
};