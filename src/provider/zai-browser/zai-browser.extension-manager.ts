/**
 * ------------------------------------------------------------------
 * Z.AI Browser Extension Manager
 * ------------------------------------------------------------------
 * Quản lý Z.AI Bridge extension: validate, lấy browser args,
 * và wait cho WebSocket server.
 *
 * Main functions:
 * - validateExtension()     : Kiểm tra extension tồn tại
 * - getExtensionPath()      : Lấy đường dẫn extension
 * - getBrowserArgs()        : Lấy browser args để load extension
 * - waitForWebSocket()      : Chờ WebSocket server ready
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ZaiBrowserExtensionManager');

// ─── Class ──────────────────────────────────────────────────────────────

export class ZaiBrowserExtensionManager {
  private static EXTENSION_PATH = path.join(
    __dirname,
    '../../../extensions/zai-bridge',
  );

  static validateExtension(): boolean {
    if (!fs.existsSync(this.EXTENSION_PATH)) {
      logger.error(
        `Z.AI Browser extension not found at ${this.EXTENSION_PATH}\n` +
          `Please copy extension folder from reverse-z-ai-5.0/extension to server/extensions/zai-bridge/`,
      );
      return false;
    }
    const manifestPath = path.join(this.EXTENSION_PATH, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      logger.error(
        `Invalid extension: manifest.json not found at ${manifestPath}`,
      );
      return false;
    }
    return true;
  }

  static getExtensionPath(): string {
    return this.EXTENSION_PATH;
  }

  static getBrowserArgs(userDataDir?: string): string[] {
    const args = [
      `--disable-extensions-except=${this.EXTENSION_PATH}`,
      `--load-extension=${this.EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--allow-running-insecure-content',
    ];

    if (userDataDir) {
      args.push(`--user-data-dir=${userDataDir}`);
    }

    return args;
  }

  static async waitForWebSocket(
    port: number = 8899,
    timeoutMs: number = 30000,
  ): Promise<boolean> {
    const net = await import('net');
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        await new Promise<void>((resolve, reject) => {
          const socket = net.createConnection(port, '127.0.0.1');
          const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error('Connection timeout'));
          }, 1000);
          socket.on('connect', () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve();
          });
          socket.on('error', reject);
        });
        return true;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    logger.error(`[Extension] WebSocket server not ready after ${timeoutMs}ms`);
    return false;
  }
}
