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
import { CircuitBreaker, CircuitBreakerOptions } from '../resilience/circuit-breaker';
import { retryWithJitter, RetryOptions } from '../resilience/retry';

export interface ResilientWrapperOptions {
  circuitBreaker?: CircuitBreakerOptions;
  retry?: RetryOptions;
}

export class ResilientAdapterWrapper implements PaymentProviderAdapter {
  private readonly adapter: PaymentProviderAdapter;
  private readonly breaker: CircuitBreaker;
  private readonly retryOptions: RetryOptions;

  constructor(adapter: PaymentProviderAdapter, options: ResilientWrapperOptions = {}) {
    this.adapter = adapter;
    this.breaker = new CircuitBreaker(options.circuitBreaker);
    this.retryOptions = options.retry || {};
  }

  name(): string {
    return this.adapter.name();
  }

  capabilities(): ProviderCapabilities {
    return this.adapter.capabilities();
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.breaker;
  }

  getUnderlyingAdapter(): PaymentProviderAdapter {
    return this.adapter;
  }

  async createPayment(request: PaymentRequest): Promise<ProviderPaymentResult> {
    return this.breaker.execute(() =>
      retryWithJitter(() => this.adapter.createPayment(request), this.retryOptions)
    );
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    return this.breaker.execute(() =>
      retryWithJitter(() => this.adapter.getStatus(providerReference), this.retryOptions)
    );
  }

  async refund(request: RefundRequest): Promise<ProviderRefundResult> {
    return this.breaker.execute(() =>
      retryWithJitter(() => this.adapter.refund(request), this.retryOptions)
    );
  }

  async disburse(request: DisbursementRequest): Promise<ProviderPayoutResult> {
    return this.breaker.execute(() =>
      retryWithJitter(() => this.adapter.disburse(request), this.retryOptions)
    );
  }

  normalize(payload: unknown): NormalizedTransaction {
    return this.adapter.normalize(payload);
  }

  verifyWebhook(req: unknown): boolean {
    return this.adapter.verifyWebhook(req);
  }
}
