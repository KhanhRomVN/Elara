/**
 * ------------------------------------------------------------------
 * Account Service
 * ------------------------------------------------------------------
 * Business logic cho tài khoản người dùng và background refresh service.
 * Layer trung gian giữa Controller và Repository.
 *
 * Main functions:
 * - getAccountById()                           : Lấy account theo ID
 * - getAccountByEmailAndProvider()             : Lấy account theo email và provider
 * - getAccountByIdOrEmailProvider()            : Lấy account theo ID hoặc email+provider
 * - getAccounts()                              : Lấy danh sách accounts với phân trang
 * - createAccount()                            : Thêm account mới
 * - updateAccount()                            : Cập nhật credential của account
 * - updateMemoryState()                        : Cập nhật memory state của account
 * - removeAccount()                            : Xóa account
 * - importAccounts()                           : Import hàng loạt accounts
 * - getProviderConfig()                        : Lấy provider config theo ID
 * - updateAccountCredentialAndLastRefresh()    : Cập nhật credential và last_refreshed_at
 * - updateAccountUsageInfo()                   : Cập nhật usage và reset period
 * - refreshAccountToken()                      : Refresh token qua provider
 * - getAccountUsageFromProvider()              : Lấy usage từ provider
 * - AccountRefreshService                      : Background service tự động refresh tokens
 * - accountRefreshService                      : Singleton instance
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Repositories ──
import {
  findAccountById,
  findAccountByEmailAndProvider,
  findAccountByIdOrEmailProvider,
  listAccounts,
  insertAccount,
  insertAccountsBatch,
  updateAccountCredential,
  updateAccountCredentialAndRefresh,
  updateAccountMemory as updateAccountMemoryRepo,
  updateAccountUsage,
  updateAccountUserDataDir as updateAccountUserDataDirRepo,
  deleteAccount as deleteAccountRow,
  findAccountsNeedingRefresh,
} from '../repositories/account.repository';
import {
  ensureProviderExists,
  findProviderById,
} from '../repositories/provider.repository';

// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ── Types ──
import type { AccountRow } from '../repositories/account.repository';

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface AccountInput {
  id?: string;
  provider_id: string;
  email: string;
  credential?: string;
  user_data_dir?: string | null;
}

export interface ListAccountsOptions {
  page?: number;
  limit?: number;
  email?: string;
  provider_id?: string;
  sort_by?: string;
  order?: 'ASC' | 'DESC';
}

export interface ImportAccountsResult {
  imported: number;
  skipped: number;
  duplicates: Array<{ email: string; provider_id: string }>;
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Lấy account theo ID
 */
export function getAccountById(accountId: string): AccountRow | undefined {
  return findAccountById(accountId) || undefined;
}

/**
 * Lấy account theo email và provider
 */
export function getAccountByEmailAndProvider(
  email: string,
  providerId: string,
): AccountRow | undefined {
  return findAccountByEmailAndProvider(email, providerId) || undefined;
}

/**
 * Lấy account theo ID hoặc email+provider
 */
export function getAccountByIdOrEmailProvider(
  id: string | undefined,
  email: string,
  providerId: string,
): AccountRow | undefined {
  if (id) {
    return findAccountByIdOrEmailProvider(id, email, providerId) || undefined;
  }
  return findAccountByEmailAndProvider(email, providerId) || undefined;
}

/**
 * Lấy danh sách accounts với phân trang
 */
export function getAccounts(options: ListAccountsOptions) {
  return listAccounts({
    page: options.page || 1,
    limit: options.limit || 10,
    email: options.email,
    provider_id: options.provider_id,
    sort_by: options.sort_by || 'email',
    order: options.order || 'ASC',
  });
}

/**
 * Thêm account mới
 */
export function createAccount(accountData: AccountInput): string {
  const id = accountData.id || require('crypto').randomUUID();
  insertAccount({
    id,
    provider_id: accountData.provider_id,
    email: accountData.email,
    credential: accountData.credential || null,
    user_data_dir: accountData.user_data_dir || null,
  });
  ensureProviderExists(
    accountData.provider_id.toLowerCase(),
    accountData.provider_id,
  );
  return id;
}

/**
 * Cập nhật credential của account
 */
export function updateAccount(accountId: string, credential: string): void {
  updateAccountCredential(accountId, credential);
}

export function updateAccountUserDataDir(
  accountId: string,
  userDataDir: string,
): void {
  updateAccountUserDataDirRepo(accountId, userDataDir);
}

/**
 * Cập nhật memory state của account
 */
export function updateMemoryState(
  accountId: string,
  isMemoryEnabled: boolean,
): void {
  updateAccountMemoryRepo(accountId, isMemoryEnabled);
}

/**
 * Xóa account
 */
export function removeAccount(accountId: string, providerId: string): void {
  deleteAccountRow(accountId);
  ensureProviderExists(providerId.toLowerCase(), providerId);
}

/**
 * Import hàng loạt accounts
 */
