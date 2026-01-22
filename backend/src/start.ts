import { startServer } from './server';
import { createLogger } from './utils/logger';
import { initDatabase } from './services/db';
import { killPort } from './utils/port';

const logger = createLogger('Startup');

const main = async (options?: { dbPath?: string }) => {
  logger.info('Starting backend service...');

  // Kill any existing process on port 11434
  await killPort(11434);

  // We can load environment variables here if needed

  // Initialize database (synchronous)
  try {
    initDatabase(options?.dbPath);
  } catch (error) {
    logger.error('Failed to initialize database', error);
    if (require.main === module) process.exit(1);
    throw error;
  }

  const result = await startServer();

  if (result.success) {
    logger.info(`Backend service started successfully on port ${result.port}`);
  } else {
    logger.error(`Failed to start backend service: ${result.error}`);
    if (require.main === module) process.exit(1);
    throw new Error(result.error);
  }

  // Handle graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    if (require.main === module) process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

export const startBackend = main;

if (require.main === module) {
  main().catch((err) => {
    logger.error('Unhandled error during startup', err);
    process.exit(1);
  });
}
