/**
 * ------------------------------------------------------------------
 * Server
 * ------------------------------------------------------------------
 * HTTP/HTTPS server khởi tạo và quản lý.
 * Hỗ trợ tự động kill port khi đang sử dụng (interactive mode).
 *
 * Main functions:
 * - startServer() : Khởi động server
 * - stopServer()  : Dừng server
 * - getServerInfo(): Lấy thông tin server
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

// ── App ──
import { createApp } from './app';

// ── Config ──
import { getServerConfig } from './config/server.config';

// ── Utils ──
import { createLogger } from './utils/logger';
import { askYesNo } from './utils/prompt';
import { killProcessOnPort } from './utils/kill-port';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('Server');

let server: http.Server | https.Server | null = null;

// ─── Start ─────────────────────────────────────────────────────────────

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
    const app = await createApp();

    return new Promise((resolve) => {
      try {
        if (config.tls.enable && config.tls.certPath && config.tls.keyPath) {
          const httpsOptions = {
            cert: fs.readFileSync(config.tls.certPath),
            key: fs.readFileSync(config.tls.keyPath),
          };
          server = https.createServer(httpsOptions, app);
        } else {
          server = http.createServer(app);
        }

        server.listen(config.port, config.host, () => {
          resolve({
            success: true,
            port: config.port,
            https: config.tls.enable,
          });
        });

        server.on('error', async (e: any) => {
          if (e.code === 'EADDRINUSE') {
            logger.error(`Port ${config.port} already in use`);

            const isTTY = process.stdin.isTTY;
            let shouldKill = false;

            if (isTTY) {
              const answer = await askYesNo(
                `Port ${config.port} is already in use. Do you want to kill the process using this port?`,
              );
              shouldKill = answer === true;
            } else {
              logger.info('Non-interactive mode - skipping port kill prompt');
            }

            if (shouldKill) {
              logger.info(`Attempting to kill process on port ${config.port}...`);
              const killed = await killProcessOnPort(config.port);

              if (killed) {
                logger.info(`Process on port ${config.port} killed. Retrying...`);
                server?.close(() => {
                  const newServer = http.createServer(app);
                  newServer.listen(config.port, config.host, () => {
                    logger.info(`Listening on ${config.host}:${config.port} (after killing port)`);
                    server = newServer;
                    resolve({
                      success: true,
                      port: config.port,
                      https: config.tls.enable,
                    });
                  });
                  newServer.on('error', (err: any) => {
                    logger.error(`Retry failed: ${err.message}`);
                    resolve({
                      success: false,
                      error: `Retry failed: ${err.message}`,
                      code: err.code || 'RETRY_FAILED',
                    });
                  });
                });
                return;
              } else {
                logger.error(`Failed to kill process on port ${config.port}`);
                resolve({
                  success: false,
                  error: `Port ${config.port} is already in use and could not be killed`,
                  code: 'EADDRINUSE_KILL_FAILED',
                });
                return;
              }
            }

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
        logger.error('Failed to create server', error);
        resolve({ success: false, error: error.message });
      }
    });
  } catch (error: any) {
    logger.error('Configuration error', error);
    return { success: false, error: error.message };
  }
};

// ─── Stop ──────────────────────────────────────────────────────────────

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

// ─── Info ──────────────────────────────────────────────────────────────

export const getServerInfo = () => {
  const config = getServerConfig();
  return {
    running: server !== null,
    port: config.port,
    host: config.host,
    https: config.tls.enable,
  };
};