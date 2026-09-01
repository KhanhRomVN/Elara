/**
 * ------------------------------------------------------------------
 * DeepSeek Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture cookies, token, và user info từ DeepSeek.
 * Lắng nghe Authorization header, login email, login token,
 * và user info từ API.
 *
 * Main features:
 * - onRequest()       : Capture Authorization header
 * - onRequestData()   : Capture login email từ request body
 * - onResponseBody()  : Capture login token và user info từ response
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import { DEEPSEEK_EVENTS } from './deepseek.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DeepSeekProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('chat.deepseek.com')) {
      const auth = ctx.clientToProxyRequest.headers['authorization'];

      if (auth) {
        proxyEvents.emit(DEEPSEEK_EVENTS.AUTH_HEADER, auth);
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
      host.includes('chat.deepseek.com') &&
      url.includes('/api/v0/users/login')
    ) {
      const bodyStr = chunk.toString();
      try {
        const outerJson = JSON.parse(bodyStr);
        let foundEmail = null;
        if (outerJson.request) {
          const innerJson = JSON.parse(outerJson.request);
          if (innerJson.email) {
            foundEmail = innerJson.email;
          }
        } else if (outerJson.email) {
          foundEmail = outerJson.email;
        }

        if (foundEmail) {
          (ctx as any).capturedUnmaskedEmail = foundEmail;
          proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_EMAIL, { email: foundEmail });
        }
      } catch (e) {
        const emailMatch = bodyStr.match(
          /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
        );
        if (emailMatch && emailMatch[0]) {
          const email = `${emailMatch[1]}@${emailMatch[2]}`.replace(/\\/g, '');
          if (!email.includes('***')) {
            (ctx as any).capturedUnmaskedEmail = email;
            proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_EMAIL, { email });
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
      host.includes('chat.deepseek.com') &&
      url.includes('/api/v0/users/login')
    ) {
      try {
        const json = JSON.parse(body);
        let userData;

        if (json.response && typeof json.response === 'string') {
          const innerResponse = JSON.parse(json.response);
          userData = innerResponse?.data?.biz_data?.user;
        } else if (json.data && json.data.biz_data && json.data.biz_data.user) {
          userData = json.data.biz_data.user;
        } else if (json.code === 0 && json.data) {
          userData = json.data;
        }

        if (userData && userData.token) {
          const eventPayload: any = { cookies: userData.token };
          const capturedEmail = (ctx as any).capturedUnmaskedEmail;
          let bestEmail = capturedEmail || userData.email;

          if (bestEmail?.includes('***') && capturedEmail) {
            bestEmail = capturedEmail;
          }

          if (bestEmail) {
            eventPayload.email = bestEmail;
            proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_EMAIL, {
              email: bestEmail,
            });
          }
          proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_TOKEN, eventPayload);
          delete (ctx as any).capturedUnmaskedEmail;
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse DeepSeek Login Response:', {
          error: e,
          body: body.slice(0, 500),
          url: url,
        });
      }
    }

    if (
      host &&
      host.includes('accounts.google.com') &&
      url.includes('signin/oauth/id')
    ) {
      const emailMatch = body.match(/"oPEP7c":"([^"]+)"/);
      if (emailMatch && emailMatch[1] && !emailMatch[1].includes('***')) {
        (ctx as any).capturedUnmaskedEmail = emailMatch[1];
        proxyEvents.emit(DEEPSEEK_EVENTS.GOOGLE_EMAIL, {
          email: emailMatch[1],
        });
      }
    }

    if (
      host &&
      host.includes('chat.deepseek.com') &&
      url.includes('/api/v0/users/current')
    ) {
      try {
        const userInfo = JSON.parse(body);
        if (userInfo.code === 0 && userInfo.data) {
          proxyEvents.emit(DEEPSEEK_EVENTS.USER_INFO, userInfo.data);
          const bizData = userInfo.data?.biz_data;
          if (bizData) {
            if (bizData.token) {
              const eventPayload: any = { cookies: bizData.token };
              const capturedEmail = (ctx as any).capturedUnmaskedEmail;
              let bestEmail = capturedEmail || bizData.email;
              if (bestEmail?.includes('***') && capturedEmail) {
                bestEmail = capturedEmail;
              }
              if (bestEmail) {
                eventPayload.email = bestEmail;
              }
              proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_TOKEN, eventPayload);
            }
            if (bizData.email) {
              proxyEvents.emit(DEEPSEEK_EVENTS.LOGIN_EMAIL, {
                email: bizData.email,
              });
            }
          }
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse DeepSeek User Info:', {
          error: e,
          body: body.slice(0, 500),
          url: url,
        });
      }
    }
  },
};
