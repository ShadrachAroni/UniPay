/**
 * UniPay Provider-Adapter Architecture Interface (§10)
 * Ground Truth: §9 / §9b / §10 (Solution Architecture, Provider Adapter Interface)
 * 
 * Every payment rail adapter (LOOP, Seeded/Future-Rail, M-Pesa, PesaLink) implements this contract.
 */

export interface ProviderCapabilities {
  collection: boolean;
  statusInquiry: boolean;
  refund: boolean;
  disbursement: boolean;
  webhooks: boolean;
  supportedCurrencies: string[];
  supportedCountries: string[];
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  payerPhone?: string;
  payerEmail?: string;
  orderReference: string;
  idempotencyKey: string;
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
  reason?: string;
  idempotencyKey: string;
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

export interface NormalizedTransaction {
  internalReference: string;
  externalReference: string;
  provider: string;
  rail: string;
  amount: number;
  currency: string;
  providerFee: number;
  netAmount: number;
  payerIdentifier?: string;
  paymentStatus: 'initiated' | 'successful' | 'failed' | 'reversed';
  settlementStatus: 'pending' | 'settled' | 'delayed';
  refundStatus: 'none' | 'partial' | 'full';
  transactionTime: Date;
  rawPayload: unknown;
}

export interface WebhookRequestLike {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

/**
 * Universal Payment Provider Adapter Interface (§10)
 * Exact method signature contract required by Phase 2 DoD.
 */
export interface PaymentProviderAdapter {
  name(): string;
  capabilities(): ProviderCapabilities;
  createPayment(request: PaymentRequest): Promise<ProviderPaymentResult>;
  getStatus(providerReference: string): Promise<ProviderStatusResult>;
  refund(request: RefundRequest): Promise<ProviderRefundResult>;
  disburse(request: DisbursementRequest): Promise<ProviderPayoutResult>;
  normalize(payload: unknown): NormalizedTransaction;
  verifyWebhook(req: WebhookRequestLike): boolean;
}
