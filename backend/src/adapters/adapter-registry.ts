import { PaymentProviderAdapter } from '@unipay/shared';
import { SeededRailAdapter } from './seeded-rail-adapter';
import { LoopAdapter } from './loop-adapter';
import { ResilientAdapterWrapper } from './resilient-adapter-wrapper';

export class ProviderNotFoundError extends Error {
  constructor(adapterKey: string) {
    super(`Payment provider adapter '${adapterKey}' is not registered`);
    this.name = 'ProviderNotFoundError';
  }
}

export class AdapterRegistry {
  private readonly adapters = new Map<string, PaymentProviderAdapter>();

  constructor() {}

  register(key: string, adapter: PaymentProviderAdapter, wrapResilient = true): void {
    const finalAdapter = wrapResilient && !(adapter instanceof ResilientAdapterWrapper)
      ? new ResilientAdapterWrapper(adapter)
      : adapter;
    this.adapters.set(key.toLowerCase(), finalAdapter);
  }

  get(key: string): PaymentProviderAdapter {
    const adapter = this.adapters.get(key.toLowerCase());
    if (!adapter) {
      throw new ProviderNotFoundError(key);
    }
    return adapter;
  }

  has(key: string): boolean {
    return this.adapters.has(key.toLowerCase());
  }

  getAllKeys(): string[] {
    return Array.from(this.adapters.keys());
  }

  clear(): void {
    this.adapters.clear();
  }
}

// Default system singleton registry pre-populated with SeededRailAdapter (KES & USD) and LoopAdapter
export const defaultAdapterRegistry = new AdapterRegistry();
defaultAdapterRegistry.register('seeded', new SeededRailAdapter('seeded', 'KES'));
defaultAdapterRegistry.register('seeded_2', new SeededRailAdapter('seeded_2', 'KES'));
defaultAdapterRegistry.register('loop', new LoopAdapter());
