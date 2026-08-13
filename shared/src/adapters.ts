/**
 * UniPay Provider-Adapter Architecture Interface
 * Ground Truth: §9 / §9b (Solution Architecture, Scalability)
 * Phase 2 will implement LoopPaymentProviderAdapter against this interface.
 */

import { PaymentRail, PaymentStatus } from './models';

export interface InitiatePaymentParams {
  idempotencyKey: string;
  amount: number;
  currency: 'KES';
  senderPhone?: string;
  recipientIdentifier: string; // Account / Till / Paybill / Phone
  narrative?: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResult {
  providerReference: string;
  status: PaymentStatus;
  rawResponse: Record<string, unknown>;
}

export interface VerifyTransactionParams {
  providerReference: string;
  originalIdempotencyKey?: string;
}

export interface VerifyTransactionResult {
  providerReference: string;
  status: PaymentStatus;
  amount: number;
  currency: 'KES';
  timestamp: string;
  rawResponse: Record<string, unknown>;
}

export interface BalanceQueryResult {
  currency: 'KES';
  availableBalance: number;
  ledgerBalance: number;
  asOf: string;
}

export interface DisbursePayoutParams {
  payoutId: string;
  amount: number;
  currency: 'KES';
  destinationType: 'mpesa' | 'bank_account' | 'loop_till';
  destinationIdentifier: string;
  narration?: string;
}

export interface DisbursePayoutResult {
  payoutReference: string;
  status: 'pending' | 'success' | 'failed';
  rawResponse: Record<string, unknown>;
}

export interface WebhookEventPayload {
  provider: PaymentRail;
  eventType: string;
  providerReference: string;
  amount?: number;
  status: PaymentStatus;
  signature?: string;
  rawPayload: Record<string, unknown>;
}

/**
 * Universal Payment Provider Adapter Interface
 * Every payment rail (LOOP, M-Pesa, PesaLink) implements this contract.
 */
export interface PaymentProviderAdapter {
  readonly rail: PaymentRail;
  readonly isSandbox: boolean;

  /**
   * Initiates a payment collection or push transaction on the rail
   */
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;

  /**
   * Verifies the status of a previously initiated transaction
   */
  verifyTransaction(params: VerifyTransactionParams): Promise<VerifyTransactionResult>;

  /**
   * Queries balance on the linked merchant / institutional pool account
   */
  queryBalance(): Promise<BalanceQueryResult>;

  /**
   * Disburses funds out to a recipient phone or bank account
   */
  disbursePayout(params: DisbursePayoutParams): Promise<DisbursePayoutResult>;

  /**
   * Validates and normalizes incoming webhook payloads
   */
  parseAndVerifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown
  ): Promise<WebhookEventPayload>;
}
