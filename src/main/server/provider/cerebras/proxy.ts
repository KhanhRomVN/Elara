import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const CerebrasProxy: ProxyHandler = {
  onResponse: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    if (host && host.includes('chat.cerebras.ai')) {
      const setCookie = ctx.serverToProxyResponse.headers['set-cookie'];
      if (setCookie) {
        const cookies = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
        if (cookies.includes('authjs.session-token')) {
          console.log('[Proxy] Detected authjs.session-token in response');
          proxyEvents.emit('cerebras-session-cookie', cookies);
        }
      }
    }
    callback();
  },

  onResponseBody: (ctx, body) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('chat.cerebras.ai') && url.includes('/api/auth/session')) {
      try {
        const json = JSON.parse(body);
        if (json.demoApiKey) {
          console.log('[Proxy] Captured Cerebras demoApiKey:', json.demoApiKey);
          proxyEvents.emit('cerebras-login-success', {
            cookies: json.demoApiKey, // We use demoApiKey as the credential
            email: json.user?.email || '',
            sessionToken: json.sessionToken,
          });
        }
      } catch (e) {
        console.error('[Proxy] Failed to parse Cerebras session response:', e);
      }
    }
  },
};

export default CerebrasProxy;
