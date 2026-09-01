/**
 * ------------------------------------------------------------------
 * Z.AI Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Z.AI (Z.ai - Free AI Chatbot).
 * Hỗ trợ login, chat completion với streaming, rate limiting,
 * signature-based authentication, và session management.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getModels()      : Lấy danh sách models
 * - getProfile()     : Lấy thông tin user profile từ JWT
 * - Rate limiting    : Tự động giới hạn request (8 req/min)
 * - Signature auth   : Tạo signature cho mỗi request
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import { Router } from 'express';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login/login.service';

// ── Database ──
import { getDb } from '../../database';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── ZAI Imports ──
import { proxyHandler } from './zai.proxy-handler';
import { BASE_URL, ZAI_EVENTS, DEFAULT_USER_AGENT } from './zai.constant';
import {
  getAuthDataFromCredential,
  generateSignatureAndParams,
  buildZAIHeaders,
  parseUserAgentDetails,
  sanitizeCookies,
} from './zai.helpers';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ZAIProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class ZAIProvider implements Provider {
  name = 'Z.AI';
  proxyHandler = proxyHandler;
  defaultModel = 'GLM-5.1';

  // ─── User-Agent Rotation ───────────────────────────────────────────

  private userAgents: string[] = [
    DEFAULT_USER_AGENT,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  ];

  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestWindowStart: number = Date.now();

  // ─── Rate Limiting ──────────────────────────────────────────────────

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    if (now - this.requestWindowStart > 60000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    if (this.requestCount >= 8) {
      const waitTime = 60000 - (now - this.requestWindowStart);
      if (waitTime > 0) {
        logger.warn(`[Z.AI] Rate limit reached, waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.requestWindowStart = Date.now();
      }
    }

    const timeSinceLastRequest = now - this.lastRequestTime;
    if (this.lastRequestTime > 0 && timeSinceLastRequest < 500) {
      const delay = Math.random() * 2000 + 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  // ─── Models ─────────────────────────────────────────────────────────

  async getModels(_credential: string): Promise<any[]> {
    return [
      {
        id: 'GLM-5.1',
        name: 'GLM-5.1',
        is_thinking: false,
        max_context_length: null,
      },
      {
        id: 'GLM-5',
        name: 'GLM-5',
        is_thinking: false,
        max_context_length: null,
      },
    ];
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const jwtToken = credential.split('|||')[0];
      const parts = jwtToken.split('.');
      if (parts.length >= 2) {
        const payloadB64 = parts[1];
        const padding = '='.repeat((4 - (payloadB64.length % 4)) % 4);
        const payloadJson = Buffer.from(
          payloadB64 + padding,
          'base64',
        ).toString('utf-8');
        const payload = JSON.parse(payloadJson);
        return {
          email: payload.email || null,
          id: payload.id,
          name: payload.name,
        };
      }
      return { email: null };
    } catch (e) {
      logger.error('[Z.AI] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    return await loginService.login({
      providerId: 'z',
      loginUrl: `${BASE_URL}/`,
      partition: `z-${Date.now()}`,
      cookieEvent: ZAI_EVENTS.TOKEN,
      infoEvent: ZAI_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies) {
          const profile = await this.getProfile(data.cookies);
          const emailOrId = profile.email || profile.id;
          const isGuest = emailOrId
            ? emailOrId.toLowerCase().includes('guest')
            : true;
          if (emailOrId && !isGuest) {
            return { isValid: true, email: emailOrId, cookies: data.cookies };
          }
        }
        return { isValid: false };
      },
    });
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
      onSessionCreated,
      conversationId,
    } = options;

    await this.enforceRateLimit();

    const authData = getAuthDataFromCredential(credential);
    if (!authData) {
      onError(
        new Error('Z.AI authentication data not found. Please login first.'),
      );
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage.content;
    const rawModel = options.model || 'GLM-5.1';
    const modelName = rawModel === 'GLM-5' ? 'GLM-5-Turbo' : rawModel;

    try {
      let chatId = conversationId;
      const userMessageId = crypto.randomUUID();

      if (!chatId) {
        const createChatUrl = `${BASE_URL}/api/v1/chats/new`;
        const createChatPayload = {
          chat: {
            id: '',
            title: prompt.substring(0, 50) || 'New Chat',
            models: [modelName],
            params: {},
            history: {
              messages: {
                [userMessageId]: {
                  id: userMessageId,
                  parentId: null,
                  childrenIds: [],
                  role: 'user',
                  content: prompt,
                  timestamp: Math.floor(Date.now() / 1000),
                  models: [modelName],
                },
              },
              currentId: userMessageId,
            },
            tags: [],
            flags: [],
            features: [
              {
                server: 'tool_selector_h',
                status: 'hidden',
                type: 'tool_selector',
              },
            ],
            mcp_servers: [],
            enable_thinking: !!options.thinking,
            auto_web_search: false,
            message_version: 1,
            extra: {},
            timestamp: Date.now(),
            type: 'default',
          },
        };

        const userAgent = authData.userAgent || this.getRandomUserAgent();
        const uaDetails = parseUserAgentDetails(userAgent);
        const createHeaders: Record<string, string> = {
          Authorization: `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': userAgent,
          Origin: BASE_URL,
          Referer: `${BASE_URL}/`,
          'sec-ch-ua': uaDetails.secChUa,
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': uaDetails.secChUaPlatform,
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'accept-language': 'vi,en-US,en',
        };
        if (authData.cookies) {
          createHeaders['Cookie'] = sanitizeCookies(
            authData.cookies,
            authData.token,
          );
        }

        const createResponse = await fetch(createChatUrl, {
          method: 'POST',
          headers: createHeaders,
          body: JSON.stringify(createChatPayload),
        });

        if (!createResponse.ok) {
          const errText = await createResponse.text();
          throw new Error(
            `Failed to create chat session: ${createResponse.status} - ${errText}`,
          );
        }

        const createJson = await createResponse.json();
        chatId = createJson.id;
        if (!chatId)
          throw new Error(
            'Response from chats/new did not return a valid chat ID',
          );
        if (onSessionCreated) onSessionCreated(chatId);
        if (onMetadata) {
          onMetadata({
            conversation_id: chatId,
            conversation_title: prompt.substring(0, 50) || 'New Chat',
          });
        }
      }

      const completionId = crypto.randomUUID();
      const userAgent = authData.userAgent || this.getRandomUserAgent();

      const sigRes = generateSignatureAndParams(
        prompt,
        authData.token,
        authData.userId,
        chatId,
        undefined,
        userAgent,
      );
      const url = `${BASE_URL}/api/v2/chat/completions?${sigRes.queryParams}`;
      const headers = buildZAIHeaders(
        authData.token,
        sigRes.signature,
        chatId,
        authData.cookies,
        userAgent,
      );
      headers['User-Agent'] = userAgent;

      const vnTime = new Date(Date.now() + 7 * 3600000);
      const vnTimeStr = vnTime.toISOString().slice(0, 19).replace('T', ' ');
      const localDateStr = vnTimeStr.substring(0, 10);
      const localTimeOnlyStr = vnTimeStr.substring(11);
      const weekdays = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const weekdayStr = weekdays[vnTime.getUTCDay()];

      const payload = {
        stream: true,
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        signature_prompt: prompt,
        params: {},
        extra: {},
        features: {
          image_generation: false,
          web_search: false,
          auto_web_search: false,
          preview_mode: true,
          flags: [],
          vlm_tools_enable: false,
          vlm_web_search_enable: false,
          vlm_website_mode: false,
          enable_thinking: !!options.thinking,
        },
        variables: {
          '{{USER_NAME}}': authData.email?.split('@')[0] || 'User',
          '{{USER_LOCATION}}': 'Unknown',
          '{{CURRENT_DATETIME}}': vnTimeStr,
          '{{CURRENT_DATE}}': localDateStr,
          '{{CURRENT_TIME}}': localTimeOnlyStr,
          '{{CURRENT_WEEKDAY}}': weekdayStr,
          '{{CURRENT_TIMEZONE}}': 'Asia/Saigon',
          '{{USER_LANGUAGE}}': 'en-US',
        },
        chat_id: chatId,
        id: completionId,
        current_user_message_id: userMessageId,
        current_user_message_parent_id: null,
        background_tasks: { title_generation: true, tags_generation: true },
        requestId: sigRes.requestId,
        timestamp: Number(sigRes.timestamp),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Z.AI API Error ${response.status}: ${errorText}`);
      }

      if (!response.body) throw new Error('No response body');

      let buffer = '';
      for await (const chunk of response.body) {
        const chunkStr = chunk.toString();
        if (onRaw) onRaw(chunkStr);
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            onDone();
            return;
          }

          try {
            const dataJson = JSON.parse(dataStr);
            const inner = dataJson.data;
            if (inner && typeof inner === 'object') {
              const phase = inner.phase;
              const content = inner.delta_content || '';

              if (phase === 'thinking') {
                if (content && onThinking) onThinking(content);
              } else {
                if (content) onContent(content);
              }

              if (inner.done) {
                onDone();
                return;
              }
            }
          } catch (e) {}
        }
      }

      onDone();
    } catch (err: any) {
      logger.error('[Z.AI] Error:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Routes ─────────────────────────────────────────────────────────

  registerRoutes(router: Router) {
    router.get('/auth/status', (_req, res) => {
      const db = getDb();
      const zaiAccount = db
        .prepare(
          "SELECT id FROM accounts WHERE provider_id = 'z' OR provider_id = 'zai' LIMIT 1",
        )
        .get();
      res.json({ authenticated: !!zaiAccount });
    });
  }

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('glm') || m.includes('z.ai') || m.includes('glm-5');
  }
}

export default new ZAIProvider();
