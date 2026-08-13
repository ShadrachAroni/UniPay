// ============================================
// UniPay locked data model (Phase 1, KES / LOOP rail).
// These types mirror the backend schema exactly — do NOT improvise fields.
// Dev A/B/C own the tables; Dev D (this app) only consumes them.
// ============================================

export type AccountType = "individual" | "business";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface Profile {
  id: string;
  account_type: AccountType;
  display_name: string;
  owner_name: string;
  phone: string;
  email: string;
  currency: string;
  verification_status: VerificationStatus;
  id_document_url: string | null;
}

export interface Alias {
  id: string;
  profile_id: string;
  alias: string;
  is_verified: boolean;
  status: "active" | "suspended";
}

export type PaymentIntentStatus =
  | "created"
  | "awaiting_payer"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface PaymentIntent {
  id: string;
  recipient_profile_id: string;
  amount: number;
  currency: string;
  payer_phone: string;
  status: PaymentIntentStatus;
  provider_reference: string | null;
}

// Two INDEPENDENT status axes. Never merge into a single pill.
export type PaymentStatus = "pending" | "processing" | "completed" | "failed";
export type SettlementStatus = "unsettled" | "in_transit" | "settled" | "failed";

export interface Transaction {
  id: string;
  recipient_profile_id: string;
  amount: number;
  currency: string;
  provider_fee: number;
  net_amount: number;
  payment_status: PaymentStatus;
  settlement_status: SettlementStatus;
  transaction_time: string;
  settled_at: string | null;
}

export interface ReconciliationMatch {
  id: string;
  transaction_id: string;
  confidence_score: number;
  ai_explanation: string;
  match_type: "exact" | "fuzzy" | "manual" | "unmatched";
  status: "matched" | "exception" | "resolved" | "escalated";
}

export interface Payout {
  id: string;
  profile_id: string;
  requested_amount: number;
  destination_reference: string;
  status: "requested" | "processing" | "completed" | "failed" | "disputed";
  requested_at: string;
}

export interface MoneyDirectionRule {
  id: string;
  profile_id: string;
  destination_type: "loop_account" | "keep_as_balance";
  allocation_type: "full" | "percentage" | "fixed_amount";
  allocation_value: number;
  priority_order: number;
  is_active: boolean;
}

export type ExpectedPaymentStatus =
  | "open"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export interface ExpectedPayment {
  id: string;
  owner_profile_id: string;
  payer_reference: string;
  amount: number;
  reference: string;
  due_at: string | null;
  status: ExpectedPaymentStatus;
  amount_paid_to_date: number;
}

export interface PaymentPool {
  id: string;
  owner_profile_id: string;
  title: string;
  target_amount: number;
  status: "open" | "closed" | "settled";
  deadline: string | null;
}

export interface PoolContribution {
  id: string;
  pool_id: string;
  contributor_reference: string;
  expected_amount: number;
  amount_paid: number;
  status: "unpaid" | "partially_paid" | "paid";
  transaction_id: string | null;
}

export interface AdminAuditLogEntry {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  created_at: string;
}

export interface PaymentRail {
  id: string;
  name: string;
  adapter_key: string;
  is_enabled: boolean;
  supported_currencies: string[];
  supported_countries: string[];
}

// ---- API envelope helpers -------------------------------------------------

/** Every api/* function resolves to this. Screens branch on `kind`. */
export type ApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "error"; message: string };
