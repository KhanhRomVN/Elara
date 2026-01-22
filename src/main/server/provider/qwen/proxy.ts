import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const QwenProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('chat.qwen.ai')) {
      console.log(`[Proxy] Intercepting Qwen request: ${url}`);
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('token=')) {
        console.log('[Proxy] Found token in Qwen Request Cookie!');
        proxyEvents.emit('qwen-cookies', reqCookies);
      }

      const capturedHeaders: Record<string, string> = {};
      const headers = ctx.clientToProxyRequest.headers;
      if (headers['bx-umidtoken']) capturedHeaders['bx-umidtoken'] = headers['bx-umidtoken'];
      if (headers['bx-ua']) capturedHeaders['bx-ua'] = headers['bx-ua'];
      if (headers['bx-v']) capturedHeaders['bx-v'] = headers['bx-v'];
      if (headers['x-csrf-token']) capturedHeaders['x-csrf-token'] = headers['x-csrf-token'];

      if (Object.keys(capturedHeaders).length > 0) {
        proxyEvents.emit('qwen-headers', capturedHeaders);
      }
    }
    callback();
  },
};

export default QwenProxy;
