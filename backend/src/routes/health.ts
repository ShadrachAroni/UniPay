import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../db';
import { HealthCheckResponse } from '@unipay/shared';
import { env } from '../config/env';
import { observabilityService } from '../services/observabilityService';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response<HealthCheckResponse & { signals?: any; active_alerts?: any }>) => {
  const dbStatus = await checkDbHealth();
  const signals = await observabilityService.getGoldenSignals();
  const alerts = await observabilityService.checkAlertThresholds();

  const isHealthy = dbStatus.ok && signals.saturation.system_status !== 'UNHEALTHY';
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'degraded',
    db: dbStatus.ok ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '4.0.0-phase0',
    signals,
    active_alerts: alerts,
  });
});

healthRouter.get('/health/signals', async (_req: Request, res: Response) => {
  const signals = await observabilityService.getGoldenSignals();
  const alerts = await observabilityService.checkAlertThresholds();

  res.status(200).json({
    timestamp: new Date().toISOString(),
    signals,
    active_alerts: alerts,
  });
});
