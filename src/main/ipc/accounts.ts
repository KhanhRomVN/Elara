import { ipcMain, dialog, app, session } from 'electron';
import { getDb } from '@backend/services/db';
import fs from 'fs';
import path from 'path';

const crypto = require('crypto');

import { DynamicProviderManager } from '../server/dynamic-provider';

import * as MistralModule from '../server/mistral';
import * as KimiModule from '../server/kimi';
import * as QwenModule from '../server/qwen';
import * as CohereModule from '../server/cohere';
import * as ClaudeModule from '../server/claude';
import * as GroqModule from '../server/groq';
import * as GeminiModule from '../server/gemini';
import * as PerplexityModule from '../server/perplexity';
import * as HuggingChatModule from '../server/hugging-chat';
import * as LmArenaModule from '../server/lmarena';
import { AntigravityAuthServer } from '../server/antigravity';
import * as StepFunModule from '../server/stepfun';
import * as DeepSeekModule from '../server/deepseek';

const PROVIDER_URL = 'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/provider.json';
let cachedProviderIds: string[] = [];

const updateProviderCache = async () => {
  try {
    const response = await fetch(PROVIDER_URL);
    if (response.ok) {
      const data: any[] = await response.json();
      if (Array.isArray(data)) {
        cachedProviderIds = data
          .filter((p) => p && p.provider_id) // Filter out invalid entries
          .map((p) => p.provider_id.toLowerCase());
        console.log('[Accounts] Fetched valid provider IDs:', cachedProviderIds);
      }
    }
  } catch (error) {
    console.error('[Accounts] Failed to fetch provider list:', error);
  }
};

updateProviderCache();
setInterval(updateProviderCache, 1000 * 60 * 60); // Refresh every hour

const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

export interface Account {
  id: string;
  provider_id: string;
  email: string;
  credential: string;
}

