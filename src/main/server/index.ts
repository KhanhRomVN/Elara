import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { getProxyConfig } from './config';
import ManagementRouter from './routes/management';
import { getCertificateManager } from './utils/cert-manager';
import v1Router from './routes/v1';
import { app } from 'electron';
import path from 'path';
import { initDatabase } from '@backend/services/db';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/logger';
import logger from './utils/logger';

export interface ServerStartResult {
  success: boolean;
  port?: number;
  https?: boolean;
  error?: string;
  message?: string;
}

const expressApp = express();

// Middleware
expressApp.use(cors());
expressApp.use(express.json({ limit: '50mb' }));
expressApp.use(express.urlencoded({ extended: true, limit: '50mb' }));
expressApp.use(requestLogger);

// Health check
expressApp.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register management routes (no auth required for localhost)
expressApp.use('/v0/management', ManagementRouter);

// Register v1 routes
expressApp.use('/v1', v1Router);

// Error handling middleware (must be last)
expressApp.use(errorHandler);

let server: https.Server | http.Server | null = null;
let isHttpsMode = false;

export const startServer = async (retryCount = 0, maxRetries = 10): Promise<ServerStartResult> => {
  if (server) {
    const config = getProxyConfig();
    return { success: true, port: config.port, message: 'Server already running' };
  }

  // Initialize database before starting server
  if (retryCount === 0) {
    try {
      let dbPath: string;
      if (app.isPackaged) {
        dbPath = path.join(app.getPath('userData'), 'database.sqlite');
      } else {
        // Development: use backend database for consistency with standalone
        dbPath = path.resolve(process.cwd(), 'backend', 'database.sqlite');
      }
      initDatabase(dbPath);
      logger.info(`[Server] Database initialized successfully at ${dbPath}`);
    } catch (err) {
      logger.error('[Server] Failed to initialize database:', err);
      // Continue anyway? Or fail? failing might be safer but let's try to continue for now or return error
      return { success: false, error: 'Database initialization failed' };
    }
  }

  try {
    const config = getProxyConfig();
    const port = config.port + retryCount; // Try port + retry count
    const host = config.host;

    return new Promise(async (resolve) => {
      try {
        if (config.tls.enable) {
          // HTTPS mode
          const certManager = getCertificateManager();
          const certs = await certManager.ensureCertificates();

          const httpsOptions = {
            cert: fs.readFileSync(certs.cert),
            key: fs.readFileSync(certs.key),
          };

          server = https.createServer(httpsOptions, expressApp);
          isHttpsMode = true;
        } else {
          // HTTP mode
          server = http.createServer(expressApp);
          isHttpsMode = false;
        }

        server.listen(port, host, () => {
          if (retryCount > 0) {
            logger.info(`[Server] Port ${config.port} was in use, using port ${port} instead`);
          }
          logger.info(
            `[Server] Server running on ${host}:${port} (${config.tls.enable ? 'HTTPS' : 'HTTP'})`,
          );
          resolve({ success: true, port, https: config.tls.enable });
        });

        server.on('error', async (e: any) => {
          if (e.code === 'EADDRINUSE') {
            server = null;

            // Check if it's our own backend running
            try {
              // Try to hit the health endpoint
              const protocol = config.tls.enable ? 'https' : 'http';
              const healthUrl = `${protocol}://${host}:${port}/health`;

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 1000);

              const res = await fetch(healthUrl, { signal: controller.signal });
              clearTimeout(timeoutId);

              if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok') {
                  logger.info(
                    `[Server] Detected existing compatible backend on port ${port}. Using it.`,
                  );
                  resolve({
                    success: true,
                    port,
                    https: config.tls.enable,
                    message: 'Connected to existing backend',
                  });
                  return;
                }
              }
            } catch (err) {
              // Ignore error, assume it's not our backend or not healthy
              logger.debug(`[Server] Port ${port} in use but health check failed:`, err);
            }

            if (retryCount < maxRetries) {
              logger.info(`[Server] Port ${port} is already in use, trying port ${port + 1}...`);
              const result = await startServer(retryCount + 1, maxRetries);
              resolve(result);
            } else {
              logger.error(`[Server] Could not find available port after ${maxRetries} attempts`);
              resolve({
                success: false,
                error: `All ports from ${config.port} to ${port} are in use`,
              });
            }
          } else {
            logger.error('[Server] Start Error:', e);
            resolve({ success: false, error: e.message });
          }
        });
      } catch (error: any) {
        logger.error('[Server] Failed to start:', error);
        resolve({ success: false, error: error.message });
      }
    });
  } catch (error: any) {
    logger.error('[Server] Configuration error:', error);
    return { success: false, error: error.message };
  }
};

export const stopServer = () => {
  if (!server) return { success: false, message: 'Server not running' };

  return new Promise((resolve) => {
    server?.close(() => {
      server = null;
      isHttpsMode = false;
      resolve({ success: true });
    });
  });
};

export const getServerInfo = () => {
  const config = getProxyConfig();
  return {
    running: server !== null,
    port: config.port,
    host: config.host,
    https: config.tls.enable,
    strategy: config.routing.strategy,
    localhostOnly: config.localhostOnly,
  };
};
