import { Router } from 'express';
import { healthRouter } from './health';
import { profilesRouter } from './profiles';
import { aliasesRouter } from './aliases';
import { checkoutRouter } from './checkout';
import { paymentIntentsRouter } from './paymentIntents';
import { webhooksRouter } from './webhooks';
import { reconciliationRouter } from './reconciliation';
import { aiRouter } from './ai';
import { payoutsRouter } from './payouts';
import { adminRouter } from './admin';
import { stubsRouter } from './stubs';
import {
  checkoutRateLimiter,
  authRateLimiter,
  aiRateLimiter,
  payoutRateLimiter,
} from '../middleware/rateLimiter';

export const apiRouter = Router();

// Health check available at /health and /api/v1/health
apiRouter.use(healthRouter);

// Phase 1 Live Endpoints: Profiles, Identity, Aliases (authRateLimiter on profile ops)
apiRouter.use('/api/v1/profiles', authRateLimiter, profilesRouter);
apiRouter.use('/api/v1/aliases', aliasesRouter);

// Phase 2 Live Endpoints: Checkout Payment Options (checkoutRateLimiter)
apiRouter.use('/api/v1/checkout', checkoutRateLimiter, checkoutRouter);

// Phase 3 Live Endpoints: Payment Intents & Provider Webhooks (checkoutRateLimiter)
apiRouter.use('/api/v1/payment-intents', checkoutRateLimiter, paymentIntentsRouter);
apiRouter.use('/api/v1/webhooks', webhooksRouter);

// Phase 4A Live Endpoints: Reconciliation Engine & Exceptions
apiRouter.use('/api/v1/reconciliation', reconciliationRouter);

// Phase 4B Live Endpoints: AI Intelligence & Natural-Language Queries (aiRateLimiter)
apiRouter.use('/api/v1/ai', aiRateLimiter, aiRouter);

// Phase 6 Live Endpoints: Payouts & Disbursements (payoutRateLimiter)
apiRouter.use('/api/v1/payouts', payoutRateLimiter, payoutsRouter);

// Phase 8 Live Endpoints: Admin Operations, Audit Logs, Rail Control, Disputes (authRateLimiter)
apiRouter.use('/api/v1/admin', authRateLimiter, adminRouter);

// §18 & Phase 4B API Endpoints stubs mounted at /api/v1
apiRouter.use('/api/v1', stubsRouter);



