import { Request, Response } from 'express';
// import fetch from 'node-fetch'; // Electron 28 has global fetch
import { Account } from '../ipc/accounts'; // Fix import path
import { app } from 'electron';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';
const getCookies = (account: Account) => {
  return account.credential ? JSON.parse(account.credential) : [];
};

const getCookieValue = (cookies: any[], name: string) => {
  const cookie = cookies.find((c: any) => c.name === name);
  return cookie ? cookie.value : '';
};

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

export const chatCompletionStream = async (req: Request, res: Response, account: Account) => {
  const cookies = getCookies(account);
  const sessionJwt = getCookieValue(cookies, 'stytch_session_jwt');

  const orgId = getOrgIdFromJwt(sessionJwt);

  try {
    const headers: any = {
      Authorization: `Bearer ${sessionJwt}`,
      'Content-Type': 'application/json',
      Origin: 'https://console.groq.com',
      Referer: 'https://console.groq.com/',
    };

    if (orgId) {
      headers['groq-organization'] = orgId;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

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
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
    } else {
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
    '--class=groq-browser',
    'https://console.groq.com/playground',
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

      // We need to parse jwt to get email if possible, or we resolve and let accounts.ts handle email
      // Here we just return cookies and let accounts.ts extract email from the JWT inside the cookie

      setTimeout(() => {
        cleanup();
        resolve({ cookies: capturedCookies, email: '' }); // Email extraction will happen in accounts.ts or helper
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
