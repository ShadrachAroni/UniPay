# UniPay Hub

Build a mobile-first React Native (Expo) FRONTEND for UniPay — a unified payment, 

identity, and reconciliation platform for Kenya (KES, LOOP rail, Phase 1 scope). 

Single responsive codebase, one adaptive layout per screen (Flexbox + 

useWindowDimensions, no separate tablet/phone screens).

ROLE CONTEXT: I am Dev D (Product Surface Engineer) on a 4-person team. Backend 

(auth, data model, LOOP adapter, reconciliation, AI service, money-direction, 

admin logic) is being built in parallel by Dev A/B/C against a documented API 

contract. Every endpoint currently exists as a 501 stub and will be filled in 

over time — so this build must be structured for a clean swap from stub/mock 

data to real API calls, NOT a rewrite.

SCOPE — what to build (my owned + supported phases):

- Phase 7 (lead): Unified Dashboard + Checkout UI

- Phase 8 (lead): Admin module

- Phase 4B (support): Expected Payments + Pooled Payments creation/status UI

- Phase 6 (support): Money Direction Settings UI

- Phase 5 (support): AI dashboard search box UI

COMMENTING REQUIREMENTS (critical — this is a multi-dev handoff)

Every screen must have a comment block above each data-fetching or 

state-changing point, in this exact format:

// ============================================

// API CONTRACT: [short description]

// Endpoint: [method + path from §18, e.g. POST /api/v1/payment-intents]

// Owned by: [Dev A / Dev B / Dev C — whoever's phase covers this]

// Request shape: { ... }

// Response shape: { ... }

// Currently: [stub/mock data standing in, e.g. "returns mockDashboardData.json"]

// ============================================

Also create /api/CONTRACT.md — one page listing every API call this frontend 

makes, its expected endpoint, which backend phase/dev owns it, and its file 

location. This is the single source of truth for swapping stubs to real calls.

DESIGN PHILOSOPHY

Use the fotmob design style

At its core, FotMob’s design philosophy balances high data density with radical visual minimalism, prioritizing speed, glanceability, and hyper-personalization. The interface uses a clean, utilitarian aesthetic—defined by generous whitespace, simple typography, subtle brand accents, and modular cards—to make vast amounts of real-time statistical data (xG, momentum, live scores) instantly readable without overwhelming the user. Navigation is built around low-friction discoverability and immediate visual feedback, allowing users to seamlessly transition from broad global coverage to a tightly personalized feed of their favorite teams and leagues. For emergent designs, FotMob serves as a blueprint for reducing cognitive load while serving power users, proving that content and live data should always dictate the layout rather than decorative elements

DATA MODEL (build mock data + types matching this exactly — this is the locked 

schema, not to be improvised):

profiles: { id, account_type, display_name, owner_name, phone, email, currency, 

  verification_status, id_document_url }

aliases: { id, profile_id, alias, is_verified, status }

payment_intents: { id, recipient_profile_id, amount, currency, payer_phone, 

  status, provider_reference }

transactions: { id, recipient_profile_id, amount, currency, provider_fee, 

  net_amount, payment_status, settlement_status, transaction_time, settled_at }

reconciliation_matches: { id, transaction_id, confidence_score, ai_explanation, 

  match_type, status }

payouts: { id, profile_id, requested_amount, destination_reference, status, 

  requested_at }

money_direction_rules: { id, profile_id, destination_type, allocation_type 

  (full|percentage|fixed_amount), allocation_value, priority_order, is_active }

expected_payments: { id, owner_profile_id, payer_reference, amount, reference, 

  due_at, status (open|partially_paid|paid|overdue|cancelled), 

  amount_paid_to_date }

payment_pools: { id, owner_profile_id, title, target_amount, 

  status (open|closed|settled), deadline }

pool_contributions: { id, pool_id, contributor_reference, expected_amount, 

  amount_paid, status (unpaid|partially_paid|paid), transaction_id }

admin_audit_log: { id, admin_user_id, action, target_type, target_id, details, 

  created_at }

payment_rails: { id, name, adapter_key, is_enabled, supported_currencies, 

  supported_countries }

========================================

SCREENS TO BUILD

========================================

--- PHASE 7: DASHBOARD + CHECKOUT (lead, highest priority) ---

1. Checkout flow (guest, no login)

   - Alias resolve + amount entry: recipient name + verified checkmark shown 

     after resolving alias (mock resolver with delay)

   - Fee transparency screen: "You pay: KES X → Recipient receives: KES Y" 

     breakdown, comment the real fee-estimate endpoint

   - Payment pending: "Check your phone" spinner state, comment where real 

     webhook/poll status goes

   - Success/failure screen with reference number, retry action on failure

