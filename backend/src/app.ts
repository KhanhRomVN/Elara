import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { createLogger } from './utils/logger';
import { providerRegistry } from './provider/registry';

// Import routes
import v1Router from './routes/v1/index';

const logger = createLogger('App');

export const createApp = async () => {
  const app = express();

  // Load all providers before handling any requests
  logger.info('Loading providers...');
  await providerRegistry.loadProviders();
  logger.info('Providers loaded successfully');

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(requestLogger);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/v1', v1Router);

  // 404 handler - must be after all routes
  app.use((req, res, next) => {
    res.status(404).json({
      success: false,
      message: `Cannot ${req.method} ${req.path}`,
      error: {
        code: 'NOT_FOUND',
        details: {
          method: req.method,
          path: req.path,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  logger.info('Express app initialized');

  return app;
};
