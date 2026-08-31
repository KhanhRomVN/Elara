/**
 * ------------------------------------------------------------------
 * Database Migrations
 * ------------------------------------------------------------------
 * Quản lý schema và migrations cho database SQLite. Tự động tạo bảng,
 * thêm/sửa column, và thực hiện các migration khi cần.
 *
 * Main functions:
 * - runMigrations() : Chạy toàn bộ migrations theo thứ tự
 *
 * Migration functions:
 * - migrateAccounts()          : Tạo/migrate bảng accounts
 * - migrateProviders()         : Tạo/migrate bảng providers
 * - migrateModels()            : Tạo/migrate bảng models
 * - migrateMetrics()           : Tạo/migrate bảng metrics
 * - migrateBrowserSessions()   : Tích hợp browser sessions vào accounts
 * - dropUnusedTables()         : Xóa các bảng không còn sử dụng
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');

export const runMigrations = (db: Database.Database): void => {
  migrateAccounts(db);
  migrateProviders(db);
  migrateModels(db);
  migrateMetrics(db);
  migrateBrowserSessions(db);
  dropUnusedTables(db);
};
// ─── Accounts Table ──────────────────────────────────────────────────

function migrateAccounts(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        email TEXT NOT NULL,
        credential TEXT NOT NULL,
        last_refreshed_at INTEGER,
        usage TEXT,
        reset_period TEXT,
        is_memory_enabled INTEGER DEFAULT 0
      )
    `);

    const accountInfo = db.pragma('table_info(accounts)') as any[];
    const cols = accountInfo.map((c) => c.name);

    // Migration: Remove year_tokens / total_requests columns
    if (cols.includes('year_tokens') || cols.includes('total_requests')) {
      db.exec('BEGIN TRANSACTION');
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS accounts_new (
            id TEXT PRIMARY KEY,
            provider_id TEXT NOT NULL,
            email TEXT NOT NULL,
            credential TEXT NOT NULL
          )
        `);
        db.exec(`
          INSERT INTO accounts_new (id, provider_id, email, credential)
          SELECT id, provider_id, email, credential FROM accounts
        `);
        db.exec('DROP TABLE accounts');
        db.exec('ALTER TABLE accounts_new RENAME TO accounts');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        logger.error('Failed to migrate accounts table', e);
        throw e;
      }
    }

    // Re-read columns after potential migration
    const finalCols = (db.pragma('table_info(accounts)') as any[]).map(
      (c) => c.name,
    );

    if (!finalCols.includes('last_refreshed_at')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN last_refreshed_at INTEGER');
      } catch (e) {
        logger.warn('Failed to add last_refreshed_at to accounts', e);
      }
    }
    if (!finalCols.includes('usage')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN usage TEXT');
      } catch (e) {
        logger.warn('Failed to add usage to accounts', e);
      }
    }
    if (!finalCols.includes('reset_period')) {
      try {
        db.exec('ALTER TABLE accounts ADD COLUMN reset_period TEXT');
      } catch (e) {
        logger.warn('Failed to add reset_period to accounts', e);
      }
    }
    if (!finalCols.includes('is_memory_enabled')) {
      try {
        db.exec(
          'ALTER TABLE accounts ADD COLUMN is_memory_enabled INTEGER DEFAULT 0',
        );
        logger.info('Added is_memory_enabled column to accounts table');
      } catch (e) {
        logger.warn('Failed to add is_memory_enabled to accounts', e);
      }
    }

    // Migration: Rename provider → provider_id
    const updatedCols = (db.pragma('table_info(accounts)') as any[]).map(
      (c) => c.name,
    );
    if (
      updatedCols.includes('provider') &&
      !updatedCols.includes('provider_id')
    ) {
      try {
        db.exec('ALTER TABLE accounts RENAME COLUMN provider to provider_id');
      } catch (e) {
        logger.warn('Failed to rename provider to provider_id');
      }
    }
  } catch (err) {
    logger.error('Error initializing accounts table', err);
    throw err;
  }
}

// ─── Providers Table ──────────────────────────────────────────────────

function migrateProviders(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        platform TEXT DEFAULT 'web',
        connection_type TEXT DEFAULT 'https',
        is_enabled INTEGER DEFAULT 1,
        website_url TEXT,
        auth_method TEXT,
        is_pausable INTEGER DEFAULT 0,
        is_memory INTEGER DEFAULT 0
      )
    `);

    const providerCols = (db.pragma('table_info(providers)') as any[]).map(
      (c) => c.name,
    );

    // Migration for existing databases: add platform column if missing
    if (!providerCols.includes('platform')) {
      try {
        db.exec("ALTER TABLE providers ADD COLUMN platform TEXT DEFAULT 'web'");
        logger.info('Added platform column to providers table');
      } catch (e) {
        logger.warn('Failed to add platform column to providers', e);
      }
    }
    if (!providerCols.includes('connection_type')) {
      try {
        db.exec(
          "ALTER TABLE providers ADD COLUMN connection_type TEXT DEFAULT 'https'",
        );
        logger.info('Added connection_type column to providers table');
      } catch (e) {
        logger.warn('Failed to add connection_type to providers', e);
      }
    }
    if (!providerCols.includes('is_enabled')) {
      try {
        db.exec(
          'ALTER TABLE providers ADD COLUMN is_enabled INTEGER DEFAULT 1',
        );
        logger.info('Added is_enabled column to providers table');
      } catch (e) {
        logger.warn('Failed to add is_enabled to providers', e);
      }
    }
    // Rename website → website_url
    if (
      providerCols.includes('website') &&
      !providerCols.includes('website_url')
    ) {
      try {
        db.exec('ALTER TABLE providers RENAME COLUMN website TO website_url');
        logger.info('Renamed website to website_url in providers table');
      } catch (e) {
        logger.warn('Failed to rename website to website_url in providers', e);
      }
    }
    if (
      !providerCols.includes('website_url') &&
      !providerCols.includes('website')
    ) {
      try {
        db.exec('ALTER TABLE providers ADD COLUMN website_url TEXT');
        logger.info('Added website_url column to providers table');
      } catch (e) {
        logger.warn('Failed to add website_url to providers', e);
      }
    }
    if (!providerCols.includes('auth_method')) {
      try {
        db.exec('ALTER TABLE providers ADD COLUMN auth_method TEXT');
        logger.info('Added auth_method column to providers table');
      } catch (e) {
        logger.warn('Failed to add auth_method to providers', e);
      }
    }
    if (!providerCols.includes('is_pausable')) {
      try {
        db.exec(
          'ALTER TABLE providers ADD COLUMN is_pausable INTEGER DEFAULT 0',
        );
        logger.info('Added is_pausable column to providers table');
      } catch (e) {
        logger.warn('Failed to add is_pausable to providers', e);
      }
    }
    if (!providerCols.includes('is_memory')) {
      try {
        db.exec('ALTER TABLE providers ADD COLUMN is_memory INTEGER DEFAULT 0');
        logger.info('Added is_memory column to providers table');
      } catch (e) {
        logger.warn('Failed to add is_memory to providers', e);
      }
    }

    if (!providerCols.includes('browser_extension_folder')) {
      try {
        db.exec(
          'ALTER TABLE providers ADD COLUMN browser_extension_folder TEXT',
        );
        logger.info('Added browser_extension_folder column to providers table');
      } catch (e) {
        logger.warn('Failed to add browser_extension_folder to providers', e);
      }
    }
  } catch (err) {
    logger.error('Error initializing providers table', err);
  }
}

// ─── Models Table ─────────────────────────────────────────────────────

function migrateModels(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        model_name TEXT NOT NULL,
        is_thinking INTEGER DEFAULT 0,
        max_context_length INTEGER,
        is_image_upload INTEGER DEFAULT 0,
        is_video_upload INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL,
        success_rate REAL DEFAULT NULL,
        description TEXT,
        UNIQUE(provider_id, model_id)
      )
    `);

    const modelCols = (db.pragma('table_info(models)') as any[]).map(
      (c) => c.name,
    );

    // Rename context_length → max_context_length
    if (
      modelCols.includes('context_length') &&
      !modelCols.includes('max_context_length')
    ) {
      try {
        db.exec(
          'ALTER TABLE models RENAME COLUMN context_length TO max_context_length',
        );
        logger.info(
          'Renamed context_length to max_context_length in models table',
        );
      } catch (e) {
        logger.warn(
          'Failed to rename context_length to max_context_length in models',
          e,
        );
      }
    }
    if (
      !modelCols.includes('max_context_length') &&
      !modelCols.includes('context_length')
    ) {
      try {
        db.exec('ALTER TABLE models ADD COLUMN max_context_length INTEGER');
        logger.info('Added max_context_length column to models table');
      } catch (e) {
        logger.warn('Failed to add max_context_length to models', e);
      }
    }

    // Rename is_upload → is_image_upload
    if (
      modelCols.includes('is_upload') &&
      !modelCols.includes('is_image_upload')
    ) {
      try {
        db.exec(
          'ALTER TABLE models RENAME COLUMN is_upload TO is_image_upload',
        );
        logger.info('Renamed is_upload to is_image_upload in models table');
      } catch (e) {
        logger.warn(
          'Failed to rename is_upload to is_image_upload in models',
          e,
        );
      }
    }
    if (
      !modelCols.includes('is_image_upload') &&
      !modelCols.includes('is_upload')
    ) {
      try {
        db.exec(
          'ALTER TABLE models ADD COLUMN is_image_upload INTEGER DEFAULT 0',
        );
        logger.info('Added is_image_upload column to models table');
      } catch (e) {
        logger.warn('Failed to add is_image_upload to models', e);
      }
    }

    // Add is_video_upload
    if (!modelCols.includes('is_video_upload')) {
      try {
        db.exec(
          'ALTER TABLE models ADD COLUMN is_video_upload INTEGER DEFAULT 0',
        );
        logger.info('Added is_video_upload column to models table');
      } catch (e) {
        logger.warn('Failed to add is_video_upload to models', e);
      }
    }

    // Add success_rate
    if (!modelCols.includes('success_rate')) {
      try {
        db.exec('ALTER TABLE models ADD COLUMN success_rate REAL DEFAULT NULL');
        logger.info('Added success_rate column to models table');
      } catch (e) {
        logger.warn('Failed to add success_rate column to models', e);
      }
    }

    // Add description
    if (!modelCols.includes('description')) {
      try {
        db.exec('ALTER TABLE models ADD COLUMN description TEXT');
        logger.info('Added description column to models table');
      } catch (e) {
        logger.warn('Failed to add description column to models', e);
      }
    }
  } catch (err) {
    logger.error('Error initializing models table', err);
  }
}

// ─── Metrics Table ────────────────────────────────────────────────────

function migrateMetrics(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        status TEXT DEFAULT 'success',
        total_tokens INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
      )
    `);

    // Migration for existing databases: add status column if missing
    const metricsCols = (db.pragma('table_info(metrics)') as any[]).map(
      (c) => c.name,
    );
    if (!metricsCols.includes('status')) {
      try {
        db.exec("ALTER TABLE metrics ADD COLUMN status TEXT DEFAULT 'success'");
        logger.info('Added status column to metrics table');
      } catch (e) {
        logger.warn('Failed to add status column to metrics', e);
      }
    }

    // Optimization indexes
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_account_time ON metrics(account_id, timestamp)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_provider_model_time ON metrics(provider_id, model_id, timestamp)',
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_metrics_status ON metrics(status)');
  } catch (err) {
    logger.error('Error initializing metrics table', err);
  }
}

// ─── Browser Sessions Migration ─────────────────────────────────────

function migrateBrowserSessions(db: Database.Database): void {
  try {
    // First, add user_data_dir column to accounts table if not exists
    const accountCols = (db.pragma('table_info(accounts)') as any[]).map(
      (c) => c.name,
    );
    if (!accountCols.includes('user_data_dir')) {
      db.exec('ALTER TABLE accounts ADD COLUMN user_data_dir TEXT');
      logger.info('Added user_data_dir column to accounts table');
    }

    // Make credential nullable for browser-based accounts
    // SQLite doesn't support ALTER COLUMN directly, need to recreate table or just allow NULL
    // We'll just update the column to allow NULL by creating a new table and copying data
    const hasCredentialNotNull = (
      db.pragma('table_info(accounts)') as any[]
    ).find((c) => c.name === 'credential' && c.notnull === 1);

    if (hasCredentialNotNull) {
      logger.info('Recreating accounts table to make credential nullable...');
      // Backup existing data
      interface AccountRow {
        id: string;
        provider_id: string;
        email: string;
        credential: string | null;
        last_refreshed_at: number | null;
        usage: string | null;
        reset_period: string | null;
        is_memory_enabled: number | null;
        user_data_dir: string | null;
      }
      const accountsData = db
        .prepare('SELECT * FROM accounts')
        .all() as AccountRow[];

      // Drop old table
      db.exec('DROP TABLE accounts');

      // Recreate with nullable credential
      db.exec(`
        CREATE TABLE accounts (
          id TEXT PRIMARY KEY,
          provider_id TEXT NOT NULL,
          email TEXT NOT NULL,
          credential TEXT,
          last_refreshed_at INTEGER,
          usage TEXT,
          reset_period TEXT,
          is_memory_enabled INTEGER DEFAULT 0,
          user_data_dir TEXT
        )
      `);

      // Restore data
      const insertStmt = db.prepare(`
        INSERT INTO accounts (id, provider_id, email, credential, last_refreshed_at, usage, reset_period, is_memory_enabled, user_data_dir)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of accountsData) {
        insertStmt.run(
          row.id,
          row.provider_id,
          row.email,
          row.credential,
          row.last_refreshed_at,
          row.usage,
          row.reset_period,
          row.is_memory_enabled || 0,
          row.user_data_dir,
        );
      }

      logger.info('Accounts table recreated with nullable credential');
    }

    // Drop old browser_sessions table
    db.exec('DROP TABLE IF EXISTS browser_sessions');
  } catch (err) {
    logger.error('Error migrating browser sessions into accounts', err);
  }
}

// ─── Drop Unused Tables ─────────────────────────────────────────────

function dropUnusedTables(db: Database.Database): void {
  try {
    db.exec('DROP TABLE IF EXISTS models_performance');
    db.exec('DROP TABLE IF EXISTS conversation_stats');
    db.exec('DROP TABLE IF EXISTS extended_tools');
    db.exec('DROP TABLE IF EXISTS accounts_stats');
    db.exec('DROP TABLE IF EXISTS providers_stats');
    db.exec('DROP TABLE IF EXISTS commands');
    db.exec('DROP TABLE IF EXISTS local_conversations');
    db.exec('DROP TABLE IF EXISTS local_messages');
    db.exec('DROP TABLE IF EXISTS provider_models');
    db.exec('DROP TABLE IF EXISTS provider_models_sync');
    db.exec('DROP TABLE IF EXISTS config');
    // Migration: remove old columns if exist
    const providerCols = (db.pragma('table_info(providers)') as any[]).map(
      (c) => c.name,
    );
    if (providerCols.includes('name')) {
      db.exec('ALTER TABLE providers RENAME COLUMN name TO title');
    }
    // Keep platform column - do not drop
    if (providerCols.includes('description')) {
      db.exec('ALTER TABLE providers DROP COLUMN description');
    }
    // Remove conversation_id column from metrics if exists
    const metricsCols = (db.pragma('table_info(metrics)') as any[]).map(
      (c) => c.name,
    );
    if (metricsCols.includes('conversation_id')) {
      // Drop the index first (SQLite requires this before dropping a column with an index)
      try {
        db.exec('DROP INDEX IF EXISTS idx_metrics_conversation_id');
      } catch (_) {}
      db.exec('ALTER TABLE metrics DROP COLUMN conversation_id');
    }
  } catch (e) {
    logger.warn('Failed to drop unused tables or migrate columns', e);
  }
}