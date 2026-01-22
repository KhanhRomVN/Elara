import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const PerplexityProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('www.perplexity.ai')) {
      console.log(`[Proxy] Intercepting Perplexity request: ${url}`);
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      // Look for session token
      if (reqCookies && reqCookies.includes('__Secure-next-auth.session-token')) {
        console.log('[Proxy] Found session token in Perplexity Request Cookie!');
        proxyEvents.emit('perplexity-cookies', reqCookies);
      }
    }
    callback();
  },
};

export default PerplexityProxy;
