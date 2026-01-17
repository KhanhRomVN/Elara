// @ts-ignore
import sqlite3 = require('sqlite3');
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');
let db: sqlite3.Database;

export const initDatabase = (customPath?: string): Promise<void> => {
  const dbPath = customPath || path.resolve(__dirname, '../../database.sqlite');

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err: Error | null) => {
      if (err) {
        logger.error('Could not connect to database', err);
        reject(err);
      } else {
        logger.info(`Connected to SQLite database at ${dbPath}`);
        createTables();
        resolve();
      }
    });
  });
};

const createTables = () => {
  const accountsQuery = `
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      email TEXT NOT NULL,
      credential TEXT NOT NULL
    )
  `;

  db.run(accountsQuery, (err) => {
    if (err) {
      logger.error('Error creating accounts table', err);
    } else {
      logger.info('Accounts table initialized');
    }
  });

  const providersQuery = `
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `;

  db.run(providersQuery, (err) => {
    if (err) {
      logger.error('Error creating providers table', err);
    } else {
      logger.info('Providers table initialized');
    }
  });
};

export const getDb = (): sqlite3.Database => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};
