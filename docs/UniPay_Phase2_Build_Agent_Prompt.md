# UniPay — Phase 2 Build Agent Prompt (Codebase-Aligned)

Paste this whole document to the coding agent as its task. It supersedes the generic Phase 2
description in `UniPay_Build.md` by pinning every task to the **actual current state of the
repository**, confirmed by audit immediately before this prompt was written. Do not assume
anything about the codebase beyond what's stated below — verify with `view`/`grep` before
editing.

**Prerequisite — confirmed done:** Phase 1 (Identity, Auth & Data Model) is complete —
22/22 tests passing. `profiles`/`aliases` tables live via `migrations/0002_phase1_identity.sql`,
Clerk auth working for both account types, alias/QR gated on identity submission. Do not
re-touch Phase 1 files except where this phase explicitly requires it (none do).

---

## Who you are and what you're building

You are **Dev B, Payments & Rails Engineer**, executing **Phase 2 — Provider Adapter
Architecture** of UniPay v4.0. This phase builds the interface every payment rail — LOOP
today, anything else later — must implement identically, so checkout, the ledger, and
reconciliation never contain rail-specific logic.

**This is the single most load-bearing abstraction in the whole system.** If this interface
is wrong, incomplete, or gets bypassed anywhere, §9b's "one identity, any rail" claim
becomes false, and every later phase (LOOP integration in Phase 3, disbursement in Phase 6,
the seeded second-rail proof in Phase 10) inherits the damage.

**Your job in this phase is the contract and a fixture-backed proof of it — not LOOP
itself, and not the checkout endpoint's business logic.** No real LOOP sandbox calls in this
phase (that's Phase 3, deliberately sequenced after the interface is proven against fixtures
you fully control).

Ground truth this phase draws from: **§9b**, **§10**, **§11** of
`UniPay_Technical_Documentation.pdf`, and **Handbook Module 3 — Circuit Breakers &
Resilience** (`Backend_Engineering___System_Design_Handbook.pdf`).

---

## Current codebase state (verified by audit — read before touching anything)

Do not assume greenfield. The following already exists and must be **replaced or extended**,
not duplicated:

