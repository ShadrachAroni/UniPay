import { PaymentProviderAdapter } from '../types/payment-provider.js';
import { ProviderNotFoundError } from '../errors/payment.errors.js';
import { logger } from '../utils/logger.js';

export class AdapterRegistry {
  private adapters: Map<string, PaymentProviderAdapter> = new Map();

  register(key: string, adapter: PaymentProviderAdapter): void {
    if (this.adapters.has(key)) {
      logger.warn(`Overwriting existing payment provider adapter for key: '${key}'`);
    }
    this.adapters.set(key, adapter);
    logger.info(`Registered payment provider adapter '${adapter.name()}' under key '${key}'`, {
      adapter_key: key,
    });
  }

  get(key: string): PaymentProviderAdapter {
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new ProviderNotFoundError(key);
    }
    return adapter;
  }

  has(key: string): boolean {
    return this.adapters.has(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.adapters.keys());
  }

  clear(): void {
    this.adapters.clear();
  }
}
