import { ipcMain, dialog, app, BrowserWindow, session, net } from 'electron';
import fs from 'fs';
import path, { join } from 'path';

const crypto = require('crypto');

import { fetchMistralProfile } from '../server/mistral';
import { login as loginKimi, getProfile as getKimiProfile } from '../server/kimi';
import { login as loginQwen, getProfile as getQwenProfile } from '../server/qwen';
import { login as loginCohere, getProfile as getCohereProfile } from '../server/cohere';
import { login as loginGroq } from '../server/groq';
import { login as loginGemini } from '../server/gemini';
import { login as loginPerplexity } from '../server/perplexity';

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
    | 'ChatGPT'
    | 'Mistral'
    | 'Kimi'
    | 'Qwen'
    | 'Cohere'
    | 'Perplexity'
    | 'Groq'
    | 'Gemini';
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
  name?: string;
  picture?: string;
  headers?: any;
}

const getSafeUserAgent = () => {
  // Use a static, realistic Chrome User-Agent to avoid bot detection
  return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
};

const fetchDeepSeekProfile = (
  token: string,
): Promise<{ email: string | null; name: string | null; picture: string | null }> => {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: 'https://chat.deepseek.com/api/v0/users/current',
      useSessionCookies: true,
    });
    request.setHeader('Authorization', token);
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Try multiple possible paths based on observations
          const email =
            json.data?.email ||
            json.data?.user?.email ||
            json.data?.biz_data?.email ||
            json.data?.biz_data?.user?.email ||
            json.data?.biz_data?.user?.id_profile?.email ||
            json.data?.biz_data?.id_profile?.email;

          const name =
            json.data?.name ||
            json.data?.user?.name ||
            json.data?.biz_data?.name ||
            json.data?.biz_data?.user?.name ||
            json.data?.biz_data?.user?.id_profile?.name ||
            json.data?.biz_data?.id_profile?.name;

          const picture =
            json.data?.picture ||
            json.data?.user?.picture ||
            json.data?.biz_data?.picture ||
            json.data?.biz_data?.user?.picture ||
            json.data?.biz_data?.user?.id_profile?.picture ||
            json.data?.biz_data?.id_profile?.picture;

          if (email || name) {
            resolve({
              email: email || (name ? name + '@deepseek.user' : null),
              name: name || null,
              picture: picture || null,
            });
          } else {
            resolve({ email: null, name: null, picture: null });
          }
        } catch (e) {
          console.error('[DeepSeek] JSON Parse Error:', e);
          resolve({ email: null, name: null, picture: null });
        }
      });
    });
    request.on('error', (e) => {
      console.error('[DeepSeek] API Request Error:', e);
      resolve({ email: null, name: null, picture: null });
    });
    request.end();
  });
};

