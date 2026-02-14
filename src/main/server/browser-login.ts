import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { app } from 'electron';
import { startProxy, stopProxy, proxyEvents } from './proxy';

interface LoginOptions {
  providerId: string;
  loginUrl: string;
  partition: string; // e.g. 'persist:claude' or just 'claude' used for profile folder name
  cookieEvent?: string; // Event that carries the cookie string
  headerEvent?: string; // Event that carries headers (optional)
  validate?: (
    data: any,
  ) => Promise<{ isValid: boolean; email?: string; cookies?: string; headers?: any }>;
  // Fallback email extraction if needed
  extraEvents?: string[]; // Other events to listen to
}

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

export async function loginWithRealBrowser(
  options: LoginOptions,
): Promise<{ cookies: string; email?: string; headers?: any }> {
  /*
    Generalized login flow:
    1. Find Chrome
    2. Start Proxy
    3. Spawn Chrome with dedicated user data dir
    4. Listen for proxy events
    5. Resolve on success or timeout
  */

  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome or Chromium not found. Please install it.');
  }

  const profileFolderName = options.partition.replace('persist:', '');
  const profilePath = join(app.getPath('userData'), 'profiles', profileFolderName);

  // STRICT CLEANUP: User requested to remove all profile data before opening
  // This ensures we always start with a clean browser (no previous accounts)
  try {
    if (fs.existsSync(profilePath)) {
      console.log(`[${options.providerId}] Force cleaning profile: ${profilePath}`);
      fs.rmSync(profilePath, { recursive: true, force: true });
    }
  } catch (e) {
    console.error(`[${options.providerId}] Failed to clean profile:`, e);
  }

  // Also cleanup any other stale profiles for this provider
  try {
    const profilesDir = join(app.getPath('userData'), 'profiles');
    if (fs.existsSync(profilesDir)) {
      const folders = fs.readdirSync(profilesDir);
      const prefix = options.providerId.toLowerCase() + '-';
      for (const folder of folders) {
        if (folder.startsWith(prefix) || folder === profileFolderName) {
          // Clean everything related to this provider to be safe
          const folderPath = join(profilesDir, folder);
          try {
            if (fs.existsSync(folderPath)) {
              fs.rmSync(folderPath, { recursive: true, force: true });
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    console.error(`[${options.providerId}] Failed to cleanup old profiles:`, e);
  }

  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  console.log(`[${options.providerId}] Starting Proxy...`);
  await startProxy();

  console.log(`[${options.providerId}] Spawning Chrome at: ${chromePath}`);

  const args = [
    '--proxy-server=http=127.0.0.1:22122;https=127.0.0.1:22122',
    '--proxy-bypass-list=<-loopback>',
    '--ignore-certificate-errors',
    `--user-data-dir=${profilePath}`,
    '--disable-http2',
    '--disable-quic',
    '--no-first-run',
    '--no-default-browser-check',
    `--class=${options.providerId.toLowerCase()}-browser`,
    options.loginUrl,
  ];

  const chromeProcess = spawn(chromePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (chromeProcess.stdout)
    chromeProcess.stdout.on('data', (d) => console.log(`[Chrome Out]: ${d}`));
  if (chromeProcess.stderr)
    chromeProcess.stderr.on('data', (d) => console.error(`[Chrome Err]: ${d}`));

  return new Promise((resolve, reject) => {
    let resolved = false;
    // Captures
    let capturedCookies = '';
    let capturedEmail = '';
    let capturedHeaders = {};

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          chromeProcess.kill();
        } catch (e) {}
        stopProxy();
        if (options.cookieEvent) proxyEvents.off(options.cookieEvent, onCookie);
        if (options.headerEvent) proxyEvents.off(options.headerEvent, onHeader);
        // Remove extra listeners if any
      }
    };

    const resolveIfReady = async () => {
      if (capturedCookies && !resolved) {
        // If validation is required
        if (options.validate) {
          try {
            const result = await options.validate({
              cookies: capturedCookies,
              headers: capturedHeaders,
              email: capturedEmail,
            });
            if (result.isValid) {
              console.log(`[${options.providerId}] Validation success!`);
              cleanup();
              resolve({
                cookies: result.cookies || capturedCookies,
                email: result.email || capturedEmail,
                headers: result.headers || capturedHeaders,
              });
            }
          } catch (e) {
            console.error(`[${options.providerId}] Validation failed (retrying):`, e);
          }
        } else {
          // No validation, simple resolve
          cleanup();
          resolve({ cookies: capturedCookies, email: capturedEmail, headers: capturedHeaders });
        }
      }
    };

    const onCookie = (data: any) => {
      console.log(`[${options.providerId}] Cookie event received`);
      // If data is string (cookie string) or object
      if (typeof data === 'string') capturedCookies = data;
      else if (data && data.cookies) capturedCookies = data.cookies; // Adapt as needed

      // Sometimes cookie event might carry other info
      if (data && data.email) capturedEmail = data.email;

      resolveIfReady();
    };

    const onHeader = (data: any) => {
      console.log(`[${options.providerId}] Header event received`);
      capturedHeaders = { ...capturedHeaders, ...data };
      resolveIfReady();
    };

    if (options.cookieEvent) proxyEvents.on(options.cookieEvent, onCookie);
    if (options.headerEvent) proxyEvents.on(options.headerEvent, onHeader);

    // Timeout 3 mins
    setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('Login timed out'));
      }
    }, 180000);

    chromeProcess.on('close', (code) => {
      if (!resolved) {
        // If we have cookies, try one last check/resolve
        if (capturedCookies) {
          resolveIfReady().catch(() => {
            cleanup();
            reject(new Error('User closed window'));
          });
        } else {
          console.log(`[${options.providerId}] Chrome closed with code ${code}`);
          cleanup();
          reject(new Error('User closed login window'));
        }
      }
    });
  });
}
