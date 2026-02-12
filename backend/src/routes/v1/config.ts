import { Router, Request, Response } from 'express';
import { getDb } from '../../services/db';
import { createLogger } from '../../utils/logger';

const router = Router();
const logger = createLogger('ConfigRoutes');

const getConfigValue = (key: string): string => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value || '';
};

// GET /v1/config/values - Get multiple config values
router.get('/values', async (req: Request, res: Response) => {
  try {
    const keys = req.query.keys as string;
    if (!keys) {
      return res
        .status(400)
        .json({ success: false, message: 'Keys are required' });
    }

    const keyList = keys.split(',');
    const results: Record<string, string> = {};

    for (const key of keyList) {
      results[key] = getConfigValue(key);
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    logger.error('Failed to get config values', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /v1/config/values - Set multiple config values
router.put('/values', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const values = req.body; // Expecting { key1: value1, key2: value2 }

    const upsertConfig = db.prepare(`
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    db.transaction(() => {
      for (const [key, value] of Object.entries(values)) {
        upsertConfig.run(key, String(value));
      }
    })();

    res.json({
      success: true,
      message: 'Config values updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to update config values', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
