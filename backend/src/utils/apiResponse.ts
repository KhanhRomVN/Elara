import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    [key: string]: any;
  };
}

export class ApiResponseBuilder {
  static success<T>(
    res: Response,
    data: T,
    message: string = 'Success',
    statusCode: number = 200,
    meta?: any,
  ) {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };
    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    details?: any,
  ) {
    const response: ApiResponse = {
      success: false,
      message,
      error: {
        code: errorCode,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
    return res.status(statusCode).json(response);
  }

  // Common error responses
  static notFound(res: Response, message: string = 'Resource not found') {
    return this.error(res, message, 404, 'NOT_FOUND');
  }

  static badRequest(
    res: Response,
    message: string = 'Bad request',
    details?: any,
  ) {
    return this.error(res, message, 400, 'BAD_REQUEST', details);
  }

  static methodNotAllowed(res: Response, allowedMethods: string[] = []) {
    return this.error(
      res,
      `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      405,
      'METHOD_NOT_ALLOWED',
      { allowedMethods },
    );
  }

  static unauthorized(res: Response, message: string = 'Unauthorized') {
    return this.error(res, message, 401, 'UNAUTHORIZED');
  }

  static forbidden(res: Response, message: string = 'Forbidden') {
    return this.error(res, message, 403, 'FORBIDDEN');
  }

  static conflict(res: Response, message: string = 'Conflict', details?: any) {
    return this.error(res, message, 409, 'CONFLICT', details);
  }

  static internalError(
    res: Response,
    message: string = 'Internal server error',
  ) {
    return this.error(res, message, 500, 'INTERNAL_ERROR');
  }
}
