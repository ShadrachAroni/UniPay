import { Router, Request, Response } from 'express';
import { NotImplementedResponse } from '@unipay/shared';

export const stubsRouter = Router();

function createStubHandler(phase: number, description: string) {
  return (req: Request, res: Response<NotImplementedResponse>) => {
    res.status(501).json({
      error: 'Not Implemented',
      message: `${description} — scheduled for Phase ${phase}`,
      phase,
      route: req.originalUrl || req.path,
      method: req.method,
    });
  };
}

// -------------------------------------------------------------
// §18 Core Endpoints (Phases 2-6)
// Phase 1 (Profiles, Aliases & Identity) is implemented live in profiles.ts & aliases.ts
// -------------------------------------------------------------

// Phase 2 & 3: Payment Rails, Payment Intents & Webhooks are implemented live in checkout.ts, paymentIntents.ts, webhooks.ts


// Phase 3 & 4A: Transactions, Reconciliation & Exports
stubsRouter.get('/transactions', createStubHandler(3, 'List ledger transactions with filters'));
// /reconciliation/run and /reconciliation/exceptions are implemented live in reconciliation.ts
stubsRouter.get('/exports/transactions.csv', createStubHandler(3, 'Export transaction ledger as CSV'));

// Phase 4 & 5: Balances, Money Direction & Payouts
// /profiles/:id/money-direction & /profiles/:id/balance are implemented live in profiles.ts
// /payouts, /payouts/:id are implemented live in payouts.ts

// Phase 4B / Phase 5: AI Queries & Support Assistant
// /ai/query is live in ai.ts
stubsRouter.post('/ai/support', createStubHandler(5, 'AI conversational customer support assistant'));

// Phase 6 / Phase 8: Admin Operations
// Live in admin.ts (/api/v1/admin/*)

// Phase 7: Checkout
// POST /checkout/payment-options is live in checkout.ts


// -------------------------------------------------------------
// Phase 4B Expected & Pooled Payments Additions
// -------------------------------------------------------------

stubsRouter.post('/expected-payments', createStubHandler(4, 'Register expected payment contract'));
stubsRouter.get('/expected-payments/:id', createStubHandler(4, 'Get expected payment details'));
stubsRouter.get('/expected-payments', createStubHandler(4, 'List expected payments'));
stubsRouter.post('/pools', createStubHandler(4, 'Create pooled contribution fund (e.g. Chama)'));
stubsRouter.get('/pools/:id', createStubHandler(4, 'Get pooled fund status'));
stubsRouter.post('/pools/:id/contributions', createStubHandler(4, 'Submit contribution to pool'));
stubsRouter.get('/pools/:id/contributions', createStubHandler(4, 'List contributions to pool'));
