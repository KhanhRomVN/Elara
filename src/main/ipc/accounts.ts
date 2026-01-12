import { ipcMain, dialog, app, BrowserWindow, session, net } from 'electron';
import fs from 'fs';
import path, { join } from 'path';

const crypto = require('crypto');

const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

export interface Account {
  id: string;
  provider: 'Claude' | 'DeepSeek';
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
}

const getSafeUserAgent = () => {
  // Use a static, realistic Chrome User-Agent to avoid bot detection
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
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

  ipcMain.handle('accounts:login', async (_, provider: 'Claude' | 'DeepSeek') => {
    return new Promise(async (resolve) => {
      // Use a consistent, real Chrome user agent by stripping Electron/App identifiers
      const userAgent = getSafeUserAgent();

      const partition = `persist:${provider.toLowerCase()}`;
      const authSession = session.fromPartition(partition);

      // Clear previous session data to ensure fresh login
      await authSession.clearStorageData();

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

      const url =
        provider === 'Claude' ? 'https://claude.ai/login' : 'https://chat.deepseek.com/login';

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
  });

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