// getSafeUserAgent removed

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

  ipcMain.handle(
    'accounts:login',
    async (
      _,
      provider:
        | 'Claude'
        | 'DeepSeek'
        | 'Mistral'
        | 'Kimi'
        | 'Qwen'
        | 'Cohere'
        | 'Groq'
        | 'Gemini'
        | 'Groq'
        | 'Gemini'
        | 'Perplexity'
        | 'HuggingChat'
        | 'StepFun'
        | 'LMArena',
      options?: any,
    ) => {
      return new Promise(async (resolve) => {
        // Use a consistent, real Chrome user agent by stripping Electron/App identifiers
        // const userAgent = getSafeUserAgent();

        const partition = `persist:${provider.toLowerCase()}`;
        const authSession = session.fromPartition(partition);

        // Clear previous session data to ensure fresh login
        await authSession.clearStorageData();

        /*
          provider === 'Claude'
            ? 'https://claude.ai/login'
            : provider === 'Mistral'
              ? 'https://console.mistral.ai/home'
              : provider === 'Kimi'
                ? 'https://kimi.moonshot.cn'
                : provider === 'Qwen'
                  ? 'https://chat.qwen.ai/auth'
                  : provider === 'Cohere'
                    ? 'https://dashboard.cohere.com/welcome/login'
                    : provider === 'Groq'
                      ? 'https://console.groq.com'
                      : provider === 'Gemini'
                        ? 'https://gemini.google.com'
                        : provider === 'HuggingChat'
                          ? 'https://huggingface.co/login'
                          : 'https://chat.deepseek.com/login';
          */

        // Handle providers with self-managed login (no polling needed)
        // Handle Kimi
        if (provider === 'Kimi') {
          try {
            console.log('[Accounts] Starting Kimi login flow (Real Browser)...');
            const mod = DynamicProviderManager.getInstance().getProvider('Kimi', KimiModule);
            const { cookies, email } = await mod.login();
            const finalEmail = email || 'kimi@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'Kimi',
              email: finalEmail,
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Kimi login failed' });
          }
          return;
        }

        // Handle Mistral
        if (provider === 'Mistral') {
          try {
            console.log('[Accounts] Starting Mistral login flow (Real Browser)...');
            const mod = DynamicProviderManager.getInstance().getProvider('Mistral', MistralModule);
            const { cookies, email } = await mod.login();
            const finalEmail = email || 'mistral@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'Mistral',
              email: finalEmail,
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Mistral login failed' });
          }
          return;
        }

        // Handle Claude
        if (provider === 'Claude') {
          try {
            console.log(
              '[Accounts] Starting Claude login flow (Real Browser)... Options:',
              options,
            );
            const mod = DynamicProviderManager.getInstance().getProvider('Claude', ClaudeModule);
            const { cookies, email } = await mod.login(options);
            // try fetching profile to get email if not captured
            let finalEmail = email;
            if (!finalEmail) {
              // We can't easily fetch profile without exposing the logic or duplicating it.
              // But browser-login might have captured it if we added validation logic.
              // In claude.ts validation we didn't extract email yet.
              finalEmail = 'claude@user.com';
            }

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'Claude',
              email: finalEmail,
              credential: cookies, // This is sessionKey
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Claude login failed' });
          }
          return;
        }

        if (provider === 'Qwen') {
          try {
            console.log('[Accounts] Starting Qwen login flow...');
            // @ts-ignore
            const mod = DynamicProviderManager.getInstance().getProvider('Qwen', QwenModule);
            const { cookies } = await mod.login();
            console.log('[Accounts] Qwen login success');
            const email = 'qwen@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'Qwen',
              email: email,
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Qwen login failed' });
          }
          return;
        }

        if (provider === 'Cohere') {
          try {
            console.log('[Accounts] Starting Cohere login flow (Real Browser)...');
            const mod = DynamicProviderManager.getInstance().getProvider('Cohere', CohereModule);
            const { cookies, email } = await mod.login();
            const finalEmail = email || 'cohere@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'Cohere',
              email: finalEmail,
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Cohere login failed' });
          }
          return;
        }

        if (provider === 'Groq') {
          try {
            console.log('[Accounts] Starting Groq login flow (Real Browser)...');
            const mod = DynamicProviderManager.getInstance().getProvider('Groq', GroqModule);
            const { cookies, email } = await mod.login();
            const finalEmail = email || 'groq@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'Groq',
              email: finalEmail,
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Groq login failed' });
          }
          return;
        }

        if (provider === 'Gemini') {
          try {
            console.log('[Accounts] Starting Gemini login flow (Real Browser)...');
            const mod = DynamicProviderManager.getInstance().getProvider('Gemini', GeminiModule);
            const { cookies, email } = await mod.login();
            const finalEmail = email || 'gemini@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'Gemini',
              email: finalEmail,
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Gemini login failed' });
          }
          return;
        }

        if (provider === 'Perplexity') {
          try {
            console.log('[Accounts] Starting Perplexity login flow (Real Browser)...');
            // The frontend will detect this specific fallback email and trigger the manual input dialog
            const mod = DynamicProviderManager.getInstance().getProvider(
              'Perplexity',
              PerplexityModule,
            );
            const { cookies, email } = await mod.login();
            const finalEmail = email || 'perplexity@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'Perplexity',
              email: finalEmail,
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Perplexity login failed' });
          }
          return;
        }

        if (provider === 'HuggingChat') {
          try {
            console.log('[Accounts] Starting HuggingChat login flow...');
            console.log('[Accounts] HuggingChat login success');
            const mod = DynamicProviderManager.getInstance().getProvider(
              'HuggingChat',
              HuggingChatModule,
            );
            const { cookies, email } = await mod.login();
            const finalEmail = email || 'huggingchat@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'HuggingChat',
              email: finalEmail,
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'HuggingChat login failed' });
          }
          return;
        }

        if (provider === 'LMArena') {
          try {
            console.log('[Accounts] Starting LMArena login flow...');
            const mod = DynamicProviderManager.getInstance().getProvider('LMArena', LmArenaModule);
            const { cookies, email } = await mod.login();
            console.log('[Accounts] LMArena login success, email:', email);

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'LMArena',
              email: email || 'lmarena@user.com',
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'LMArena login failed' });
          }
          return;
        }

        if (provider === 'StepFun') {
          try {
            console.log('[Accounts] Starting StepFun login flow (Real Browser)...');
            const mod = DynamicProviderManager.getInstance().getProvider('StepFun', StepFunModule);
            const { cookies, email } = await mod.login();
            console.log('[Accounts] StepFun login success. Email:', email);

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'StepFun',
              email: email || 'stepfun@user.com',
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'StepFun login failed' });
          }
          return;
        }

        if (provider === 'DeepSeek') {
          try {
            console.log(
              '[Accounts] Starting DeepSeek login flow (Real Browser)... Options:',
              options,
            );
            const mod = DynamicProviderManager.getInstance().getProvider(
              'DeepSeek',
              DeepSeekModule,
            );
            const { cookies, email } = await mod.login(options);
            console.log('[Accounts] DeepSeek login success. Email:', email);

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider_id: 'deepseek',
              email: email || 'deepseek@user.com',
              credential: cookies,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'DeepSeek login failed' });
          }
          return;
        }
      });
    },
  );

  // Helper to append account
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
  let activeOAuthServer: AntigravityAuthServer | null = null;

  ipcMain.handle('accounts:antigravity:prepare-oauth', async () => {
    try {
      if (activeOAuthServer) {
        activeOAuthServer.stop();
      }
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

      // Create Account
      const email = userInfo.email;
      const newAccount: Account = {
        id: crypto.randomUUID(),
        provider_id: 'Antigravity',
        email: email,
        credential: JSON.stringify(tokenRes), // Store full token response (access + refresh)
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

  // Handler for adding via Refresh Token manually
  ipcMain.handle('accounts:antigravity:add-by-token', async (_, refreshToken: string) => {
    try {
      const tokenRes: any = await AntigravityAuthServer.refreshAccessToken(refreshToken);
      const userInfo: any = await new AntigravityAuthServer().getUserInfo(tokenRes.access_token);

      // Inject the manual refresh token into the response if it wasn't returned (it usually isn't)
      if (!tokenRes.refresh_token) {
        tokenRes.refresh_token = refreshToken;
      }

      const email = userInfo.email;
      const newAccount: Account = {
        id: crypto.randomUUID(),
        provider_id: 'Antigravity',
        email: email,
        credential: JSON.stringify(tokenRes),
      };

      saveAccount(newAccount);
      return { success: true, account: newAccount };
    } catch (error: any) {
      console.error('[Accounts] Antigravity Token Add Error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounts:stepfun:login', async (_, {}: { email: string; code: string }) => {
    // Deprecated handler - kept just in case but shouldn't be called by frontend anymore
    return { success: false, error: "Please use the 'Login with StepFun' button instead." };
  });

  ipcMain.handle(
    'accounts:update',
    async (_, { id, updates }: { id: string; updates: Partial<Account> }) => {
      try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        let accounts: Account[] = JSON.parse(data);
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
        // Validate required fields
        if (!imported.provider_id || !imported.email || !imported.credential) {
          continue;
        }

        const existingIndex = currentAccounts.findIndex(
          (acc) =>
            acc.id === imported.id ||
            (acc.provider_id === imported.provider_id && acc.email === imported.email),
        );

        if (existingIndex !== -1) {
          // Merge logic: Update credentials and status, preserve stats if existing has them
          const existing = currentAccounts[existingIndex];
          currentAccounts[existingIndex] = {
            ...existing,
            ...imported,
          };
          updatedCount++;
        } else {
          // New account
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
};

// Exported function for internal use (e.g. from proxy listeners)
export const updateAccountDirectly = (
  provider: string,
  updates: Partial<Account>,
  matchFn?: (acc: Account) => boolean,
): boolean => {
  try {
    if (!fs.existsSync(DATA_FILE)) return false;
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    let accounts: Account[] = JSON.parse(data);

    let index = -1;
    if (matchFn) {
      index = accounts.findIndex(matchFn);
    } else {
      index = accounts.findIndex((acc) => acc.provider_id === provider);
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
