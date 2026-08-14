# 🚀 UniPay v4.0 — Hackathon Build Pack

> **Submission deadline: 9:00 AM** · Loop Hackathon — Kenya Track

---

## ✅ Problem Statement

> *What user or business pain does this solve?*

Kenyan merchants and individuals collecting money face the same four problems every day:

1. **Rail fragmentation.** Payments arrive across LOOP, M-Pesa, and PesaLink. There is no single place to see them, match them against expected orders, or act on them. Reconciliation is done manually — in spreadsheets, after the fact, by people who have other jobs.

2. **Zero settlement visibility.** The provider says "paid." The merchant doesn't know when funds actually land in their account, what fees were deducted, or whether the settlement is on time. `payment_status` and `settlement_status` are the same field in almost every existing tool — they are not the same thing.

3. **No programmable fund routing.** Once money settles, it sits in a single pool. Splitting it — 70 % to operating expenses, 30 % back to a savings account — requires a manual bank transfer on the merchant's side. There is no rule engine, no automation.

4. **Group money collection is still a WhatsApp conversation.** Chamas, team trips, shared expenses — organizers manually track who has paid, who hasn't, how much is outstanding. Partial payments get lost. Attribution is guesswork.

These are not edge cases. They are the daily operational reality for Kenya's ~600,000 registered small businesses and the millions of individuals who split bills, collect chama rounds, and receive money from customers.

---

## ✅ Solution Summary

> *What was built, and how does it work?*

**UniPay v4.0** is a unified payment, identity, and reconciliation platform built on the LOOP (NCBA) rail, with a provider-adapter architecture that makes adding M-Pesa or PesaLink a database row, not a deployment.

### What's live and demoable today

#### 1. Provider-Adapter Architecture
A `PaymentProviderAdapter` interface (`name · capabilities · createPayment · getStatus · refund · disburse · normalize · verifyWebhook`) decouples every piece of business logic from the underlying rail. The LOOP adapter is fully implemented against the sandbox. A seeded adapter runs alongside it, proving that adding a second rail requires zero changes to checkout, reconciliation, or settlement code. Rail availability — which currencies, countries, amount bounds — is driven by a `payment_rails` Postgres table, not a code flag.

#### 2. LOOP Integration — Full Payment Lifecycle
- **NEO Merchant Request-to-Pay**: initiate → LOOP sends STK push to payer → payer approves → webhook confirms or poll resolves.
- **Webhook security**: HMAC-SHA256 signature verification on every inbound event; event-ID deduplication prevents double-processing of at-least-once delivery.
- **Outbox Pattern**: settlement events are written in the same DB transaction as the domain write and published by a background poller — closing the dual-write gap between "transaction recorded" and "reconciliation notified."
- **Independent status tracking**: `payment_status` and `settlement_status` are always separate fields in the DB, the API contract, and the UI. Never merged.

#### 3. Rule-Based Reconciliation Engine
A tiered matching engine processes transactions in batches (no N+1 queries — all candidates fetched in a single batched call):

| Tier | Match Type | Confidence |
|------|-----------|-----------|
| 1 | Exact reference match | 1.00 |
| 2 | Exact amount within time window | 0.90 |
| 3 | Payer identifier + amount | 0.75 |
| 4 | AI fuzzy match *(Phase 5 hook)* | variable |
| 5 | Manual review queue | — |

Eight exception categories are surfaced automatically: `missing_provider_transaction`, `missing_order`, `amount_mismatch`, `duplicate_payment`, `fee_mismatch`, `settlement_delay`, `unknown_provider_reference`, `overpayment`.

Match sources are extended — the same engine handles generic orders, **expected payments**, and **pool contributions** without a separate matching system.

#### 4. Expected Payments — "Money I'm Owed"
A user creates an expected payment (`KES 3,000 from Ken, due Friday, ref: Invoice #42`) and gets a shareable pre-filled payment link/QR. When the matching transaction arrives it is auto-matched, `amount_paid_to_date` accumulates (partial payments supported), and status transitions automatically: `open → partially_paid → paid`. Overpayments land in the exception queue.

