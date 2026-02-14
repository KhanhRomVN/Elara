import { Request, Response } from 'express';
import {
  recordSuccess,
  getUsageHistory,
  getAccountStatsByPeriod,
  getModelStatsByPeriod,
} from '../services/stats.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('StatsController');

// POST /v1/chat/metrics
export const recordMetricsController = async (req: Request, res: Response) => {
  try {
    const {
      account_id,
      provider_id,
      model_id,
      conversation_id,
      total_tokens,
      timestamp, // Optional, defaults to now in service if not provided or handled
    } = req.body;

    if (
      !account_id ||
      !provider_id ||
      !model_id ||
      total_tokens === undefined
    ) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
      return;
    }

    // Call recordSuccess to update both provider_models and metrics table
    await recordSuccess(
      account_id,
      provider_id,
      model_id,
      total_tokens,
      conversation_id,
    );

    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('Error recording metrics', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /v1/stats
export const getStats = async (req: Request, res: Response) => {
  try {
    const period =
      (req.query.period as 'day' | 'week' | 'month' | 'year') || 'day';
    const offset = parseInt(req.query.offset as string) || 0;

    const usage = getUsageHistory(period, offset);
    const accounts = getAccountStatsByPeriod(period, offset);
    const models = getModelStatsByPeriod(period, offset);

    res.json({
      success: true,
      data: {
        usage,
        accounts,
        models,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching stats', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
