import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

export interface Account {
  id: string;
  email: string;
  provider: string;
  credential: string;
  status: string;
  usage?: string;
  totalRequests?: number;
  successfulRequests?: number;
  totalDuration?: number;
  tokensToday?: number;
  statsDate?: string;
  lastActive?: string;
  userAgent?: string;
  headers?: any;
  metadata?: any;
}

const DB_DIR = path.join(os.homedir(), '.elara');
const DB_PATH = path.join(DB_DIR, 'elara.db');
const LEGACY_BACKEND_FILE = path.join(DB_DIR, 'accounts.json');
// Determine legacy main process file path (userData)
// Since we are in utility context, we might not have access to 'electron.app' directly if imported in backend context.
// We will handle specific main-process migration logic in the main process init, or pass paths here.
// For now, let's focus on the core DB logic.

export class AccountDatabase {
  private db: Database.Database;

  constructor() {
    fs.ensureDirSync(DB_DIR);
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        email TEXT NOT NULL,
        credential TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        usage TEXT DEFAULT '0',
        total_requests INTEGER DEFAULT 0,
        successful_requests INTEGER DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        tokens_today INTEGER DEFAULT 0,
        stats_date TEXT,
        last_active TEXT,
        user_agent TEXT,
        headers TEXT,
        metadata TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);

    // Import legacy file if exists and DB is empty
    this.migrateFromJSON();
  }

  private migrateFromJSON() {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM accounts').get() as {
      count: number;
    };
    if (count.count > 0) return;

    if (fs.existsSync(LEGACY_BACKEND_FILE)) {
      try {
        console.log('[DB] Migrating from JSON file...');
        const data = fs.readFileSync(LEGACY_BACKEND_FILE, 'utf-8');
        const accounts = JSON.parse(data);

        const insert = this.db.prepare(`
          INSERT INTO accounts (
            id, provider, email, credential, status, usage,
            total_requests, successful_requests, total_duration, tokens_today,
            stats_date, last_active, user_agent, headers, metadata,
            created_at, updated_at
          ) VALUES (
            @id, @provider, @email, @credential, @status, @usage,
            @totalRequests, @successfulRequests, @totalDuration, @tokensToday,
            @statsDate, @lastActive, @userAgent, @headers, @metadata,
            @createdAt, @updatedAt
          )
        `);

        const transaction = this.db.transaction((accs: any[]) => {
          for (const acc of accs) {
            insert.run({
              id: acc.id,
              provider: acc.provider,
              email: acc.email,
              credential: acc.credential,
              status: acc.status || 'Active',
              usage: acc.usage || '0',
              totalRequests: acc.totalRequests || 0,
              successfulRequests: acc.successfulRequests || 0,
              totalDuration: acc.totalDuration || 0,
              tokensToday: acc.tokensToday || 0,
              statsDate: acc.statsDate || '',
              lastActive: acc.lastActive || new Date().toISOString(),
              userAgent: acc.userAgent || null,
              headers: acc.headers ? JSON.stringify(acc.headers) : null,
              metadata: acc.metadata ? JSON.stringify(acc.metadata) : null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        });

        transaction(accounts);
        fs.moveSync(LEGACY_BACKEND_FILE, `${LEGACY_BACKEND_FILE}.bak`);
        console.log(`[DB] Successfully migrated ${accounts.length} accounts.`);
      } catch (error) {
        console.error('[DB] Migration failed:', error);
      }
    }
  }

  getAll(): Account[] {
    const rows = this.db.prepare('SELECT * FROM accounts').all() as any[];
    return rows.map(this.mapRowToAccount);
  }

  getById(id: string): Account | null {
    const row = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
    return row ? this.mapRowToAccount(row) : null;
  }

  upsert(account: Account) {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (
        id, provider, email, credential, status, usage,
        total_requests, successful_requests, total_duration, tokens_today,
        stats_date, last_active, user_agent, headers, metadata,
        updated_at
      ) VALUES (
        @id, @provider, @email, @credential, @status, @usage,
        @totalRequests, @successfulRequests, @totalDuration, @tokensToday,
        @statsDate, @lastActive, @userAgent, @headers, @metadata,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        provider=excluded.provider,
        email=excluded.email,
        credential=excluded.credential,
        status=excluded.status,
        usage=excluded.usage,
        total_requests=excluded.total_requests,
        successful_requests=excluded.successful_requests,
        total_duration=excluded.total_duration,
        tokens_today=excluded.tokens_today,
        stats_date=excluded.stats_date,
        last_active=excluded.last_active,
        user_agent=excluded.user_agent,
        headers=excluded.headers,
        metadata=excluded.metadata,
        updated_at=excluded.updated_at
    `);

    stmt.run({
      id: account.id,
      provider: account.provider,
      email: account.email,
      credential: account.credential,
      status: account.status,
      usage: account.usage,
      totalRequests: account.totalRequests || 0,
      successfulRequests: account.successfulRequests || 0,
      totalDuration: account.totalDuration || 0,
      tokensToday: account.tokensToday || 0,
      statsDate: account.statsDate,
      lastActive: account.lastActive,
      userAgent: account.userAgent,
      headers: account.headers ? JSON.stringify(account.headers) : null,
      metadata: account.metadata ? JSON.stringify(account.metadata) : null,
      updatedAt: Date.now(),
    });
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  }

  private mapRowToAccount(row: any): Account {
    return {
      id: row.id,
      provider: row.provider,
      email: row.email,
      credential: row.credential,
      status: row.status,
      usage: row.usage,
      totalRequests: row.total_requests,
      successfulRequests: row.successful_requests,
      totalDuration: row.total_duration,
      tokensToday: row.tokens_today,
      statsDate: row.stats_date,
      lastActive: row.last_active,
      userAgent: row.user_agent,
      headers: row.headers ? JSON.parse(row.headers) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}

// Singleton instance
let dbInstance: AccountDatabase | null = null;
export const getDB = () => {
  if (!dbInstance) dbInstance = new AccountDatabase();
  return dbInstance;
};
