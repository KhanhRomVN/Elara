import http from 'http';
import https from 'https';
import fs from 'fs';
import { createApp } from './app';
import { getServerConfig } from './config/server';
import { createLogger } from './utils/logger';
import { providerSyncService } from './services/provider-sync';

const logger = createLogger('Server');

let server: http.Server | https.Server | null = null;
let providerSyncInitialized = false;

export const startServer = async (): Promise<{
  success: boolean;
  port?: number;
  https?: boolean;
  error?: string;
  code?: string;
}> => {
  if (server) {
    const config = getServerConfig();
    return { success: true, port: config.port, https: config.tls.enable };
  }

  try {
    const config = getServerConfig();

    // Initialize provider sync service on first startup
    if (!providerSyncInitialized) {
      logger.info('Initializing provider sync service...');
      await providerSyncService.initialize();
      providerSyncInitialized = true;
    }

    const app = await createApp();

    return new Promise((resolve) => {
      try {
        if (config.tls.enable && config.tls.certPath && config.tls.keyPath) {
          // HTTPS mode
          const httpsOptions = {
            cert: fs.readFileSync(config.tls.certPath),
            key: fs.readFileSync(config.tls.keyPath),
          };
          server = https.createServer(httpsOptions, app);
          logger.info('Starting HTTPS server...');
        } else {
          // HTTP mode
          server = http.createServer(app);
          logger.info('Starting HTTP server...');
        }

        server.listen(config.port, config.host, () => {
          logger.info(`Server running on ${config.host}:${config.port}`);
          resolve({
            success: true,
            port: config.port,
            https: config.tls.enable,
          });
        });

        server.on('error', (e: any) => {
          if (e.code === 'EADDRINUSE') {
            logger.error(`Port ${config.port} is already in use`);
            resolve({
              success: false,
              error: `Port ${config.port} is already in use`,
              code: 'EADDRINUSE',
            });
          } else {
            logger.error('Server error', e);
            resolve({ success: false, error: e.message });
          }
        });
      } catch (error: any) {
        logger.error('Failed to start server', error);
        resolve({ success: false, error: error.message });
      }
    });
  } catch (error: any) {
    logger.error('Configuration error', error);
    return { success: false, error: error.message };
  }
};

export const stopServer = (): Promise<{
  success: boolean;
  message?: string;
}> => {
  if (!server) {
    return Promise.resolve({ success: false, message: 'Server not running' });
  }

  return new Promise((resolve) => {
    server?.close(() => {
      logger.info('Server stopped');
      server = null;
      resolve({ success: true });
    });
  });
};

export const getServerInfo = () => {
  const config = getServerConfig();
  return {
    running: server !== null,
    port: config.port,
    host: config.host,
    https: config.tls.enable,
  };
};
