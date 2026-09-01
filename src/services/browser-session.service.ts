/**
 * ------------------------------------------------------------------
 * Browser Session Service
 * ------------------------------------------------------------------
 * Quản lý phiên đăng nhập qua browser (CDP). Mở browser, chờ đăng nhập,
 * lưu profile và tạo account khi hoàn tất.
 *
 * Main functions:
 * - loginViaCDP()          : Mở browser, chờ đăng nhập, trả về pending session
 * - completePendingSession(): Hoàn tất pending session với email
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ── Repositories ──
import {
  insertAccount,
  findAccountById,
  updateAccountCredential,
  updateAccountUserDataDir,
} from '../repositories/account.repository';
import {
  ensureProviderExists,
  findProviderById,
} from '../repositories/provider.repository';

// ── Services ──
import { browserInstanceManager } from './browser-instance-manager';
import { createCDPService } from './login/cdp.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('BrowserSessionService');

// ─── Types ──────────────────────────────────────────────────────────────

interface PendingSession {
  tempDir: string;
  providerId: string;
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

// ─── State ──────────────────────────────────────────────────────────────

const pendingSessions = new Map<string, PendingSession>();

// ─── Helpers ────────────────────────────────────────────────────────────

const getTempDir = (): string => {
  return path.join(os.homedir(), '.elara', 'temp');
};

// ─── Login ─────────────────────────────────────────────────────────────

export const loginViaCDP = async (
  providerId: string,
  loginUrl: string,
  profileName?: string,
): Promise<{ pending: boolean; tempSessionId: string }> => {
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
  const tempDir = path.join(getTempDir(), tempSessionId);
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
    throw new Error('Failed to launch browser');
  }

  return new Promise<{ pending: boolean; tempSessionId: string }>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        if (pendingSessions.has(tempSessionId)) {
          pendingSessions.delete(tempSessionId);
          cdpService.close().catch(() => {});
          reject(new Error('Browser session timeout'));
        }
      }, 600000);

      pendingSessions.set(tempSessionId, {
        tempDir,
        providerId,
        resolve: (value: any) => resolve(value),
        reject,
        timeout,
      });

      cdpService.on('browser-exit', () => {
        clearTimeout(timeout);
        resolve({ pending: true, tempSessionId });
      });
    },
  );
};

// ─── Complete Session ──────────────────────────────────────────────────

export const completePendingSession = async (
  tempSessionId: string,
  email: string,
): Promise<any> => {
  const pending = pendingSessions.get(tempSessionId);
  if (!pending) {
    throw new Error(`Pending session not found: ${tempSessionId}`);
  }

  clearTimeout(pending.timeout);
  pendingSessions.delete(tempSessionId);

  const finalProfileName = `profile_${Date.now()}`;
  const finalUserDataDir = browserInstanceManager.getProfilePath(
    pending.providerId,
    finalProfileName,
  );

  const finalDir = path.dirname(finalUserDataDir);
  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }

  if (fs.existsSync(pending.tempDir)) {
    fs.renameSync(pending.tempDir, finalUserDataDir);
  }

  const accountId = uuidv4();
  insertAccount({
    id: accountId,
    provider_id: pending.providerId,
    email: email,
    credential: null,
    user_data_dir: finalUserDataDir,
  });

  ensureProviderExists(pending.providerId.toLowerCase(), pending.providerId);

  const account = findAccountById(accountId);

  pending.resolve(account);
  return account;
};
