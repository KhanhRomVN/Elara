import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

// Use require to handle the export format of http-mitm-proxy compatible with TS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Proxy: MitmProxy } = require('http-mitm-proxy');

const proxy = new MitmProxy();
export const proxyEvents = new EventEmitter();

let isRunning = false;
const PROXY_PORT = 8080;

export const startProxy = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isRunning) {
      resolve();
      return;
    }

    const userDataPath = app.getPath('userData');
    const certsPath = path.join(userDataPath, 'proxy-certs');

    if (!fs.existsSync(certsPath)) {
      fs.mkdirSync(certsPath, { recursive: true });
    }

    proxy.onError((ctx: any, err: any) => {
      console.error('[Proxy] Error:', err);
    });

    proxy.onRequest((ctx: any, callback: any) => {
      const host = ctx.clientToProxyRequest.headers.host;
      const url = ctx.clientToProxyRequest.url;

      // Verbose log to verify traffic
      console.log(`[Proxy] Request: ${host}${url}`);

      if (host && host.includes('chat.qwen.ai')) {
        console.log(`[Proxy] Intercepting Qwen request: ${url}`);

        // Check Request Cookies
        const reqCookies = ctx.clientToProxyRequest.headers.cookie;
        if (reqCookies && reqCookies.includes('token=')) {
          console.log('[Proxy] Found token in Request Cookie!');
          proxyEvents.emit('qwen-cookies', reqCookies);
          // We can return here if we only need one, but let's allow flow to continue
        }

        ctx.onResponse((ctx: any, callback: any) => {
          // Check Response Set-Cookie
          const resCookies = ctx.serverToProxyResponse.headers['set-cookie'];
          if (resCookies) {
            const cookieStr = Array.isArray(resCookies) ? resCookies.join('; ') : resCookies;
            if (cookieStr.includes('token=')) {
              console.log('[Proxy] Found token in Response Set-Cookie!');
              // We need to construct a valid cookie string for the client
              // But since we just need the 'token' part or the full string for future requests,
              // we might need to parse it.
              // For now, let's just emit what we found. The login handler expects a cookie string.
              // If we find 'token=' in Set-Cookie, we might want to wait for the next request
              // OR reconstruct the cookie string.
              // The safest bet is often the Request cookie of the *next* request,
              // but let's emit this just in case we can use it.
              // However, Set-Cookie format is "key=value; attributes", not just "key=value".
              // Let's stick to Request cookies effectively, but log this to be sure we see it.
            }
          }
          return callback();
        });
      }
      return callback();
    });

    proxy.listen({ port: PROXY_PORT, sslCaDir: certsPath }, (err: any) => {
      if (err) {
        console.error('[Proxy] Failed to start:', err);
        reject(err);
      } else {
        console.log(`[Proxy] Listening on port ${PROXY_PORT}`);
        isRunning = true;
        resolve();
      }
    });
  });
};

export const stopProxy = () => {
  if (isRunning) {
    proxy.close();
    isRunning = false;
    console.log('[Proxy] Stopped');
  }
};
