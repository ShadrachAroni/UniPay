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
  private totalRequests = 0;
  private failedRequests = 0;
  private lastSuccessAt: string | null = null;

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

  getHealthStats() {
    const breakerState = this.breaker.getState();
    const failureCount = this.breaker.getFailureCount();
    const errorRate = this.totalRequests > 0 ? this.failedRequests / this.totalRequests : 0;
    return {
      circuitBreakerState: breakerState,
      failureCount,
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      errorRate,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  private async trackExecution<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    try {
      const res = await this.breaker.execute(() => retryWithJitter(fn, this.retryOptions));
      this.lastSuccessAt = new Date().toISOString();
      return res;
    } catch (err) {
      this.failedRequests++;
      throw err;
    }
  }

  async createPayment(request: PaymentRequest): Promise<ProviderPaymentResult> {
    return this.trackExecution(() => this.adapter.createPayment(request));
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    return this.trackExecution(() => this.adapter.getStatus(providerReference));
  }

  async refund(request: RefundRequest): Promise<ProviderRefundResult> {
    return this.trackExecution(() => this.adapter.refund(request));
  }

  async disburse(request: DisbursementRequest): Promise<ProviderPayoutResult> {
    return this.trackExecution(() => this.adapter.disburse(request));
  }

  normalize(payload: unknown): NormalizedTransaction {
    return this.adapter.normalize(payload);
  }

  verifyWebhook(req: unknown): boolean {
    return this.adapter.verifyWebhook(req);
  }
}

