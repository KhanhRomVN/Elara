import { net } from 'electron';
import { loginWithRealBrowser } from '../../browser-login';

export async function login() {
  return await loginWithRealBrowser({
    providerId: 'Mistral',
    loginUrl: 'https://auth.mistral.ai/ui/login',
    partition: `mistral-${Date.now()}`,
    cookieEvent: 'mistral-cookies',
    validate: async (data: { cookies: string }) => {
      if (data.cookies && data.cookies.length > 0) {
        const profile = await fetchMistralProfile(data.cookies);
        if (profile && profile.email) {
          return { isValid: true, email: profile.email, cookies: data.cookies };
        }
      }
      return { isValid: false };
    },
  });
}

export async function fetchMistralProfile(cookies: string): Promise<{ email: string } | null> {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: 'https://console.mistral.ai/api/users/me',
    });

    request.setHeader('Cookie', cookies);
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    request.setHeader('accept', 'application/json');

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.email) {
              resolve({
                email: json.email,
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    request.on('error', () => resolve(null));
    request.end();
  });
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
