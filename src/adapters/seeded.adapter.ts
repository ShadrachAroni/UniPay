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
  WebhookRequestLike,
} from '../types/payment-provider.js';

export interface SeededRawTransactionPayload {
  seeded_tx_id: string;
  order_ref: string;
  amount_kes: number;
  fee_kes: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  payer_mobile?: string;
  created_at: string;
  settled_at?: string;
}

export class SeededPaymentAdapter implements PaymentProviderAdapter {
  private paymentStore: Map<string, SeededRawTransactionPayload> = new Map();
  private refundStore: Map<string, { refund_id: string; amount: number; status: 'completed' | 'failed' }> = new Map();
  private payoutStore: Map<string, { payout_id: string; amount: number; status: 'completed' | 'failed' }> = new Map();

  name(): string {
    return 'seeded';
  }

  capabilities(): ProviderCapabilities {
    return {
      collection: true,
      statusInquiry: true,
      refund: true,
      disbursement: true,
      webhooks: true,
      supportedCurrencies: ['KES'],
      supportedCountries: ['KE'],
    };
  }

  async createPayment(request: PaymentRequest): Promise<ProviderPaymentResult> {
    // Deterministic status based on orderReference prefix
    let status: 'pending' | 'completed' | 'failed' = 'completed';
    let rawStatus: 'PENDING' | 'SUCCESS' | 'FAILED' = 'SUCCESS';

    if (request.orderReference.startsWith('FAIL_')) {
      status = 'failed';
      rawStatus = 'FAILED';
    } else if (request.orderReference.startsWith('PEND_')) {
      status = 'pending';
      rawStatus = 'PENDING';
    }

    const providerReference = `SEEDED_PAY_${request.idempotencyKey}`;
    const rawPayload: SeededRawTransactionPayload = {
      seeded_tx_id: providerReference,
      order_ref: request.orderReference,
      amount_kes: request.amount,
      fee_kes: Math.round(request.amount * 0.01 * 100) / 100, // 1% fee
      status: rawStatus,
      payer_mobile: request.payerPhone ?? '+254700000000',
      created_at: new Date().toISOString(),
      settled_at: rawStatus === 'SUCCESS' ? new Date().toISOString() : undefined,
    };

    this.paymentStore.set(providerReference, rawPayload);

    return {
      providerReference,
      status,
      rawResponse: rawPayload,
    };
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    const record = this.paymentStore.get(providerReference);
    if (!record) {
      return {
        providerReference,
        status: 'failed',
        rawResponse: { error: 'Transaction not found in Seeded store' },
      };
    }

    let status: 'created' | 'pending' | 'completed' | 'failed' | 'expired' = 'completed';
    if (record.status === 'PENDING') status = 'pending';
    else if (record.status === 'FAILED') status = 'failed';
    else if (record.status === 'REVERSED') status = 'failed';

    return {
      providerReference: record.seeded_tx_id,
      status,
      amount: record.amount_kes,
      currency: 'KES',
      rawResponse: record,
    };
  }

  async refund(request: RefundRequest): Promise<ProviderRefundResult> {
    const record = this.paymentStore.get(request.providerReference);
    const refundReference = `SEEDED_REF_${request.idempotencyKey}`;

    if (!record || record.status !== 'SUCCESS') {
      return {
        refundReference,
        status: 'failed',
        rawResponse: { error: 'Original transaction not eligible for refund' },
      };
    }

    const resultStatus = request.reason?.includes('FAIL') ? 'failed' : 'completed';
    this.refundStore.set(refundReference, {
      refund_id: refundReference,
      amount: request.amount,
      status: resultStatus,
    });

    return {
      refundReference,
      status: resultStatus,
      rawResponse: {
        refund_id: refundReference,
        original_tx: request.providerReference,
        amount: request.amount,
        currency: request.currency,
        status: resultStatus.toUpperCase(),
      },
    };
  }

  async disburse(request: DisbursementRequest): Promise<ProviderPayoutResult> {
    const disbursementReference = `SEEDED_DISB_${request.idempotencyKey}`;
    const resultStatus = request.recipientIdentifier.includes('INVALID') ? 'failed' : 'completed';

    this.payoutStore.set(disbursementReference, {
      payout_id: disbursementReference,
      amount: request.amount,
      status: resultStatus,
    });

    return {
      disbursementReference,
      status: resultStatus === 'completed' ? 'completed' : 'failed',
      rawResponse: {
        disbursement_id: disbursementReference,
        recipient: request.recipientIdentifier,
        amount: request.amount,
        currency: request.currency,
        status: resultStatus.toUpperCase(),
      },
    };
  }

  normalize(payload: unknown): NormalizedTransaction {
    const data = payload as SeededRawTransactionPayload;
    if (!data || typeof data !== 'object' || !('seeded_tx_id' in data)) {
      throw new Error('Invalid raw payload for Seeded payment normalization');
    }

    let paymentStatus: 'initiated' | 'successful' | 'failed' | 'reversed' = 'successful';
    let settlementStatus: 'pending' | 'settled' | 'delayed' = 'settled';

    if (data.status === 'PENDING') {
      paymentStatus = 'initiated';
      settlementStatus = 'pending';
    } else if (data.status === 'FAILED') {
      paymentStatus = 'failed';
      settlementStatus = 'pending';
    } else if (data.status === 'REVERSED') {
      paymentStatus = 'reversed';
      settlementStatus = 'pending';
    }

    const providerFee = data.fee_kes ?? 0;
    const netAmount = data.amount_kes - providerFee;

    return {
      internalReference: `INT_${data.seeded_tx_id}`,
      externalReference: data.seeded_tx_id,
      provider: 'seeded',
      rail: 'seeded',
      amount: data.amount_kes,
      currency: 'KES',
      providerFee,
      netAmount,
      payerIdentifier: data.payer_mobile,
      paymentStatus,
      settlementStatus,
      refundStatus: 'none',
      transactionTime: new Date(data.created_at || Date.now()),
      rawPayload: payload,
    };
  }

  verifyWebhook(req: WebhookRequestLike): boolean {
    const signatureHeader = req.headers['x-seeded-signature'];
    if (Array.isArray(signatureHeader)) {
      return signatureHeader.includes('valid-seeded-signature');
    }
    return signatureHeader === 'valid-seeded-signature';
  }
}
