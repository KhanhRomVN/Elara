import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

export interface Account {
  id: string;
  email: string;
  provider_id: string;
  credential: string;
}

const DB_DIR = path.join(os.homedir(), '.elara');
const DB_PATH = path.join(DB_DIR, 'elara.db');

export class AccountDatabase {
  private db: Database.Database;

  constructor() {
    try {
      // In backend context, try to use the shared DB instance
      const { getDb } = require('../services/db');
      this.db = getDb();
    } catch (e) {
      // Fallback for other contexts
      fs.ensureDirSync(DB_DIR);
      this.db = new Database(DB_PATH);
      this.db.pragma('journal_mode = WAL');
      this.init();
    }
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        email TEXT NOT NULL,
        credential TEXT NOT NULL
      )
    `);
  }

  getAll(): Account[] {
    const rows = this.db.prepare('SELECT * FROM accounts').all() as any[];
    return rows.map(this.mapRowToAccount);
  }

  getById(id: string): Account | null {
    const row = this.db
      .prepare('SELECT * FROM accounts WHERE id = ?')
      .get(id) as any;
    return row ? this.mapRowToAccount(row) : null;
  }

  upsert(account: Account) {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (id, provider_id, email, credential)
      VALUES (@id, @provider_id, @email, @credential)
      ON CONFLICT(id) DO UPDATE SET
        provider_id=excluded.provider_id,
        email=excluded.email,
        credential=excluded.credential
    `);

    stmt.run({
      id: account.id,
      provider_id: account.provider_id,
      email: account.email,
      credential: account.credential,
    });
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  }

  private mapRowToAccount(row: any): Account {
    return {
      id: row.id,
      provider_id: row.provider_id || row.provider,
      email: row.email,
      credential: row.credential,
    };
  }
}

// Singleton instance
let dbInstance: AccountDatabase | null = null;
export const getDB = () => {
  if (!dbInstance) dbInstance = new AccountDatabase();
  return dbInstance;
};
