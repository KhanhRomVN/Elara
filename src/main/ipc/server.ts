import { ipcMain } from 'electron';
import { startServer, stopServer } from '../server';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
    // Try /etc/os-release first (works on most modern distros)
    if (fs.existsSync('/etc/os-release')) {
      const content = fs.readFileSync('/etc/os-release', 'utf-8');
      const idMatch = content.match(/^ID=(.*)$/m);
      if (idMatch) {
        return idMatch[1].replace(/"/g, '').toLowerCase();
      }
    }
    // Fallback checks
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

/**
 * Get the default shell for the current user
 */
function getDefaultShell(): string {
  const platform = process.platform;

  // Check SHELL env first (Unix-like systems)
  if (process.env.SHELL) {
    return process.env.SHELL;
  }

  // Windows - check for PowerShell Core, then Windows PowerShell
  if (platform === 'win32') {
    // Check if pwsh (PowerShell Core) is available
    if (process.env.PSModulePath?.includes('PowerShell\\7')) {
      return 'pwsh';
    }
    // Check COMSPEC for cmd
    if (process.env.COMSPEC) {
      return process.env.COMSPEC;
    }
    return 'powershell';
  }

  return '';
}

/**
 * Detect shell type from shell path
 */
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

/**
 * Get shell profile path based on platform and shell type
 */
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
        // macOS: prefer .bash_profile for login shells, but check .bashrc too
        const bashProfile = path.join(homedir, '.bash_profile');
        const bashrc = path.join(homedir, '.bashrc');
        // If .bash_profile exists and sources .bashrc, use .bashrc
        if (fs.existsSync(bashProfile)) {
          const content = fs.readFileSync(bashProfile, 'utf-8');
          if (content.includes('.bashrc')) {
            return bashrc;
          }
          return bashProfile;
        }
        return bashProfile;
      }
      // Linux: use .bashrc
      return path.join(homedir, '.bashrc');

    case 'fish':
      return path.join(homedir, '.config', 'fish', 'config.fish');

    case 'pwsh':
      // PowerShell Core (cross-platform)
      if (platform === 'win32') {
        return path.join(homedir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
      } else if (platform === 'darwin') {
        return path.join(homedir, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1');
      } else {
        return path.join(homedir, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1');
      }

    case 'powershell':
      // Windows PowerShell (Windows only)
      return path.join(
        homedir,
        'Documents',
        'WindowsPowerShell',
        'Microsoft.PowerShell_profile.ps1',
      );

    case 'cmd':
      // CMD doesn't have a standard profile, use a custom batch file
      return path.join(homedir, 'elara_env.cmd');

    default:
      // Fallback based on platform
      if (platform === 'win32') {
        return path.join(
          homedir,
          'Documents',
          'WindowsPowerShell',
          'Microsoft.PowerShell_profile.ps1',
        );
      } else if (platform === 'darwin') {
        return path.join(homedir, '.zshrc'); // macOS default since Catalina
      } else {
        return path.join(homedir, '.bashrc'); // Linux default
      }
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

  // Add distro info for Linux
  if (platform === 'linux') {
    info.distro = getLinuxDistro();
  }

  return info;
}

/**
 * Get default profile type based on platform
 */
function getDefaultProfileType(platform: NodeJS.Platform): PlatformInfo['profileType'] {
  switch (platform) {
    case 'win32':
      return 'powershell';
    case 'darwin':
      return 'zsh'; // Default since macOS Catalina
    default:
      return 'bash';
  }
}

/**
 * Build export line based on shell type
 */
function buildExportLine(
  key: string,
  value: string,
  profileType: PlatformInfo['profileType'],
): string {
  // Escape special characters in value
  const escapedValue = value.replace(/"/g, '\\"');

  switch (profileType) {
    case 'powershell':
    case 'pwsh':
      return `$env:${key} = "${escapedValue}"`;
    case 'fish':
      return `set -gx ${key} "${escapedValue}"`;
    case 'cmd':
      // CMD uses SET command
      return `SET "${key}=${value}"`;
    default: // bash, zsh
      return `export ${key}="${escapedValue}"`;
  }
}

/**
 * Get marker comments based on shell type
 */
function getEnvMarkerStart(profileType: PlatformInfo['profileType']): string {
  if (profileType === 'cmd') {
    return 'REM === ELARA CLAUDE CODE ENV START ===';
  }
  return '# === ELARA CLAUDE CODE ENV START ===';
}

function getEnvMarkerEnd(profileType: PlatformInfo['profileType']): string {
  if (profileType === 'cmd') {
    return 'REM === ELARA CLAUDE CODE ENV END ===';
  }
  return '# === ELARA CLAUDE CODE ENV END ===';
}

/**
 * Get source command based on platform
 */
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
    const result = await startServer();
    if (result.success && result.port) {
      // Sync the port to config manager (in-memory only or persisted provided by implementation)
      // This ensures getServerInfo() returns the correct port if we fell back to an existing one
      const { updateProxyConfig } = await import('../server/config');
      updateProxyConfig({ port: result.port });
    }
    return result;
  });

  ipcMain.handle('server:stop', async () => {
    return stopServer();
  });

  ipcMain.handle('server:get-providers', async () => {
    const { getProviders } = await import('../server/provider-registry');
    return await getProviders();
  });

  ipcMain.handle('server:get-info', async () => {
    console.log('[IPC] Handling server:get-info');
    const { getProxyConfig } = await import('../server/config');
    return getProxyConfig();
  });

  ipcMain.handle('server:get-env', async (_, key: string) => {
    console.log(`[IPC] Handling server:get-env for key: ${key}`);

    // 1. Try process.env first
    if (process.env[key]) {
      return process.env[key];
    }

    // 2. Try to get from shell
    try {
      // Use bash explicitly to get env vars from user's shell profile
      // -i (interactive) and -l (login) ensures profiles are loaded
      const command = `echo "$${key}"`;
      const shell = process.env.SHELL || '/bin/bash';

      const { stdout } = await execAsync(`${shell} -i -c '${command}'`, {
        timeout: 1000,
        encoding: 'utf-8',
      });

      const value = stdout.trim();
      if (value) {
        console.log(`[IPC] Retrieved ${key} from shell: ${value}`);
        return value;
      }
    } catch (e) {
      console.warn(`[IPC] Failed to retrieve ${key} from shell:`, e);
    }

    return undefined;
  });

  ipcMain.handle('server:get-models', async (_, providerId: string) => {
    const { getProviderById, getProviderStaticModels } =
      await import('../server/provider-registry');

    // Try static first
    const staticModels = await getProviderStaticModels(providerId);
    if (staticModels && staticModels.length > 0) {
      return { success: true, data: staticModels, source: 'static' };
    }

    // Try fetching from our own API
    try {
      const { getProxyConfig } = await import('../server/config');
      const port = getProxyConfig().port;
      const response = await fetch(`http://localhost:${port}/v1/providers/${providerId}/models`);
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
    console.log('[IPC] Handling server:get-platform-info');
    return getPlatformInfo();
  });

  // Save environment variables to system shell profile
  ipcMain.handle(
    'server:save-env-to-system',
    async (
      _,
      envVars: {
        ANTHROPIC_BASE_URL: string;
        ANTHROPIC_AUTH_TOKEN?: string;
        ANTHROPIC_MODEL?: string;
        ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
        ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
        ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
      },
    ) => {
      console.log('[IPC] Handling server:save-env-to-system');

      try {
        const platformInfo = getPlatformInfo();
        const { profilePath, profileType, platform } = platformInfo;

        // Create directory if it doesn't exist
        const profileDir = path.dirname(profilePath);
        if (!fs.existsSync(profileDir)) {
          fs.mkdirSync(profileDir, { recursive: true });
        }

        // Read existing content
        let existingContent = '';
        if (fs.existsSync(profilePath)) {
          existingContent = fs.readFileSync(profilePath, 'utf-8');
        }

        // Build new env block
        const markerStart = getEnvMarkerStart(profileType);
        const markerEnd = getEnvMarkerEnd(profileType);
        const envLines: string[] = [markerStart];

        if (envVars.ANTHROPIC_BASE_URL) {
          envLines.push(
            buildExportLine('ANTHROPIC_BASE_URL', envVars.ANTHROPIC_BASE_URL, profileType),
          );
        }
        if (envVars.ANTHROPIC_AUTH_TOKEN) {
          envLines.push(
            buildExportLine('ANTHROPIC_AUTH_TOKEN', envVars.ANTHROPIC_AUTH_TOKEN, profileType),
          );
        }
        if (envVars.ANTHROPIC_MODEL) {
          envLines.push(buildExportLine('ANTHROPIC_MODEL', envVars.ANTHROPIC_MODEL, profileType));
        }
        if (envVars.ANTHROPIC_DEFAULT_OPUS_MODEL) {
          envLines.push(
            buildExportLine(
              'ANTHROPIC_DEFAULT_OPUS_MODEL',
              envVars.ANTHROPIC_DEFAULT_OPUS_MODEL,
              profileType,
            ),
          );
        }
        if (envVars.ANTHROPIC_DEFAULT_SONNET_MODEL) {
          envLines.push(
            buildExportLine(
              'ANTHROPIC_DEFAULT_SONNET_MODEL',
              envVars.ANTHROPIC_DEFAULT_SONNET_MODEL,
              profileType,
            ),
          );
        }
        if (envVars.ANTHROPIC_DEFAULT_HAIKU_MODEL) {
          envLines.push(
            buildExportLine(
              'ANTHROPIC_DEFAULT_HAIKU_MODEL',
              envVars.ANTHROPIC_DEFAULT_HAIKU_MODEL,
              profileType,
            ),
          );
        }

        envLines.push(markerEnd);

        // Use appropriate line ending
        const lineEnding = platform === 'win32' ? '\r\n' : '\n';
        const newEnvBlock = envLines.join(lineEnding);

        // Remove existing block if present
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
          // Append to end
          newContent =
            existingContent.trimEnd() + lineEnding + lineEnding + newEnvBlock + lineEnding;
        }

        // Write back
        fs.writeFileSync(profilePath, newContent, 'utf-8');

        console.log(`[IPC] Environment variables saved to ${profilePath}`);

        const sourceCmd = getSourceCommand(profilePath, profileType);
        let message: string;

        if (platform === 'win32') {
          if (profileType === 'cmd') {
            message = `Environment variables saved to ${profilePath}. Run the file or restart your terminal to apply.`;
          } else {
            message = `Environment variables saved to ${profilePath}. Restart PowerShell or run: ${sourceCmd}`;
          }
        } else {
          message = `Environment variables saved to ${profilePath}. Run: ${sourceCmd} or open a new terminal.`;
        }

        // Update current process.env so changes take effect immediately for the app
        if (envVars.ANTHROPIC_BASE_URL) process.env.ANTHROPIC_BASE_URL = envVars.ANTHROPIC_BASE_URL;
        if (envVars.ANTHROPIC_AUTH_TOKEN)
          process.env.ANTHROPIC_AUTH_TOKEN = envVars.ANTHROPIC_AUTH_TOKEN;
        if (envVars.ANTHROPIC_MODEL) process.env.ANTHROPIC_MODEL = envVars.ANTHROPIC_MODEL;
        if (envVars.ANTHROPIC_DEFAULT_OPUS_MODEL)
          process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = envVars.ANTHROPIC_DEFAULT_OPUS_MODEL;
        if (envVars.ANTHROPIC_DEFAULT_SONNET_MODEL)
          process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = envVars.ANTHROPIC_DEFAULT_SONNET_MODEL;
        if (envVars.ANTHROPIC_DEFAULT_HAIKU_MODEL)
          process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = envVars.ANTHROPIC_DEFAULT_HAIKU_MODEL;

        return {
          success: true,
          profilePath,
          profileType,
          platform,
          message,
        };
      } catch (error: any) {
        console.error('[IPC] Failed to save env to system:', error);
        return {
          success: false,
          error: error.message || 'Failed to save environment variables to system',
        };
      }
    },
  );

  // Restore defaults - remove Elara env block from shell profile
  ipcMain.handle('server:restore-env-defaults', async () => {
    console.log('[IPC] Handling server:restore-env-defaults');

    try {
      const platformInfo = getPlatformInfo();
      const { profilePath, profileType, platform } = platformInfo;

      if (!fs.existsSync(profilePath)) {
        return {
          success: true,
          message: 'No profile file found to restore.',
        };
      }

      const existingContent = fs.readFileSync(profilePath, 'utf-8');
      const markerStart = getEnvMarkerStart(profileType);
      const markerEnd = getEnvMarkerEnd(profileType);

      const startIdx = existingContent.indexOf(markerStart);
      const endIdx = existingContent.indexOf(markerEnd);

      if (startIdx === -1 || endIdx === -1) {
        return {
          success: true,
          message: 'No Elara configuration found in shell profile.',
        };
      }

      // Remove the block
      const lineEnding = platform === 'win32' ? '\r\n' : '\n';
      const newContent =
        existingContent.substring(0, startIdx).trimEnd() +
        lineEnding +
        existingContent.substring(endIdx + markerEnd.length).trimStart();

      fs.writeFileSync(profilePath, newContent, 'utf-8');

      console.log(`[IPC] Environment variables removed from ${profilePath}`);

      const sourceCmd = getSourceCommand(profilePath, profileType);
      const message =
        platform === 'win32'
          ? `Elara configuration removed from ${profilePath}. Restart your terminal to apply.`
          : `Elara configuration removed from ${profilePath}. Run: ${sourceCmd} or open a new terminal.`;

      // Remove from current process.env
      delete process.env.ANTHROPIC_BASE_URL;
      delete process.env.ANTHROPIC_AUTH_TOKEN;
      delete process.env.ANTHROPIC_MODEL;
      delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL;
      delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
      delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;

      return {
        success: true,
        profilePath,
        message,
      };
    } catch (error: any) {
      console.error('[IPC] Failed to restore env defaults:', error);
      return {
        success: false,
        error: error.message || 'Failed to restore environment defaults',
      };
    }
  });

  // Check if Elara env is already configured in system
  ipcMain.handle('server:check-system-env', async () => {
    console.log('[IPC] Handling server:check-system-env');

    try {
      const platformInfo = getPlatformInfo();
      const { profilePath, profileType } = platformInfo;

      // Always include current process.env values as fallback
      const envKeys = [
        'ANTHROPIC_BASE_URL',
        'ANTHROPIC_AUTH_TOKEN',
        'ANTHROPIC_MODEL',
        'ANTHROPIC_DEFAULT_OPUS_MODEL',
        'ANTHROPIC_DEFAULT_SONNET_MODEL',
        'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      ];

      let currentValues: Record<string, string> = {};

      // First, get values from process.env (current shell environment)
      for (const key of envKeys) {
        if (process.env[key]) {
          currentValues[key] = process.env[key]!;
        }
      }

      if (!fs.existsSync(profilePath)) {
        return {
          configured: false,
          profilePath,
          platformInfo,
          currentValues,
        };
      }

      const content = fs.readFileSync(profilePath, 'utf-8');
      const markerStart = getEnvMarkerStart(profileType);
      const configured = content.includes(markerStart);

      // If Elara block exists, also parse values from it (may override process.env)
      if (configured) {
        const markerEnd = getEnvMarkerEnd(profileType);
        const startIdx = content.indexOf(markerStart);
        const endIdx = content.indexOf(markerEnd);

        if (startIdx !== -1 && endIdx !== -1) {
          const block = content.substring(startIdx, endIdx + markerEnd.length);
          const lines = block.split(/\r?\n/);

          for (const line of lines) {
            // Parse different shell syntaxes
            // bash/zsh: export KEY="value"
            const bashMatch = line.match(/export\s+(\w+)="([^"]*)"/);
            // fish: set -gx KEY "value"
            const fishMatch = line.match(/set\s+-gx\s+(\w+)\s+"([^"]*)"/);
            // PowerShell: $env:KEY = "value"
            const psMatch = line.match(/\$env:(\w+)\s*=\s*"([^"]*)"/);
            // CMD: SET "KEY=value"
            const cmdMatch = line.match(/SET\s+"(\w+)=([^"]*)"/i);

            const match = bashMatch || fishMatch || psMatch || cmdMatch;
            if (match) {
              currentValues[match[1]] = match[2];
            }
          }
        }
      }

      return {
        configured,
        profilePath,
        platformInfo,
        currentValues,
      };
    } catch (error: any) {
      console.error('[IPC] Failed to check system env:', error);
      return {
        configured: false,
        error: error.message,
      };
    }
  });

  const getApiUrl = async () => {
    const { getProxyConfig } = await import('../server/config');
    const port = getProxyConfig()?.port || 11434;
    return `http://localhost:${port}/v1`;
  };

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
    return callBackend(`${await getApiUrl()}/config/values?keys=${keys}`);
  });

  ipcMain.handle('server:save-config-values', async (_, values: Record<string, string>) => {
    return callBackend(`${await getApiUrl()}/config/values`, 'PUT', values);
  });

  // --- New Claude Code CLI JSON Sync Mechanism ---

  const getClaudeCodeFiles = () => {
    const homedir = os.homedir();
    return [
      {
        name: '.claude.json',
        path: path.join(homedir, '.claude.json'),
      },
      {
        name: 'settings.json',
        path: path.join(homedir, '.claude', 'settings.json'),
      },
    ];
  };

  ipcMain.handle('server:get-claudecode-sync-status', async (_, proxyUrl: string) => {
    console.log('[IPC] Handling server:get-claudecode-sync-status');
    try {
      const files = getClaudeCodeFiles();
      let installed = false;
      let version = null;

      // Check if installed
      try {
        const { stdout } = await execAsync('claude --version');
        installed = true;
        version = stdout.trim();
        // Extract version number
        const matches = version.match(/(\d+\.\d+\.\d+)/);
        if (matches) version = matches[1];
      } catch (e) {
        installed = false;
      }

      let allSynced = true;
      let hasBackup = false;
      let currentBaseUrl = null;

      for (const file of files) {
        const backupPath = `${file.path}.antigravity.bak`;
        if (fs.existsSync(backupPath)) {
          hasBackup = true;
        }

        if (!fs.existsSync(file.path)) {
          allSynced = false;
          continue;
        }

        const content = fs.readFileSync(file.path, 'utf-8');
        try {
          const json = JSON.parse(content);
          if (file.name === 'settings.json') {
            const url = json.env?.ANTHROPIC_BASE_URL;
            if (url) {
              currentBaseUrl = url;
              if (url.replace(/\/+$/, '') !== proxyUrl.replace(/\/+$/, '')) {
                allSynced = false;
              }
            } else {
              allSynced = false;
            }
          } else if (file.name === '.claude.json') {
            if (json.hasCompletedOnboarding !== true) {
              allSynced = false;
            }
          }
        } catch (e) {
          allSynced = false;
        }
      }

      return {
        installed,
        version,
        is_synced: allSynced,
        has_backup: hasBackup,
        current_base_url: currentBaseUrl,
        files: files.map((f) => f.name),
      };
    } catch (error: any) {
      console.error('[IPC] Failed to get Claude Code sync status:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle(
    'server:execute-claudecode-sync',
    async (_, { proxyUrl, apiKey }: { proxyUrl: string; apiKey: string }) => {
      console.log('[IPC] Handling server:execute-claudecode-sync');
      try {
        const files = getClaudeCodeFiles();

        for (const file of files) {
          // Ensure directory exists
          const dir = path.dirname(file.path);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Backup if not exists
          if (fs.existsSync(file.path)) {
            const backupPath = `${file.path}.antigravity.bak`;
            if (!fs.existsSync(backupPath)) {
              fs.copyFileSync(file.path, backupPath);
            }
          }

          let content = '{}';
          if (fs.existsSync(file.path)) {
            content = fs.readFileSync(file.path, 'utf-8');
          }

          let json: any = {};
          try {
            json = JSON.parse(content);
          } catch (e) {
            json = {};
          }

          if (file.name === '.claude.json') {
            json.hasCompletedOnboarding = true;
          } else if (file.name === 'settings.json') {
            if (!json.env) json.env = {};
            json.env.ANTHROPIC_BASE_URL = proxyUrl;
            json.env.ANTHROPIC_API_KEY = apiKey;

            // Normalize Auth: Clear token to avoid conflict with API Key
            delete json.env.ANTHROPIC_AUTH_TOKEN;

            // Clear old model variables to allow Backend Model Mapping to take over
            delete json.env.ANTHROPIC_MODEL;
            delete json.env.ANTHROPIC_DEFAULT_OPUS_MODEL;
            delete json.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
            delete json.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
          }

          fs.writeFileSync(file.path, JSON.stringify(json, null, 2), 'utf-8');
        }

        return { success: true };
      } catch (error: any) {
        console.error('[IPC] Failed to execute Claude Code sync:', error);
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle('server:execute-claudecode-restore', async () => {
    console.log('[IPC] Handling server:execute-claudecode-restore');
    try {
      const files = getClaudeCodeFiles();
      let restoredCount = 0;

      for (const file of files) {
        const backupPath = `${file.path}.antigravity.bak`;
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, file.path);
          restoredCount++;
        }
      }

      if (restoredCount === 0) {
        return { success: false, error: 'No backup found to restore' };
      }

      return { success: true, message: `Restored ${restoredCount} configuration files` };
    } catch (error: any) {
      console.error('[IPC] Failed to restore Claude Code config:', error);
      return { success: false, error: error.message };
    }
  });
};
