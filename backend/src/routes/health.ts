import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../db';
import { HealthCheckResponse } from '@unipay/shared';
import { env } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response<HealthCheckResponse>) => {
  const dbStatus = await checkDbHealth();

  const isHealthy = dbStatus.ok;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'degraded',
    db: dbStatus.ok ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '4.0.0-phase0',
  });
});
