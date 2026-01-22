import { app } from 'electron';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from '../../proxy';
import { Account } from '../../../ipc/accounts';

export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

// Helper to get cookies from account
export const getCookies = (account: Account) => {
  return account.credential;
};

// Find system Chrome/Chromium
const findChrome = (): string | null => {
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  try {
    const output = execSync('which google-chrome || which chromium', { encoding: 'utf-8' });
    if (output.trim()) return output.trim();
  } catch (e) {
    // ignore
  }

  return null;
};

// Fetch user profile from cookie
const getProfile = (cookies: string): { email: string } => {
  try {
    // Support both v1.0 and v1.1
    // v1.0: arena-auth-prod-v1.0=base64(...)
    // v1.1: arena-auth-prod-v1.1=base64(...)
    const match = cookies.match(/arena-auth-prod-v1\.[0-9]+=([a-zA-Z0-9+/=]+)/);
    if (match && match[1]) {
      let jsonStr = Buffer.from(match[1], 'base64').toString('utf-8');

      try {
        if (jsonStr.includes('%')) jsonStr = decodeURIComponent(jsonStr);

        let data = JSON.parse(jsonStr);

        if (Array.isArray(data)) {
          data = data[0];
        }

        if (data.email || (data.user && data.user.email)) {
          const email = data.email || data.user.email;
          return {
            email,
          };
        }
      } catch (innerE) {
        // ignore
      }
    }
  } catch (e) {
    console.error('[LMArena] Error parsing auth cookie:', e);
  }
  return { email: '' };
};

import { loginWithRealBrowser } from '../../browser-login';

// Login function - spawns Real Chrome via Proxy and captures cookies
export const login = (): Promise<{
  cookies: string;
  email?: string;
}> => {
  return loginWithRealBrowser({
    providerId: 'LMArena',
    loginUrl: 'https://lmarena.ai/',
    partition: `lmarena-${Date.now()}`,
    cookieEvent: 'lmarena-cookies',
    validate: async (data: any) => {
      if (!data.cookies) return { isValid: false };

      const profile = getProfile(data.cookies);
      if (profile.email) {
        return { isValid: true, cookies: data.cookies, email: profile.email };
      }
      return { isValid: false };
    },
  });
};
