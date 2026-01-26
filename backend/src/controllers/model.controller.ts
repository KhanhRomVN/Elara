import { Request, Response } from 'express';
import { getDb } from '../services/db';
import { createLogger } from '../utils/logger';

const logger = createLogger('ModelController');

export const getModelSequences = async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const sequences = db
      .prepare(
        'SELECT * FROM model_sequences ORDER BY provider_id, sequence ASC',
      )
      .all();

    res.json({
      success: true,
      data: sequences,
    });
  } catch (error: any) {
    logger.error('Error fetching model sequences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch model sequences',
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        details: error.message,
      },
    });
  }
};

export const upsertModelSequence = async (req: Request, res: Response) => {
  try {
    const { provider_id, model_id, sequence } = req.body;
    console.log('[Model Sequences] Setting sequence:', req.body);

    if (!provider_id || !model_id || sequence === undefined) {
      res
        .status(400)
        .json({ success: false, error: 'Missing required fields' });
      return;
    }

    const db = getDb();
    const now = Date.now();

    const existing = db
      .prepare(
        'SELECT * FROM model_sequences WHERE provider_id = ? AND model_id = ?',
      )
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

    res.json({ success: true, message: 'Sequence updated' });
  } catch (error: any) {
    logger.error('Error upserting model sequence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update model sequence',
      error: { code: 'INTERNAL_SERVER_ERROR', details: error.message },
    });
  }
};

export const insertModelSequence = async (req: Request, res: Response) => {
  try {
    const { provider_id, model_id, sequence } = req.body;

    if (!provider_id || !model_id || sequence === undefined) {
      res
        .status(400)
        .json({ success: false, error: 'Missing required fields' });
      return;
    }

    const db = getDb();
    const now = Date.now();

    // Shift all sequences >= target sequence
    db.prepare(
      'UPDATE model_sequences SET sequence = sequence + 1 WHERE sequence >= ?',
    ).run(sequence);

    // Upsert target
    const existing = db
      .prepare(
        'SELECT * FROM model_sequences WHERE provider_id = ? AND model_id = ?',
      )
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
    const all = db
      .prepare('SELECT * FROM model_sequences ORDER BY sequence ASC')
      .all() as any[];
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
    logger.error('Error inserting model sequence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to insert model sequence',
      error: { code: 'INTERNAL_SERVER_ERROR', details: error.message },
    });
  }
};

export const deleteModelSequence = async (req: Request, res: Response) => {
  try {
    const { providerId, modelId } = req.params;

    const db = getDb();
    db.prepare(
      'DELETE FROM model_sequences WHERE provider_id = ? AND model_id = ?',
    ).run(providerId, modelId);

    res.json({ success: true, message: 'Sequence removed' });
  } catch (error: any) {
    logger.error('Error deleting model sequence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete model sequence',
      error: { code: 'INTERNAL_SERVER_ERROR', details: error.message },
    });
  }
};
