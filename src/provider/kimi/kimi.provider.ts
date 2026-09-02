/**
 * ------------------------------------------------------------------
 * Kimi Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Kimi AI (Moonshot).
 * Hỗ trợ login qua browser, chat completion với gRPC-Web Connect,
 * thinking mode, search, và auto-refresh token.
 *
 * Main features:
 * - login()                : Đăng nhập qua browser
 * - handleMessage()        : Gửi tin nhắn với streaming response
 * - refreshAccessToken()   : Tự động refresh token khi hết hạn
 * - getModels()            : Lấy danh sách models
 * - getProfile()           : Lấy thông tin user profile
 * - Fallback handling      : Tự động fallback khi K3 overload
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Repositories ──
import { updateAccountCredential } from '../../repositories/account.repository';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Kimi Imports ──
import {
  KIMI_BASE_URL,
  KIMI_MODELS,
  KimiCredential,
  KimiChatRequest,
} from './kimi.types';
import {
  KIMI_EVENTS,
  USER_AGENT,
  MSH_HEADERS,
  AUTH_REFRESH_URL,
  CHAT_URL,
  GET_USER_URL,
  LIST_THIRD_ACCOUNTS_URL,
} from './kimi.constant';
import { parseKimiSSE } from './kimi.sse-parser';
import { kimiProxyHandler } from './kimi.proxy-handler';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KimiProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class KimiProvider implements Provider {
  name = 'Kimi';
  defaultModel = KIMI_MODELS.K3;
  proxyHandler = kimiProxyHandler;

  // ─── Credential Parser ─────────────────────────────────────────────

  private parseCredential(credential: string): KimiCredential {
    if (!credential) return { token: '' };

    if (credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential);
        const token = parsed.token || parsed.access_token || '';
        return {
          token,
          refreshToken: parsed.refreshToken || parsed.refresh_token || '',
          cookies: parsed.cookies || (token ? `kimi-auth=${token}` : ''),
          deviceId:
            parsed.deviceId ||
            parsed.device_id ||
            `dev_${crypto.randomBytes(8).toString('hex')}`,
          sessionId:
            parsed.sessionId ||
            parsed.session_id ||
            `sess_${crypto.randomBytes(8).toString('hex')}`,
          trafficId: parsed.trafficId || parsed.traffic_id || '',
          userAgent: parsed.userAgent || USER_AGENT,
        };
      } catch {
        logger.warn(
          '[Kimi] Credential is not valid JSON, falling through to raw token parsing',
        );
      }
    }

    if (credential.startsWith('eyJ')) {
      return {
        token: credential,
        cookies: `kimi-auth=${credential}`,
        deviceId: `dev_${crypto.randomBytes(8).toString('hex')}`,
        sessionId: `sess_${crypto.randomBytes(8).toString('hex')}`,
      };
    }

    const match =
      credential.match(/kimi-auth=([^;]+)/) ||
      credential.match(/access_token=([^;]+)/) ||
      credential.match(/token=([^;]+)/);
    const token = match ? match[1] : credential;

    const refreshMatch =
      credential.match(/kimi-refresh=([^;]+)/) ||
      credential.match(/refresh_token=([^;]+)/);
    const refreshToken = refreshMatch ? refreshMatch[1] : '';

    return {
      token,
      refreshToken,
      cookies: credential,
      deviceId: `dev_${crypto.randomBytes(8).toString('hex')}`,
      sessionId: `sess_${crypto.randomBytes(8).toString('hex')}`,
    };
  }

  // ─── Token Helpers ──────────────────────────────────────────────────

  private getTokenExpiry(jwt: string): number | null {
    try {
      const parts = jwt.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      );
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  // ─── Refresh Token ──────────────────────────────────────────────────

  async refreshAccessToken(
    cred: KimiCredential,
    accountId?: string,
  ): Promise<string | null> {
    const tokenToUse = cred.refreshToken || cred.token;
    if (!tokenToUse) return null;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': cred.userAgent || USER_AGENT,
        Origin: KIMI_BASE_URL,
        Referer: `${KIMI_BASE_URL}/`,
      };

      const res = await fetch(AUTH_REFRESH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          refreshToken: tokenToUse,
        }),
        timeout: 10000,
      } as any);

      if (res.ok) {
        const json: any = await res.json();
        const newAccessToken =
          json.accessToken ||
          json.access_token ||
          json.token ||
          json.data?.token ||
          json.data?.accessToken;
        const newRefreshToken =
          json.refreshToken ||
          json.refresh_token ||
          json.data?.refreshToken ||
          json.data?.refresh_token ||
          cred.refreshToken;

        if (newAccessToken && typeof newAccessToken === 'string') {
          cred.token = newAccessToken;
          if (newRefreshToken) cred.refreshToken = newRefreshToken;
          cred.cookies = `kimi-auth=${newAccessToken}${cred.refreshToken ? `; refresh_token=${cred.refreshToken}` : ''}`;

          if (accountId) {
            try {
              updateAccountCredential(accountId, cred.cookies);
            } catch (e) {
              logger.warn('[Kimi] Failed to persist refreshed credential:', e);
            }
          }
          return newAccessToken;
        }
      } else {
        const errText = await res.text();
        logger.warn(
          `[Kimi] Refresh token returned status ${res.status}: ${errText.slice(0, 300)}`,
        );
      }
    } catch (e: any) {
      logger.warn('[Kimi] Token refresh failed:', e.message);
    }
    return null;
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getProfile(
    token: string,
    extraHeaders?: Record<string, string>,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      let rawToken = token;
      if (token.startsWith('{')) {
        try {
          const parsed = JSON.parse(token);
          rawToken = parsed.token || parsed.access_token || token;
        } catch {
          // ignore
        }
      }
      if (rawToken.includes('kimi-auth=')) {
        const match = rawToken.match(/kimi-auth=([^;]+)/);
        if (match) rawToken = match[1];
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: KIMI_BASE_URL,
        Referer: `${KIMI_BASE_URL}/`,
        'User-Agent': extraHeaders?.['User-Agent'] || USER_AGENT,
        ...MSH_HEADERS,
      };

      if (extraHeaders?.['x-msh-device-id'])
        headers['x-msh-device-id'] = extraHeaders['x-msh-device-id'];
      if (extraHeaders?.['x-msh-session-id'])
        headers['x-msh-session-id'] = extraHeaders['x-msh-session-id'];
      if (extraHeaders?.['x-traffic-id'])
        headers['x-traffic-id'] = extraHeaders['x-traffic-id'];
      if (extraHeaders?.['Cookie']) headers['Cookie'] = extraHeaders['Cookie'];

      const res = await fetch(GET_USER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
        timeout: 5000,
      } as any);

      if (res.ok) {
        const json: any = await res.json();
        if (
          json.user &&
          (json.user.id || json.user.nickname || json.user.name)
        ) {
          const name = json.user.nickname || json.user.name;
          const id = json.user.id || json.user.globalId;

          let email = name || id;

          try {
            const thirdRes = await fetch(LIST_THIRD_ACCOUNTS_URL, {
              method: 'POST',
              headers,
              body: JSON.stringify({}),
              timeout: 3000,
            } as any);
            if (thirdRes.ok) {
              const thirdJson: any = await thirdRes.json();
              if (thirdJson.email) {
                email = name ? `${name} (${thirdJson.email})` : thirdJson.email;
              }
            }
          } catch {
            // ignore
          }

          return { email, name, id };
        }
        logger.warn('[Kimi] Get Profile response missing user data');
      } else {
        logger.warn(`[Kimi] Get Profile returned status ${res.status}`);
      }
    } catch (e) {
      logger.error('[Kimi] Get Profile Error:', e);
    }
    return { email: null };
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(options?: {
    method?: string;
  }): Promise<{ email: string; cookies: string; headers?: any }> {
    let capturedHeaders: Record<string, string> = {};
    const onHeaders = (headers: Record<string, string>) => {
      capturedHeaders = { ...capturedHeaders, ...headers };
    };

    proxyEvents.on(KIMI_EVENTS.HEADERS, onHeaders);

    try {
      const res = await loginService.captureCredentialsViaCDP({
        providerId: 'kimi',
        loginUrl: `${KIMI_BASE_URL}/`,
        partition: `kimi-${Date.now()}`,
        cookieEvent: KIMI_EVENTS.LOGIN_TOKEN,
        infoEvent: KIMI_EVENTS.LOGIN_EMAIL,
        extraEvents: [KIMI_EVENTS.HEADERS],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          let token = data.cookies;
          if (token.startsWith('{')) {
            try {
              const parsed = JSON.parse(token);
              token = parsed.token || parsed.access_token || token;
            } catch {
              // ignore
            }
          }

          if (token.includes('kimi-auth=')) {
            const match = token.match(/kimi-auth=([^;]+)/);
            if (match) token = match[1];
          }

          if (!token || !token.startsWith('eyJ')) {
            logger.warn('[Kimi] Login validation failed: invalid token format');
            return { isValid: false };
          }

          const refreshToken =
            (data as any).refreshToken || (data as any).refresh_token || '';

          const profile = await this.getProfile(token, capturedHeaders);
          if (!profile.email && !profile.id) {
            logger.warn(
              '[Kimi] Login validation failed: could not fetch user profile',
            );
            return { isValid: false };
          }

          if (!refreshToken) {
            logger.warn(
              '[Kimi] Login validation failed: missing refresh token',
            );
            return { isValid: false };
          }

          const userIdentifier =
            profile.email ||
            profile.name ||
            profile.id ||
            data.email ||
            'Kimi User';

          const cookieString = `kimi-auth=${token}${refreshToken ? `; refresh_token=${refreshToken}` : ''}`;
          const credObj: KimiCredential = {
            token,
            refreshToken,
            cookies: cookieString,
            deviceId:
              capturedHeaders['x-msh-device-id'] ||
              `dev_${crypto.randomBytes(8).toString('hex')}`,
            sessionId:
              capturedHeaders['x-msh-session-id'] ||
              `sess_${crypto.randomBytes(8).toString('hex')}`,
            trafficId: capturedHeaders['x-traffic-id'] || '',
            userAgent: capturedHeaders['User-Agent'] || USER_AGENT,
          };

          return {
            isValid: true,
            email: userIdentifier,
            cookies: cookieString,
            headers: capturedHeaders,
          };
        },
      });

      return {
        email: res.email || 'kimi_user@kimi.ai',
        cookies: res.cookies || '',
        headers: res.headers,
      };
    } finally {
      proxyEvents.off(KIMI_EVENTS.HEADERS, onHeaders);
    }
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model = this.defaultModel,
      conversationId,
      thinking = false,
      search = false,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
      onSessionCreated,
    } = options;

    const cred = this.parseCredential(credential);
    if (!cred.token) {
      onError(new Error('Kimi token missing. Please login first.'));
      return;
    }

    let cleanModel = model.toLowerCase();
    if (cleanModel.includes('/')) {
      cleanModel = cleanModel.split('/').pop() || cleanModel;
    }

    let isThinkingModel = thinking === true;
    let scenario = 'SCENARIO_K2D5';
    let kimiModelName = 'k2d6-chat';

    if (cleanModel === 'instant' || cleanModel === 'k2d6') {
      scenario = 'SCENARIO_K2D5';
      isThinkingModel = false;
      kimiModelName = 'k2d6-chat';
    } else if (
      cleanModel === 'k2d6-thinking' ||
      cleanModel.includes('thinking')
    ) {
      scenario = 'SCENARIO_K2D5';
      isThinkingModel = true;
      kimiModelName = 'k2d6-chat';
    } else if (
      cleanModel === 'k3' ||
      cleanModel === 'k3-swarm' ||
      cleanModel.includes('agent') ||
      cleanModel.includes('swarm')
    ) {
      scenario = 'SCENARIO_OK_COMPUTER';
      isThinkingModel = true;
    }

    const lastMsg = messages[messages.length - 1];
    const promptText =
      typeof lastMsg?.content === 'string'
        ? lastMsg.content
        : JSON.stringify(lastMsg?.content || '');

    const payload: any = {
      scenario,
      options: {
        thinking: isThinkingModel,
        enable_plugin: search,
        reasoning_effort: isThinkingModel
          ? 'REASONING_EFFORT_HIGH'
          : 'REASONING_EFFORT_LOW',
      },
      message: {
        role: 'user',
        blocks: [{ text: { content: promptText } }],
      },
    };

    if (scenario === 'SCENARIO_K2D5') {
      payload.options.model = kimiModelName;
    } else if (scenario === 'SCENARIO_OK_COMPUTER') {
      payload.kimiplus_id = 'ok-computer';
    }

    if (conversationId && !conversationId.startsWith('kimi_temp_')) {
      payload.chat_id = conversationId;
    }

    if (search) {
      payload.tools = [{ type: 'TOOL_TYPE_SEARCH', search: {} }];
    }

    const jsonBuf = Buffer.from(JSON.stringify(payload), 'utf8');
    const envelopeHeader = Buffer.alloc(5);
    envelopeHeader.writeUInt8(0, 0);
    envelopeHeader.writeUInt32BE(jsonBuf.length, 1);
    const bodyWithEnvelope = Buffer.concat([envelopeHeader, jsonBuf]);

    let activeToken = cred.token;
    const exp = this.getTokenExpiry(cred.token);
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp && exp <= nowSec + 30) {
      const refreshed = await this.refreshAccessToken(cred, options.accountId);
      if (refreshed) {
        activeToken = refreshed;
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': 'application/connect+json',
      Accept: 'application/connect+json',
      'connect-protocol-version': '1',
      'User-Agent': cred.userAgent || USER_AGENT,
      Origin: KIMI_BASE_URL,
      Referer: `${KIMI_BASE_URL}/`,
      ...MSH_HEADERS,
      'r-timezone': 'Asia/Saigon',
    };

    if (cred.sessionId) headers['x-msh-session-id'] = cred.sessionId;
    if (cred.deviceId) headers['x-msh-device-id'] = cred.deviceId;
    if (cred.trafficId) headers['x-traffic-id'] = cred.trafficId;
    if (cred.cookies) headers['Cookie'] = cred.cookies;

    try {
      let response = await fetch(CHAT_URL, {
        method: 'POST',
        headers,
        body: bodyWithEnvelope,
        timeout: 120000,
      } as any);

      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken(
          cred,
          options.accountId,
        );
        if (refreshed) {
          activeToken = refreshed;
          headers['Authorization'] = `Bearer ${activeToken}`;
          if (cred.cookies) headers['Cookie'] = cred.cookies;

          response = await fetch(CHAT_URL, {
            method: 'POST',
            headers,
            body: bodyWithEnvelope,
            timeout: 120000,
          } as any);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Kimi API Error ${response.status}: ${errorText.slice(0, 500)}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body from Kimi API');
      }

      let result = await parseKimiSSE(response.body as any, {
        onContent,
        onThinking,
        onMetadata,
        onRaw,
        conversationId,
      });

      // Fallback khi OK_COMPUTER overloaded
      if (
        !result.accumulatedContent &&
        result.error &&
        scenario === 'SCENARIO_OK_COMPUTER'
      ) {
        logger.warn(
          `[Kimi] OK_COMPUTER overloaded (${result.error}). Falling back to SCENARIO_K2D5.`,
        );
        payload.scenario = 'SCENARIO_K2D5';
        payload.options.model = 'k2d6-chat';
        delete payload.kimiplus_id;

        const fallbackJsonBuf = Buffer.from(JSON.stringify(payload), 'utf8');
        const fallbackHeader = Buffer.alloc(5);
        fallbackHeader.writeUInt8(0, 0);
        fallbackHeader.writeUInt32BE(fallbackJsonBuf.length, 1);
        const fallbackBody = Buffer.concat([fallbackHeader, fallbackJsonBuf]);

        const retryResponse = await fetch(CHAT_URL, {
          method: 'POST',
          headers,
          body: fallbackBody,
          timeout: 120000,
        } as any);

        if (retryResponse.ok && retryResponse.body) {
          result = await parseKimiSSE(retryResponse.body as any, {
            onContent,
            onThinking,
            onMetadata,
            onRaw,
            conversationId,
          });
        }
      }

      if (result.error && !result.accumulatedContent) {
        throw new Error(result.error);
      }

      if (result.conversationId && onSessionCreated) {
        onSessionCreated(result.conversationId);
      }

      onDone();
    } catch (err: any) {
      logger.error('[Kimi] handleMessage error:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string, accountId?: string): Promise<any[]> {
    return [
      {
        id: KIMI_MODELS.K3,
        name: 'Kimi K3 (Flagship)',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Chat & Agent, flagship all-rounder with deep reasoning',
      },
      {
        id: KIMI_MODELS.K3_SWARM,
        name: 'Kimi K3 Swarm',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description:
          'Massive search, batch processing, and multi-agent workflow',
      },
      {
        id: KIMI_MODELS.INSTANT,
        name: 'Kimi Instant',
        is_thinking: false,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Fast chat, quick replies for everyday tasks',
      },
      {
        id: KIMI_MODELS.K2D6_THINKING,
        name: 'Kimi K2.6 Thinking',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Deep reasoning for complex logic, math, and code',
      },
      {
        id: KIMI_MODELS.K2D6,
        name: 'Kimi K2.6 Instant',
        is_thinking: false,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Ultra-fast responses for everyday chat',
      },
      {
        id: KIMI_MODELS.K2D6_AGENT,
        name: 'Kimi K2.6 Agent',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Autonomous agent for deep research and documents',
      },
      {
        id: KIMI_MODELS.K2D6_AGENT_ULTRA,
        name: 'Kimi K2.6 Agent Swarm',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Multi-agent swarm for massive batch research',
      },
    ];
  }

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return (
      m.includes('kimi') ||
      m.includes('k3') ||
      m.includes('k2d6') ||
      m.includes('instant') ||
      m.includes('k1.5') ||
      m.includes('moonshot')
    );
  }
}

export default new KimiProvider();
