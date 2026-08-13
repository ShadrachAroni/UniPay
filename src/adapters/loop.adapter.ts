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
import { UnimplementedPhase3Error } from '../errors/payment.errors.js';

export class LoopAdapter implements PaymentProviderAdapter {
  name(): string {
    return 'loop';
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

  async createPayment(_request: PaymentRequest): Promise<ProviderPaymentResult> {
    throw new UnimplementedPhase3Error('LoopAdapter.createPayment');
  }

  async getStatus(_providerReference: string): Promise<ProviderStatusResult> {
    throw new UnimplementedPhase3Error('LoopAdapter.getStatus');
  }

  async refund(_request: RefundRequest): Promise<ProviderRefundResult> {
    throw new UnimplementedPhase3Error('LoopAdapter.refund');
  }

  async disburse(_request: DisbursementRequest): Promise<ProviderPayoutResult> {
    throw new UnimplementedPhase3Error('LoopAdapter.disburse');
  }

  normalize(_payload: unknown): NormalizedTransaction {
    throw new UnimplementedPhase3Error('LoopAdapter.normalize');
  }

  verifyWebhook(_req: WebhookRequestLike): boolean {
    throw new UnimplementedPhase3Error('LoopAdapter.verifyWebhook');
  }
}
