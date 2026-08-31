/**
 * ------------------------------------------------------------------
 * Mistral Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Mistral AI API.
 * Hỗ trợ login qua browser và chat completion với streaming.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getProfile()     : Lấy thông tin user profile
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
import { loginService } from '../../services/login/login.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Mistral Imports ──
import { proxyHandler } from './mistral.proxy-handler';

// ─── Constants ──────────────────────────────────────────────────────────
export const BASE_URL = 'https://console.mistral.ai';

const logger = createLogger('MistralProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class MistralProvider implements Provider {
  name = 'Mistral';
  proxyHandler = proxyHandler;
  defaultModel = 'mistral-large-latest';

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    logger.info('Starting Mistral login...');

    return await loginService.login({
      providerId: 'mistral',
      loginUrl: 'https://auth.mistral.ai/ui/login',
      partition: `mistral-${Date.now()}`,
      cookieEvent: 'mistral-cookies',
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies && data.cookies.length > 0) {
          const profile = await this.getProfile(data.cookies);
          if (profile.email) {
            logger.info(
              `[Mistral] Validation success for email: ${profile.email}`,
            );
            return {
              isValid: true,
              email: profile.email,
              cookies: data.cookies,
            };
          }
        }
        return { isValid: false };
      },
    });
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const response = await fetch('https://console.mistral.ai/api/users/me', {
        method: 'GET',
        headers: {
          Cookie: credential,
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          accept: 'application/json',
        },
      });

      if (response.status === 200) {
        const json = await response.json();
        return {
          email: json.email || null,
          name: json.name || json.full_name,
          id: json.id,
        };
      }
      return { email: null };
    } catch (e) {
      logger.error('[Mistral] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      onContent,
      onMetadata,
      onDone,
      onError,
      conversationId,
    } = options;

    try {
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage.content;

      if (!conversationId) {
        await this.streamMistral(
          credential,
          conversationId!,
          'start',
          null,
          onContent,
          onDone,
          onError,
        );
      } else {
        await this.streamMistral(
          credential,
          conversationId!,
          'append',
          content,
          onContent,
          onDone,
          onError,
        );
      }
    } catch (error) {
      logger.error('Error sending Mistral message', error);
      onError(error);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Stream Helper ──────────────────────────────────────────────────

  private async streamMistral(
    credential: string,
    chatId: string,
    mode: 'start' | 'append',
    content: string | null,
    onContent: (c: string) => void,
    onDone: () => void,
    onError: (e: any) => void,
  ) {
    const payload: any = {
      chatId: chatId,
      mode: mode,
      disabledFeatures: [],
      clientPromptData: {
        currentDate: new Date().toISOString().split('T')[0],
        userTimezone: 'Asia/Saigon',
      },
      stableAnonymousIdentifier: '79zqlm',
      shouldAwaitStreamBackgroundTasks: true,
      shouldUseMessagePatch: true,
      shouldUsePersistentStream: true,
    };

    if (mode === 'append' && content) {
      payload.messageInput = [{ type: 'text', text: content }];
      payload.messageFiles = [];
      payload.messageId = crypto.randomUUID();
      payload.features = [
        'beta-code-interpreter',
        'beta-imagegen',
        'beta-websearch',
        'beta-reasoning',
      ];
      payload.libraries = [];
      payload.integrations = [];
    }

    const response = await fetch('https://chat.mistral.ai/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Cookie: credential,
        Origin: 'https://chat.mistral.ai',
        Referer: `https://chat.mistral.ai/chat/${chatId}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok)
      throw new Error(`Mistral Stream Error ${response.status}`);

    if (response.body) {
      const body = response.body as any;
      body.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const colonIndex = line.indexOf(':');
          if (colonIndex === -1) continue;
          try {
            const jsonStr = line.slice(colonIndex + 1);
            const data = JSON.parse(jsonStr);
            if (data?.json?.patches) {
              for (const patch of data.json.patches) {
                if (
                  (patch.op === 'append' || patch.op === 'add') &&
                  patch.path.includes('/text') &&
                  patch.value
                ) {
                  onContent(patch.value);
                } else if (
                  patch.value &&
                  typeof patch.value === 'string' &&
                  patch.path.endsWith('/text')
                ) {
                  onContent(patch.value);
                }
              }
            }
          } catch (e) {}
        }
      });
      body.on('end', () => onDone());
      body.on('error', onError);
    } else {
      onDone();
    }
  }

  // ─── Routes ─────────────────────────────────────────────────────────

  registerRoutes() {}

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    return model.toLowerCase().includes('mistral');
  }
}

export default new MistralProvider();