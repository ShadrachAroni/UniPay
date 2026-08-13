import { describe, it, expect, beforeEach } from 'vitest';
import {
  PaymentRailsRepository,
  defaultSeededRail,
  defaultLoopRail,
} from '../src/repository/payment-rails.repository.js';
import { validateRailCapabilityConsistency } from '../src/domain/payment-rail.js';
import { SeededPaymentAdapter } from '../src/adapters/seeded.adapter.js';
import { LoopAdapter } from '../src/adapters/loop.adapter.js';

describe('PaymentRailsRepository & Rail Configuration', () => {
  let repo: PaymentRailsRepository;

  beforeEach(() => {
    repo = new PaymentRailsRepository([defaultSeededRail, defaultLoopRail]);
  });

  it('returns all enabled rails when criteria match', async () => {
    const available = await repo.filterAvailable({
      currency: 'KES',
      country: 'KE',
      amount: 1000,
    });

    expect(available).toHaveLength(2);
    expect(available.map((r) => r.adapter_key)).toEqual(['seeded', 'loop']);
  });

  it('excludes disabled rails from checkout options', async () => {
    // Disable seeded rail
    await repo.setRailEnabled('seeded', false);

    const available = await repo.filterAvailable({
      currency: 'KES',
      country: 'KE',
      amount: 1000,
    });

    expect(available).toHaveLength(1);
    expect(available[0].adapter_key).toBe('loop');

    // Re-enable
    await repo.setRailEnabled('seeded', true);
  });

  it('filters by supported currency', async () => {
    const available = await repo.filterAvailable({
      currency: 'USD',
      country: 'KE',
      amount: 100,
    });

    expect(available).toHaveLength(0);
  });

  it('filters by supported country', async () => {
    const available = await repo.filterAvailable({
      currency: 'KES',
      country: 'UG',
      amount: 100,
    });

    expect(available).toHaveLength(0);
  });

  it('filters by min and max amount bounds', async () => {
    // Amount above LOOP max_amount (250,000) but below Seeded max_amount (500,000)
    const available = await repo.filterAvailable({
      currency: 'KES',
      country: 'KE',
      amount: 300000,
    });

    expect(available).toHaveLength(1);
    expect(available[0].adapter_key).toBe('seeded');
  });

  it('validates capability consistency between DB rail config and adapter capabilities', () => {
    const seededAdapter = new SeededPaymentAdapter();
    const result = validateRailCapabilityConsistency(defaultSeededRail, seededAdapter);

    expect(result.valid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('detects capability mismatches when DB rail config contradicts adapter capabilities', () => {
    const seededAdapter = new SeededPaymentAdapter();
    const mismatchedRail = {
      ...defaultSeededRail,
      capabilities_json: {
        ...defaultSeededRail.capabilities_json,
        refund: false, // DB says refund is false, adapter has refund = true
      },
      supported_currencies: ['KES', 'EUR'], // DB says EUR allowed, adapter only KES
    };

    const result = validateRailCapabilityConsistency(mismatchedRail, seededAdapter);

    expect(result.valid).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
    expect(result.mismatches.some((m) => m.includes('refund'))).toBe(true);
    expect(result.mismatches.some((m) => m.includes('EUR'))).toBe(true);
  });
});
