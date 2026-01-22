import * as https from 'https';
import { URL } from 'url';
import { Account } from '../../../ipc/accounts';
import { loginWithRealBrowser } from '../../browser-login';
import { proxyEvents } from '../../proxy-events';

export const BASE_URL = 'https://huggingface.co/chat';

// Helper to get cookies from account
export const getCookies = (account: Account) => {
  return account.credential;
};

// Helper: Build Cookie Header
export const buildCookieHeader = (cookies: any): string => {
  if (typeof cookies === 'string') return cookies;
  if (Array.isArray(cookies)) {
    return cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
  }
  return '';
};

export const fetchJson = (urlStr: string, cookies: string): Promise<any> => {
  const cleanUrl = urlStr.trim();
  const cleanCookies = (cookies || '').toString().replace(/\0/g, '').trim();

  console.log('[HuggingChat] Fetching JSON via https module:', cleanUrl);

  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(cleanUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          Cookie: cleanCookies,
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          accept: 'application/json, text/plain, */*',
          Referer: 'https://huggingface.co/chat/',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`JSON Parse Error: ${(e as Error).message}`));
            }
          } else {
            reject(new Error(`HTTP Error ${res.statusCode}`));
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.end();
    } catch (err) {
      reject(err);
    }
  });
};

// Login function - spawns Real Chrome via Proxy and captures cookies
export const login = (): Promise<{ cookies: string; email?: string }> => {
  let capturedEmail = '';

  const onLoginData = (email: string) => {
    console.log('[HuggingChat] Form email captured:', email);
    capturedEmail = email;
  };

  proxyEvents.on('hugging-chat-login-data', onLoginData);

  try {
    return loginWithRealBrowser({
      providerId: 'HuggingChat',
      loginUrl: 'https://huggingface.co/chat/login',
      partition: `huggingchat-${Date.now()}`,
      cookieEvent: 'hugging-chat-cookies',
      validate: async (data: any) => {
        if (!data.cookies) return { isValid: false };

        console.log('[HuggingChat] Validating session with profile fetch...');

        let identityEmail = '';

        // Verification: confirm session is valid
        try {
          const chatUserRes = await fetchJson(
            'https://huggingface.co/chat/api/v2/user',
            data.cookies,
          );
          const chatUser = chatUserRes.json || chatUserRes;

          if (chatUser && (chatUser.email || chatUser.username)) {
            // Success! Session is valid.
            // Priority: Captured Form Email > API Email > Username-based Email
            identityEmail = capturedEmail || chatUser.email || `${chatUser.username}@hf.co`;
          }
        } catch (e) {
          console.warn('[HuggingChat] Chat API verify failed:', (e as Error).message);
          // Fallback to Main API for verification
          try {
            const userInfo = await fetchJson('https://huggingface.co/api/whoami-v2', data.cookies);
            if (userInfo && (userInfo.email || userInfo.user)) {
              identityEmail = capturedEmail || userInfo.email || `${userInfo.user}@hf.co`;
            }
          } catch (e2) {
            console.error('[HuggingChat] Fallback verify also failed:', (e2 as Error).message);
          }
        }

        if (identityEmail) {
          console.log('[HuggingChat] Validation success! Verified identity:', identityEmail);
          return {
            isValid: true,
            cookies: data.cookies,
            email: identityEmail,
          };
        } else {
          console.log(
            '[HuggingChat] Login not verified yet. Keeping browser open for actual login...',
          );
          return { isValid: false };
        }
      },
    });
  } finally {
    proxyEvents.off('hugging-chat-login-data', onLoginData);
  }
};
