/**
 * UniPay API Contracts: §18 Core Endpoints & Phase 4B Additions
 * Used by /backend for routing & /app for typed API client calls
 */

import {
  Profile,
  Alias,
  PaymentIntent,
  Transaction,
  Payout,
  AccountType,
  PaymentRail,
} from './models';

// Standard 501 Not Implemented Response format for Phase 0 stubs
export interface NotImplementedResponse {
  error: 'Not Implemented';
  message: string;
  phase: number;
  route: string;
  method: string;
}

// Standard Error Response format
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

// GET /health
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  db: 'ok' | 'error';
  timestamp: string;
  environment: string;
  version: string;
}

// POST /api/v1/profiles
export interface CreateProfileRequest {
  clerk_id: string;
  account_type: AccountType;
  primary_alias: string;
  display_name: string;
  email?: string;
  phone_number?: string;
  business_name?: string;
  business_registration_number?: string;
}
export interface CreateProfileResponse {
  profile: Profile;
}

// POST /api/v1/profiles/:id/aliases
export interface CreateAliasRequest {
  alias_handle: string;
}
export interface CreateAliasResponse {
  alias: Alias;
}

// GET /api/v1/aliases/:alias
export interface GetAliasResponse {
  alias: Alias;
  profile: Pick<Profile, 'id' | 'display_name' | 'account_type' | 'primary_alias' | 'verification_status'>;
}

// POST /api/v1/checkout/payment-options
export interface CheckoutPaymentOptionsRequest {
  alias: string;
  amount: number;
  currency: 'KES';
}
export interface CheckoutPaymentOptionsResponse {
  recipient_display_name: string;
  recipient_alias: string;
  amount: number;
  available_rails: Array<{
    rail: PaymentRail;
    name: string;
    fee: number;
    estimated_time: string;
  }>;
}

// POST /api/v1/payment-intents
export interface CreatePaymentIntentRequest {
  idempotency_key: string;
  recipient_alias: string;
  amount: number;
  currency: 'KES';
  rail: PaymentRail;
  payer_phone?: string;
  metadata?: Record<string, unknown>;
}
export interface CreatePaymentIntentResponse {
  payment_intent: PaymentIntent;
  instructions?: {
    action_type: 'prompt_pin' | 'redirect_url' | 'manual_paybill';
    checkout_reference?: string;
  };
}

// GET /api/v1/payment-intents/:id
export interface GetPaymentIntentResponse {
  payment_intent: PaymentIntent;
}

// POST /api/v1/payment-intents/:id/retry
export interface RetryPaymentIntentResponse {
  payment_intent: PaymentIntent;
}

// POST /api/v1/webhooks/loop
export interface WebhookLoopResponse {
  received: boolean;
  timestamp: string;
}

// GET /api/v1/transactions
export interface ListTransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}

// POST /api/v1/reconciliation/run
export interface RunReconciliationRequest {
  date_from: string;
  date_to: string;
  rail?: PaymentRail;
}
export interface RunReconciliationResponse {
  job_id: string;
  status: 'started' | 'completed';
  matched_count: number;
  exception_count: number;
}

// GET /api/v1/reconciliation/exceptions
export interface ListReconciliationExceptionsResponse {
  exceptions: Array<{
    id: string;
    transaction_id?: string;
    rail_reference: string;
    amount: number;
    reason: string;
    detected_at: string;
  }>;
}

// GET /api/v1/exports/transactions.csv
// (Returns CSV text stream)

// Identity endpoints
export interface SubmitIdentityRequest {
  id_type: 'national_id' | 'passport' | 'business_permit';
  id_number: string;
  document_front_url?: string;
  document_back_url?: string;
}

export interface GetIdentityResponse {
  status: Profile['verification_status'];
  submitted_at?: string;
  verified_at?: string;
}

// Payouts
export interface CreatePayoutRequest {
  destination_type: 'mpesa_phone' | 'bank_account' | 'loop_account';
  destination_reference: string;
  amount: number;
  currency: 'KES';
}
export interface CreatePayoutResponse {
  payout: Payout;
}

// AI Queries
export interface AiQueryRequest {
  prompt: string;
  context_profile_id?: string;
}
export interface AiQueryResponse {
  response: string;
  suggested_actions?: string[];
  sources_cited?: string[];
}

// Phase 4B Expected Payments
export interface CreateExpectedPaymentRequest {
  payer_identifier: string;
  expected_amount: number;
  currency: 'KES';
  due_date?: string;
  reference_tag: string;
}

// Phase 4B Pools
export interface CreatePoolRequest {
  title: string;
  description?: string;
  target_amount: number;
  currency: 'KES';
  deadline?: string;
}
