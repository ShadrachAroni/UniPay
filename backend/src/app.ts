import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestContextMiddleware } from './middleware/requestContext';
import { optionalAuth } from './middleware/auth';
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
      ],
    })
  );

  // Body parser
  app.use(express.json());

  // Structured logging & context propagation
  app.use(requestContextMiddleware);

  // Optional authentication check
  app.use(optionalAuth);

  // Direct root health endpoint /health
  app.use(healthRouter);

  // Main API Router
  app.use(apiRouter);

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