2. Unified Dashboard (home screen)

   - Balance card (available-to-withdraw, prominent)

   - AI natural-language search bar — UI only for now, submits to a mock 

     answerDashboardQuery() that returns a canned {answer, explanation} pair; 

     comment the real Phase 5 endpoint shape and note it must show explanation 

     + number together, never number alone

   - Recent transactions list, payment_status and settlement_status as two 

     visually distinct badge components — never merged into one pill

   - Exceptions count badge/link

   - Outstanding expected-payments total card

   - Active pool progress card

   - Conditional business-only widget slot, hidden entirely for individual 

     accounts (not empty — not rendered)

   - Use skeleton loaders for all async data, not spinners, to avoid layout 

     shift

3. Transaction Detail

   - Both status badges, AI match explanation shown as an annotated line 

     (mock data for now)

4. CSV Export trigger

   - Button that calls a mock export function; comment clearly that the real 

     export must exclude id_number and id_document_url columns

--- PHASE 8: ADMIN MODULE (lead) ---

Build as a role-gated section of the SAME app (not a separate app), reachable 

only for a mocked admin role for now.

5. Admin Overview

   - Platform-wide stats cards: total users, transaction volume, open 

     exceptions, rail health status (mock data)

6. Identity Review Queue

   - List of pending ID submissions, AI pre-check result shown if present, 

     approve/reject buttons — comment that server-side role enforcement is 

     required (UI-only hiding is not sufficient, backend must 403 it)

7. User Management

   - Searchable user list (mock), drill into a profile's transaction history

8. Transaction & Exception Oversight

   - Platform-wide exception list, filterable by status/rail/date/AI 

     confidence, manual resolve/escalate actions

9. Rail & Configuration Control

   - Table/list view of payment_rails, toggle is_enabled — comment this must 

     write through to the real payment_rails config table and immediately 

     affect checkout options once wired

10. Payout & Dispute Handling

    - List of payouts with status, manual intervention actions

11. Audit Log Viewer

    - Read-only chronological list of admin_audit_log entries

--- PHASE 4B SUPPORT: EXPECTED & POOLED PAYMENTS ---

12. Create Expected Payment

    - Form: amount, reference/description, optional due date → generates a 

      shareable pre-filled link/QR (mock QR generation is fine client-side)

13. Expected Payment Detail

    - Status, amount_paid_to_date vs amount, progress bar for partial payments, 

      overdue state styling

14. Create Pool

    - Form: title, target_amount, optional contributor list, optional deadline 

      → generates shareable link/QR

15. Pool Detail / Dashboard

    - Running total vs target (progress bar), per-contributor status list 

      (unpaid/partially_paid/paid), same CSV export pattern as transactions

--- PHASE 6 SUPPORT: MONEY DIRECTION SETTINGS ---

16. Money Direction Settings

    - List of destinations (LOOP number, "keep as balance") with a visual 

      percentage split bar, editable — comment that rule changes apply to the 

      NEXT settlement only, never retroactively, so the UI copy should say 

      this explicitly near the save button

    - Withdraw modal: amount capped at mock available balance, destination 

      confirmation, submit → local state shows requested/processing/completed

========================================

DESIGN SYSTEM (build these as shared components first)

========================================

- StatusBadge component: two color families — payment_status 

  (grey/yellow/green) and settlement_status (grey/blue/green) — used 

  identically everywhere, never merged

- VerifiedCheckmark component

- Card component (consistent padding/shadow/radius)

- SkeletonLoader component for async data

- Fintech-neutral palette: one primary brand color, generous whitespace

- Bottom tab navigation: Dashboard, Transactions, Money Direction, Settings 

  (Admin reachable as a separate role-gated stack, not in the main tab bar)

- Checkout/QR-share reachable as a guest-accessible deep link outside the tab 

  bar

========================================

RATE LIMIT / ERROR STATE HANDLING

========================================

Every screen making an API call needs a clear "too many requests" state (not 

a silent failure) and a generic error state distinct from empty state — 

comment that the backend applies token-bucket rate limiting on public 

endpoints, so this isn't hypothetical.

========================================

DELIVERABLE STRUCTURE

========================================

/mockData — seeded JSON matching the schema above exactly

/api — one function per endpoint call, each with the API CONTRACT comment 

  block, plus api/CONTRACT.md indexing all of them

/components — StatusBadge, VerifiedCheckmark, Card, SkeletonLoader, etc.

/app (Expo Router) — one file per screen listed above, grouped by flow 

  (checkout/, dashboard/, admin/, expected-payments/, pools/, settings/)

Build order: shared components → Dashboard + Checkout (Phase 7 core) → 

Expected/Pooled Payments creation flows → Money Direction Settings → Admin 

module last, since it depends on the most other data being visibly correct 

first.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a6b30c69-7e00-4770-93e5-c41e7ca217c5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
