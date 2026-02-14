import { loginWithRealBrowser } from '../../browser-login';

export async function login() {
  return await loginWithRealBrowser({
    providerId: 'Cerebras',
    loginUrl: 'https://chat.cerebras.ai/',
    partition: `cerebras-${Date.now()}`,
    cookieEvent: 'cerebras-login-success',
    validate: async (data: { cookies: string; email?: string }) => {
      // In Cerebras, our proxy emits the demoApiKey as 'cookies'
      if (data.cookies && data.cookies.startsWith('demo-')) {
        return {
          isValid: true,
          email: data.email || 'cerebras-user@elara.ai',
          cookies: data.cookies,
        };
      }
      return { isValid: false };
    },
  });
}
