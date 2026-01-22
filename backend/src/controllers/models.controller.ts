import { Request, Response } from 'express';
import { getAllModelsFromEnabledProviders } from '../services/provider.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('ModelsController');

// GET /v1/models/all
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
