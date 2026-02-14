import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const MistralProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('mistral.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('ory_session_')) {
        proxyEvents.emit('mistral-cookies', reqCookies);
      }
    }
    callback();
  },
};

export default MistralProxy;
