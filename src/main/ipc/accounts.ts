import { ipcMain, dialog, app, BrowserWindow, session, net } from 'electron';
import fs from 'fs';
import path, { join } from 'path';

const crypto = require('crypto');

import { fetchMistralProfile, login as loginMistral } from '../server/mistral';
import { login as loginKimi, getProfile as getKimiProfile } from '../server/kimi';
import { login as loginQwen, getProfile as getQwenProfile } from '../server/qwen';
import { login as loginCohere, getProfile as getCohereProfile } from '../server/cohere';
import { login as loginClaude } from '../server/claude';
import { login as loginGroq } from '../server/groq';
import { login as loginGemini } from '../server/gemini';
import { login as loginPerplexity } from '../server/perplexity';
import {
  login as loginHuggingChat,
  getProfile as getHuggingChatProfile,
} from '../server/hugging-chat';
import { login as lmArenaLogin } from '../server/lmarena';
import { AntigravityAuthServer } from '../server/antigravity';
import { login as loginStepFun } from '../server/stepfun';
import { login as loginDeepSeek } from '../server/deepseek';

import { proxyEvents } from '../server/proxy';

const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

export interface Account {
  metadata?: any;
  id: string;
  provider:
    | 'Claude'
    | 'DeepSeek'
    | 'Mistral'
    | 'Kimi'
    | 'Qwen'
    | 'Cohere'
    | 'Perplexity'
    | 'Groq'
    | 'Gemini'
    | 'Antigravity'
    | 'HuggingChat'
    | 'StepFun'
    | 'LMArena';

  email: string;
  credential: string; // cookie or api key
  status: 'Active' | 'Rate Limit' | 'Error';
  usage: string; // This might be legacy string usage, but we'll keep it for now or replace usage of it. User wanted "Total Token (Input+Output) Today" column. Usage field seems to be "0" originally.
  // New Stats
  // Lifetime Stats
  totalRequests: number;
  successfulRequests: number;
  totalDuration: number;
  // Today Stats
  tokensToday: number;
  statsDate: string; // YYYY-MM-DD
  lastActive?: string;
  userAgent?: string;
  headers?: any;
}

const getSafeUserAgent = () => {
  // Use a static, realistic Chrome User-Agent to avoid bot detection
  return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
};

