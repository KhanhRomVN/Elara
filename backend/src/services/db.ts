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
    logger.info(`Connected to SQLite database at ${dbPath}`);
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
      credential TEXT NOT NULL,
      total_requests INTEGER DEFAULT 0,
      successful_requests INTEGER DEFAULT 0
    )
  `;

  try {
    db.exec(accountsQuery);
    logger.info('Accounts table initialized');

    // Migration: Refactor Accounts Schema (Remove accumulated tokens/requests)
    const accountInfo = db.pragma('table_info(accounts)') as any[];
    const accountColumns = accountInfo.map((c) => c.name);
    if (accountColumns.includes('year_tokens')) {
      logger.info('Migrating accounts table to new stats schema...');
      db.exec('BEGIN TRANSACTION');
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS accounts_new (
            id TEXT PRIMARY KEY,
            provider_id TEXT NOT NULL,
            email TEXT NOT NULL,
            credential TEXT NOT NULL,
            total_requests INTEGER DEFAULT 0,
            successful_requests INTEGER DEFAULT 0
          )
        `);
        // Preserve credentials, reset stats
        db.exec(`
          INSERT INTO accounts_new (id, provider_id, email, credential)
          SELECT id, provider_id, email, credential FROM accounts
        `);
        db.exec('DROP TABLE accounts');
        db.exec('ALTER TABLE accounts_new RENAME TO accounts');
        db.exec('COMMIT');
        logger.info('Accounts table migration complete.');
      } catch (e) {
        db.exec('ROLLBACK');
        logger.error('Failed to migrate accounts table', e);
        throw e;
      }
    } else if (!accountColumns.includes('successful_requests')) {
      // Migration: Add successful_requests if missing (intermediate state)
      try {
        db.exec(
          'ALTER TABLE accounts ADD COLUMN successful_requests INTEGER DEFAULT 0',
        );
        logger.info('Added successful_requests to accounts');
      } catch (e) {
        logger.warn('Failed to add successful_requests to accounts', e);
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
        logger.info('Renamed provider to provider_id in accounts');
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
    logger.info('Providers table initialized');

    // Migration: Add total_accounts column if it doesn't exist
    const providersInfo = db.pragma('table_info(providers)') as any[];
    const providersColumns = providersInfo.map((c) => c.name);
    if (!providersColumns.includes('total_accounts')) {
      try {
        db.exec(
          'ALTER TABLE providers ADD COLUMN total_accounts INTEGER DEFAULT 0',
        );
        logger.info('Added total_accounts column to providers');
      } catch (e) {
        logger.warn('Failed to add total_accounts to providers');
      }
    }
  } catch (err) {
    logger.error('Error initializing providers table', err);
  }

  const modelsPerformanceQuery = `
    CREATE TABLE IF NOT EXISTS models_performance (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      avg_response_time REAL DEFAULT 0,
      total_samples INTEGER DEFAULT 0,
      UNIQUE(model_id, provider_id)
    )
  `;
  db.exec(modelsPerformanceQuery);

  // Drop old stats tables if they exist
  try {
    db.exec('DROP TABLE IF EXISTS accounts_stats');
    db.exec('DROP TABLE IF EXISTS providers_stats');
    logger.info('Dropped old stats tables');
  } catch (e) {
    logger.warn('Failed to drop old stats tables', e);
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
      total_requests INTEGER DEFAULT 0,
      successful_requests INTEGER DEFAULT 0,
      max_req_conversation INTEGER DEFAULT 0,
      max_token_conversation INTEGER DEFAULT 0,
      UNIQUE(provider_id, model_id)
    )
  `;

  try {
    db.exec(providerModelsQuery);
    logger.info('Provider models table initialized');

    // Migration: Refactor Provider Models Schema
    const pmInfo = db.pragma('table_info(provider_models)') as any[];
    const pmColumns = pmInfo.map((c) => c.name);

    if (pmColumns.includes('year_tokens')) {
      logger.info('Migrating provider_models table to new stats schema...');
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
                  total_requests INTEGER DEFAULT 0,
                  successful_requests INTEGER DEFAULT 0,
                  max_req_conversation INTEGER DEFAULT 0,
                  max_token_conversation INTEGER DEFAULT 0,
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
        logger.info('Provider models migration complete.');
      } catch (e) {
        db.exec('ROLLBACK');
        logger.error('Failed to migrate provider_models', e);
        throw e;
      }
    } else {
      // ensure columns exist
      const colsToCheck = [
        'successful_requests',
        'max_req_conversation',
        'max_token_conversation',
        'total_requests',
      ];
      const updatedPmInfo = db.pragma('table_info(provider_models)') as any[];
      const updatedPmColumns = updatedPmInfo.map((c) => c.name);

      for (const col of colsToCheck) {
        if (!updatedPmColumns.includes(col)) {
          try {
            db.exec(
              `ALTER TABLE provider_models ADD COLUMN ${col} INTEGER DEFAULT 0`,
            );
            logger.info(`Added ${col} to provider_models`);
          } catch (e) {
            logger.warn(`Failed to add ${col} to provider_models`, e);
          }
        }
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

  // Table to track active conversation stats
  const activeConversationStatsQuery = `
    CREATE TABLE IF NOT EXISTS conversation_stats (
      conversation_id TEXT PRIMARY KEY,
      total_requests INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `;
  db.exec(activeConversationStatsQuery);
  logger.info('Conversation stats table initialized');
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
    logger.info('Database connection closed');
  }
};
