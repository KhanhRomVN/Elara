import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { getProxyConfig } from './config';
import ManagementRouter from './routes/management';
import { getCertificateManager } from './utils/cert-manager';
import v1Router from './routes/v1';

const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json({ limit: '50mb' }));

// Register management routes (no auth required for localhost)
expressApp.use('/v0/management', ManagementRouter);

// Register v1 routes
expressApp.use('/v1', v1Router);

let server: https.Server | http.Server | null = null;
let isHttpsMode = false;

export const startServer = async () => {
  if (server) {
    const config = getProxyConfig();
    return { success: true, port: config.port, message: 'Server already running' };
  }

  try {
    const config = getProxyConfig();
    const port = config.port;
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
          resolve({ success: true, port, https: config.tls.enable });
        });

        server.on('error', (e: any) => {
          if (e.code === 'EADDRINUSE') {
            console.error(`[Server] Port ${port} is already in use`);
            resolve({
              success: false,
              error: `Port ${port} is already in use`,
              code: 'EADDRINUSE',
            });
          } else {
            console.error('[Server] Start Error:', e);
            resolve({ success: false, error: e.message });
          }
        });
      } catch (error: any) {
        console.error('[Server] Failed to start:', error);
        resolve({ success: false, error: error.message });
      }
    });
  } catch (error: any) {
    console.error('[Server] Configuration error:', error);
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
