import { ipcMain } from 'electron';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export let BACKEND_PORT = 11434;
let BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export const setBackendPort = (port: number) => {
  BACKEND_PORT = port;
  BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
  console.log(`[IPC] Backend port updated to ${BACKEND_PORT}`);
};

interface PlatformInfo {
  platform: NodeJS.Platform;
  release: string;
  type: string;
  homedir: string;
  shell: string;
  profilePath: string;
  profileType: 'bash' | 'zsh' | 'fish' | 'powershell' | 'pwsh' | 'cmd' | 'unknown';
  distro?: string;
}

/**
 * Detect Linux distribution
 */
function getLinuxDistro(): string {
  try {
    if (fs.existsSync('/etc/os-release')) {
      const content = fs.readFileSync('/etc/os-release', 'utf-8');
      const idMatch = content.match(/^ID=(.*)$/m);
      if (idMatch) {
        return idMatch[1].replace(/"/g, '').toLowerCase();
      }
    }
    if (fs.existsSync('/etc/debian_version')) return 'debian';
    if (fs.existsSync('/etc/fedora-release')) return 'fedora';
    if (fs.existsSync('/etc/arch-release')) return 'arch';
    if (fs.existsSync('/etc/gentoo-release')) return 'gentoo';
    if (fs.existsSync('/etc/redhat-release')) return 'rhel';
  } catch {
    // Ignore errors
  }
  return 'unknown';
}

function getDefaultShell(): string {
  const platform = process.platform;
  if (process.env.SHELL) return process.env.SHELL;
  if (platform === 'win32') {
    if (process.env.PSModulePath?.includes('PowerShell\\7')) return 'pwsh';
    if (process.env.COMSPEC) return process.env.COMSPEC;
    return 'powershell';
  }
  return '';
}

function detectShellType(shellPath: string): PlatformInfo['profileType'] {
  const shell = shellPath.toLowerCase();
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';
  if (shell.includes('pwsh') || shell.includes('powershell/7')) return 'pwsh';
  if (shell.includes('powershell')) return 'powershell';
  if (shell.includes('cmd')) return 'cmd';
  return 'unknown';
}

function getProfilePath(
  platform: NodeJS.Platform,
  homedir: string,
  shellType: PlatformInfo['profileType'],
): string {
  switch (shellType) {
    case 'zsh':
      return path.join(homedir, '.zshrc');
    case 'bash':
      if (platform === 'darwin') {
        const bashProfile = path.join(homedir, '.bash_profile');
        if (fs.existsSync(bashProfile)) return bashProfile;
        return bashProfile;
      }
      return path.join(homedir, '.bashrc');
    case 'fish':
      return path.join(homedir, '.config', 'fish', 'config.fish');
    case 'pwsh':
    case 'powershell':
      return platform === 'win32'
        ? path.join(homedir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1')
        : path.join(homedir, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1');
    case 'cmd':
      return path.join(homedir, 'elara_env.cmd');
    default:
      if (platform === 'win32')
        return path.join(
          homedir,
          'Documents',
          'WindowsPowerShell',
          'Microsoft.PowerShell_profile.ps1',
        );
      if (platform === 'darwin') return path.join(homedir, '.zshrc');
      return path.join(homedir, '.bashrc');
  }
}

function getPlatformInfo(): PlatformInfo {
  const platform = process.platform;
  const homedir = os.homedir();
  const shell = getDefaultShell();
  const shellType = detectShellType(shell);
  const profilePath = getProfilePath(platform, homedir, shellType);

  const info: PlatformInfo = {
    platform,
    release: os.release(),
    type: os.type(),
    homedir,
    shell,
    profilePath,
    profileType: shellType === 'unknown' ? getDefaultProfileType(platform) : shellType,
  };
  if (platform === 'linux') info.distro = getLinuxDistro();
  return info;
}

function getDefaultProfileType(platform: NodeJS.Platform): PlatformInfo['profileType'] {
  switch (platform) {
    case 'win32':
      return 'powershell';
    case 'darwin':
      return 'zsh';
    default:
      return 'bash';
  }
}

function buildExportLine(
  key: string,
  value: string,
  profileType: PlatformInfo['profileType'],
): string {
  const escapedValue = value.replace(/"/g, '\\"');
  switch (profileType) {
    case 'powershell':
    case 'pwsh':
      return `$env:${key} = "${escapedValue}"`;
    case 'fish':
      return `set -gx ${key} "${escapedValue}"`;
    case 'cmd':
      return `SET "${key}=${value}"`;
    default:
      return `export ${key}="${escapedValue}"`;
  }
}

function getEnvMarkerStart(profileType: PlatformInfo['profileType']): string {
  if (profileType === 'cmd') return 'REM === ELARA CLAUDE CODE ENV START ===';
  return '# === ELARA CLAUDE CODE ENV START ===';
}

function getEnvMarkerEnd(profileType: PlatformInfo['profileType']): string {
  if (profileType === 'cmd') return 'REM === ELARA CLAUDE CODE ENV END ===';
  return '# === ELARA CLAUDE CODE ENV END ===';
}

function getSourceCommand(profilePath: string, profileType: PlatformInfo['profileType']): string {
  switch (profileType) {
    case 'powershell':
    case 'pwsh':
      return `. "${profilePath}"`;
    case 'fish':
      return `source "${profilePath}"`;
    case 'cmd':
      return `"${profilePath}"`;
    default:
      return `source "${profilePath}"`;
  }
}

export const setupServerHandlers = () => {
  ipcMain.handle('server:start', async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (res.ok) {
        return { success: true, port: BACKEND_PORT };
      }
    } catch (e) {
      // ignore
    }
    return {
      success: true,
      port: BACKEND_PORT,
      message: 'Backend managed by main process or external',
    };
  });

  ipcMain.handle('server:stop', async () => {
    return { success: true };
  });

  ipcMain.handle('server:get-providers', async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/v1/providers`);
      if (res.ok) {
        const data = await res.json();
        return data.data || data;
      }
    } catch (e) {
      console.error('Failed to fetch providers', e);
    }
    return [];
  });

  ipcMain.handle('server:get-info', async () => {
    return {
      running: true,
      port: BACKEND_PORT,
      host: 'localhost',
      https: false,
      strategy: 'path',
      localhostOnly: true,
    };
  });

  ipcMain.handle('server:get-env', async (_, key: string) => {
    if (process.env[key]) return process.env[key];
    try {
      const command = `echo "$${key}"`;
      const shell = process.env.SHELL || '/bin/bash';
      const { stdout } = await execAsync(`${shell} -i -c '${command}'`, {
        timeout: 1000,
        encoding: 'utf-8',
      });
      const value = stdout.trim();
      if (value) return value;
    } catch (e) {
      // ignore
    }
    return undefined;
  });

  ipcMain.handle('server:get-models', async (_, providerId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/v1/providers/${providerId}/models`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('[IPC] Failed to fetch dynamic models', e);
    }
    return { success: false, data: [] };
  });

  // Get platform information
  ipcMain.handle('server:get-platform-info', async () => {
    return getPlatformInfo();
  });

  // Save environment variables to system shell profile
  ipcMain.handle('server:save-env-to-system', async (_, envVars: any) => {
    console.log('[IPC] Handling server:save-env-to-system');

    try {
      const platformInfo = getPlatformInfo();
      const { profilePath, profileType, platform } = platformInfo;
      const profileDir = path.dirname(profilePath);
      if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

      let existingContent = '';
      if (fs.existsSync(profilePath)) existingContent = fs.readFileSync(profilePath, 'utf-8');

      const markerStart = getEnvMarkerStart(profileType);
      const markerEnd = getEnvMarkerEnd(profileType);
      const envLines: string[] = [markerStart];

      for (const [key, value] of Object.entries(envVars)) {
        if (value && typeof value === 'string') {
          envLines.push(buildExportLine(key, value, profileType));
        }
      }

      envLines.push(markerEnd);
      const lineEnding = platform === 'win32' ? '\r\n' : '\n';
      const newEnvBlock = envLines.join(lineEnding);

      let newContent = existingContent;
      const startIdx = existingContent.indexOf(markerStart);
      const endIdx = existingContent.indexOf(markerEnd);

      if (startIdx !== -1 && endIdx !== -1) {
        newContent =
          existingContent.substring(0, startIdx).trimEnd() +
          lineEnding +
          lineEnding +
          newEnvBlock +
          lineEnding +
          existingContent.substring(endIdx + markerEnd.length).trimStart();
      } else {
        newContent = existingContent.trimEnd() + lineEnding + lineEnding + newEnvBlock + lineEnding;
      }

      fs.writeFileSync(profilePath, newContent, 'utf-8');

      let message = `Environment variables saved to ${profilePath}.`;

      // Update current process.env
      for (const [key, value] of Object.entries(envVars)) {
        if (typeof value === 'string') process.env[key] = value;
      }

      return {
        success: true,
        profilePath,
        profileType,
        platform,
        message,
      };
    } catch (error: any) {
      console.error('[IPC] Failed to save env to system:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('server:restore-env-defaults', async () => {
    try {
      const platformInfo = getPlatformInfo();
      const { profilePath, profileType, platform } = platformInfo;
      if (!fs.existsSync(profilePath)) return { success: true };

      const existingContent = fs.readFileSync(profilePath, 'utf-8');
      const markerStart = getEnvMarkerStart(profileType);
      const markerEnd = getEnvMarkerEnd(profileType);

      const startIdx = existingContent.indexOf(markerStart);
      const endIdx = existingContent.indexOf(markerEnd);

      if (startIdx === -1 || endIdx === -1) return { success: true };

      const lineEnding = platform === 'win32' ? '\r\n' : '\n';
      const newContent =
        existingContent.substring(0, startIdx).trimEnd() +
        lineEnding +
        existingContent.substring(endIdx + markerEnd.length).trimStart();

      fs.writeFileSync(profilePath, newContent, 'utf-8');
      return { success: true, profilePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('server:check-system-env', async () => {
    try {
      const platformInfo = getPlatformInfo();
      const { profilePath, profileType } = platformInfo;
      const envKeys = [
        'ANTHROPIC_BASE_URL',
        'ANTHROPIC_AUTH_TOKEN',
        'ANTHROPIC_MODEL',
        'ANTHROPIC_DEFAULT_OPUS_MODEL',
        'ANTHROPIC_DEFAULT_SONNET_MODEL',
        'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      ];
      let currentValues: Record<string, string> = {};
      for (const key of envKeys) {
        if (process.env[key]) currentValues[key] = process.env[key]!;
      }

      let configured = false;
      if (fs.existsSync(profilePath)) {
        const content = fs.readFileSync(profilePath, 'utf-8');
        configured = content.includes(getEnvMarkerStart(profileType));
      }

      return { configured, profilePath, platformInfo, currentValues };
    } catch (e: any) {
      return { configured: false, error: e.message };
    }
  });

  const getApiUrl = async () => BACKEND_URL;

  const callBackend = async (url: string, method: string = 'GET', body?: any) => {
    try {
      const options: any = { method };
      if (body) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
      }
      const response = await fetch(url, options);
      return await response.json();
    } catch (e: any) {
      console.error(`[IPC] Backend call failed (${url}):`, e);
      return { success: false, message: e.message };
    }
  };

  ipcMain.handle('server:get-config-values', async (_, keys: string) => {
    return callBackend(`${await getApiUrl()}/v1/config/values?keys=${keys}`);
  });

  ipcMain.handle('server:save-config-values', async (_, values: Record<string, string>) => {
    return callBackend(`${await getApiUrl()}/v1/config/values`, 'PUT', values);
  });

  // Claude Code sync status
  ipcMain.handle('server:get-claudecode-sync-status', async (_, _proxyUrl: string) => {
    return { installed: true, is_synced: true, files: [] };
  });

  ipcMain.handle('server:execute-claudecode-sync', async (_, _args) => {
    return { success: true };
  });
};
