import path from 'path';
import fs from 'fs';
import os from 'os';

export interface ProxyConfig {
  host: string; // Default: '127.0.0.1' or '0.0.0.0'
  port: number; // Default: 8317

  tls: {
    enable: boolean;
    cert: string; // Path to cert file
    key: string; // Path to key file
  };

  apiKeys: string[]; // API keys for authentication

  routing: {
    strategy: 'round-robin' | 'priority' | 'least-used';
  };

  cors: {
    enabled: boolean;
    origins: string[];
  };

  // Allow localhost only
  localhostOnly: boolean;
}

const DEFAULT_CONFIG: ProxyConfig = {
  host: '127.0.0.1',
  port: 8317,
  tls: {
    enable: false,
    cert: '',
    key: '',
  },
  apiKeys: [],
  routing: {
    strategy: 'round-robin',
  },
  cors: {
    enabled: true,
    origins: ['*'],
  },
  localhostOnly: true,
};

const CONFIG_FILE = path.join(os.homedir(), '.elara', 'proxy-config.json');

export class ConfigManager {
  private config: ProxyConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ProxyConfig {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('[Config] Failed to load config:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(config: Partial<ProxyConfig>): void {
    try {
      this.config = { ...this.config, ...config };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      console.log('[Config] Configuration saved');
    } catch (error) {
      console.error('[Config] Failed to save config:', error);
      throw error;
    }
  }

  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ProxyConfig>): void {
    this.saveConfig(updates);
  }

  resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig(this.config);
  }
}

// Singleton instance
let configManager: ConfigManager | null = null;

export const getConfigManager = (): ConfigManager => {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  return configManager;
};

export const getProxyConfig = (): ProxyConfig => {
  return getConfigManager().getConfig();
};

export const updateProxyConfig = (updates: Partial<ProxyConfig>): void => {
  getConfigManager().updateConfig(updates);
};
