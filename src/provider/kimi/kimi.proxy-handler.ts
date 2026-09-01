/**
 * ------------------------------------------------------------------
 * Kimi Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture token, refresh token, và user info từ Kimi.
 * Lắng nghe JWT token từ Authorization header, cookie, và API response.
 *
 * Main features:
 * - onRequest()       : Capture token từ header/cookie, extract email từ JWT
 * - onResponseBody()  : Capture token từ API response body
 * - onResponse()      : Capture Google OAuth redirect
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler, proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import { KIMI_EVENTS } from './kimi.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KimiProxyHandler');

// ─── Helpers ────────────────────────────────────────────────────────────

function extractInfoFromJwt(token: string): {
  email?: string;
  name?: string;
  sub?: string;
} {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      );
      return {
        email: payload.email,
        name: payload.name || payload.nickname,
        sub: payload.sub || payload.abstract_user_id || payload.id,
      };
    }
  } catch {
    logger.warn('[Proxy] Failed to extract JWT info');
  }
  return {};
}

// ─── Proxy Handler ────────────────────────────────────────────────────

export const kimiProxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest?.headers?.host || '';
    const url = ctx.clientToProxyRequest?.url || '';

    if (
      host.includes('kimi.ai') ||
      host.includes('kimi.com') ||
      host.includes('moonshot.cn') ||
      host.includes('auth.kimi.ai')
    ) {
      const headers = ctx.clientToProxyRequest.headers;
      const auth = headers['authorization'] || headers['Authorization'];
      const cookie = headers['cookie'] || headers['Cookie'] || '';

      let capturedToken = '';
      let capturedRefreshToken = '';

      if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
        capturedToken = auth.slice(7).trim();
      }

      if (!capturedToken && cookie.includes('kimi-auth=')) {
        const match = cookie.match(/kimi-auth=([^;]+)/);
        if (match && match[1]) capturedToken = match[1];
      }

      if (!capturedToken && cookie.includes('token=')) {
        const match = cookie.match(/token=([^;]+)/);
        if (match && match[1] && match[1].startsWith('eyJ'))
          capturedToken = match[1];
      }

      if (cookie.includes('kimi-refresh=')) {
        const match = cookie.match(/kimi-refresh=([^;]+)/);
        if (match && match[1]) capturedRefreshToken = match[1];
      } else if (cookie.includes('refresh_token=')) {
        const match = cookie.match(/refresh_token=([^;]+)/);
        if (match && match[1]) capturedRefreshToken = match[1];
      }

      const deviceId = headers['x-msh-device-id'];
      const sessionId = headers['x-msh-session-id'];
      const trafficId = headers['x-traffic-id'];
      const userAgent = headers['user-agent'] || headers['User-Agent'];

      const headerPayload: Record<string, string> = {};
      if (deviceId) headerPayload['x-msh-device-id'] = String(deviceId);
      if (sessionId) headerPayload['x-msh-session-id'] = String(sessionId);
      if (trafficId) headerPayload['x-traffic-id'] = String(trafficId);
      if (userAgent) headerPayload['User-Agent'] = String(userAgent);
      if (cookie) headerPayload['Cookie'] = String(cookie);

      proxyEvents.emit(KIMI_EVENTS.HEADERS, headerPayload);

      if (capturedToken && capturedToken.startsWith('eyJ')) {
        const jwtInfo = extractInfoFromJwt(capturedToken);
        const email =
          jwtInfo.email ||
          jwtInfo.name ||
          (jwtInfo.sub
            ? `Kimi_${jwtInfo.sub.slice(0, 8)}`
            : 'kimi_user@kimi.ai');

        proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email });

        const tokenPayload: any = {
          token: capturedToken,
          cookies: capturedToken,
          email,
          headers: headerPayload,
        };
        if (capturedRefreshToken) {
          tokenPayload.refreshToken = capturedRefreshToken;
          tokenPayload.cookies = `kimi-auth=${capturedToken}; refresh_token=${capturedRefreshToken}`;
        }
        proxyEvents.emit(KIMI_EVENTS.LOGIN_TOKEN, tokenPayload);
      }
    }

    if (url.includes('google-callback') && url.includes('id_token=')) {
      const match = url.match(/id_token=([^&]+)/);
      if (match && match[1]) {
        const idToken = decodeURIComponent(match[1]);
        const jwtInfo = extractInfoFromJwt(idToken);
        if (jwtInfo.email) {
          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email: jwtInfo.email });
        }
      }
    }

    callback();
  },

  onRequestData: (
    ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    callback(null, chunk);
  },

  onResponse: (ctx: any, callback: () => void) => {
    const location = ctx.serverToProxyResponse?.headers?.location || '';
    if (location && location.includes('id_token=')) {
      const match = location.match(/id_token=([^&#]+)/);
      if (match && match[1]) {
        const idToken = decodeURIComponent(match[1]);
        const jwtInfo = extractInfoFromJwt(idToken);
        if (jwtInfo.email) {
          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email: jwtInfo.email });
        }
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest?.headers?.host || '';
    const url = ctx.clientToProxyRequest?.url || '';

    if (
      host.includes('kimi.ai') ||
      host.includes('kimi.com') ||
      host.includes('moonshot.cn') ||
      host.includes('auth.kimi.ai')
    ) {
      try {
        const json = JSON.parse(body);

        const token =
          json.accessToken ||
          json.access_token ||
          json.token ||
          json.data?.token ||
          json.data?.access_token ||
          json.data?.accessToken;
        const refreshToken =
          json.refreshToken ||
          json.refresh_token ||
          json.data?.refreshToken ||
          json.data?.refresh_token ||
          json.refreshToken;
        if (token && typeof token === 'string' && token.startsWith('eyJ')) {
          const jwtInfo = extractInfoFromJwt(token);
          const email =
            json.user?.email ||
            json.user?.name ||
            json.user?.nickname ||
            json.data?.email ||
            json.data?.name ||
            jwtInfo.email ||
            jwtInfo.name ||
            'kimi_user@kimi.ai';

          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email });
          const tokenPayload: any = {
            token,
            cookies: `kimi-auth=${token}${refreshToken ? `; refresh_token=${refreshToken}` : ''}`,
            email,
          };
          if (refreshToken) {
            tokenPayload.refreshToken = refreshToken;
          }
          proxyEvents.emit(KIMI_EVENTS.LOGIN_TOKEN, tokenPayload);
        }

        if (
          json.user &&
          (json.user.nickname || json.user.name || json.user.email)
        ) {
          const name = json.user.nickname || json.user.name || json.user.email;
          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email: name });
        }

        if (json.email && json.thirdParty) {
          proxyEvents.emit(KIMI_EVENTS.LOGIN_EMAIL, { email: json.email });
        }
      } catch {
        logger.warn('[Proxy] Kimi response body is not JSON');
      }
    }
  },
};

export default kimiProxyHandler;
