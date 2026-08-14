# UniPay — Phase 10 Build Agent Prompt (Seeded Scalability Proof & Demo Prep)

Paste this whole document to the coding agent as its task. **Step 0 is mandatory and comes
first**, as with every prior phase — verify the codebase directly rather than trusting any
prior status report, including this document's own assumptions about what earlier phases
left behind.

**Scoping note:** this is the final build phase. It does not add new product capability —
it proves the "unified, scalable" architectural claim with a second rail/currency built
through the existing adapter pattern, seeds realistic demo data, produces demo credentials
and usage documentation, and rehearses the actual demo end-to-end. Everything here either
proves a claim the earlier phases already made possible, or reduces live-demo risk. If Step 0
finds a claim doesn't actually hold (e.g. the adapter interface isn't as rail-agnostic as §9b
promised), **stop and flag it** — don't paper over it with a seeded demo that hides a real
architectural gap.

---

## Step 0 — Confirm what's already present (do this first, report before proceeding)

**Verify every prior phase's claims that this phase depends on, not just their reported
status:**

- [ ] Confirm the **Seeded/Future-Rail Adapter** Phase 2 was told to build first (against
      static fixtures, before the real LOOP integration) actually exists, implements
      `PaymentProviderAdapter` in full (including `disburse()`), and has never been deleted
      or left half-finished once real LOOP work took over. Read the actual adapter file, not
      just Phase 2's Definition of Done.
- [ ] Confirm the `payment_rails` config table (§9b) is genuinely driving checkout options —
      re-run Phase 8's own round-trip test (toggle a rail off in Admin, confirm it disappears
      from `POST /api/v1/checkout/payment-options`) to be sure this still holds after every
      phase since.
- [ ] Search the codebase for **any** `if (rail === 'loop')`-style conditional outside the
      `LoopAdapter` itself, across checkout, ledger, reconciliation, and disbursement code.
      This is the specific anti-pattern the Cross-Cutting Rules forbid — if any later phase
      introduced one under deadline pressure, it must be fixed before a second rail can prove
      anything.
- [ ] Confirm what demo/seed data already exists (from any phase's test fixtures or manual
      testing) versus what needs to be generated fresh — reuse realistic fixtures already in
      the repo rather than inventing parallel ones.
- [ ] Confirm the exact current state of every capability §27's demo narrative depends on, by
      walking through it step by step against the live system, not this document's assumption
      that each phase's Definition of Done was fully met:
  - Amina (business) sign-up → ID upload → AI pre-check (Phase 5 P1 — confirm it was
    actually built, since it was Should-Build, not Must-Build) → `verification_status`
    clears → checkmark appears.
  - A payment via LOOP sandbox resolves end-to-end from a QR/alias.
  - Ken (individual) sends money through the identical alias flow, no business account.
  - The AI dashboard query box (Phase 5 P0) answers a real comparative question against real
    data.
  - A reconciliation match shows an AI-generated plain-language explanation (Phase 5 P0).
  - Money-direction split (Phase 6) can be viewed and edited from Settings and the edit
    takes effect only on the next settlement.
  - CSV export (Phase 7) works and excludes ID numbers/document URLs.
  - Admin (Phase 8) can review the identity queue, see the exception rate, and see rail
    health — using real, derived numbers.
  - Report precisely which of these currently work, which are partially working, and which
    don't work at all — this list is the actual scope of "demo prep," not this document's
    assumption that everything upstream is finished.
- [ ] Confirm whether Phase 9's hardening pass (rate limiting, circuit breaker) is in a state
      that could interfere with a live demo — e.g. an overly aggressive rate limit that could
      trip during rehearsal. Note it, don't silently loosen a security control to make the
      demo smoother without flagging that trade-off explicitly.

Report all of the above before writing code or seed scripts. If Step 0 finds that a §27
narrative step doesn't actually work, this phase's real job is fixing or flagging that gap —
not building around it with seeded data that would make a broken feature look functional in
the demo.

---

## Who you are and what you're building

You are **Dev B** (seeded rail/currency) working jointly with **Dev D** (demo build), with
**all other agents supporting**, executing **Phase 10 — Seeded Scalability Proof & Demo
Prep** of UniPay v4.0, the final phase of the build plan. This phase has three parts that
happen to land in the same phase: (1) prove the "adapter-first, currency-ready" architectural
claim from §9b with a real second rail/currency built through the exact same interface as
LOOP, (2) produce working demo credentials for every role plus a self-contained usage doc,
and (3) make sure the actual demo — the one described in §27 — runs live, start to finish,
without a human quietly fixing something behind the scenes.

