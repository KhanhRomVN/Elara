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

      if (host) {
        // Qwen
        if (host.includes('chat.qwen.ai')) {
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

        // Groq
        if (host.includes('console.groq.com')) {
          console.log(`[Proxy] Intercepting Groq request: ${url}`);
          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          if (
            reqCookies &&
            (reqCookies.includes('stytch_session') || reqCookies.includes('stytch_session_jwt'))
          ) {
            console.log('[Proxy] Found session in Groq Request Cookie!');
            proxyEvents.emit('groq-cookies', reqCookies);
          }
        }

        // Gemini
        if (host.includes('gemini.google.com') || host.includes('google.com')) {
          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          if (reqCookies && reqCookies.includes('__Secure-1PSID')) {
            console.log(`[Proxy] Intercepting Gemini request: ${url}`);
            console.log('[Proxy] Found __Secure-1PSID in Gemini Request Cookie!');
            proxyEvents.emit('gemini-cookies', reqCookies);
          }
        }

        // Perplexity
        if (host.includes('www.perplexity.ai')) {
          console.log(`[Proxy] Intercepting Perplexity request: ${url}`);
          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          // Look for session token
          if (reqCookies && reqCookies.includes('__Secure-next-auth.session-token')) {
            console.log('[Proxy] Found session token in Perplexity Request Cookie!');
            proxyEvents.emit('perplexity-cookies', reqCookies);
          }
        }
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
