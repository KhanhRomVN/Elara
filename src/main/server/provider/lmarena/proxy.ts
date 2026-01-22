import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const LMArenaProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('lmarena.ai')) {
      console.log(`[Proxy] Intercepting LMArena request: ${url}`);
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('arena-auth-prod')) {
        console.log('[Proxy] Found arena-auth-prod token in LMArena Request Cookie!');
        proxyEvents.emit('lmarena-cookies', reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx, body) => {
    const host = ctx.clientToProxyRequest.headers.host;

    // Logic for LMArena Login
    if (
      host &&
      host.includes('lmarena.ai') &&
      ctx.clientToProxyRequest.url.includes('/nextjs-api/sign-in/email')
    ) {
      try {
        const data = JSON.parse(body);
        if (data.success && data.user) {
          console.log('[Proxy] Captured LMArena Login Success:', data.user.email);
          proxyEvents.emit('lmarena-login-success', data.user);
        }
      } catch (e) {
        console.error('[Proxy] Failed to parse LMArena Login Response:', e);
      }
    }
  },
};

export default LMArenaProxy;
