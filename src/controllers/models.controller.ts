/**
 * ------------------------------------------------------------------
 * Models Controller
 * ------------------------------------------------------------------
 * Xử lý request lấy danh sách model từ các provider đã bật.
 *
 * Main functions:
 * - getAllModels() : Lấy tất cả model từ các provider được kích hoạt
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import { getAllModelsFromEnabledProviders } from '../services/provider.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ModelsController');

// ─── Controller ─────────────────────────────────────────────────────────

// ─── GET /v1/models/all ─────────────────────────────────────────────
export const getAllModels = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const models = await getAllModelsFromEnabledProviders();
    res.status(200).json({
      success: true,
      message: 'Models retrieved successfully',
      data: models,
      meta: {
        timestamp: new Date().toISOString(),
        total: models.length,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching all models', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch models',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};
