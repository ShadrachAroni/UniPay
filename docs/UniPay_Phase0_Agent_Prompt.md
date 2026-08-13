# UniPay — Phase 0 Build Agent Prompt

Paste this whole document to the coding agent as its task. It is self-contained: you do not
need the other UniPay documents open to execute this phase, though they're referenced below
for anyone auditing the result.

---

## Who you are and what you're building

You are **Dev A, Platform & Identity Lead**, executing **Phase 0 — Foundations &
Scaffolding** of UniPay v4.0: a unified payment, identity, and reconciliation platform for
Kenya (KES, LOOP rail, Phase 1 scope). UniPay gives individuals and small businesses one
verifiable identity (alias, QR, link) instead of scattered payment identifiers, and layers
reconciliation, settlement visibility, and AI-assisted matching on top of a single payment
rail (LOOP) via a provider-adapter architecture designed to add more rails later without a
rewrite.

**Your job in this phase is infrastructure only.** No payment logic, no reconciliation
logic, no AI calls, no real onboarding flow. You are building the repo, the environments,
the conventions, and the empty scaffolding that Phases 1–10 will fill in. If you find
yourself writing business logic beyond a `501` stub, stop — that belongs to a later phase.

Ground truth this phase draws from (cite section numbers in commit messages/README where
relevant):
- **§9 / §9b** (Solution Architecture, Scalability) — stack choices and the adapter/config
  discipline that everything downstream depends on.
- **§18** (API Design) — the endpoint list every route must stub.
- **§19** (Authentication & Security) — the logging/PII rules that apply from line one.
- Handbook **M1** (Indexing Strategy, Connection Pooling) and **M5** (Observability) — the
  specific engineering patterns cited below.

---

## Stack decisions (already made — do not re-litigate)

| Layer | Technology | Notes |
| --- | --- | --- |
| Product surface | **Expo (React Native + TypeScript)**, Expo Router, NativeWind | One codebase, three export targets: web, iOS, Android. **Checkout must be reachable from the web export with no install and no login** — this is a hard product requirement (§19, §20), not a preference, and it constrains how you set up deployment in this phase. |
| Auth | Clerk (`@clerk/clerk-expo` on the client) | Handles token storage per platform automatically (SecureStore native, browser storage web) — don't hand-roll this. |
| Backend | Node.js, Express or Fastify (pick one and commit to it — don't scaffold both) | Exposes the REST API in §18. |
| Database | PostgreSQL via Supabase | |
| Hosting | Web export → Vercel or Netlify; backend → Render or Railway; native binaries → EAS Build (not required to be green this phase) | |

Do not introduce a different frontend framework, a different database, or a different auth
provider "to save time" — these choices are fixed for the whole build, and later phases
assume them.

---

## Task list

### 1. Monorepo structure

Initialize a monorepo with three packages:

```
/app        — Expo + TypeScript, Expo Router, NativeWind
/backend    — Node.js, Express or Fastify, TypeScript
/shared     — types/contracts imported by both app and backend
```

Use a workspace tool appropriate to your package manager (npm/yarn/pnpm workspaces, or
Turborepo if you want a task runner — optional, not required for Phase 0). `/shared` should
export at minimum: the `PaymentProviderAdapter`-shape types that Phase 2 will implement
against, and request/response types for the §18 endpoints you're about to stub — even as
placeholders, so both packages import from one source of truth instead of duplicating
interfaces.

### 2. Expo export targets

Get all three Expo targets working, in this priority order (web first — it's the one
checkout depends on):

1. `expo export --platform web` — produces a static/SSR web build. Deploy this to
   Vercel or Netlify. This is the **canonical payer-facing surface** going forward; every
   later phase's "does checkout work" test runs against this deployment, not the native app.
2. `expo start` — confirm the same screen(s) run in Expo Go on a simulator or physical
   device.
3. EAS Build config for iOS/Android — get the config file in place (`eas.json`) so a build
   is one command away later; you do not need a working signed binary this phase.

Ship one placeholder screen ("UniPay — Phase 0" or similar) that renders identically via all
three paths, so the DoD check below is verifiable.

### 3. Database

- Provision a PostgreSQL instance via Supabase.
- Confirm the backend can connect and run a trivial query.
- Configure the connection pool: `pool_size = num_cores × 2 + effective_spindle_count`,
  starting at 10 and documented as tunable (Handbook M1 — Connection Pooling). If you're
  using PgBouncer in front of Supabase, use **transaction mode**, since the API servers are
  stateless.
- Do not create any Phase-1+ tables yet (`profiles`, `transactions`, etc.) — that's Phase 1.
  It's fine to run a no-op migration tool setup (e.g. a `migrations/` folder with a single
  "hello world" migration) so the migration mechanism itself is proven before real tables
  land on it.
- Plan, but do not yet create, these composite indexes so they're not forgotten once real
  data volume exists (Handbook M1 — Indexing Strategy): `transactions(recipient_profile_id,
  payment_status)` and `payment_intents(idempotency_key)`. Write this down in the README
  under "Known future indexes," not as a migration yet — the tables don't exist.

### 4. Auth scaffolding

- Wire Clerk into both `/app` (via `@clerk/clerk-expo`) and `/backend` (JWT verification
  middleware, local verification not introspection — see the security note below).
- Sign-up/sign-in only. No `account_type` distinction, no roles, no protected routes beyond
  a trivial "am I logged in" check. That logic is Phase 1.
- Confirm a user can sign up and sign in successfully from the Expo web export.

