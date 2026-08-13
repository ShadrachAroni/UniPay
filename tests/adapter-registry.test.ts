import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from '../src/services/adapter-registry.js';
import { SeededPaymentAdapter } from '../src/adapters/seeded.adapter.js';
import { LoopAdapter } from '../src/adapters/loop.adapter.js';
import { ProviderNotFoundError } from '../src/errors/payment.errors.js';

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('registers and retrieves adapters by key', () => {
    const seeded = new SeededPaymentAdapter();
    registry.register('seeded', seeded);

    expect(registry.has('seeded')).toBe(true);
    expect(registry.get('seeded')).toBe(seeded);
    expect(registry.get('seeded').name()).toBe('seeded');
  });

  it('throws ProviderNotFoundError for unknown adapter keys', () => {
    expect(() => registry.get('non_existent_key')).toThrow(ProviderNotFoundError);
  });

  it('allows registering multiple adapters without caller branching', () => {
    const seeded = new SeededPaymentAdapter();
    const loop = new LoopAdapter();

    registry.register('seeded', seeded);
    registry.register('loop', loop);

    expect(registry.getAllKeys()).toEqual(['seeded', 'loop']);
    expect(registry.get('seeded').name()).toBe('seeded');
    expect(registry.get('loop').name()).toBe('loop');
  });
});
