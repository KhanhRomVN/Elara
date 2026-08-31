/**
 * ------------------------------------------------------------------
 * Codex CLI Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Codex CLI (OpenAI GPT-5 coding agent).
 * Hỗ trợ login qua terminal CLI, refresh token, và chat completion
 * với streaming response.
 *
 * Main features:
 * - login()          : Đăng nhập qua Codex CLI với terminal
 * - refreshToken()   : Refresh access token
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - isModelSupported(): Kiểm tra model có hỗ trợ không
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
import { loginService } from '../../services/login/login.service';
import { proxyService } from '../../services/proxy.service';

// ── Database ──
import { getDb } from '../../database';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Codex Imports ──
import { proxyHandler } from './codex-cli.proxy-handler';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CodexCLIProvider');

// Lazy load zstd
let compress: any;
try {
  compress = require('@mongodb-js/zstd').compress;
} catch (e) {}

// ─── Provider Class ────────────────────────────────────────────────────

export class CodexCLIProvider implements Provider {
  name = 'codex-cli';
  proxyHandler = proxyHandler;
  defaultModel = 'gpt-5.3-codex';

  // ─── Get Profile ────────────────────────────────────────────────────

  async getProfile(accessToken: string) {
    try {
      const response = await fetch(
        'https://chatgpt.com/backend-api/wham/usage',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'User-Agent':
              'codex_cli_rs/0.104.0 (Ubuntu 24.4.0; x86_64) gnome-terminal',
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        return {
          email: data.email || null,
          userId: data.user_id,
          accountId: data.account_id,
        };
      }
    } catch (e) {}
    return { email: null };
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    logger.info('Starting Codex CLI login with real CLI and terminal...');
    const tempHome = path.join(
      os.homedir(),
      '.elara',
      `codex-login-fresh-${Date.now()}`,
    );
    if (fs.existsSync(tempHome))
      fs.rmSync(tempHome, { recursive: true, force: true });
    fs.mkdirSync(tempHome, { recursive: true });

    await proxyService.start();
    const { port } = proxyService.getServerInfo();
    const logFile = path.join(tempHome, 'codex-cli.log');

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

    const proxyUrl = `http://127.0.0.1:${port}`;
    const caCertPath = path.join(
      os.homedir(),
      '.elara',
      'certs',
      'certs',
      'ca.pem',
    );
    const env = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      SSL_CERT_FILE: caCertPath,
      REQUESTS_CA_BUNDLE: caCertPath,
      CURL_CA_BUNDLE: caCertPath,
    };
    const envStr = `export http_proxy=${proxyUrl} https_proxy=${proxyUrl} HOME=${tempHome} NODE_TLS_REJECT_UNAUTHORIZED=0 SSL_CERT_FILE=${caCertPath};`;
    const commandStr = `${envStr} codex login 2>&1 | tee ${logFile}`;

    let terminalSpawn: any;
    if (terminal === 'gnome-terminal') {
      terminalSpawn = spawn(
        terminal,
        ['--', 'bash', '-c', `${commandStr}; read`],
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
            /https:\/\/auth\.openai\.com\/oauth\/authorize\?[^\s"']+/,
          );
          if (urlMatch && !capturedUrl) {
            capturedUrl = urlMatch[0];
            clearInterval(checkInterval);
            loginService
              .login({
                providerId: 'codex-cli',
                loginUrl: capturedUrl,
                partition: 'codex-cli',
                skipProxy: true,
                extraEvents: ['codex-cli-tokens', 'codex-cli-user-info'],
                validate: async (captured) => {
                  if (captured.cookies) {
                    try {
                      const tokenData = JSON.parse(captured.cookies);
                      if (tokenData.accessToken) {
                        const profile = await this.getProfile(
                          tokenData.accessToken,
                        );
                        if (profile && profile.email)
                          return { isValid: true, email: profile.email };
                      }
                    } catch (e) {}
                  }
                  return captured.cookies && captured.email
                    ? { isValid: true }
                    : { isValid: false };
                },
              })
              .then(resolve)
              .catch(reject);
          }
        }
      }, 1000);
      terminalSpawn.on('error', reject);
      setTimeout(() => {
        if (!capturedUrl) {
          clearInterval(checkInterval);
          reject(new Error('Timed out'));
        }
      }, 60000);
    });
  }

  // ��── Refresh Token ──────────────────────────────────────────────────

  async refreshToken(refreshTokenStr: string) {
    const response = await fetch('https://auth.openai.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
        refresh_token: refreshTokenStr,
      }),
    });
    if (!response.ok) throw new Error('Failed to refresh Codex token');
    return await response.json();
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
      conversationId,
    } = options;

    let tokens: any;
    try {
      tokens = JSON.parse(credential);
    } catch (e) {
      tokens = { accessToken: credential };
    }

    const url = 'https://chatgpt.com/backend-api/codex/responses';

    const sendRequest = async (token: string) => {
      let chatgptAccountId = '';
      try {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString(),
        );
        chatgptAccountId =
          payload['https://api.openai.com/auth']?.chatgpt_account_id;
      } catch (e) {}

      const bodyObj: any = {
        model: model || this.defaultModel,
        instructions: 'You are Codex, a GPT-5 coding agent.',
        input: messages.map((m: any) => ({
          type: 'message',
          role: m.role,
          content: [
            {
              type: m.role === 'assistant' ? 'output_text' : 'input_text',
              text: m.content,
            },
          ],
        })),
        store: false,
        stream: stream !== false,
        include: ['reasoning.encrypted_content'],
        reasoning: { effort: 'medium' },
      };

      // Gửi conversation_id để ChatGPT phân biệt các phiên hội thoại khác nhau
      // từ cùng một account, tránh bị gộp request.
      if (conversationId) {
        bodyObj.conversation_id = conversationId;
      }

      const jsonBody = JSON.stringify(bodyObj);
      let finalBody: any = jsonBody;
      const headers: any = {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent':
          'codex_cli_rs/0.104.0 (Ubuntu 24.4.0; x86_64) gnome-terminal',
        originator: 'codex_cli_rs',
      };
      if (chatgptAccountId) headers['chatgpt-account-id'] = chatgptAccountId;

      if (compress) {
        try {
          const compressed = await compress(Buffer.from(jsonBody));
          finalBody = compressed;
          headers['Content-Encoding'] = 'zstd';
        } catch (e) {}
      }

      return await fetch(url, { method: 'POST', headers, body: finalBody });
    };

    try {
      let response = await sendRequest(tokens.accessToken);

      if (response.status === 401 && tokens.refreshToken) {
        try {
          const newTokens = await this.refreshToken(tokens.refreshToken);
          tokens.accessToken = newTokens.access_token;
          tokens.refreshToken = newTokens.refresh_token || tokens.refreshToken;
          if (accountId) {
            try {
              getDb()
                .prepare('UPDATE accounts SET credential = ? WHERE id = ?')
                .run(JSON.stringify(tokens), accountId);
            } catch (e) {}
          }
          response = await sendRequest(tokens.accessToken);
        } catch (e) {}
      }

      if (!response.ok) throw new Error(`Codex API Error ${response.status}`);

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
              const content =
                json.delta ||
                json.choices?.[0]?.delta?.content ||
                json.message?.content?.parts?.[0];
              if (content)
                onContent(
                  typeof content === 'string'
                    ? content
                    : JSON.stringify(content),
                );
            } catch (e) {}
          }
        }
        onDone();
      } else {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content || '';
        onContent(content);
        onDone();
      }
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
    return m.includes('codex') || m.startsWith('gpt-5');
  }
}

export default new CodexCLIProvider();