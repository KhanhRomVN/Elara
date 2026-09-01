/**
 * ------------------------------------------------------------------
 * Qwen CLI Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture tokens và user info từ Qwen CLI.
 * Lắng nghe access token từ OAuth token endpoint và email từ user API.
 *
 * Main features:
 * - onResponseBody() : Capture access/refresh token từ token endpoint
 * - onResponseBody() : Capture email từ user info API
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import { QWEN_CLI_EVENTS } from './qwen-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenCLIProxy');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('chat.qwen.ai')) {
      if (url.includes('/api/v1/oauth2/token')) {
        try {
          const json = JSON.parse(body);
          let tokenData = json;
          if (
            json.response &&
            typeof json.response === 'string' &&
            json.response.startsWith('{')
          ) {
            try { tokenData = JSON.parse(json.response); } catch (e) {}
          }
          if (tokenData.access_token) {
            proxyEvents.emit(QWEN_CLI_EVENTS.TOKENS, {
              cookies: JSON.stringify({
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || '',
                expiresIn: tokenData.expires_in || 3600,
              }),
            });
          }
        } catch (e) {
          logger.error('[Proxy] Failed to parse Qwen CLI token response:', e);
        }
      }
      if (url.includes('/api/v1/user') || url.includes('/api/v1/auths')) {
        try {
          const json = JSON.parse(body);
          let data = json;
          if (
            json.response &&
            typeof json.response === 'string' &&
            json.response.startsWith('{')
          ) {
            try { data = JSON.parse(json.response); } catch (e) {}
          }
          const email = data.email || data.data?.email;
          if (email) proxyEvents.emit(QWEN_CLI_EVENTS.USER_INFO, { email });
        } catch (e) {
          logger.error('[Proxy] Failed to parse Qwen CLI user info response:', e);
        }
      }
    }
  },
};