export function importAccounts(accounts: AccountInput[]): ImportAccountsResult {
  const duplicates: AccountInput[] = [];
  const toInsert: Array<{
    id: string;
    provider_id: string;
    email: string;
    credential: string;
  }> = [];

  for (const account of accounts) {
    const existing = findAccountByEmailAndProvider(
      account.email,
      account.provider_id,
    );
    if (existing) {
      duplicates.push(account);
    } else {
      // Generate id if not provided
      const id = account.id || require('crypto').randomUUID();
      toInsert.push({
        id,
        provider_id: account.provider_id,
        email: account.email,
        credential: account.credential || '',
      });
    }
  }

  if (toInsert.length > 0) {
    insertAccountsBatch(toInsert);

    const providerIds = [...new Set(toInsert.map((a) => a.provider_id))];
    for (const pid of providerIds) {
      ensureProviderExists(pid.toLowerCase(), pid);
    }
  }

  return {
    imported: toInsert.length,
    skipped: duplicates.length,
    duplicates: duplicates.map((d) => ({
      email: d.email,
      provider_id: d.provider_id,
    })),
  };
}

/**
 * Lấy provider config theo ID
 */
export function getProviderConfig(providerId: string) {
  return findProviderById(providerId);
}

/**
 * Cập nhật credential và last_refreshed_at
 */
export function updateAccountCredentialAndLastRefresh(
  accountId: string,
  credential: string,
  lastRefreshedAt: number,
): void {
  updateAccountCredentialAndRefresh(accountId, credential, lastRefreshedAt);
}

/**
 * Cập nhật usage và reset period
 */
export function updateAccountUsageInfo(
  accountId: string,
  usage: string,
  resetPeriod: string,
): void {
  updateAccountUsage(accountId, usage, resetPeriod);
}

/**
 * Refresh token qua provider
 */
export async function refreshAccountToken(
  providerId: string,
  refreshToken: string,
): Promise<{
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresIn?: number;
  expires_in?: number;
} | null> {
  const provider = providerRegistry.getProvider(providerId);

  if (!provider?.refreshToken) {
    return null;
  }

  try {
    return await provider.refreshToken(refreshToken);
  } catch (error) {
    throw error;
  }
}

/**
 * Lấy usage từ provider
 */
export async function getAccountUsageFromProvider(
  providerId: string,
  credential: string,
): Promise<{ usage: string; resetPeriod: string } | null> {
  const provider = providerRegistry.getProvider(providerId);

  if (!provider?.getUsage) {
    return null;
  }

  try {
    return await provider.getUsage(credential);
  } catch (error) {
    throw error;
  }
}

// ─── Account Refresh Background Service ────────────────────────────────

const logger = createLogger('AccountService');

/**
 * Account Refresh Service Class
 * Tự động refresh token và cập nhật usage cho các tài khoản
 */
export class AccountRefreshService {
  private interval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour
  private readonly AUTO_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Khởi động background service
   */
  start() {
    if (this.interval) return;
    setTimeout(() => this.checkAndRefresh(), 30000);
    this.interval = setInterval(
      () => this.checkAndRefresh(),
      this.REFRESH_INTERVAL,
    );
  }

  /**
   * Dừng background service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Kiểm tra và refresh token cho tất cả accounts
   */
  async checkAndRefresh() {
    const accounts = findAccountsNeedingRefresh(this.AUTO_REFRESH_THRESHOLD);

    for (const account of accounts) {
      try {
        let credential: any;
        try {
          credential = JSON.parse(account.credential || '{}');
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

        // Check if token needs refresh
        if (
          refreshToken &&
          now - lastRefreshed >= this.AUTO_REFRESH_THRESHOLD
        ) {
          try {
            const newTokens = await refreshAccountToken(
              account.provider_id,
              refreshToken,
            );

            if (newTokens) {
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

              updateAccountCredentialAndLastRefresh(
                account.id,
                JSON.stringify(updatedCredential),
                now,
              );
              credential = updatedCredential;
            }
          } catch (err: any) {
            logger.error(
              `Token refresh failed — ${account.email}: ${err.message}`,
            );
          }
        }

        // Refresh usage only when reset period has elapsed
        if (this.shouldRefreshUsage(account)) {
          await this.refreshUsage(account.id);
        }
      } catch (e: any) {
        logger.error(`Error processing account ${account.id}: ${e.message}`);
      }
    }
  }

  /**
   * Kiểm tra xem account có cần refresh usage theo chu kỳ reset không.
   * ceiling: dùng last_refreshed_at làm proxy vì chưa có last_usage_refreshed_at riêng.
   * upgrade path: thêm field riêng khi cần tách chính xác.
   */
  private shouldRefreshUsage(account: AccountRow): boolean {
    const period = account.reset_period;
    const lastRefreshed = account.last_refreshed_at || 0;
    if (!period) return false;
    const now = Date.now();
    const interval =
      period === 'month' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    return now - lastRefreshed >= interval;
  }

  /**
   * Cập nhật usage cho một account
   */
  async refreshUsage(accountId: string) {
    const account = getAccountById(accountId);
    if (!account) return;

    try {
      let credential: any;
      try {
        credential = JSON.parse(account.credential || '{}');
      } catch (e) {
        credential = { accessToken: account.credential };
      }

      const usageInfo = await getAccountUsageFromProvider(
        account.provider_id,
        JSON.stringify(credential),
      );

      if (usageInfo) {
        updateAccountUsageInfo(
          account.id,
          usageInfo.usage,
          usageInfo.resetPeriod,
        );
      }
    } catch (err: any) {
      logger.warn(`Usage fetch failed — ${account.email}: ${err.message}`);
    }
  }
}

/**
 * Singleton instance của AccountRefreshService
 */
export const accountRefreshService = new AccountRefreshService();
