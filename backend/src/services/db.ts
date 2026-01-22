import Database from 'better-sqlite3';
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');
let db: Database.Database | null = null;

export const initDatabase = (customPath?: string): void => {
  const dbPath = customPath || path.resolve(__dirname, '../../database.sqlite');

  try {
    db = new Database(dbPath);
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
      credential TEXT NOT NULL
    )
  `;

  try {
    db.exec(accountsQuery);
    logger.info('Accounts table initialized');

    // Migration: Ensure column name is provider_id (user choice)
    const info = db.pragma('table_info(accounts)') as any[];
    const columns = info.map((c) => c.name);

    if (columns.includes('provider') && !columns.includes('provider_id')) {
      try {
        db.exec('ALTER TABLE accounts RENAME COLUMN provider TO provider_id');
        logger.info('Renamed provider to provider_id in accounts');
      } catch (e) {
        logger.warn('Failed to rename provider to provider_id');
      }
    }

    const extraColumns = [
      'status',
      'usage',
      'total_requests',
      'successful_requests',
      'total_duration',
      'tokens_today',
      'stats_date',
      'last_active',
      'created_at',
      'updated_at',
      'user_agent',
      'headers',
      'metadata',
    ];

    for (const col of extraColumns) {
      if (columns.includes(col)) {
        try {
          db.exec(`ALTER TABLE accounts DROP COLUMN ${col}`);
          logger.info(`Dropped ${col} column from accounts`);
        } catch (e) {
          logger.warn(`Failed to drop column ${col}:`);
        }
      }
    }
  } catch (err) {
    logger.error('Error initializing or migrating accounts table', err);
    throw err;
  }

  const providersQuery = `
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `;

  try {
    db.exec(providersQuery);
    logger.info('Providers table initialized');

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

    // Migration for existing models_performance table
    const modelPerfInfo = db.pragma('table_info(models_performance)') as any[];
    const modelPerfColumns = modelPerfInfo.map((c) => c.name);
    if (!modelPerfColumns.includes('provider_id')) {
      try {
        db.exec(
          'ALTER TABLE models_performance ADD COLUMN provider_id TEXT DEFAULT "unknown"',
        );
        logger.info('Added provider_id column to models_performance');
      } catch (e) {
        logger.warn('Failed to add provider_id column to models_performance');
      }
    }
    logger.info('Models performance table initialized');

    const accountsStatsQuery = `
      CREATE TABLE IF NOT EXISTS accounts_stats (
        account_id TEXT PRIMARY KEY,
        total_tokens INTEGER DEFAULT 0,
        year_tokens INTEGER DEFAULT 0,
        month_tokens INTEGER DEFAULT 0,
        week_tokens INTEGER DEFAULT 0,
        day_tokens INTEGER DEFAULT 0,
        total_requests INTEGER DEFAULT 0,
        year_requests INTEGER DEFAULT 0,
        month_requests INTEGER DEFAULT 0,
        week_requests INTEGER DEFAULT 0,
        day_requests INTEGER DEFAULT 0,
        successful_requests INTEGER DEFAULT 0,
        last_reset_year INTEGER DEFAULT 0,
        last_reset_month INTEGER DEFAULT 0,
        last_reset_week INTEGER DEFAULT 0,
        last_reset_day INTEGER DEFAULT 0,
        FOREIGN KEY(account_id) REFERENCES accounts(id)
      )
    `;
    db.exec(accountsStatsQuery);
    logger.info('Accounts stats table initialized');

    const providersStatsQuery = `
      CREATE TABLE IF NOT EXISTS providers_stats (
        provider_id TEXT PRIMARY KEY,
        total_tokens INTEGER DEFAULT 0,
        year_tokens INTEGER DEFAULT 0,
        month_tokens INTEGER DEFAULT 0,
        week_tokens INTEGER DEFAULT 0,
        day_tokens INTEGER DEFAULT 0,
        total_requests INTEGER DEFAULT 0,
        year_requests INTEGER DEFAULT 0,
        month_requests INTEGER DEFAULT 0,
        week_requests INTEGER DEFAULT 0,
        day_requests INTEGER DEFAULT 0,
        successful_requests INTEGER DEFAULT 0,
        last_reset_year INTEGER DEFAULT 0,
        last_reset_month INTEGER DEFAULT 0,
        last_reset_week INTEGER DEFAULT 0,
        last_reset_day INTEGER DEFAULT 0,
        FOREIGN KEY(provider_id) REFERENCES providers(id)
      )
    `;
    db.exec(providersStatsQuery);
    logger.info('Providers stats table initialized');

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
    logger.info('Config table initialized');
  } catch (err) {
    logger.error('Error creating statistics tables', err);
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
    logger.info('Database connection closed');
  }
};
