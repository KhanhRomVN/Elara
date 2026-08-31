/**
 * ------------------------------------------------------------------
 * Gemini Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies, email, và XSRF token từ Gemini.
 * Lắng nghe authenticated cookies, SAPISID, auth user, và email.
 *
 * Main features:
 * - onRequest()       : Capture cookies, SAPISID, auth user
 * - onResponseBody()  : Capture email từ Google APIs và XSRF token
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('gemini.google.com')) {
      logger.debug(`[Proxy] Gemini Request: ${url}`);

      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies) {
        const hasSID = reqCookies.includes('SID=');
        const hasSecure1PSID = reqCookies.includes('__Secure-1PSID=');
        if (hasSID && hasSecure1PSID) {
          logger.info('[Proxy] Captured Gemini authenticated cookies');
          proxyEvents.emit('gemini-cookies', { cookies: reqCookies });

          const sapisidMatch = reqCookies.match(/SAPISID=([^;]+)/);
          if (sapisidMatch) {
            proxyEvents.emit('gemini-sapisid', { sapisid: sapisidMatch[1] });
          }
        }
      }

      const authUserMatch = url.match(/\/u\/(\d+)\//);
      if (authUserMatch) {
        proxyEvents.emit('gemini-auth-user', { authUser: authUserMatch[1] });
      }
    }

    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    const emailMatch =
      body.match(
        /"email"\s*:\s*"([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})"/,
      ) || body.match(/"oPEP7c"\s*:\s*"([^"]+)"/);

    if (
      host &&
      host.includes('www.googleapis.com') &&
      url.includes('oauth2') &&
      url.includes('userinfo')
    ) {
      if (emailMatch && emailMatch[1]) {
        logger.info(
          `[Proxy] Captured Gemini Google Email (userinfo): ${emailMatch[1]}`,
        );
        proxyEvents.emit('gemini-email', { email: emailMatch[1] });
      }
    } else if (
      host &&
      host.includes('accounts.google.com') &&
      (url.includes('signin/oauth') || url.includes('userinfo'))
    ) {
      if (emailMatch && emailMatch[1] && !emailMatch[1].includes('***')) {
        logger.info(
          `[Proxy] Captured Gemini Google Email (accounts): ${emailMatch[1]}`,
        );
        proxyEvents.emit('gemini-email', { email: emailMatch[1] });
      }
    } else if (
      host &&
      host.includes('gemini.google.com') &&
      url.includes('batchexecute') &&
      body.includes('o30O0e') &&
      body.includes('@')
    ) {
      if (emailMatch && emailMatch[1]) {
        logger.info(
          `[Proxy] Captured Gemini Google Email (batchexecute): ${emailMatch[1]}`,
        );
        proxyEvents.emit('gemini-email', { email: emailMatch[1] });
      }
    }

    if (host && host.includes('gemini.google.com') && body.includes('SNlM0e')) {
      const xsrfMatch = body.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
      if (xsrfMatch && xsrfMatch[1]) {
        logger.info('[Proxy] Captured Gemini XSRF token');
        proxyEvents.emit('gemini-xsrf', { xsrfToken: xsrfMatch[1] });
      }
    }
  },
};