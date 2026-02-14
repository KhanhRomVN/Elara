import { ProxyHandler } from '../../proxy-types';
import { proxyEvents } from '../../proxy-events';

const GeminiProxy: ProxyHandler = {
  onRequest: (ctx, callback) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && (host.includes('gemini.google.com') || host.includes('google.com'))) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;

      // Extract bl (Build Label)
      if (url.includes('bl=') || url.includes('f.sid=')) {
        try {
          // URL constructor needs a base for relative paths
          const fullUrl = new URL(url, 'https://gemini.google.com');
          const bl = fullUrl.searchParams.get('bl');
          if (bl) {
            console.log(`[Proxy] Found Gemini Build Label (bl): ${bl}`);
            proxyEvents.emit('gemini-metadata', { bl });
          }

          const fsid = fullUrl.searchParams.get('f.sid');
          if (fsid) {
            console.log(`[Proxy] Found Gemini f.sid: ${fsid}`);
            proxyEvents.emit('gemini-metadata', { f_sid: fsid });
          }
        } catch (e) {
          console.error('[Proxy] Error parsing BL/f.sid:', e);
        }
      }

      if (reqCookies && reqCookies.includes('__Secure-1PSID')) {
        console.log(`[Proxy] Intercepting Gemini request: ${url}`);
        console.log('[Proxy] Found __Secure-1PSID in Gemini Request Cookie!');
        proxyEvents.emit('gemini-cookies', reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx, body) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && (host.includes('gemini.google.com') || host.includes('google.com'))) {
      // Improved SNlM0e capture: can be in JSON or inside a script tag as _.lh(_.fe("SNlM0e"), ...)
      const snlm0eMatch =
        body.match(/\"SNlM0e\":\"([^\"]+)\"/) || body.match(/\"SNlM0e\"\,\s*\"([^\"]+)\"/);
      if (snlm0eMatch && snlm0eMatch[1]) {
        console.log('[Proxy] Found SNlM0e in Gemini Response Body!');
        proxyEvents.emit('gemini-metadata', { snlm0e: snlm0eMatch[1] });
      }
    }

    // Google Account Login (Email Capture) - Shared logic
    if (host && host.includes('accounts.google.com')) {
      // 1. Look for specific email key oPEP7c (common in oauth)
      const oPEP7cMatch = body.match(/\"oPEP7c\":\"([^\"]+)\"/);
      if (oPEP7cMatch && oPEP7cMatch[1]) {
        console.log('[Proxy] Found Google Email (oPEP7c) for Gemini:', oPEP7cMatch[1]);
        proxyEvents.emit('gemini-user-info', { email: oPEP7cMatch[1] });
      }

      // 2. Look for MI613e RPC call which contains the email in a large array string
      // Example: ["wrb.fr","MI613e","[...,\"thienbaovn2468@gmail.com\",...]",...]
      if (body.includes('MI613e')) {
        const emailMatch = body.match(/\"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\"/);
        if (emailMatch && emailMatch[1]) {
          console.log('[Proxy] Found Google Email (MI613e) for Gemini:', emailMatch[1]);
          proxyEvents.emit('gemini-user-info', { email: emailMatch[1] });
        }
      }

      // 3. Robust regex fallback for any email on accounts.google.com if we haven't found one yet
      // This is safe because we only target specific hosts
      if (!body.includes('MI613e') && !oPEP7cMatch) {
        const generalEmailMatch = body.match(/[a-zA-Z0-9._%+-]+@gmail\.com/);
        if (generalEmailMatch) {
          console.log('[Proxy] Found Google Email (General) for Gemini:', generalEmailMatch[0]);
          proxyEvents.emit('gemini-user-info', { email: generalEmailMatch[0] });
        }
      }
    }

    // Logic for User Info (Fallback via API)
    if (
      host &&
      host.includes('www.googleapis.com') &&
      ctx.clientToProxyRequest.url.includes('/userinfo')
    ) {
      try {
        const userInfo = JSON.parse(body);
        console.log('[Proxy] Found User Info in Google API Response!');
        proxyEvents.emit('gemini-user-info', userInfo);
      } catch (e) {
        console.error('[Proxy] Failed to parse User Info:', e);
      }
    }
  },
};

export default GeminiProxy;
