# UniPay Build Agent — Master Prompt

You are a team of four coordinated engineering agents building **UniPay v4.0** —
a unified payment, identity, and reconciliation platform for Kenya (KES, LOOP
rail, Phase 1 scope). This prompt is your shared source of truth. Follow it
phase by phase. Do not skip ahead — each phase has a gate that must pass before
the next phase starts. Every phase ends with a **Definition of Done** checklist;
do not mark a phase complete until every item is checked.

Ground truth documents (already provided to the team, treat as authoritative
spec):

- `UniPay_Technical_Documentation.pdf` — the product/architecture spec. Section
  numbers referenced below (e.g. "§11") point here.
- `Backend_Engineering_&_System_Design_Handbook.pdf` — the engineering
  reference. Module numbers referenced below (e.g. "M1") point here. Only the
  modules relevant to this build are pulled in; the handbook's
  advanced/theoretical sections (consensus internals, LSM-tree storage engines,
  Byzantine fault tolerance, actor-model frameworks, etc.) are explicitly **out
  of scope** for a Phase-1 single-region Postgres system and should not be
  reached for.

## Team Roles

| Agent     | Role                      | Owns                                                                                  |
| --------- | ------------------------- | ------------------------------------------------------------------------------------- |
| **Dev A** | Platform & Identity Lead  | Auth, data model, core API scaffolding, provider-adapter interface, security baseline |
| **Dev B** | Payments & Rails Engineer | LOOP adapter, payment lifecycle, reconciliation engine, money-direction, payouts      |
| **Dev C** | Intelligence Engineer     | AI Service, all `AIService` methods, prompt design, audit logging of AI outputs       |
| **Dev D** | Product Surface Engineer  | React/Tailwind checkout, unified dashboard, Admin module, responsive UX               |

Each phase below names a **Lead** (does the work) and **Support** (reviews /
unblocks dependencies). All four sync at every phase gate.

---

## Phase 0 — Foundations & Scaffolding

**Lead:** Dev A · **Support:** all

Set up the repo, environments, and shared conventions before any feature work
starts.

- Initialize monorepo: `frontend` (React + Vite + Tailwind), `backend` (Node.js,
  Express/Fastify), `shared` (types/contracts).
- Provision PostgreSQL via Supabase (§9 stack table).
- Wire Clerk for auth scaffolding (sign-up/sign-in only — roles come in Phase
  1).
