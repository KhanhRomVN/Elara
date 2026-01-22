import { net } from 'electron';
import { loginWithRealBrowser } from '../../browser-login';

export const BASE_URL = 'https://chat.deepseek.com';

export async function login(options?: { deepseekMethod?: 'basic' | 'google' }) {
  const method = options?.deepseekMethod || 'basic';
  const loginUrl =
    method === 'google'
      ? 'https://accounts.google.com/ServiceLogin?service=lso&passive=1209600&continue=https://chat.deepseek.com/login'
      : 'https://chat.deepseek.com/login';

  return await loginWithRealBrowser({
    providerId: 'DeepSeek',
    loginUrl,
    partition: `deepseek-${Date.now()}`,
    cookieEvent: 'deepseek-login-token',
    validate: async (data: { cookies: string; headers?: any; email?: string }) => {
      // If we got a token from proxy event (it comes as 'cookies' from browser-login)
      if (data.cookies) {
        console.log('[DeepSeek] Validating with captured token');
        const token = data.cookies;

        // Prioritize email captured by proxy
        let email = data.email;

        if (!email) {
          console.log('[DeepSeek] Email not captured directly, fetching profile...');
          const profile = await getProfile(token);
          email = profile.email || undefined;
        }

        if (email) {
          // Return token as 'cookies' string to satisfy interface and ensure it gets passed back
          return { isValid: true, cookies: token, email };
        }
      }
      return { isValid: false };
    },
  });
}

export async function getProfile(
  token: string,
): Promise<{ email: string | null; name?: string; id?: string }> {
  try {
    const url = `${BASE_URL}/api/v0/users/current`;
    const request = net.request({
      method: 'GET',
      url,
      useSessionCookies: true, // Use session cookies if available
    });

    request.setHeader('Authorization', `Bearer ${token}`);
    request.setHeader('Origin', BASE_URL);
    request.setHeader('Referer', `${BASE_URL}/`);

    return new Promise((resolve, reject) => {
      let data = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              if (json.code === 0 && json.data) {
                resolve({
                  email: json.data.email || 'deepseek@user.com',
                  name: json.data.name,
                  id: json.data.id,
                });
              } else {
                resolve({ email: null });
              }
            } catch (e) {
              reject(e);
            }
          } else {
            resolve({ email: null });
          }
        });
      });
      request.on('error', reject);
      request.end();
    });
  } catch (e) {
    console.error('[DeepSeek] Get Profile Error:', e);
    return { email: null };
  }
}
