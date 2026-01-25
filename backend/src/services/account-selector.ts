import { getDB } from '../utils/database';
import type { Account } from '../utils/database';

export type { Account };

export type SelectionStrategy = 'round-robin' | 'priority' | 'least-used';

export class AccountSelector {
  private roundRobinIndex: Map<string, number> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private db = getDB();

  /**
   * Select an account based on the strategy
   */
  selectAccount(
    provider?: string,
    strategy: SelectionStrategy = 'round-robin',
    email?: string,
  ): Account | null {
    const accounts = this.getActiveAccounts(provider);

    if (accounts.length === 0) {
      return null;
    }

    // If email is specified, try to find that specific account
    if (email) {
      const account = accounts.find(
        (a) => a.email.toLowerCase() === email.toLowerCase(),
      );
      if (account) return account;
    }

    // Otherwise use selection strategy
    switch (strategy) {
      case 'round-robin':
        return this.roundRobin(provider || 'default', accounts);
      case 'priority':
        return this.priority(accounts);
      case 'least-used':
        return this.leastUsed(accounts);
      default:
        return accounts[0];
    }
  }

  /**
   * Get all active accounts, optionally filtered by provider
   */
  getActiveAccounts(provider_id?: string): Account[] {
    try {
      const accounts = this.db.getAll();
      let filtered = accounts;

      if (provider_id) {
        const pid = provider_id.toLowerCase();
        filtered = filtered.filter((a) => a.provider_id.toLowerCase() === pid);
      }

      return filtered;
    } catch (error) {
      console.error('[AccountSelector] Failed to get accounts:', error);
      return [];
    }
  }

  /**
   * Get all accounts from a specific account ID
   */
  getAccountById(id: string): Account | null {
    try {
      return this.db.getById(id);
    } catch (error) {
      console.error('[AccountSelector] Failed to get account by ID:', error);
      return null;
    }
  }

  /**
   * Round-robin selection
   */
  private roundRobin(key: string, accounts: Account[]): Account {
    const index = this.roundRobinIndex.get(key) || 0;
    const account = accounts[index % accounts.length];
    this.roundRobinIndex.set(key, index + 1);

    console.log(
      `[AccountSelector] Round-robin selected: ${account.email} (${account.provider_id})`,
    );
    return account;
  }

  /**
   * Priority-based selection (first account has highest priority)
   */
  private priority(accounts: Account[]): Account {
    // You could extend Account interface to include priority field
    // For now, just return first account
    const account = accounts[0];
    console.log(
      `[AccountSelector] Priority selected: ${account.email} (${account.provider_id})`,
    );
    return account;
  }

  /**
   * Least-used selection (based on request count tracking)
   */
  private leastUsed(accounts: Account[]): Account {
    let minCount = Infinity;
    let selectedAccount = accounts[0];

    for (const account of accounts) {
      const count = this.requestCounts.get(account.id) || 0;
      if (count < minCount) {
        minCount = count;
        selectedAccount = account;
      }
    }

    console.log(
      `[AccountSelector] Least-used selected: ${selectedAccount.email} (${selectedAccount.provider_id})`,
    );
    return selectedAccount;
  }

  trackRequest(accountId: string): void {
    const count = this.requestCounts.get(accountId) || 0;
    this.requestCounts.set(accountId, count + 1);
  }

  /**
   * Reset request counts
   */
  resetCounts(): void {
    this.requestCounts.clear();
  }

  /**
   * Get request count for an account
   */
  getRequestCount(accountId: string): number {
    return this.requestCounts.get(accountId) || 0;
  }
}

// Singleton instance
let accountSelector: AccountSelector | null = null;

export const getAccountSelector = (): AccountSelector => {
  if (!accountSelector) {
    accountSelector = new AccountSelector();
  }
  return accountSelector;
};

/**
 * Find account from request (like the old account-utils but using DB)
 */
export const findAccount = (
  req: { headers: { authorization?: string }; query: { email?: string } },
  provider: string,
  email?: string,
): Account | null => {
  const selector = getAccountSelector();
  const accounts = selector.getActiveAccounts(provider);
  const authHeader = req.headers.authorization;
  const emailQuery = email || (req.query.email as string);

  let account: Account | null = null;

  // 1. Try by Token (ID) from Authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    account = accounts.find((a) => a.id === token) || null;
  }

  // 2. Try by Email + Provider
  if (!account && emailQuery) {
    account =
      accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase(),
      ) || null;
  }

  // 3. Fall back to any active account for provider
  if (!account && accounts.length > 0) {
    account = accounts[0];
  }

  return account;
};
