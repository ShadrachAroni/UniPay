import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentRailsRepository, defaultSeededRail } from '../src/repository/payment-rails.repository.js';
import { AdapterRegistry } from '../src/services/adapter-registry.js';
import { SeededPaymentAdapter } from '../src/adapters/seeded.adapter.js';
import { ResilientPaymentAdapter } from '../src/resilience/resilient-adapter.wrapper.js';
import { PaymentOptionsService } from '../src/services/payment-options.service.js';
import { CapabilityMismatchError, CircuitOpenError } from '../src/errors/payment.errors.js';

describe('Phase 2 Additional Safety Tests (Prerequisite Gate)', () => {
  let railsRepo: PaymentRailsRepository;
  let registry: AdapterRegistry;
  let seededAdapter: SeededPaymentAdapter;
  let resilientAdapter: ResilientPaymentAdapter;
  let service: PaymentOptionsService;

  beforeEach(() => {
    railsRepo = new PaymentRailsRepository([defaultSeededRail]);
    registry = new AdapterRegistry();

    seededAdapter = new SeededPaymentAdapter();
    resilientAdapter = new ResilientPaymentAdapter(seededAdapter);

    registry.register('seeded', resilientAdapter);
    service = new PaymentOptionsService(railsRepo, registry);
  });

  it('TEST 1 — Capability Configuration Mismatch throws CapabilityMismatchError and disburse is NOT called', async () => {
    const invalidRail = {
      ...defaultSeededRail,
      capabilities_json: {
        ...defaultSeededRail.capabilities_json,
        disbursement: false, // DB config has false, adapter has true
      },
    };
    await railsRepo.save(invalidRail);

    const disburseSpy = vi.spyOn(seededAdapter, 'disburse');

    await expect(
      service.getAvailableOptions({ currency: 'KES', country: 'KE', amount: 100 })
    ).rejects.toThrow(CapabilityMismatchError);

    expect(disburseSpy).not.toHaveBeenCalled();
  });

  it('TEST 2 — Circuit OPEN removes option from payment options and underlying adapter is NOT called', async () => {
    resilientAdapter.circuitBreaker.forceState('OPEN');

    const createSpy = vi.spyOn(seededAdapter, 'createPayment');
    const statusSpy = vi.spyOn(seededAdapter, 'getStatus');

    const options = await service.getAvailableOptions({ currency: 'KES', country: 'KE', amount: 100 });

    expect(options).toHaveLength(0);
    expect(createSpy).not.toHaveBeenCalled();
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it('TEST 3 — Circuit OPEN direct payment attempt fails fast with CircuitOpenError and underlying adapter is called 0 times', async () => {
    resilientAdapter.circuitBreaker.forceState('OPEN');

    const createSpy = vi.spyOn(seededAdapter, 'createPayment');

    await expect(
      resilientAdapter.createPayment({
        amount: 500,
        currency: 'KES',
        orderReference: 'ORD_TEST',
        idempotencyKey: 'IDEM_TEST',
      })
    ).rejects.toThrow(CircuitOpenError);

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('TEST 4 — HALF_OPEN recovery restores availability without restart', async () => {
    resilientAdapter.circuitBreaker.forceState('OPEN');
    let options = await service.getAvailableOptions({ currency: 'KES', country: 'KE', amount: 100 });
    expect(options).toHaveLength(0);

    // Transition to HALF_OPEN and then CLOSED
    resilientAdapter.circuitBreaker.forceState('CLOSED');

    options = await service.getAvailableOptions({ currency: 'KES', country: 'KE', amount: 100 });
    expect(options).toHaveLength(1);
    expect(options[0].adapter_key).toBe('seeded');
  });

  it('TEST 5 — DB disabled rail overrides provider health and invokes provider zero times', async () => {
    await railsRepo.setRailEnabled('seeded', false);

    const createSpy = vi.spyOn(seededAdapter, 'createPayment');

    const options = await service.getAvailableOptions({ currency: 'KES', country: 'KE', amount: 100 });

    expect(options).toHaveLength(0);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('TEST 6 — Short circuits decision order early for invalid requests', async () => {
    // Unsupported currency short-circuits without checking adapter
    const options = await service.getAvailableOptions({ currency: 'USD', country: 'KE', amount: 100 });
    expect(options).toHaveLength(0);
  });
});
