import { net } from 'electron';
import { loginWithRealBrowser } from './browser-login';

export async function login() {
  return await loginWithRealBrowser({
    providerId: 'Kimi',
    loginUrl: 'https://kimi.moonshot.cn/',
    partition: 'persist:kimi', // Maps to profile 'kimi'
    cookieEvent: 'kimi-cookies',
    validate: async (data: { cookies: string }) => {
      const profile = await getProfile(data.cookies);
      if (profile) {
        // Only accept if not guest?
        // Kimi starts as guest. Logic says `profile.name !== '虚拟用户'`
        if (profile.name !== '虚拟用户') {
          return { isValid: true, email: profile.email || 'kimi-user', cookies: data.cookies };
        }
      }
      return { isValid: false };
    },
  });
}

export async function getProfile(cookies: string) {
  // Extract token from cookies for Authorization header
  const match = cookies.match(/kimi-auth=([^;]+)/);
  const token = match ? match[1] : '';

  // Determine base URL based on where we found the cookie or default
  // The log uses www.kimi.com, but let's try to infer or fallback.
  // We'll try www.kimi.com as per the log.
  const baseUrl = 'https://www.kimi.com';

  return new Promise<{
    name: string;
    email: string;
  } | null>((resolve) => {
    const request = net.request({
      method: 'GET',
      url: `${baseUrl}/api/user`,
    });

    request.setHeader('Cookie', cookies);
    request.setHeader('Authorization', `Bearer ${token}`);
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            // Kimi API might return { name: ... } or { user: { name: ... } }
            const email = json.email || json.user?.email || ''; // Often empty for Kimi
            resolve({
              email,
            });
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

export async function sendMessage() {
  // Placeholder
  throw new Error('Not implemented');
}
