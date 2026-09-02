/**
 * ------------------------------------------------------------------
 * Stats Controller
 * ------------------------------------------------------------------
 * Xử lý request thống kê và ghi nhận metrics cho các cuộc gọi API.
 * Hỗ trợ ghi nhận success/failure và lấy thống kê theo khoảng thời gian.
 *
 * Main functions:
 * - recordMetrics() : Ghi nhận metrics cho một cuộc gọi thành công
 * - getStats()      : Lấy thống kê usage, accounts, models theo period
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import {
  recordSuccess,
  getUsageHistory,
  getAccountStatsByPeriod,
  getModelStatsByPeriod,
} from '../services/stats.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('StatsController');

// ─── Controller ─────────────────────────────────────────────────────────

// ─── POST /v1/chat/metrics ──────────────────────────────────────────
export const recordMetrics = async (req: Request, res: Response) => {
  try {
    const { account_id, provider_id, model_id, conversation_id, total_tokens } =
      req.body;

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

// ─── GET /v1/stats ──────────────────────────────────────────────────
export const getStats = async (req: Request, res: Response) => {
  try {
    const period =
      (req.query.period as 'day' | 'week' | 'month' | 'year') || 'day';
    const page = parseInt(req.query.page as string) || 0;
    const offset = parseInt(req.query.offset as string) || page;
    const accountId = req.query.account_id as string | undefined;

    const usage = getUsageHistory(period, offset, accountId);
    const accounts = getAccountStatsByPeriod(period, offset, accountId);
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