export const setupAccountsHandlers = () => {
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

  const fetchClaudeProfile = (
    sessionKey: string,
  ): Promise<{ email: string | null; name: string | null; picture: string | null }> => {
    return new Promise((resolve) => {
      // Try organizations API first which includes account info
      const request = net.request({
        method: 'GET',
        url: 'https://claude.ai/api/organizations',
      });

      request.setHeader('Cookie', `sessionKey=${sessionKey}`);
      request.setHeader('User-Agent', getSafeUserAgent());

      let data = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            // Organizations API returns an array with account info
            if (json && Array.isArray(json) && json.length > 0) {
              const org = json[0];

              // Try to extract email from organization name
              // Format: "email@domain.com's Organization"
              if (org.name && typeof org.name === 'string') {
                const emailMatch = org.name.match(/^(.+@.+\..+)'s Organization$/);
                if (emailMatch) {
                  const email = emailMatch[1];
                  resolve({
                    email: email,
                    name: email.split('@')[0],
                    picture: null,
                  });
                  return;
                }
              }

              // Check if there's account info in the organization
              if (org.created_by_account) {
                resolve({
                  email: org.created_by_account.email_address || null,
                  name:
                    org.created_by_account.full_name || org.created_by_account.display_name || null,
                  picture: null,
                });
                return;
              }
            }

            // Fallback: no account info found
            resolve({ email: null, name: null, picture: null });
          } catch (e) {
            console.error('[Claude] Error parsing organizations response:', e);
            resolve({ email: null, name: null, picture: null });
          }
        });
      });
      request.on('error', (e) => {
        console.error('[Claude] Organizations request error:', e);
        resolve({ email: null, name: null, picture: null });
      });
      request.end();
    });
  };

  ipcMain.handle(
    'accounts:login',
    async (
      _,
      provider:
        | 'Claude'
        | 'DeepSeek'
        | 'ChatGPT'
        | 'Mistral'
        | 'Kimi'
        | 'Qwen'
        | 'Cohere'
        | 'Groq'
        | 'Gemini'
        | 'Perplexity',
    ) => {
      return new Promise(async (resolve) => {
        // Use a consistent, real Chrome user agent by stripping Electron/App identifiers
        const userAgent = getSafeUserAgent();

        const partition = `persist:${provider.toLowerCase()}`;
        const authSession = session.fromPartition(partition);

        // Clear previous session data to ensure fresh login
        await authSession.clearStorageData();

        const url =
          provider === 'Claude'
            ? 'https://claude.ai/login'
            : provider === 'ChatGPT'
              ? 'https://chatgpt.com'
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
                          : 'https://chat.deepseek.com/login';

        // Handle providers with self-managed login (no polling needed)
        if (provider === 'Kimi') {
          try {
            console.log('[Accounts] Starting Kimi login flow...');
            const { cookies } = await loginKimi();
            console.log('[Accounts] Kimi login success, fetching profile...');
            const profile = await getKimiProfile(cookies);
            console.log('[Accounts] Kimi profile fetched:', profile);
            const email = profile?.email || 'kimi@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Kimi',
              email: email,
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
              name: profile?.name || undefined,
              picture: profile?.avatar || undefined,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Kimi login failed' });
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
              name: profile?.name || undefined,
              picture: profile?.avatar || undefined,
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
            console.log('[Accounts] Starting Cohere login flow...');
            const { cookies } = await loginCohere();
            console.log('[Accounts] Cohere login success, fetching profile...');
            const profile = await getCohereProfile(cookies);
            console.log('[Accounts] Cohere profile fetched:', profile);
            const email = profile?.email || 'cohere@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Cohere',
              email: email,
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
              name: profile?.name || undefined,
              picture: profile?.avatar || undefined,
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
              name: undefined,
              picture: undefined,
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
            const { cookies, email } = await loginGemini();
            const finalEmail = email || 'gemini@user.com';

            const newAccount: Account = {
              id: crypto.randomUUID(),
              provider: 'Gemini',
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
              name: undefined,
              picture: undefined,
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
              name: undefined,
              picture: undefined,
            };

            saveAccount(newAccount);
            resolve({ success: true, account: newAccount });
          } catch (e: any) {
            resolve({ success: false, error: e.message || 'Perplexity login failed' });
          }
          return;
        }

        // For providers requiring polling (Claude, ChatGPT, Mistral, DeepSeek)
        const authWindow = new BrowserWindow({
          width: 1000,
          height: 800,
          title: `Login to ${provider}`,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition, // Use separate partition for isolation
            preload: join(__dirname, '../preload/auth-preload.js'),
            spellcheck: false,
            backgroundThrottling: false,
          },
        });

        authWindow.webContents.setUserAgent(userAgent);

        // Intercept login requests to capture email
        let capturedEmail: string | null = null;

        if (provider === 'DeepSeek') {
          authSession.webRequest.onBeforeRequest(
            { urls: ['https://chat.deepseek.com/api/v0/users/login'] },
            (details, callback) => {
              if (details.method === 'POST' && details.uploadData) {
                try {
                  const uploadItem = details.uploadData[0];
                  if (uploadItem.bytes) {
                    const bodyString = Buffer.from(uploadItem.bytes).toString('utf-8');
                    const parsed = JSON.parse(bodyString);
                    if (parsed.email) {
                      capturedEmail = parsed.email;
                    }
                  }
                } catch (e) {
                  console.error('[DeepSeek] Error parsing request body:', e);
                }
              }
              callback({});
            },
          );
        } else if (provider === 'Claude') {
          // Intercept Claude Google login response to capture email
          authSession.webRequest.onCompleted(
            { urls: ['https://claude.ai/api/auth/verify_google'] },
            () => {},
          );

          authSession.webRequest.onResponseStarted(
            { urls: ['https://claude.ai/api/auth/verify_google'] },
            async () => {},
          );
        }

        authWindow.loadURL(url);

        // Poll for credentials
        const interval = setInterval(async () => {
          if (authWindow.isDestroyed()) {
            clearInterval(interval);
            resolve({ success: false, error: 'Window closed' });
            return;
          }

          try {
            if (provider === 'Claude') {
              const cookies = await authWindow.webContents.session.cookies.get({
                domain: '.claude.ai',
              });
              const sessionKey = cookies.find((c) => c.name === 'sessionKey')?.value;

              if (sessionKey) {
                clearInterval(interval);
                const profile = await fetchClaudeProfile(sessionKey);
                const email = profile.email || 'claude@user.com';

                const newAccount: Account = {
                  id: crypto.randomUUID(),
                  provider: 'Claude',
                  email: email,
                  credential: sessionKey,
                  status: 'Active',
                  usage: '0',
                  totalRequests: 0,
                  successfulRequests: 0,
                  totalDuration: 0,
                  tokensToday: 0,
                  statsDate: new Date().toISOString().split('T')[0],
                  lastActive: new Date().toISOString(),
                  userAgent,
                  name: profile.name || undefined,
                  picture: profile.picture || undefined,
                };

                saveAccount(newAccount);
                authWindow.close();
                resolve({ success: true, account: newAccount });
              }
            } else if (provider === 'ChatGPT') {
              console.log('[Accounts] ChatGPT: Polling cookies...');
              const cookies = await authWindow.webContents.session.cookies.get({
                domain: '.chatgpt.com',
              });
              const sessionToken = cookies.find(
                (c) => c.name === '__Secure-next-auth.session-token',
              );

              if (sessionToken) {
                console.log('[Accounts] ChatGPT: Found session token!');
                clearInterval(interval);

                // Construct full cookie string to include Cloudflare and other necessary cookies
                const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

                // Fetch profile logic could be added here, similar to DeepSeek/Claude
                // For now, let's try to get email from the window or default
                let email = 'chatgpt@user.com';
                // Try to capture from script
                console.log('[Accounts] ChatGPT: Attempting to scrape email...');
                const scrapedEmail = await authWindow.webContents
                  .executeJavaScript(
                    `
                  (() => {
                      // Try typical selectors
                      const el = document.querySelector('div[data-testid="profile-button"]');
                      return el ? el.innerText : null;
                  })()
               `,
                  )
                  .catch((err) => {
                    console.error('[Accounts] ChatGPT: Email scrape error:', err);
                    return null;
                  });

                if (scrapedEmail && scrapedEmail.includes('@')) {
                  email = scrapedEmail;
                  console.log('[Accounts] ChatGPT: Scraped email:', email);
                } else {
                  console.log('[Accounts] ChatGPT: Could not scrape email, using default.');
                }

                const newAccount: Account = {
                  id: crypto.randomUUID(),
                  provider: 'ChatGPT',
                  email: email,
                  credential: cookieString, // Store the full cookie string
                  status: 'Active',
                  usage: '0',
                  totalRequests: 0,
                  successfulRequests: 0,
                  totalDuration: 0,
                  tokensToday: 0,
                  statsDate: new Date().toISOString().split('T')[0],
                  lastActive: new Date().toISOString(),
                  userAgent,
                  name: undefined,
                  picture: undefined,
                };

                saveAccount(newAccount);
                console.log('[Accounts] ChatGPT: Account saved successfully.');
                authWindow.close();
                resolve({ success: true, account: newAccount });
              }
            } else if (provider === 'Mistral') {
              const cookies = await authWindow.webContents.session.cookies.get({
                domain: 'mistral.ai',
              });
              // Try to find critical cookies that imply login
              // Based on logs: ory_session_... and csrftoken
              // ory_session prefix varies?
              const orySession = cookies.find((c) => c.name.startsWith('ory_session_'));

              if (orySession) {
                clearInterval(interval);
                // Reconstruct cookie string
                const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

                const profile = await fetchMistralProfile(cookieStr);
                const email = profile?.email || 'mistral@user.com';

                const newAccount: Account = {
                  id: crypto.randomUUID(),
                  provider: 'Mistral',
                  email: email,
                  credential: cookieStr,
                  status: 'Active',
                  usage: '0',
                  totalRequests: 0,
                  successfulRequests: 0,
                  totalDuration: 0,
                  tokensToday: 0,
                  statsDate: new Date().toISOString().split('T')[0],
                  lastActive: new Date().toISOString(),
                  userAgent,
                  name: profile?.name || undefined,
                  picture: profile?.avatar || undefined,
                };

                saveAccount(newAccount);
                authWindow.close();
                resolve({ success: true, account: newAccount });
              }
            } else {
              // DeepSeek - Check LocalStorage
              const localStorageData = await authWindow.webContents
                .executeJavaScript('JSON.stringify(localStorage)')
                .catch(() => null);
              if (localStorageData) {
                const data = JSON.parse(localStorageData);
                if (data.userToken) {
                  const tokenObj = JSON.parse(data.userToken);
                  if (tokenObj && tokenObj.value) {
                    clearInterval(interval);
                    const bearerToken = `Bearer ${tokenObj.value}`;

                    // Fetch profile via API
                    let profile = await fetchDeepSeekProfile(bearerToken);

                    // Use captured email if available (and not masked), otherwise use API email
                    if (capturedEmail && !capturedEmail.includes('***')) {
                      profile.email = capturedEmail;
                    }

                    // Fallback: Try to scrape from DOM if still no email
                    if (!profile.email) {
                      const scrapedEmail = await authWindow.webContents
                        .executeJavaScript(
                          `
                            (() => {
                                // Try common selectors for email/username
                                const el = document.querySelector('.user-email') || document.querySelector('.ds-avatar-name') || document.querySelector('[class*="user-info"]');
                                return el ? el.innerText : null;
                            })()
                          `,
                        )
                        .catch(() => null);
                      if (scrapedEmail) {
                        profile.email = scrapedEmail;
                      }
                    }

                    if (!profile.email) profile.email = 'deepseek@user.com';

                    const newAccount: Account = {
                      id: crypto.randomUUID(),
                      provider: 'DeepSeek',
                      email: profile.email,
                      credential: bearerToken,
                      status: 'Active',
                      usage: '0',
                      totalRequests: 0,
                      successfulRequests: 0,
                      totalDuration: 0,
                      tokensToday: 0,
                      statsDate: new Date().toISOString().split('T')[0],
                      lastActive: new Date().toISOString(),
                      userAgent,
                      name: profile.name || undefined,
                      picture: profile.picture || undefined,
                    };

                    saveAccount(newAccount);
                    authWindow.close();
                    resolve({ success: true, account: newAccount });
                  }
                }
              }
            }
          } catch (e) {
            // Log errors during polling for debugging
            if (provider === 'Claude') {
              console.error('[Claude] Error during login polling:', e);
            }
          }
        }, 1000);

        authWindow.on('closed', () => {
          clearInterval(interval);
          resolve({ success: false, error: 'Window closed' });
        });
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
      return { success: false, error: 'Failed to delete account' };
    }
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
