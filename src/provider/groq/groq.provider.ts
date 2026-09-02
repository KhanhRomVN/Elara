/**
 * ------------------------------------------------------------------
 * Groq Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Groq API.
 * Hỗ trợ login qua browser, chat completion với streaming,
 * và lấy danh sách models từ API.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser và capture cookie
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getModels()      : Lấy danh sách models từ API
 * - getProfile()     : Lấy email từ JWT trong cookie
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

// ── Groq Imports ──
import { proxyHandler } from './groq.proxy-handler';
import {
  BASE_URL,
  API_CHAT_COMPLETIONS_URL,
  API_MODELS_URL,
  SESSION_COOKIE_NAME,
  GROQ_EVENTS,
} from './groq.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GroqProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class GroqProvider implements Provider {
  name = 'Groq';
  proxyHandler = proxyHandler;
  defaultModel = 'llama-3.3-70b-versatile';

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    return await loginService.captureCredentialsViaCDP({
      providerId: 'groq',
      loginUrl: `${BASE_URL}/login`,
      partition: `groq-${Date.now()}`,
      cookieEvent: GROQ_EVENTS.COOKIES,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (!data.cookies) return { isValid: false };

        let email: string | null = null;
        try {
          const cookieList = data.cookies.split(';').map((c) => {
            const parts = c.trim().split('=');
            return { name: parts[0], value: parts.slice(1).join('=') };
          });

          const sessionJwt = cookieList.find(
            (c) => c.name === SESSION_COOKIE_NAME,
          )?.value;
          if (sessionJwt) {
            const base64Url = sessionJwt.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map(
                  (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
                )
                .join(''),
            );
            const payload = JSON.parse(jsonPayload);
            const stytchSession = payload['https://stytch.com/session'];
            if (
              stytchSession?.authentication_factors?.[0]?.email_factor
                ?.email_address
            ) {
              email =
                stytchSession.authentication_factors[0].email_factor
                  .email_address;
            }
          }
        } catch (e) {
          logger.warn('[Groq] Failed to extract email from JWT:', e);
        }

        return { isValid: true, cookies: data.cookies, email };
      },
    });
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    let email: string | null = null;
    try {
      const cookieList = credential.split(';').map((c) => {
        const parts = c.trim().split('=');
        return { name: parts[0], value: parts.slice(1).join('=') };
      });

      const sessionJwt = cookieList.find(
        (c) => c.name === SESSION_COOKIE_NAME,
      )?.value;
      if (sessionJwt) {
        const base64Url = sessionJwt.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join(''),
        );
        const payload = JSON.parse(jsonPayload);
        const stytchSession = payload['https://stytch.com/session'];
        if (
          stytchSession?.authentication_factors?.[0]?.email_factor
            ?.email_address
        ) {
          email =
            stytchSession.authentication_factors[0].email_factor.email_address;
        }
      }
      if (!email) {
        logger.warn('[Groq] Get Profile: no email found in session JWT');
      }
      return { email };
    } catch (e) {
      logger.error('[Groq] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      temperature,
      onContent,
      onDone,
      onError,
    } = options;

    const payload: any = {
      model: model || this.defaultModel,
      messages: messages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      })),
      stream: true,
    };

    if (typeof temperature === 'number') {
      payload.temperature = temperature;
    }

    try {
      const response = await fetch(API_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Cookie: credential,
          'Content-Type': 'application/json',
          Origin: BASE_URL,
          Referer: `${BASE_URL}/`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Public API failed with cookies: ${response.status}`);
        throw new Error(`Groq API returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      let buffer = '';
      for await (const chunk of response.body) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmedLine.substring(6));
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) {
                onContent(delta.content);
              }
            } catch (e) {
              logger.warn('[Groq] Failed to parse SSE line:', e);
            }
          }
        }
      }

      onDone();
    } catch (err: any) {
      logger.error('Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Get Models ─────���───────────────────────────────────────────────

  async getModels(credential: string): Promise<any[]> {
    try {
      let token = '';
      const match = credential.match(
        new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`),
      );
      if (match && match[1]) {
        token = match[1];
      }

      if (!token && !credential.includes('=')) {
        token = credential;
      }

      if (!token) {
        logger.warn('No session token found in credentials for Groq');
        return this.getFallbackModels('No Token Found');
      }

      let organization = '';
      const preferencesMatch = credential.match(
        /(?:^|;\s*)user-preferences=([^;]+)/,
      );
      if (preferencesMatch && preferencesMatch[1]) {
        try {
          const preferences = JSON.parse(
            decodeURIComponent(preferencesMatch[1]),
          );
          organization = preferences['current-org'];
        } catch (e) {
          logger.warn('Failed to parse user-preferences from cookie', e);
        }
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Cookie: credential,
        'Content-Type': 'application/json',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      };

      if (organization) {
        headers['groq-organization'] = organization;
      }

      const response = await fetch(API_MODELS_URL, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Groq Models API returned ${response.status}: ${errorText}`,
        );
        return this.getFallbackModels(`API Error ${response.status}`);
      }

      const json = await response.json();
      const modelsData = json.data || [];

      if (!Array.isArray(modelsData)) {
        logger.warn('[Groq] Models API returned invalid format');
        return this.getFallbackModels('Invalid API Format');
      }

      return modelsData
        .filter((model: any) => model.active !== false)
        .map((model: any) => ({
          id: model.id,
          name: model.metadata?.display_name || model.id,
          description: model.metadata?.model_card,
          max_context_length: model.context_window,
          is_thinking: model.features?.reasoning === true,
        }));
    } catch (e: any) {
      logger.error('Error fetching Groq models:', e);
      return this.getFallbackModels('Exception: ' + e.message);
    }
  }

  private getFallbackModels(debugError?: string) {
    const models: any[] = [];
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

  // ─── Routes ─────────────────────────────────────────────────────────

  registerRoutes(_router: Router) {}

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('groq') || m.includes('llama') || m.includes('mixtral');
  }
}

export default new GroqProvider();
