/**
 * ------------------------------------------------------------------
 * Entry Point
 * ------------------------------------------------------------------
 * Điểm khởi chạy của backend server.
 * Khởi tạo database, start server, và các background services.
 *
 * Main functions:
 * - startBackend() : Khởi động toàn bộ backend
 * - main()         : Main function với dbPath option
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as dns from 'dns';

// ── Env ──
import './env';

// ── Server ──
import { startServer } from './server';

// ── Database ──
import { initDatabase } from './database';

// ── WebSocket ──
import { startWebSocketServer } from './websocket-server';

// ── Utils ──
import { createLogger } from './utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('Startup');

// ─── Main ──────────────────────────────────────────────────────────────

const main = async (options?: { dbPath?: string }) => {
  try {
    initDatabase(options?.dbPath);
  } catch (error) {
    logger.error('Failed to initialize database', error);
    if (require.main === module) process.exit(1);
    throw error;
  }

  const result = await startServer();

  if (result.success) {
    logger.info(
      `Server started on port ${result.port}${result.https ? ' (HTTPS)' : ''}`,
    );
    startWebSocketServer();
    logger.info('WebSocket server started on port 8899');
    const {
      accountRefreshService,
    } = require('./services/account-refresh.service');
    accountRefreshService.start();
  } else {
    logger.error(`Failed to start server: ${result.error}`);
    if (require.main === module) process.exit(1);
    throw new Error(result.error);
  }

  const shutdown = () => {
    logger.info('Shutting down...');
    if (require.main === module) process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

export const startBackend = main;

// ─── CLI Entry ─────────────────────────────────────────────────────────

if (require.main === module) {
  // Force IPv4 first to avoid DNS resolution issues
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }

  const args = process.argv.slice(2);
  let dbPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--db-path=')) {
      dbPath = arg.split('=')[1];
    } else if (arg === '--db-path' && i + 1 < args.length) {
      dbPath = args[++i];
    }
  }

  main({ dbPath }).catch((err) => {
    logger.error('Unhandled startup error', err);
    process.exit(1);
  });
}
