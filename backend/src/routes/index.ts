import { Router } from 'express';
import { healthRouter } from './health';
import { stubsRouter } from './stubs';

export const apiRouter = Router();

// Health check available at /health and /api/v1/health
apiRouter.use(healthRouter);

// §18 & Phase 4B API Endpoints mounted at /api/v1
apiRouter.use('/api/v1', stubsRouter);
