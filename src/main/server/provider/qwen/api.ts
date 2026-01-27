import { net } from 'electron';
import { loginWithRealBrowser } from '../../browser-login';
import { proxyEvents } from '../../proxy-events';
// import { Account } from '../../../ipc/accounts';

// Route handler passes credential string, not Account object
export async function getModels(credential: string): Promise<any[]> {
  try {
    const cookies = credential;
    console.log('[Qwen] getModels calling with cookies length:', cookies ? cookies.length : 0);
    if (!cookies) {
      console.log('[Qwen] No cookies provided');
      return [];
    }

    const response = await new Promise<any>((resolve) => {
      const req = net.request({
        method: 'GET',
        url: 'https://chat.qwen.ai/api/models',
      });
      req.setHeader('Cookie', cookies);
      req.setHeader(
        'User-Agent',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      );
      req.on('response', (res) => {
        let d = '';
        res.on('data', (c) => (d += c.toString()));
        res.on('end', () => resolve({ body: d, status: res.statusCode }));
      });
      req.on('error', (e) => {
        console.error('[Qwen] Request error:', e);
        resolve(null);
      });
      req.end();
    });

    console.log('[Qwen] API Response status:', response?.status);
    if (response && response.status === 200) {
      const json = JSON.parse(response.body);
      if (json.data && Array.isArray(json.data)) {
        return json.data.map((model: any) => {
          // Parse capabilities for thinking
          const isThinking = model.info?.meta?.capabilities?.thinking || false;
          // Parse context length
          const contextLength = model.info?.meta?.max_context_length;

          return {
            id: model.id,
            name: model.name,
            is_thinking: isThinking,
            context_length: contextLength,
          };
        });
      }
    }
    return [];
  } catch (error) {
    console.error('[Qwen] Failed to fetch models:', error);
    return [];
  }
}

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

        // bx-ua check is too strict and often missing on initial load
        // const hasBxUa = capturedHeaders['bx-ua'];
        // if (!hasBxUa) return { isValid: false };

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
              url: 'https://chat.qwen.ai/api/v1/auths/',
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
            // Check for email at root (based on logs) or in data object (fallback)
            const email = json.email || json.data?.email;
            if (email) {
              return {
                isValid: true,
                cookies: data.cookies,
                email: email,
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
