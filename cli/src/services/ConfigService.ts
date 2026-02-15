import fs from 'fs';
import path from 'path';
import os from 'os';

interface CliConfig {
  url: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'elara-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_CONFIG: CliConfig = {
  url: 'http://0.0.0.0:8888',
};

export class ConfigService {
  private static config: CliConfig | null = null;

  private static ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  static loadConfig(): CliConfig {
    if (this.config) return this.config;

    this.ensureConfigDir();

    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      } catch (error) {
        console.error('Error reading config file, using defaults:', error);
        this.config = DEFAULT_CONFIG;
      }
    } else {
      this.config = DEFAULT_CONFIG;
      this.saveConfig(this.config);
    }

    return this.config!;
  }

  static saveConfig(config: CliConfig) {
    this.ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    this.config = config;
  }

  static getApiUrl(): string {
    const config = this.loadConfig();
    return config.url;
  }

  static getConfigPath(): string {
    return CONFIG_FILE;
  }

  static reloadConfig(): CliConfig {
    this.config = null;
    return this.loadConfig();
  }

  static watchConfig(callback: (config: CliConfig) => void) {
    this.ensureConfigDir();
    if (fs.existsSync(CONFIG_FILE)) {
      fs.watch(CONFIG_FILE, (eventType) => {
        if (eventType === 'change') {
          // Tiny delay to ensure write completion
          setTimeout(() => {
            const newConfig = this.reloadConfig();
            callback(newConfig);
          }, 100);
        }
      });
    }
  }
}
