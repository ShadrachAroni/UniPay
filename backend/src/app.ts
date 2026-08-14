import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestContextMiddleware } from './middleware/requestContext';
import { optionalAuth } from './middleware/auth';
import { idempotencyMiddleware } from './middleware/idempotency';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { healthRouter } from './routes/health';

export function createApp(): Express {
  const app = express();

  // Basic security headers & CORS
  app.use(helmet());
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-trace-id',
        'x-request-id',
        'x-idempotency-key',
        'idempotency-key',
        'x-profile-id',
      ],
      exposedHeaders: [
        'x-trace-id',
        'x-idempotent-replayed',
        'Retry-After',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
    })
  );

  // Body parser
  app.use(express.json());

  // Structured logging & context propagation
  app.use(requestContextMiddleware);

  // Optional authentication check
  app.use(optionalAuth);

  // Idempotency check & replay caching for write operations (Handbook M8.3)
  app.use(idempotencyMiddleware());

  // Direct root health endpoint /health and /api/v1/health
  app.use(healthRouter);
  app.use('/api/v1', healthRouter);

  // Main API Router
  app.use(apiRouter);

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
