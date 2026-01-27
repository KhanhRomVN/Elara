import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const KimiProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && (host.includes('kimi.moonshot.cn') || host.includes('www.kimi.com'))) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('kimi-auth=')) {
        proxyEvents.emit('kimi-cookies', reqCookies);
      }

      // Also capture Authorization header if present
      const authHeader = ctx.clientToProxyRequest.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        proxyEvents.emit('kimi-auth-token', authHeader);
      }
    }
    callback();
  },
};

export default KimiProxy;
