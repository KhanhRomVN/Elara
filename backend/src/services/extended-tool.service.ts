import { getDb } from './db';

export interface ExtendedToolConfig {
  tool_id: string;
  provider_id?: string;
  model_id?: string;
  [key: string]: any;
}

class ExtendedToolService {
  getByToolId(toolId: string): ExtendedToolConfig | null {
    try {
      // For now, we don't have a dedicated table for extended tools in the main DB setup yet.
      // We return null to let the consumer use fallbacks (like "auto" logic).
      // If we need persistence, we can add a table later or use the 'config' table.

      const db = getDb();
      const row = db
        .prepare('SELECT value FROM config WHERE key = ?')
        .get(`tool:${toolId}`) as { value: string } | undefined;

      if (row) {
        return JSON.parse(row.value);
      }

      return null;
    } catch (error) {
      console.warn(
        `[ExtendedToolService] Failed to get config for ${toolId}:`,
        error,
      );
      return null;
    }
  }

  saveConfig(toolId: string, config: ExtendedToolConfig): void {
    try {
      const db = getDb();
      db.prepare(
        'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      ).run(`tool:${toolId}`, JSON.stringify(config));
    } catch (error) {
      console.error(
        `[ExtendedToolService] Failed to save config for ${toolId}:`,
        error,
      );
    }
  }
}

export const extendedToolService = new ExtendedToolService();
