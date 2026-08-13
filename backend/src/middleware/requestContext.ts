import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger, rootLogger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
      userId?: string;
      logger: Logger;
    }
  }
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Propagate existing trace/request header or generate new UUID
  const incomingTrace =
    (req.headers['x-trace-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    uuidv4();

  req.traceId = incomingTrace;
  res.setHeader('x-trace-id', incomingTrace);

  // Initialize request-bound logger
  req.logger = rootLogger.child({
    trace_id: incomingTrace,
    route: `${req.method} ${req.path}`,
  });

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    req.logger.info('HTTP Request processed', {
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
}
