import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

let lastCapturedEmail = '';

const CohereProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('dashboard.cohere.com')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('access_token=')) {
        proxyEvents.emit('cohere-cookies', {
          cookies: reqCookies,
          email: lastCapturedEmail,
        });
      }
    }
    callback();
  },
  onResponseBody: (ctx, body) => {
    const url = ctx.clientToProxyRequest.url;
    if (url && url.includes('/rpc/BlobheartAPI/Session')) {
      try {
        const data = JSON.parse(body);
        if (data.user && data.user.email) {
          lastCapturedEmail = data.user.email;
          console.log(`[Cohere Proxy] Captured user email: ${lastCapturedEmail}`);
        }
      } catch (e) {
        // Ignored
      }
    }
  },
};

export default CohereProxy;