**This phase does not touch real payment logic, and does not build new product features.**
The second rail is explicitly seeded/simulated (§8) — it exists to prove the architecture
generalizes, not to be a second real integration. Where this phase finds something that
*should* have worked from an earlier phase but doesn't, fix it in that phase's code (or flag
it clearly if it's out of scope to fix now) rather than routing around it with fake data.

Ground truth this phase draws from: **§8** ("Simulated/Seeded" — what's explicitly allowed
to be seeded and how it must be labeled), **§9b** (the adapter/config-driven scalability
claim this phase proves), **§16** (Admin roles this phase must create credentials for),
**§22** ("Nothing presented as live if it isn't" — the honesty principle every seeded element
must satisfy), **§27** (the exact demo narrative to rehearse), and **§24 Phase 13** (the
backup-video requirement).

---

## Task list

### 1. Second seeded rail and currency — only for what Step 0 found missing or broken

- Implement (or repair, if Step 0 found it degraded) a second `PaymentProviderAdapter`
  implementation against static/seeded fixtures — same interface, same `payment_rails`
  config pattern as LOOP, proving §9b's claim in practice.
- Add a corresponding `payment_rails` row (a second currency, e.g. USD, and/or a second
  rail) with `is_enabled` togglable exactly like LOOP's row.
- The seeded rail must be selectable at checkout when enabled, and must run through
  `createPayment` → `getStatus` → `normalize()` exactly like LOOP — no special-cased UI path.
- **Label it clearly as simulated everywhere it appears** — checkout, the transaction ledger,
  and Admin's rail list — never presented indistinguishably from the live LOOP rail (§8,
  §22).

### 2. Seeded historical data (§8)

- Generate realistic historical `settlements` and `payouts` records so the dashboard and
  Admin reporting views (Phase 7, Phase 8) don't look empty or synthetic during a demo.
- Seed data should exercise a realistic mix of statuses (completed, pending, failed
  settlements; completed, processing, failed payouts) so status badges and the reconciliation
  rate metric show real variation, not a uniform all-success dataset that would look faked to
  an evaluator.

### 3. Seeded ID-registry-check result (§8, §19)

- Confirm the ID-verification submission and status-tracking flow itself is real (built in
  Phase 1/5) — only the underlying registry check is simulated. Do not build or imply a real
  registry integration.
- Ensure this is labeled as simulated wherever it's visible to an evaluator (e.g. in Admin's
  identity review queue), consistent with §19's "Identity Verification" honesty boundary.

### 4. Fix or flag any §27 narrative gap Step 0 found

- For every step Step 0 marked as broken or partially working, either fix it directly (if
  it's a small, contained bug within this phase's reach) or write up a clear, specific gap
  report naming the step, the phase that owns it, and what's actually happening instead —
  hand this to whoever owns that phase rather than silently working around it in the demo
  script.

### 5. Demo credentials & usage documentation

Two deliverables, both required before demo rehearsal (Task 6) can run against something
reproducible rather than whatever state a developer's local session happens to be in.

**5a. Seed demo user accounts for every role**

- Create real, working accounts for each persona §27's narrative depends on, plus each Admin
  role from §16/§11 — do not reuse a single test account across roles:
  - Amina (Business profile, verified)
  - Ken (Individual profile, verified)
  - At least one additional Individual and one additional Business profile with
    **unverified** or **pending** status, so the demo/evaluator can also see what an
    incomplete state looks like, not only the success path
  - `super_admin`
  - `support`
  - `compliance_reviewer`
- These must be real accounts — created through the actual Clerk-backed signup/invite path
  used elsewhere in the system, not rows inserted directly into `profiles`/`admin_users` with
  no corresponding Clerk identity. If a script is used to seed them, it must go through the
  same service-layer functions the app itself uses (`POST /api/v1/profiles`, the admin
  user-creation endpoint, etc.), not raw SQL inserts that could drift from real validation
  rules.
- Passwords/credentials must be applied to the actual database/auth provider used for the
  demo environment (not just written into the doc as aspirational) — verify each credential
  set by actually logging in with it before considering this done.
- Each seeded account should have realistic associated data (a few transactions, an exception
  or two, a money-direction rule) so logging in as any persona immediately shows something
  meaningful rather than an empty dashboard — this can reuse/extend Task 2's seeded historical
  data rather than generating a second parallel dataset.

**5b. `DEMO.md` — app usage, workflow, and credentials doc**

Produce a single markdown file (e.g. `/docs/DEMO.md` or repo root `DEMO.md`) covering:

- **How to run the system** — setup/install steps, env vars required, how to start
  frontend/backend locally (or the live demo URL if hosted), and any seed/reset script to
  restore demo data to a clean state
- **Role-by-role credentials table** — persona name, role/account type, email or alias,
  password, and a one-line note on what's distinctive about that account (e.g. "unverified —
  use to show the pending-review state")
- **Suggested walkthrough per role** — a short, concrete path through the UI for each
  persona, cross-referenced to §27's narrative (e.g. "log in as Amina → Dashboard → ask the
  AI query box 'how much did I make this week' → open the flagged reconciliation match to see
  the AI explanation")
- **Known limitations/seeded elements** — a plain list of what's simulated vs. live in this
  environment (second rail, ID-registry check, etc.), so anyone using the doc to demo or
  evaluate the system doesn't misrepresent seeded functionality as live — this section must
  stay consistent with Task 7's honesty walkthrough, not contradict it
