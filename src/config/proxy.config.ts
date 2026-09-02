/**
 * ------------------------------------------------------------------
 * Proxy Configuration
 * ------------------------------------------------------------------
 * Quản lý cấu hình proxy server.
 * Lưu trữ config trong file JSON tại ~/.elara/proxy-config.json.
 *
 * Main exports:
 * - getConfigManager()   : Lấy ConfigManager singleton
 * - getProxyConfig()     : Lấy cấu hình proxy
 * - updateProxyConfig()  : Cập nhật cấu hình proxy
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('proxy-config');

const CONFIG_FILE = path.join(os.homedir(), '.elara', 'proxy-config.json');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProxyConfig {
  host: string;
  port: number;
  tls: {
    enable: boolean;
    cert: string;
    key: string;
  };
  apiKeys: string[];
  routing: {
    strategy: 'round-robin' | 'priority' | 'least-used';
  };
  cors: {
    enabled: boolean;
    origins: string[];
  };
  localhostOnly: boolean;
}

// ─── Default Config ────────────────────────────────────────────────────

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

// ─── Class ──────────────────────────────────────────────────────────────

export class ConfigManager {
  private config: ProxyConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  // ─── Load ───────────────────────────────────────────────────────────

  private loadConfig(): ProxyConfig {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      logger.error('Failed to load config:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  // ─── Save ───────────────────────────────────────────────────────────

  saveConfig(config: Partial<ProxyConfig>): void {
    try {
      this.config = { ...this.config, ...config };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error('Failed to save config:', error);
      throw error;
    }
  }

  // ─── Getters ────────────────────────────────────────────────────────

  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  // ─── Updates ────────────────────────────────────────────────────────

  updateConfig(updates: Partial<ProxyConfig>): void {
    this.saveConfig(updates);
  }

  resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig(this.config);
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────

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