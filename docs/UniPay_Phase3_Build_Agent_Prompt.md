# UniPay — Phase 3 Build Agent Prompt (LOOP Integration & Payment Lifecycle)

Paste this whole document to the coding agent as its task. Unlike the Phase 2 prompt, this
one does **not** hand you a pre-verified table of what exists in the repo — Phase 2 may have
landed exactly as specified, partially, or with drift. **Step 0 below is mandatory and comes
before any other work.** Do not skip it, do not take a prior status report (including this
document's own references to "Phase 2 is done") on faith — verify directly against the
repository.

---

## Step 0 — Confirm what's already present (do this first, report before proceeding)

Before writing or editing anything, audit the repository and produce a short written status
report covering the items below. If any Phase 2 Definition-of-Done item is **not** actually
true, stop and fix or flag it before starting Phase 3 — Phase 3 builds directly on top of
the adapter interface, the circuit breaker, and the `payment_rails` table, and building
LOOP integration against a broken foundation just relocates the bug.

**Verify Phase 2 is actually complete, not just reported complete:**
- [ ] Open `shared/src/adapters.ts` — confirm the `PaymentProviderAdapter` interface matches
      §10 exactly (`name`, `capabilities`, `createPayment`, `getStatus`, `refund`,
      `disburse`, `normalize`, `verifyWebhook`) and that `NormalizedTransaction` matches the
      `transactions` table columns in §11 / `UniPay_Schema_Documentation.md`.
- [ ] Confirm `backend/src/adapters/seeded-rail-adapter.ts` (or wherever it landed) exists
      and implements that interface.
- [ ] Confirm a circuit-breaker/retry-with-jitter wrapper exists and is actually invoked
      around adapter calls — find it and note its location and how it's invoked (middleware,
      decorator, explicit wrapper function, etc.), since Phase 3's LOOP adapter must be
      wrapped by the same mechanism, not a second one.
- [ ] Confirm the `payment_rails` migration exists, is applied, and has a `seeded` row with
      `is_enabled: true`. Note its exact file path and naming convention — Phase 3's `loop`
      row and any new migrations must match that convention.
- [ ] Confirm `POST /api/v1/checkout/payment-options` is a real, working endpoint (not the
      old `501` stub) and note exactly which file/route it lives in now.
- [ ] Note the test framework/conventions used in Phase 1 and Phase 2's test files (setup,
      fixtures, assertion style) so Phase 3's tests match rather than diverge.

**Inventory what already exists for Phase 3 specifically** (don't assume greenfield —
report findings even if the answer is "nothing found"):
- [ ] Does a `payment_intents` table/migration already exist? (§11 shape below.) If yes,
      note its current columns and whether they match spec.
- [ ] Does a `transactions` table/migration already exist? If yes, same check.
- [ ] Does anything already exist under `backend/src/adapters/` referencing LOOP (a stub
      file, partial implementation, credentials placeholder)?
- [ ] Is there an existing webhook route (e.g. `POST /api/v1/webhooks/loop`) — even a stub?
- [ ] Are LOOP sandbox credentials/env vars already present anywhere (`.env.example`, config
      files)? Do not hardcode or commit real secrets regardless of what you find.
- [ ] Check for any existing idempotency-key handling pattern in the codebase (Phase 1's
      auth/profile routes may already have one) — reuse it rather than inventing a second
      pattern if one exists.

Report all of the above in plain text before writing code. If something in the "already
exists" list turns out to be more complete than expected, adjust the task list below
accordingly rather than overwriting working code just to match this document literally.

---

## Who you are and what you're building

You are **Dev B, Payments & Rails Engineer**, executing **Phase 3 — LOOP Integration &
Payment Lifecycle** of UniPay v4.0. This phase makes the collection side of a real payment
rail work end-to-end: LOOP sandbox auth, the NEO Merchant Request-to-Pay flow, webhook and
polling-based status updates, and normalization into the ledger — all behind the
`PaymentProviderAdapter` interface Phase 2 built.

**This phase is where the Phase 2 abstraction gets tested against reality.** Sandbox
flakiness, undocumented edge cases, and auth quirks are expected — that's exactly why Phase
2 was proven against fixtures first. If you find yourself wanting to special-case LOOP
behavior outside the adapter file to make something work, that's a signal the adapter
contract needs a documented change, not a workaround — flag it rather than quietly
bypassing §9b's "no rail-specific logic leaks upward" rule.