- **Reset instructions** — how to restore the demo environment to its seeded starting state
  if data gets mutated during rehearsal or the live demo itself

This doc is written for two audiences at once: whoever is presenting the demo, and any
evaluator who wants to log in and explore independently — so it must be self-contained and
not assume the reader has build context.

### 6. Rehearse the demo narrative (§27) live, end to end

- Run the full narrative — Amina's sign-up through ID/AI pre-check/checkmark, a real LOOP
  payment, Ken's individual send, the AI dashboard query, an AI-explained fuzzy match, a
  money-direction split adjustment, CSV export, and Admin's queue/exception-rate/rail-health
  review — as one continuous pass against the live system, with **no manual database
  intervention** at any point.
- Use the accounts and steps from Task 5's `DEMO.md`, not ad hoc developer sessions, so the
  rehearsal matches what a presenter or evaluator will actually do.
- Time it and note any step that's slow enough to be awkward live (e.g. AI pre-check delay,
  LOOP webhook latency) — if there's a reasonable UX fix (a skeleton loader that was missed,
  a status message), apply it; if not, note it for the presenter to narrate around.

### 7. Backup demo video (§24 Phase 13)

- Record a full run-through of the §27 narrative as a video, stored somewhere accessible for
  the actual presentation, as a safety net for live hardware/network failure.

### 8. Final honesty walkthrough (§22)

- Go through every claim the demo makes or implies — "verified," "live," "AI-assisted,"
  "automatic" — and confirm each one matches what's actually happening in the code. Anything
  seeded, simulated, or partially built must be labeled as such in both the UI and any
  evaluator-facing narration. Cross-check that `DEMO.md`'s "known limitations/seeded
  elements" section (Task 5b) matches this walkthrough's findings exactly. This is a review
  task, not a coding task, but it's a required Definition-of-Done item — don't skip it
  because it doesn't produce a commit.

---

## Constraints that apply to this phase specifically

- **No new product features.** This phase proves and polishes what already exists; it does
  not add capability beyond the second seeded rail/currency §8 explicitly calls for.
- **The seeded rail must use zero rail-specific code outside its own adapter file** — if
  making it work requires a special case anywhere else, that's a Phase 2 architecture gap to
  fix, not something to route around here.
- **Never present seeded/simulated data or integrations as live**, in the UI or in any
  demo narration or documentation this phase prepares (§8, §22) — this is a hard constraint,
  not a presentation-polish nice-to-have.
- **Demo accounts must go through real auth/service-layer paths** — no raw database inserts
  that bypass Clerk or the app's own validation, even for seed data.
- **Don't loosen a Phase 9 security control (rate limiting, etc.) to make the demo run more
  smoothly without explicitly flagging that trade-off** — if a limit needs adjusting for
  demo conditions, say so rather than silently weakening it.

---

## Definition of Done

- [ ] Step 0 audit completed and reported, including exactly which §27 narrative steps
      worked, partially worked, or were broken before this phase started
- [ ] Second seeded rail/currency selectable in checkout, clearly labeled simulated, using
      zero rail-specific code outside its adapter — verified by a code search, not assumed
- [ ] `payment_rails` config round-trip re-verified: toggling the seeded rail changes
      checkout options with no redeploy
- [ ] Seeded historical settlement/payout data shows realistic status variation in the
      dashboard and Admin reporting views
- [ ] ID-registry-check simulation clearly labeled as simulated wherever visible to an
      evaluator
- [ ] Every §27 narrative gap found in Step 0 is either fixed or handed off with a specific,
      actionable gap report — none silently worked around
- [ ] Demo accounts seeded for every persona in §27 (Amina, Ken) plus one additional
      unverified Individual and Business profile, and all three Admin roles (`super_admin`,
      `support`, `compliance_reviewer`)
- [ ] All seeded accounts created through real service-layer/auth paths (Clerk-backed), not
      raw DB inserts bypassing validation
- [ ] Every credential in the doc verified by an actual successful login, not just recorded
- [ ] Each seeded account has realistic associated data (transactions/exceptions/
      money-direction rules), not an empty dashboard
- [ ] `DEMO.md` produced, covering: run/setup instructions, full role credentials table,
      per-role walkthrough, known-simulated-elements list, and reset instructions
- [ ] `DEMO.md`'s "known limitations/seeded elements" section matches the findings of the
      final honesty walkthrough exactly — no discrepancy between the two
- [ ] Reset script or documented manual process confirmed to actually restore the seeded
      starting state
- [ ] Full §27 demo narrative runs live, start to finish, using `DEMO.md`'s accounts and
      steps, with no manual database intervention
- [ ] Backup demo video recorded and stored
- [ ] Final honesty walkthrough completed: every claim made in the demo (live vs. seeded vs.
      AI-assisted) verified against what the code actually does, with no gaps per §22

When every box is checked, stop and report final status. This is the last phase in the build
plan — there is no Phase 11 to hand off to. Report clearly which Definition-of-Done items
across **all** phases (not just this one) remain open, if any, so the team knows exactly what
state the platform is in going into the actual demo.
