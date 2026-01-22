import { net } from 'electron';
import { loginWithRealBrowser } from '../../browser-login';
import { proxyEvents } from '../../proxy-events';

export async function login() {
  let capturedHeaders: Record<string, string> = {};

  const onHeaders = (headers: Record<string, string>) => {
    capturedHeaders = { ...capturedHeaders, ...headers };
  };

  proxyEvents.on('qwen-headers', onHeaders);

  try {
    return await loginWithRealBrowser({
      providerId: 'Qwen',
      loginUrl: 'https://chat.qwen.ai/auth',
      partition: `qwen-${Date.now()}`,
      cookieEvent: 'qwen-cookies',
      validate: async (data: any) => {
        if (!data.cookies) return { isValid: false };

        const hasBxUa = capturedHeaders['bx-ua'];
        if (!hasBxUa) return { isValid: false };

        // Process CSRF if missing
        if (!capturedHeaders['x-csrf-token']) {
          const csrfMatch = data.cookies.match(/csrfToken=([^;]+)/);
          if (csrfMatch) capturedHeaders['x-csrf-token'] = csrfMatch[1];
        }

        // Fetch profile for email
        try {
          const res = await new Promise<any>((resolve) => {
            const req = net.request({
              method: 'GET',
              url: 'https://chat.qwen.ai/api/v1/account',
            });
            req.setHeader('Cookie', data.cookies);
            req.setHeader(
              'User-Agent',
              capturedHeaders['User-Agent'] ||
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            );
            req.on('response', (res) => {
              let d = '';
              res.on('data', (c) => (d += c.toString()));
              res.on('end', () => resolve({ body: d, status: res.statusCode }));
            });
            req.on('error', () => resolve(null));
            req.end();
          });

          if (res && res.status === 200) {
            const json = JSON.parse(res.body);
            if (json.data?.email) {
              return {
                isValid: true,
                cookies: data.cookies,
                email: json.data.email,
                headers: capturedHeaders,
              };
            }
          }
        } catch (e) {}

        return {
          isValid: true,
          cookies: data.cookies,
          email: 'qwen@user.com',
          headers: capturedHeaders,
        };
      },
    });
  } finally {
    proxyEvents.off('qwen-headers', onHeaders);
  }
}
