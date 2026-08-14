import crypto from 'crypto';
import {
  PaymentProviderAdapter,
  ProviderCapabilities,
  PaymentRequest,
  ProviderPaymentResult,
  ProviderStatusResult,
  RefundRequest,
  ProviderRefundResult,
  DisbursementRequest,
  ProviderPayoutResult,
  NormalizedTransaction,
} from '@unipay/shared';

export class SeededRailAdapter implements PaymentProviderAdapter {
  private simulateFailure = false;
  private failureCount = 0;
  private failureMessage = 'Simulated SeededRailAdapter failure';
  private mockStatuses = new Map<string, ProviderStatusResult['status']>();
  private readonly providerName: string;
  private readonly currency: string;

  constructor(providerName = 'seeded', currency = 'KES') {
    this.providerName = providerName;
    this.currency = currency;
  }

  name(): string {
    return this.providerName;
  }

  capabilities(): ProviderCapabilities {
    return {
      collection: true,
      statusInquiry: true,
      refund: true,
      disbursement: true,
      webhooks: true,
      supportedCurrencies: [this.currency],
      supportedCountries: ['KE'],
      settlementEstimate: 'instant',
      feeStructure: {
        fixed: 0,
        percentage: 0.005, // 0.5% fee estimate
      },
    };
  }

  // --- Testing & Simulation Hooks ---
  setSimulateFailure(fail: boolean, message?: string): void {
    this.simulateFailure = fail;
    if (message) this.failureMessage = message;
  }

  simulateFailureNextTimes(count: number, message?: string): void {
    this.failureCount = count;
    if (message) this.failureMessage = message;
  }

  setMockStatus(providerReference: string, status: ProviderStatusResult['status']): void {
    this.mockStatuses.set(providerReference, status);
  }

  reset(): void {
    this.simulateFailure = false;
    this.failureCount = 0;
    this.mockStatuses.clear();
  }

  private checkSimulatedFailure(): void {
    if (this.simulateFailure) {
      throw new Error(this.failureMessage);
    }
    if (this.failureCount > 0) {
      this.failureCount--;
      throw new Error(this.failureMessage);
    }
  }

  async createPayment(request: PaymentRequest): Promise<ProviderPaymentResult> {
    this.checkSimulatedFailure();

    // Async simulated delay (1ms)
    await new Promise((r) => setTimeout(r, 1));

    const providerReference = `SEEDED_PAY_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const rawResponse = {
      provider: this.providerName,
      reference: providerReference,
      amount: request.amount,
      currency: request.currency || this.currency,
      orderReference: request.orderReference,
      idempotencyKey: request.idempotencyKey,
      payerPhone: request.payerPhone || null,
      payerEmail: request.payerEmail || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    return {
      providerReference,
      status: 'pending',
      rawResponse,
    };
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    this.checkSimulatedFailure();

    await new Promise((r) => setTimeout(r, 1));

    const configuredStatus = this.mockStatuses.get(providerReference) || 'completed';

    return {
      providerReference,
      status: configuredStatus,
      amount: 3000,
      currency: this.currency,
      rawResponse: {
        provider: this.providerName,
        reference: providerReference,
        status: configuredStatus.toUpperCase(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  async refund(request: RefundRequest): Promise<ProviderRefundResult> {
    this.checkSimulatedFailure();

    await new Promise((r) => setTimeout(r, 1));

    const refundReference = `SEEDED_REF_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    return {
      refundReference,
      status: 'completed',
      rawResponse: {
        provider: this.providerName,
        refundReference,
        originalReference: request.providerReference,
        amount: request.amount,
        currency: request.currency || this.currency,
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async disburse(request: DisbursementRequest): Promise<ProviderPayoutResult> {
    this.checkSimulatedFailure();

    await new Promise((r) => setTimeout(r, 1));

    const disbursementReference = `SEEDED_DISB_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    return {
      disbursementReference,
      status: 'completed',
      rawResponse: {
        provider: this.providerName,
        disbursementReference,
        recipientIdentifier: request.recipientIdentifier,
        amount: request.amount,
        currency: request.currency || this.currency,
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
      },
    };
  }

  normalize(payload: unknown): NormalizedTransaction {
    const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, any>;
    const amount = Number(data.amount || data.gross_amount || 0);
    const feeRate = 0.005; // 0.5%
    const providerFee = Number(data.provider_fee || data.fee || (amount * feeRate));
    const netAmount = Number(data.net_amount || (amount - providerFee));

    let paymentStatus: NormalizedTransaction['payment_status'] = 'successful';
    const rawStatus = String(data.status || '').toLowerCase();
    if (rawStatus === 'pending' || rawStatus === 'created' || rawStatus === 'initiated') {
      paymentStatus = 'initiated';
    } else if (rawStatus === 'failed' || rawStatus === 'expired') {
      paymentStatus = 'failed';
    } else if (rawStatus === 'reversed') {
      paymentStatus = 'reversed';
    } else if (rawStatus === 'completed' || rawStatus === 'successful' || rawStatus === 'success') {
      paymentStatus = 'successful';
    }

    return {
      provider: this.providerName,
      rail: 'request_to_pay',
      internal_reference: data.internal_reference || `INT_${crypto.randomUUID().slice(0, 8)}`,
      external_reference: data.reference || data.providerReference || data.external_reference || 'EXT_SEEDED',
      amount,
      currency: data.currency || this.currency,
      provider_fee: providerFee,
      net_amount: netAmount,
      payer_identifier: data.payerPhone || data.payer_identifier || data.payerEmail || null,
      payment_status: paymentStatus,
      settlement_status: 'settled',
      refund_status: 'none',
      transaction_time: data.created_at || data.timestamp || data.transaction_time || new Date().toISOString(),
      raw_payload: payload,
    };
  }

  verifyWebhook(_req: unknown): boolean {
    // Seeded adapter fixture verifies unconditionally
    return true;
  }
}
