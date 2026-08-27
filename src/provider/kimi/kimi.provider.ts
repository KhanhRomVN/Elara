import fetch from 'node-fetch';
import * as crypto from 'crypto';
import { Provider, SendMessageOptions } from '../../types';
import { createLogger } from '../../utils/logger';
import { loginService } from '../../services/login/login.service';
import { proxyEvents } from '../../services/proxy.service';
import { updateAccountCredential } from '../../repositories/account.repository';
import { KIMI_BASE_URL, KIMI_MODELS, KimiCredential, KimiChatRequest } from './kimi.types';
import { parseKimiSSE } from './kimi.sse-parser';
import { kimiProxyHandler } from './kimi.proxy-handler';

const logger = createLogger('KimiProvider');

export class KimiProvider implements Provider {
  name = 'Kimi';
  defaultModel = KIMI_MODELS.K3;
  proxyHandler = kimiProxyHandler;

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
          deviceId: parsed.deviceId || parsed.device_id || `dev_${crypto.randomBytes(8).toString('hex')}`,
          sessionId: parsed.sessionId || parsed.session_id || `sess_${crypto.randomBytes(8).toString('hex')}`,
          trafficId: parsed.trafficId || parsed.traffic_id || '',
          userAgent:
            parsed.userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        };
      } catch {
        // fall through
      }
    }

    // Check if raw JWT
    if (credential.startsWith('eyJ')) {
      return {
        token: credential,
        cookies: `kimi-auth=${credential}`,
        deviceId: `dev_${crypto.randomBytes(8).toString('hex')}`,
        sessionId: `sess_${crypto.randomBytes(8).toString('hex')}`,
      };
    }

    // Cookie string
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

  async refreshAccessToken(cred: KimiCredential, accountId?: string): Promise<string | null> {
    const tokenToUse = cred.refreshToken || cred.token;
    if (!tokenToUse) return null;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent':
          cred.userAgent ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Origin': KIMI_BASE_URL,
        'Referer': `${KIMI_BASE_URL}/`,
      };

      const res = await fetch('https://auth.kimi.ai/api/account.gateway.v1.AuthService/RefreshToken', {
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
          logger.info('[Kimi] Successfully refreshed access token via AuthService!');
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
        logger.warn(`[Kimi] Refresh token returned status ${res.status}: ${errText.slice(0, 300)}`);
      }
    } catch (e: any) {
      logger.warn('[Kimi] Token refresh failed:', e.message);
    }
    return null;
  }

  private extractEmailFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return payload.email || payload.name || payload.sub || payload.id || null;
      }
    } catch {
      // ignore
    }
    return null;
  }

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
        description: 'Massive search, batch processing, and multi-agent workflow in one go',
      },
      {
        id: KIMI_MODELS.INSTANT,
        name: 'Kimi Instant',
        is_thinking: false,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Fast chat, quick replies for everyday conversational tasks',
      },
      {
        id: KIMI_MODELS.K2D6_THINKING,
        name: 'Kimi K2.6 Thinking',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Deep reasoning model for complex logical questions, math, and code',
      },
      {
        id: KIMI_MODELS.K2D6,
        name: 'Kimi K2.6 Instant',
        is_thinking: false,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Ultra-fast responses for everyday chat queries',
      },
      {
        id: KIMI_MODELS.K2D6_AGENT,
        name: 'Kimi K2.6 Agent',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Autonomous agent for deep research, slides, website, and documents',
      },
      {
        id: KIMI_MODELS.K2D6_AGENT_ULTRA,
        name: 'Kimi K2.6 Agent Swarm',
        is_thinking: true,
        max_context_length: 262144,
        is_search: true,
        is_image_upload: true,
        description: 'Multi-agent swarm for massive batch research and long writing',
      },
    ];
  }

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
        'Authorization': `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': KIMI_BASE_URL,
        'Referer': `${KIMI_BASE_URL}/`,
        'User-Agent':
          extraHeaders?.['User-Agent'] ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'x-msh-platform': 'web',
        'x-msh-version': '2.0.0',
        'x-language': 'en-US',
      };

      if (extraHeaders?.['x-msh-device-id']) headers['x-msh-device-id'] = extraHeaders['x-msh-device-id'];
      if (extraHeaders?.['x-msh-session-id']) headers['x-msh-session-id'] = extraHeaders['x-msh-session-id'];
      if (extraHeaders?.['x-traffic-id']) headers['x-traffic-id'] = extraHeaders['x-traffic-id'];
      if (extraHeaders?.['Cookie']) headers['Cookie'] = extraHeaders['Cookie'];

      // Call GetCurrentUser
      const res = await fetch(`${KIMI_BASE_URL}/apiv2/kimi.gateway.account.v1.UserService/GetCurrentUser`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
        timeout: 5000,
      } as any);

      if (res.ok) {
        const json: any = await res.json();
        if (json.user && (json.user.id || json.user.nickname || json.user.name)) {
          const name = json.user.nickname || json.user.name;
          const id = json.user.id || json.user.globalId;

          let email = name || id;

          // Also try to check ListThirdAccounts for email
          try {
            const thirdRes = await fetch(`${KIMI_BASE_URL}/apiv2/kimi.gateway.account.v1.SecurityService/ListThirdAccounts`, {
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
      }
    } catch (e) {
      logger.debug('[Kimi] Get Profile error:', e);
    }
    return { email: null };
  }

  async login(options?: { method?: string }): Promise<{ email: string; cookies: string; headers?: any }> {
    logger.info(`[Kimi] Starting login to https://www.kimi.ai/ (method: ${options?.method || 'basic'})`);

    let capturedHeaders: Record<string, string> = {};
    const onHeaders = (headers: Record<string, string>) => {
      capturedHeaders = { ...capturedHeaders, ...headers };
    };

    proxyEvents.on('kimi-headers', onHeaders);

    try {
      const res = await loginService.login({
        providerId: 'kimi',
        loginUrl: 'https://www.kimi.ai/',
        partition: `kimi-${Date.now()}`,
        cookieEvent: 'kimi-login-token',
        infoEvent: 'kimi-login-email',
        extraEvents: ['kimi-headers'],
        validate: async (data: { cookies: string; headers?: any; email?: string }) => {
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
            return { isValid: false };
          }

          const refreshToken = (data as any).refreshToken || (data as any).refresh_token || '';

          // Verify token against GetCurrentUser API to ensure user is logged in
          const profile = await this.getProfile(token, capturedHeaders);
          if (!profile.email && !profile.id) {
            logger.debug('[Kimi] Token not yet authenticated with user profile, waiting for login...');
            return { isValid: false };
          }

          // Wait until refreshToken is captured from browser localStorage / AuthService response
          if (!refreshToken) {
            logger.debug('[Kimi] User profile authenticated, waiting for refreshToken to be captured...');
            return { isValid: false };
          }

          const userIdentifier = profile.email || profile.name || profile.id || data.email || 'Kimi User';
          logger.info(`[Kimi] ✅ Login validated successfully with refreshToken for: ${userIdentifier}`);

          const cookieString = `kimi-auth=${token}${refreshToken ? `; refresh_token=${refreshToken}` : ''}`;
          const credObj: KimiCredential = {
            token,
            refreshToken,
            cookies: cookieString,
            deviceId: capturedHeaders['x-msh-device-id'] || `dev_${crypto.randomBytes(8).toString('hex')}`,
            sessionId: capturedHeaders['x-msh-session-id'] || `sess_${crypto.randomBytes(8).toString('hex')}`,
            trafficId: capturedHeaders['x-traffic-id'] || '',
            userAgent:
              capturedHeaders['User-Agent'] ||
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
      proxyEvents.off('kimi-headers', onHeaders);
    }
  }

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

    // Normalize model name
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
    } else if (cleanModel === 'k2d6-thinking' || cleanModel.includes('thinking')) {
      scenario = 'SCENARIO_K2D5';
      isThinkingModel = true;
      kimiModelName = 'k2d6-chat';
    } else if (cleanModel === 'k3' || cleanModel === 'k3-swarm' || cleanModel.includes('agent') || cleanModel.includes('swarm')) {
      scenario = 'SCENARIO_OK_COMPUTER';
      isThinkingModel = true;
    }

    const lastMsg = messages[messages.length - 1];
    const promptText = typeof lastMsg?.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg?.content || '');

    const payload: any = {
      scenario,
      options: {
        thinking: isThinkingModel,
        enable_plugin: search,
        reasoning_effort: isThinkingModel ? 'REASONING_EFFORT_HIGH' : 'REASONING_EFFORT_LOW',
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
      logger.info('[Kimi] Access token expired or expiring soon, attempting auto-refresh...');
      const refreshed = await this.refreshAccessToken(cred, options.accountId);
      if (refreshed) {
        activeToken = refreshed;
      }
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${activeToken}`,
      'Content-Type': 'application/connect+json',
      'Accept': 'application/connect+json',
      'connect-protocol-version': '1',
      'User-Agent':
        cred.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Origin': KIMI_BASE_URL,
      'Referer': `${KIMI_BASE_URL}/`,
      'x-msh-platform': 'web',
      'x-msh-version': '2.0.0',
      'x-language': 'en-US',
      'r-timezone': 'Asia/Saigon',
    };

    if (cred.sessionId) headers['x-msh-session-id'] = cred.sessionId;
    if (cred.deviceId) headers['x-msh-device-id'] = cred.deviceId;
    if (cred.trafficId) headers['x-traffic-id'] = cred.trafficId;
    if (cred.cookies) headers['Cookie'] = cred.cookies;

    logger.info(
      `[Kimi] Sending message to ChatService. model=${cleanModel} scenario=${scenario} thinking=${isThinkingModel}`,
    );

    try {
      let response = await fetch(`${KIMI_BASE_URL}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`, {
        method: 'POST',
        headers,
        body: bodyWithEnvelope,
        timeout: 120000,
      } as any);

      // If 401 unauthenticated, attempt auto-refresh and retry once
      if (response.status === 401) {
        logger.info('[Kimi] 401 unauthenticated received, attempting auto-refresh token and retry...');
        const refreshed = await this.refreshAccessToken(cred, options.accountId);
        if (refreshed) {
          activeToken = refreshed;
          headers['Authorization'] = `Bearer ${activeToken}`;
          if (cred.cookies) headers['Cookie'] = cred.cookies;

          response = await fetch(`${KIMI_BASE_URL}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`, {
            method: 'POST',
            headers,
            body: bodyWithEnvelope,
            timeout: 120000,
          } as any);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kimi API Error ${response.status}: ${errorText.slice(0, 500)}`);
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

      // If OK_COMPUTER is queued / overloaded (common for free tier K3/Agent), fallback to SCENARIO_K2D5
      if (!result.accumulatedContent && result.error && scenario === 'SCENARIO_OK_COMPUTER') {
        logger.warn(`[Kimi] OK_COMPUTER overloaded (${result.error}). Falling back to SCENARIO_K2D5.`);
        payload.scenario = 'SCENARIO_K2D5';
        payload.options.model = 'k2d6-chat';
        delete payload.kimiplus_id;

        const fallbackJsonBuf = Buffer.from(JSON.stringify(payload), 'utf8');
        const fallbackHeader = Buffer.alloc(5);
        fallbackHeader.writeUInt8(0, 0);
        fallbackHeader.writeUInt32BE(fallbackJsonBuf.length, 1);
        const fallbackBody = Buffer.concat([fallbackHeader, fallbackJsonBuf]);

        const retryResponse = await fetch(`${KIMI_BASE_URL}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`, {
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
}

export default new KimiProvider();
