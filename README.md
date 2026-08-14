# UniPay v4.0 — Unified Payment, Identity & Reconciliation Platform (Kenya)

UniPay provides individuals and businesses across Kenya with **one verifiable identity** (alias handle, QR code, payment link) and layers real-time reconciliation, settlement visibility, and AI-assisted financial matching across **LOOP, M-Pesa, and PesaLink** rails via a modular provider-adapter architecture.

---

## 🏗 Architecture & Stack Decisions

| Layer | Technology | Details |
| --- | --- | --- |
| **Product Surface** | **Expo (React Native + TypeScript)**, Expo Router, NativeWind | One codebase, 3 export targets: **Web (zero-install guest checkout)**, iOS, Android. |
| **Auth** | **Clerk** (`@clerk/expo` & backend JWT verification) | Universal auth for individuals and businesses (`account_type` is a flag, not a fork). |
| **Backend API** | **Node.js, Express, TypeScript** | Clean layered architecture, structured logging, API-first contract stubs. |
| **Database** | **PostgreSQL via Supabase** | Connection pooling (transaction-mode compatible), schema evolution discipline. |
| **Payment Rails** | **Provider-Adapter Interface** | Initial focus on **LOOP (NCBA)** with multi-rail extensibility (M-Pesa, PesaLink). |

---

## 📁 Monorepo Layout

```
/ (monorepo root)
├── /app        — Expo (React Native + TypeScript, Expo Router, NativeWind, Clerk)
├── /backend    — Express REST API, pg connection pool, structured logging, 34 API stubs
├── /shared     — Shared domain models, PaymentProviderAdapter interface, API DTO contracts
├── /docs       — Architecture specifications, handbook references, phase prompts
└── .agents     — AI Agent tools & verified skills (e.g. loop-api)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and provide your Supabase and Clerk credentials:
```bash
cp .env.example .env
```

### 3. Build Shared Contracts & Run Backend
```bash
# Build shared types package
npm run build:shared

# Run database migrations
npm run migrate

# Start backend dev server (Port 4000)
npm run dev:backend
```
Backend health check is available at: [`http://localhost:4000/health`](http://localhost:4000/health).

### 4. Run Frontend & Expo Exports

#### Web Export (Canonical Payer-Facing Checkout Surface)
```bash
# Dev web server
npm run dev:app -- --web

# Production static web export
npm run export:web
```

#### Mobile (iOS & Android via Expo Go or Simulators)
```bash
# Start Metro bundler
npm run dev:app

# iOS Simulator
npm run dev:app -- --ios

# Android Emulator
npm run dev:app -- --android
```

#### EAS Native Builds
EAS configuration is ready in [`app/eas.json`](file:///c:/Projects/LOOPS%20API%20Hackathon/UniPay/app/eas.json).

---

## 🗄 Database & Connection Pool Strategy (Handbook M1)

- **Connection Pool Size**: Default `10` connections (`pool_size = num_cores × 2 + effective_spindle_count`), configurable via `DB_POOL_SIZE`.
- **PgBouncer Mode**: Configured for **transaction mode** (stateless API connections).
- **Migration Framework**: Baseline migration runner in [`backend/src/db/migrate.ts`](file:///c:/Projects/LOOPS%20API%20Hackathon/UniPay/backend/src/db/migrate.ts) with `_unipay_migrations` tracking table.

### Known Future Composite Indexes (Handbook M1)
When Phase 1 and Phase 2 create core tables, the following composite indexes must be added:
1. `CREATE INDEX idx_transactions_recipient_status ON transactions(recipient_profile_id, payment_status);`
2. `CREATE INDEX idx_payment_intents_idempotency ON payment_intents(idempotency_key);`

### Backward-Compatible Schema Evolution Rules (Handbook M8.3)
- Every new column added in subsequent phases must be **optional with a sensible default**.
- Never rename or drop columns in active use; deprecate with dual-read/write patterns.

---

## 🛡 Security & PII Redaction Rules (§19 & Handbook M5)

All backend log lines are emitted as structured JSON:
`{"level":"info","time":"...","trace_id":"...","user_id":"...","route":"...","message":"..."}`

### Mandatory Code-Review Checklist Item
> [!CAUTION]
> **Zero Plaintext PII in Logs**:
> Every Pull Request and code change must ensure that:
> - Kenyan National IDs, Passport numbers, and Business registration numbers are never logged in the clear.
> - Phone numbers (`07...`, `+254...`) and Email addresses are masked/redacted.
> - Document URLs (KYC ID photos, business permits) are redacted using `[REDACTED_DOC_URL]`.
> - The automated `redactPII()` utility in [`backend/src/utils/logger.ts`](file:///c:/Projects/LOOPS%20API%20Hackathon/UniPay/backend/src/utils/logger.ts) is applied to all contextual logs.

---

## 📡 API Contract Stubs (§18 & Phase 4B)

All 34 endpoints are registered in [`backend/src/routes/stubs.ts`](file:///c:/Projects/LOOPS%20API%20Hackathon/UniPay/backend/src/routes/stubs.ts) and return `501 Not Implemented` with metadata indicating which phase will implement them:
- **Phase 1**: `/api/v1/profiles`, `/api/v1/profiles/:id/aliases`, `/api/v1/aliases/:alias`, `/api/v1/profiles/:id/identity`
- **Phase 2**: `/api/v1/payment-intents`, `/api/v1/payment-intents/:id`, `/api/v1/webhooks/loop`
- **Phase 3**: `/api/v1/transactions`, `/api/v1/reconciliation/run`, `/api/v1/reconciliation/exceptions`, `/api/v1/exports/transactions.csv`
- **Phase 4**: `/api/v1/profiles/:id/balance`, `/api/v1/profiles/:id/money-direction`, `/api/v1/payouts`
- **Phase 4B**: `/api/v1/expected-payments`, `/api/v1/pools`, `/api/v1/pools/:id/contributions`
- **Phase 5**: `/api/v1/ai/query`, `/api/v1/ai/support`
- **Phase 6**: `/api/v1/admin/users`, `/api/v1/admin/exceptions`, `/api/v1/admin/audit-logs`
- **Phase 7**: `/api/v1/checkout/payment-options`

---

## ✅ Phase 0 Definition of Done (DoD) Checklist

- [x] Monorepo initialized (`/app`, `/backend`, `/shared`).
- [x] Expo multi-target configured (Web export, iOS, Android, `eas.json`).
- [x] Universal Phase 0 placeholder dashboard screen created.
- [x] Supabase PostgreSQL connection pool configured (`pg` pool, `pool_size = 10`).
- [x] Structured JSON logger with automatic PII redaction and `trace_id` header propagation.
- [x] Mandatory PII redaction rule written into code-review checklist.
- [x] Health check endpoint `GET /health` operational (checks database connection).
- [x] All 27 §18 core endpoints and 7 Phase 4B extensions stubbed as 501 handlers.
- [x] Clerk authentication wired on `/app` and `/backend`.
- [x] Root README.md documented with architecture, run instructions, and future indexes.
