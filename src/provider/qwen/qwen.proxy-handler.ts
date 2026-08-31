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

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenProvider');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('chat.qwen.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('csrfToken')) {
        proxyEvents.emit('qwen-cookies', reqCookies);
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
        proxyEvents.emit('qwen-headers', headers);
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
          logger.info(`[Proxy] Captured Qwen Login Email (JSON): ${json.email}`);
          (ctx as any).capturedQwenEmail = json.email;
          proxyEvents.emit('qwen-login-email', { email: json.email });
        }
      } catch (e) {
        const emailMatch = bodyStr.match(
          /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
        );
        if (emailMatch && emailMatch[0]) {
          const email = `${emailMatch[1]}@${emailMatch[2]}`.replace(/\\/g, '');
          if (!email.includes('***')) {
            logger.info(`[Proxy] Captured Qwen Login Email (Regex): ${email}`);
            (ctx as any).capturedQwenEmail = email;
            proxyEvents.emit('qwen-login-email', { email });
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
            logger.info(
              `[Proxy] Captured Qwen Login Email from Signin Response: ${email}`,
            );
            proxyEvents.emit('qwen-login-email', { email });
          }

          if (userData.token) {
            logger.info(
              '[Proxy] Captured Qwen Login Token from Signin Response',
            );
            const eventPayload: any = { cookies: userData.token };
            if (email && !email.includes('***')) {
              eventPayload.email = email;
            }
            proxyEvents.emit('qwen-login-token', eventPayload);
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
          logger.info('[Proxy] Captured Qwen Token from Auth Session Response');
          const capturedEmail = (ctx as any).capturedQwenEmail;
          let email = capturedEmail || userData.email;
          if (email && email.includes('***') && capturedEmail) {
            email = capturedEmail;
          }

          const eventPayload: any = { cookies: userData.token };
          if (email && !email.includes('***')) {
            logger.info(
              `[Proxy] Captured Qwen Email from Auth Session Response: ${email}`,
            );
            eventPayload.email = email;
            proxyEvents.emit('qwen-login-email', { email });
          }
          proxyEvents.emit('qwen-login-token', eventPayload);
        } else if (
          userData &&
          userData.email &&
          !userData.email.includes('***')
        ) {
          logger.info(
            `[Proxy] Captured Qwen Email (no token) from Auth Response: ${userData.email}`,
          );
          proxyEvents.emit('qwen-login-email', { email: userData.email });
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Qwen Auth Session Response:', e);
      }
    }
  },
};