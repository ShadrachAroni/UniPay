import { Router } from 'express';
import { healthRouter } from './health';
import { profilesRouter } from './profiles';
import { aliasesRouter } from './aliases';
import { checkoutRouter } from './checkout';
import { stubsRouter } from './stubs';

export const apiRouter = Router();

// Health check available at /health and /api/v1/health
apiRouter.use(healthRouter);

// Phase 1 Live Endpoints: Profiles, Identity, Aliases
apiRouter.use('/api/v1/profiles', profilesRouter);
apiRouter.use('/api/v1/aliases', aliasesRouter);

// Phase 2 Live Endpoints: Checkout Payment Options
apiRouter.use('/api/v1/checkout', checkoutRouter);

// §18 & Phase 4B API Endpoints stubs mounted at /api/v1
apiRouter.use('/api/v1', stubsRouter);

