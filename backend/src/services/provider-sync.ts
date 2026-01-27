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
import {
  syncAllDynamicProviders,
  scheduleNextGmtSync,
} from './models-sync.service';
import { getDb } from './db';

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

      return providers;
    } catch (error) {
      logger.error('Failed to parse provider.json:', error);
      return null;
    }
  }

  /**
   * Ensure all providers from config exist in the providers DB table
   * This is needed for total_accounts tracking to work correctly
   */
  private ensureProvidersInDb(providers: Provider[]): void {
    try {
      const db = getDb();
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO providers (id, name, total_accounts)
        VALUES (?, ?, 0)
      `);

      for (const provider of providers) {
        insertStmt.run(provider.provider_id, provider.provider_name);
      }

      // Update total_accounts for all providers based on actual account counts
      // Use LOWER() to handle case-insensitive matching
      db.exec(`
        UPDATE providers
        SET total_accounts = (
          SELECT COUNT(*)
          FROM accounts
          WHERE LOWER(accounts.provider_id) = LOWER(providers.id)
        )
      `);
    } catch (error) {
      logger.error('Failed to ensure providers in DB:', error);
    }
  }

  /**
   * Sync total_accounts for all providers (can be called independently)
   */
  syncProviderAccountCounts(): void {
    try {
      const db = getDb();
      db.exec(`
        UPDATE providers
        SET total_accounts = (
          SELECT COUNT(*)
          FROM accounts
          WHERE LOWER(accounts.provider_id) = LOWER(providers.id)
        )
      `);
    } catch (error) {
      logger.error('Failed to sync provider account counts:', error);
    }
  }

  /**
   * Sync providers (download if version changed)
   */
  async syncProviders(): Promise<boolean> {
    try {
      const { version, hasChanged } = await versionManager.checkVersion();

      // If version hasn't changed and we have cached data, skip download
      if (!hasChanged && this.hasCachedProviders()) {
        return true;
      }

      // Download provider.json
      const providers = await this.downloadProviderJson();
      if (!providers) {
        return false;
      }

      // Ensure all providers exist in the DB for total_accounts tracking
      this.ensureProvidersInDb(providers);

      this.isInitialized = true;
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
        return sanitized;
      } catch (error) {}
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
        return sanitized;
      }
    } catch (error) {
      logger.error('Failed to load bundled providers:', error);
    }
    return [];
  }

  /**
   * Initialize provider sync (call on startup)
   */
  async initialize(): Promise<void> {
    await this.syncProviders();

    // Always sync provider account counts on startup
    // This handles cases where providers exist but counts are stale
    const providers = this.getProviders();
    if (providers.length > 0) {
      this.ensureProvidersInDb(providers);
    }

    // Sync dynamic provider models on startup
    try {
      await syncAllDynamicProviders();
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

    // Set up periodic models sync at GMT midnight every 24 hours
    scheduleNextGmtSync(async () => {
      await syncAllDynamicProviders();
    });
  }

  /**
   * Force sync (ignore cache)
   */
  async forceSync(): Promise<boolean> {
    await versionManager.forceRefresh();
    return this.syncProviders();
  }
}

export const providerSyncService = new ProviderSyncService();
