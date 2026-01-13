import { Request, Response } from 'express';
// import fetch from 'node-fetch'; // Electron 28 has global fetch
import { Account } from '../ipc/accounts'; // Fix import path
import { app } from 'electron';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';
const getCookies = (account: Account) => {
  if (!account.credential) return [];
  try {
    return JSON.parse(account.credential);
  } catch (error) {
    return account.credential.split(';').map((c) => {
      const parts = c.trim().split('=');
      const name = parts[0];
      const value = parts.slice(1).join('=');
      return { name, value };
    });
  }
};

const getCookieValue = (cookies: any[], name: string) => {
  const cookie = cookies.find((c: any) => c.name === name);
  return cookie ? cookie.value : '';
};

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

// Helper to decode JWT and get specific claim
const getOrgIdFromJwt = (token: string): string | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(''),
    );

    const payload = JSON.parse(jsonPayload);
    console.log('[Groq Debug] Decoded JWT Payload:', JSON.stringify(payload, null, 2));

    // Look for organization ID in custom claims or standard fields based on log
    // Log shows: "https://groq.com/organization": { "id": "org_..." }
    if (payload['https://groq.com/organization'] && payload['https://groq.com/organization'].id) {
      return payload['https://groq.com/organization'].id;
    }
    return null;
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
};

const orgIdCache: Record<string, string> = {};

