import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { setDefaultResultOrder } from 'dns';

// Force IPv4 first to avoid EHOSTUNREACH on IPv6 networks that are not fully configured
try {
  setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore if not supported in older Node versions
}

import zlib from 'zlib';

// Use require to handle the export format of http-mitm-proxy compatible with TS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Proxy: MitmProxy } = require('http-mitm-proxy');

const proxy = new MitmProxy();
export const proxyEvents = new EventEmitter();

let isRunning = false;
const PROXY_PORT = 22122;

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
      if (err) {
        const msg = err.message || '';
        if (err.code === 'ECONNRESET' || msg.includes('socket hang up')) return;
      }
      console.error('[Proxy] Error:', err);
    });

    proxy.onRequest((ctx: any, callback: any) => {
      const host = ctx.clientToProxyRequest.headers.host;
      const url = ctx.clientToProxyRequest.url;

      // Verbose log to verify traffic
      // console.log(`[Proxy] Request: ${host}${url}`);

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

        if (host.includes('api.stytchb2b.groq.com')) {
          const clientSdk = ctx.clientToProxyRequest.headers['x-sdk-client'];
          if (clientSdk) {
            // console.log('[Proxy] Captured Groq SDK Client Header');
            proxyEvents.emit('groq-sdk-client', clientSdk);
          }
        }

        // Gemini
        if (host.includes('gemini.google.com') || host.includes('google.com')) {
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

        // HuggingChat
        if (host.includes('huggingface.co')) {
          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          if (reqCookies && reqCookies.includes('token=') && reqCookies.includes('hf-chat=')) {
            console.log(`[Proxy] Intercepting HuggingChat request: ${url}`);
            console.log('[Proxy] Found tokens in HuggingChat Request Cookie!');
            proxyEvents.emit('hugging-chat-cookies', reqCookies);
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

        // LMArena
        if (host.includes('lmarena.ai')) {
          console.log(`[Proxy] Intercepting LMArena request: ${url}`);
          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          // Look for arena-auth-prod token
          if (reqCookies && reqCookies.includes('arena-auth-prod')) {
            console.log('[Proxy] Found arena-auth-prod token in LMArena Request Cookie!');
            proxyEvents.emit('lmarena-cookies', reqCookies);
          }
        }

        // StepFun
        if (host.includes('stepfun.ai')) {
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

        if (host.includes('chat.deepseek.com')) {
          const auth = ctx.clientToProxyRequest.headers['authorization'];
          if (auth) {
            console.log('[Proxy] Intercepting DeepSeek request with Authorization header');
            proxyEvents.emit('deepseek-auth-header', auth);
          }
        }

        // Claude
        if (host.includes('claude.ai')) {
          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          if (reqCookies && reqCookies.includes('sessionKey=')) {
            // console.log('[Proxy] Found Claude sessionKey!');
            proxyEvents.emit('claude-cookies', reqCookies);
          }
        }

        // Mistral
        if (host.includes('mistral.ai')) {
          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          if (reqCookies && reqCookies.includes('ory_session_')) {
            // console.log('[Proxy] Found Mistral ory_session!');
            proxyEvents.emit('mistral-cookies', reqCookies);
          }
        }

        // Kimi
        if (host.includes('kimi.moonshot.cn') || host.includes('www.kimi.com')) {
          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          if (reqCookies && reqCookies.includes('kimi-auth=')) {
            // console.log('[Proxy] Found Kimi auth!');
            proxyEvents.emit('kimi-cookies', reqCookies);
          }
        }

        // Cohere
        if (host.includes('dashboard.cohere.com')) {
          const reqCookies = ctx.clientToProxyRequest.headers.cookie;
          if (reqCookies && reqCookies.includes('access_token=')) {
            // console.log('[Proxy] Found Cohere access_token!');
            proxyEvents.emit('cohere-cookies', reqCookies);
          }
        }
      }
      return callback();
    });

    proxy.onRequestData((ctx: any, chunk: Buffer, callback: any) => {
      const host = ctx.clientToProxyRequest.headers.host;
      const url = ctx.clientToProxyRequest.url;

      if (host && host.includes('huggingface.co') && url.includes('/login')) {
        const body = chunk.toString();
        // Body format: username=encoded_email&password=...
        if (body.includes('username=')) {
          try {
            const match = body.match(/username=([^&]+)/);
            if (match && match[1]) {
              const email = decodeURIComponent(match[1]);
              console.log('[Proxy] Captured email from login form:', email);
              proxyEvents.emit('hugging-chat-login-data', email);
            }
          } catch (e) {
            console.error('[Proxy] Error parsing login body:', e);
          }
        }
      }
      return callback(null, chunk);
    });

    proxy.onResponse((ctx: any, callback: any) => {
      const host = ctx.clientToProxyRequest.headers.host;
      // console.log(`[Proxy] Debug - onResponse triggered for: ${host}`); // Silent debug

      if (host) {
        if (
          host.includes('gemini.google.com') ||
          host.includes('google.com') ||
          (host.includes('www.googleapis.com') &&
            ctx.clientToProxyRequest.url.includes('/userinfo')) ||
          (host.includes('huggingface.co') &&
            ctx.clientToProxyRequest.url.includes('/api/whoami-v2')) ||
          (host.includes('lmarena.ai') &&
            ctx.clientToProxyRequest.url.includes('/nextjs-api/sign-in/email')) ||
          (host.includes('stepfun.ai') &&
            (ctx.clientToProxyRequest.url.includes('/SignInByEmail') ||
              ctx.clientToProxyRequest.url.includes(
                '/api/user/proto.api.user.v1.UserService/GetUser',
              )))
        ) {
          const encoding = ctx.serverToProxyResponse.headers['content-encoding'];
          const contentType = ctx.serverToProxyResponse.headers['content-type'];

          console.log(`[Proxy] Debug - Response Header: Encoding=${encoding}, Type=${contentType}`);

          // Chỉ xử lý nếu là text/html hoặc application/json để tối ưu hiệu năng
          if (
            contentType &&
            (contentType.includes('text/') ||
              contentType.includes('application/json') ||
              contentType.includes('application/javascript'))
          ) {
            let stream = ctx.serverToProxyResponse;
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

              // Xử lý luồng đã giải nén
              let body = '';
              decoder.on('data', (chunk: Buffer) => {
                body += chunk.toString('utf8');
              });

              decoder.on('end', () => {
                // Logic for Gemini Metadata
                if (host.includes('gemini.google.com') || host.includes('google.com')) {
                  const snlm0eMatch = body.match(/\"SNlM0e\":\"([^\"]+)\"/);
                  if (snlm0eMatch && snlm0eMatch[1]) {
                    console.log('[Proxy] Found SNlM0e in Gemini Response Body!');
                    proxyEvents.emit('gemini-metadata', { snlm0e: snlm0eMatch[1] });
                  }
                }

                // Logic for DeepSeek Google Login (Email Capture)
                if (
                  host.includes('accounts.google.com') &&
                  ctx.clientToProxyRequest.url.includes('signin/oauth/id')
                ) {
                  // Try to find email in WIZ_global_data or similar structure
                  // Pattern: "oPEP7c":"email@gmail.com"
                  const emailMatch = body.match(/\"oPEP7c\":\"([^\"]+)\"/);
                  if (emailMatch && emailMatch[1]) {
                    console.log('[Proxy] Found Google Email for DeepSeek:', emailMatch[1]);
                    proxyEvents.emit('deepseek-google-email', emailMatch[1]);
                  } else {
                    // Fallback: Try to find standard email pattern in the body if oPEP7c is missing
                    // Be careful not to match random emails, look for context if possible
                    // But for now, sticking to the requested oPEP7c is safer as it's the specific key
                  }
                }

                // Logic for User Info
                if (
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

                // Logic for HuggingChat User Info
                if (
                  host.includes('huggingface.co') &&
                  ctx.clientToProxyRequest.url.includes('/api/whoami-v2')
                ) {
                  try {
                    const userInfo = JSON.parse(body);
                    console.log('[Proxy] Found User Info in HuggingChat Response!');
                    proxyEvents.emit('hugging-chat-user-info', userInfo);
                  } catch (e) {
                    console.error('[Proxy] Failed to parse HuggingChat User Info:', e);
                  }
                }

                // Logic for LMArena Login
                if (
                  host.includes('lmarena.ai') &&
                  ctx.clientToProxyRequest.url.includes('/nextjs-api/sign-in/email')
                ) {
                  try {
                    const data = JSON.parse(body);
                    if (data.success && data.user) {
                      console.log('[Proxy] Captured LMArena Login Success:', data.user.email);
                      proxyEvents.emit('lmarena-login-success', data.user);
                    }
                  } catch (e) {
                    console.error('[Proxy] Failed to parse LMArena Login Response:', e);
                  }
                }

                // Logic for StepFun Login
                if (
                  host.includes('stepfun.ai') &&
                  ctx.clientToProxyRequest.url.includes('/SignInByEmail')
                ) {
                  try {
                    // Extract authenticated cookies from set-cookie header
                    const setCookieHeader = ctx.serverToProxyResponse.headers['set-cookie'];
                    if (setCookieHeader) {
                      const cookies = Array.isArray(setCookieHeader)
                        ? setCookieHeader
                        : [setCookieHeader];
                      console.log(
                        '[Proxy] DEBUG - Set-Cookie headers:',
                        JSON.stringify(cookies, null, 2),
                      );
                      const cookieStr = cookies.map((c) => c.split(';')[0]).join('; ');
                      console.log('[Proxy] DEBUG - Combined cookie string:', cookieStr);
                      console.log(
                        '[Proxy] ✓ Captured StepFun authenticated cookies from login response!',
                      );
                      proxyEvents.emit('stepfun-authenticated-cookies', cookieStr);
                    }
                  } catch (e) {
                    console.error('[Proxy] Failed to process StepFun Login Response:', e);
                  }
                }
              });

              decoder.on('error', (err: any) => {
                console.error('[Proxy] Decompression Stream Error:', err);
              });
            } else {
              // Không nén, đọc trực tiếp
              let body = '';
              ctx.serverToProxyResponse.on('data', (chunk: Buffer) => {
                body += chunk.toString('utf8');
              });
              ctx.serverToProxyResponse.on('end', () => {
                // Logic lặp lại (có thể refactor tách hàm sau)
                if (host.includes('gemini.google.com') || host.includes('google.com')) {
                  const snlm0eMatch = body.match(/\"SNlM0e\":\"([^\"]+)\"/);
                  if (snlm0eMatch && snlm0eMatch[1]) {
                    console.log('[Proxy] Found SNlM0e in Gemini Response Body!');
                    proxyEvents.emit('gemini-metadata', { snlm0e: snlm0eMatch[1] });
                  }
                }

                // Logic for User Info (Uncompressed)
                if (
                  host.includes('www.googleapis.com') &&
                  ctx.clientToProxyRequest.url.includes('/userinfo')
                ) {
                  try {
                    const userInfo = JSON.parse(body);
                    console.log('[Proxy] Found User Info in Google API Response! (Uncompressed)');
                    proxyEvents.emit('gemini-user-info', userInfo);
                  } catch (e) {
                    console.error('[Proxy] Failed to parse User Info (Uncompressed):', e);
                  }
                }

                // Logic for HuggingChat User Info (Uncompressed)
                if (
                  host.includes('huggingface.co') &&
                  ctx.clientToProxyRequest.url.includes('/api/whoami-v2')
                ) {
                  try {
                    const userInfo = JSON.parse(body);
                    console.log('[Proxy] Found User Info in HuggingChat Response! (Uncompressed)');
                    proxyEvents.emit('hugging-chat-user-info', userInfo);
                  } catch (e) {
                    console.error(
                      '[Proxy] Failed to parse HuggingChat User Info (Uncompressed):',
                      e,
                    );
                  }
                }

                // Logic for StepFun Login (Uncompressed)
                if (
                  host.includes('stepfun.ai') &&
                  ctx.clientToProxyRequest.url.includes('/SignInByEmail')
                ) {
                  try {
                    const setCookieHeader = ctx.serverToProxyResponse.headers['set-cookie'];
                    if (setCookieHeader) {
                      const cookies = Array.isArray(setCookieHeader)
                        ? setCookieHeader
                        : [setCookieHeader];
                      console.log(
                        '[Proxy] DEBUG - Set-Cookie headers (Uncompressed):',
                        JSON.stringify(cookies, null, 2),
                      );
                      const cookieStr = cookies.map((c) => c.split(';')[0]).join('; ');
                      console.log(
                        '[Proxy] DEBUG - Combined cookie string (Uncompressed):',
                        cookieStr,
                      );
                      console.log(
                        '[Proxy] ✓ Captured StepFun authenticated cookies from login response! (Uncompressed)',
                      );
                      proxyEvents.emit('stepfun-authenticated-cookies', cookieStr);
                    }
                  } catch (e) {
                    console.error(
                      '[Proxy] Failed to process StepFun Login Response (Uncompressed):',
                      e,
                    );
                  }
                }

                // Logic for StepFun User Info
                if (
                  host.includes('stepfun.ai') &&
                  ctx.clientToProxyRequest.url.includes(
                    '/api/user/proto.api.user.v1.UserService/GetUser',
                  )
                ) {
                  try {
                    // Log raw body length to ensure we have data
                    console.log(`[Proxy] DEBUG - GetUser Body Length: ${body.length}`);
                    // Log the first 200 chars to check format (it might be Protobuf, not JSON?)
                    console.log(
                      `[Proxy] DEBUG - GetUser Raw Body Start: ${body.substring(0, 200)}`,
                    );

                    const userInfo = JSON.parse(body);
                    console.log(
                      '[Proxy] DEBUG - Found StepFun User Info:',
                      JSON.stringify(userInfo, null, 2),
                    );

                    if (userInfo && userInfo.data && userInfo.data.email) {
                      console.log('[Proxy] ✓ Captured StepFun User Email:', userInfo.data.email);
                      proxyEvents.emit('stepfun-user-info', userInfo.data);
                    } else if (userInfo && userInfo.email) {
                      // Fallback structure check
                      console.log(
                        '[Proxy] ✓ Captured StepFun User Email (direct):',
                        userInfo.email,
                      );
                      proxyEvents.emit('stepfun-user-info', userInfo);
                    } else {
                      console.warn('[Proxy] ⚠ GetUser JSON parsed but no email field found!');
                    }
                  } catch (e) {
                    console.error('[Proxy] Failed to parse StepFun User Info (Uncompressed):', e);
                    console.error(
                      `[Proxy] DEBUG - Raw Body that failed to parse: ${body.substring(0, 500)}`,
                    );
                    console.error(
                      `[Proxy] DEBUG - Raw Body that failed to parse: ${body.substring(0, 500)}`,
                    );
                  }
                }

                // Logic for DeepSeek User Info
                if (
                  host.includes('chat.deepseek.com') &&
                  ctx.clientToProxyRequest.url.includes('/api/v0/users/current')
                ) {
                  try {
                    const userInfo = JSON.parse(body);
                    console.log('[Proxy] Found DeepSeek User Info:', JSON.stringify(userInfo));
                    if (userInfo.code === 0 && userInfo.data) {
                      proxyEvents.emit('deepseek-user-info', userInfo.data);
                    }
                  } catch (e) {
                    console.error('[Proxy] Failed to parse DeepSeek User Info:', e);
                  }
                }
              });
            }
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
