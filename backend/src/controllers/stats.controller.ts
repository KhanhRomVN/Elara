import { Request, Response } from 'express';
import {
  getAllAccountStats,
  getAllProviderModelStats,
} from '../services/stats.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('StatsController');

export const getStats = async (req: Request, res: Response) => {
  try {
    const accounts = getAllAccountStats();
    const models = getAllProviderModelStats();

    res.json({
      success: true,
      data: {
        accounts,
        models,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message,
    });
  }
};
