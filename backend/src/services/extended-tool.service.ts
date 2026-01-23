import { getDb } from './db';
import { randomUUID } from 'crypto';

export interface ExtendedTool {
  id: string;
  tool_id: string;
  tool_name: string;
  website?: string;
  url?: string;
  provider_id?: string;
  model_id?: string;
  config?: any;
  created_at?: string;
  updated_at?: string;
}

export const extendedToolService = {
  getAll: (): ExtendedTool[] => {
    const db = getDb();
    const results = db
      .prepare('SELECT * FROM extended_tools ORDER BY created_at DESC')
      .all() as any[];

    return results.map((r) => ({
      ...r,
      config: r.config ? JSON.parse(r.config) : undefined,
    }));
  },

  getById: (id: string): ExtendedTool | undefined => {
    const db = getDb();
    const result = db
      .prepare('SELECT * FROM extended_tools WHERE id = ?')
      .get(id) as any;

    if (!result) return undefined;
    return {
      ...result,
      config: result.config ? JSON.parse(result.config) : undefined,
    };
  },

  getByToolId: (toolId: string): ExtendedTool | undefined => {
    const db = getDb();
    const result = db
      .prepare('SELECT * FROM extended_tools WHERE tool_id = ?')
      .get(toolId) as any;

    if (!result) return undefined;
    return {
      ...result,
      config: result.config ? JSON.parse(result.config) : undefined,
    };
  },

  upsert: (tool: Partial<ExtendedTool> & { tool_id: string }): ExtendedTool => {
    const db = getDb();
    const existing = extendedToolService.getByToolId(tool.tool_id);

    // Prepare config for saving
    const saveTool = { ...tool };
    if (saveTool.config) {
      saveTool.config = JSON.stringify(saveTool.config);
    }

    if (existing) {
      const updates = {
        ...saveTool,
        updated_at: new Date().toISOString(),
      };
      const keys = Object.keys(updates).filter(
        (k) => k !== 'id' && k !== 'tool_id',
      );
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const values = keys.map((k) => (updates as any)[k]);

      db.prepare(
        `UPDATE extended_tools SET ${setClause} WHERE tool_id = ?`,
      ).run(...values, tool.tool_id);

      return extendedToolService.getByToolId(tool.tool_id)!;
    } else {
      const id = randomUUID();
      const newTool = {
        id,
        ...saveTool,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const keys = Object.keys(newTool);
      const values = keys.map((k) => (newTool as any)[k]);
      const placeholders = keys.map(() => '?').join(', ');

      db.prepare(
        `INSERT INTO extended_tools (${keys.join(', ')}) VALUES (${placeholders})`,
      ).run(...values);

      return extendedToolService.getById(id)!;
    }
  },

  delete: (id: string): void => {
    const db = getDb();
    db.prepare('DELETE FROM extended_tools WHERE id = ?').run(id);
  },
};
