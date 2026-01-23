/**
 * Provider Sync Service
 * Auto-updates provider files when version changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { versionManager } from './version-manager';
import {
  PROVIDER_JSON_URL,
  PROVIDER_GITHUB_BASE,
  TEMP_STORAGE_DIR,
} from '../config/constants';
import { syncAllDynamicProviders } from './models-sync.service';

const logger = createLogger('ProviderSync');

interface Provider {
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  [key: string]: any;
}

class ProviderSyncService {
  private tempStoragePath: string;
  private isInitialized: boolean = false;

  constructor() {
    this.tempStoragePath = path.join(process.cwd(), TEMP_STORAGE_DIR);
    this.ensureTempDirectory();
  }

  /**
   * Ensure temp storage directory exists
   */
  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempStoragePath)) {
      fs.mkdirSync(this.tempStoragePath, { recursive: true });
      logger.info(`Created temp storage directory: ${this.tempStoragePath}`);
    }
  }

  /**
   * Download file from URL
   */
  private async downloadFile(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      logger.error(`Failed to download file from ${url}:`, error);
      return null;
    }
  }

  /**
   * Download provider.json from GitHub
   */
  private async downloadProviderJson(): Promise<Provider[] | null> {
    logger.info('Downloading provider.json...');
    const content = await this.downloadFile(PROVIDER_JSON_URL);

    if (!content) {
      return null;
    }

    try {
      const providers = JSON.parse(content);
      if (!Array.isArray(providers)) {
        throw new Error('provider.json is not an array');
      }

      // Save to temp storage
      const filePath = path.join(this.tempStoragePath, 'provider.json');
      fs.writeFileSync(filePath, content, 'utf-8');
      logger.info(`Saved provider.json to ${filePath}`);

      return providers;
    } catch (error) {
      logger.error('Failed to parse provider.json:', error);
      return null;
    }
  }

  /**
   * Download provider implementation files
   * Note: For now, we'll focus on provider.json. Provider implementation files
   * are TypeScript modules that need to be compiled, so we'll use bundled versions
   */
  private async downloadProviderFiles(providers: Provider[]): Promise<void> {
    logger.info('Checking provider implementation files...');

    // For enabled providers, we could download additional config files if needed
    // For now, we'll just log which providers are enabled
    const enabledProviders = providers.filter((p) => p.is_enabled);
    logger.info(
      `Found ${enabledProviders.length} enabled providers: ${enabledProviders.map((p) => p.provider_id).join(', ')}`,
    );

    // Future enhancement: download provider-specific config files
  }

  /**
   * Sync providers (download if version changed)
   */
  async syncProviders(): Promise<boolean> {
    try {
      const { version, hasChanged } = await versionManager.checkVersion();

      logger.info(`Current version: ${version}, Changed: ${hasChanged}`);

      // If version hasn't changed and we have cached data, skip download
      if (!hasChanged && this.hasCachedProviders()) {
        logger.debug('Version unchanged and cache exists, skipping download');
        return true;
      }

      // Download provider.json
      const providers = await this.downloadProviderJson();
      if (!providers) {
        logger.warn('Failed to download provider.json, using existing cache');
        return false;
      }

      // Download provider files (if needed)
      await this.downloadProviderFiles(providers);

      this.isInitialized = true;
      logger.info('Provider sync completed successfully');
      return true;
    } catch (error) {
      logger.error('Provider sync failed:', error);
      return false;
    }
  }

  /**
   * Check if we have cached provider data
   */
  hasCachedProviders(): boolean {
    const providerJsonPath = path.join(this.tempStoragePath, 'provider.json');
    return fs.existsSync(providerJsonPath);
  }

  /**
   * Get providers from cache or bundled file
   */
  getProviders(): Provider[] {
    // Try temp storage first
    const tempProviderPath = path.join(this.tempStoragePath, 'provider.json');
    if (fs.existsSync(tempProviderPath)) {
      try {
        const content = fs.readFileSync(tempProviderPath, 'utf-8');
        const rawProviders = JSON.parse(content);
        const sanitized = rawProviders.map((p: any) => {
          const { id, name, ...rest } = p;
          return rest;
        });
        logger.debug(`Loaded ${sanitized.length} providers from temp storage`);
        return sanitized;
      } catch (error) {
        logger.warn('Failed to load providers from temp storage:', error);
      }
    }

    // Fallback to bundled provider.json
    try {
      const bundledPath = path.join(process.cwd(), 'provider.json');
      if (fs.existsSync(bundledPath)) {
        const content = fs.readFileSync(bundledPath, 'utf-8');
        const rawProviders = JSON.parse(content);
        const sanitized = rawProviders.map((p: any) => {
          const { id, name, ...rest } = p;
          return rest;
        });
        logger.debug(`Loaded ${sanitized.length} providers from bundled file`);
        return sanitized;
      }
    } catch (error) {
      logger.error('Failed to load bundled providers:', error);
    }

    logger.warn('No provider data available');
    return [];
  }

  /**
   * Initialize provider sync (call on startup)
   */
  async initialize(): Promise<void> {
    logger.info('Initializing provider sync service...');
    await this.syncProviders();

    // Sync dynamic provider models on startup
    logger.info('Syncing dynamic provider models...');
    try {
      await syncAllDynamicProviders();
      logger.info('Dynamic provider models sync completed');
    } catch (error) {
      logger.error('Failed to sync dynamic provider models on startup:', error);
    }

    // Set up periodic sync (check version regularly)
    // This will respect the VERSION_CHECK_INTERVAL from version-manager
    setInterval(
      () => {
        this.syncProviders().catch((error) => {
          logger.error('Periodic provider sync failed:', error);
        });
      },
      60 * 60 * 1000,
    ); // Check every hour

    // Set up periodic models sync (every 24 hours)
    setInterval(
      () => {
        syncAllDynamicProviders().catch((error) => {
          logger.error('Periodic models sync failed:', error);
        });
      },
      24 * 60 * 60 * 1000,
    ); // Check every 24 hours
  }

  /**
   * Force sync (ignore cache)
   */
  async forceSync(): Promise<boolean> {
    logger.info('Forcing provider sync...');
    await versionManager.forceRefresh();
    return this.syncProviders();
  }
}

export const providerSyncService = new ProviderSyncService();