export const chatCompletionStream = async (req: Request, res: Response, account: Account) => {
  console.log('[Groq Debug] Starting chatCompletionStream');
  const cookies = getCookies(account);
  console.log(
    '[Groq Debug] Cookies parsing result:',
    cookies ? 'Success (array of ' + cookies.length + ')' : 'Failed or Empty',
  );

  const sessionJwt = getCookieValue(cookies, 'stytch_session_jwt');
  console.log(
    '[Groq Debug] Session JWT found:',
    sessionJwt ? 'Yes (Length: ' + sessionJwt.length + ')' : 'No',
  );

  let orgId = getOrgIdFromJwt(sessionJwt);
  console.log('[Groq Debug] Org ID from JWT:', orgId);

  // Fallback: Fetch Org ID from profile if not found in JWT
  if (!orgId) {
    if (orgIdCache[sessionJwt]) {
      orgId = orgIdCache[sessionJwt];
      console.log('[Groq Debug] Org ID found in cache:', orgId);
    } else {
      console.log('[Groq] Org ID not found in JWT, fetching profile...');
      try {
        console.log(
          '[Groq Debug] Fetching profile from https://api.groq.com/platform/v1/user/profile',
        );
        const profileResp = await fetch('https://api.groq.com/platform/v1/user/profile', {
          headers: {
            Authorization: `Bearer ${sessionJwt}`,
            Origin: 'https://console.groq.com',
            Referer: 'https://console.groq.com/',
            'User-Agent': USER_AGENT,
          },
        });

        console.log('[Groq Debug] Profile fetch status:', profileResp.status);

        if (profileResp.ok) {
          const profileData = await profileResp.json();
          // Extract Org ID from response
          // Response structure based on doc:
          // { "user": { "orgs": { "data": [ { "id": "org_..." } ] } } }
          const orgs = profileData?.user?.orgs?.data;
          console.log('[Groq Debug] Profile data orgs:', JSON.stringify(orgs));

          if (orgs && orgs.length > 0) {
            orgId = orgs[0].id;
            console.log('[Groq] Org ID fetched from profile:', orgId);
            if (orgId) {
              orgIdCache[sessionJwt] = orgId;
              console.log('[Groq Debug] Org ID cached under JWT hash...'); // Don't log full jwt if possible
            }
          } else {
            console.log(
              '[Groq Debug] No organizations found in profile data. Response:',
              JSON.stringify(profileData),
            );
          }
        } else {
          const errorText = await profileResp.text();
          console.error('[Groq] Failed to fetch profile. Status:', profileResp.status);
          console.error('[Groq] Profile fetch error details:', errorText);
          console.error(
            '[Groq] Profile fetch headers:',
            JSON.stringify(Object.fromEntries(profileResp.headers.entries())),
          );
        }
      } catch (err) {
        console.error('[Groq] Error fetching profile:', err);
      }
    }
  }

  try {
    const headers: any = {
      Authorization: `Bearer ${sessionJwt}`,
      'Content-Type': 'application/json',
      Origin: 'https://console.groq.com',
      Referer: 'https://console.groq.com/',
      'User-Agent': USER_AGENT,
    };

    if (orgId) {
      headers['groq-organization'] = orgId;
    }

    console.log(
      '[Groq Debug] Request headers prepared. Groq-Organization:',
      headers['groq-organization'],
    );
    console.log('[Groq Debug] Sending request to https://api.groq.com/openai/v1/chat/completions');

    // Filter out unsupported fields like conversation_id, parent_message_id
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { conversation_id, parent_message_id, ...cleanBody } = req.body;

    // Force usage of the correct model found in logs
    cleanBody.model = 'openai/gpt-oss-120b';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(cleanBody),
    });

    console.log('[Groq Debug] Chat completion response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API Error:', response.status, errorText);
      res.status(response.status).json({ error: errorText });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (response.body) {
      console.log('[Groq Debug] Streaming response started');
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        console.log('[Groq Debug] Streaming response completed');
      } finally {
        reader.releaseLock();
      }
      res.end();
    } else {
      console.log('[Groq Debug] Response has no body');
      res.end();
    }
  } catch (error) {
    console.error('Groq Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getConversations = async (_req: Request, res: Response, _account: Account) => {
  // Groq Console doesn't seem to have a persistent history API
  res.json([]);
};

const findChrome = (): string | null => {
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  try {
    const output = execSync('which google-chrome || which chromium', { encoding: 'utf-8' });
    if (output.trim()) return output.trim();
  } catch (e) {
    // ignore
  }

  return null;
};

export async function login() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome or Chromium not found. Please install it to use Groq.');
  }

  const profilePath = join(app.getPath('userData'), 'profiles', 'groq');
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  console.log('[Groq] Starting Proxy...');
  await startProxy();

  console.log('[Groq] Spawning Chrome at:', chromePath);

  const args = [
    '--proxy-server=http=127.0.0.1:8080;https=127.0.0.1:8080',
    '--proxy-bypass-list=<-loopback>',
    '--ignore-certificate-errors',
    `--user-data-dir=${profilePath}`,
    '--disable-http2',
    '--disable-quic',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    `--user-agent=${USER_AGENT}`,
    '--class=groq-browser',
    'https://console.groq.com/login',
  ];

  const chromeProcess = spawn(chromePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (chromeProcess.stdout) {
    chromeProcess.stdout.on('data', (data) => console.log(`[Groq Chrome Out]: ${data}`));
  }
  if (chromeProcess.stderr) {
    chromeProcess.stderr.on('data', (data) => console.error(`[Groq Chrome Err]: ${data}`));
  }

  return new Promise<{ cookies: string; email: string }>((resolve, reject) => {
    let resolved = false;
    let capturedCookies = '';

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        chromeProcess.kill();
        stopProxy();
        proxyEvents.off('groq-cookies', onCookies);
      }
    };

    const onCookies = (cookies: string) => {
      console.log('[Groq] Cookies captured!');
      capturedCookies = cookies;

      // Extract details immediately
      let email = '';
      try {
        const cookieList = cookies.split(';').map((c) => {
          const parts = c.trim().split('=');
          return { name: parts[0], value: parts.slice(1).join('=') };
        });
        const sessionJwt = getCookieValue(cookieList, 'stytch_session_jwt');
        if (sessionJwt) {
          const base64Url = sessionJwt.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join(''),
          );
          const payload = JSON.parse(jsonPayload);

          // Try to get email from stytch session claim
          // Structure: "https://stytch.com/session": { "authentication_factors": [ { "email_factor": { "email_address": "..." } } ] }
          const stytchSession = payload['https://stytch.com/session'];
          if (
            stytchSession &&
            stytchSession.authentication_factors &&
            stytchSession.authentication_factors.length > 0
          ) {
            const factor = stytchSession.authentication_factors[0];
            if (factor.email_factor && factor.email_factor.email_address) {
              email = factor.email_factor.email_address;
              console.log('[Groq] Extracted email from JWT:', email);
            }
          }
        }
      } catch (e) {
        console.error('[Groq] Failed to extract email from JWT:', e);
      }

      setTimeout(() => {
        cleanup();
        resolve({ cookies: capturedCookies, email });
      }, 1000);
    };

    proxyEvents.on('groq-cookies', onCookies);

    chromeProcess.on('close', (code) => {
      if (!resolved) {
        if (capturedCookies) {
          cleanup();
          resolve({ cookies: capturedCookies, email: '' });
        } else {
          console.log('[Groq] Chrome closed with code:', code);
          cleanup();
          reject(new Error('Chrome user closed the window before login completed'));
        }
      }
    });
  });
}
