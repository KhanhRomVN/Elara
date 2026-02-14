import { loginWithRealBrowser } from '../../browser-login';

export async function login() {
  return await loginWithRealBrowser({
    providerId: 'Cohere',
    loginUrl: 'https://dashboard.cohere.com/welcome/login',
    partition: `cohere-${Date.now()}`,
    cookieEvent: 'cohere-cookies',
    validate: async (data: { cookies: string; email?: string }) => {
      // Cohere uses access_token in cookies after login
      const match = data.cookies.match(/access_token=([^;]+)/);
      if (match && match[1]) {
        const token = match[1];
        // Use the email captured from the proxy if available
        return { isValid: true, email: data.email || 'cohere-user@elara.ai', cookies: token };
      }
      return { isValid: false };
    },
  });
}
