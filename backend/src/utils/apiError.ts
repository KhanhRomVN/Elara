import { ApiError } from '../types';

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

export const createError = (
  message: string,
  statusCode = 500,
  code?: string,
) => {
  return new AppError(message, statusCode, code);
};
