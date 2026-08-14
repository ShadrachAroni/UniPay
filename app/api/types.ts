export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type SettlementStatus = 'pending' | 'processing' | 'settled' | 'failed';

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
  settled_at?: string;
}

export interface ReconciliationMatch {
  id: string;
  transaction_id: string;
  confidence_score: number;
  ai_explanation: string;
  match_type: 'exact' | 'partial' | 'ai_inferred';
  status: 'pending' | 'approved' | 'rejected';
}

export type AccountType = 'individual' | 'business' | 'personal';
export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'unsubmitted'
  | 'submitted';

export interface Profile {
  id: string;
  account_type: AccountType;
  display_name: string;
  owner_name: string;
  business_name?: string;
  phone?: string;
  email?: string;
  currency?: string;
  verification_status: VerificationStatus;
  admin_role?: 'super_admin' | 'support' | 'compliance_reviewer' | null;
  id_document_url?: string;
}

export type PaymentIntentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface PaymentIntent {
  id: string;
  recipient_profile_id: string;
  amount: number;
  currency: string;
  payer_phone: string;
  status: PaymentIntentStatus;
  provider_reference?: string;
}

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Payout {
  id: string;
  profile_id: string;
  requested_amount: number;
  destination_reference: string;
  status: PayoutStatus;
  requested_at: string;
}

export type AllocationType = 'full' | 'percentage' | 'fixed_amount';

export interface MoneyDirectionRule {
  id: string;
  profile_id: string;
  destination_type: 'bank' | 'mobile_money' | 'wallet';
  allocation_type: AllocationType;
  allocation_value: number;
  priority_order: number;
  is_active: boolean;
}

export type ExpectedPaymentStatus =
  | 'open'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface ExpectedPayment {
  id: string;
  owner_profile_id: string;
  payer_reference?: string;
  amount: number;
  reference: string;
  due_at: string;
  status: ExpectedPaymentStatus;
  amount_paid_to_date: number;
}

export type PoolStatus = 'open' | 'closed' | 'settled';

export interface PaymentPool {
  id: string;
  owner_profile_id: string;
  title: string;
  target_amount: number;
  status: PoolStatus;
  deadline?: string;
}

export type ContributionStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface PoolContribution {
  id: string;
  pool_id: string;
  contributor_reference: string;
  expected_amount: number;
  amount_paid: number;
  status: ContributionStatus;
  transaction_id?: string;
}
