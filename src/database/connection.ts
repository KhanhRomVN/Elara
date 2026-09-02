/**
 * ------------------------------------------------------------------
 * Database Connection
 * ------------------------------------------------------------------
 * Quản lý kết nối SQLite cho toàn bộ ứng dụng. Hỗ trợ tìm native binding
 * cho better-sqlite3 trong môi trường binary (pkg) và npm package.
 *
 * Main functions:
 * - initDatabase() : Khởi tạo kết nối database, tạo thư mục, chạy migrations
 * - getDb()        : Lấy instance database đã khởi tạo
 * - closeDatabase(): Đóng kết nối database
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// ── Utils ──
import { createLogger } from '../utils/logger';
import { envInfo } from '../utils/env-info';

// ── Database ──
import { runMigrations } from './migrations';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('Database');

// ─── Database Instance ────────────────────────────────────────────────
let db: Database.Database | null = null;

// ─── Functions ──────────────────────────────────────────────────────────

export const initDatabase = (customPath?: string): void => {
  const isCjsBundle =
    envInfo.isBinary || envInfo.isNpmPackage || __filename.endsWith('start.js');
  const basePath = path.join(os.homedir(), '.elara');

  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const dbPath = customPath || path.join(basePath, 'database.sqlite');

  try {
    if (isCjsBundle) {
      // 0. Try path alongside executable (useful for standalone binaries)
      const exeDirBindingPath = path.join(
        path.dirname(process.execPath),
        'better_sqlite3.node',
      );

      // 1. Try local build path (e.g. for pkg binary where we bundle it)
      const distBindingPath = path.join(
        __dirname,
        'build',
        'Release',
        'better_sqlite3.node',
      );

      // 2. Try standard node_modules path (relative to baseDir for npm package)
      const npmBindingPath = path.join(
        envInfo.baseDir,
        'node_modules',
        'better-sqlite3',
        'build',
        'Release',
        'better_sqlite3.node',
      );

      // 3. Try fallback path (as seen in some global installs)
      const globalBindingPath = path.join(
        path.dirname(envInfo.baseDir),
        'better-sqlite3',
        'build',
        'Release',
        'better_sqlite3.node',
      );

      let nativeBinding: string | undefined = undefined;

      if (fs.existsSync(exeDirBindingPath)) {
        nativeBinding = exeDirBindingPath;
      } else if (fs.existsSync(distBindingPath)) {
        nativeBinding = distBindingPath;
      } else if (fs.existsSync(npmBindingPath)) {
        nativeBinding = npmBindingPath;
      } else if (fs.existsSync(globalBindingPath)) {
        nativeBinding = globalBindingPath;
      } else {
        logger.warn(
          'Could not find better-sqlite3 native binding in known locations. Falling back to default search.',
        );
      }

      db = new Database(dbPath, {
        timeout: 10000,
        nativeBinding,
      });
    } else {
      db = new Database(dbPath, { timeout: 10000 });
    }

    db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
    runMigrations(db);
  } catch (err) {
    logger.error('Could not connect to database', err);
    throw err;
  }
};

export const getDb = (): Database.Database => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

export const closeDatabase = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};