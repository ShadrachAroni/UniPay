# UniPay Data Contract

This document indexes all available API functions and their corresponding mock layer endpoints.

| Function | File | Endpoint | Owned by | Status |
|---|---|---|---|---|
| `login` | `api/auth.ts` | `POST /auth/login` | Frontend | MOCK |
| `verifyOtp` | `api/auth.ts` | `POST /auth/verify` | Frontend | MOCK |
| `getProfile` | `api/profiles.ts` | `GET /profiles/:id` | Frontend | MOCK |
| `updateProfile` | `api/profiles.ts` | `PUT /profiles/:id` | Frontend | MOCK |
| `getAliases` | `api/aliases.ts` | `GET /profiles/:id/aliases` | Frontend | MOCK |
| `createAlias` | `api/aliases.ts` | `POST /profiles/:id/aliases` | Frontend | MOCK |
| `createPaymentIntent` | `api/checkout.ts` | `POST /checkout/intent` | Frontend | MOCK |
| `getTransactions` | `api/transactions.ts` | `GET /transactions` | Frontend | MOCK |
| `getTransactionDetails` | `api/transactions.ts` | `GET /transactions/:id` | Frontend | MOCK |
| `getReconciliationMatches` | `api/transactions.ts` | `GET /transactions/:id/matches` | Frontend | MOCK |
| `getDashboardStats` | `api/dashboard.ts` | `GET /dashboard/stats` | Frontend | MOCK |
| `getExpectedPayments` | `api/expectedPayments.ts` | `GET /expected-payments` | Frontend | MOCK |
| `createExpectedPayment` | `api/expectedPayments.ts` | `POST /expected-payments` | Frontend | MOCK |
| `getPaymentPools` | `api/pools.ts` | `GET /pools` | Frontend | MOCK |
| `getPoolDetails` | `api/pools.ts` | `GET /pools/:id` | Frontend | MOCK |
| `getPoolContributions` | `api/pools.ts` | `GET /pools/:id/contributions` | Frontend | MOCK |
| `getMoneyDirectionRules`| `api/moneyDirection.ts` | `GET /money-direction/rules` | Frontend | MOCK |
| `updateMoneyDirectionRule`| `api/moneyDirection.ts`| `PUT /money-direction/rules/:id` | Frontend | MOCK |
| `getPayouts` | `api/payouts.ts` | `GET /payouts` | Frontend | MOCK |
| `requestPayout` | `api/payouts.ts` | `POST /payouts` | Frontend | MOCK |
| `getAuditLogs` | `api/admin.ts` | `GET /admin/audit-logs` | Admin | MOCK |
| `getPaymentRails` | `api/admin.ts` | `GET /admin/rails` | Admin | MOCK |
