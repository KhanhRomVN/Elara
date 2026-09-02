/**
 * ------------------------------------------------------------------
 * Cerebras Cloud Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Cerebras Cloud API.
 * Hỗ trợ login qua browser, chat completion, rate limiting,
 * và tự động lấy danh sách models.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser và lấy credential
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getModels()      : Lấy danh sách models từ API
 * - getProfile()     : Lấy thông tin user profile
 * - rate limiting    : Tự động giới hạn request/token theo account
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Cerebras Imports ──
import {
  BASE_URL,
  API_BASE_URL,
  CerebrasCompletionPayload,
  CerebrasUserInfo,
} from './cerebras-cloud.types';
import { CEREBRAS_EVENTS, USER_AGENT } from './cerebras-cloud.constant';
import { proxyHandler } from './cerebras-cloud.proxy-handler';
import { parseSSEStream } from './cerebras-cloud.sse-parser';
import { usageTracker } from './cerebras-cloud.rate-limiter';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CerebrasCloudProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class CerebrasCloudProvider implements Provider {
  name = 'cerebras-cloud';
  proxyHandler = proxyHandler;
  defaultModel = 'llama-3.3-70b';

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    return await loginService.captureCredentialsViaCDP({
      providerId: 'cerebras-cloud',
      loginUrl: `${BASE_URL}/`,
      partition: `cerebras-cloud-${Date.now()}`,
      cookieEvent: CEREBRAS_EVENTS.COOKIES,
      infoEvent: CEREBRAS_EVENTS.USER_INFO,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (!data.cookies) return { isValid: false };

        const hasSessionToken =
          data.cookies.includes('authjs.session-token') ||
          data.cookies.includes('__Secure-authjs.callback-url');

        if (!hasSessionToken) {
          logger.warn(
            '[CerebrasCloud] Login validation failed: no session token found',
          );
          return { isValid: false };
        }

        let email = data.email;

        if (!email) {
          const profile = await this.getProfile(data.cookies);
          email = profile.email || undefined;
        }

        if (email) {
          return { isValid: true, cookies: data.cookies, email };
        }

        return { isValid: true, cookies: data.cookies };
      },
    });
  }

  // ─── Get Profile ────────────────────────────────────────────────────

  async getProfile(credential: string): Promise<CerebrasUserInfo> {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/session`, {
        method: 'GET',
        headers: this.buildBaseHeaders(credential, BASE_URL),
      });

      if (response.ok) {
        const json = (await response.json()) as any;
        if (json?.user) {
          return {
            email: json.user.email || null,
            name: json.user.name,
            id: json.user.id,
          };
        }
        logger.warn('[CerebrasCloud] Get Profile response missing user field');
      }
      return { email: null };
    } catch (e) {
      logger.error('[CerebrasCloud] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string): Promise<any[]> {
    try {
      const apiKey = this.extractApiKey(credential);

      const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'accept-language': 'en-US,en;q=0.9',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        headers['Cookie'] = credential;
      }

      const response = await fetch(`${API_BASE_URL}/v1/models`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Cerebras Models API returned ${response.status}: ${errorText}`,
        );
        return this.getFallbackModels(`API Error ${response.status}`);
      }

      const json = (await response.json()) as any;
      const modelsData = json.data || json.models || [];

      if (!Array.isArray(modelsData)) {
        logger.warn('[CerebrasCloud] Models API returned invalid format');
        return this.getFallbackModels('Invalid API Format');
      }

      return modelsData.map((model: any) => ({
        id: model.id,
        name: model.id,
        description: model.description || '',
        max_context_length: model.context_window || model.max_tokens || 8192,
        is_thinking: false,
      }));
    } catch (e: any) {
      logger.error('Error fetching Cerebras Cloud models:', e);
      return this.getFallbackModels('Exception: ' + e.message);
    }
  }

  private getFallbackModels(debugError?: string) {
    const models: any[] = [
      {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        max_context_length: 128000,
        is_thinking: false,
      },
      {
        id: 'llama3.1-8b',
        name: 'Llama 3.1 8B',
        max_context_length: 128000,
        is_thinking: false,
      },
      {
        id: 'qwen-3-32b',
        name: 'Qwen 3 32B',
        max_context_length: 32768,
        is_thinking: false,
      },
      {
        id: 'gpt-oss-120b',
        name: 'OpenAI GPT OSS 120B',
        max_context_length: 65536,
        is_thinking: false,
      },
      {
        id: 'zai-glm-4.7',
        name: 'Z.ai GLM 4.7',
        max_context_length: 65536,
        is_thinking: true,
      },
    ];

    if (debugError) {
      models.unshift({
        id: 'debug-error',
        name: `⚠️ ${debugError}`,
        max_context_length: 0,
        is_thinking: false,
      });
    }
    return models;
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      temperature,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
    } = options;

    const selectedModel = model || this.defaultModel;
    const apiKey = this.extractApiKey(credential);
    const accountId = (options as any).accountId || credential.slice(0, 32);

    const estimatedInputTokens = messages.reduce(
      (sum, m) => sum + Math.ceil((m.content?.length || 0) / 4),
      0,
    );
    const limitError = usageTracker.checkLimit(accountId, estimatedInputTokens);
    if (limitError) {
      logger.warn(`[CerebrasCloud] Rate limit blocked: ${limitError}`);
      onError(new Error(limitError));
      return;
    }

    usageTracker.recordRequest(accountId);

    const payload: CerebrasCompletionPayload = {
      messages: messages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      model: selectedModel,
      stream: true,
      temperature: typeof temperature === 'number' ? temperature : 1,
      max_completion_tokens: 65000,
      top_p: '0.95',
      tools: [],
    };

    try {
      const headers = this.buildApiHeaders(credential, apiKey);

      const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cerebras API returned ${response.status}: ${errorText}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      let totalTokensUsed = 0;
      const wrappedOnMetadata = (meta: any) => {
        if (meta?.total_token && meta.total_token > totalTokensUsed) {
          totalTokensUsed = meta.total_token;
        }
        if (onMetadata) onMetadata(meta);
      };

      await parseSSEStream(response.body as NodeJS.ReadableStream, {
        onContent,
        onThinking,
        onMetadata: wrappedOnMetadata,
        onRaw,
      });

      if (totalTokensUsed > 0) {
        usageTracker.recordTokens(accountId, totalTokensUsed);
      }

      onDone();
    } catch (err: any) {
      logger.error('[CerebrasCloud] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private extractApiKey(credential: string): string | null {
    if (credential.trim().startsWith('csk-')) {
      return credential.trim();
    }

    if (!credential.includes('=') && !credential.includes(';')) {
      return credential.trim();
    }

    return null;
  }

  private buildApiHeaders(
    credential: string,
    apiKey: string | null,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      'sec-ch-ua':
        '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-site': 'same-site',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'accept-language': 'en-US,en;q=0.9',
      'x-stainless-lang': 'js',
      'x-stainless-runtime': 'browser:chrome',
      'x-stainless-runtime-version': '146.0.0',
      'x-stainless-package-version': '1.64.1',
      'x-stainless-os': 'Unknown',
      'x-stainless-arch': 'unknown',
      'x-stainless-retry-count': '0',
      'x-stainless-timeout': '10',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers['Cookie'] = credential;
    }

    return headers;
  }

  private buildBaseHeaders(
    credential: string,
    refererBase: string,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: '*/*',
      'User-Agent': USER_AGENT,
      Origin: refererBase,
      Referer: `${refererBase}/`,
      'sec-ch-ua':
        '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'accept-language': 'en-US,en;q=0.9',
      Cookie: credential,
    };
  }

  // ─── Routes & Misc ──────────────────────────────────────────────────

  registerRoutes(router: Router) {
    router.get('/usage', (req, res) => {
      const accountId = req.query.accountId as string;
      if (!accountId) {
        res
          .status(400)
          .json({ success: false, message: 'accountId is required' });
        return;
      }
      const summary = usageTracker.getUsageSummary(accountId);
      res.json({
        success: true,
        data: {
          accountId,
          usage: summary,
          limits: { requests: 5, tokens: 30000 },
        },
      });
    });
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return (
      m.includes('cerebras') ||
      m.includes('llama3') ||
      m.includes('llama-3') ||
      m.includes('qwen-3') ||
      m.includes('gpt-oss') ||
      m.includes('zai-glm') ||
      m.includes('csk-')
    );
  }
}

export default new CerebrasCloudProvider();
