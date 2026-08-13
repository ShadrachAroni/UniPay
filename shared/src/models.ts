/**
 * UniPay Core Domain Models
 * Ground Truth: §11 (Data Model) & §9b (Architecture)
 */

export type AccountType = 'individual' | 'business';

export type VerificationStatus =
  | 'unverified'
  | 'submitted'
  | 'in_review'
  | 'verified'
  | 'rejected';

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
  clerk_id: string;
  account_type: AccountType;
  primary_alias: string;
  display_name: string;
  email?: string;
  phone_number?: string;
  verification_status: VerificationStatus;
  business_name?: string;
  business_registration_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Alias {
  id: string;
  profile_id: string;
  alias_handle: string; // e.g. "shadrach" or "mama-mboga"
  qr_code_url: string;
  is_active: boolean;
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