| Path | Current state | What this phase must do to it |
| --- | --- | --- |
| `shared/src/adapters.ts` | A Phase 0 preliminary stub with a *different* method set (e.g. `initiatePayment(...)` instead of `createPayment(...)`) and no `ProviderCapabilities`/`NormalizedTransaction` types matching §11's `transactions` columns | Replace the interface and all supporting types wholesale with the exact §10 shape (Task 1 below). This is a breaking rename — grep the repo for every current call site before deleting the old shape so nothing is silently orphaned. |
| `backend/src/adapters/` | Directory exists but is empty — no adapter implementations yet | Add `seeded-rail-adapter.ts` (Task 2) implementing the new `shared/src/adapters.ts` contract. |
| `migrations/` | Contains `0001_*` (scaffolding) and `0002_phase1_identity.sql` (profiles/aliases). No `payment_rails` migration exists. | Add `migrations/0003_payment_rails.sql` following the existing migration file-naming and structure convention already established by `0002_phase1_identity.sql` (check that file's header/style before writing the new one). |
| `backend/src/.../stubs.ts` | `POST /api/v1/checkout/payment-options` currently returns `501 Not Implemented` as a placeholder | Build the real resolution path behind it: query `payment_rails` → resolve enabled adapters for the requested currency/country → return their capabilities. Move this route out of `stubs.ts` into wherever Phase 1's real routes live (match existing routing conventions — check how the `profiles`/`aliases` routes are organized and mirror that). |
| Tests | No `phase2.test.ts` exists | Create it, following the same test framework/setup/assertion style as Phase 1's test suite (find and match that file's conventions before writing new tests — don't introduce a second testing pattern). |
| Circuit breaker / resilience | Nothing implemented anywhere in the codebase | Build from scratch per Task 4. |

If anything in this table has drifted since the audit (e.g. someone already started one of
these), stop and re-verify with `view`/`grep` rather than trusting this table blindly — it
reflects the state at prompt-authoring time, not necessarily right now.

---

## Task list

### 1. Replace `PaymentProviderAdapter` in `shared/src/adapters.ts`

Implement exactly this contract, discarding the old Phase 0 method names:

```typescript
interface PaymentProviderAdapter {
  name(): string;
  capabilities(): ProviderCapabilities;
  createPayment(request: PaymentRequest): Promise<ProviderPaymentResult>;
  getStatus(providerReference: string): Promise<ProviderStatusResult>;
  refund(request: RefundRequest): Promise<ProviderRefundResult>;
  disburse(request: DisbursementRequest): Promise<ProviderPayoutResult>;
  normalize(payload: unknown): NormalizedTransaction;
  verifyWebhook(req: Request): boolean;
}
```

- Do not add, remove, or rename methods without a strong reason documented in the PR —
  every future rail and every calling code path (checkout, Phase 3's LOOP work, Phase 6's
  disbursement, Phase 10's second-rail proof) is written against this exact shape.
- Define all supporting types (`ProviderCapabilities`, `PaymentRequest`,
  `ProviderPaymentResult`, `ProviderStatusResult`, `RefundRequest`, `ProviderRefundResult`,
  `DisbursementRequest`, `ProviderPayoutResult`, `NormalizedTransaction`) in this same
  `/shared` file — one source of truth for both backend and any future tooling. Don't
  duplicate them inside `backend/src/adapters/`.
- `NormalizedTransaction` must match the `transactions` table's columns (§11 /
  `UniPay_Schema_Documentation.md`): `provider`, `rail`, `internal_reference`,
  `external_reference`, `amount`, `currency`, `provider_fee`, `net_amount`,
  `payer_identifier`, `payment_status`, `settlement_status`, `refund_status`,
  `transaction_time`, `raw_payload`. Cross-check field names/types against the schema doc
  directly rather than retyping from memory.
- Before deleting the old interface, `grep -r "initiatePayment"` (and any other old method
  names) across the repo and update or flag every call site — don't leave dangling
  references that only surface as a runtime error later.
- Identity verification does **not** belong in this interface — it has its own service
  (Phase 1's manual toggle, Phase 5's AI pre-check). Don't bolt an identity method onto
  `PaymentProviderAdapter` for convenience.

### 2. `backend/src/adapters/seeded-rail-adapter.ts` — build this first, before any LOOP code

Implement the new interface against static, fully-controlled fixtures:

- `createPayment()` returns a fixture result after a short simulated delay (async, not
  synchronous — callers should never accidentally rely on synchronous timing).
- `getStatus()` returns a fixture status configurable per test case (pending → successful,
  pending → failed, etc.) so downstream code can be tested against every transition.
- `normalize()` on this adapter's fixture payloads must produce the exact same
  `NormalizedTransaction` shape the LOOP adapter will produce in Phase 3 — this is the real
  test of the abstraction, not just "does this adapter return something."
- `disburse()` and `refund()` follow the same fixture pattern.
- `verifyWebhook()` can return `true` unconditionally (no real webhook to verify for a
  seeded rail), but the method must still exist and be called the same way a real adapter's
  would be.
- Build with the same care as a real provider integration — realistic latency simulation,
  configurable failure modes, no "toy" shortcuts. It's a permanent part of the system
  (referenced again in Phase 10), not scaffolding to delete later.

### 3. `migrations/0003_payment_rails.sql`

Match the existing migration file's structure/style (open `0002_phase1_identity.sql` first
and mirror its conventions: header comments, naming, up/down structure if used). Build
exactly this shape (§11):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `name` | text | Display name |
| `adapter_key` | text | **Unique** — resolves to a `PaymentProviderAdapter` via a registry/factory, not an `if/else` chain scattered through the codebase |
| `is_enabled` | boolean | |
| `supported_currencies` | text[] | |
| `supported_countries` | text[] | |
| `min_amount` | numeric(14,2) | |
| `max_amount` | numeric(14,2) | |
| `capabilities_json` | jsonb | Mirrors the adapter's `capabilities()` output |

- Seed one row for the seeded adapter (`adapter_key: 'seeded'`, `is_enabled: true`). Do not
  pre-create a `loop` row pointing at nothing — that's added in Phase 3 once the LOOP adapter
  exists.
- Build the resolution path: an adapter registry/factory in the backend that resolves
  `adapter_key` → adapter instance, plus the query "which adapters are enabled for
  KES/Kenya" against this table.

### 4. Implement `POST /api/v1/checkout/payment-options` for real

This route currently returns `501` in `stubs.ts`. Replace the stub:

- Move the route out of `stubs.ts` into the same location/pattern as Phase 1's real routes
  (check how `profiles`/`aliases` endpoints are wired and follow that convention — router
  structure, validation middleware, response shaping).
- Request/response shape per §18:
  ```json
  // Request
  { "alias": "@amina", "amount": 3000, "currency": "KES" }
  // Response
  {
    "provider": "loop",
    "rail": "request_to_pay",
    "amount": 3000,
    "currency": "KES",
    "estimated_fee": 15,
    "estimated_recipient_amount": 2985,
    "settlement_estimate": "instant"
  }
  ```
  Since LOOP isn't integrated yet, this phase's version resolves against the `payment_rails`
  table and returns the **seeded adapter's** capabilities/estimate — do not fabricate a
  LOOP-branded response before LOOP exists.
