// @ts-ignore
import sqlite3 = require('sqlite3');
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');
const dbPath = path.resolve(__dirname, '../../database.sqlite');

let db: sqlite3.Database;

export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Could not connect to database', err);
        reject(err);
      } else {
        logger.info('Connected to SQLite database');
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
      seedProviders();
    }
  });
};

const seedProviders = () => {
  try {
    const providersPath = path.resolve(__dirname, '../config/providers.json');
    // Using simple require/fs to read JSON.
    // Since we are in TS, we can just require it if we want, but let's use fs to be safe with path resolution at runtime.
    const fs = require('fs');
    if (fs.existsSync(providersPath)) {
      const data = fs.readFileSync(providersPath, 'utf-8');
      const providers = JSON.parse(data);

      const stmt = db.prepare(
        'INSERT OR IGNORE INTO providers (id, name) VALUES (?, ?)',
      );

      db.serialize(() => {
        for (const provider of providers) {
          stmt.run(provider.id, provider.name, (err: Error) => {
            if (err) {
              logger.error(`Error seeding provider ${provider.name}`, err);
            }
          });
        }
        stmt.finalize(() => {
          logger.info('Providers seeding completed');
        });
      });
    }
  } catch (error) {
    logger.error('Error seeding providers', error);
  }
};

export const getDb = (): sqlite3.Database => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};
