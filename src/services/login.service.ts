/**
 * ------------------------------------------------------------------
 * Login Service
 * ------------------------------------------------------------------
 * Service login cho các provider sử dụng CDP (Chrome DevTools Protocol)
 * để capture cookies/tokens từ browser.
 *
 * Main functions:
 * - captureCredentialsViaCDP() : Mở browser CDP, chờ đăng nhập, capture cookies/email
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ── Repositories ──
import { findProviderById } from '../repositories/provider.repository';

// ── Services ──
import { createCDPService } from './cdp.service';
import { browserInstanceManager } from './browser-instance-manager';
import { proxyEvents } from './proxy.service';

// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ── Utils ──
import { createLogger } from '../utils/logger';
// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('LoginService');

// ─── Types ──────────────────────────────────────────────────────────────

export interface LoginOptions {
  providerId: string;
  loginUrl: string;
  partition?: string;
  timeout?: number;
  keepBrowserOpen?: boolean;
  cookieEvent?: string;
  headerEvent?: string;
  infoEvent?: string;
  extraEvents?: string[];
  skipProxy?: boolean;
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

export interface LoginResult {
  success: boolean;
  cookies?: string;
  email?: string;
  error?: string;
}

export interface ProviderLoginOptions {
  method?: 'basic' | 'google';
}

export interface ProviderLoginResult {
  email?: string;
  cookies?: string;
  headers?: any;
  pending?: boolean;
  tempSessionId?: string;
  user_data_dir?: string;
}

// ─── Class ──────────────────────────────────────────────────────────────

export class LoginService extends EventEmitter {
  private activeSessions: Map<
    string,
    { cdpService: any; browserProcess: any }
  > = new Map();

  async captureCredentialsViaCDP(
    options: LoginOptions,
  ): Promise<{ cookies: string; email?: string; headers?: any }> {
    const {
      providerId,
      loginUrl,
      timeout = 300000,
      validate,
      cookieEvent,
      infoEvent,
    } = options;
    const sessionId = `${providerId}-${Date.now()}`;

    const cdpService = createCDPService(sessionId);
    let capturedCookies = '';
    let capturedEmail = '';
    let resolvePromise:
      | ((value: { cookies: string; email?: string; headers?: any }) => void)
      | null = null;
    let rejectPromise: ((reason: any) => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    // Track mimeTypes to filter JSON responses
    const responseMimeTypes = new Map<string, string>();

    const resultPromise = new Promise<{
      cookies: string;
      email?: string;
      headers?: any;
    }>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    // Listen to proxy events for custom cookie/email capture (e.g., DeepSeek)
    const cookieEventListener = (data: any) => {
      if (data.cookies) {
        capturedCookies = data.cookies;
      }
      if (data.email) {
        capturedEmail = data.email;
      }
    };

    const infoEventListener = (data: any) => {
      if (data.email) {
        capturedEmail = data.email;
      }
    };

    // Register proxy event listeners if events are specified
    if (cookieEvent) {
      proxyEvents.on(cookieEvent, cookieEventListener);
    }
    if (infoEvent) {
      proxyEvents.on(infoEvent, infoEventListener);
    }

    // Cleanup function to remove listeners
    const cleanup = () => {
      if (cookieEvent) {
        proxyEvents.off(cookieEvent, cookieEventListener);
        logger.debug(`[LoginService] Removed listener for ${cookieEvent}`);
      }
      if (infoEvent) {
        proxyEvents.off(infoEvent, infoEventListener);
        logger.debug(`[LoginService] Removed listener for ${infoEvent}`);
      }
    };

    cdpService.on('response', async (response: any) => {
      // Store mimeType for later use
      if (response.id && response.mimeType) {
        responseMimeTypes.set(response.id, response.mimeType);
      }

      // Log response details for debugging
      if (response.statusCode >= 200 && response.statusCode < 300) {
        logger.debug(
          `[LoginService] Response ${response.id} - status: ${response.statusCode}, mimeType: ${response.mimeType}`,
        );

        if (response.headers) {
          // Log all header keys
          const headerKeys = Object.keys(response.headers);
          logger.debug(
            `[LoginService] Response headers: ${headerKeys.join(', ')}`,
          );

          // Check for various cookie-related headers
          const cookieHeaders = [
            'set-cookie',
            'Set-Cookie',
            'cookie',
            'Cookie',
          ];
        }
      }

      if (response.headers?.['set-cookie']) {
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          capturedCookies += cookies + '; ';
        }
      }
    });

    cdpService.on('response-body', async (data: any) => {
      // Only try to parse if mimeType indicates JSON
      const mimeType = responseMimeTypes.get(data.id) || '';
      const isJson =
        mimeType.includes('application/json') || mimeType.includes('text/json');

      if (!isJson) {
        return; // Skip non-JSON responses silently
      }

      logger.debug(
        `[LoginService] Processing JSON response body (id: ${data.id})`,
      );

      try {
        const body = data.isBinary
          ? Buffer.from(data.body, 'base64').toString()
          : data.body;

        // Log first 500 chars of JSON body for debugging
        logger.debug(
          `[LoginService] JSON body preview: ${body.substring(0, 500)}`,
        );

        const json = JSON.parse(body);

        // Log JSON keys for debugging
        if (typeof json === 'object' && json !== null) {
          logger.debug(
            `[LoginService] JSON keys: ${Object.keys(json).join(', ')}`,
          );
        }

        // Extract email from various JSON structures
        if (json.email) {
          capturedEmail = json.email;
        }
        if (json.user?.email) {
          capturedEmail = json.user.email;
        }
        if (json.data?.biz_data?.user?.email) {
          capturedEmail = json.data.biz_data.user.email;
        }

        // Extract tokens from various JSON structures (for DeepSeek and similar providers)
        if (json.data?.biz_data?.user?.token) {
          const token = json.data.biz_data.user.token;
          capturedCookies = token;

          // Also capture email from same structure if available
          if (json.data.biz_data.user.email && !capturedEmail) {
            capturedEmail = json.data.biz_data.user.email;
          }
        }

        // Check for common auth token fields in JSON root
        const tokenFields = [
          'token',
          'access_token',
          'accessToken',
          'authToken',
          'auth_token',
          'jwt',
          'DS-AUTH-TOKEN',
        ];
        for (const field of tokenFields) {
          if (json[field]) {
            if (!capturedCookies) capturedCookies = json[field];
          }
          if (json.data?.[field]) {
            if (!capturedCookies) capturedCookies = json.data[field];
          }
        }
      } catch (e) {
        // Only log if we expected JSON but couldn't parse it
        logger.warn('[LoginService] Failed to parse JSON response body');
      }

      if (validate && (capturedCookies || capturedEmail)) {
        try {
          const validation = await validate({
            cookies: capturedCookies,
            email: capturedEmail,
          });

          if (validation.isValid) {
            if (resolvePromise) {
              if (timeoutId) {
                clearTimeout(timeoutId);
                logger.debug(`[LoginService] Cleared timeout`);
              }

              logger.debug(`[LoginService] Closing CDP service...`);
              await cdpService.close();

              this.activeSessions.delete(sessionId);
              logger.debug(`[LoginService] Removed active session`);

              // Cleanup proxy event listeners
              cleanup();

              const result = {
                cookies: validation.cookies || capturedCookies,
                email: validation.email || capturedEmail,
              };

              resolvePromise(result);

              // Clear the promise references to prevent double resolution
              resolvePromise = null;
              rejectPromise = null;
            } else {
              logger.warn(
                `[LoginService] Validation passed but resolvePromise is null!`,
              );
            }
          } else {
            logger.debug(
              `[LoginService] Validation failed, waiting for more data...`,
            );
          }
        } catch (validationError: any) {
          logger.error(
            `[LoginService] Validation threw error: ${validationError.message}`,
          );
          logger.error(
            `[LoginService] Validation stack: ${validationError.stack}`,
          );
        }
      } else {
        if (!validate) {
          logger.debug(
            `[LoginService] No validate function provided, skipping validation`,
          );
        }
        if (!capturedCookies && !capturedEmail) {
          logger.debug(`[LoginService] No cookies or email captured yet`);
        }
      }
    });

    cdpService.on('browser-exit', () => {
      logger.warn(
        `[LoginService] Browser exit event triggered for ${providerId}`,
      );

      if (rejectPromise) {
        logger.error(
          `[LoginService] Browser closed unexpectedly for ${providerId}`,
        );

        // Cleanup proxy event listeners
        cleanup();

        const error = new Error('Browser closed unexpectedly');
        (error as any).code = 'BROWSER_CLOSED';
        rejectPromise(error);

        // Clear references
        resolvePromise = null;
        rejectPromise = null;
      }
    });

    const launched = await cdpService.launchBrowser(loginUrl);

    if (!launched) {
      logger.error(`[LoginService] Failed to launch browser for ${providerId}`);
      return { cookies: '', email: undefined };
    }

    this.activeSessions.set(sessionId, { cdpService, browserProcess: null });

    timeoutId = setTimeout(async () => {
      logger.warn(
        `[LoginService] Timeout triggered after ${timeout}ms for ${providerId}`,
      );

      if (resolvePromise) {
        await cdpService.close();
        this.activeSessions.delete(sessionId);

        // Cleanup proxy event listeners
        cleanup();

        resolvePromise({
          cookies: capturedCookies,
          email: capturedEmail || undefined,
        });

        // Clear references
        resolvePromise = null;
        rejectPromise = null;
      }
    }, timeout);

    return resultPromise;
  }

  async captureBrowserProfileViaCDP(
    providerId: string,
    loginUrl: string,
    profileName?: string,
  ): Promise<{ user_data_dir: string }> {
    const provider = findProviderById(providerId);
    let extensionPath: string | null = null;

    if (provider?.browser_extension_folder) {
      extensionPath = path.join(
        __dirname,
        '../../extensions',
        provider.browser_extension_folder,
      );
    }

    const tempSessionId = uuidv4();
    const tempDir = path.join(os.homedir(), '.elara', 'temp', tempSessionId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const cdpService = createCDPService(`${providerId}-${tempSessionId}`);

    const launched = await cdpService.launchBrowser(
      loginUrl,
      tempDir,
      extensionPath || undefined,
    );
    if (!launched) {
      logger.error(`[LoginService] Failed to launch browser for ${providerId}`);
      throw new Error('Failed to launch browser');
    }

    return new Promise<{ user_data_dir: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cdpService.close().catch((e: any) => {
          logger.warn(
            '[LoginService] Failed to close CDP service after timeout:',
            e,
          );
        });
        logger.error(
          `[LoginService] Browser session timeout for ${providerId}`,
        );
        reject(new Error('Browser session timeout'));
      }, 600000);

      cdpService.on('browser-exit', () => {
        clearTimeout(timeout);

        const finalProfileName = `profile_${Date.now()}`;
        const finalUserDataDir = browserInstanceManager.getProfilePath(
          providerId,
          finalProfileName,
        );

        const finalDir = path.dirname(finalUserDataDir);
        if (!fs.existsSync(finalDir)) {
          fs.mkdirSync(finalDir, { recursive: true });
        }

        if (fs.existsSync(tempDir)) {
          fs.renameSync(tempDir, finalUserDataDir);
        }

        resolve({ user_data_dir: finalUserDataDir });
      });
    });
  }
}

/**
 * Login qua provider
 */
export async function loginWithProvider(
  providerId: string,
  options: ProviderLoginOptions,
): Promise<ProviderLoginResult> {
  const provider = providerRegistry.getProvider(providerId);

  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  if (!provider.login) {
    throw new Error(`Provider ${providerId} does not support browser login`);
  }

  const result = await provider.login({
    method: options.method || 'basic',
  });

  return result as ProviderLoginResult;
}

export const loginService = new LoginService();
