import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentRailsRepository, defaultSeededRail, defaultLoopRail } from '../src/repository/payment-rails.repository.js';
import { AdapterRegistry } from '../src/services/adapter-registry.js';
import { SeededPaymentAdapter } from '../src/adapters/seeded.adapter.js';
import { LoopAdapter } from '../src/adapters/loop.adapter.js';
import { ResilientPaymentAdapter } from '../src/resilience/resilient-adapter.wrapper.js';
import { PaymentOptionsService } from '../src/services/payment-options.service.js';
import { CapabilityMismatchError } from '../src/errors/payment.errors.js';

describe('PaymentOptionsService', () => {
  let railsRepo: PaymentRailsRepository;
  let registry: AdapterRegistry;
  let resilientSeeded: ResilientPaymentAdapter;
  let resilientLoop: ResilientPaymentAdapter;
  let service: PaymentOptionsService;

  beforeEach(() => {
    railsRepo = new PaymentRailsRepository([defaultSeededRail, defaultLoopRail]);
    registry = new AdapterRegistry();

    const seeded = new SeededPaymentAdapter();
    resilientSeeded = new ResilientPaymentAdapter(seeded);

    const loop = new LoopAdapter();
    resilientLoop = new ResilientPaymentAdapter(loop);

    registry.register('seeded', resilientSeeded);
    registry.register('loop', resilientLoop);

    service = new PaymentOptionsService(railsRepo, registry);
  });

  it('returns active options matching criteria', async () => {
    const options = await service.getAvailableOptions({
      currency: 'KES',
      country: 'KE',
      amount: 1000,
    });

    expect(options).toHaveLength(2);
    expect(options.map((o) => o.adapter_key)).toEqual(['seeded', 'loop']);
  });

  it('excludes disabled rails dynamically without code deployment', async () => {
    await railsRepo.setRailEnabled('seeded', false);

    const options = await service.getAvailableOptions({
      currency: 'KES',
      country: 'KE',
      amount: 1000,
    });

    expect(options).toHaveLength(1);
    expect(options[0].adapter_key).toBe('loop');
  });

  it('excludes options whose circuit breaker is in OPEN state', async () => {
    // Force circuit breaker to OPEN state
    resilientSeeded.circuitBreaker.forceState('OPEN');

    const options = await service.getAvailableOptions({
      currency: 'KES',
      country: 'KE',
      amount: 1000,
    });

    expect(options).toHaveLength(1);
    expect(options[0].adapter_key).toBe('loop');
  });

  it('throws CapabilityMismatchError if DB rail configuration contradicts adapter capabilities', async () => {
    const invalidRail = {
      ...defaultSeededRail,
      capabilities_json: {
        ...defaultSeededRail.capabilities_json,
        disbursement: false, // Adapter has true
      },
    };
    await railsRepo.save(invalidRail);

    await expect(
      service.getAvailableOptions({
        currency: 'KES',
        country: 'KE',
        amount: 1000,
      })
    ).rejects.toThrow(CapabilityMismatchError);
  });
});
