import { AdapterRegistry } from './adapter-registry.js';
import { PaymentRailsRepository } from '../repository/payment-rails.repository.js';
import { PaymentRequest, ProviderPaymentResult } from '../types/payment-provider.js';
import { logger } from '../utils/logger.js';

export interface PaymentIntent {
  id: string;
  recipientProfileId: string;
  orderReference: string;
  amount: number;
  currency: string;
  payerPhone?: string;
  payerEmail?: string;
  provider: string;
  rail: string;
  status: 'created' | 'pending' | 'completed' | 'expired' | 'failed';
  providerReference?: string;
  idempotencyKey: string;
  initiatedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export class PaymentIntentService {
  private intents: Map<string, PaymentIntent> = new Map(); // Maps idempotencyKey -> PaymentIntent

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly railsRepo: PaymentRailsRepository
  ) {}

  async createPaymentIntent(input: {
    recipientProfileId: string;
    amount: number;
    currency: string;
    payerPhone?: string;
    payerEmail?: string;
    orderReference: string;
    railKey: string;
    idempotencyKey: string;
  }): Promise<{ intent: PaymentIntent; providerResult: ProviderPaymentResult }> {
    // 1. Idempotency Check: if idempotencyKey already exists, return existing intent without calling provider again
    const existing = this.intents.get(input.idempotencyKey);
    if (existing) {
      logger.info(`Idempotent request match for idempotencyKey '${input.idempotencyKey}'`, {
        idempotency_key: input.idempotencyKey,
        intent_id: existing.id,
      });
      return {
        intent: existing,
        providerResult: {
          providerReference: existing.providerReference || `REF_${existing.id}`,
          status: existing.status === 'completed' ? 'completed' : existing.status === 'failed' ? 'failed' : 'pending',
          rawResponse: { note: 'Idempotent replay - provider call bypassed' },
        },
      };
    }

    // 2. Resolve Payment Rail & Adapter
    const rail = await this.railsRepo.findByAdapterKey(input.railKey);
    if (!rail || !rail.is_enabled) {
      throw new Error(`Payment rail '${input.railKey}' is not available`);
    }

    const adapter = this.registry.get(rail.adapter_key);

    // 3. Local Intent Creation (DB write before external I/O call)
    const intentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minute expiry

    const intent: PaymentIntent = {
      id: intentId,
      recipientProfileId: input.recipientProfileId,
      orderReference: input.orderReference,
      amount: input.amount,
      currency: input.currency,
      payerPhone: input.payerPhone,
      payerEmail: input.payerEmail,
      provider: adapter.name(),
      rail: rail.adapter_key,
      status: 'created',
      idempotencyKey: input.idempotencyKey,
      initiatedAt: now,
      expiresAt,
    };

    // Store intent in DB / repository
    this.intents.set(input.idempotencyKey, intent);

    // 4. External I/O Call to Payment Adapter (outside DB transaction)
    const paymentRequest: PaymentRequest = {
      amount: input.amount,
      currency: input.currency,
      payerPhone: input.payerPhone,
      payerEmail: input.payerEmail,
      orderReference: input.orderReference,
      idempotencyKey: input.idempotencyKey,
    };

    let providerResult: ProviderPaymentResult;
    try {
      providerResult = await adapter.createPayment(paymentRequest);

      // 5. Short local status update transaction after external I/O completes
      intent.providerReference = providerResult.providerReference;
      intent.status = providerResult.status === 'completed' ? 'completed' : providerResult.status === 'failed' ? 'failed' : 'pending';
      if (intent.status === 'completed') {
        intent.completedAt = new Date();
      }
      this.intents.set(input.idempotencyKey, intent);

      return { intent, providerResult };
    } catch (err) {
      intent.status = 'failed';
      this.intents.set(input.idempotencyKey, intent);
      throw err;
    }
  }

  async getIntentById(id: string): Promise<PaymentIntent | null> {
    for (const intent of this.intents.values()) {
      if (intent.id === id) return { ...intent };
    }
    return null;
  }

  async getIntentByIdempotencyKey(key: string): Promise<PaymentIntent | null> {
    const intent = this.intents.get(key);
    return intent ? { ...intent } : null;
  }

  async updateIntentStatus(
    idempotencyKey: string,
    status: PaymentIntent['status'],
    providerReference?: string
  ): Promise<PaymentIntent | null> {
    const intent = this.intents.get(idempotencyKey);
    if (!intent) return null;
    intent.status = status;
    if (providerReference) intent.providerReference = providerReference;
    if (status === 'completed' || status === 'failed') {
      intent.completedAt = new Date();
    }
    this.intents.set(idempotencyKey, intent);
    return { ...intent };
  }
}
