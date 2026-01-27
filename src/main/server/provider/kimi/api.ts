import { loginWithRealBrowser } from '../../browser-login';

export async function login() {
  return await loginWithRealBrowser({
    providerId: 'Kimi',
    loginUrl: 'https://kimi.moonshot.cn/',
    partition: `kimi-${Date.now()}`,
    cookieEvent: 'kimi-cookies',
    validate: async (data: { cookies: string }) => {
      // Try to extract email from cookies or use default
      let email = 'kimi@user.com';

      // Check if we can extract user info from cookies
      // The actual email might come from Google OAuth flow
      const cookieMatch = data.cookies.match(/kimi-auth=([^;]+)/);
      if (cookieMatch) {
        try {
          // Decode JWT to get user info if available
          const token = cookieMatch[1];
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          email = payload.email || payload.sub || 'kimi@user.com';
        } catch (e) {
          // If decode fails, use default
        }
      }

      return {
        isValid: true,
        email: email,
        cookies: data.cookies,
      };
    },
  });
}
