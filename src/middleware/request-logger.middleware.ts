/**
 * ------------------------------------------------------------------
 * Request Logger Middleware
 * ------------------------------------------------------------------
 * Middleware ghi log tất cả request HTTP với method, path, status code,
 * và thời gian xử lý. Bỏ qua các health check path (/, /health).
 *
 * Main features:
 * - Ghi log mỗi request với duration
 * - Bỏ qua các path không cần log (SKIP_PATHS)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response, NextFunction } from 'express';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('HTTP');

const SKIP_PATHS = ['/', '/health'];

// ─── Middleware ────────────────────────────────────────────────────────

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  res.on('finish', () => {
    if (SKIP_PATHS.includes(req.path)) return;
    const duration = Date.now() - start;
  });

  next();
};
