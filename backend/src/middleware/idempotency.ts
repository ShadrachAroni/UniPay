import { Request, Response, NextFunction } from 'express';
import {
  computeRequestHash,
  getIdempotencyRecord,
  saveIdempotencyRecord,
} from '../services/idempotencyService';

export function idempotencyMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only apply to state-modifying write methods (POST, PUT, PATCH)
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = (
      req.headers['x-idempotency-key'] || req.headers['idempotency-key']
    ) as string | undefined;

    if (!idempotencyKey) {
      return next();
    }

    const requestHash = computeRequestHash(req.body);
    const existing = await getIdempotencyRecord(idempotencyKey);

    if (existing) {
      req.logger.info('Idempotency key matched — returning cached response', {
        idempotency_key: idempotencyKey,
        status_code: existing.status_code,
      });

      // Verify request hash matches (prevent payload mutation on same key)
      if (existing.request_hash !== requestHash) {
        res.status(422).json({
          error: 'Unprocessable Entity',
          message: 'Idempotency key conflict: payload differs from original request',
          statusCode: 422,
        });
        return;
      }

      res.setHeader('x-idempotent-replayed', 'true');
      res.status(existing.status_code).json(existing.response_body);
      return;
    }

    // Intercept res.json to capture response body for caching
    const originalJson = res.json.bind(res);
    res.json = (body: any): Response => {
      // Only cache successful or client validation responses (not 5xx internal server errors)
      if (res.statusCode < 500) {
        saveIdempotencyRecord(
          idempotencyKey,
          req.originalUrl || req.path,
          req.userId,
          requestHash,
          res.statusCode,
          body
        ).catch((err) => {
          req.logger.error('Failed to persist idempotency record', {
            error: (err as Error).message,
          });
        });
      }
      return originalJson(body);
    };

    next();
  };
}
