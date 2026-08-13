# UniPay — Phase 1 Build Agent Prompt

Paste this whole document to the coding agent as its task. It is self-contained: you do not
need the other UniPay documents open to execute this phase, though they're referenced below
for anyone auditing the result.

**Prerequisite:** Phase 0 (Foundations & Scaffolding) is complete and its Definition of Done
is fully checked — monorepo scaffolded, Expo web export deploying, backend health check
live, Postgres reachable, structured logging in place, every §18 + Phase 4B endpoint stubbed
at `501`, Clerk sign-up/sign-in scaffolded. Do not start this phase if any of that isn't
true; fix Phase 0 first.

---

## Who you are and what you're building

You are **Dev A, Platform & Identity Lead**, executing **Phase 1 — Identity, Auth & Data
Model** of UniPay v4.0: a unified payment, identity, and reconciliation platform for Kenya
(KES, LOOP rail, Phase 1 scope). This phase builds the single account model — one `profiles`
table, one Clerk-backed auth flow, one alias/QR identity primitive — that every later phase
(payments, reconciliation, expected/pooled payments, dashboard, admin) reads and writes
against. Get the schema and the account-type discipline right here; nothing downstream
tolerates a rework of this table.

**Your job in this phase is identity and access, not payments.** No LOOP integration, no
transaction ledger, no reconciliation. Onboarding stops at "identity submitted, status
tracked" — the actual AI pre-check on ID documents belongs to Phase 5 (Dev C); you build the
`verification_status` state machine and a manual/admin toggle to move through it for now,
not the AI call itself.

Ground truth this phase draws from:
- **§7** (Target Users) — individuals and small businesses share one account model.
- **§8** (Current Phase Scope) — "Must-Build" items this phase covers: universal sign-up,
  onboarding with lightweight ID capture, one alias+QR per user gated on submission.
- **§9b** (Scalability: Rails, Currencies & Segments) — "account type is a flag, not a
  fork," the structural rule this whole phase exists to enforce.
- **§11** (Data Model) — exact `profiles`/`aliases` shape (reproduced below).
- **§19** (Authentication & Security) — JWT validation, secrets handling, unauthenticated
  checkout, lightweight/realistic identity-verification scope.
- Handbook **M8.3** — backward-compatible schema evolution, idempotency keys, JWT validation
  vs. introspection.

---

## Task list

### 1. `profiles` table

Build exactly this shape (matches the schema documentation's `profiles` table — do not
invent extra columns or split this into multiple tables):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `account_type` | text | `check in ('individual','business')` — **a flag, not a fork.** There is one `profiles` table for both. Nothing about this phase, or any later phase, creates a parallel `businesses` table or a separate business-only codepath. Business-only fields are additive nullable columns; business-only UI is conditional rendering. |
| `display_name` | text | Shown to payers |
| `owner_name` | text | Legal/registered name of the account holder |
| `clerk_user_id` | text | FK to Clerk auth, **unique** |
| `phone` | text | Masked in logs — enforce this in the logging layer now, not as a later cleanup |
| `email` | text | Masked in logs |
| `currency` | text | Default `'KES'` |
| `country_code` | text | Default `'KE'` |
| `status` | text | `check in ('active','suspended','closed')` |
| `verification_status` | text | `check in ('unsubmitted','submitted','ai_precheck_passed','ai_precheck_flagged','approved','rejected')` — this phase implements every transition **except** the two `ai_precheck_*` states, which stay unreachable until Phase 5 wires the AI call. For now, `submitted` moves to `approved`/`rejected` only via the manual/admin toggle described below. |
| `id_number` | text | Masked in logs, excluded from any export |
| `id_document_url` | text | Masked in logs, excluded from any export |
| `id_submitted_at` | timestamptz | Nullable |
| `id_reviewed_at` | timestamptz | Nullable |
| `id_reviewer_note` | text | |
| `id_ai_check_result` | jsonb | Leave the column in place now (schema evolution discipline — see below) but never write to it this phase; Phase 5 populates it |
| `created_at` | timestamptz | |

Add a unique index on `clerk_user_id` and a btree index on `verification_status` (the Admin
identity queue in Phase 8 filters on this).

### 2. `aliases` table

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `profile_id` | uuid | FK → `profiles.id` |
| `alias` | text | **Unique.** Format like `@amina`. |
| `identifier_type` | text | `check in ('alias','qr','link')` |
| `is_verified` | boolean | Default `false` |
| `status` | text | `check in ('active','revoked')` |

Alias creation is **gated on identity submission** (§8): a profile must have
`verification_status` at or past `submitted` before an alias/QR/link can be generated. Do
not allow alias creation for an `unsubmitted` profile, even temporarily for testing — write
the gate as real logic, not a comment saying to add it later.

### 3. Universal Clerk sign-up/login

- One sign-up/sign-in flow, not two. The account-type choice (individual vs. business)
  happens post-auth, as a step that creates the `profiles` row — it is not a different login
  screen or a different Clerk instance.
- Wire `@clerk/clerk-expo` on the `/app` client. It handles token storage per platform
  automatically (SecureStore on iOS/Android, browser storage on the web export) — do not
  write custom token-persistence code per platform; that's what the SDK is for.
