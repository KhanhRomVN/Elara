/**
 * ------------------------------------------------------------------
 * Login Service
 * ------------------------------------------------------------------
 * Service login cho các provider. Hỗ trợ 2 phương thức:
 * - MITM: proxy-based intercept cookies/tokens
 * - CDP: Chrome DevTools Protocol để capture từ browser
 *
 * Main functions:
 * - login()          : Đăng nhập với provider
 * - cancelLogin()    : Hủy đăng nhập đang chạy
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, execSync, ChildProcess } from 'child_process';
import fetch from 'node-fetch';
import WebSocket from 'ws';

// ── Services ──
import { proxyService, proxyEvents } from '../proxy.service';
import { cdpLoginService, CDPLoginOptions } from './cdp-login.service';

// ── Utils ──
import { createLogger } from '../../utils/logger';
import { findAvailablePort } from '../../utils/net';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('LoginService');

// ─── Types ──────────────────────────────────────────────────────────────

interface LoginOptions {
  providerId: string;
  loginUrl: string;
  partition: string;
  cookieEvent?: string;
  headerEvent?: string;
  infoEvent?: string;
  extraEvents?: string[];
  skipProxy?: boolean;
  method?: 'mitm' | 'cdp';
  validate?: (data: {
    cookies: string;
    headers?: any;
    email?: string;
  }) => Promise<{
    isValid: boolean;
    email?: string | null;
    cookies?: string;
    headers?: any;
  }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const getUserDataPath = () => {
  try {
    return path.join(os.homedir(), '.elara');
  } catch (e) {
    return path.join(os.tmpdir(), 'elara-login');
  }
};

// ─── Class ──────────────────────────────────────────────────────────────

export class LoginService {
  private activeProcesses: Map<string, ChildProcess> = new Map();

  private findChrome(): string | null {
    if (process.platform === 'win32') {
      const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const localAppData =
        process.env['LocalAppData'] ||
        (process.env['USERPROFILE']
          ? path.join(process.env['USERPROFILE'], 'AppData', 'Local')
          : '');

      const candidates = [
        path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(progFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(progFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(progFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
        path.join(progFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
        path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
        path.join(progFiles, 'Chromium', 'Application', 'chrome.exe'),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ];

      for (const cand of candidates) {
        if (cand && fs.existsSync(cand)) return cand;
      }
    } else if (process.platform === 'darwin') {
      const candidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) return cand;
      }
    }

    const commonPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/usr/bin/brave-browser',
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable',
      '/var/lib/flatpak/exports/bin/com.google.Chrome',
      '/var/lib/flatpak/exports/bin/org.chromium.Chromium',
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) return p;
    }

    const linuxBrowsers = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      'microsoft-edge',
      'brave-browser',
    ];
    for (const b of linuxBrowsers) {
      try {
        const output = execSync(`which ${b}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        if (output.trim()) return output.trim();
      } catch (e) {}
    }

    return null;
  }

  // ─── Login ───────────────────────────────────────────────────────────

  async login(
    options: LoginOptions,
  ): Promise<{ cookies: string; email?: string; headers?: any }> {
    if (options.method === 'cdp') {
      logger.info(`[Login] Using CDP method for ${options.providerId}`);
      const cdpOptions: CDPLoginOptions = {
        providerId: options.providerId,
        loginUrl: options.loginUrl,
        partition: options.partition,
        timeout: 300000,
        validate: options.validate ? async (captured) => {
          const result = await options.validate!({
            cookies: captured.cookies || '',
            email: captured.email || '',
          });
          return {
            isValid: result.isValid,
            cookies: result.cookies,
            email: result.email || undefined,
          };
        } : undefined,
        extraEvents: options.extraEvents,
      };

      const result = await cdpLoginService.login(cdpOptions);
      if (!result.success) {
        throw new Error(result.error || 'CDP login failed');
      }
      return {
        cookies: result.cookies || '',
        email: result.email,
      };
    }

    const chromePath = this.findChrome();
    if (!chromePath) {
      throw new Error('Chrome or Chromium not found. Please install it.');
    }

    const profileFolderName = options.partition.replace('persist:', '');
    const userDataPath = getUserDataPath();
    const profilePath = path.join(userDataPath, 'profiles', profileFolderName);

    try {
      if (fs.existsSync(profilePath)) {
        logger.info(`Cleaning profile: ${profilePath}`);
        fs.rmSync(profilePath, { recursive: true, force: true });
      }
    } catch (e) {
      logger.error('Failed to clean profile:', e);
    }

    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
    }

    await proxyService.start();

    const proxyConfig = proxyService.getConfig();
    const proxyUrl = `127.0.0.1:${proxyConfig.port}`;

    const args = [
      '--ignore-certificate-errors',
      `--user-data-dir=${profilePath}`,
      '--disable-http2',
      '--disable-quic',
      '--no-first-run',
      '--no-default-browser-check',
      `--class=${options.providerId.toLowerCase()}-browser`,
      options.loginUrl,
    ];

    if (!options.skipProxy) {
      args.unshift(
        `--proxy-server=http=${proxyUrl};https=${proxyUrl}`,
        '--proxy-bypass-list=localhost,127.0.0.1',
      );
    }

    const cdpPort = await findAvailablePort(9222);
    args.unshift(`--remote-debugging-port=${cdpPort}`);

    logger.info(`Spawning Chrome for ${options.providerId} with CDP port ${cdpPort}...`);
    const chromeProcess = spawn(chromePath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.activeProcesses.set(options.providerId, chromeProcess);

    return new Promise((resolve, reject) => {
      let resolved = false;
      let capturedCookies = '';
      let capturedEmail = '';
      let capturedHeaders = {};
      let capturedExtraData: any = {};
      let cdpPoller: NodeJS.Timeout | null = null;
      let wsClient: WebSocket | null = null;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          if (cdpPoller) {
            clearInterval(cdpPoller);
            cdpPoller = null;
          }
          if (wsClient) {
            try {
              wsClient.close();
            } catch {}
            wsClient = null;
          }
          try {
            chromeProcess.kill();
          } catch (e) {}
          this.activeProcesses.delete(options.providerId);

          if (options.cookieEvent)
            proxyEvents.off(options.cookieEvent, onCookie);
          if (options.headerEvent)
            proxyEvents.off(options.headerEvent, onHeader);
          if (options.infoEvent) proxyEvents.off(options.infoEvent, onInfo);

          if (options.extraEvents) {
            for (const eventName of options.extraEvents) {
              proxyEvents.off(eventName, onExtraEvent);
            }
          }
        }
      };

      // ─── CDP Poller for Kimi localStorage ──────────────────────────

      if (options.providerId === 'kimi') {
        cdpPoller = setInterval(async () => {
          if (resolved) {
            if (cdpPoller) clearInterval(cdpPoller);
            return;
          }
          try {
            const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
            if (!listRes.ok) return;
            const targets = (await listRes.json()) as any[];
            const pageTarget = targets.find(
              (t: any) =>
                t.type === 'page' &&
                t.webSocketDebuggerUrl &&
                (t.url?.includes('kimi.ai') || t.url?.includes('kimi.com')),
            );
            if (pageTarget && pageTarget.webSocketDebuggerUrl) {
              if (!wsClient || wsClient.readyState === WebSocket.CLOSED) {
                wsClient = new WebSocket(pageTarget.webSocketDebuggerUrl);
                wsClient.on('open', () => {
                  wsClient?.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
                });
                wsClient.on('message', (raw: any) => {
                  try {
                    const msg = JSON.parse(raw.toString());
                    if (msg.id === 2 && msg.result?.result?.value) {
                      const storageData = JSON.parse(msg.result.result.value);
                      if (storageData.refresh_token && storageData.access_token) {
                        logger.info('[CDP Poller] Extracted Kimi access_token and refresh_token from browser localStorage!');
                        const cookieWithRefresh = `kimi-auth=${storageData.access_token}; refresh_token=${storageData.refresh_token}`;
                        capturedCookies = cookieWithRefresh;
                        capturedExtraData.refreshToken = storageData.refresh_token;
                        capturedExtraData.token = storageData.access_token;
                        proxyEvents.emit('kimi-login-token', {
                          token: storageData.access_token,
                          refreshToken: storageData.refresh_token,
                          cookies: cookieWithRefresh,
                        });
                        resolveIfReady();
                      }
                    }
                  } catch {}
                });
              }

              if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                const expr = `JSON.stringify({ access_token: localStorage.getItem('access_token'), refresh_token: localStorage.getItem('refresh_token'), msh_user_id: localStorage.getItem('msh_user_id') })`;
                wsClient.send(
                  JSON.stringify({
                    id: 2,
                    method: 'Runtime.evaluate',
                    params: { expression: expr, returnByValue: true },
                  }),
                );
              }
            }
          } catch {}
        }, 1000);
      }

      // ─── Resolve Logic ─────────────────────────────────────────────

      let isResolving = false;
      const resolveIfReady = async () => {
        if (!capturedCookies || resolved || isResolving) {
          return;
        }
        isResolving = true;
        try {
          if (options.providerId === 'qwen') {
            const hasBxUa = (capturedHeaders as any)['bx-ua'];
            const hasBxUmidToken = (capturedHeaders as any)['bx-umidtoken'];

            const isRealBxUa = hasBxUa &&
              typeof hasBxUa === 'string' &&
              /^\d+!/.test(hasBxUa) &&
              hasBxUa.length > 100 &&
              !hasBxUa.includes('default') &&
              !hasBxUa.includes('not_initialized') &&
              !hasBxUa.includes('not_fun');

            const isRealBxUmidToken = hasBxUmidToken &&
              typeof hasBxUmidToken === 'string' &&
              hasBxUmidToken.length > 30 &&
              !hasBxUmidToken.includes('default') &&
              !hasBxUmidToken.includes('not_initialized');

            logger.debug(`[Login] Qwen headers status - bxUa: ${!!hasBxUa} (real: ${isRealBxUa}), bxUmidToken: ${!!hasBxUmidToken} (real: ${isRealBxUmidToken})`);

            if (!isRealBxUa || !isRealBxUmidToken) {
              logger.debug(`[Login] ⏳ Waiting for real Qwen headers`);
              return;
            }
            logger.info(`[Login] ✅ Qwen real headers ready`);
          }

          if (options.validate) {
            try {
              const result = await options.validate({
                cookies: capturedCookies,
                headers: capturedHeaders,
                email: capturedEmail,
                refreshToken: capturedExtraData.refreshToken || capturedExtraData.refresh_token,
                ...capturedExtraData,
              });
              if (result.isValid && !resolved) {
                logger.info(`Validation success for ${options.providerId}`);
                const finalCookies = result.cookies || capturedCookies;
                cleanup();
                resolve({
                  cookies: finalCookies,
                  email: result.email || capturedEmail,
                  headers: result.headers || capturedHeaders,
                  ...capturedExtraData,
                });
              }
            } catch (e) {
              logger.error(`Validation failed for ${options.providerId}:`, e);
            }
          } else {
            cleanup();
            resolve({
              cookies: capturedCookies,
              email: capturedEmail,
              headers: capturedHeaders,
              ...capturedExtraData,
            });
          }
        } finally {
          isResolving = false;
        }
      };

      // ─── Event Handlers ─────────────────────────────────────────────

      const onCookie = (data: any) => {
        if (typeof data === 'string') {
          if (!capturedCookies || !capturedCookies.includes('refresh_token=')) {
            capturedCookies = data;
          }
        } else if (data && typeof data === 'object') {
          if (data.cookies) {
            if (!capturedCookies || data.cookies.includes('refresh_token=') || !capturedCookies.includes('refresh_token=')) {
              capturedCookies = data.cookies;
            }
          }
          if (data.email) capturedEmail = data.email;
          if (data.headers) capturedHeaders = { ...capturedHeaders, ...data.headers };
          if (data.refreshToken) capturedExtraData.refreshToken = data.refreshToken;
          capturedExtraData = { ...capturedExtraData, ...data };
        }
        resolveIfReady();
      };

      const onHeader = (data: any) => {
        capturedHeaders = { ...capturedHeaders, ...data };
        resolveIfReady();
      };

      const onInfo = (data: any) => {
        if (data && data.email) capturedEmail = data.email;
        if (data && typeof data === 'object') capturedExtraData = { ...capturedExtraData, ...data };
        resolveIfReady();
      };

      const onExtraEvent = (data: any) => {
        if (typeof data === 'string') {
          if (!capturedCookies || !capturedCookies.includes('refresh_token=')) {
            capturedCookies = data;
          }
        } else if (data && typeof data === 'object') {
          if (data.email) capturedEmail = data.email;
          if (data.cookies) {
            if (!capturedCookies || data.cookies.includes('refresh_token=') || !capturedCookies.includes('refresh_token=')) {
              capturedCookies = data.cookies;
            }
          }
          if (data.headers) capturedHeaders = { ...capturedHeaders, ...data.headers };
          if (data.refreshToken) capturedExtraData.refreshToken = data.refreshToken;
          capturedExtraData = { ...capturedExtraData, ...data };
        }
        resolveIfReady();
      };

      if (options.cookieEvent) proxyEvents.on(options.cookieEvent, onCookie);
      if (options.headerEvent) proxyEvents.on(options.headerEvent, onHeader);
      if (options.infoEvent) proxyEvents.on(options.infoEvent, onInfo);

      if (options.extraEvents) {
        for (const eventName of options.extraEvents) {
          proxyEvents.on(eventName, onExtraEvent);
        }
      }

      setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error('Login timed out'));
        }
      }, 300000);

      chromeProcess.on('close', () => {
        if (!resolved) {
          cleanup();
          reject(new Error('User closed login window'));
        }
      });
    });
  }

  // ─── Cancel ──────────────────────────────────────────────────────────

  cancelLogin(providerId: string) {
    const process = this.activeProcesses.get(providerId);
    if (process) {
      process.kill();
      this.activeProcesses.delete(providerId);
    }
  }
}

export const loginService = new LoginService();