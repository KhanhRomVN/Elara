import { EventEmitter } from 'events';
import { createCDPService } from './cdp.service';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CDPLoginService');

export interface CDPLoginOptions {
  providerId: string;
  loginUrl: string;
  partition?: string;
  timeout?: number;
  keepBrowserOpen?: boolean;
  validate?: (captured: any) => Promise<{ isValid: boolean; cookies?: string; email?: string }>;
  extraEvents?: string[];
}

export interface CDPLoginResult {
  success: boolean;
  cookies?: string;
  email?: string;
  error?: string;
}

export class CDPLoginService extends EventEmitter {
  private activeSessions: Map<string, { cdpService: any; browserProcess: any }> = new Map();

  async login(options: CDPLoginOptions): Promise<CDPLoginResult> {
    const { providerId, loginUrl, timeout = 120000, validate, extraEvents = [] } = options;
    const sessionId = `${providerId}-${Date.now()}`;

    logger.info(`[CDP Login] Starting login for ${providerId} with URL ${loginUrl}`);

    const cdpService = createCDPService(sessionId);
    let capturedCookies = '';
    let capturedEmail = '';
    let resolvePromise: ((value: CDPLoginResult) => void) | null = null;
    let rejectPromise: ((reason: any) => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const resultPromise = new Promise<CDPLoginResult>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    // Listen for cookie changes via Network events
    cdpService.on('response', async (response: any) => {
      // Look for Set-Cookie headers
      if (response.headers?.['set-cookie']) {
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          capturedCookies += cookies + '; ';
        }
      }
    });

    cdpService.on('response-body', async (data: any) => {
      try {
        const body = data.isBinary ? Buffer.from(data.body, 'base64').toString() : data.body;
        const json = JSON.parse(body);
        
        if (json.email) {
          capturedEmail = json.email;
        }
        if (json.user?.email) {
          capturedEmail = json.user.email;
        }
      } catch (e) {
        // Not JSON
      }

      // Trigger validation if we have cookies or email
      if (validate && (capturedCookies || capturedEmail)) {
        const validation = await validate({ cookies: capturedCookies, email: capturedEmail });
        if (validation.isValid) {
          logger.info(`[CDP Login] Validation successful for ${providerId}`);
          if (resolvePromise) {
            if (timeoutId) clearTimeout(timeoutId);
            await cdpService.close();
            this.activeSessions.delete(sessionId);
            resolvePromise({
              success: true,
              cookies: validation.cookies || capturedCookies,
              email: validation.email || capturedEmail,
            });
          }
        }
      }
    });

    cdpService.on('browser-exit', () => {
      if (rejectPromise) {
        rejectPromise({ success: false, error: 'Browser closed unexpectedly' });
      }
    });

    // Launch browser and navigate to login URL
    const launched = await cdpService.launchBrowser(loginUrl);
    if (!launched) {
      return { success: false, error: 'Failed to launch browser' };
    }

    this.activeSessions.set(sessionId, { cdpService, browserProcess: null });

    // Set timeout
    timeoutId = setTimeout(async () => {
      if (resolvePromise) {
        logger.warn(`[CDP Login] Timeout after ${timeout}ms for ${providerId}`);
        await cdpService.close();
        this.activeSessions.delete(sessionId);
        resolvePromise({ success: false, error: `Login timeout after ${timeout}ms` });
      }
    }, timeout);

    // Wait for user to login manually or auto-fill credentials
    logger.info(`[CDP Login] Browser opened at ${loginUrl}. Waiting for login...`);

    return resultPromise;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      await session.cdpService.close();
      this.activeSessions.delete(sessionId);
    }
  }

  async closeAllSessions(): Promise<void> {
    for (const [id, session] of this.activeSessions) {
      await session.cdpService.close();
      this.activeSessions.delete(id);
    }
  }
}

export const cdpLoginService = new CDPLoginService();