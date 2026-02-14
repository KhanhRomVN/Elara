import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const StepFunProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('stepfun.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (
        reqCookies &&
        reqCookies.includes('Oasis-Token=') &&
        reqCookies.includes('Oasis-Webid=')
      ) {
        console.log(`[Proxy] Intercepting StepFun request: ${url}`);
        console.log('[Proxy] Found tokens in StepFun Request Cookie!');
        proxyEvents.emit('stepfun-cookies', reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx, body) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    // Logic for StepFun Login
    if (host && host.includes('stepfun.ai') && url.includes('/SignInByEmail')) {
      try {
        const setCookieHeader = ctx.serverToProxyResponse.headers['set-cookie'];
        if (setCookieHeader) {
          const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
          const cookieStr = cookies.map((c: string) => c.split(';')[0]).join('; ');
          console.log('[Proxy] ✓ Captured StepFun authenticated cookies from login response!');
          proxyEvents.emit('stepfun-authenticated-cookies', cookieStr);
        }
      } catch (e) {
        console.error('[Proxy] Failed to process StepFun Login Response:', e);
      }
    }

    // Logic for StepFun User Info
    if (
      host &&
      host.includes('stepfun.ai') &&
      url.includes('/api/user/proto.api.user.v1.UserService/GetUser')
    ) {
      try {
        const userInfo = JSON.parse(body);
        if (userInfo && userInfo.data && userInfo.data.email) {
          console.log('[Proxy] ✓ Captured StepFun User Email:', userInfo.data.email);
          proxyEvents.emit('stepfun-user-info', userInfo.data);
        } else if (userInfo && userInfo.email) {
          console.log('[Proxy] ✓ Captured StepFun User Email (direct):', userInfo.email);
          proxyEvents.emit('stepfun-user-info', userInfo);
        }
      } catch (e) {
        console.error('[Proxy] Failed to parse StepFun User Info:', e);
      }
    }
  },
};

export default StepFunProxy;
