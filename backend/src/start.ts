import { startServer } from './server';
import { createLogger } from './utils/logger';
import { initDatabase } from './services/db';
import { killPort } from './utils/port';

const logger = createLogger('Startup');

const main = async () => {
  logger.info('Starting standalone backend service...');

  // Kill any existing process on port 11434
  await killPort(11434);

  // We can load environment variables here if needed

  // Initialize database
  try {
    await initDatabase();
  } catch (error) {
    logger.error('Failed to initialize database', error);
    process.exit(1);
  }

  const result = await startServer();

  if (result.success) {
    logger.info(`Backend service started successfully on port ${result.port}`);
  } else {
    logger.error(`Failed to start backend service: ${result.error}`);
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    process.exit(0);
  });
};

main().catch((err) => {
  logger.error('Unhandled error during startup', err);
  process.exit(1);
});
