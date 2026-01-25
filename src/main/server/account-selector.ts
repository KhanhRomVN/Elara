import { Account } from '../ipc/accounts';
import { app } from 'electron';
import { getDb } from '@backend/services/db';

export type SelectionStrategy = 'round-robin' | 'priority' | 'least-used';

export class AccountSelector {
  private roundRobinIndex: Map<string, number> = new Map();
  private requestCounts: Map<string, number> = new Map();

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
      const account = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
      if (account) return account;
    }

    // Otherwise use selection strategy
    switch (strategy) {
      case 'round-robin':
        return this.roundRobin(provider || 'default', accounts);
      case 'priority':
        return this.priority(accounts);
      default:
        return accounts[0];
    }
  }

  /**
   * Get all active accounts, optionally filtered by provider
   */
  getActiveAccounts(provider?: string): Account[] {
    try {
      const db = getDb();
      const accounts = db.prepare('SELECT * FROM accounts').all() as Account[];

      if (provider) {
        const pid = provider.toLowerCase();
        return accounts.filter((a) => a.provider_id.toLowerCase() === pid);
      }

      return accounts;
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
      const db = getDb();
      return (db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account) || null;
    } catch (error) {
      console.error('[AccountSelector] Failed to get account by ID:', error);
      return null;
    }
  }

  getRequestCount(id: string): number {
    return this.requestCounts.get(id) || 0;
  }

  resetCounts(): void {
    this.requestCounts.clear();
  }

  /**
   * Round-robin selection
   */
  private roundRobin(key: string, accounts: Account[]): Account {
    const index = this.roundRobinIndex.get(key) || 0;
    const account = accounts[index % accounts.length];
    this.roundRobinIndex.set(key, index + 1);

    // Increment request count
    const currentCount = this.requestCounts.get(account.id) || 0;
    this.requestCounts.set(account.id, currentCount + 1);

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

    // Increment request count
    const currentCount = this.requestCounts.get(account.id) || 0;
    this.requestCounts.set(account.id, currentCount + 1);

    console.log(`[AccountSelector] Priority selected: ${account.email} (${account.provider_id})`);
    return account;
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
