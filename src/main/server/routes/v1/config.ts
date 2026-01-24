import express, { Request, Response } from 'express';
import { getDb } from '@backend/services/db';

const router = express.Router();

// GET /v1/config/rag - Get RAG configuration
router.get('/rag', async (_req: Request, res: Response) => {
  try {
    const db = getDb();

    const getConfigValue = (key: string): string => {
      const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      return row?.value || '';
    };

    const ragEnabled = getConfigValue('rag_enabled');
    const qdrantDatabasesRaw = getConfigValue('qdrant_databases');
    const geminiApiKeysRaw = getConfigValue('gemini_api_keys');
    const rerankEnabled = getConfigValue('rerank_enabled');

    let qdrantDatabases: any[] = [];
    try {
      qdrantDatabases = qdrantDatabasesRaw ? JSON.parse(qdrantDatabasesRaw) : [];
    } catch {
      qdrantDatabases = [];
    }

    let geminiApiKeys: string[] = [];
    try {
      geminiApiKeys = geminiApiKeysRaw ? JSON.parse(geminiApiKeysRaw) : [];
    } catch {
      geminiApiKeys = [];
    }

    res.json({
      success: true,
      data: {
        rag_enabled: ragEnabled === '' ? true : ragEnabled === 'true',
        qdrant_databases: qdrantDatabases,
        gemini_api_keys: geminiApiKeys,
        rerank_enabled: rerankEnabled === 'true',
      },
    });
  } catch (error: any) {
    console.error('[Config] Failed to get RAG config', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get config',
    });
  }
});

// PUT /v1/config/rag - Update RAG configuration
router.put('/rag', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { rag_enabled, qdrant_databases, gemini_api_keys, rerank_enabled } = req.body;

    const upsertConfig = db.prepare(`
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    if (rag_enabled !== undefined) {
      upsertConfig.run('rag_enabled', String(rag_enabled));
    }
    if (qdrant_databases !== undefined) {
      upsertConfig.run('qdrant_databases', JSON.stringify(qdrant_databases));
    }
    if (gemini_api_keys !== undefined) {
      upsertConfig.run('gemini_api_keys', JSON.stringify(gemini_api_keys));
    }
    if (rerank_enabled !== undefined) {
      upsertConfig.run('rerank_enabled', String(rerank_enabled));
    }

    console.log('[Config] RAG config updated');
    res.json({
      success: true,
      message: 'Config updated successfully',
    });
  } catch (error: any) {
    console.error('[Config] Failed to update RAG config', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update config',
    });
  }
});

export default router;
