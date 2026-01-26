import { Request, Response } from 'express';
import {
  getAccountStatsByPeriod,
  getModelStatsByPeriod,
  getUsageHistory,
} from '../services/stats.service';
import { getAllProviders } from '../services/provider.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('StatsController');

export const getStats = async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as any) || 'day';
    const offset = parseInt(req.query.offset as string) || 0;

    const accounts = getAccountStatsByPeriod(period, offset);
    const models = getModelStatsByPeriod(period, offset);
    const history = getUsageHistory(period, offset);
    const providers = await getAllProviders();

    res.json({
      success: true,
      data: {
        accounts,
        models,
        history,
        providers,
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
