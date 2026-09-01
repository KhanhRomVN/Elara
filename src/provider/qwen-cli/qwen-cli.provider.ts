/**
 * ------------------------------------------------------------------
 * Qwen CLI Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Qwen CLI (Qwen Code CLI).
 * Hỗ trợ login qua terminal OAuth flow, refresh token,
 * và chat completion với streaming response.
 *
 * Main features:
 * - login()          : Đăng nhập qua terminal OAuth
 * - refreshToken()   : Refresh access token
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getProfile()     : Lấy thông tin user profile
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
import { proxyEvents } from '../../services/proxy.service';

// ── Database ──
import { getDb } from '../../database';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Qwen CLI Imports ──
import { proxyHandler } from './qwen-cli.proxy-handler';
import {
  QWEN_CLI_EVENTS,
  USER_INFO_URL,
  CHAT_COMPLETIONS_URL,
} from './qwen-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenCLIProvider');

export const QWEN_CONFIG = {
  clientId: 'f0304373b74a44d2b584a3fb70ca9e56',
  deviceCodeUrl: 'https://chat.qwen.ai/api/v1/oauth2/device/code',
  tokenUrl: 'https://chat.qwen.ai/api/v1/oauth2/token',
  scope: 'openid profile email model.completion',
  codeChallengeMethod: 'S256',
};

// ─── Provider Class ────────────────────────────────────────────────────

export class QwenCoderCLIProvider implements Provider {
  name = 'qwen-cli';
  proxyHandler = proxyHandler;
  defaultModel = 'coder-model';

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    const tempHome = path.join(os.tmpdir(), `qwen-login-fresh`);
    if (fs.existsSync(tempHome))
      fs.rmSync(tempHome, { recursive: true, force: true });
    fs.mkdirSync(tempHome, { recursive: true });

    const cliPath = path.resolve(
      __dirname,
      '../../../../../temp/qwen-cli/cli.js',
    );
    await proxyService.start();
    const { port } = proxyService.getServerInfo();
    const logFile = path.join(tempHome, 'qwen-cli.log');

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

    const nodePath = process.execPath;
    const proxyUrl = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
    };
    const envStr = `export http_proxy=${proxyUrl} https_proxy=${proxyUrl} HOME=${tempHome} NODE_TLS_REJECT_UNAUTHORIZED=0;`;
    const commandStr = `${envStr} (sleep 2; echo "qwen"; sleep 1; echo "") | ${nodePath} ${cliPath} --auth-type qwen-oauth 2>&1 | tee ${logFile}`;

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
      terminalSpawn = spawn(nodePath, [cliPath, 'chat', '--empty'], {
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
            /https:\/\/chat\.qwen\.ai\/authorize\?user_code=[A-Z0-9-]+&client=qwen-code/,
          );
          if (urlMatch && !capturedUrl) {
            capturedUrl = urlMatch[0];
            clearInterval(checkInterval);
            loginService
              .login({
                providerId: 'qwen-cli',
                loginUrl: capturedUrl,
                partition: 'qwen-cli',
                skipProxy: true,
                extraEvents: [
                  QWEN_CLI_EVENTS.TOKENS,
                  QWEN_CLI_EVENTS.USER_INFO,
                ],
                validate: async (captured) => {
                  if (captured.cookies && captured.email)
                    return { isValid: true };
                  return { isValid: false };
                },
              })
              .then((result) => {
                try {
                  fs.rmSync(tempHome, { recursive: true, force: true });
                } catch (e) {}
                resolve(result);
              })
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

  // ─── Profile ────────────────────────────────────────────────────────

  async getProfile(accessToken: string) {
    try {
      const response = await fetch(USER_INFO_URL, {
        headers: {
          'User-Agent': `QwenCode/0.10.6 (${process.platform}; ${process.arch})`,
          'x-dashscope-authtype': 'qwen-oauth',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return { email: data.email || data.username || null };
      }
    } catch (e) {}
    return { email: null };
  }

  // ─── Refresh Token ──────────────────────────────────────────────────

  async refreshToken(refreshTokenStr: string) {
    const response = await fetch(QWEN_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: QWEN_CONFIG.clientId,
        refresh_token: refreshTokenStr,
      }),
    });
    if (!response.ok) throw new Error('Failed to refresh Qwen token');
    const json = await response.json();
    let data = json;
    if (
      json.response &&
      typeof json.response === 'string' &&
      json.response.startsWith('{')
    ) {
      try {
        data = JSON.parse(json.response);
      } catch (e) {}
    }
    return data;
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
      tokens = { accessToken: credential };
    }

    const url = CHAT_COMPLETIONS_URL;

    const sendRequest = async (token: string) => {
      return await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'QwenCode/0.10.6 (linux; x64)',
          'x-dashscope-authtype': 'qwen-oauth',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || this.defaultModel,
          messages: messages.map((m: any) => ({
            role: m.role,
            content: [{ type: 'text', text: m.content }],
          })),
          stream: stream !== false,
          stream_options:
            stream !== false ? { include_usage: true } : undefined,
        }),
      });
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
              const db = getDb();
              const newCredential = JSON.stringify({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: newTokens.expires_in || 21600,
              });
              db.prepare('UPDATE accounts SET credential = ? WHERE id = ?').run(
                newCredential,
                accountId,
              );
            } catch (e) {}
          }
          response = await sendRequest(tokens.accessToken);
        } catch (e) {}
      }

      if (!response.ok)
        throw new Error(`Qwen CLI API Error ${response.status}`);

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
              if (json.choices?.[0]?.delta?.content)
                onContent(json.choices[0].delta.content);
            } catch (e) {}
          }
        }
        onDone();
      } else {
        const json = await response.json();
        onContent(json.choices?.[0]?.message?.content || '');
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

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('qwen') || m.startsWith('qwen-');
  }
}

export default new QwenCoderCLIProvider();