**Disbursement (`disburse()` wired into an actual payout flow) is explicitly out of scope.**
You may implement `disburse()` on the LOOP adapter if the sandbox makes it easy to do
alongside the rest of the adapter, but do not build the payout orchestrator, the `payouts`
table, or any UI/route that calls it — that's a later phase (disbursement + money-direction
routing). If implementing `disburse()` now would take meaningfully longer than the collection
methods, skip it and leave a clear `// TODO(disbursement-phase)` instead.

Ground truth this phase draws from: **§10** (LOOP Adapter description), **§12** (Payment
Lifecycle), **§13** (Fees & Transparency), **§11** (Data model — `payment_intents`,
`transactions`, `settlements`), **§18** (API endpoints), **§19** (Authentication &
Security — webhook verification, idempotency, no PII in logs), all in
`UniPay_Technical_Documentation.pdf`, plus Handbook **M2** (Message Queues & Async Tasks —
idempotent consumers, delivery guarantees) for the webhook-handling pattern.

---

## Task list

### 1. `backend/src/adapters/loop-adapter.ts`

Implement `PaymentProviderAdapter` (Phase 2's exact interface — do not modify the interface
itself) against the real LOOP developer sandbox:

- Pull exact endpoint paths, auth headers, and request/response payloads from the LOOP
  sandbox docs **at build time** — do not assume or reconstruct them from memory or from
  this document, since none of the source documents include LOOP's actual API reference.
- `createPayment()` initiates a NEO Merchant Request-to-Pay.
- `getStatus()` polls LOOP's status endpoint as a fallback path (webhooks are primary, see
  Task 4).
- `refund()` against whatever refund capability the sandbox exposes; if the sandbox doesn't
  support refunds in this environment, implement the method to fail clearly and note the
  limitation rather than faking success.
- `normalize()` must produce the **exact same `NormalizedTransaction` shape** the seeded
  adapter already produces — this is the actual proof of Phase 2's abstraction. Write a test
  that runs both adapters' fixture/sandbox outputs through `normalize()` and asserts the
  resulting shape is structurally identical (same keys, same types) even though values
  differ.
- `verifyWebhook()` validates LOOP's real webhook signature — implement this for real, not
  as an always-`true` stub like the seeded adapter's version.
- Wrap every call using **the exact same circuit-breaker/retry-with-jitter mechanism** Phase
  2 built (per your Step 0 finding) — do not build a second resilience wrapper. Confirm the
  breaker actually engages when the sandbox is slow or errors, using whatever test hooks
  Phase 2 exposed.

### 2. `payment_intents` migration and table (§11) — only if Step 0 found it missing

```
payment_intents
  id, recipient_profile_id, order_reference, amount, currency,
  payer_phone, payer_email, provider, rail, status, provider_reference,
  idempotency_key, expires_at, initiated_at, completed_at
```

- `idempotency_key` must be enforced unique at the database level, not just checked in
  application code — a race between two near-simultaneous requests with the same key must
  not create two intents.
- Match the migration file naming/structure convention identified in Step 0.

### 3. `transactions` and `settlements` migrations (§11) — only if Step 0 found them missing

```
transactions
  id, recipient_profile_id, payment_intent_id, provider, rail,
  internal_reference, external_reference, amount, currency,
  provider_fee, net_amount, payer_identifier, payment_status,
  settlement_status, refund_status, transaction_time, settled_at,
  ai_category, raw_payload

settlements
  id, profile_id, provider, settlement_reference, currency,
  gross_amount, fees, net_amount, status, expected_at, settled_at
```

- `payment_status` and `settlement_status` are tracked as **independent** fields per §12 —
  never collapse them into one status column or one UI badge.
- `raw_payload` stores the untouched provider response for audit/debugging; everything else
  in the row comes from `normalize()`'s output, never hand-picked fields pulled directly from
  the raw payload elsewhere in the codebase (that would reintroduce rail-specific logic
  outside the adapter — see §9b's rule, already enforced in Phase 2's lint/grep check).

### 4. Payment lifecycle orchestration (§12)

Build the flow: `POST /api/v1/payment-intents` creates an intent → calls the resolved
adapter's `createPayment()` → payer completes on their phone → status arrives via **webhook
first, polling as fallback**:

- `POST /api/v1/webhooks/loop`: verifies the signature via `verifyWebhook()`, deduplicates
  by webhook/event ID (a retried webhook must not create a duplicate transaction — this is
  the idempotent-consumer pattern from Handbook M2), calls `normalize()`, and writes/updates
  the `transactions` row.
