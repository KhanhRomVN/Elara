import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const GroqProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('console.groq.com')) {
      console.log(`[Proxy] Intercepting Groq request: ${url}`);
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (
        reqCookies &&
        (reqCookies.includes('stytch_session') || reqCookies.includes('stytch_session_jwt'))
      ) {
        console.log('[Proxy] Found session in Groq Request Cookie!');
        proxyEvents.emit('groq-cookies', reqCookies);
      }
    }

    if (host && host.includes('api.stytchb2b.groq.com')) {
      const clientSdk = ctx.clientToProxyRequest.headers['x-sdk-client'];
      if (clientSdk) {
        proxyEvents.emit('groq-sdk-client', clientSdk);
      }
    }
    callback();
  },
};

export default GroqProxy;