#### 5. Pooled Payments — Group Money Collection
An organiser creates a payment pool (`December chama round, KES 500 × 12 members, target KES 6,000`), pre-populates the contributor list, and shares one link/QR. Each contribution is attributed to a `pool_contributions` row. A running total vs. target is visible in real time. Once fully collected, the pool settles into the owner's balance and routes through the standard money-direction rules — no separate settlement path.

#### 6. Money-Direction Engine — Programmable Fund Routing
Users configure rules (`70 % → Loop number, 30 % → UniPay balance`) stored in `money_direction_rules`. On every settlement, the `MoneyDirectionEngine` deterministically calculates allocations in `priority_order`, creating idempotent `payouts` rows per rule. Rule changes take effect on the *next* settlement — already-routed funds are never touched retroactively.

#### 7. Fee Transparency
Every transaction surface shows: `Net = Amount − Provider Fee − Platform Fee − Tax`, broken down pre-confirmation in checkout and per-row on the transaction ledger.

#### 8. Security Baseline
- JWT validation (local, not introspection — low-latency, high-throughput)
- PII redaction on every log line (`phone`, `email`, `ID numbers`, `document URLs` → `[REDACTED]`)
- Circuit breaker (closed → open → half-open) wrapping every adapter call with retry-with-jitter
- Idempotency keys on all write endpoints that could be retried

---

## ✅ Demo Recording

> *A 3-minute screen capture.*

🎬 **[INSERT LOOM / VIDEO LINK HERE]**

**Demo script (§27 narrative):**
1. Amina (business) signs up → submits ID → verification status: `submitted`
2. Customer Ken pays via LOOP STK push → webhook arrives → transaction normalized
3. Reconciliation engine auto-matches against Amina's open expected payment
4. Amina's dashboard: AI query box → *"how much did I make this week?"*
5. AI explains the fuzzy match in plain language
6. Amina adjusts her money-direction split (70 / 30)
7. CSV export — no ID numbers, no document URLs
8. Admin panel: exception queue, rail toggle, audit log

---

## ✅ Technical Snapshot

> *APIs consumed, architecture & language used.*

### Language & Runtime

| Layer | Technology |
|-------|-----------|
| Backend API | **Node.js 20 · Express · TypeScript** |
| Frontend | **Expo (React Native + TypeScript)** · Expo Router · NativeWind |
| Database | **PostgreSQL via Supabase** |
| Auth | **Clerk** (`@clerk/clerk-expo` + backend JWT verification) |

### APIs Consumed

| API | Purpose | Endpoints Used |
|-----|---------|----------------|
| **LOOP (NCBA) Sandbox** | Mobile money collection & payout | `POST /merchant/request-to-pay` · `GET /merchant/query` · `POST /merchant/payout` · `POST /oauth/token` |
| **Clerk** | Universal auth (individual + business) | Clerk SDK — JWT issuance & session management |
| **Supabase / PostgreSQL** | Persistent data store | Raw `pg` pool (transaction-mode PgBouncer compatible) |

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│            Expo App  (Web / iOS / Android)               │
│  Checkout · Dashboard · Pool Tracker · Settings          │
└────────────────────────┬────────────────────────────────┘
                         │  REST / JSON
┌────────────────────────▼────────────────────────────────┐
│         Express API  (Node.js · TypeScript)               │
│  Clerk JWT middleware · Rate limiting (token bucket)      │
│  34 versioned endpoints  (/api/v1/...)                   │
│  Structured JSON logging · trace_id propagation          │
└──┬──────────┬──────────┬──────────┬───────────┬─────────┘
   │          │          │          │           │
   ▼          ▼          ▼          ▼           ▼
Adapter   Payment    Reconcil-  Money-Dir   Outbox
Registry  Intent     iation     Engine      Service
   │      Service    Engine
   │
   ├─── LoopAdapter ──────► LOOP Sandbox API
   └─── SeededAdapter ─────► Static fixtures (labeled simulated)

