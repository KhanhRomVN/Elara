/**
 * ------------------------------------------------------------------
 * Gemini CLI Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Gemini CLI (Google Cloud Gemini).
 * Hỗ trợ login qua terminal OAuth flow, refresh token,
 * và chat completion với streaming response.
 *
 * Main features:
 * - login()          : Đăng nhập qua terminal OAuth
 * - refreshToken()   : Refresh access token
 * - fetchProjectId() : Lấy project ID từ API
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getModels()      : Lấy danh sách models từ quota API
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';
import { proxyService } from '../../services/proxy.service';

// ── Database ──
import { getDb } from '../../database';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Gemini CLI Imports ──
import { proxyHandler } from './gemini-cli.proxy-handler';
import {
  GEMINI_CLI_EVENTS,
  CLOUDCODE_LOAD_CODE_ASSIST_URL,
  CLOUDCODE_STREAM_GENERATE_URL,
  CLOUDCODE_RETRIEVE_QUOTA_URL,
  USER_AGENT,
  X_GOOG_API_CLIENT,
  CLIENT_METADATA,
  DEFAULT_PROJECT_ID,
} from './gemini-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiCLIProvider');

export const GEMINI_CONFIG = {
  clientId: process.env.GEMINI_CLIENT_ID || '',
  clientSecret: process.env.GEMINI_CLIENT_SECRET || '',
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

// ─── Provider Class ────────────────────────────────────────────────────

export class GeminiCLIProvider implements Provider {
  name = 'gemini-cli';
  proxyHandler = proxyHandler;
  defaultModel = 'gemini-1.5-pro';

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    const tempHome = path.join(os.tmpdir(), `gemini-login-fresh-${Date.now()}`);
    fs.mkdirSync(tempHome, { recursive: true });

    await proxyService.start();
    const { port } = proxyService.getServerInfo();
    const proxyUrl = `http://127.0.0.1:${port}`;
    const logFile = path.join(tempHome, 'gemini-cli.log');

    const terminals = [
      'gnome-terminal',
      'konsole',
      'xfce4-terminal',
      'kitty',
      'alacritty',
      'xterm',
      'x-terminal-emulator',
    ];
    let terminal = '';
    for (const t of terminals) {
      try {
        execSync(`which ${t}`, { stdio: 'ignore' });
        terminal = t;
        break;
      } catch (e) {}
    }

    if (!terminal) {
      logger.warn(
        '[GeminiCLI] No supported terminal emulator found, falling back to bash',
      );
    }

    const envStr = `export http_proxy=${proxyUrl} https_proxy=${proxyUrl} HTTP_PROXY=${proxyUrl} HTTPS_PROXY=${proxyUrl} all_proxy=${proxyUrl} ALL_PROXY=${proxyUrl} no_proxy='localhost,127.0.0.1' NO_PROXY='localhost,127.0.0.1' HOME=${tempHome} USERPROFILE=${tempHome} NODE_TLS_REJECT_UNAUTHORIZED=0 GOOGLE_GENAI_USE_GCA=true NO_BROWSER=true;`;
    const commandStr = `${envStr} gemini 2>&1 | tee ${logFile}`;

    const env = {
      ...process.env,
      HOME: tempHome,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      GOOGLE_GENAI_USE_GCA: 'true',
      NO_BROWSER: 'true',
    };

    let terminalSpawn: any;
    if (terminal === 'gnome-terminal') {
      terminalSpawn = spawn(
        terminal,
        [
          '--',
          'bash',
          '-c',
          `${commandStr}; echo ''; echo 'Press enter to close...'; read`,
        ],
        { detached: true, env, stdio: 'ignore' },
      );
    } else if (terminal) {
      terminalSpawn = spawn(terminal, ['-e', `bash -c "${commandStr}; read"`], {
        detached: true,
        env,
        stdio: 'ignore',
      });
    } else {
      terminalSpawn = spawn('bash', ['-c', commandStr], {
        env,
        detached: true,
        stdio: 'ignore',
      });
    }

    return new Promise((resolve, reject) => {
      let capturedUrl = '';
      const checkInterval = setInterval(() => {
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');
          const urlMatch = content.match(
            /https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?[^\s"']+/,
          );
          if (urlMatch && !capturedUrl) {
            capturedUrl = urlMatch[0];
            clearInterval(checkInterval);

            loginService
              .captureCredentialsViaCDP({
                providerId: 'gemini-cli',
                loginUrl: capturedUrl,
                partition: `gemini-cli-${Date.now()}`,
                skipProxy: true,
                extraEvents: [
                  GEMINI_CLI_EVENTS.TOKENS,
                  GEMINI_CLI_EVENTS.USER_INFO,
                ],
                validate: async (captured) => {
                  if (captured.cookies || captured.headers) {
                    try {
                      const tokens = captured.cookies
                        ? JSON.parse(captured.cookies)
                        : {};
                      const projectId = captured.headers?.projectId || '';
                      const email =
                        captured.email || captured.headers?.email || null;

                      if (tokens.access_token && projectId) {
                        return {
                          isValid: true,
                          cookies: JSON.stringify({
                            accessToken: tokens.access_token,
                            refreshToken: tokens.refresh_token,
                            expiresIn: tokens.expires_in,
                            projectId: projectId,
                          }),
                          email: email,
                        };
                      }
                    } catch (e) {
                      logger.warn(
                        '[GeminiCLI] Failed to parse captured tokens:',
                        e,
                      );
                    }
                  }
                  return { isValid: false };
                },
              })
              .then((result) => {
                try {
                  fs.rmSync(tempHome, { recursive: true, force: true });
                } catch (e) {
                  logger.warn('[GeminiCLI] Failed to clean up temp home:', e);
                }
                resolve(result);
              })
              .catch(reject);
          }
        }
      }, 1000);

      terminalSpawn.on('error', (err: Error) => {
        clearInterval(checkInterval);
        reject(err);
      });

      setTimeout(() => {
        if (!capturedUrl) {
          clearInterval(checkInterval);
          logger.error('[GeminiCLI] Login timed out waiting for OAuth URL');
          reject(new Error('Timed out waiting for Gemini CLI login URL'));
        }
      }, 60000);
    });
  }

  // ─── Refresh Token ──────────────────────────────────────────────────

  async refreshToken(refreshTokenStr: string) {
    const response = await fetch(GEMINI_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: GEMINI_CONFIG.clientId,
        client_secret: GEMINI_CONFIG.clientSecret,
        refresh_token: refreshTokenStr,
      }),
    });
    if (!response.ok) {
      logger.error(
        `[GeminiCLI] Token refresh failed with status ${response.status}`,
      );
      throw new Error('Failed to refresh Gemini CLI token');
    }
    return await response.json();
  }

  // ─── Fetch Project ID ──────────────────────────────────────────────

  async fetchProjectId(accessToken: string): Promise<string> {
    const response = await fetch(CLOUDCODE_LOAD_CODE_ASSIST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-Goog-Api-Client': X_GOOG_API_CLIENT,
      },
      body: JSON.stringify({ metadata: CLIENT_METADATA, mode: 1 }),
    });
    if (!response.ok) {
      logger.warn(
        `[GeminiCLI] fetchProjectId returned status ${response.status}`,
      );
      return '';
    }
    const data = await response.json();
    if (data.cloudaicompanionProject) {
      return typeof data.cloudaicompanionProject === 'string'
        ? data.cloudaicompanionProject.trim()
        : data.cloudaicompanionProject.id?.trim() || '';
    }
    logger.warn(
      '[GeminiCLI] fetchProjectId response missing cloudaicompanionProject',
    );
    return '';
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      stream,
      onContent,
      onDone,
      onError,
      accountId,
    } = options;

    let tokens: any;
    try {
      tokens = JSON.parse(credential);
    } catch (e) {
      logger.warn(
        '[GeminiCLI] Credential is not valid JSON, treating as raw access token',
      );
      tokens = { accessToken: credential };
    }

    if (!tokens.projectId && tokens.accessToken) {
      try {
        tokens.projectId = await this.fetchProjectId(tokens.accessToken);
      } catch (e) {
        logger.warn('[GeminiCLI] Failed to fetch project ID:', e);
      }
    }

    const url = CLOUDCODE_STREAM_GENERATE_URL;

    const sendRequest = async (token: string, projectId?: string) => {
      const sessionId = Math.random().toString(36).substring(2, 15);
      const userPromptId = `${sessionId}########1`;
      const body: any = {
        model: model || this.defaultModel,
        project: projectId || DEFAULT_PROJECT_ID,
        user_prompt_id: userPromptId,
        request: {
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : m.role,
            parts: [{ text: m.content }],
          })),
        },
      };

      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': USER_AGENT,
          'X-Goog-Api-Client': X_GOOG_API_CLIENT,
        },
        body: JSON.stringify(body),
      });
    };

    try {
      let response = await sendRequest(tokens.accessToken, tokens.projectId);

      if (response.status === 401 && tokens.refreshToken) {
        try {
          const newTokens = await this.refreshToken(tokens.refreshToken);
          tokens.accessToken = newTokens.access_token;
          tokens.refreshToken = newTokens.refresh_token || tokens.refreshToken;

          if (!tokens.projectId)
            tokens.projectId = await this.fetchProjectId(tokens.accessToken);

          if (accountId) {
            try {
              const db = getDb();
              db.prepare('UPDATE accounts SET credential = ? WHERE id = ?').run(
                JSON.stringify(tokens),
                accountId,
              );
            } catch (dbError) {
              logger.error(
                '[GeminiCLI] Failed to persist refreshed token to DB:',
                dbError,
              );
            }
          }
          response = await sendRequest(tokens.accessToken, tokens.projectId);
        } catch (refreshError) {
          logger.error('[GeminiCLI] Token refresh failed:', refreshError);
        }
      }

      if (!response.ok)
        throw new Error(
          `Gemini CLI API Error ${response.status}: ${await response.text()}`,
        );

      if (stream !== false) {
        if (!response.body) throw new Error('No response body');
        let buffer = '';
        for await (const chunk of response.body as any) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6).trim();
            if (jsonStr === '[DONE]') {
              onDone();
              return;
            }
            try {
              const json = JSON.parse(jsonStr);
              const responseObj = json.response || json;
              const content =
                responseObj.candidates?.[0]?.content?.parts?.[0]?.text;
              if (content) onContent(content);
            } catch (e) {
              logger.warn('[GeminiCLI] Failed to parse SSE line:', e);
            }
          }
        }
        onDone();
      } else {
        const json = await response.json();
        const responseObj = json.response || json;
        const content =
          responseObj.candidates?.[0]?.content?.parts?.[0]?.text || '';
        onContent(content);
        onDone();
      }
    } catch (err: any) {
      logger.error('[GeminiCLI] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string): Promise<any[]> {
    let tokens: any;
    try {
      tokens = JSON.parse(credential);
    } catch (e) {
      logger.warn('[GeminiCLI] getModels: credential is not valid JSON');
      tokens = { accessToken: credential };
    }
    if (!tokens.accessToken) {
      logger.warn('[GeminiCLI] getModels: no access token available');
      return [];
    }
    let projectId =
      tokens.projectId || (await this.fetchProjectId(tokens.accessToken));
    if (!projectId) projectId = DEFAULT_PROJECT_ID;

    const response = await fetch(CLOUDCODE_RETRIEVE_QUOTA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-Goog-Api-Client': X_GOOG_API_CLIENT,
      },
      body: JSON.stringify({ project: projectId }),
    });
    if (!response.ok) {
      logger.warn(
        `[GeminiCLI] getModels: quota API returned status ${response.status}`,
      );
      return [];
    }
    const data = await response.json();
    if (!data.buckets) {
      logger.warn('[GeminiCLI] getModels: quota API response missing buckets');
      return [];
    }
    return data.buckets.map((bucket: any) => ({
      id: bucket.modelId,
      name: bucket.modelId,
    }));
  }

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('gemini') || m.startsWith('gemini-');
  }
}

export default new GeminiCLIProvider();