export const setupAccountsHandlers = () => {
  // Listen for Groq SDK Client Header
  proxyEvents.on('groq-sdk-client', (headerValue: string) => {
    try {
      if (!fs.existsSync(DATA_FILE)) return;
      const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      // Find the active Groq account or any Groq account
      const index = accounts.findIndex((acc) => acc.provider === 'Groq' && acc.status === 'Active');

      if (index !== -1) {
        const acc = accounts[index];
        const currentHeaders = acc.headers || {};

        // Update if missing or changed
        if (currentHeaders['x-sdk-client'] !== headerValue) {
          acc.headers = { ...currentHeaders, 'x-sdk-client': headerValue };
          accounts[index] = acc;
          fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2));
          // console.log('[Accounts] Updated Groq x-sdk-client header');
        }
      }
    } catch (e) {
      console.error('[Accounts] Error processing Groq SDK header:', e);
    }
  });

  ipcMain.handle('accounts:get-all', async () => {
    try {
      if (!fs.existsSync(DATA_FILE)) return [];
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to read accounts:', error);
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
        const userAgent = getSafeUserAgent();

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
            const { cookies, email } = await loginKimi();
            const finalEmail = email || 'kimi@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Kimi',
              email: finalEmail,
              credential: cookies,
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, email } = await loginMistral();
            const finalEmail = email || 'mistral@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Mistral',
              email: finalEmail,
              credential: cookies,
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, email } = await loginClaude(options);
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
              provider: 'Claude',
              email: finalEmail,
              credential: cookies, // This is sessionKey
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, headers } = await loginQwen();
            console.log('[Accounts] Qwen login success, fetching profile...');
            const profile = await getQwenProfile(cookies);
            console.log('[Accounts] Qwen profile fetched:', profile);
            const email = profile?.email || 'qwen@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Qwen',
              email: email,
              credential: cookies,
              headers: headers, // Save headers
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, email } = await loginCohere();
            const finalEmail = email || 'cohere@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Cohere',
              email: finalEmail,
              credential: cookies,
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, email } = await loginGroq();
            const finalEmail = email || 'groq@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Groq',
              email: finalEmail,
              credential: cookies,
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, email, metadata } = await loginGemini();
            const finalEmail = email || 'gemini@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Gemini',
              email: finalEmail,
              credential: cookies,
              metadata, // Save the critical tokens here
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, email } = await loginPerplexity();
            const finalEmail = email || 'perplexity@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Perplexity',
              email: finalEmail,
              credential: cookies,
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            console.log('[Accounts] HuggingChat login success, fetching profile...');
            const { cookies, email } = await loginHuggingChat();
            const profile = await getHuggingChatProfile(cookies);
            console.log('[Accounts] HuggingChat profile fetched:', profile);
            const finalEmail = email || profile.email || 'huggingchat@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'HuggingChat',
              email: finalEmail,
              credential: cookies,
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, email } = await lmArenaLogin();
            console.log('[Accounts] LMArena login success, email:', email);

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'LMArena',
              email: email || 'lmarena@user.com',
              credential: cookies,
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, email } = await loginStepFun();
            console.log('[Accounts] StepFun login success. Email:', email);

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'StepFun',
              email: email || 'stepfun@user.com',
              credential: cookies,
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
            const { cookies, email } = await loginDeepSeek(options);
            console.log('[Accounts] DeepSeek login success. Email:', email);

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'DeepSeek',
              email: email || 'deepseek@user.com',
              credential: cookies,
              status: 'Active',
              usage: '0',
              totalRequests: 0,
              successfulRequests: 0,
              totalDuration: 0,
              tokensToday: 0,
              statsDate: new Date().toISOString().split('T')[0],
              lastActive: new Date().toISOString(),
              userAgent,
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
        provider: 'Antigravity',
        email: email,
        credential: JSON.stringify(tokenRes), // Store full token response (access + refresh)
        status: 'Active',
        usage: '0',
        totalRequests: 0,
        successfulRequests: 0,
        totalDuration: 0,
        tokensToday: 0,
        statsDate: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString(),
        userAgent: getSafeUserAgent(),
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
        provider: 'Antigravity',
        email: email,
        credential: JSON.stringify(tokenRes),
        status: 'Active',
        usage: '0',
        totalRequests: 0,
        successfulRequests: 0,
        totalDuration: 0,
        tokensToday: 0,
        statsDate: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString(),
        userAgent: getSafeUserAgent(),
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
        if (!imported.provider || !imported.email || !imported.credential) {
          continue;
        }

        const existingIndex = currentAccounts.findIndex(
          (acc) =>
            acc.id === imported.id ||
            (acc.provider === imported.provider && acc.email === imported.email),
        );

        if (existingIndex !== -1) {
          // Merge logic: Update credentials and status, preserve stats if existing has them
          const existing = currentAccounts[existingIndex];
          currentAccounts[existingIndex] = {
            ...existing,
            ...imported,
            // Preserve stats if imported ones are 0 or undefined, but prioritize real data
            // A simple strategy: overwrite everything but maybe keep usage stats if imported is 0?
            // Actually, usually import overwrites. But let's assume we want to just import valid accounts.
            // If we treat import as "Restore", we overwrite.
          };
          updatedCount++;
        } else {
          // New account
          if (!imported.id) imported.id = crypto.randomUUID();
          // Initialize stats if missing
          if (imported.totalRequests === undefined) imported.totalRequests = 0;
          if (imported.successfulRequests === undefined) imported.successfulRequests = 0;
          if (imported.totalDuration === undefined) imported.totalDuration = 0;
          if (imported.tokensToday === undefined) imported.tokensToday = 0;
          if (imported.statsDate === undefined)
            imported.statsDate = new Date().toISOString().split('T')[0];

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
  provider: Account['provider'],
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
      index = accounts.findIndex((acc) => acc.provider === provider);
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
