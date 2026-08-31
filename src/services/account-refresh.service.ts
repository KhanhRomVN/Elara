/**
 * ------------------------------------------------------------------
 * Account Refresh Service
 * ------------------------------------------------------------------
 * Service tự động refresh token và cập nhật usage cho các tài khoản.
 * Chạy định kỳ mỗi giờ, kiểm tra và refresh token khi hết hạn.
 *
 * Main functions:
 * - start()            : Khởi động service
 * - stop()             : Dừng service
 * - checkAndRefresh()  : Kiểm tra và refresh token cho tất cả accounts
 * - refreshUsage()     : Cập nhật usage cho một account
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getDb } from '../database';

// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('AccountRefreshService');

// ─── Class ──────────────────────────────────────────────────────────────

export class AccountRefreshService {
  private interval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour
  private readonly AUTO_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

  // ─── Lifecycle ──────────────────────────────────────────────────────

  start() {
    if (this.interval) return;
    setTimeout(() => this.checkAndRefresh(), 30000);
    this.interval = setInterval(
      () => this.checkAndRefresh(),
      this.REFRESH_INTERVAL,
    );
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  // ─── Refresh ────────────────────────────────────────────────────────

  async checkAndRefresh() {
    const db = getDb();
    const accounts = db.prepare('SELECT * FROM accounts').all() as any[];

    for (const account of accounts) {
      try {
        let credential: any;
        try {
          credential = JSON.parse(account.credential);
        } catch (e) {
          credential = { accessToken: account.credential };
        }

        if (!credential) {
          continue;
        }

        const refreshToken =
          credential.refreshToken || credential.refresh_token;
        const now = Date.now();
        const lastRefreshed = account.last_refreshed_at || 0;
        const provider = providerRegistry.getProvider(account.provider_id);
        if (!provider) continue;

        if (
          refreshToken &&
          now - lastRefreshed >= this.AUTO_REFRESH_THRESHOLD
        ) {
          if (provider.refreshToken) {
            try {
              const newTokens = await provider.refreshToken(refreshToken);
              const updatedCredential = {
                ...credential,
                accessToken:
                  newTokens.accessToken ||
                  newTokens.access_token ||
                  credential.accessToken,
                refreshToken:
                  newTokens.refreshToken ||
                  newTokens.refresh_token ||
                  refreshToken,
                expiresIn:
                  newTokens.expiresIn ||
                  newTokens.expires_in ||
                  credential.expiresIn,
              };
              db.prepare(
                'UPDATE accounts SET credential = ?, last_refreshed_at = ? WHERE id = ?',
              ).run(JSON.stringify(updatedCredential), now, account.id);
              credential = updatedCredential;
            } catch (err: any) {
              logger.error(
                `Token refresh failed — ${account.email}: ${err.message}`,
              );
            }
          }
        }

        if (provider.getUsage) {
          await this.refreshUsage(account.id);
        }
      } catch (e: any) {
        logger.error(`Error processing account ${account.id}: ${e.message}`);
      }
    }
  }

  async refreshUsage(accountId: string) {
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE id = ?')
      .get(accountId) as any;
    if (!account) return;

    const provider = providerRegistry.getProvider(account.provider_id);
    if (!provider?.getUsage) return;

    try {
      let credential: any;
      try {
        credential = JSON.parse(account.credential);
      } catch (e) {
        credential = { accessToken: account.credential };
      }
      const usageInfo = await provider.getUsage(JSON.stringify(credential));
      db.prepare(
        'UPDATE accounts SET usage = ?, reset_period = ? WHERE id = ?',
      ).run(usageInfo.usage, usageInfo.resetPeriod, account.id);
    } catch (err: any) {
      logger.warn(`Usage fetch failed — ${account.email}: ${err.message}`);
    }
  }
}

export const accountRefreshService = new AccountRefreshService();