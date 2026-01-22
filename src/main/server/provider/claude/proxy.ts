import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const ClaudeProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('claude.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('sessionKey=')) {
        proxyEvents.emit('claude-cookies', reqCookies);
      }
    }
    callback();
  },
};

export default ClaudeProxy;
