import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

let capturedUnmaskedEmail: string | null = null;

const DeepSeekProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('chat.deepseek.com')) {
      console.log(`[Proxy] Debug - DeepSeek Request: ${url}`);
      const auth = ctx.clientToProxyRequest.headers['authorization'];

      // Log all headers for debugging (redacted)
      const headers = ctx.clientToProxyRequest.headers;
      console.log('[Proxy] Debug - DeepSeek Headers keys:', Object.keys(headers));
      if (headers['cookie']) {
        console.log('[Proxy] Debug - DeepSeek Cookie length:', headers['cookie'].length);
      }

      if (auth) {
        console.log('[Proxy] Intercepting DeepSeek request with Authorization header');
        console.log('[Proxy] Auth Header Length:', auth.length);
        proxyEvents.emit('deepseek-auth-header', auth);
      } else {
        console.log('[Proxy] Debug - DeepSeek request missing Authorization header');
      }
    }
    callback();
  },

  onRequestData: (ctx, chunk, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('chat.deepseek.com') && url.includes('/api/v0/users/login')) {
      const bodyStr = chunk.toString();
      try {
        const outerJson = JSON.parse(bodyStr);
        let foundEmail = null;
        if (outerJson.request) {
          const innerJson = JSON.parse(outerJson.request);
          if (innerJson.email) {
            foundEmail = innerJson.email;
          }
        } else if (outerJson.email) {
          foundEmail = outerJson.email;
        }

        if (foundEmail) {
          console.log('[Proxy] Captured DeepSeek Login Email (Unmasked):', foundEmail);
          capturedUnmaskedEmail = foundEmail;
          proxyEvents.emit('deepseek-login-email', foundEmail);
        }
      } catch (e) {
        const emailMatch = bodyStr.match(/\\?"email\\?":\s*\\?"([^"\\]+)\\?"/);
        if (emailMatch && emailMatch[1]) {
          console.log('[Proxy] Captured DeepSeek Login Email (Regex):', emailMatch[1]);
          capturedUnmaskedEmail = emailMatch[1];
          proxyEvents.emit('deepseek-login-email', emailMatch[1]);
        }
      }
    }
    callback(null, chunk);
  },

  onResponseBody: (ctx, body) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    // DeepSeek Login Response (Get Token)
    if (host && host.includes('chat.deepseek.com') && url.includes('/api/v0/users/login')) {
      try {
        const json = JSON.parse(body);

        let userData;

        if (json.response && typeof json.response === 'string') {
          const innerResponse = JSON.parse(json.response);
          userData = innerResponse?.data?.biz_data?.user;
        } else if (json.data && json.data.biz_data && json.data.biz_data.user) {
          userData = json.data.biz_data.user;
        } else if (json.code === 0 && json.data) {
          userData = json.data;
        }

        if (userData && userData.token) {
          console.log('[Proxy] Captured DeepSeek Login Token:', userData.token);

          const eventPayload: any = { cookies: userData.token };

          // Prefer unmasked captured email, fallback to response email (which might be masked)
          const bestEmail = capturedUnmaskedEmail || userData.email;

          if (bestEmail) {
            console.log('[Proxy] Using DeepSeek Login Email:', bestEmail);
            eventPayload.email = bestEmail;
            proxyEvents.emit('deepseek-login-email', bestEmail);
          }

          // Emit as object with 'cookies' property to match browser-login expectations
          proxyEvents.emit('deepseek-login-token', eventPayload);

          // Clear temp storage
          capturedUnmaskedEmail = null;
        }
      } catch (e) {
        console.error('[Proxy] Failed to parse DeepSeek Login Response:', e);
      }
    }

    // DeepSeek Google Login (Email Capture)
    if (host && host.includes('accounts.google.com') && url.includes('signin/oauth/id')) {
      const emailMatch = body.match(/\"oPEP7c\":\"([^\"]+)\"/);
      if (emailMatch && emailMatch[1]) {
        console.log('[Proxy] Found Google Email for DeepSeek:', emailMatch[1]);
        capturedUnmaskedEmail = emailMatch[1];
        proxyEvents.emit('deepseek-google-email', emailMatch[1]);
      }
    }

    // Logic for DeepSeek User Info
    if (host && host.includes('chat.deepseek.com') && url.includes('/api/v0/users/current')) {
      try {
        const userInfo = JSON.parse(body);
        console.log('[Proxy] Found DeepSeek User Info:', JSON.stringify(userInfo));
        if (userInfo.code === 0 && userInfo.data) {
          proxyEvents.emit('deepseek-user-info', userInfo.data);

          // Also check for token in this response, as it might be a direct login/session restore
          const bizData = userInfo.data?.biz_data;
          if (bizData) {
            if (bizData.token) {
              console.log('[Proxy] Captured DeepSeek Login Token from User Info:', bizData.token);
              const eventPayload: any = { cookies: bizData.token };

              const bestEmail = capturedUnmaskedEmail || bizData.email;
              if (bestEmail) {
                eventPayload.email = bestEmail;
              }
              proxyEvents.emit('deepseek-login-token', eventPayload);
            }
            if (bizData.email) {
              proxyEvents.emit('deepseek-login-email', bizData.email);
            }
          }
        }
      } catch (e) {
        console.error('[Proxy] Failed to parse DeepSeek User Info:', e);
      }
    }
  },
};

export default DeepSeekProxy;
