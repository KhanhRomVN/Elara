/// <reference types="vite/client" />
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { setDefaultResultOrder } from 'dns';

// Force IPv4 first to avoid EHOSTUNREACH on IPv6 networks that are not fully configured
try {
  setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore if not supported in older Node versions
}

import zlib from 'zlib';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MitmProxyModule = require('http-mitm-proxy');
const MitmProxy = MitmProxyModule.Proxy || MitmProxyModule;

const proxy = new MitmProxy();
import { proxyEvents } from './proxy-events';
export { proxyEvents }; // Re-export for anything else that might use it from pure proxy import
import { ProxyHandler } from './proxy-types';

let isRunning = false;
const PROXY_PORT = 22122;

// Glob all proxy files for bundler support
const proxyModulesGlob = import.meta.glob('./provider/*/proxy.ts', { eager: true });

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

    proxy.onError((_ctx: any, err: any) => {
      if (err) {
        const msg = err.message || '';
        if (err.code === 'ECONNRESET' || msg.includes('socket hang up')) return;
      }
      console.error('[Proxy] Error:', err);
    });

    // Load dynamic providers
    const providerProxies: ProxyHandler[] = [];

    Object.keys(proxyModulesGlob).forEach((key) => {
      try {
        const mod: any = proxyModulesGlob[key];
        const handler: ProxyHandler = mod.default || mod;
        if (handler) {
          providerProxies.push(handler);
          console.log(`[Proxy] Loaded proxy handler from ${key}`);
        }
      } catch (e) {
        console.error(`[Proxy] Failed to load proxy from ${key}:`, e);
      }
    });

    proxy.onRequest(async (ctx: any, callback: any) => {
      // Execute all provider onRequest handlers
      for (const handler of providerProxies) {
        if (handler.onRequest) {
          try {
            await handler.onRequest(ctx, () => {});
          } catch (e) {
            console.error('[Proxy] Error in provider onRequest:', e);
          }
        }
      }
      return callback();
    });

    proxy.onRequestData(async (ctx: any, chunk: Buffer, callback: any) => {
      // Execute all provider onRequestData handlers
      for (const handler of providerProxies) {
        if (handler.onRequestData) {
          try {
            await handler.onRequestData(ctx, chunk, () => {});
          } catch (e) {
            console.error('[Proxy] Error in provider onRequestData:', e);
          }
        }
      }
      return callback(null, chunk);
    });

    proxy.onResponse((ctx: any, callback: any) => {
      // Basic onResponse logic if needed (usually headers check)
      for (const handler of providerProxies) {
        if (handler.onResponse) {
          try {
            // Pass a dummy callback as we don't want providers interrupting the flow easily yet?
            // Or should we? For now, just fire and forget or await.
            handler.onResponse(ctx, () => {});
          } catch (e) {
            console.error('[Proxy] Error in provider onResponse:', e);
          }
        }
      }

      // Decompression and Body Handling Logic (Centralized)
      const encoding = ctx.serverToProxyResponse.headers['content-encoding'];
      const contentType = ctx.serverToProxyResponse.headers['content-type'];

      if (
        contentType &&
        (contentType.includes('text/') ||
          contentType.includes('application/json') ||
          contentType.includes('application/javascript'))
      ) {
        const stream = ctx.serverToProxyResponse;
        let decoder;

        if (encoding === 'gzip') {
          decoder = zlib.createGunzip();
        } else if (encoding === 'br') {
          decoder = zlib.createBrotliDecompress();
        } else if (encoding === 'deflate') {
          decoder = zlib.createInflate();
        }

        if (decoder) {
          stream.pipe(decoder);
          let body = '';
          decoder.on('data', (chunk: Buffer) => {
            body += chunk.toString('utf8');
          });

          decoder.on('end', () => {
            // Broadcast body to all providers
            for (const handler of providerProxies) {
              if (handler.onResponseBody) {
                try {
                  handler.onResponseBody(ctx, body);
                } catch (e) {
                  console.error('[Proxy] Error in provider onResponseBody:', e);
                }
              }
            }
          });

          decoder.on('error', (err: any) => {
            console.error('[Proxy] Decompression Stream Error:', err);
          });
        } else {
          // No compression
          let body = '';
          ctx.serverToProxyResponse.on('data', (chunk: Buffer) => {
            body += chunk.toString('utf8');
          });
          ctx.serverToProxyResponse.on('end', () => {
            for (const handler of providerProxies) {
              if (handler.onResponseBody) {
                try {
                  handler.onResponseBody(ctx, body);
                } catch (e) {
                  console.error('[Proxy] Error in provider onResponseBody (Uncompressed):', e);
                }
              }
            }
          });
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
