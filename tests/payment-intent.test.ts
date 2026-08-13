import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentRailsRepository, defaultSeededRail, defaultLoopRail } from '../src/repository/payment-rails.repository.js';
import { AdapterRegistry } from '../src/services/adapter-registry.js';
import { SeededPaymentAdapter } from '../src/adapters/seeded.adapter.js';
import { LoopAdapter } from '../src/adapters/loop.adapter.js';
import { ResilientPaymentAdapter } from '../src/resilience/resilient-adapter.wrapper.js';
import { PaymentIntentService } from '../src/services/payment-intent.service.js';

describe('PaymentIntentService & Idempotency Audit', () => {
  let registry: AdapterRegistry;
  let railsRepo: PaymentRailsRepository;
  let seededAdapter: SeededPaymentAdapter;
  let service: PaymentIntentService;

  beforeEach(() => {
    railsRepo = new PaymentRailsRepository([defaultSeededRail, defaultLoopRail]);
    registry = new AdapterRegistry();

    seededAdapter = new SeededPaymentAdapter();
    const resilientSeeded = new ResilientPaymentAdapter(seededAdapter);
    registry.register('seeded', resilientSeeded);

    service = new PaymentIntentService(registry, railsRepo);
  });

  it('creates payment intent and invokes adapter', async () => {
    const res = await service.createPaymentIntent({
      recipientProfileId: 'prof_100',
      amount: 500,
      currency: 'KES',
      payerPhone: '+254711223344',
      orderReference: 'ORD_999',
      railKey: 'seeded',
      idempotencyKey: 'IDEM_INTENT_001',
    });

    expect(res.intent.id).toBeDefined();
    expect(res.intent.status).toBe('completed');
    expect(res.intent.providerReference).toBe('SEEDED_PAY_IDEM_INTENT_001');
  });

  it('enforces idempotency key uniqueness: retried request bypasses provider initiation', async () => {
    const createSpy = vi.spyOn(seededAdapter, 'createPayment');

    // First call
    const firstCall = await service.createPaymentIntent({
      recipientProfileId: 'prof_100',
      amount: 500,
      currency: 'KES',
      orderReference: 'ORD_999',
      railKey: 'seeded',
      idempotencyKey: 'SAME_IDEM_KEY_777',
    });

    expect(createSpy).toHaveBeenCalledTimes(1);

    // Second call with same idempotency key
    const secondCall = await service.createPaymentIntent({
      recipientProfileId: 'prof_100',
      amount: 500,
      currency: 'KES',
      orderReference: 'ORD_999',
      railKey: 'seeded',
      idempotencyKey: 'SAME_IDEM_KEY_777',
    });

    // Provider must NOT be called a second time
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(secondCall.intent.id).toBe(firstCall.intent.id);
  });
});
