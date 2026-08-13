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
// §18 Core Endpoints (Phases 1-6)
// -------------------------------------------------------------

// Phase 1: Profiles & Identity
stubsRouter.post('/profiles', createStubHandler(1, 'Create user or merchant profile'));
stubsRouter.post('/profiles/:id/aliases', createStubHandler(1, 'Generate new alias/QR for profile'));
stubsRouter.get('/aliases/:alias', createStubHandler(1, 'Lookup public profile by alias handle'));
stubsRouter.post('/profiles/:id/identity', createStubHandler(1, 'Submit KYC identity documents'));
stubsRouter.get('/profiles/:id/identity', createStubHandler(1, 'Fetch KYC identity status'));
stubsRouter.post('/profiles/:id/identity/review', createStubHandler(1, 'Manual admin review of KYC submission'));

// Phase 2: Payment Rails & LOOP Integration
stubsRouter.post('/payment-intents', createStubHandler(2, 'Initiate payment intent on LOOP/M-Pesa rail'));
stubsRouter.get('/payment-intents/:id', createStubHandler(2, 'Query payment intent status'));
stubsRouter.post('/payment-intents/:id/retry', createStubHandler(2, 'Retry payment intent with idempotency'));
stubsRouter.post('/webhooks/loop', createStubHandler(2, 'LOOP asynchronous payment webhook handler'));

// Phase 3: Transactions, Reconciliation & Exports
stubsRouter.get('/transactions', createStubHandler(3, 'List ledger transactions with filters'));
stubsRouter.post('/reconciliation/run', createStubHandler(3, 'Trigger automated reconciliation run'));
stubsRouter.get('/reconciliation/exceptions', createStubHandler(3, 'List unreconciled transaction exceptions'));
stubsRouter.get('/exports/transactions.csv', createStubHandler(3, 'Export transaction ledger as CSV'));

// Phase 4: Balances, Money Direction & Payouts
stubsRouter.get('/profiles/:id/balance', createStubHandler(4, 'Query profile available and ledger balance'));
stubsRouter.get('/profiles/:id/money-direction', createStubHandler(4, 'Get money direction routing rules'));
stubsRouter.put('/profiles/:id/money-direction', createStubHandler(4, 'Update money direction routing rules'));
stubsRouter.post('/payouts', createStubHandler(4, 'Initiate manual or scheduled payout'));
stubsRouter.get('/payouts/:id', createStubHandler(4, 'Get payout status'));
stubsRouter.get('/payouts', createStubHandler(4, 'List historical payouts'));

// Phase 5: AI Queries & Support Assistant
stubsRouter.post('/ai/query', createStubHandler(5, 'AI-assisted transaction search and financial analysis'));
stubsRouter.post('/ai/support', createStubHandler(5, 'AI conversational customer support assistant'));

// Phase 6: Admin Operations
stubsRouter.get('/admin/users', createStubHandler(6, 'Admin list all users and verification statuses'));
stubsRouter.get('/admin/exceptions', createStubHandler(6, 'Admin system-wide reconciliation exceptions'));
stubsRouter.put('/admin/payment-rails/:id', createStubHandler(6, 'Admin update payment rail circuit breaker state'));
stubsRouter.get('/admin/audit-logs', createStubHandler(6, 'Admin security audit log search'));

// Phase 7: Checkout
stubsRouter.post('/checkout/payment-options', createStubHandler(7, 'Query available checkout payment options'));

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
