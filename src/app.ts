/**
 * ------------------------------------------------------------------
 * Express App
 * ------------------------------------------------------------------
 * Cấu hình và khởi tạo Express application.
 * Tạo app với middleware, routes, và error handling.
 *
 * Main functions:
 * - createApp() : Tạo Express app với các middleware và routes
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import express from 'express';
import cors from 'cors';

// ── Middleware ──
import { errorHandler } from './middleware/error-handler.middleware';

// ── Routes ──
import v1Router from './routes/v1/index';

// ── Controllers ──
import { login } from './controllers/login.controller';

// ── Providers ──
import { providerRegistry } from './provider/registry';

// ── Utils ──
import { createLogger } from './utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('App');

// ─── App Factory ──────────────────────────────────────────────────────

export const createApp = async () => {
  const app = express();
  await providerRegistry.loadProviders();

  // ─── Middleware ──────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ─── Health Check ────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── API Routes ──────────────────────────────────────────────────────
  app.use('/v1', v1Router);

  // ─── Legacy Login ────────────────────────────────────────────────────
  app.post(
    '/login/:provider',
    (req, res, next) => {
      next();
    },
    login,
  );

  // ─── Event Logging ──────────────────────────────────────────────────
  app.post('/api/event_logging/batch', (req, res) =>
    res.status(200).json({ status: 'ok' }),
  );

  // ─── 404 Handler ─────────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.status(404).json({
      success: false,
      message: `Cannot ${req.method} ${req.path}`,
      error: { code: 'NOT_FOUND' },
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // ─── Error Handler ──────────────────────────────────────────────────
  app.use(errorHandler);
  return app;
};