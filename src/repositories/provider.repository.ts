/**
 * ------------------------------------------------------------------
 * Provider Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng providers. Quản lý thông tin provider
 * và cấu hình của chúng.
 *
 * Main functions:
 * - findAllProviders()      : Lấy tất cả providers
 * - findProviderById()      : Tìm provider theo id
 * - ensureProviderExists()  : Đảm bảo provider tồn tại trong DB
 * - upsertProvider()        : Thêm mới hoặc cập nhật provider
 * - updateProviderTitle()   : Cập nhật title
 * - deleteProvider()        : Xóa provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getDb } from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProviderRow {
  id: string;
  title: string;
  platform?: string;
  connection_type?: string;
  is_enabled?: number;
  website_url?: string;
  auth_method?: string;
  is_pausable?: number;
  is_memory?: number;
  browser_extension_folder?: string;
}

// ─── Queries ────────────────────────────────────────────────────────────

export const findAllProviders = (): ProviderRow[] => {
  const db = getDb();
  return db.prepare('SELECT * FROM providers').all() as ProviderRow[];
};

export const findProviderById = (id: string): ProviderRow | null => {
  const db = getDb();
  return db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as ProviderRow | null;
};

// ─── Inserts / Upserts ─────────────────────────────────────────────────

export const ensureProviderExists = (id: string, title: string): void => {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO providers (id, title) VALUES (?, ?)',
  ).run(id.toLowerCase(), title);
};

export const upsertProvider = (
  id: string,
  title: string,
  websiteUrl?: string,
  isEnabled?: boolean,
  authMethod?: string[],
  isPausable?: boolean,
  isMemory?: boolean,
  browserExtensionFolder?: string,
): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO providers (id, title, website_url, is_enabled, auth_method, is_pausable, is_memory, browser_extension_folder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       website_url = excluded.website_url,
       is_enabled = excluded.is_enabled,
       auth_method = excluded.auth_method,
       is_pausable = excluded.is_pausable,
       is_memory = excluded.is_memory,
       browser_extension_folder = excluded.browser_extension_folder`,
  ).run(
    id.toLowerCase(),
    title,
    websiteUrl ?? null,
    isEnabled !== false ? 1 : 0,
    authMethod ? JSON.stringify(authMethod) : null,
    isPausable ? 1 : 0,
    isMemory ? 1 : 0,
    browserExtensionFolder ?? null,
  );
};

// ─── Updates ────────────────────────────────────────────────────────────

export const updateProviderTitle = (id: string, title: string): void => {
  const db = getDb();
  db.prepare('UPDATE providers SET title = ? WHERE id = ?').run(title, id.toLowerCase());
};

// ─── Deletes ────────────────────────────────────────────────────────────

export const deleteProvider = (id: string): void => {
  const db = getDb();
  db.prepare('DELETE FROM providers WHERE id = ?').run(id.toLowerCase());
};