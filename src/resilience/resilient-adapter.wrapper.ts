import {
  PaymentProviderAdapter,
  PaymentRequest,
  ProviderPaymentResult,
  ProviderStatusResult,
  RefundRequest,
  ProviderRefundResult,
  DisbursementRequest,
  ProviderPayoutResult,
  NormalizedTransaction,
  ProviderCapabilities,
  WebhookRequestLike,
} from '../types/payment-provider.js';
import { CircuitBreaker, CircuitBreakerOptions } from './circuit-breaker.js';
import { retryWithBackoffAndJitter, RetryOptions } from './retry.js';
import { logger } from '../utils/logger.js';

export interface ResilienceConfig {
  circuitBreaker?: Partial<CircuitBreakerOptions>;
  retry?: Partial<RetryOptions>;
}

export class ResilientPaymentAdapter implements PaymentProviderAdapter {
  public readonly circuitBreaker: CircuitBreaker;
  private retryOptions: RetryOptions;

  constructor(
    private readonly innerAdapter: PaymentProviderAdapter,
    config: ResilienceConfig = {}
  ) {
    const adapterKey = innerAdapter.name();
    this.circuitBreaker = new CircuitBreaker({
      adapterKey,
      ...config.circuitBreaker,
    });
    this.retryOptions = {
      adapterKey,
      ...config.retry,
    };
  }

  name(): string {
    return this.innerAdapter.name();
  }

  capabilities(): ProviderCapabilities {
    return this.innerAdapter.capabilities();
  }

  async createPayment(request: PaymentRequest): Promise<ProviderPaymentResult> {
    const start = Date.now();
    return this.circuitBreaker.execute(async () => {
      return retryWithBackoffAndJitter(
        'createPayment',
        async () => {
          const res = await this.innerAdapter.createPayment(request);
          logger.info(`createPayment succeeded on adapter '${this.name()}'`, {
            adapter_key: this.name(),
            operation: 'createPayment',
            duration_ms: Date.now() - start,
            outcome: 'success',
            circuit_state: this.circuitBreaker.getState(),
          });
          return res;
        },
        this.retryOptions
      );
    });
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    const start = Date.now();
    return this.circuitBreaker.execute(async () => {
      return retryWithBackoffAndJitter(
        'getStatus',
        async () => {
          const res = await this.innerAdapter.getStatus(providerReference);
          logger.info(`getStatus succeeded on adapter '${this.name()}'`, {
            adapter_key: this.name(),
            operation: 'getStatus',
            duration_ms: Date.now() - start,
            outcome: 'success',
            circuit_state: this.circuitBreaker.getState(),
          });
          return res;
        },
        this.retryOptions
      );
    });
  }

  async refund(request: RefundRequest): Promise<ProviderRefundResult> {
    const start = Date.now();
    return this.circuitBreaker.execute(async () => {
      return retryWithBackoffAndJitter(
        'refund',
        async () => {
          const res = await this.innerAdapter.refund(request);
          logger.info(`refund succeeded on adapter '${this.name()}'`, {
            adapter_key: this.name(),
            operation: 'refund',
            duration_ms: Date.now() - start,
            outcome: 'success',
            circuit_state: this.circuitBreaker.getState(),
          });
          return res;
        },
        this.retryOptions
      );
    });
  }

  async disburse(request: DisbursementRequest): Promise<ProviderPayoutResult> {
    const start = Date.now();
    return this.circuitBreaker.execute(async () => {
      return retryWithBackoffAndJitter(
        'disburse',
        async () => {
          const res = await this.innerAdapter.disburse(request);
          logger.info(`disburse succeeded on adapter '${this.name()}'`, {
            adapter_key: this.name(),
            operation: 'disburse',
            duration_ms: Date.now() - start,
            outcome: 'success',
            circuit_state: this.circuitBreaker.getState(),
          });
          return res;
        },
        this.retryOptions
      );
    });
  }

  normalize(payload: unknown): NormalizedTransaction {
    return this.innerAdapter.normalize(payload);
  }

  verifyWebhook(req: WebhookRequestLike): boolean {
    return this.innerAdapter.verifyWebhook(req);
  }
}
