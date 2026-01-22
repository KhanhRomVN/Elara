/**
 * Version Manager Service
 * Manages version checking with smart caching to avoid excessive API calls
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { VERSION_CHECK_URL, VERSION_CHECK_INTERVAL } from '../config/constants';

const logger = createLogger('VersionManager');

interface VersionInfo {
  version: string;
  lastChecked: number;
}

class VersionManager {
  private currentVersion: string | null = null;
  private lastCheckTime: number = 0;
  private versionFilePath: string;
  private checkInterval: number = VERSION_CHECK_INTERVAL;

  constructor() {
    // Store version info in temp directory
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    this.versionFilePath = path.join(tempDir, 'version.json');

    // Load cached version on startup
    this.loadCachedVersion();
  }

  /**
   * Load cached version from file
   */
  private loadCachedVersion(): void {
    try {
      if (fs.existsSync(this.versionFilePath)) {
        const data = fs.readFileSync(this.versionFilePath, 'utf-8');
        const versionInfo: VersionInfo = JSON.parse(data);
        this.currentVersion = versionInfo.version;
        this.lastCheckTime = versionInfo.lastChecked;
        logger.info(`Loaded cached version: ${this.currentVersion}`);
      }
    } catch (error) {
      logger.warn('Failed to load cached version:', error);
    }
  }

  /**
   * Save version to cache file
   */
  private saveVersionToCache(version: string): void {
    try {
      const versionInfo: VersionInfo = {
        version,
        lastChecked: Date.now(),
      };
      fs.writeFileSync(
        this.versionFilePath,
        JSON.stringify(versionInfo, null, 2),
      );
      logger.info(`Saved version to cache: ${version}`);
    } catch (error) {
      logger.error('Failed to save version to cache:', error);
    }
  }

  /**
   * Check if we should fetch new version (based on TTL)
   */
  private shouldCheckVersion(): boolean {
    const now = Date.now();
    return now - this.lastCheckTime >= this.checkInterval;
  }

  /**
   * Fetch version from remote endpoint
   */
  private async fetchVersion(): Promise<string | null> {
    try {
      const response = await fetch(VERSION_CHECK_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return data.version || null;
    } catch (error) {
      logger.error('Failed to fetch version from remote:', error);
      return null;
    }
  }

  /**
   * Get current version with smart caching
   * Returns: { version, hasChanged }
   */
  async checkVersion(): Promise<{
    version: string | null;
    hasChanged: boolean;
  }> {
    // Return cached version if TTL hasn't expired
    if (!this.shouldCheckVersion() && this.currentVersion) {
      logger.debug(`Using cached version: ${this.currentVersion}`);
      return { version: this.currentVersion, hasChanged: false };
    }

    // Fetch new version
    logger.info('Checking for new version...');
    const newVersion = await this.fetchVersion();

    if (!newVersion) {
      // Failed to fetch, return cached version
      logger.warn('Failed to fetch new version, using cached');
      return { version: this.currentVersion, hasChanged: false };
    }

    const hasChanged = newVersion !== this.currentVersion;

    if (hasChanged) {
      logger.info(`Version changed: ${this.currentVersion} -> ${newVersion}`);
      this.currentVersion = newVersion;
    } else {
      logger.debug(`Version unchanged: ${newVersion}`);
    }

    // Update cache
    this.lastCheckTime = Date.now();
    this.saveVersionToCache(newVersion);

    return { version: newVersion, hasChanged };
  }

  /**
   * Force refresh version (ignore cache)
   */
  async forceRefresh(): Promise<{
    version: string | null;
    hasChanged: boolean;
  }> {
    logger.info('Forcing version refresh...');
    this.lastCheckTime = 0; // Reset last check time
    return this.checkVersion();
  }

  /**
   * Get current cached version without checking
   */
  getCurrentVersion(): string | null {
    return this.currentVersion;
  }

  /**
   * Set custom check interval (for testing)
   */
  setCheckInterval(intervalMs: number): void {
    this.checkInterval = intervalMs;
  }
}

export const versionManager = new VersionManager();
