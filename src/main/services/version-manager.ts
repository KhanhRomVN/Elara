/**
 * Version Manager Service for Electron
 * Manages version checking with smart caching to avoid excessive API calls
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const VERSION_CHECK_URL = 'https://elara-version.khanhromvn.workers.dev/version';
const VERSION_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

interface VersionInfo {
  version: string;
  lastChecked: number;
}

class VersionManager {
  private currentVersion: string;
  private lastCheckTime: number = 0;
  private versionFilePath: string;
  private checkInterval: number = VERSION_CHECK_INTERVAL;

  constructor() {
    this.currentVersion = app.getVersion();
    // Store version info in userData temp directory
    const tempDir = path.join(app.getPath('userData'), 'temp');
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

        // Only use cached version if it's newer than the core app version
        // This allows manual package.json bumps to take precedence
        const cachedVer = versionInfo.version.replace('v', '');
        const appVer = this.currentVersion.replace('v', '');

        if (this.isNewer(cachedVer, appVer)) {
          this.currentVersion = versionInfo.version;
          console.log(`[VersionManager] Loaded newer cached version: ${this.currentVersion}`);
        } else {
          console.log(
            `[VersionManager] App version (${this.currentVersion}) is newer or same as cached (${versionInfo.version}), ignoring cache.`,
          );
        }
        this.lastCheckTime = versionInfo.lastChecked;
      }
    } catch (error) {
      console.warn('[VersionManager] Failed to load cached version:', error);
    }
  }

  private isNewer(v1: string, v2: string): boolean {
    const parts1 = v1.split('.').map((n) => parseInt(n, 10));
    const parts2 = v2.split('.').map((n) => parseInt(n, 10));
    for (let i = 0; i < 3; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return true;
      if (p1 < p2) return false;
    }
    return false;
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
      fs.writeFileSync(this.versionFilePath, JSON.stringify(versionInfo, null, 2));
      console.log(`[VersionManager] Saved version to cache: ${version}`);
    } catch (error) {
      console.error('[VersionManager] Failed to save version to cache:', error);
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
      console.error('[VersionManager] Failed to fetch version from remote:', error);
      return null;
    }
  }

  /**
   * Get current version with smart caching
   * Returns: { version, hasChanged }
   */
  async checkVersion(): Promise<{ version: string | null; hasChanged: boolean }> {
    // Return cached version if TTL hasn't expired
    if (!this.shouldCheckVersion() && this.currentVersion) {
      console.log(`[VersionManager] Using cached version: ${this.currentVersion}`);
      return { version: this.currentVersion, hasChanged: false };
    }

    // Fetch new version
    console.log('[VersionManager] Checking for new version...');
    const newVersion = await this.fetchVersion();

    if (!newVersion) {
      // Failed to fetch, return cached version
      console.warn('[VersionManager] Failed to fetch new version, using cached');
      return { version: this.currentVersion, hasChanged: false };
    }

    const hasChanged = newVersion !== this.currentVersion;

    if (hasChanged) {
      console.log(`[VersionManager] Version changed: ${this.currentVersion} -> ${newVersion}`);
      this.currentVersion = newVersion;
    } else {
      console.log(`[VersionManager] Version unchanged: ${newVersion}`);
    }

    // Update cache
    this.lastCheckTime = Date.now();
    this.saveVersionToCache(newVersion);

    return { version: newVersion, hasChanged };
  }

  /**
   * Force refresh version (ignore cache)
   */
  async forceRefresh(): Promise<{ version: string | null; hasChanged: boolean }> {
    console.log('[VersionManager] Forcing version refresh...');
    this.lastCheckTime = 0; // Reset last check time
    return this.checkVersion();
  }

  /**
   * Get current cached version without checking
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Set custom check interval (for testing)
   */
  setCheckInterval(intervalMs: number): void {
    this.checkInterval = intervalMs;
  }
  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<{
    updateAvailable: boolean;
    remoteVersion: string;
    currentVersion: string;
    updateType: 'app' | 'resource' | 'none';
  }> {
    console.log('[VersionManager] Checking for updates...');
    const remoteVersion = await this.fetchVersion();
    const currentVersion = this.currentVersion || '0.0.0';

    if (!remoteVersion) {
      return { updateAvailable: false, remoteVersion: '', currentVersion, updateType: 'none' };
    }

    // Determine update type based on semantic versioning
    // x.y.z: x/y change -> 'app', z change -> 'resource'
    // This is a simplified logic as per user requirement context
    let updateType: 'app' | 'resource' | 'none' = 'none';
    let updateAvailable = false;

    try {
      if (remoteVersion !== currentVersion) {
        updateAvailable = true;
        const [rMajor, rMinor, rPatch] = remoteVersion.split('.').map((v) => parseInt(v, 10));
        const [cMajor, cMinor, cPatch] = currentVersion.split('.').map((v) => parseInt(v, 10));

        // Ensure we have valid numbers
        if (!isNaN(rMajor) && !isNaN(cMajor)) {
          if (rMajor > cMajor || rMinor > cMinor) {
            updateType = 'app';
          } else if (rMajor === cMajor && rMinor === cMinor && rPatch > cPatch) {
            updateType = 'resource';
          } else {
            // Fallback if version string parsing fails or logic complex
            // Default to app update for safety if significant difference
            updateType = 'app';
          }
        } else {
          // Non-numeric versions? fallback to string compare or assume app update
          updateType = 'app';
        }
      }
    } catch (e) {
      console.error('[VersionManager] Error comparing versions:', e);
      // Fallback
      if (remoteVersion !== currentVersion) {
        updateAvailable = true;
        updateType = 'app';
      }
    }

    return { updateAvailable, remoteVersion, currentVersion, updateType };
  }

  /**
   * Perform update: Download files from GitHub
   */
  async performUpdate(remoteVersion: string): Promise<{ success: boolean; message: string }> {
    console.log(`[VersionManager] Starting update to version ${remoteVersion}...`);
    try {
      // 1. Fetch file tree
      const treeUrl = 'https://api.github.com/repos/KhanhRomVN/Elara/git/trees/main?recursive=1';
      const treeResponse = await fetch(treeUrl);
      if (!treeResponse.ok) throw new Error(`Failed to fetch git tree: ${treeResponse.statusText}`);
      const treeData = await treeResponse.json();

      const filesToUpdate = treeData.tree.filter((item: any) => {
        return (
          item.type === 'blob' &&
          (item.path === 'backend/provider.json' ||
            item.path.startsWith('backend/src/provider/') ||
            item.path.startsWith('src/main/server/provider/'))
        );
      });

      console.log(`[VersionManager] Found ${filesToUpdate.length} files to update.`);

      // 2. Download and write files
      // We need to resolve paths relative to project root.
      // Assuming app is running from project root during dev, or we need to find correct paths.
      // In production (Electron), resources might be packed.
      // For this user request which seems to be about dev/source updates (since it mentions specific source files),
      // we will try to write to the source directories if possible.
      // However, usually in Electron app updates, we replace ASAR or resources.
      // Given the context of "home/khanhromvn/Documents/Coding/Elara", this is a dev environment update helper.

      // We need to find the root of the project.
      // app.getAppPath() usually returns .../dist/main or similar in prod, or src path in dev.
      // We can try to deduce project root.
      const projectRoot = process.cwd(); // In dev checking user metadata "npm run dev" running in /home/khanhromvn/Documents/Coding/Elara

      for (const file of filesToUpdate) {
        const rawUrl = `https://raw.githubusercontent.com/KhanhRomVN/Elara/main/${file.path}`;
        const response = await fetch(rawUrl);
        if (!response.ok) {
          console.error(`[VersionManager] Failed to download ${file.path}`);
          continue;
        }
        const content = await response.text();
        const localPath = path.join(projectRoot, file.path);

        // Ensure directory exists
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(localPath, content);
        console.log(`[VersionManager] Updated ${file.path}`);
      }

      // 3. Update version cache
      this.currentVersion = remoteVersion;
      this.lastCheckTime = Date.now();
      this.saveVersionToCache(remoteVersion);

      return { success: true, message: 'Update completed successfully' };
    } catch (error) {
      console.error('[VersionManager] Update failed:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const versionManager = new VersionManager();