### 5. Structured logging

Set up JSON structured logging in the backend from the first commit, not retrofitted later
(Handbook M5 — "why standard logging is not enough"):

- Every log line carries: `level`, `time`, `trace_id`, `user_id`, `route`.
- **Hard rule, enforced now and forever**: never log ID numbers, document URLs, phone
  numbers, or emails in the clear (§19). Add this as an explicit item in your PR/code-review
  checklist template so it's not just a one-time intention.
- `trace_id` should be generated or propagated (from an incoming header) on every request —
  later phases depend on this threading through LOOP and AI calls; get the propagation
  mechanism right now while there's nothing else to distract from it.

### 6. Health check

- `GET /health` on the backend, checking DB connectivity and returning `200` with a small
  JSON body (`{ status: "ok", db: "ok" }`). If you've wired any other external dependency
  already (you likely haven't yet), check it too — otherwise this just checks DB for now and
  gets extended later.

### 7. API-first contract: stub every endpoint

Every endpoint below (from §18, plus the Phase 4B additions this build already commits to)
gets a route that returns `501 Not Implemented` with a small JSON body naming which phase
will implement it. This unblocks Dev D (product surface) from Phase 1 onward — they build
against these stubs immediately instead of waiting on backend logic.

**§18 core endpoints:**

```
POST   /api/v1/profiles
POST   /api/v1/profiles/:id/aliases
GET    /api/v1/aliases/:alias
POST   /api/v1/checkout/payment-options
POST   /api/v1/payment-intents
GET    /api/v1/payment-intents/:id
POST   /api/v1/payment-intents/:id/retry
POST   /api/v1/webhooks/loop
GET    /api/v1/transactions
POST   /api/v1/reconciliation/run
GET    /api/v1/reconciliation/exceptions
GET    /api/v1/exports/transactions.csv
POST   /api/v1/profiles/:id/identity
GET    /api/v1/profiles/:id/identity
POST   /api/v1/profiles/:id/identity/review
GET    /api/v1/profiles/:id/balance
GET    /api/v1/profiles/:id/money-direction
PUT    /api/v1/profiles/:id/money-direction
POST   /api/v1/payouts
GET    /api/v1/payouts/:id
GET    /api/v1/payouts
POST   /api/v1/ai/query
POST   /api/v1/ai/support
GET    /api/v1/admin/users
GET    /api/v1/admin/exceptions
PUT    /api/v1/admin/payment-rails/:id
GET    /api/v1/admin/audit-logs
```

**Phase 4B additions (expected & pooled payments — stub now so Phase 4B isn't blocked
later):**

```
POST   /api/v1/expected-payments
GET    /api/v1/expected-payments/:id
GET    /api/v1/expected-payments
POST   /api/v1/pools
GET    /api/v1/pools/:id
POST   /api/v1/pools/:id/contributions
GET    /api/v1/pools/:id/contributions
```

Every stub route should still validate that it's a syntactically reasonable request shape
(right HTTP method, route matches) — you're proving the routing table is complete, not just
that a catch-all 501 exists.

### 8. README

Write a root `README.md` covering: how to run `/app` (all three targets) and `/backend`
locally, how the monorepo is laid out, the stack table above, the "known future indexes"
note from step 3, and a link back to this phase's Definition of Done so the next agent
picking up Phase 1 can verify it before starting.

---

## Constraints that apply to this phase specifically

- **Schema evolution discipline starts now, even with no tables yet**: when Phase 1 adds
  `profiles`, `aliases`, etc., every column must be optional with a sensible default and
  nothing is ever repurposed later (Handbook M8.3). Bake this into your migration tooling
  choice and document it in the README so it's a standing rule, not a one-off reminder.
- **No PII in logs, ever, starting with your first log line** — even placeholder/test log
  output during this phase should not print phone numbers, emails, or IDs, since the habit
  matters more than the content at this stage.
- **Checkout's web-export requirement is a Phase 0 deployment decision, not a Phase 7
  concern** — get the web export deploying correctly now, because Phase 7 will build the
  actual checkout screen on top of whatever deployment pipeline you set up here. If the
  pipeline is fragile or missing, that risk compounds for every phase after this one.
- Do not implement `PaymentProviderAdapter`, Clerk roles/`account_type`, reconciliation, AI
  calls, or any UI beyond the single placeholder screen. Those are Phases 1–8.

---

## Definition of Done

Do not report this phase complete until every item below is verifiably true — check each
one yourself before handing off, don't take intent for completion:

- [ ] Repo builds; Expo web export deploys a "hello world" screen to Vercel/Netlify, and
      `expo start` runs the same screen in Expo Go on a physical or simulated device
- [ ] Backend deploys a "hello world" health route to Render/Railway
- [ ] Postgres reachable, connection pool configured and documented (size, mode if using
      PgBouncer)
- [ ] Structured JSON logger in place on the backend; PII-redaction rule written into the
      code-review checklist template (not just verbally agreed)
- [ ] Every §18 endpoint, plus the seven Phase 4B endpoints listed above, exists as a `501`
      stub with a correct route/method match
- [ ] `GET /health` returns `200` with DB connectivity confirmed
- [ ] Clerk sign-up/sign-in works end-to-end from the Expo web export
- [ ] README written and accurate as of the final commit of this phase

When every box is checked, stop. Report which items are done, link the deployed web export
URL and backend health-check URL, and hand off — do not begin Phase 1 (profiles, aliases,
identity verification) in this session.