┌─────────────────────────────────────────────────────────┐
│                  PostgreSQL (Supabase)                    │
│  payment_rails · reconciliation_matches                  │
│  reconciliation_exceptions · money_direction_rules       │
│  payouts · outbox_events                                 │
└─────────────────────────────────────────────────────────┘
```

### Key Engineering Patterns

| Pattern | Where applied |
|---------|--------------|
| **Adapter Pattern** | `PaymentProviderAdapter` interface — new rail = new DB row + adapter class |
| **Outbox Pattern** | Durable event publishing across settlement → reconciliation boundary |
| **Circuit Breaker** | 3-state (closed/open/half-open) wrapping every LOOP API call |
| **Idempotency Keys** | `UNIQUE` constraint on `payment_intents.idempotency_key` and `payouts.idempotency_key` |
| **Batch Reconciliation** | Single SQL fetch for all candidates; in-memory match; batch persist (zero N+1) |
| **Deterministic Money Math** | All amounts as `numeric(14,2)`; cent remainders reconciled to last allocation |

### Database Schema (key tables)

| Table | Purpose |
|-------|---------|
| `payment_rails` | Config-driven rail catalogue (enabled, currencies, amounts, capabilities) |
| `reconciliation_matches` | Match results — source, type, confidence score, AI explanation |
| `reconciliation_exceptions` | 8-category exception queue with `open/resolved/ignored` lifecycle |
| `money_direction_rules` | User-defined fund routing rules (percentage / fixed / full) |
| `payouts` | Per-allocation disbursement records, idempotency-keyed |

---

## ✅ Target Market

> *Who wants this? Existing customer feedback, support tickets or competitive pressure.*

### Primary Segments

**1. Kenyan SMEs (primary)**
- ~600,000 registered small businesses
- Pain: manual reconciliation at end of day; no settlement-timing visibility; no payout automation
- Competitive gap: LOOP's existing merchant dashboard shows transactions but lacks reconciliation, fund routing, or pooled collection

**2. Group Organisers — Chamas & Harambees**
- Millions of informal savings groups across Kenya
- Pain: WhatsApp-based tracking, no contribution attribution, partial payments lost
- Existing tools: none purpose-built — organisers use M-Pesa screenshots + spreadsheets

**3. Freelancers & Gig Economy Workers**
- Need expected-payment tracking ("I invoiced KES 3,000 — has Ken paid?")
- Need auto-routing ("30 % always to savings")
- Currently: bank statements + manual cross-referencing

### Competitive Landscape

| Competitor | Gap UniPay fills |
|-----------|-----------------|
| LOOP Dashboard | No reconciliation engine, no fund routing, no pooled payments |
| M-Pesa Till | No reconciliation, no expected-payment tracking, single rail |
| Wave / Kopo Kopo | B2B focus only, no pooled collection, no programmable routing |

### Signal
- The Loop hackathon brief explicitly names reconciliation and payouts as underserved use cases
- SME churn from payment platforms most commonly cites inability to reconcile what's settled vs. what's pending
- Chama organisers in Kenya represent ~4 million active participants with an estimated KES 300B under management annually

---

## ✅ Team Roster

> *Who built it, and who would champion it forward?*

| Role | Owns |
|------|------|
| **Dev A — Platform & Identity Lead** | Auth (Clerk), DB scaffold, security baseline, PII redaction logging, 34 API stubs |
| **Dev B — Payments & Rails Engineer** | LOOP adapter, payment lifecycle, reconciliation engine, money-direction, disbursement, outbox |
| **Dev C — Intelligence Engineer** | AI Service (`explainMatch`, `answerDashboardQuery`), audit logging of all AI outputs |
| **Dev D — Product Surface Engineer** | Expo app, checkout UI, unified dashboard, admin module, responsive UX |

**Champion forward:** Dev B owns the core differentiators (reconciliation engine, money-direction, expected payments, pooled payments, LOOP integration). Dev A holds the security and data model. All four are required for Phase 9 production hardening.

---

*Built on the Loop (NCBA) Developer API · Sandbox: `https://sandbox.loop.co.ke`*  
*Stack: Node.js 20 · TypeScript · Express · PostgreSQL (Supabase) · Expo (React Native) · Clerk*
