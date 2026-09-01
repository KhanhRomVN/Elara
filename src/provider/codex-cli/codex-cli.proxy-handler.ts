/**
 * ------------------------------------------------------------------
 * Codex CLI Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture tokens và user info từ Codex CLI.
 * Lắng nghe access token từ OAuth token endpoint và email từ usage API.
 *
 * Main features:
 * - onResponseBody() : Capture access/refresh token từ auth.openai.com
 * - onResponseBody() : Capture user email từ chatgpt.com/backend-api
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Constants ──
import { CODEX_CLI_EVENTS } from './codex-cli.constant';

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('auth.openai.com') &&
      url.includes('/oauth/token')
    ) {
      try {
        const json = JSON.parse(body);
        if (json.access_token) {
          proxyEvents.emit(CODEX_CLI_EVENTS.TOKENS, {
            cookies: JSON.stringify({
              accessToken: json.access_token,
              refreshToken: json.refresh_token || '',
              expiresIn: json.expires_in || 86400,
            }),
          });
        }
      } catch (e) {}
    }

    if (
      host &&
      host.includes('chatgpt.com') &&
      url.includes('/backend-api/wham/usage')
    ) {
      try {
        const json = JSON.parse(body);
        if (json.email) proxyEvents.emit(CODEX_CLI_EVENTS.USER_INFO, json);
      } catch (e) {}
    }
  },
};