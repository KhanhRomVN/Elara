/**
 * ------------------------------------------------------------------
 * Claude Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Claude AI API.
 * Hỗ trợ login qua browser (basic/google), chat completion,
 * và lấy thông tin user profile.
 *
 * Main features:
 * - login()           : Đăng nhập qua browser
 * - handleMessage()   : Gửi tin nhắn với streaming response
 * - getProfile()      : Lấy thông tin user profile
 * - isModelSupported(): Kiểm tra model có hỗ trợ không
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login/login.service';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';

// ── Claude Imports ──
import { proxyHandler } from './claude.proxy-handler';
import {
  BASE_URL,
  CLAUDE_EVENTS,
  USER_AGENT,
  GOOGLE_OAUTH_LOGIN_URL,
  API_PATHS,
} from './claude.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class ClaudeProvider implements Provider {
  name = 'Claude';
  proxyHandler = proxyHandler;
  defaultModel = 'claude-sonnet-4-5-20250929';

  // ─── Get Profile ────────────────────────────────────────────────────

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const client = new HttpClient({
        baseURL: BASE_URL,
        headers: {
          Cookie: credential,
          'User-Agent': USER_AGENT,
        },
      });
      const response = await client.get(API_PATHS.PROFILE);
      if (response.ok) {
        const data = await response.json();
        return {
          email: data.email || null,
          name: data.name,
          id: data.id,
        };
      }
      return { email: null };
    } catch (e) {
      logger.error('[Claude] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(options?: { method?: 'basic' | 'google' }) {
    const method = options?.method || 'basic';
    const loginUrl =
      method === 'google' ? GOOGLE_OAUTH_LOGIN_URL : `${BASE_URL}/login`;

    return await loginService.login({
      providerId: 'claude',
      loginUrl,
      partition: `claude-${Date.now()}`,
      cookieEvent: CLAUDE_EVENTS.LOGIN_TOKEN,
      infoEvent: CLAUDE_EVENTS.LOGIN_EMAIL,
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies) {
          const token = data.cookies;
          let email = data.email;

          if (!email) {
            const profile = await this.getProfile(token);
            email = profile.email || undefined;
          }

          if (email) {
            return { isValid: true, cookies: token, email };
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
      model,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      conversationId,
    } = options;

    const client = new HttpClient({
      baseURL: BASE_URL,
      headers: {
        Cookie: credential,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
      },
    });

    try {
      const payload: any = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        max_tokens: 4096,
      };

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const response = await client.post(API_PATHS.CHAT, payload);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      let buffer = '';
      let accumulatedContent = '';

      for await (const chunk of response.body) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') continue;

            try {
              const json = JSON.parse(data);
              if (json.type === 'content_block_delta' && json.delta?.text) {
                const content = json.delta.text;
                accumulatedContent += content;
                onContent(content);
              }
              if (json.type === 'message_stop') {
                onDone();
                return;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      onDone();
    } catch (err: any) {
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Misc ────────────────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('claude');
  }

  registerRoutes(router: Router) {
    // No additional routes
  }
}

export default new ClaudeProvider();