- Backend middleware trusts Clerk-issued JWTs only, and validates them **locally** (not via
  introspection against Clerk's API on every request). This system needs low-latency,
  high-throughput validation far more than it needs instant token revocation, so local JWT
  verification is the correct tradeoff — pair it with short token expiry and a refresh flow
  so a compromised token has a small blast radius instead of relying on revocation.
- This middleware protects **all non-checkout routes**. Checkout is the one deliberate
  exception (see below) — get the allowlist/denylist logic right here, since getting it
  backwards either breaks checkout or leaves other routes open.

### 4. Onboarding flow (lightweight identity verification)

Implement the "lightweight, realistic scope" version described in §19 — real submission and
status tracking, simulated registry check:

- After account-type selection, prompt for: profile details, ID document upload, ID number.
- On submit: write `id_number`, `id_document_url`, set `id_submitted_at`, transition
  `verification_status` to `submitted`.
- Build a manual/admin toggle (a simple protected endpoint or an Admin-only UI stub is
  enough — the full Admin module is Phase 8, so this can be minimal) that moves a profile
  from `submitted` to `approved` or `rejected`, writing `id_reviewed_at` and
  `id_reviewer_note`. This stands in for both the future AI pre-check (Phase 5) and any
  human review queue (Phase 8) — it exists so the rest of this phase's flow (alias gating)
  is testable end-to-end without those later phases.
- **Never claim or imply live registry checking anywhere in the UI or copy.** The actual
  check against a national ID registry is explicitly out of scope for this build (§19, §22)
  — this is a demoable, honest simulation, not a shortcut to hide. If you add any status
  text like "verifying with government registry," remove it; say "under review" instead.

### 5. Schema evolution discipline (starts now, applies forever)

Handbook M8.3 — backward-compatible schema evolution:

- Every new column added to `profiles` or `aliases` (this phase or any future one) is
  **optional with a sensible default**. Nothing is ever repurposed — if a later phase needs
  a field to mean something different, it gets a new column, not a redefinition of an
  existing one.
- This matters immediately, not eventually: Phase 4B adds `expected_payments` and
  `payment_pools` that reference `profiles.id`; Phase 8's Admin module reads
  `verification_status` directly. If this phase's schema isn't stable and additive-only,
  every one of those phases inherits a migration risk.

### 6. Security baseline (§19)

- Checkout stays **unauthenticated by design**. Do not gate the payer-facing checkout route
  (built in Phase 3/7) behind login, and do not let this phase's auth middleware
  accidentally sweep it in as a side effect of a broad route-matching pattern.
- All secrets — LOOP API keys, the AI provider key (used starting Phase 5) — are
  server-side only. Nothing touches the Expo client, in either the native build or the web
  export. Confirm this now by grep-ing the `/app` package for any credential-shaped string
  before calling this phase done.
- Idempotency keys are a first-class concept from this phase forward (Handbook M8.3): every
  write endpoint that could plausibly be retried by a client needs one. This phase doesn't
  have money-moving endpoints yet, but the `profiles`/`aliases` creation endpoints should
  still accept and honor an idempotency key now, so the pattern is established before Phase
  2/3 build endpoints where getting this wrong causes real financial bugs (duplicate payment
  intents, duplicate payouts).

---

## Constraints that apply to this phase specifically

- **No payments logic.** If you find yourself writing anything that touches LOOP, a
  transaction, or money movement, stop — that's Phase 2/3.
- **No AI calls.** `id_ai_check_result` exists as a column but stays unwritten this phase.
- **One table per concept, always.** The temptation in this phase is to create
  `individual_profiles` and `business_profiles` for cleanliness — don't. §9b's durability
  argument for "unified" depends on this being one table with a flag, checked here at the
  root of the schema, not fixed later.
- **Checkout's unauthenticated status is a security decision, not an oversight** — don't
  "helpfully" require login for it while building the auth middleware.

---

## Definition of Done

Do not report this phase complete until every item below is verifiably true:

- [ ] `profiles`, `aliases` tables live, matching the shapes above exactly
- [ ] One account model verified with a test for both `individual` and `business`
      `account_type` values — same table, same code path
- [ ] Clerk sign-up/login working end-to-end for both account types, from the Expo web
      export
- [ ] Alias + QR generated only after ID submission (test: attempt alias creation on an
      `unsubmitted` profile and confirm it's rejected)
- [ ] Manual/admin verification toggle moves a profile from `submitted` to
      `approved`/`rejected` correctly
- [ ] JWT validation middleware protecting all non-checkout routes (test: confirm a
      non-checkout route rejects an unauthenticated request, and confirm the checkout stub
      route from Phase 0 does not require auth)
- [ ] No PII in logs (spot-checked — trigger a profile creation and a login, inspect the log
      output for phone/email/ID number in the clear)
- [ ] No secret or API key present anywhere in the `/app` package (native or web export)
- [ ] `profiles`/`aliases` write endpoints accept and honor an idempotency key

When every box is checked, stop. Report which items are done, and hand off — do not begin
Phase 2 (Provider Adapter Architecture) in this session.
