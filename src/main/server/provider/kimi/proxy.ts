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
    }
    callback();
  },
};

export default KimiProxy;
