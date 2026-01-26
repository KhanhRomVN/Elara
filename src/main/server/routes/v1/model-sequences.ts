import express from 'express';
import { getDb } from '@backend/services/db';

const router = express.Router();

/**
 * GET /v1/model-sequences
 * List all model sequences
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const sequences = db.prepare('SELECT * FROM model_sequences ORDER BY sequence ASC').all();

    res.json({
      success: true,
      data: sequences,
    });
  } catch (error: any) {
    console.error('[Model Sequences] Failed to list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /v1/model-sequences
 * Upsert a model sequence
 */
router.post('/', (req, res) => {
  try {
    const { provider_id, model_id, sequence } = req.body;
    console.log('[Model Sequences] Setting sequence:', req.body);

    if (!provider_id || !model_id || sequence === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const db = getDb();

    // Check if exists
    const existing = db
      .prepare('SELECT * FROM model_sequences WHERE provider_id = ? AND model_id = ?')
      .get(provider_id, model_id);

    const now = Date.now();

    if (existing) {
      db.prepare(
        'UPDATE model_sequences SET sequence = ?, updated_at = ? WHERE provider_id = ? AND model_id = ?',
      ).run(sequence, now, provider_id, model_id);
    } else {
      db.prepare(
        'INSERT INTO model_sequences (provider_id, model_id, sequence, updated_at) VALUES (?, ?, ?, ?)',
      ).run(provider_id, model_id, sequence, now);
    }

    res.json({ success: true, message: 'Sequence updated' });
  } catch (error: any) {
    console.error('[Model Sequences] Failed to upsert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /v1/model-sequences/insert
 * Insert at specific position and shift others
 */
router.post('/insert', (req, res) => {
  try {
    const { provider_id, model_id, sequence } = req.body;

    if (!provider_id || !model_id || sequence === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const db = getDb();
    const now = Date.now();

    // Shift all sequences >= target sequence
    db.prepare('UPDATE model_sequences SET sequence = sequence + 1 WHERE sequence >= ?').run(
      sequence,
    );

    // Upsert target
    const existing = db
      .prepare('SELECT * FROM model_sequences WHERE provider_id = ? AND model_id = ?')
      .get(provider_id, model_id);

    if (existing) {
      db.prepare(
        'UPDATE model_sequences SET sequence = ?, updated_at = ? WHERE provider_id = ? AND model_id = ?',
      ).run(sequence, now, provider_id, model_id);
    } else {
      db.prepare(
        'INSERT INTO model_sequences (provider_id, model_id, sequence, updated_at) VALUES (?, ?, ?, ?)',
      ).run(provider_id, model_id, sequence, now);
    }

    // Normalize sequences (remove gaps)
    const all = db.prepare('SELECT * FROM model_sequences ORDER BY sequence ASC').all() as any[];
    const updateStmt = db.prepare(
      'UPDATE model_sequences SET sequence = ? WHERE provider_id = ? AND model_id = ?',
    );

    const updateTransaction = db.transaction((models) => {
      models.forEach((model: any, index: number) => {
        updateStmt.run(index + 1, model.provider_id, model.model_id);
      });
    });

    updateTransaction(all);

    res.json({ success: true, message: 'Sequence inserted and reordered' });
  } catch (error: any) {
    console.error('[Model Sequences] Failed to insert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /v1/model-sequences/:providerId/:modelId
 * Remove sequence
 */
router.delete('/:providerId/:modelId', (req, res) => {
  try {
    const { providerId, modelId } = req.params;

    const db = getDb();
    db.prepare('DELETE FROM model_sequences WHERE provider_id = ? AND model_id = ?').run(
      providerId,
      modelId,
    );

    res.json({ success: true, message: 'Sequence removed' });
  } catch (error: any) {
    console.error('[Model Sequences] Failed to delete:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
