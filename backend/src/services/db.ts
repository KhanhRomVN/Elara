import Database from 'better-sqlite3';
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');
let db: Database.Database | null = null;

export const initDatabase = (customPath?: string): void => {
  const dbPath = customPath || path.resolve(__dirname, '../../database.sqlite');

  try {
    db = new Database(dbPath, { timeout: 10000 }); // Wait up to 10s for lock
    db.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
    createTables();
  } catch (err) {
    logger.error('Could not connect to database', err);
    throw err;
  }
};

const createTables = (): void => {
  if (!db) throw new Error('Database not initialized');

  const accountsQuery = `
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      email TEXT NOT NULL,
      credential TEXT NOT NULL
    )
  `;

  try {
    db.exec(accountsQuery);

    // Migration: Refactor Accounts Schema (Remove accumulated tokens/requests)
    const accountInfo = db.pragma('table_info(accounts)') as any[];
    const accountColumns = accountInfo.map((c) => c.name);
    if (accountColumns.includes('year_tokens')) {
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
        // Preserve credentials
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
    } else if (accountColumns.includes('total_requests')) {
      // Migration: Remove stats columns
      db.exec('BEGIN TRANSACTION');
      try {
        db.exec(`
          CREATE TABLE accounts_new (
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
        logger.error('Failed to remove stats columns from accounts', e);
      }
    }

    // Migration: Ensure column name is provider_id
    // Re-check columns after potential migration
    const updatedAccountInfo = db.pragma('table_info(accounts)') as any[];
    const updatedAccountColumns = updatedAccountInfo.map((c) => c.name);

    if (
      updatedAccountColumns.includes('provider') &&
      !updatedAccountColumns.includes('provider_id')
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

  const providersQuery = `
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_accounts INTEGER DEFAULT 0
    )
  `;

  try {
    db.exec(providersQuery);

    // Migration: Add total_accounts column if it doesn't exist
    const providersInfo = db.pragma('table_info(providers)') as any[];
    const providersColumns = providersInfo.map((c) => c.name);
    if (!providersColumns.includes('total_accounts')) {
      try {
        db.exec(
          'ALTER TABLE providers ADD COLUMN total_accounts INTEGER DEFAULT 0',
        );
      } catch (e) {
        logger.warn('Failed to add total_accounts to providers');
      }
    }
  } catch (err) {
    logger.error('Error initializing providers table', err);
  }

  // Drop old unused tables
  try {
    db.exec('DROP TABLE IF EXISTS models_performance');
    db.exec('DROP TABLE IF EXISTS conversation_stats');
    db.exec('DROP TABLE IF EXISTS extended_tools');
    db.exec('DROP TABLE IF EXISTS accounts_stats');
    db.exec('DROP TABLE IF EXISTS providers_stats');
  } catch (e) {
    logger.warn('Failed to drop unused tables', e);
  }

  const configQuery = `
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `;
  db.exec(configQuery);
  db.prepare(
    "INSERT OR IGNORE INTO config (key, value) VALUES ('enable_stats_collection', 'true')",
  ).run();

  // Table to cache provider models
  const providerModelsQuery = `
    CREATE TABLE IF NOT EXISTS provider_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      is_thinking INTEGER DEFAULT 0,
      context_length INTEGER,
      updated_at INTEGER NOT NULL,
      UNIQUE(provider_id, model_id)
    )
  `;

  try {
    db.exec(providerModelsQuery);

    // Migration: Refactor Provider Models Schema
    const pmInfo = db.pragma('table_info(provider_models)') as any[];
    const pmColumns = pmInfo.map((c) => c.name);

    if (pmColumns.includes('year_tokens')) {
      db.exec('BEGIN TRANSACTION');
      try {
        db.exec(`
                CREATE TABLE IF NOT EXISTS provider_models_new (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  provider_id TEXT NOT NULL,
                  model_id TEXT NOT NULL,
                  model_name TEXT NOT NULL,
                  is_thinking INTEGER DEFAULT 0,
                  context_length INTEGER,
                  updated_at INTEGER NOT NULL,
                  UNIQUE(provider_id, model_id)
                )
            `);
        // Preserve model info and max stats
        db.exec(`
                INSERT INTO provider_models_new (
                    provider_id, model_id, model_name, is_thinking, context_length, updated_at,
                    max_req_conversation, max_token_conversation
                )
                SELECT 
                    provider_id, model_id, model_name, is_thinking, context_length, updated_at,
                    max_req_conversation, max_token_conversation
                FROM provider_models
            `);
        db.exec('DROP TABLE provider_models');
        db.exec('ALTER TABLE provider_models_new RENAME TO provider_models');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        logger.error('Failed to migrate provider_models', e);
        throw e;
      }
    } else if (pmColumns.includes('max_req_conversation')) {
      // Migration: Remove max stats columns from provider_models
      db.exec('BEGIN TRANSACTION');
      try {
        db.exec(`
          CREATE TABLE provider_models_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id TEXT NOT NULL,
            model_id TEXT NOT NULL,
            model_name TEXT NOT NULL,
            is_thinking INTEGER DEFAULT 0,
            context_length INTEGER,
            updated_at INTEGER NOT NULL,
            UNIQUE(provider_id, model_id)
          )
        `);
        db.exec(`
          INSERT INTO provider_models_new (
            provider_id, model_id, model_name, is_thinking, context_length, updated_at
          )
          SELECT 
            provider_id, model_id, model_name, is_thinking, context_length, updated_at
          FROM provider_models
        `);
        db.exec('DROP TABLE provider_models');
        db.exec('ALTER TABLE provider_models_new RENAME TO provider_models');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        logger.error('Failed to remove stats columns from provider_models', e);
      }
    }
  } catch (err) {
    logger.error('Error initializing provider_models', err);
  }

  // Table to track last sync time for dynamic providers
  const providerModelsSyncQuery = `
    CREATE TABLE IF NOT EXISTS provider_models_sync (
      provider_id TEXT PRIMARY KEY,
      last_sync_at INTEGER NOT NULL,
      is_dynamic INTEGER DEFAULT 0
    )
  `;
  db.exec(providerModelsSyncQuery);

  // Table to track model sequences (user defined ordering)
  const modelSequencesQuery = `
    CREATE TABLE IF NOT EXISTS model_sequences (
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(provider_id, model_id)
    )
  `;
  db.exec(modelSequencesQuery);

  // Table to track active conversation stats: removed (conversation_stats)

  // Table to store detailed usage metrics
  const metricsQuery = `
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      conversation_id TEXT,
      total_tokens INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL
    )
  `;
  try {
    db.exec(metricsQuery);
    // Migration: Add conversation_id to metrics if missing
    const metricsInfo = db.pragma('table_info(metrics)') as any[];
    if (!metricsInfo.map((c) => c.name).includes('conversation_id')) {
      try {
        db.exec('ALTER TABLE metrics ADD COLUMN conversation_id TEXT');
      } catch (e) {
        logger.warn('Failed to add conversation_id to metrics', e);
      }
    }

    // Optimization Indexes for fast metrics querying (< 1s)
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_conversation_id ON metrics(conversation_id)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_account_time ON metrics(account_id, timestamp)',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_metrics_provider_model_time ON metrics(provider_id, model_id, timestamp)',
    );
  } catch (err) {
    logger.error('Error initializing metrics table', err);
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
