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
  } catch (err) {
    logger.error('Error creating accounts table', err);
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
  } catch (err) {
    logger.error('Error creating providers table', err);
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
