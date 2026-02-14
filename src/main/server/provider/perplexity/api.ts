export const BASE_URL = 'https://www.perplexity.ai';

import { net } from 'electron';

import { loginWithRealBrowser } from '../../browser-login';

export async function login() {
  return loginWithRealBrowser({
    providerId: 'Perplexity',
    loginUrl: 'https://www.perplexity.ai/',
    partition: `perplexity-${Date.now()}`,
    cookieEvent: 'perplexity-cookies',
    validate: async (data: any) => {
      if (!data.cookies) return { isValid: false };

      // Fetch session for email
      try {
        const res = await new Promise<any>((resolve, reject) => {
          const request = net.request({
            method: 'GET',
            url: 'https://www.perplexity.ai/api/auth/session',
          });
          request.setHeader('Cookie', data.cookies);
          request.setHeader(
            'User-Agent',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          );
          request.on('response', (response) => {
            let body = '';
            response.on('data', (c) => (body += c.toString()));
            response.on('end', () => resolve({ body, status: response.statusCode }));
          });
          request.on('error', reject);
          request.end();
        });

        if (res.status === 200) {
          const json = JSON.parse(res.body);
          if (json.user?.email) {
            return { isValid: true, cookies: data.cookies, email: json.user.email };
          }
        }
      } catch (e) {
        console.error('[Perplexity] Validation error:', e);
      }

      return { isValid: true, cookies: data.cookies, email: 'perplexity@user.com' };
    },
  });
}
