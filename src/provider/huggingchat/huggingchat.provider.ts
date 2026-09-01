/**
 * ------------------------------------------------------------------
 * HuggingChat Provider
 * ------------------------------------------------------------------
 * Provider implementation cho HuggingChat (Hugging Face).
 * Hỗ trợ login qua browser, chat completion với streaming,
 * thinking mode, và lấy danh sách models từ API.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser và capture cookies
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getModels()      : Lấy danh sách models từ API
 * - getProfile()     : Lấy thông tin user profile
 * - Thinking mode    : Hỗ trợ <think> tags trong response
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';
import { countTokens, countMessagesTokens } from '../../utils/tokenizer';

// ── HuggingChat Imports ──
import { proxyHandler } from './huggingchat.proxy-handler';
import {
  BASE_URL,
  HUGGINGCHAT_EVENTS,
  USER_AGENT,
} from './huggingchat.constant';

// ─── Constants ─────────────────────────────────────────��────────────────
const logger = createLogger('HuggingChatProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class HuggingChatProvider implements Provider {
  name = 'HuggingChat';
  proxyHandler = proxyHandler;
  defaultModel = 'omni';

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    let capturedEmail = '';

    const onLoginData = (email: string) => {
      capturedEmail = email;
    };

    proxyEvents.on(HUGGINGCHAT_EVENTS.LOGIN_DATA, onLoginData);

    try {
      return await loginService.captureCredentialsViaCDP({
        providerId: 'huggingchat',
        loginUrl: `${BASE_URL}/chat/login`,
        partition: `huggingchat-${Date.now()}`,
        cookieEvent: HUGGINGCHAT_EVENTS.COOKIES,
        infoEvent: HUGGINGCHAT_EVENTS.LOGIN_DATA,
        extraEvents: [HUGGINGCHAT_EVENTS.LOGIN_DATA],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          let identityEmail = '';
          let apiEmail = '';

          try {
            const profile = await this.getProfile(data.cookies);
            if (profile.email) {
              apiEmail = profile.email;
            }
          } catch (e) {
            logger.warn('[HuggingChat] Chat API verify failed:', e);
          }

          if (capturedEmail) {
            identityEmail = capturedEmail;
          } else if (apiEmail) {
            identityEmail = apiEmail;
          }

          if (identityEmail) {
            return {
              isValid: true,
              cookies: data.cookies,
              email: identityEmail,
            };
          }
          logger.warn(
            '[HuggingChat] Login validation failed: could not determine email',
          );
          return { isValid: false };
        },
      });
    } finally {
      proxyEvents.off(HUGGINGCHAT_EVENTS.LOGIN_DATA, onLoginData);
    }
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const response = await fetch(`${BASE_URL}/chat/api/v2/user`, {
        headers: {
          Cookie: credential,
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          accept: 'application/json',
        },
      });

      if (response.ok) {
        const chatUser = await response.json();
        if (!chatUser.email && !chatUser.username) {
          logger.warn(
            '[HuggingChat] Get Profile response missing email/username',
          );
        }
        return {
          email:
            chatUser.email ||
            (chatUser.username ? `${chatUser.username}@hf.co` : null),
          name: chatUser.username || chatUser.name,
          id: chatUser.id || chatUser._id,
        };
      }
      logger.warn(
        `[HuggingChat] Get Profile returned status ${response.status}`,
      );
      return { email: null };
    } catch (e) {
      logger.error('[HuggingChat] Get Profile Error:', e);
      return { email: null };
    }
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
    } = options;

    const cookieHeader = credential;
    const client = this.createClient(cookieHeader);

    try {
      let conversationId = options.conversationId;
      if (!conversationId) {
        const createRes = await client.post('/chat/conversation', {
          model: model || this.defaultModel,
          preprompt: '',
        });
        const createData = await createRes.json();
        conversationId = createData.conversationId;
      }

      if (!conversationId) throw new Error('Failed to obtain conversation ID');

      const detailRes = await client.get(
        `/chat/api/v2/conversations/${conversationId}`,
      );
      const detail = await detailRes.json();
      const details = detail.json || detail;

      let parentMessageId = '';
      if (details.messages && details.messages.length > 0) {
        parentMessageId = details.messages[details.messages.length - 1].id;
      } else if (details.rootMessageId) {
        parentMessageId = details.rootMessageId;
      } else {
        parentMessageId = crypto.randomUUID();
      }

      const lastMessage = messages[messages.length - 1];
      const boundary =
        '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');

      const payload = {
        inputs: lastMessage.content,
        id: parentMessageId,
        is_retry: false,
        is_continue: false,
        selectedMcpServerNames: [],
        selectedMcpServers: [],
      };

      const formData = `--${boundary}\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--\r\n`;
      const formBuffer = Buffer.from(formData, 'utf-8');

      const response = await fetch(
        `${BASE_URL}/chat/conversation/${conversationId}`,
        {
          method: 'POST',
          headers: {
            Cookie: cookieHeader,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'User-Agent': USER_AGENT,
            Origin: BASE_URL,
            Referer: `${BASE_URL}/chat/conversation/${conversationId}`,
          },
          body: formBuffer,
        },
      );

      if (!response.ok)
        throw new Error(`HuggingChat API Error ${response.status}`);

      const promptTokens = countMessagesTokens(messages);
      let completionTokens = 0;

      if (onMetadata)
        onMetadata({
          conversation_id: conversationId,
          total_token: promptTokens,
        });

      if (!response.body) throw new Error('No response body');

      let buffer = '';
      let isThinking = false;

      for await (const chunk of response.body as any) {
        const chunkStr = chunk.toString().replace(/\\u0000/g, '');
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.type === 'stream' && json.token) {
              const token = json.token;
              completionTokens += countTokens(token);

              if (token.includes('<think>')) {
                isThinking = true;
                const [before, after] = token.split('<think>');
                if (before) onContent(before);
                if (after && onThinking) onThinking(after);
                else if (after) onContent(after);
              } else if (token.includes('</think>')) {
                isThinking = false;
                const [before, after] = token.split('</think>');
                if (before && onThinking) onThinking(before);
                else if (before) onContent(before);
                if (after) onContent(after);
              } else {
                if (isThinking && onThinking) onThinking(token);
                else onContent(token);
              }

              if (onMetadata)
                onMetadata({ total_token: promptTokens + completionTokens });
            } else if (json.type === 'title' && json.title && onMetadata) {
              onMetadata({ conversation_title: json.title });
            }
          } catch (e) {
            logger.warn('[HuggingChat] Failed to parse SSE line:', e);
          }
        }
      }
      onDone();
    } catch (err: any) {
      logger.error('[HuggingChat] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string): Promise<any[]> {
    try {
      const client = this.createClient(credential);
      const res = await client.get('/chat/api/v2/models');
      const data = await res.json();
      const modelsList = data.json || data.models || data || [];

      return modelsList.map((model: any) => {
        let contextLength: number | null = null;
        if (model.providers && Array.isArray(model.providers)) {
          for (const provider of model.providers) {
            if (provider.context_length) {
              contextLength = provider.context_length;
              break;
            }
          }
        }
        return {
          id: model.id,
          name: model.displayName || model.name || model.id,
          is_thinking: false,
          max_context_length: contextLength,
        };
      });
    } catch (error) {
      logger.error('Error fetching models from HuggingChat API:', error);
      return [];
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private createClient(cookie: string) {
    return new HttpClient({
      baseURL: BASE_URL,
      headers: {
        Cookie: cookie,
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });
  }

  // ─── Routes ─────────────────────────────────────────────────────────

  registerRoutes(_router: Router) {}

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return (m.includes('/') && !m.includes(':free')) || m === 'omni';
  }
}

export default new HuggingChatProvider();
