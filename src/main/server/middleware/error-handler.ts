import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ErrorHandler] Error occurred:', err);

  // Check if error has statusCode property (custom app errors)
  const statusCode = (err as any).statusCode || 500;
  const code = (err as any).code || 'INTERNAL_ERROR';

  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    error: {
      code,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};
