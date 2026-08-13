/**
 * UniPay Provider-Adapter Architecture Interface & Supporting Types
 * Ground Truth: §9b, §10, §11 (UniPay Technical Documentation)
 * 
 * Every payment rail (LOOP today, seeded fixture, M-Pesa/PesaLink later)
 * must implement this contract identically so checkout, the ledger,
 * and reconciliation never contain rail-specific logic.
 */

export interface ProviderCapabilities {
  collection: boolean;
  statusInquiry: boolean;
  refund: boolean;
  disbursement: boolean;
  webhooks: boolean;
  supportedCurrencies: string[];
  supportedCountries: string[];
  settlementEstimate?: string;
  feeStructure?: {
    fixed?: number;
    percentage?: number;
  };
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  orderReference: string;
  idempotencyKey: string;
  payerPhone?: string | null;
  payerEmail?: string | null;
  payerIdentifier?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProviderPaymentResult {
  providerReference: string;
  status: 'created' | 'pending' | 'completed' | 'failed';
  rawResponse: unknown;
}

export interface ProviderStatusResult {
  providerReference: string;
  status: 'created' | 'pending' | 'completed' | 'failed' | 'expired';
  amount?: number;
  currency?: string;
  rawResponse: unknown;
}

export interface RefundRequest {
  providerReference: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  reason?: string;
}

export interface ProviderRefundResult {
  refundReference: string;
  status: 'pending' | 'completed' | 'failed';
  rawResponse: unknown;
}

export interface DisbursementRequest {
  recipientIdentifier: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  remarks?: string;
}

export interface ProviderPayoutResult {
  disbursementReference: string;
  status: 'requested' | 'processing' | 'completed' | 'failed';
  rawResponse: unknown;
}

/**
 * NormalizedTransaction matches the `transactions` table columns (§11):
 * provider, rail, internal_reference, external_reference, amount, currency,
 * provider_fee, net_amount, payer_identifier, payment_status, settlement_status,
 * refund_status, transaction_time, raw_payload
 */
export interface NormalizedTransaction {
  provider: string;
  rail: string;
  internal_reference: string;
  external_reference: string;
  amount: number;
  currency: string;
  provider_fee: number;
  net_amount: number;
  payer_identifier: string | null;
  payment_status: 'initiated' | 'successful' | 'failed' | 'reversed';
  settlement_status: 'pending' | 'settled' | 'delayed';
  refund_status: 'none' | 'partial' | 'full';
  transaction_time: string | Date;
  raw_payload: unknown;
}

/**
 * Webhook validation request wrapper
 */
export interface WebhookRequestLike {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, unknown>;
}

/**
 * Universal Payment Provider Adapter Interface (§10)
 */
export interface PaymentProviderAdapter {
  name(): string;
  capabilities(): ProviderCapabilities;
  createPayment(request: PaymentRequest): Promise<ProviderPaymentResult>;
  getStatus(providerReference: string): Promise<ProviderStatusResult>;
  refund(request: RefundRequest): Promise<ProviderRefundResult>;
  disburse(request: DisbursementRequest): Promise<ProviderPayoutResult>;
  normalize(payload: unknown): NormalizedTransaction;
  verifyWebhook(req: unknown): boolean;
}
