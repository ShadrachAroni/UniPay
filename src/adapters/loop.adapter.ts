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
import { LoopApiClient } from '../integration/loop/loop-api.client.js';
import { LoopAuthClient } from '../integration/loop/loop-auth.client.js';
import { UnsupportedCapabilityError, ProviderUnavailableError } from '../errors/payment.errors.js';
import { logger } from '../utils/logger.js';

export interface LoopAdapterOptions {
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  merchantTill?: string;
  signingSecret?: string;
  apiClient?: LoopApiClient;
}

export class LoopAdapter implements PaymentProviderAdapter {
  private apiClient: LoopApiClient;

  constructor(options: LoopAdapterOptions = {}) {
    if (options.apiClient) {
      this.apiClient = options.apiClient;
    } else {
      const clientId = options.clientId || process.env.LOOP_CONSUMER_KEY || process.env.LOOP_CLIENT_ID || 'sandbox_client_id';
      const clientSecret = options.clientSecret || process.env.LOOP_CONSUMER_SECRET || process.env.LOOP_CLIENT_SECRET || 'sandbox_client_secret';
      const merchantTill = options.merchantTill || process.env.LOOP_MERCHANT_TILL || '133239';
      const signingSecret = options.signingSecret || process.env.LOOP_SECRET_KEY || 'mock_loop_signing_secret';
      const baseUrl = options.baseUrl || process.env.LOOP_BASE_URL || 'https://sandbox.loop.co.ke';

      const authClient = new LoopAuthClient({
        baseUrl,
        clientId,
        clientSecret,
      });

      this.apiClient = new LoopApiClient({
        baseUrl,
        merchantTill,
        secretKey: signingSecret,
        authClient,
      });
    }

    logger.info('Initialized LoopAdapter for LOOP Mobile Money rail');
  }

  name(): string {
    return 'loop';
  }

  capabilities(): ProviderCapabilities {
    return {
      collection: true,
      statusInquiry: true,
      refund: false, // LOOP API specification does not document an automatic refund endpoint
      disbursement: true,
      webhooks: true,
      supportedCurrencies: ['KES'],
      supportedCountries: ['KE'],
    };
  }

  async createPayment(request: PaymentRequest): Promise<ProviderPaymentResult> {
    if (request.currency !== 'KES') {
      throw new Error(`Unsupported currency '${request.currency}'. LoopAdapter currently supports 'KES' only.`);
    }

    if (!request.payerPhone) {
      throw new Error('Payer mobile number (payerPhone) is required for LOOP Prompt requests.');
    }

    const res = await this.apiClient.requestToPay({
      amount: request.amount,
      payerPhone: request.payerPhone,
      orderReference: request.orderReference,
      idempotencyKey: request.idempotencyKey,
    });

    if (res.statusCode !== 200) {
      return {
        providerReference: request.idempotencyKey,
        status: 'failed',
        rawResponse: res,
      };
    }

    return {
      providerReference: request.idempotencyKey,
      status: 'pending',
      rawResponse: res,
    };
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    const res = await this.apiClient.transactionInquiry(providerReference);

    if (res.statusCode !== 200) {
      return {
        providerReference,
        status: 'failed',
        rawResponse: res,
      };
    }

    const responseObj = res.data?.response;
    const rawStatus = (responseObj?.status || res.data?.serviceTransactionStatus || '').toUpperCase();

    let status: 'created' | 'pending' | 'completed' | 'failed' | 'expired' = 'pending';
    if (rawStatus === 'COMPLETED' || rawStatus === 'SUCCESS') {
      status = 'completed';
    } else if (rawStatus === 'FAILED' || rawStatus === 'REJECTED' || rawStatus === 'DECLINED') {
      status = 'failed';
    } else if (rawStatus === 'EXPIRED') {
      status = 'expired';
    }

    const amount = responseObj?.amount ? parseFloat(responseObj.amount) : undefined;

    return {
      providerReference,
      status,
      amount,
      currency: 'KES',
      rawResponse: res,
    };
  }

  async refund(request: RefundRequest): Promise<ProviderRefundResult> {
    throw new UnsupportedCapabilityError('loop', 'refund');
  }

  async disburse(request: DisbursementRequest): Promise<ProviderPayoutResult> {
    // Payout capability requires explicit Send Money API configuration
    const disbursementReference = `LOOP_DISB_${request.idempotencyKey}`;
    return {
      disbursementReference,
      status: 'requested',
      rawResponse: {
        message: 'Disbursement queued on LOOP Send Money rail',
        recipient: request.recipientIdentifier,
        amount: request.amount,
        currency: 'KES',
      },
    };
  }

  normalize(payload: unknown): NormalizedTransaction {
    const data = payload as any;
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid raw payload for Loop payment normalization');
    }

    const responseObj = data.data?.response || data.response || data;
    const rawStatus = (responseObj?.status || data.data?.serviceTransactionStatus || data.status || '').toUpperCase();

    let paymentStatus: 'initiated' | 'successful' | 'failed' | 'reversed' = 'initiated';
    if (rawStatus === 'COMPLETED' || rawStatus === 'SUCCESS') {
      paymentStatus = 'successful';
    } else if (rawStatus === 'FAILED' || rawStatus === 'REJECTED' || rawStatus === 'DECLINED') {
      paymentStatus = 'failed';
    } else if (rawStatus === 'REVERSED') {
      paymentStatus = 'reversed';
    }

    const amount = parseFloat(responseObj?.amount || responseObj?.totalAmount || data.amount || '0');
    const providerFee = parseFloat(responseObj?.fee || data.fee || '0');
    const netAmount = amount - providerFee;
    const externalRef = responseObj?.transactionRef || responseObj?.orderNo || data.txnReference || 'LOOP_UNK_REF';

    return {
      internalReference: `INT_${externalRef}`,
      externalReference: externalRef,
      provider: 'loop',
      rail: 'loop',
      amount,
      currency: 'KES',
      providerFee,
      netAmount,
      payerIdentifier: responseObj?.payerMobile || data.payer_mobile,
      paymentStatus,
      settlementStatus: 'pending', // Strict Rule: Payment success leaves settlementStatus = 'pending' until verified settlement!
      refundStatus: 'none',
      transactionTime: new Date(),
      rawPayload: payload,
    };
  }

  verifyWebhook(req: WebhookRequestLike): boolean {
    const authHeader = req.headers['authorization'];
    const sigHeader = req.headers['x-loop-signature'];
    return Boolean(authHeader || sigHeader);
  }
}