- A polling fallback (cron or interval-based, matching whatever async/job pattern already
  exists in the codebase, or a simple interval poller if none does — full queue
  infrastructure is explicitly out of scope for this phase per the doc's stack notes) covers
  intents that haven't received a webhook within a reasonable window.
- `GET /api/v1/payment-intents/:id` and `POST /api/v1/payment-intents/:id/retry` per §18.
- No PII (phone numbers, emails) in logs — mask per §19, matching whatever masking pattern
  Phase 1 already established for profile data, if one exists.

### 5. Enable the real `loop` row in `payment_rails`

Only now — once the adapter exists — insert the `loop` row (`adapter_key: 'loop'`,
`is_enabled: true`, real `supported_currencies`/`supported_countries`/`capabilities_json`
matching what `capabilities()` actually returns). This is a data migration or seed script,
not a schema change (the table shape was already built in Phase 2).

### 6. Wire real fee estimates into `POST /api/v1/checkout/payment-options`

Phase 2 built this endpoint against the seeded adapter only. Now that `loop` is enabled in
`payment_rails`, the endpoint should resolve and return LOOP's real capabilities/fee
estimate per §13's `Net Amount = Amount − Provider Fee − Platform Fee − Tax` model — without
adding any `if (provider === 'loop')` branching in the endpoint itself. If the endpoint needs
new logic to do this, it belongs in the adapter or the resolution/registry layer, not in the
route handler.

### 7. Tests — `phase3.test.ts`

Match the test conventions identified in Step 0. Cover at minimum:
- Full `createPayment` → webhook → `normalize` cycle against the LOOP sandbox (or a
  recorded/mocked sandbox response if live sandbox calls aren't reliable enough for CI —
  document which you chose and why).
- Webhook signature verification rejects an invalid signature.
- Webhook deduplication: replaying the same event ID does not create a duplicate
  transaction.
- Idempotency key on `POST /api/v1/payment-intents`: two requests with the same key produce
  one intent, not two.
- The structural-shape assertion from Task 1 (seeded vs. LOOP `normalize()` output).
- `payment_rails` resolution now returns both `seeded` and `loop` when both are enabled, and
  excludes either individually when disabled.

---

## Constraints that apply to this phase specifically

- **No checkout UI.** That's a later phase — this phase produces API endpoints and the
  ledger, not frontend screens.
- **No disbursement orchestration wiring**, per the scoping note above.
- **No money-direction logic.** Settled funds routing is a separate later phase.
- **Don't touch the `PaymentProviderAdapter` interface itself** unless the LOOP sandbox
  reveals it's genuinely inadequate — if so, stop, document exactly what's missing and why,
  and treat that as a decision requiring sign-off before changing a contract every other
  phase depends on.
- Keep LOOP secrets and any sandbox credentials server-side only, and never commit them —
  confirm `.env`/secrets are properly gitignored as part of Step 0 if you find real-looking
  credentials sitting in the repo.

---

## Definition of Done

Do not report this phase complete until every item below is verifiably true:

- [ ] Step 0 audit completed and reported, with Phase 2 DoD re-verified (not assumed)
- [ ] `backend/src/adapters/loop-adapter.ts` implements the full `PaymentProviderAdapter`
      interface against the real LOOP sandbox, wrapped by Phase 2's existing circuit
      breaker/retry mechanism
- [ ] A test proves `normalize()` produces a structurally identical `NormalizedTransaction`
      shape from both the seeded adapter and the LOOP adapter
- [ ] `payment_intents`, `transactions`, `settlements` tables exist and match §11, with
      `idempotency_key` uniqueness enforced at the database level
- [ ] Webhook endpoint verifies signatures for real, deduplicates by event ID (test proves a
      replayed webhook doesn't duplicate a transaction), and falls back to polling within a
      reasonable window
- [ ] `payment_status` and `settlement_status` are tracked and exposed as independent fields
      end-to-end, never collapsed
- [ ] `loop` row live in `payment_rails`, resolving correctly alongside `seeded` in the
      checkout-options endpoint with no rail-specific branching in the route handler
- [ ] No PII in logs — verified, not just assumed
- [ ] `phase3.test.ts` exists, passes, and follows the established test conventions

When every box is checked, stop. Report which items are done and hand off — do not begin
the next phase (disbursement / money-direction routing) in this session.
