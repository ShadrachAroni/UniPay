/**
 * UniPay Core Domain Models
 * Ground Truth: §11 (Data Model) & §9b (Architecture)
 */

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

export type PayoutStatus = 'pending' | 'processing' | 'success' | 'failed';

export type MoneyDirectionRuleType =
  | 'split_percentage'
  | 'fixed_fee'
  | 'conditional_route';

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
  destination_type: 'mpesa_phone' | 'bank_account' | 'loop_account';
  destination_reference: string;
  amount: number;
  currency: 'KES';
  status: PayoutStatus;
  created_at: string;
  updated_at: string;
}
