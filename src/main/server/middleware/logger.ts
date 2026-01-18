import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });

  next();
};
