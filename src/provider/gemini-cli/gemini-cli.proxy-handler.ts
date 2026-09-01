/**
 * ------------------------------------------------------------------
 * Gemini CLI Proxy Handler
 * ------------------------------------------------------------------
 * Proxy handler để capture tokens, project ID, và user info từ Gemini CLI.
 * Lắng nghe OAuth token response, project ID từ loadCodeAssist API,
 * và user info từ Google userinfo API.
 *
 * Main features:
 * - onRequest()       : Capture cookies chứa token
 * - onResponseBody()  : Capture access token, project ID, email
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Services ──
import { ProxyHandler } from '../../services/proxy.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import { GEMINI_CLI_EVENTS } from './gemini-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiCLIProvider');

// ─── Proxy Handler ────────────────────────────────────────────────────

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      (host.includes('accounts.google.com') ||
        host.includes('cloudcode-pa.googleapis.com'))
    ) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (
        reqCookies &&
        (reqCookies.includes('ACCESS_TOKEN') ||
          reqCookies.includes('REFRESH_TOKEN'))
      ) {
        proxyEvents.emit(GEMINI_CLI_EVENTS.TOKENS, reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('oauth2.googleapis.com') &&
      url.includes('/token')
    ) {
      try {
        const json = JSON.parse(body);
        if (json.access_token)
          proxyEvents.emit(GEMINI_CLI_EVENTS.TOKENS, JSON.stringify(json));
      } catch (e) {
        logger.error('[Proxy] Failed to parse Gemini CLI token response:', e);
      }
    }

    if (
      host &&
      host.includes('cloudcode-pa.googleapis.com') &&
      url.includes(':loadCodeAssist')
    ) {
      try {
        const json = JSON.parse(body);
        if (json.cloudaicompanionProject) {
          const projectId =
            typeof json.cloudaicompanionProject === 'string'
              ? json.cloudaicompanionProject
              : json.cloudaicompanionProject.id;
          proxyEvents.emit(GEMINI_CLI_EVENTS.USER_INFO, { projectId });
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Gemini CLI loadCodeAssist response:', e);
      }
    }

    if (
      host &&
      host.includes('www.googleapis.com') &&
      url.includes('/userinfo')
    ) {
      try {
        const json = JSON.parse(body);
        if (json.email)
          proxyEvents.emit(GEMINI_CLI_EVENTS.USER_INFO, {
            email: json.email,
            name: json.name,
          });
      } catch (e) {
        logger.error('[Proxy] Failed to parse Gemini CLI userinfo response:', e);
      }
    }
  },
};