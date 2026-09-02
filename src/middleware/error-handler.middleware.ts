/**
 * ------------------------------------------------------------------
 * Error Handler Middleware
 * ------------------------------------------------------------------
 * Middleware xử lý lỗi tập trung cho toàn bộ ứng dụng Express.
 * Phân biệt lỗi AppError (lỗi business logic) và lỗi hệ thống,
 * trả về response chuẩn với status code và metadata.
 *
 * Main features:
 * - Xử lý AppError với status code tương ứng
 * - Xử lý lỗi network (ETIMEDOUT, ECONNRESET, ECONNREFUSED) → 503
 * - Log lỗi chi tiết
 * - Hiển thị stack trace khi không ở production
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response, NextFunction } from 'express';

// ── Utils ──
import { AppError } from '../utils/api-error';
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

const logger = createLogger('ErrorHandler');

// ─── Middleware ────────────────────────────────────────────────────────

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.error('Error occurred', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code || 'APP_ERROR',
        type: err.constructor.name,
        details: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      },
    });
  }

  const errorCode = (err as any).code || 'INTERNAL_ERROR';
  const statusCode =
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ECONNRESET' ||
    errorCode === 'ECONNREFUSED'
      ? HTTP_STATUS.SERVICE_UNAVAILABLE
      : HTTP_STATUS.INTERNAL_SERVER_ERROR;

  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    error: {
      code: errorCode,
      type: err.constructor.name,
      details: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  });
};