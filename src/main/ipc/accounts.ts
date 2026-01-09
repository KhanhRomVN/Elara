import { ipcMain, dialog, app, BrowserWindow, session, net } from 'electron';
import fs from 'fs';
import path from 'path';

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
  usage: string;
  lastActive?: string;
  userAgent?: string;
  name?: string;
  picture?: string;
}

const USER_AGENTS = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const fetchDeepSeekProfile = (
  token: string,
): Promise<{ email: string | null; name: string | null; picture: string | null }> => {
  return new Promise((resolve) => {
    console.log('[DeepSeek] Fetching user profile...');
    const request = net.request({
      method: 'GET',
      url: 'https://chat.deepseek.com/api/v0/users/current',
      useSessionCookies: true,
    });
    request.setHeader('Authorization', token);
    request.on('response', (response) => {
      console.log(`[DeepSeek] API Status: ${response.statusCode}`);
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        // console.log(`[DeepSeek] API Response: ${data}`); // Uncomment for full debug
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
            console.log('[DeepSeek] structure mismatch:', JSON.stringify(json, null, 2));
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

  ipcMain.handle('accounts:login', async (_, provider: 'Claude' | 'DeepSeek') => {
    return new Promise(async (resolve) => {
      const userAgent = getRandomUserAgent();

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
        },
      });

      authWindow.webContents.setUserAgent(userAgent);

      const url =
        provider === 'Claude' ? 'https://claude.ai/login' : 'https://chat.deepseek.com/login';
      authWindow.loadURL(url);

      // For DeepSeek, inject script to capture email from login request
      let capturedEmail: string | null = null;
      if (provider === 'DeepSeek') {
        authWindow.webContents.on('did-finish-load', () => {
          console.log('[DeepSeek] Injecting email capture script...');
          authWindow.webContents
            .executeJavaScript(
              `
            (function() {
              console.log('[DeepSeek Intercept] Script injected successfully');
              const originalFetch = window.fetch;
              const originalXHR = XMLHttpRequest.prototype.send;
              
              // Intercept fetch
              window.fetch = function(...args) {
                const [url, options] = args;
                if (url && url.includes('/api/v0/users/login') && options?.body) {
                  console.log('[DeepSeek Intercept] Login request detected (fetch)');
                  try {
                    const body = JSON.parse(options.body);
                    console.log('[DeepSeek Intercept] Request body:', body);
                    if (body.request) {
                      const requestData = JSON.parse(body.request);
                      console.log('[DeepSeek Intercept] Request data:', requestData);
                      if (requestData.email) {
                        window.__capturedEmail = requestData.email;
                        console.log('[DeepSeek Intercept] ✅ Captured email:', requestData.email);
                      } else {
                        console.log('[DeepSeek Intercept] ⚠️ No email field in request data');
                      }
                    }
                  } catch (e) {
                    console.error('[DeepSeek Intercept] Error parsing request:', e);
                  }
                }
                return originalFetch.apply(this, args);
              };
              
              // Intercept XMLHttpRequest
              XMLHttpRequest.prototype.send = function(body) {
                if (this._url && this._url.includes('/api/v0/users/login') && body) {
                  console.log('[DeepSeek Intercept] Login request detected (XHR)');
                  try {
                    const parsedBody = JSON.parse(body);
                    console.log('[DeepSeek Intercept] Request body:', parsedBody);
                    if (parsedBody.request) {
                      const requestData = JSON.parse(parsedBody.request);
                      console.log('[DeepSeek Intercept] Request data:', requestData);
                      if (requestData.email) {
                        window.__capturedEmail = requestData.email;
                        console.log('[DeepSeek Intercept] ✅ Captured email:', requestData.email);
                      } else {
                        console.log('[DeepSeek Intercept] ⚠️ No email field in request data');
                      }
                    }
                  } catch (e) {
                    console.error('[DeepSeek Intercept] Error parsing request:', e);
                  }
                }
                return originalXHR.apply(this, arguments);
              };
              
              const originalOpen = XMLHttpRequest.prototype.open;
              XMLHttpRequest.prototype.open = function(method, url) {
                this._url = url;
                return originalOpen.apply(this, arguments);
              };
            })();
          `,
            )
            .then(() => console.log('[DeepSeek] Email capture script injected'))
            .catch((e) => console.error('[DeepSeek] Failed to inject script:', e));
        });
      }

      // Poll for credentials
      const interval = setInterval(async () => {
        if (authWindow.isDestroyed()) {
          clearInterval(interval);
          resolve({ success: false, error: 'Window closed' });
          return;
        }

        try {
          if (provider === 'Claude') {
            console.log('[Claude] Polling for sessionKey...');
            // Check cookies
            const cookies = await authWindow.webContents.session.cookies.get({
              domain: '.claude.ai',
            });
            const sessionKey = cookies.find((c) => c.name === 'sessionKey')?.value;

            if (sessionKey) {
              console.log('[Claude] sessionKey found!');
              clearInterval(interval);

              const newAccount: Account = {
                id: crypto.randomUUID(),
                provider: 'Claude',
                email: 'claude@user.com', // Placeholder
                credential: sessionKey,
                status: 'Active',
                usage: '0',
                lastActive: new Date().toISOString(),
                userAgent,
              };

              saveAccount(newAccount);
              authWindow.close();
              resolve({ success: true, account: newAccount });
            }
          } else {
            console.log('[DeepSeek] Polling for userToken in localStorage...');
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
                  console.log('[DeepSeek] Token found, fetching profile...');

                  // Try to get captured email from intercepted request first
                  capturedEmail = await authWindow.webContents
                    .executeJavaScript('window.__capturedEmail || null')
                    .catch(() => null);

                  console.log('[DeepSeek] Captured email check:', capturedEmail);

                  if (capturedEmail) {
                    console.log(
                      `[DeepSeek] ✅ Successfully captured email from login request: ${capturedEmail}`,
                    );
                  } else {
                    console.log('[DeepSeek] ⚠️ Failed to capture email from login request');
                  }

                  // Fetch profile via API
                  let profile = await fetchDeepSeekProfile(bearerToken);

                  // Use captured email if available (and not masked), otherwise use API email
                  if (capturedEmail && !capturedEmail.includes('***')) {
                    console.log('[DeepSeek] Using captured email (unmasked)');
                    profile.email = capturedEmail;
                  } else if (capturedEmail) {
                    console.log('[DeepSeek] ⚠️ Captured email is masked, will prompt user');
                  }

                  // Fallback: Try to scrape from DOM if still no email
                  if (!profile.email) {
                    console.log('[DeepSeek] API failed, attempting DOM scrape...');
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
                      console.log(`[DeepSeek] Email scraped from DOM: ${scrapedEmail}`);
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
                    lastActive: new Date().toISOString(),
                    userAgent,
                    name: profile.name || undefined,
                    picture: profile.picture || undefined,
                  };

                  console.log('[DeepSeek] Final account data:', {
                    email: newAccount.email,
                    name: newAccount.name,
                    emailMasked: newAccount.email.includes('***'),
                  });

                  saveAccount(newAccount);
                  authWindow.close();
                  resolve({ success: true, account: newAccount });
                }
              }
            }
          }
        } catch (e) {
          // Ignore errors during polling (e.g. navigation in progress)
          // console.error(e);
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
