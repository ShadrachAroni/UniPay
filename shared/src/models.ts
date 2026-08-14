/**
 * UniPay Core Domain Models
 * Ground Truth: §11 (Data Model) & §9b (Architecture)
 */

import type { NormalizedTransaction } from './adapters';

export type AccountType = 'individual' | 'business';

export type ProfileStatus = 'active' | 'suspended' | 'closed';

export type VerificationStatus =
  | 'unsubmitted'
  | 'submitted'
  | 'ai_precheck_passed'
  | 'ai_precheck_flagged'
  | 'approved'
  | 'rejected';

export type IdentifierType = 'alias' | 'qr' | 'link';

export type AliasStatus = 'active' | 'revoked';

export type PaymentRail = 'loop' | 'mpesa' | 'pesalink';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed'
  | 'partially_refunded';

export type PayoutStatus =
  | 'requested'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'pending'
  | 'success';

export type MoneyDirectionDestinationType =
  | 'balance'
  | 'loop_number'
  | 'bank_account'
  | (string & {});

export type MoneyDirectionAllocationType =
  | 'full'
  | 'percentage'
  | 'fixed_amount';

export interface MoneyDirectionRule {
  id: string;
  profile_id: string;
  destination_type: MoneyDirectionDestinationType;
  destination_reference?: string | null;
  allocation_type: MoneyDirectionAllocationType;
  allocation_value?: number | null;
  priority_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MoneyDirectionAllocation {
  rule_id?: string | null;
  destination_type: MoneyDirectionDestinationType;
  destination_reference?: string | null;
  amount: number;
}

export interface MoneyDirectionDecision {
  profile_id: string;
  settled_amount: number;
  currency: string;
  allocations: MoneyDirectionAllocation[];
  evaluated_at: string;
}

export interface Profile {
  id: string;
  account_type: AccountType;
  display_name: string;
  owner_name: string;
  clerk_user_id: string;
  phone?: string | null;
  email?: string | null;
  currency: string;
  country_code: string;
  status: ProfileStatus;
  verification_status: VerificationStatus;
  id_number?: string | null;
  id_document_url?: string | null;
  id_selfie_url?: string | null;
  id_submitted_at?: string | null;
  id_reviewed_at?: string | null;
  id_reviewer_note?: string | null;
  id_ai_check_result?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
}

export interface Alias {
  id: string;
  profile_id: string;
  alias: string; // e.g. "@amina"
  identifier_type: IdentifierType;
  is_verified: boolean;
  status: AliasStatus;
  created_at: string;
}

export interface PaymentIntent {
  id: string;
  idempotency_key: string;
  payer_profile_id?: string;
  recipient_profile_id: string;
  recipient_alias: string;
  amount: number;
  currency: 'KES';
  rail: PaymentRail;
  payment_status: PaymentStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  payment_intent_id: string;
  recipient_profile_id: string;
  rail_reference: string;
  rail: PaymentRail;
  amount: number;
  currency: 'KES';
  fee: number;
  net_amount: number;
  payment_status: PaymentStatus;
  reconciliation_status: 'unmatched' | 'matched' | 'exception';
  created_at: string;
}

export interface Payout {
  id: string;
  profile_id: string;
  provider: string;
  requested_amount: number;
  requested_currency: string;
  destination_type: string;
  destination_reference: string | null;
  fee: number;
  net_amount: number;
  status: PayoutStatus;
  provider_reference?: string | null;
  requested_at: string;
  processed_at?: string | null;
  raw_payload?: unknown;
  idempotency_key: string;
  created_at?: string;
  updated_at?: string;
}

export type ReconciliationMatchType =
  | 'exact_reference'
  | 'exact_amount_window'
  | 'payer_amount'
  | 'ai_fuzzy'
  | 'manual';

export type ReconciliationMatchSource =
  | 'order'
  | 'expected_payment'
  | 'pool_contribution';

export type ReconciliationMatchStatus =
  | 'proposed'
  | 'confirmed'
  | 'rejected'
  | 'pending_review';

export type ReconciliationExceptionCategory =
  | 'missing_provider_transaction'
  | 'missing_order'
  | 'amount_mismatch'
  | 'duplicate_payment'
  | 'fee_mismatch'
  | 'settlement_delay'
  | 'unknown_provider_reference'
  | 'overpayment';

export type ReconciliationExceptionStatus =
  | 'open'
  | 'resolved'
  | 'ignored';

export interface ReconciliationMatch {
  id: string;
  profile_id: string;
  transaction_id: string;
  match_source: ReconciliationMatchSource;
  expected_payment_id?: string | null;
  pool_contribution_id?: string | null;
  expected_reference?: string | null;
  expected_amount: number;
  matched_amount: number;
  match_type: ReconciliationMatchType;
  confidence_score: number;
  ai_explanation?: string | null;
  status: ReconciliationMatchStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationException {
  id: string;
  profile_id: string;
  transaction_id?: string | null;
  category: ReconciliationExceptionCategory;
  status: ReconciliationExceptionStatus;
  details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// 7. AI Service & Intelligence Layer Models (§11, §15, §19)
// -------------------------------------------------------------

export type AIInteractionType =
  | 'query'
  | 'support'
  | 'reconciliation'
  | 'document_check'
  | 'fraud_flag';

export interface AIInteraction {
  id: string;
  profile_id: string;
  interaction_type: AIInteractionType;
  input_summary: string;
  output_summary: string;
  confidence_score?: number | null;
  reviewed_by_human: boolean;
  created_at: string;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between' | 'like';
  value: unknown;
}

export interface QueryAnswer {
  answer: string;
  explanation: string;
  filters_applied?: Record<string, unknown>;
  aggregation?: string;
  data?: unknown;
}

// Supporting types for P1 and roadmap methods (stubs)
export interface AnomalyFlag {
  transaction_id: string;
  risk_score: number;
  flag_reason: string;
  suggested_action: 'allow' | 'review' | 'block';
}

export interface RoutingContext {
  amount: number;
  currency: string;
  payer_identifier?: string;
  country?: string;
  priority?: 'speed' | 'cost' | 'reliability';
}

export interface RailRecommendation {
  recommended_rail: string;
  estimated_fee: number;
  confidence_score: number;
  reasoning: string;
}

export interface IdFields {
  full_name?: string;
  id_number?: string;
  date_of_birth?: string;
  nationality?: string;
  expiry_date?: string;
}

export interface DocumentCheckResult {
  is_valid: boolean;
  confidence_score: number;
  extracted_fields: IdFields;
  tamper_flags: string[];
}

export interface DateRange {
  from: string;
  to: string;
}

export interface SupportMessage {
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
}

export interface DelayForecast {
  expected_delay_hours: number;
  is_delayed: boolean;
  reason?: string;
}

/**
 * Bounded AIService Interface (§15)
 * AI never decides, only assists or explains.
 */
export interface AIService {
  // P0 — implemented in Phase 4B
  explainMatch(match: ReconciliationMatch): Promise<string>;
  answerDashboardQuery(profileId: string, query: string): Promise<QueryAnswer>;

  // P1 — typed stubs in Phase 4B
  flagAnomalousActivity(
    profileId: string,
    recentTx: NormalizedTransaction[]
  ): Promise<AnomalyFlag[]>;
  suggestRailRouting(context: RoutingContext): Promise<RailRecommendation>;
  precheckIdDocument(
    imageUrl: string,
    claimedFields: IdFields
  ): Promise<DocumentCheckResult>;
  generateSummary(profileId: string, period: DateRange): Promise<string>;

  // Roadmap — typed stubs in Phase 4B
  draftSupportReply(conversation: SupportMessage[]): Promise<string>;
  predictSettlementDelay(tx: NormalizedTransaction): Promise<DelayForecast>;
}

// -------------------------------------------------------------
// 8. Admin Module Domain Models (§11, §16, §19)
// -------------------------------------------------------------

export type AdminRole = 'super_admin' | 'support' | 'compliance_reviewer';

export interface AdminUser {
  id: string;
  clerk_user_id: string;
  role: AdminRole;
  permissions_json: Record<string, boolean>;
  created_at: string;
}

export type AuditLogActorType = 'admin' | 'system' | 'user';

export interface AuditLog {
  id: string;
  actor_type: AuditLogActorType;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  created_at: string;
}

export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'resolved_refund'
  | 'resolved_rejected';

export interface Dispute {
  id: string;
  transaction_id?: string | null;
  profile_id: string;
  reason: string;
  amount: number;
  currency: string;
  status: DisputeStatus;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RailHealthIndicator {
  adapter_key: string;
  name: string;
  is_enabled: boolean;
  circuit_breaker_state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failure_count: number;
  total_requests: number;
  failed_requests: number;
  error_rate: number;
  last_success_at?: string | null;
}

export interface AdminPlatformMetrics {
  total_volume: number;
  total_transactions: number;
  reconciliation_rate: number;
  exception_rate: number;
  ai_suggestion_acceptance_rate: number;
  total_users: number;
  pending_kyc_count: number;
  open_exceptions_count: number;
  open_disputes_count: number;
  rails_health: RailHealthIndicator[];
}
