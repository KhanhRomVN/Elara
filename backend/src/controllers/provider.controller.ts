import { Request, Response } from 'express';
import {
  getAllProviders,
  getProviderModels,
} from '../services/provider.service';
import { getDb } from '../services/db';
import { createLogger } from '../utils/logger';

const logger = createLogger('ProviderController');

// GET /v1/providers
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

// GET /v1/providers/:providerId/models
export const getProviderModelsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { providerId } = req.params;
    const models = await getProviderModels(providerId);

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
