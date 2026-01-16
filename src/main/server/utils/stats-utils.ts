import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Account } from '../../ipc/accounts';

const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');

export const updateAccountStats = (
  accountId: string,
  stats: { tokens: number; duration: number; success: boolean },
) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const index = accounts.findIndex((a) => a.id === accountId);
    if (index === -1) return;

    const account = accounts[index];
    const today = new Date().toISOString().split('T')[0];

    // Initialize if missing
    if (account.totalRequests === undefined) account.totalRequests = 0;
    if (account.successfulRequests === undefined) account.successfulRequests = 0;
    if (account.totalDuration === undefined) account.totalDuration = 0;
    if (account.tokensToday === undefined) account.tokensToday = 0;
    if (account.statsDate === undefined) account.statsDate = today;

    // Reset daily
    if (account.statsDate !== today) {
      account.tokensToday = 0;
      account.statsDate = today;
    }

    account.totalRequests++;
    if (stats.success) account.successfulRequests++;
    account.totalDuration += stats.duration;
    account.tokensToday += stats.tokens;
    account.lastActive = new Date().toISOString();

    accounts[index] = account;
    fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2));
  } catch (e) {
    console.error('Failed to update account stats', e);
  }
};
