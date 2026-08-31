/**
 * ------------------------------------------------------------------
 * Provider Controller
 * ------------------------------------------------------------------
 * Xử lý các request liên quan đến provider: lấy danh sách provider,
 * lấy model của một provider cụ thể.
 *
 * Main functions:
 * - getProviders()              : Lấy danh sách tất cả provider
 * - getProviderModels(): Lấy danh sách model của một provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import {
  getAllProviders,
  getProviderModels as getProviderModelsService,
} from '../services/provider.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ProviderController');

// ─── Controller ─────────────────────────────────────────────────────────

// ─── GET /v1/providers ──────────────────────────────────────────────
export const getProviders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const providers = await getAllProviders();
    res.status(200).json({
      success: true,
      message: 'Providers retrieved successfully',
      data: providers,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    logger.error('Error fetching providers', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch providers',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// ─── GET /v1/providers/:providerId/models ──────────────────────────
export const getProviderModels = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { providerId } = req.params;
    const models = await getProviderModelsService(providerId);

    res.status(200).json({
      success: true,
      message: 'Provider models retrieved successfully',
      data: models,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    logger.error(`Error fetching models for ${req.params.providerId}`, error);

    if (error.message.includes('is disabled')) {
      res.status(403).json({
        success: false,
        message: error.message,
        error: { code: 'PROVIDER_DISABLED' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch provider models',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};