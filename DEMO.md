# UniPay v4.0 — Live Demo & Presentation Guide (`DEMO.md`)

Welcome to the **UniPay v4.0** comprehensive demo and usage documentation. This guide contains everything required to run, present, evaluate, and reset the UniPay platform.

---

## 1. System Setup & How to Run

### Prerequisites
- Node.js `^20.0.0` or `^22.0.0`
- `npm` v10+

### Installation & Environment
1. Clone the repository and install all workspace dependencies:
   ```bash
   npm install
   ```
2. Verify environment configuration:
   Ensure `.env` in the repository root contains the required backend configuration:
   ```env
   EXPO_PUBLIC_API_URL=http://localhost:4000
   LOOP_BASE_URL=https://sandbox.loop.co.ke
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

### Starting the Platform
- **Start Backend API Service** (runs on `http://localhost:4000`):
  ```bash
  npm run dev:backend
  ```
- **Start App Frontend** (runs Expo web/mobile on `http://localhost:8081`):
  ```bash
  npm run dev:app
  ```

### Seed Demo Data
To populate or restore the platform with realistic historical demo data, execute:
```bash
npm run seed:demo
```

---

## 2. Role-by-Role Credentials Table

| Persona / Name | Role / Account Type | Email / Identifier | Clerk User ID / Auth Key | Status & Distinctive Features |
| --- | --- | --- | --- | --- |
| **Amina Mohamed** | Merchant (`business`) | `amina@organichub.co.ke` (`@amina`) | `user_amina` | **Verified Business**. Has active money-direction rules (70% bank, 30% tax vault), historical sales, and settlements. |
| **Ken Njoroge** | Individual (`individual`) | `ken.njoroge@gmail.com` (`@ken`) | `user_ken` | **Verified Individual**. Used for P2P alias payments. |
| **David Ochieng** | Merchant (`business`) | `david@freshbites.co.ke` (`@freshbites`) | `user_freshbites` | **Pending KYC Review**. Use to demonstrate compliance review queue in Admin. |
| **Sarah Wanjiku** | Individual (`individual`) | `sarah.wanjiku@outlook.com` (`@unverified_ind`) | `user_unverified_ind` | **Pending KYC**. Unverified individual user state. |
| **Super Admin** | Platform Admin (`super_admin`) | `admin.super@unipay.ke` | `admin_super` | **Full Privileges**. Can configure payment rails, update fees, and run system interventions. |
| **Support Admin** | Operations (`support`) | `admin.support@unipay.ke` | `admin_support` | **Operational Support**. Manages reconciliation exceptions and views customer logs. |
| **Compliance Officer** | Compliance (`compliance_reviewer`) | `admin.compliance@unipay.ke` | `admin_compliance` | **KYC Reviewer**. Reviews submitted ID documents and resolves customer disputes. |

---

## 3. Step-by-Step Demo Walkthrough (§27 Narrative)

### Step 1: Merchant Onboarding & Verified Status Badge
1. Log in as **Amina Mohamed** (`user_amina`).
2. Navigate to Profile / Settings.
3. Observe the green **Verified Checkmark** badge next to the display name.
4. Switch account to **David Ochieng (Fresh Bites Cafe)** (`user_freshbites`).
5. Observe the **Pending Review** banner showing that identity documents are queued for compliance verification.

### Step 2: Instant Payment Checkout via Alias & LOOP Rail
1. Open the public checkout flow for `@amina` (`POST /api/v1/checkout/payment-options` or frontend checkout screen).
2. Enter payment amount: `3,000 KES`.
3. View resolved checkout options:
   - Primary Rail: **LOOP Mobile Money** (or **Seeded Rail**).
   - Instant Fee Breakdown: `45.00 KES` fee (1.5%), estimated recipient net: `2,955.00 KES`.
4. Confirm payment to execute end-to-end payment intent.

### Step 3: P2P Send Flow (Ken -> Amina)
1. Log in as **Ken Njoroge** (`user_ken`).
2. Enter payment recipient: `@amina`.
3. Enter amount `1,500 KES` and send.
4. Observe real-time transaction ledger update and instant confirmation badge.

### Step 4: Multi-Rail Architecture & Dynamic Admin Rail Toggling
1. Log in as **Super Admin** (`admin_super`).
2. Open Admin Payment Rails Management (`/admin/payment-rails`).
3. Toggle the **Seeded Rail** or **PesaLink Rail** off.
4. Perform checkout resolution for `@amina` again — observe checkout options dynamically switch primary payment rail without any code deployment or restart.
5. Re-enable the payment rail.

### Step 5: Automated Money-Direction Split Rules
1. Log in as **Amina Mohamed** (`user_amina`).
2. Open Settings -> **Money Direction Rules**.
3. View current active rules:
   - Priority 1: `70%` -> `NCBA Bank Account (***1023)`
   - Priority 2: `30%` -> `UniPay Tax Reserve Pool`
4. Update percentages or add a fixed amount rule.
5. Note: Money direction rules execute automatically upon settlement of incoming sales.

### Step 6: AI-Assisted Reconciliation & Exception Explanation
1. Log in as **Support Admin** (`admin_support`).
2. Open Reconciliation Dashboard (`/admin/reconciliation`).
3. Select the flagged exception `tx_seed_amount_mismatch_101`.
4. Read the **AI-Generated Plain-Language Explanation**:
   > *"AI match confidence 94%: Transaction amount 14,850 KES corresponds to Order #8841 (15,000 KES) after deducting 150 KES bank processing fee."*
5. Click **Approve Match** to resolve the exception.

### Step 7: Sanitized CSV Export & Security Invariant
1. Log in as **Super Admin** or **Compliance Officer**.
2. Trigger CSV Export for transactions / audit logs.
3. Verify that PII (National ID numbers, private document URLs, raw phone numbers) are automatically redacted/masked per §19 security rules.

### Step 8: Real-Time Platform Metrics & Rail Health
1. Navigate to Admin Overview Metrics (`/admin/metrics`).
2. Observe live derived metrics:
   - Total Platform Volume & Transaction Count
   - Reconciliation Match Rate (%)
   - AI Suggestion Acceptance Rate (%)
   - Rail Health Indicators & Circuit Breaker status (`CLOSED`)

---

## 4. Known Limitations & Simulated Elements (§8, §22)

To maintain absolute transparency with evaluators and presenters, the following elements are simulated in this build phase:

1. **Second Seeded Payment Rail (`seeded_2` / PesaLink Rail)**:
   - *Status*: **Simulated Adapter Fixture**.
   - *Purpose*: Demonstrates UniPay's adapter-driven, multi-rail architecture (§9b) using static fixtures without requiring live banking contracts.
2. **National ID Registry Check**:
   - *Status*: **Simulated Verification Engine**.
   - *Purpose*: Simulates national ID document validation and AI pre-check without querying external government databases.

All simulated elements are explicitly labeled with `(Simulated Fixture)` or `[Simulated]` across the application UI, API responses, and database logs.

---

## 5. Resetting the Demo Environment

If demo data becomes mutated during testing or presentation rehearsal, restore the system to its initial seeded state by executing:

```bash
npm run seed:demo
```
