/**
 * ------------------------------------------------------------------
 * Qwen Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture token, headers, và email từ Qwen.
 * Lắng nghe bx-ua, x-csrf-token, và token từ API response.
 *
 * Main features:
 * - onRequest()       : Capture bx-ua, csrf token, bx-umidtoken
 * - onRequestData()   : Capture email từ signin request
 * - onResponseBody()  : Capture token và email từ signin response
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import { QWEN_EVENTS } from './qwen.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenProvider');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('chat.qwen.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('csrfToken')) {
        proxyEvents.emit(QWEN_EVENTS.COOKIES, reqCookies);
      }

      const bxUa = ctx.clientToProxyRequest.headers['bx-ua'];
      const xCsrfToken = ctx.clientToProxyRequest.headers['x-csrf-token'];
      const userAgent = ctx.clientToProxyRequest.headers['user-agent'];
      const bxUmidToken = ctx.clientToProxyRequest.headers['bx-umidtoken'];

      if (bxUa || xCsrfToken || bxUmidToken) {
        const headers: Record<string, string> = {};
        if (bxUa) headers['bx-ua'] = bxUa;
        if (xCsrfToken) headers['x-csrf-token'] = xCsrfToken;
        if (userAgent) headers['User-Agent'] = userAgent;
        if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;
        proxyEvents.emit(QWEN_EVENTS.HEADERS, headers);
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

    if (
      host &&
      host.includes('chat.qwen.ai') &&
      url.includes('/api/v2/auths/signin')
    ) {
      const bodyStr = chunk.toString();
      try {
        const json = JSON.parse(bodyStr);
        if (json.email) {
          (ctx as any).capturedQwenEmail = json.email;
          proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email: json.email });
        }
      } catch (e) {
        const emailMatch = bodyStr.match(
          /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
        );
        if (emailMatch && emailMatch[0]) {
          const email = `${emailMatch[1]}@${emailMatch[2]}`.replace(/\\/g, '');
          if (!email.includes('***')) {
            (ctx as any).capturedQwenEmail = email;
            proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email });
          }
        }
      }
    }
    callback(null, chunk);
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('chat.qwen.ai') &&
      url.includes('/api/v2/auths/signin')
    ) {
      try {
        const json = JSON.parse(body);
        const userData = json.data;
        if (userData) {
          const capturedEmail = (ctx as any).capturedQwenEmail;

          let email = capturedEmail || userData.email;
          if (email && email.includes('***') && capturedEmail) {
            email = capturedEmail;
          }
          if (email && !email.includes('***')) {
            proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email });
          }

          if (userData.token) {
            const eventPayload: any = { cookies: userData.token };
            if (email && !email.includes('***')) {
              eventPayload.email = email;
            }
            proxyEvents.emit(QWEN_EVENTS.LOGIN_TOKEN, eventPayload);
            delete (ctx as any).capturedQwenEmail;
          }
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Qwen Signin Response:', e);
      }
    }

    if (
      host &&
      host.includes('chat.qwen.ai') &&
      url.includes('/api/v1/auths/')
    ) {
      try {
        const json = JSON.parse(body);
        const userData = json.data ?? json;

        if (userData && userData.token) {
          const capturedEmail = (ctx as any).capturedQwenEmail;
          let email = capturedEmail || userData.email;
          if (email && email.includes('***') && capturedEmail) {
            email = capturedEmail;
          }

          const eventPayload: any = { cookies: userData.token };
          if (email && !email.includes('***')) {
            eventPayload.email = email;
            proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email });
          }
          proxyEvents.emit(QWEN_EVENTS.LOGIN_TOKEN, eventPayload);
        } else if (
          userData &&
          userData.email &&
          !userData.email.includes('***')
        ) {
          proxyEvents.emit(QWEN_EVENTS.LOGIN_EMAIL, { email: userData.email });
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Qwen Auth Session Response:', e);
      }
    }
  },
};
