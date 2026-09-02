/**
 * ------------------------------------------------------------------
 * API Error
 * ------------------------------------------------------------------
 * Định nghĩa class AppError cho lỗi API.
 * Mở rộng Error với statusCode và code để dễ xử lý trong middleware.
 *
 * Main exports:
 * - AppError   : Class lỗi với statusCode và code
 * - createError(): Factory function tạo AppError
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Types ──
import { ApiError } from '../types';

// ─── Class ──────────────────────────────────────────────────────────────

export class AppError extends Error implements ApiError {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Factory ────────────────────────────────────────────────────────────

export const createError = (
  message: string,
  statusCode = 500,
  code?: string,
): AppError => {
  return new AppError(message, statusCode, code);
};