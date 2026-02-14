import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const HuggingChatProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('huggingface.co')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      const url = ctx.clientToProxyRequest.url;
      const isLoginOrAuth = url.includes('/login') || url.includes('/authorize');
      const isTrackingOrStatic =
        url.includes('/api/event') ||
        url.includes('/api/telemetry') ||
        url.includes('/js/') ||
        url.includes('/static/') ||
        url.includes('/assets/') ||
        url.includes('/themes/') ||
        url.includes('/_next/') ||
        url.includes('google-analytics');

      const isValidPath =
        url.includes('/api/v2/user') ||
        url.includes('/api/whoami-v2') ||
        url.endsWith('/chat') ||
        url.endsWith('/chat/');

      if (
        reqCookies &&
        reqCookies.includes('token=') &&
        reqCookies.includes('hf-chat=') &&
        !isLoginOrAuth &&
        !isTrackingOrStatic &&
        isValidPath
      ) {
        console.log(`[Proxy] Captured HuggingChat Cookies from critical path: ${url}`);
        proxyEvents.emit('hugging-chat-cookies', reqCookies);
      }
    }
    callback();
  },

  onRequestData: (ctx, chunk, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('huggingface.co') && url.includes('/login')) {
      const body = chunk.toString();
      // Body format: username=encoded_email&password=...
      if (body.includes('username=')) {
        try {
          const match = body.match(/username=([^&]+)/);
          if (match && match[1]) {
            const email = decodeURIComponent(match[1]);
            console.log('[Proxy] Captured email from login form:', email);
            proxyEvents.emit('hugging-chat-login-data', email);
          }
        } catch (e) {
          console.error('[Proxy] Error parsing login body:', e);
        }
      }
    }
    callback(null, chunk);
  },

  onResponseBody: (ctx, body) => {
    const host = ctx.clientToProxyRequest.headers.host;

    // Logic for HuggingChat User Info
    if (
      host &&
      host.includes('huggingface.co') &&
      ctx.clientToProxyRequest.url.includes('/api/whoami-v2')
    ) {
      try {
        const userInfo = JSON.parse(body);
        console.log('[Proxy] Found User Info in HuggingChat Response!');
        proxyEvents.emit('hugging-chat-user-info', userInfo);
      } catch (e) {
        console.error('[Proxy] Failed to parse HuggingChat User Info:', e);
      }
    }
  },
};

export default HuggingChatProxy;
