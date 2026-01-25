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
