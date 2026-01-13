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
        // console.log('[Proxy] Request Headers:', JSON.stringify(ctx.clientToProxyRequest.headers, null, 2));

        // Check Request Cookies
        const reqCookies = ctx.clientToProxyRequest.headers.cookie;
        if (reqCookies && reqCookies.includes('token=')) {
          console.log('[Proxy] Found token in Request Cookie!');
          proxyEvents.emit('qwen-cookies', reqCookies);
          // We can return here if we only need one, but let's allow flow to continue
        }

        // Debug: Log all header keys to find the correct casing/name
        // console.log(
        //   '[Proxy] Request Header Keys:',
        //   Object.keys(ctx.clientToProxyRequest.headers).join(', '),
        // );

        const capturedHeaders: Record<string, string> = {};
        const headers = ctx.clientToProxyRequest.headers;

        const bxUmidToken = headers['bx-umidtoken'];
        if (bxUmidToken) capturedHeaders['bx-umidtoken'] = bxUmidToken;

        const bxUa = headers['bx-ua'];
        if (bxUa) capturedHeaders['bx-ua'] = bxUa;

        const bxV = headers['bx-v'];
        if (bxV) capturedHeaders['bx-v'] = bxV;

        const xCsrfToken = headers['x-csrf-token'] || headers['x-xsrf-token'];
        if (xCsrfToken) capturedHeaders['x-csrf-token'] = xCsrfToken;

        if (Object.keys(capturedHeaders).length > 0) {
          console.log(`[Proxy] Captured headers: ${Object.keys(capturedHeaders).join(', ')}`);
          proxyEvents.emit('qwen-headers', capturedHeaders);
        }

        ctx.onResponse((ctx: any, callback: any) => {
          // Check Response Set-Cookie
          const resCookies = ctx.serverToProxyResponse.headers['set-cookie'];
          if (resCookies) {
            const cookieStr = Array.isArray(resCookies) ? resCookies.join('; ') : resCookies;
            if (cookieStr.includes('token=')) {
              console.log('[Proxy] Found token in Response Set-Cookie!');
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
