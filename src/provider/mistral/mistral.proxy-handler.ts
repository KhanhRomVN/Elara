/**
 * ------------------------------------------------------------------
 * Mistral Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies từ Mistral.
 *
 * Main features:
 * - onRequest() : Capture cookies từ auth.mistral.ai và console.mistral.ai
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import { MISTRAL_EVENTS } from './mistral.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('MistralProvider');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (
      host &&
      (host.includes('auth.mistral.ai') || host.includes('console.mistral.ai'))
    ) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.length > 0) {
        proxyEvents.emit(MISTRAL_EVENTS.COOKIES, reqCookies);
      }
    }
    callback();
  },
};
