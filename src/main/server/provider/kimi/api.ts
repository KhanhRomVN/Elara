import { loginWithRealBrowser } from '../../browser-login';

export async function login() {
  return await loginWithRealBrowser({
    providerId: 'Kimi',
    loginUrl: 'https://kimi.moonshot.cn/',
    partition: `kimi-${Date.now()}`,
    cookieEvent: 'kimi-cookies',
    validate: async (data: { cookies: string }) => {
      return { isValid: true, email: 'kimi@user.com', cookies: data.cookies };
    },
  });
}
