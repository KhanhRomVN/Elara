import { loginWithRealBrowser } from '../../browser-login';
import { proxyEvents } from '../../proxy-events';

// Constants
export const HEADERS_COMMON = {
  'content-type': 'application/json',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  origin: 'https://stepfun.ai',
  referer: 'https://stepfun.ai/',
  'accept-language': 'en-US,en;q=0.9',
};

// Helper: Build Cookie Header
export const buildCookieHeader = (cookies: any): string => {
  if (typeof cookies === 'string') return cookies;
  if (Array.isArray(cookies)) {
    return cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
  }
  return '';
};
import { getModels } from './chat';

// Login function - spawns Real Chrome via Proxy and captures cookies
export const login = (): Promise<{ cookies: string; email?: string }> => {
  let capturedEmail = '';
  let authCookies = '';

  const onUserInfo = (userInfo: any) => {
    if (userInfo && userInfo.email) capturedEmail = userInfo.email;
  };

  const onAuthCookies = (cookies: string) => {
    authCookies = cookies;
  };

  proxyEvents.on('stepfun-user-info', onUserInfo);
  proxyEvents.on('stepfun-authenticated-cookies', onAuthCookies);

  try {
    return loginWithRealBrowser({
      providerId: 'StepFun',
      loginUrl: 'https://stepfun.ai/chats/new',
      partition: `stepfun-${Date.now()}`,
      cookieEvent: 'stepfun-cookies',
      validate: async (data: any) => {
        const cookiesToUse = authCookies || data.cookies;
        if (!cookiesToUse) return { isValid: false };

        // First, extract and verify JWT authentication status
        const tokenMatch = cookiesToUse.match(/Oasis-Token=([^;]+)/);
        if (!tokenMatch || !tokenMatch[1]) return { isValid: false };

        let isAuthenticated = false;
        try {
          const parts = tokenMatch[1].split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            // authenticated = activated:true AND mode:2
            isAuthenticated = payload.activated === true && payload.mode === 2;
          }
        } catch (e) {
          return { isValid: false };
        }

        if (!isAuthenticated) return { isValid: false };

        // Optional: Verify with API
        try {
          const models = await getModels(cookiesToUse);
          if (models.length > 0) {
            return {
              isValid: true,
              cookies: cookiesToUse,
              email: capturedEmail || data.email || 'stepfun@user.com',
            };
          }
        } catch (e) {}

        return {
          isValid: true,
          cookies: cookiesToUse,
          email: capturedEmail || data.email || 'stepfun@user.com',
        };
      },
    });
  } finally {
    proxyEvents.off('stepfun-user-info', onUserInfo);
    proxyEvents.off('stepfun-authenticated-cookies', onAuthCookies);
  }
};
