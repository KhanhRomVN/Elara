import { Router } from 'express';
import { providerSyncService } from '../../../services/provider-sync';
import { versionManager } from '../../../services/version-manager';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ProvidersRoute');
const router = Router();

/**
 * GET /v1/providers - Return all provider configurations
 * Returns the raw provider.json content from cache or bundled file
 */
router.get('/', async (req, res) => {
  try {
    const providers = providerSyncService.getProviders();
    const currentVersion = versionManager.getCurrentVersion();

    res.setHeader('X-Provider-Version', currentVersion || 'unknown');
    res.json(providers);

    logger.debug(
      `Served ${providers.length} providers (version: ${currentVersion})`,
    );
  } catch (error: any) {
    logger.error('Failed to get providers:', error);
    res.status(500).json({
      error: 'Failed to retrieve providers',
      message: error.message,
    });
  }
});

/**
 * POST /v1/providers/refresh - Force refresh provider data
 */
router.post('/refresh', async (req, res) => {
  try {
    logger.info('Manual provider refresh requested');
    const success = await providerSyncService.forceSync();

    if (success) {
      const providers = providerSyncService.getProviders();
      const currentVersion = versionManager.getCurrentVersion();

      res.json({
        success: true,
        message: 'Providers refreshed successfully',
        version: currentVersion,
        count: providers.length,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to refresh providers',
      });
    }
  } catch (error: any) {
    logger.error('Failed to refresh providers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh providers',
      message: error.message,
    });
  }
});

export default router;