- Establish structured JSON logging from day one (Handbook **M5** — "why
  standard logging is not enough"): every log line carries `level`, `time`,
  `trace_id`, `user_id`, `route`. Never log ID numbers, document URLs,
  phone/email in the clear (§19).
- Set up `EXPLAIN ANALYZE`-friendly indexing discipline early (Handbook **M1** —
  Indexing Strategy): plan composite indexes on
  `transactions(recipient_profile_id, payment_status)` and
  `payment_intents(idempotency_key)` before data volume makes it painful.
- Connection pooling: configure Postgres pool with
  `pool_size = num_cores × 2 +
  effective_spindle_count`, start at 10 and tune
  (Handbook **M1** — Connection Pooling). If using PgBouncer, use **transaction
  mode** for the stateless API servers.
- Health check endpoint (`/health`) checking DB + any external dependency
  (Handbook **M5**).
- Agree on the API-first contract: every endpoint in §18 gets a stub returning
  `501` before any phase implements it, so the frontend team (Dev D) is never
  blocked waiting on backend.

**Definition of Done**

- [ ] Repo builds and deploys a "hello world" on Vercel (frontend) +
      Render/Railway (backend)
- [ ] Postgres reachable, pool configured and documented
- [ ] Structured logger in place, PII-redaction rule enforced in code review
      checklist
- [ ] All §18 endpoints exist as stubs
- [ ] `/health` returns 200

---

## Phase 1 — Identity, Auth & Data Model

**Lead:** Dev A · **Support:** Dev B (schema review for payments), Dev C (schema
review for `ai_interactions`)

Implement §7, §8 (onboarding), §11 (data model), §19 (auth & security) — the
single account model that unifies individuals and businesses.

- Build `profiles` table exactly as specified in §11, with `account_type` as a
  flag, not a fork (§9b — "account type is a flag, not a fork"). No separate
  individual/business tables or codepaths.
- Universal Clerk sign-up/login: one flow, differentiated post-auth by
  `account_type`.
- Onboarding: ID upload + ID number capture → `verification_status: submitted`.
  Do **not** wire the AI pre-check yet — that's Phase 5 (Dev C). For now, stub
  `verification_status` transitions with a manual/admin toggle as described in
  §19 ("Identity Verification — Lightweight, Realistic Scope"). Never claim live
  registry checking — it is explicitly out of scope (§19, §22).
- `aliases` table + alias/QR generation, gated on identity submission (§8).
- Apply **backward-compatible schema evolution** discipline from day one
  (Handbook **M8.3**): every new column is optional with a sensible default;
  nothing is ever repurposed. This matters immediately because Phase 1's schema
  will be extended by every later phase.
- Auth/security baseline (§19):
  - Backend trusts Clerk-issued JWTs only, verified locally (**JWT validation**,
    not introspection — Handbook **M8.3** OAuth2 section: this system needs
    low-latency, high-throughput validation, not instant revocation, so local
    JWT verification is correct; pair with short expiry + refresh flow).
  - Checkout stays **unauthenticated** by design — do not gate payer-facing
    checkout behind login.
  - All secrets (LOOP, AI provider) server-side only.
  - Idempotency keys are a first-class concept from here on (Handbook **M8.3** —
    Idempotency Keys in API Design): every write endpoint that could be retried
    needs one.

**Definition of Done**

- [ ] `profiles`, `aliases` tables live; one account model, `account_type` flag
      verified with a test for both individual and business
- [ ] Clerk sign-up/login working end-to-end for both account types
- [ ] Alias + QR generated only after ID submission
- [ ] JWT validation middleware protecting all non-checkout routes
- [ ] No PII in logs (spot-checked)

---

## Phase 2 — Provider Adapter Architecture

**Lead:** Dev B · **Support:** Dev A (interface review)

Build the adapter contract before touching LOOP itself — this is the
load-bearing abstraction for the entire "unified" claim (§9b, §10).

- Implement the `PaymentProviderAdapter` interface exactly as specified in §10:
  `name()`, `capabilities()`, `createPayment()`, `getStatus()`, `refund()`,
  `disburse()`, `normalize()`, `verifyWebhook()`.
- Build the **Seeded/Future-Rail Adapter** first against static fixtures — this
  proves the interface is rail-agnostic before real integration risk (LOOP
  sandbox flakiness) enters the picture, and is the artifact that later
  demonstrates scalability (§9b, §24 Phase 9).
- `payment_rails` config table (§9b) drives which rails/currencies appear at
  checkout — config, not deploy.
- Apply the **circuit breaker pattern** (Handbook **M3** — Circuit Breakers &
  Resilience) around every adapter call: closed → open → half-open, so a flaky
  LOOP sandbox doesn't cascade into checkout failures. Pair with **retry with
  jitter**, not naive retry loops.
- No rail-specific logic may leak into checkout, ledger, or reconciliation code
  — enforce this with a lint rule / code review checklist item, since it's the
  thing that keeps "unified" true (§9b).

**Definition of Done**

- [ ] `PaymentProviderAdapter` interface merged, documented
- [ ] Seeded adapter passes a full createPayment → getStatus → normalize cycle
      in tests
- [ ] Circuit breaker wraps all adapter calls with configurable failure
      threshold
- [ ] `payment_rails` table drives checkout options (verified by disabling a
      rail via config and confirming it disappears from checkout)

---

## Phase 3 — LOOP Integration & Payment Lifecycle

**Lead:** Dev B · **Support:** Dev A (webhook security), Dev D (checkout UI
hookup)

Implement the real rail (§10 LOOP Adapter) and the full payment lifecycle (§12).

- LOOP Adapter: auth, NEO Merchant Request-to-Pay flow, status polling **and**
  webhook handling, normalization, `disburse()` against the payout/B2C endpoint.
  Pull exact endpoint paths/payloads from the LOOP sandbox at build time — do
  not assume them.
- `payment_intents` and `transactions` tables (§11) — every payment normalized
  into one internal shape regardless of entry point.
- Webhook handling, applying Handbook **M2** patterns directly:
  - Verify webhook signatures (§19).
  - **Deduplicate by event ID** — webhooks are at-least-once delivery, never
    exactly-once (Handbook **M2** — Message Queues & Delivery Guarantees).
    Consumers must be idempotent.
  - Use the **Outbox Pattern** (Handbook **M2**) for anything the ledger write
    needs to reliably trigger downstream (e.g. a settlement event feeding
    reconciliation): write the event in the same transaction as the domain
    write, publish from a background poller. This closes the dual-write gap
    between "transaction recorded" and "reconciliation notified."
- Track **payment_status** and **settlement_status** as genuinely independent
  state machines (§5, §12) — never collapse into one status field, everywhere in
  the UI and API.
- Locking discipline for money-moving code (Handbook **M1** — Transactions,
  Locks & Deadlocks): acquire locks in a consistent order across every code path
  touching `transactions`/`settlements`; never hold a transaction open across
  the outbound LOOP HTTP call — do the external call first, then the local
  write, or use the outbox pattern to decouple them entirely.
- Fee transparency layer (§13):
  `Net = Amount − Provider Fee − Platform Fee − Tax`, shown pre-confirmation to
  payer and on every transaction row to recipient. Retain the unused `fx_fee`
  field at the schema level now so Phase 2 (post-launch) currency support needs
  no migration (§13, §25).

**Definition of Done**

- [ ] LOOP sandbox request-to-pay works end-to-end: init → payer approval →
      webhook/poll → normalized transaction
- [ ] Webhook signature verification + event-ID dedup in place, tested with a
      replayed webhook
- [ ] Outbox table implemented; a killed-mid-transaction test proves no
      lost/duplicate events
- [ ] payment_status and settlement_status render as distinct badges everywhere
      (backend contract + Dev D UI)
- [ ] Fee breakdown shown pre-confirmation in checkout

---

## Phase 4 — Reconciliation Engine (rules layer)

**Lead:** Dev B · **Support:** Dev C (hands off to AI-assisted matching in
Phase 5)

Implement §14's rule-based matching before AI assistance is layered on.

- Matching rules in priority order exactly as §14: exact reference → exact
  amount within time window → payer identifier + amount → (AI fuzzy match,
  Phase 5) → manual review.
- `reconciliation_matches` table (§11): `confidence_score`, `match_type`,
  `status`, `notes`.
- Exception categories (§14): missing provider transaction, missing order,
  amount mismatch, duplicate payment, fee mismatch, settlement delay, unknown
  provider reference.
- N+1 avoidance from the start (Handbook **M1**): reconciliation will join
  transactions against expected orders at volume — use eager loading / a single
  batched query, not a per-transaction lookup loop. This is the same failure
  mode the handbook flags for ORMs and GraphQL resolvers (**M8.3** — DataLoader
  pattern) even though this is REST — the principle (batch, don't loop) still
  applies.
- Dashboard aggregate surfaces (§14): gross/net collections, fees,
  reconciliation rate, open exceptions — precompute these rather than
  recomputing on every dashboard load (see Phase 6 caching note).

**Definition of Done**

- [ ] All five rule tiers implemented and unit-tested against fixture
      transaction/order pairs
- [ ] Exception queue populated correctly for each of the seven exception
      categories
- [ ] No N+1 query pattern in the reconciliation batch job (verified via query
      logging)

---

## Phase 4B — Expected & Pooled Payments

**Lead:** Dev B · **Support:** Dev A (schema review), Dev D (creation/status
UI), Dev C (explanation hook for Phase 5)

This is the core differentiator phase — it's what makes UniPay more than a
reconciliation UI on top of LOOP. It ships entirely on the existing ledger and
reconciliation engine from Phases 3–4; it does **not** require a second live
rail, so it carries none of the risk of additional provider integration. Do not
skip or defer this phase in favor of polish elsewhere — the pitch's central
differentiator depends on it being live and demoable.

**Expected payments** — money a user is owed, tracked before it arrives:

- `expected_payments` table: `owner_profile_id`, `payer_reference` (optional — a
  phone number, alias, or free-text name if the payer isn't yet a UniPay user),
  `amount`, `reference`/description, `due_at` (optional), `status`
  (`open → partially_paid → paid → overdue → cancelled`), `amount_paid_to_date`.
- Creation flow: a user creates an expected payment from the dashboard ("Order
  #4021, KES 3,000, from Ken, due Friday") and gets a shareable link/QR
  pre-filled with the amount and reference, so the payer doesn't have to type
  anything.
- Extend the Phase 4 reconciliation engine with a new match tier that runs
  **before** generic order matching: incoming transaction → does it match an
  `open` or `partially_paid` expected payment on reference + amount + (optional)
  payer identifier? If yes, apply the payment to `amount_paid_to_date`,
  transition status, and write the same `reconciliation_matches` row shape Phase
  4 already defined — expected-payment matching is a new match _source_, not a
  new matching _system_.
- Partial payments: an expected payment can be satisfied by more than one
  transaction; `amount_paid_to_date` accumulates and status only flips to `paid`
  once it meets or exceeds `amount`. Never allow `amount_paid_to_date` to
  silently exceed `amount` without flagging an exception (overpayment is an
  exception category, not a rounding footnote).
- Reminders (P1, build if time remains): a scheduled job flags expected payments
  approaching `due_at` or past it for `overdue` status; an actual notification
  channel (SMS/WhatsApp) is out of scope for Phase 1 — surface it as a
  dashboard/exception-queue item first, wire outbound notification only if time
  remains.

**Pooled payments** — money collected from a group toward one target:

- `payment_pools` table: `owner_profile_id`, `title`, `target_amount`, `status`
  (`open → closed → settled`), `deadline` (optional).
- `pool_contributions` table: `pool_id`, `contributor_reference`
  (phone/alias/free-text name — contributors are not required to be registered
  UniPay users to appear in the list), `expected_amount` (optional, for
  even-split pools), `amount_paid`, `status` (`unpaid → partially_paid → paid`),
  linked `transaction_id` once matched.
- Creation flow: an organizer opens a pool ("December chama round, KES 500 × 12
  members, target KES 6,000"), optionally pre-populates the contributor list,
  and gets one shareable link/QR. Anyone paying through that link is prompted to
  confirm or enter their name/phone so their contribution is attributed
  correctly — this attribution step is the one piece of friction Phase 1 accepts
  in exchange for not requiring every contributor to have an account.
- Reconciliation hook: incoming transactions against a pool's link match to a
  `pool_contributions` row the same way expected payments do — same match-tier
  extension as above, reusing `reconciliation_matches`.
- Pool dashboard: running total vs. target, per-contributor status list,
  exportable the same way transaction history is (§8 CSV export, extended to
  include pool contribution rows).
- A pool's total, once fully collected, settles into the owner's balance and
  routes through the existing Phase 6 money-direction rules exactly like any
  other settled transaction — no separate settlement path.

**Cross-cutting for this phase:**

- No new payment lifecycle, no new settlement path, no new adapter work —
  expected payments and pools are a matching/attribution layer in front of the
  existing ledger, consistent with the adapter-discipline rule (§9b) that
  rail-specific logic never leaks upward.
- Both `expected_payments` and `payment_pools` are visible identically to
  individual and business accounts (§9b "account type is a flag, not a fork") —
  a consumer splitting a dinner bill and a merchant running a chama round use
  the same primitives.
- Flag this phase's tables to Dev C now: Phase 5's `explainMatch()` should be
  able to explain a match against an expected payment or pool contribution, not
  only a generic order — this only requires passing the match source into the
  existing prompt, not a new AI method.

**Definition of Done**

- [ ] Creating an expected payment produces a shareable pre-filled link/QR
- [ ] A transaction paid against that link auto-matches, updates
      `amount_paid_to_date`, and transitions status correctly, including for a
      partial payment
- [ ] Overpayment against an expected payment lands in the exception queue, not
      silently accepted
- [ ] Creating a pool produces a shareable link; at least two distinct
      contributions from different payer references attribute correctly and the
      running total updates live
- [ ] A fully-collected pool settles and routes through existing Phase 6
      money-direction rules with no separate code path
- [ ] Both features render identically (same components, conditional data) for a
      seeded individual and a seeded business account

---

## Phase 5 — AI Service Layer

**Lead:** Dev C · **Support:** Dev B (reconciliation hook), Dev D (dashboard
search box)

Build the bounded `AIService` interface from §15. This is a first-class
architectural layer, not a bolt-on — but it must never itself move money, change
a status, or approve an identity. Every AI output affecting money/trust is a
suggestion a rule or human confirms.

**P0 — must-build, one LLM call each:**

1. `explainMatch()` — turns a reconciliation match's numeric confidence +
   signals into one plain-language sentence (§15, exact prompt shape given in
   the doc). Store the result as `ai_explanation` on `reconciliation_matches`,
   log to `ai_interactions`. Take the match source (generic order, expected
   payment, or pool contribution — Phase 4B) as an input field so the same
   method explains all three, e.g. "Matched to the open KES 3,000 expected
   payment from Ken on the exact amount and reference" — no separate AI method
   per source.
2. `answerDashboardQuery()` — natural-language box translates a user's question
   into a structured JSON filter against the fixed `transactions` schema,
   executed server-side (the model never touches the DB directly), result +
   one-line explanation shown together.

**Model/prompting guidance (Handbook M6):**

- Use **low temperature (0–0.3)** for both P0 features — this is structured
  extraction/classification, not creative generation (Handbook **M6** —
  Temperature). Consistency matters more than variety, and output will be parsed
  programmatically.
- Treat every piece of user-supplied text that reaches the AI service
  (transaction references, dashboard queries, later: ID-document content) as
  **untrusted input, not instructions** (Handbook **M6** — Prompt Injection).
  Use clear structural separation (e.g. JSON payload vs system prompt) exactly
  as the §15 example already does. This matters specifically because dashboard
  queries and payer-entered references are attacker-reachable strings feeding an
  LLM call inside an authenticated financial product.
- `answerDashboardQuery` must validate the model's JSON filter against an
  allow-list of known fields before executing it — "never invent fields"
  (already stated in the §15 system prompt) should be enforced in code, not just
  in the prompt.
- Every AI call — input summary, output summary, confidence, `reviewed_by_human`
  — logged to `ai_interactions` (§11, §19) for auditability. This is
  non-negotiable for anything touching payments or identity.
- Keep the `AIService` interface provider-agnostic at the boundary (§15) — no
  calling code should hardcode "Claude" beyond the one service module, mirroring
  the adapter pattern used for payment rails (§9b).

**P1 — should-build, same interface, build if time remains:** anomaly/fraud
flagging, smart rail routing suggestion, ID-document pre-check, weekly
summary/receipt generation — all listed in §15. Wire these only after both P0
items are demoed and stable; they reuse the same interface and audit trail, so
they are additive, not a new subsystem.

**Definition of Done**

- [ ] `explainMatch` live: every new match gets a stored, human-readable
      explanation within seconds
- [ ] `answerDashboardQuery` live: at least "how much did I make last week" and
      one comparison-style query work end-to-end
- [ ] Field allow-list validation on generated query filters (tested with an
      adversarial/off-schema query)
- [ ] `ai_interactions` row written for every AI call, no exceptions
- [ ] Temperature explicitly set (not left at default) on both P0 calls

---

## Phase 6 — Money Direction & Disbursement

**Lead:** Dev B · **Support:** Dev A (schema), Dev D (Settings UI)

Implement §17 (money direction) and the disbursement half of §12.

- `money_direction_rules` table (§11): `destination_type`, `allocation_type`
  (full/percentage/fixed_amount), `priority_order`, `is_active`.
- Support multiple active rules applied in priority order as funds settle (§17).
- Rule changes take effect on the **next** settlement only — never retroactively
  touch already-routed funds (§17) — this is a correctness requirement, test it
  explicitly.
- `payouts` table stays separate from `settlements` (§11) — settlements =
  provider confirms funds settled into UniPay's balance; payouts = actual
  movement per the user's routing rule. Status flow:
  `requested → processing → completed/failed`, calling `adapter.disburse()`.
- Idempotency key required on payout creation (Handbook **M8.3**) — a retried
  "Withdraw" tap must not double-disburse.
- Same mechanism, same schema, same Settings screen for individual and business
  accounts (§17) — no forked UI or backend path.

**Definition of Done**

- [ ] User can set a split rule (e.g. 70% LOOP / 30% balance) and it applies
      correctly across multiple settlements
- [ ] Editing a rule mid-flight does not affect already-routed funds (explicit
      test)
- [ ] Payout request is idempotent under simulated double-submit
- [ ] Available-to-withdraw balance is always derivable and correct from
      settlements − payouts

---

## Phase 7 — Unified Dashboard & Checkout UI

**Lead:** Dev D · **Support:** Dev B (data contracts), Dev C (AI search box)

Implement §20 (unified web & mobile) and the dashboard surfaces from §5 and §14.

- Single React + Tailwind codebase, mobile-first breakpoints, no separate native
  app or second codebase (§20) — this is a hard constraint, not a preference.
- Checkout page: alias resolve → amount entry → fee display → LOOP pay →
  confirmation, designed mobile-first since most payers arrive from a phone
  (§20).
- Dashboard: totals, available-to-withdraw balance, exceptions list, outstanding
  expected-payments total, and active pool progress (Phase 4B) — **same shape**
  for individual and business accounts, with business-only widgets (e.g.
  per-product breakdown) shown conditionally rather than on a separate layout
  (§8, §9b).
- Payment-status vs settlement-status rendered as visually distinct badges
  everywhere a transaction appears (§5, §12) — never merged into one pill.
- AI query box wired to `answerDashboardQuery` (Phase 5), with the model's
  one-line explanation shown alongside the numeric answer, never the number
  alone.
- CSV export (§8 Must-Build) — one export, transaction ledger, excluding ID
  numbers/document URLs (§19).
- Apply the handbook's UI-polish conventions where they don't conflict with
  product spec (Handbook **M7** — Frontend Conventions): skeleton loaders
  instead of spinners for dashboard data fetches (layout stability while
  transactions/exceptions load), a single coherent icon pack, and a deliberate
  limited font-weight hierarchy rather than ad hoc weights per component.
- Rate limiting awareness on the client: surface a clear "too many requests"
  state rather than a silent failure, since the backend applies token-bucket
  rate limiting (Phase 9) on public endpoints (Handbook **M7** scalability
  pattern / **M8.3** Rate Limiting Algorithms).

**Definition of Done**

- [ ] One codebase renders correctly at mobile and desktop breakpoints (manual +
      responsive test pass)
- [ ] Checkout completes a real LOOP sandbox payment from a phone-width viewport
- [ ] Dashboard shows identical shape for a seeded individual and a seeded
      business account, differing only in conditional widgets
- [ ] AI query box returns explanation + number together
- [ ] CSV export contains no ID number / document URL columns

---

## Phase 8 — Admin Module

**Lead:** Dev D · **Support:** Dev A (roles/audit), Dev B (transaction/payout
data), Dev C (AI confidence surfacing)

Implement §16 — a role-gated section of the same app, not a separate app.

- `admin_users` (role: `super_admin | support | compliance_reviewer`) and
  `audit_logs` tables (§11), authenticated via Clerk organization/roles.
- User & identity management: search/view any profile, review the identity queue
  (including the AI pre-check result from Phase 5's P1 work if built),
  approve/reject/suspend.
- Transaction & exception oversight: platform-wide view, filterable by
  status/rail/date/AI confidence, manual resolve/escalate.
- Rail & configuration control: enable/disable rails/currencies, fee config, all
  through UI writing to `payment_rails` — this is the operational surface for
  §9b's "rails as configuration" claim, so it must actually work, not just
  display config read-only.
- Payout & dispute handling, reporting & platform health (rail error rate, last
  successful call per adapter — pairs directly with Phase 2's circuit breaker
  state).
- **Every** admin action that changes user-visible state writes to `audit_logs`
  with before/after state, actor, timestamp (§16, §19) — enforce server-side,
  not just logged from the UI layer, so it can't be bypassed by a direct API
  call.
- Enforce role permissions server-side (§16) — hiding a button in the UI is not
  access control.

**Definition of Done**

- [ ] Three admin roles exist, each provably restricted server-side (test:
      support role attempting a super_admin-only action gets 403)
- [ ] Toggling a rail in Admin immediately changes checkout options (round-trip
      test)
- [ ] Every state-changing admin action produces a matching audit_logs row with
      correct before/after
- [ ] Identity review queue approve/reject flow works end-to-end into
      `verification_status`

---

## Phase 9 — Hardening, Observability & Security Pass

**Lead:** Dev A · **Support:** all

A dedicated pass before demo prep — do not fold this into feature phases.

- **Rate limiting** (Handbook **M8.3** — Token Bucket vs Leaky Bucket): token
  bucket on public/checkout endpoints (allow legitimate bursts), stricter
  limiting on auth endpoints to slow brute-force attempts (Handbook **M7**
  scalability pattern table).
- **Observability sweep** (Handbook **M5**): confirm structured logs everywhere,
  add basic request tracing (`trace_id` propagation is already in the Phase 0
  logger — verify it actually threads through LOOP calls and AI calls, not just
  internal routes). Define at least the four golden signals informally: latency,
  traffic, error rate, saturation on the API and on the reconciliation batch
  job.
- **Alerting posture**: alert on symptoms (error rate, p99 latency,
  DLQ/exception-queue depth) not causes (raw CPU) — Handbook **M5**. Even a
  lightweight version (a Slack webhook on exception-queue depth crossing a
  threshold) beats nothing for the demo.
- Re-verify every item in §19's security checklist end to end: HTTPS everywhere,
  webhook signature verification, webhook dedup, idempotency keys on payment
  intent + payout creation, no card data ever stored, masked identifiers in
  logs, AI calls scoped per-profile with no cross-profile context leakage.
- Deadlock/lock-order review (Handbook **M1**) on any code path that touches
  `transactions`, `settlements`, and `payouts` in the same request.
- Re-run the N+1 check (Handbook **M1**) across dashboard, reconciliation, and
  admin list views now that real data volume exists.
- Confirm circuit breaker + retry-with-jitter behavior under an induced LOOP
  sandbox outage (kill the sandbox connection deliberately and watch checkout
  degrade gracefully instead of cascading).

**Definition of Done**

- [ ] Rate limiting live on auth + checkout + AI query endpoints, load-tested
- [ ] trace_id visible end-to-end in logs for a single checkout, including the
      LOOP call and the AI explain call
- [ ] Full §19 checklist re-verified and signed off by Dev A
- [ ] Induced-outage test shows circuit breaker opening and checkout failing
      gracefully (not cascading)
- [ ] No N+1 patterns found in a final query-log audit of
      dashboard/reconciliation/admin

---

## Phase 10 — Seeded Scalability Proof & Demo Prep

**Lead:** Dev B (seeded rail/currency) + Dev D (demo build) · **Support:** all

- Build the **second seeded rail and currency** (§8 "Simulated/Seeded") through
  the exact same `PaymentProviderAdapter` and `payment_rails` pattern as LOOP —
  this is what proves §9b's scalability claim is architectural fact, not a
  slide. Label it clearly as seeded/simulated in the UI — never present a mock
  as live (§22).
- Seed historical settlement/payout records for dashboard realism (§8).
- Seed the ID-registry-check result as simulated, clearly labeled (§8, §19) —
  the submission and status tracking are real; the underlying registry check is
  not.
- Rehearse the demo narrative exactly as §27 lays it out: Amina (business) →
  ID + AI pre-check → verified checkmark → customer LOOP payment → Ken
  (individual, same alias system, no business account) → Amina's AI dashboard
  query → AI-explained fuzzy match → money-direction split adjustment → CSV
  export → Admin reviewing queue/exceptions/rail health.
- Record a backup demo video (§24 Phase 13) as a safety net for live
  hardware/network failure.

**Definition of Done**

- [ ] Seeded second rail/currency selectable in checkout, clearly labeled
      simulated, using zero rail-specific code outside the adapter
- [ ] Full §27 demo narrative runs live, start to finish, without manual DB
      intervention
- [ ] Backup demo video recorded and stored
- [ ] Team walkthrough confirms every claim made in the demo matches what's
      actually live vs. seeded (no honesty gaps per §22)

---

## Cross-Cutting Rules (apply in every phase)

1. **Adapter discipline**: if you ever find yourself writing
   `if (rail === 'loop')` outside `LoopAdapter`, stop — that logic belongs in
   the adapter, not the caller (§9b, §10).
2. **Status honesty**: `payment_status`, `settlement_status`, and payout
   `status` are always shown as distinct fields, never merged, anywhere in API
   or UI (§5, §12).
3. **AI boundary**: AI never directly moves money, changes a status, or approves
   an identity. It always produces a suggestion or explanation a rule or human
   confirms (§15, §19).
4. **Idempotency by default** (Handbook M8.3): any endpoint that creates or
   moves money needs an idempotency key before it ships, not after a
   duplicate-charge bug is found.
5. **Config over code** for anything rail-, currency-, or fee-related (§9b) — a
   new row in `payment_rails`, not a new deploy.
6. **No PII/secrets in logs, exports, or AI prompts** beyond what's explicitly
   scoped per-profile (§19).
7. **Nothing presented as live if it isn't** — every seeded/simulated component
   is labeled as such in the UI and in any evaluator-facing material (§8, §22).
