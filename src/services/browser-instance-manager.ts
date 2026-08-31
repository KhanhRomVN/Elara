/**
 * ------------------------------------------------------------------
 * Browser Instance Manager
 * ------------------------------------------------------------------
 * Quản lý các instance browser (Chrome/Firefox) cho provider browser-based.
 * Tạo profile, khởi động browser với extension, và theo dõi trạng thái.
 *
 * Main functions:
 * - getBrowserStatus()           : Kiểm tra browser đang chạy
 * - startBrowserForAccount()     : Khởi động browser cho account
 * - browserInstanceManager.getProfilePath() : Lấy đường dẫn profile
 * - browserInstanceManager.createProfile()  : Tạo profile mới
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('BrowserInstanceManager');

const runningBrowsers = new Map<string, ChildProcess>();

// ─── Helpers ────────────────────────────────────────────────────────────

const getUserDataPath = () => {
  try {
    return path.join(os.homedir(), '.elara');
  } catch (e) {
    return path.join(os.tmpdir(), 'elara-browser');
  }
};

const findBrowser = (): string | null => {
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/firefox',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/firefox',
    '/snap/bin/chromium',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      logger.info(`[BrowserInstanceManager] Found browser at: ${p}`);
      return p;
    }
  }

  try {
    const { execSync } = require('child_process');
    let output = execSync('which firefox', { encoding: 'utf-8', stdio: 'pipe' });
    if (!output.trim()) {
      output = execSync('which chromium', { encoding: 'utf-8', stdio: 'pipe' });
    }
    if (!output.trim()) {
      output = execSync('which google-chrome', { encoding: 'utf-8', stdio: 'pipe' });
    }
    if (output.trim()) return output.trim();
  } catch (e) {
    // ignore
  }

  return null;
};

// ─── Functions ──────────────────────────────────────────────────────────

export const getBrowserStatus = async (userDataDir: string): Promise<{ isRunning: boolean }> => {
  logger.info(`[BrowserInstanceManager] getBrowserStatus called for ${userDataDir}`);

  const normalizedKey = userDataDir.replace(/\/$/, '');
  const process = runningBrowsers.get(normalizedKey);

  if (process && !process.killed) {
    try {
      process.kill(0);
      logger.info(`[BrowserInstanceManager] Process ${process.pid} is running`);
      return { isRunning: true };
    } catch (e) {
      logger.info(`[BrowserInstanceManager] Process ${process.pid} is dead, removing from Map`);
      runningBrowsers.delete(normalizedKey);
      return { isRunning: false };
    }
  }

  for (const [key, proc] of runningBrowsers.entries()) {
    if (key.includes(userDataDir) || userDataDir.includes(key)) {
      logger.info(`[BrowserInstanceManager] Found partial match: key="${key}" vs query="${userDataDir}"`);
      try {
        proc.kill(0);
        logger.info(`[BrowserInstanceManager] Process ${proc.pid} is running (partial match)`);
        return { isRunning: true };
      } catch (e) {
        runningBrowsers.delete(key);
        break;
      }
    }
  }

  logger.info(`[BrowserInstanceManager] No process found for ${userDataDir}`);
  return { isRunning: false };
};

export const startBrowserForAccount = async (
  userDataDir: string,
  providerId: string,
  loginUrl: string = 'https://chat.z.ai/',
  extensionPath?: string,
): Promise<{ pid: number; userDataDir: string }> => {
  const status = await getBrowserStatus(userDataDir);
  if (status.isRunning) {
    logger.info(`[BrowserInstanceManager] Browser already running for ${userDataDir}`);
    return { pid: -1, userDataDir };
  }

  let browserPath = findBrowser();
  if (!browserPath) {
    throw new Error('No browser found. Please install Firefox, Chromium, or Google Chrome.');
  }

  const isFirefox = browserPath.includes('firefox');
  const isGoogleChrome = browserPath.includes('google-chrome') || browserPath.includes('Google Chrome');

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const args = [
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    loginUrl,
  ];

  if (extensionPath) {
    if (isFirefox) {
      args.push(`--load-extension=${extensionPath}`);
      if (!args.includes('--new-window')) {
        args.unshift('--new-window');
      }
      logger.info(`[BrowserInstanceManager] Loading extension in Firefox from: ${extensionPath}`);
    } else {
      logger.info(`[BrowserInstanceManager] Using Chrome/Chromium with manually installed extension.`);
      logger.info(`[BrowserInstanceManager] Ensure extension is installed at: chrome://extensions (Developer mode -> Load unpacked) -> ${extensionPath}`);
    }
  } else {
    if (!isFirefox) {
      args.push('--disable-extensions');
    }
    logger.info(`[BrowserInstanceManager] No extension provided, disabling all extensions`);
  }

  logger.info(`[BrowserInstanceManager] Launching browser for ${providerId} with profile: ${userDataDir}`);
  logger.info(`[BrowserInstanceManager] Browser args: ${args.join(' ')}`);

  const loggingArgs = [...args];
  if (!loggingArgs.includes('--enable-logging')) {
    loggingArgs.push('--enable-logging=stderr');
  }
  if (!loggingArgs.includes('--v=1')) {
    loggingArgs.push('--v=1');
  }

  const chromeProcess = spawn(browserPath, loggingArgs, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  runningBrowsers.set(userDataDir, chromeProcess);

  chromeProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('extension') || output.includes('Extension') ||
      output.includes('manifest') || output.includes('CRX') ||
      output.includes('Failed to load') || output.includes('error')) {
      logger.info(`[BrowserInstanceManager] Chrome stderr: ${output.trim()}`);
    } else if (process.env.DEBUG_CHROME === 'true') {
      logger.debug(`[BrowserInstanceManager] Chrome stderr: ${output.trim()}`);
    }
  });

  chromeProcess.stdout.on('data', (data) => {
    if (process.env.DEBUG_CHROME === 'true') {
      logger.debug(`[BrowserInstanceManager] Chrome stdout: ${data.toString().trim()}`);
    }
  });

  chromeProcess.on('exit', (code, signal) => {
    logger.info(`[BrowserInstanceManager] Browser exited for ${userDataDir} with code: ${code}, signal: ${signal}`);
    runningBrowsers.delete(userDataDir);
  });

  chromeProcess.on('error', (err) => {
    logger.error(`[BrowserInstanceManager] Browser error for ${userDataDir}:`, err);
    runningBrowsers.delete(userDataDir);
  });

  return { pid: chromeProcess.pid!, userDataDir };
};

// ─── Export ─────────────────────────────────────────────────────────────

export const browserInstanceManager = {
  getProfilePath: (providerId: string, profileName: string): string => {
    const basePath = getUserDataPath();
    const profilePath = path.join(basePath, 'profiles', providerId, profileName);
    logger.info(`[BrowserInstanceManager] Profile path for ${providerId}/${profileName}: ${profilePath}`);
    return profilePath;
  },

  createProfile: async (providerId: string, profileName: string, email?: string): Promise<{ id: string; userDataDir: string }> => {
    const profilePath = browserInstanceManager.getProfilePath(providerId, profileName);

    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
      logger.info(`[BrowserInstanceManager] Created profile directory: ${profilePath}`);
    }

    return {
      id: `${providerId}_${profileName}_${Date.now()}`,
      userDataDir: profilePath,
    };
  },
};