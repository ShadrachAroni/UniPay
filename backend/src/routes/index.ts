import { Router } from 'express';
import { healthRouter } from './health';
import { profilesRouter } from './profiles';
import { aliasesRouter } from './aliases';
import { checkoutRouter } from './checkout';
import { paymentIntentsRouter } from './paymentIntents';
import { webhooksRouter } from './webhooks';
import { reconciliationRouter } from './reconciliation';
import { aiRouter } from './ai';
import { stubsRouter } from './stubs';

export const apiRouter = Router();

// Health check available at /health and /api/v1/health
apiRouter.use(healthRouter);

// Phase 1 Live Endpoints: Profiles, Identity, Aliases
apiRouter.use('/api/v1/profiles', profilesRouter);
apiRouter.use('/api/v1/aliases', aliasesRouter);

// Phase 2 Live Endpoints: Checkout Payment Options
apiRouter.use('/api/v1/checkout', checkoutRouter);

// Phase 3 Live Endpoints: Payment Intents & Provider Webhooks
apiRouter.use('/api/v1/payment-intents', paymentIntentsRouter);
apiRouter.use('/api/v1/webhooks', webhooksRouter);

// Phase 4A Live Endpoints: Reconciliation Engine & Exceptions
apiRouter.use('/api/v1/reconciliation', reconciliationRouter);

// Phase 4B Live Endpoints: AI Intelligence & Natural-Language Queries
apiRouter.use('/api/v1/ai', aiRouter);

// §18 & Phase 4B API Endpoints stubs mounted at /api/v1
apiRouter.use('/api/v1', stubsRouter);



