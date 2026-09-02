/**
 * ------------------------------------------------------------------
 * Kill Port
 * ------------------------------------------------------------------
 * Tiện ích kill process đang sử dụng một port cụ thể.
 * Hỗ trợ Linux với fuser và lsof.
 *
 * Main functions:
 * - killProcessOnPort() : Kill process trên port
 * - isPortInUse()       : Kiểm tra port đang được sử dụng
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { exec } from 'child_process';
import { promisify } from 'util';

// ── Utils ──
import { createLogger } from './logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('kill-port');
const execAsync = promisify(exec);

// ─── Functions ──────────────────────────────────────────────────────────

export const killProcessOnPort = async (port: number): Promise<boolean> => {
  try {
    try {
      const { stdout } = await execAsync(`fuser -k ${port}/tcp 2>/dev/null`);
      if (stdout) {
        return true;
      }
    } catch (e: any) {
      if (e.code === 1) {
        return true;
      }
    }

    try {
      const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null`);
      if (stdout && stdout.trim()) {
        const pids = stdout.trim().split('\n');
        for (const pid of pids) {
          await execAsync(`kill -9 ${pid} 2>/dev/null`);
        }
        return true;
      }
      return true;
    } catch (e) {
      return false;
    }
  } catch (error) {
    logger.error(`Failed to kill process on port ${port}:`, error);
    return false;
  }
};

export const isPortInUse = async (port: number): Promise<boolean> => {
  try {
    try {
      await execAsync(`fuser ${port}/tcp 2>/dev/null`);
      return true;
    } catch (e) {
      // fuser returns non-zero if no process found
    }

    try {
      const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null`);
      return !!(stdout && stdout.trim().length > 0);
    } catch (e) {
      return false;
    }
    return false;
  } catch (error) {
    return false;
  }
};
