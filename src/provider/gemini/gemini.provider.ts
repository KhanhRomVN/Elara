/**
 * ------------------------------------------------------------------
 * Gemini Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Google Gemini Web API.
 * Hỗ trợ login qua browser, chat completion với nhiều mode
 * (flash, thinking, pro, auto), và tự động lấy XSRF token.
 *
 * Main features:
 * - login()          : Đăng nhập qua browser và capture cookies
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getProfile()     : Lấy thông tin user profile từ HTML
 * - XSRF retry       : Tự động retry với XSRF token từ error response
 * - Model mapping    : Hỗ trợ các mode: FAST, THINKING, PRO, AUTO
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
import { proxyEvents } from '../../services/proxy.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';
import { countTokens, countMessagesTokens } from '../../utils/tokenizer';

// ── Gemini Imports ──
import { GeminiCredential } from './gemini.types';
import { MODEL_MAP } from './gemini.constants';
import { proxyHandler } from './gemini.proxy-handler';
import {
  makeSapisidHash,
  getAccountPrefix,
  buildRequestBody,
  getStreamGenerateUrl,
  extractTextsFromLine,
  cleanText,
} from './gemini.helpers';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class GeminiProvider implements Provider {
  name = 'gemini';
  proxyHandler = proxyHandler;
  defaultModel = 'gemini-3.5-flash';

  // ─── Profile ─────────────────────────────────────────────────────────

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const cred = this.parseCredential(credential);
      const prefix = getAccountPrefix(cred.authUser);
      const url = `https://gemini.google.com${prefix}/app`;
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      };
      if (cred.cookie) {
        headers['Cookie'] = cred.cookie;
      }
      if (cred.sapisid) {
        headers['Authorization'] = makeSapisidHash(cred.sapisid);
      }
      if (cred.authUser) {
        headers['X-Goog-AuthUser'] = cred.authUser;
      }

      const response = await fetch(url, { method: 'GET', headers });

      if (response.ok) {
        const html = await response.text();
        const emailMatch =
          html.match(/"email"\s*:\s*"([^"]+@[^"]+)"/) ||
          html.match(/userEmail["']?\s*:\s*["']([^"']+)["']/);
        if (emailMatch && emailMatch[1]) {
          return { email: emailMatch[1] };
        }
      }

      if (cred.email) {
        return { email: cred.email };
      }

      return { email: null };
    } catch (e) {
      logger.error('[Gemini] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(options?: { method?: 'google' | 'basic' }) {
    const method = options?.method || 'google';
    const loginUrl = 'https://gemini.google.com/app';

    logger.info(`Starting Gemini login with method: ${method}`);

    let validating = false;
    const captured = { xsrfToken: '', authUser: '' };
    const onXsrf = (data: any) => {
      if (data?.xsrfToken) captured.xsrfToken = data.xsrfToken;
    };
    const onAuthUser = (data: any) => {
      if (data?.authUser) captured.authUser = data.authUser;
    };
    proxyEvents.on('gemini-xsrf', onXsrf);
    proxyEvents.on('gemini-auth-user', onAuthUser);

    return await loginService
      .login({
        providerId: 'gemini',
        loginUrl,
        partition: `gemini-${Date.now()}`,
        cookieEvent: 'gemini-cookies',
        infoEvent: 'gemini-email',
        extraEvents: ['gemini-sapisid', 'gemini-auth-user', 'gemini-xsrf'],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          if (validating) return { isValid: false };
          validating = true;

          try {
            logger.info('[Gemini] Validating captured cookies');
            const cookie = data.cookies;
            let email = data.email;

            const sapisidMatch = cookie.match(/SAPISID=([^;]+)/);
            const sapisid = sapisidMatch ? sapisidMatch[1] : '';

            if (!email) {
              logger.info(
                '[Gemini] Email not captured directly, fetching profile...',
              );
              try {
                const credStr = JSON.stringify({ cookie, sapisid });
                const profile = await this.getProfile(credStr);
                email = profile.email || undefined;
              } catch {
                // Profile fetch failed — proceed without email
              }
            }

            if (!captured.xsrfToken) {
              logger.debug(
                '[Gemini] XSRF missing, waiting 1.5s for xsrf event...',
              );
              await new Promise((r) => setTimeout(r, 1500));
            }

            const hasSID =
              cookie.includes('SID=') && cookie.includes('__Secure-1PSID=');
            if (hasSID) {
              const credential = JSON.stringify({
                cookie,
                sapisid,
                xsrfToken: captured.xsrfToken,
                authUser: captured.authUser,
                email: email || '',
              });
              logger.info(
                `[Gemini] Login accepted${email ? ` | email=${email}` : ' | email=unknown'}${captured.xsrfToken ? ' | xsrf=yes' : ' | xsrf=missing'}`,
              );
              return {
                isValid: true,
                cookies: credential,
                email: email || null,
              };
            }

            return { isValid: false };
          } finally {
            validating = false;
          }
        },
      })
      .finally(() => {
        proxyEvents.off('gemini-xsrf', onXsrf);
        proxyEvents.off('gemini-auth-user', onAuthUser);
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
      onRaw,
    } = options;

    const cred = this.parseCredential(credential);
    const modelConfig = this.resolveModel(model);

    try {
      const promptParts: string[] = [];
      for (const msg of messages) {
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? (msg.content as any[])
                  .filter(
                    (c: any) => c.type === 'text' || c.type === 'input_text',
                  )
                  .map((c: any) => c.text || '')
                  .join(' ')
              : '';

        if (msg.role === 'system') {
          promptParts.push(`[System Instructions:] ${content}`);
        } else if (msg.role === 'assistant') {
          promptParts.push(`[Assistant]: ${content}`);
        } else if (msg.role === 'user') {
          promptParts.push(content);
        }
      }
      const prompt = promptParts.filter(Boolean).join('\n\n');
      if (!prompt.trim()) {
        throw new Error('No messages to send');
      }

      const buildHeaders = (c: typeof cred): Record<string, string> => {
        const h: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://gemini.google.com',
          Referer: `https://gemini.google.com${getAccountPrefix(c.authUser)}/app`,
          'X-Same-Domain': '1',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        };
        if (c.authUser) h['X-Goog-AuthUser'] = c.authUser;
        if (c.cookie) h['Cookie'] = c.cookie;
        if (c.sapisid) h['Authorization'] = makeSapisidHash(c.sapisid);
        return h;
      };

      let currentCred = cred;
      let attempt = 0;

      while (attempt < 2) {
        attempt++;
        const url = getStreamGenerateUrl(currentCred.authUser);
        const body = buildRequestBody(
          prompt,
          modelConfig.mode,
          modelConfig.think,
          currentCred.xsrfToken,
        );
        const headers = buildHeaders(currentCred);

        logger.info(
          `[Gemini] Sending request | attempt=${attempt} | model=${model}`,
        );

        const response = await fetch(url, { method: 'POST', headers, body });

        if (!response.ok) {
          const errorText = await response.text();

          const xsrfFromError = errorText.match(/"xsrf","([^"]+)"/)?.[1];
          if (xsrfFromError && attempt === 1) {
            logger.info(
              `[Gemini] Got XSRF from error response, retrying`,
            );
            currentCred = { ...currentCred, xsrfToken: xsrfFromError };
            continue;
          }

          throw new Error(
            `Gemini API returned ${response.status}: ${errorText.slice(0, 500)}`,
          );
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const promptTokens = countMessagesTokens(messages);
        const completionTokensRef = { value: 0 };
        let prevText = '';
        let buffer = '';
        let totalBytes = 0;

        for await (const chunk of response.body as NodeJS.ReadableStream) {
          const chunkStr = chunk.toString();
          totalBytes += chunkStr.length;
          if (onRaw) onRaw(chunkStr);
          buffer += chunkStr;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const texts = extractTextsFromLine(line);
            for (const t of texts) {
              if (t.length > prevText.length) {
                const delta = cleanText(t.slice(prevText.length));
                if (delta) {
                  completionTokensRef.value += countTokens(delta);
                  onContent(delta);
                  if (onMetadata) {
                    onMetadata({
                      total_token: promptTokens + completionTokensRef.value,
                    });
                  }
                }
                prevText = t;
              }
            }
          }
        }

        if (buffer.trim()) {
          const texts = extractTextsFromLine(buffer);
          for (const t of texts) {
            if (t.length > prevText.length) {
              const delta = cleanText(t.slice(prevText.length));
              if (delta) {
                completionTokensRef.value += countTokens(delta);
                onContent(delta);
              }
              prevText = t;
            }
          }
        }

        logger.debug(
          `[Gemini] Stream complete | model=${model} | totalBytes=${totalBytes}`,
        );

        onDone();
        return;
      }
    } catch (err: any) {
      logger.error('[Gemini] handleMessage error:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Utility Methods ─────────────────────────────────────────────────

  private parseCredential(credential: string): GeminiCredential {
    try {
      const parsed = JSON.parse(credential);
      return {
        cookie: parsed.cookie || parsed.cookies || credential,
        sapisid: parsed.sapisid || '',
        authUser: parsed.authUser || parsed.auth_user || '',
        xsrfToken: parsed.xsrfToken || parsed.xsrf_token || '',
        email: parsed.email || '',
      };
    } catch {
      const sapisidMatch = credential.match(/SAPISID=([^;]+)/);
      return {
        cookie: credential,
        sapisid: sapisidMatch ? sapisidMatch[1] : '',
      };
    }
  }

  private resolveModel(modelName: string): { mode: number; think: number } {
    let name = modelName.trim().toLowerCase();
    let thinkOverride: number | null = null;

    const thinkMatch = name.match(/@think=(\d+)$/);
    if (thinkMatch) {
      thinkOverride = parseInt(thinkMatch[1], 10);
      name = name.replace(/@think=\d+$/, '').trim();
    }

    const config = MODEL_MAP[name];
    if (!config) {
      logger.warn(
        `[Gemini] Unknown model "${modelName}", falling back to flash`,
      );
      return { mode: 1, think: 4 };
    }

    return {
      mode: config.mode,
      think: thinkOverride !== null ? thinkOverride : config.think,
    };
  }

  async stopStream(_credential: string, _chatId: string, _messageId: string) {
    logger.debug('[Gemini] stopStream called (no-op for Gemini Web)');
  }

  // ─── Routes ─────────────────────────────────────────────────────────

  registerRoutes(router: Router) {
    router.post('/files', async (_req, res) => {
      res.json({ error: 'File upload not supported for Gemini Web provider' });
    });
  }

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('gemini') || m.startsWith('gemini-');
  }
}

export default new GeminiProvider();