- This is the first real consumer of the adapter registry from Task 3 — keep it thin. No fee
  math beyond what the seeded adapter's `capabilities()` already exposes; deeper fee logic is
  Phase 3/§13 territory.

### 5. Circuit breaker + retry-with-jitter around every adapter call

Per Handbook Module 3:

- Wrap every call to `createPayment`, `getStatus`, `refund`, and `disburse` in a circuit
  breaker: **closed** (calls pass through) → **open** (fail fast without hitting the
  provider, after a configurable failure threshold) → **half-open** (limited test calls
  allowed through) → back to closed or open based on their result.
- Make the failure threshold and open-state cooldown configurable (env var or config table),
  not hardcoded — Phase 3 will need to tune this against LOOP sandbox's actual reliability.
- Pair the breaker with retry-with-jitter (not fixed-delay retry) inside the closed state's
  failure handling, before the breaker trips open.
- Test against the seeded adapter by making it fail on command (a test-only flag/fixture
  mode forcing failures) and confirm the breaker actually opens, fails fast while open, and
  attempts recovery in half-open. Prove the state machine — don't just wire the pattern and
  assume it works.
- Where this wrapper lives is your call, but it must sit *between* the adapter registry and
  every adapter method call — never inside an individual adapter file, or Phase 3's LOOP
  adapter would have to reimplement it.

### 6. Enforce "no rail-specific logic leaks upward"

- Checkout code, the ledger, and reconciliation logic (later phases) must only ever interact
  with `PaymentProviderAdapter`'s interface and `NormalizedTransaction` — never a raw
  fixture-shaped object, never an `if (provider === 'seeded')` branch outside the adapter's
  own file or the `payment_rails` config path.
- Add this as an explicit item to the code-review checklist (started Phase 0/1): "does this
  PR add rail-specific logic outside `/adapters/*`?" If tooling supports it, add a
  grep-based CI check flagging provider name strings (`'loop'`, `'seeded'`) appearing
  outside `backend/src/adapters/` and the `payment_rails` config path.

### 7. `phase2.test.ts`

- Match the existing Phase 1 test file's framework, setup/teardown, and assertion style —
  find it first and mirror it rather than introducing a second testing convention.
- Cover: full `createPayment` → `getStatus` → `normalize` cycle against the seeded adapter,
  `payment_rails`-driven resolution (including the `is_enabled = false` exclusion case), and
  the circuit breaker state machine (closed → open on repeated failure → half-open recovery
  attempt).

---

## Constraints that apply to this phase specifically

- **No real LOOP calls.** Even a "quick test" against the LOOP sandbox belongs in Phase 3.
- **No ledger writes beyond what Task 4's endpoint needs to read.** The `transactions` table
  itself is populated starting in Phase 3's payment lifecycle work — this phase proves the
  adapter layer, not the ledger.
- **No checkout UI.** That's Phase 7.
- Every new file should match the conventions of the equivalent existing Phase 1 file
  (migration style, route style, test style) rather than introducing a new pattern —
  consistency with what's already in the repo matters more than any individual stylistic
  preference.

---

## Definition of Done

Do not report this phase complete until every item below is verifiably true:

- [ ] `shared/src/adapters.ts` fully replaced with the exact §10 interface and matching
      types; every old call site (`initiatePayment` etc.) updated or removed, verified via
      grep
- [ ] `backend/src/adapters/seeded-rail-adapter.ts` passes a full `createPayment` →
      `getStatus` → `normalize` cycle in automated tests, producing a `NormalizedTransaction`
      matching the `transactions` table shape
- [ ] `migrations/0003_payment_rails.sql` applied, seeded with the `seeded` adapter row,
      matching the style of `0002_phase1_identity.sql`
- [ ] `POST /api/v1/checkout/payment-options` returns a real, seeded-adapter-backed response
      (no more `501` in `stubs.ts` for this route)
- [ ] Circuit breaker wraps all four adapter methods, with configurable failure threshold,
      and a test proves it opens on repeated failure and attempts half-open recovery
- [ ] Retry-with-jitter in place ahead of the breaker tripping, verified by test
- [ ] `payment_rails.is_enabled = false` verified (by test) to exclude a rail from the
      resolution path
- [ ] A grep/lint check (or documented manual review step) confirms no rail-specific
      conditional logic exists outside `backend/src/adapters/` and the `payment_rails` path
- [ ] `phase2.test.ts` exists, passes, and follows Phase 1's test conventions

When every box is checked, stop. Report which items are done and hand off — do not begin
Phase 3 (LOOP Integration & Payment Lifecycle) in this session.
