/// <reference types="vite/client" />
import { ipcMain, dialog, app, session } from 'electron';
import { getDb } from '@backend/services/db';
import fs from 'fs';
import path from 'path';
import { getProviders } from '../server/provider-registry';

const crypto = require('crypto');

// Backend API URL for providers
const getBackendApiUrl = () => {
  try {
    const { getProxyConfig } = require('../server/config');
    const config = getProxyConfig();
    return `http://localhost:${config.port}`;
  } catch (e) {
    return process.env.BACKEND_API_URL || 'http://localhost:11434';
  }
};
let cachedProviderIds: string[] = [];

/**
 * Update provider cache from backend API
 */
const updateProviderCache = async (retryCount = 0) => {
  try {
    const baseUrl = getBackendApiUrl();
    const response = await fetch(`${baseUrl}/v1/providers`);
    if (response.ok) {
      const json = await response.json();
      const data: any[] = json.data || [];
      if (Array.isArray(data)) {
        cachedProviderIds = data
          .filter((p) => p && p.provider_id)
          .map((p) => p.provider_id.toLowerCase());
        console.log(`[Accounts] Updated provider cache: ${cachedProviderIds.length} providers`);
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error: any) {
    const isConnRefused =
      error?.cause?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED');

    if (isConnRefused && retryCount < 5) {
      const delay = 1000 * Math.pow(2, retryCount); // 1s, 2s, 4s, 8s, 16s
      console.log(
        `[Accounts] Backend not ready, retrying in ${delay}ms... (Attempt ${retryCount + 1}/5)`,
      );
      setTimeout(() => updateProviderCache(retryCount + 1), delay);
    } else {
      console.error('[Accounts] Failed to fetch provider list from backend API:', error.message);
    }
  }
};

// Initial call with retry
setTimeout(() => updateProviderCache(), 2000); // Give backend a little head start
setInterval(() => updateProviderCache(), 1000 * 60 * 60);

const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

import type { Account } from '@backend/types';
export type { Account };

const providerModulesGlob = import.meta.glob('../server/provider/*/index.ts', { eager: true });

/**
 * Dynamically load a provider module from the provider folder (using glob for bundler support)
 */
async function loadProviderModule(providerId: string): Promise<any | null> {
  const normalizedId = providerId.toLowerCase();
  const moduleKey = Object.keys(providerModulesGlob).find((key) => {
    const parts = key.split('/');
    const folderName = parts[parts.length - 2];
    return (
      folderName.toLowerCase() === normalizedId ||
      folderName.toLowerCase().replace('-', '') === normalizedId
    );
  });

  if (moduleKey) {
    console.log(`[Accounts] Found provider module for ${providerId}: ${moduleKey}`);
    return providerModulesGlob[moduleKey];
  }

  console.warn(`[Accounts] No module found for provider: ${providerId}`);
  return null;
}

/**
 * Get login function from provider module
 */
function getLoginFunction(providerModule: any): Function | null {
  // Providers export login as a function
  if (typeof providerModule.login === 'function') {
    return providerModule.login;
  }
  return null;
}

export const setupAccountsHandlers = () => {
  ipcMain.handle('accounts:get-all', async () => {
    try {
      const db = getDb();
      return db.prepare('SELECT * FROM accounts').all();
    } catch (error) {
      console.error('Failed to read accounts from DB:', error);
      return [];
    }
  });

  ipcMain.handle('accounts:get-by-id', async (_, id: string) => {
    try {
      if (!fs.existsSync(DATA_FILE)) return null;
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const accounts: Account[] = JSON.parse(data);
      const account = accounts.find((acc) => acc.id === id);
      return account || null;
    } catch (error) {
      console.error('Failed to read account:', error);
      return null;
    }
  });

  ipcMain.handle('accounts:login', async (_, providerId: string, options?: any) => {
    return new Promise(async (resolve) => {
      try {
        const normalizedProviderId = providerId.toLowerCase();
        const partition = `persist:${normalizedProviderId}`;
        const authSession = session.fromPartition(partition);

        // Clear previous session data
        await authSession.clearStorageData();

        // Special handling for Antigravity (OAuth flow)
        if (normalizedProviderId === 'antigravity') {
          // Antigravity uses OAuth, handle separately
          resolve({ success: false, error: 'Use antigravity:prepare-oauth instead' });
          return;
        }

        // Load provider module dynamically
        const providerModule = await loadProviderModule(providerId);

        if (!providerModule) {
          resolve({
            success: false,
            error: `Provider module not found for: ${providerId}`,
          });
          return;
        }

        const loginFn = getLoginFunction(providerModule);

        if (!loginFn) {
          resolve({
            success: false,
            error: `Login function not found for provider: ${providerId}`,
          });
          return;
        }

        // Call the provider's login function
        const result = await loginFn(options);

        if (!result || (!result.cookies && !result.credential)) {
          resolve({
            success: false,
            error: `Login failed for ${providerId}: No credentials returned`,
          });
          return;
        }

        // Create account object
        const newAccount: Account = {
          id: crypto.randomUUID(),
          provider_id: normalizedProviderId,
          email: result.email || `${normalizedProviderId}@user.com`,
          credential: result.cookies || result.credential,
        };

        // Do not save automatically anymore. Return to frontend for confirmation.
        // saveAccount(newAccount);
        resolve({ success: true, account: newAccount });
      } catch (e: any) {
        console.error(`[Accounts] Login error for ${providerId}:`, e);
        resolve({ success: false, error: e.message || `${providerId} login failed` });
      }
    });
  });

  ipcMain.handle('accounts:create', async (_, account: Account) => {
    try {
      saveAccount(account);
      return { success: true, account };
    } catch (error: any) {
      console.error('[Accounts] Create error:', error);
      return { success: false, error: error.message };
    }
  });

  // Helper to save account
  const saveAccount = (account: Account) => {
    try {
      account.provider_id = account.provider_id.toLowerCase();

      if (cachedProviderIds.length > 0 && !cachedProviderIds.includes(account.provider_id)) {
        console.warn(
          `[Accounts] Warning: Saving account with unknown provider_id: ${account.provider_id}`,
        );
      }

      let accounts: Account[] = [];
      if (fs.existsSync(DATA_FILE)) {
        accounts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      }
      accounts.push(account);
      fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2));
    } catch (e) {
      console.error('Error saving account', e);
    }
  };

  ipcMain.handle('accounts:delete', async (_, id: string) => {
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      let accounts: Account[] = JSON.parse(data);
      accounts = accounts.filter((acc) => acc.id !== id);
      fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Failed to delete account:', error);
      return { success: false, error: 'Failed to delete account' };
    }
  });

  // Antigravity OAuth Flow Handlers
  let activeOAuthServer: any | null = null;

  ipcMain.handle('accounts:antigravity:prepare-oauth', async () => {
    try {
      // Dynamic import antigravity module
      const antigravityModule = await loadProviderModule('antigravity');
      if (!antigravityModule?.AntigravityAuthServer) {
        return { success: false, error: 'Antigravity module not found' };
      }

      if (activeOAuthServer) {
        activeOAuthServer.stop();
      }

      const { AntigravityAuthServer } = antigravityModule;
      activeOAuthServer = new AntigravityAuthServer();
      const url = await activeOAuthServer.start();
      return { success: true, url };
    } catch (error: any) {
      console.error('[Accounts] Antigravity Prepare OAuth Error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounts:antigravity:complete-oauth', async () => {
    if (!activeOAuthServer) {
      return { success: false, error: 'OAuth session not started' };
    }

    try {
      const code = await activeOAuthServer.waitForCode();
      const tokenRes: any = await activeOAuthServer.exchangeCode(code);
      const userInfo: any = await activeOAuthServer.getUserInfo(tokenRes.access_token);

      activeOAuthServer.stop();
      activeOAuthServer = null;

      const newAccount: Account = {
        id: crypto.randomUUID(),
        provider_id: 'antigravity',
        email: userInfo.email,
        credential: tokenRes.refresh_token || tokenRes.access_token,
      };

      saveAccount(newAccount);
      return { success: true, account: newAccount };
    } catch (error: any) {
      console.error('[Accounts] Antigravity Complete OAuth Error:', error);
      if (activeOAuthServer) {
        activeOAuthServer.stop();
        activeOAuthServer = null;
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounts:antigravity:add-by-token', async (_, refreshToken: string) => {
    try {
      const antigravityModule = await loadProviderModule('antigravity');
      if (!antigravityModule?.AntigravityAuthServer) {
        return { success: false, error: 'Antigravity module not found' };
      }

      const { AntigravityAuthServer } = antigravityModule;
      const tokenRes: any = await AntigravityAuthServer.refreshAccessToken(refreshToken);
      const userInfo: any = await new AntigravityAuthServer().getUserInfo(tokenRes.access_token);

      const newAccount: Account = {
        id: crypto.randomUUID(),
        provider_id: 'antigravity',
        email: userInfo.email,
        credential: tokenRes.refresh_token || refreshToken,
      };

      saveAccount(newAccount);
      return { success: true, account: newAccount };
    } catch (error: any) {
      console.error('[Accounts] Antigravity Token Add Error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    'accounts:update',
    async (_, { id, updates }: { id: string; updates: Partial<Account> }) => {
      try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        const accounts: Account[] = JSON.parse(data);
        const index = accounts.findIndex((acc) => acc.id === id);
        if (index !== -1) {
          accounts[index] = { ...accounts[index], ...updates };
          fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2));
          return { success: true, account: accounts[index] };
        }
        return { success: false, error: 'Account not found' };
      } catch (error) {
        return { success: false, error: 'Failed to update account' };
      }
    },
  );

  ipcMain.handle('accounts:import', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Accounts',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (canceled || !filePaths || filePaths.length === 0)
        return { success: false, canceled: true };

      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const importedAccounts: Account[] = JSON.parse(content);

      if (!Array.isArray(importedAccounts)) {
        return { success: false, error: 'Invalid file format: Not an array' };
      }

      let currentAccounts: Account[] = [];
      if (fs.existsSync(DATA_FILE)) {
        currentAccounts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      }

      let addedCount = 0;
      let updatedCount = 0;

      for (const imported of importedAccounts) {
        if (!imported.provider_id || !imported.email || !imported.credential) {
          continue;
        }

        const existingIndex = currentAccounts.findIndex(
          (acc) =>
            acc.id === imported.id ||
            (acc.provider_id === imported.provider_id && acc.email === imported.email),
        );

        if (existingIndex !== -1) {
          const existing = currentAccounts[existingIndex];
          currentAccounts[existingIndex] = {
            ...existing,
            ...imported,
          };
          updatedCount++;
        } else {
          if (!imported.id) imported.id = crypto.randomUUID();
          currentAccounts.push(imported);
          addedCount++;
        }
      }

      fs.writeFileSync(DATA_FILE, JSON.stringify(currentAccounts, null, 2));
      return { success: true, added: addedCount, updated: updatedCount };
    } catch (error: any) {
      console.error('Failed to import:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounts:export', async () => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export Accounts',
        defaultPath: path.join(app.getPath('downloads'), 'accounts_export.json'),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      fs.writeFileSync(filePath, data, 'utf-8');
      return { success: true, filePath };
    } catch (error) {
      console.error('Failed to export:', error);
      return { success: false, error: 'Failed to export accounts' };
    }
  });

  // Handler to get available providers (dynamic)
  ipcMain.handle('accounts:get-providers', async () => {
    try {
      const providers = await getProviders();
      return { success: true, providers };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
};

// Exported function for internal use
export const updateAccountDirectly = (
  provider: string,
  updates: Partial<Account>,
  matchFn?: (acc: Account) => boolean,
): boolean => {
  try {
    if (!fs.existsSync(DATA_FILE)) return false;
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    const accounts: Account[] = JSON.parse(data);

    let index = -1;
    if (matchFn) {
      index = accounts.findIndex(matchFn);
    } else {
      index = accounts.findIndex((acc) => acc.provider_id === provider.toLowerCase());
    }

    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2));
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[Accounts] Failed to update account for ${provider}:`, error);
    return false;
  }
};
