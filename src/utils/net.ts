/**
 * ------------------------------------------------------------------
 * Network Utilities
 * ------------------------------------------------------------------
 * Tiện ích kiểm tra và tìm port khả dụng.
 *
 * Main functions:
 * - findAvailablePort() : Tìm port khả dụng từ preferred port
 * - isPortAvailable()   : Kiểm tra port có khả dụng không
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { createServer } from 'net';

// ─── Functions ──────────────────────────────────────────────────────────

export const findAvailablePort = (preferredPort: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(preferredPort + 1));
      } else {
        reject(err);
      }
    });

    server.once('listening', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => resolve(preferredPort));
      }
    });

    server.listen(preferredPort);
  });
};

export const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
};