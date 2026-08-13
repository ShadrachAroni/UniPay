import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const logger = req.logger || console;
  logger.error('Unhandled server error', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    statusCode: 500,
    traceId: req.traceId,
  });
}
