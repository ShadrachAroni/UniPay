import { PaymentRailsRepository } from '../repository/payment-rails.repository.js';
import { AdapterRegistry } from './adapter-registry.js';
import { validateRailCapabilityConsistency } from '../domain/payment-rail.js';
import { CapabilityMismatchError } from '../errors/payment.errors.js';
import { logger } from '../utils/logger.js';
import { ResilientPaymentAdapter } from '../resilience/resilient-adapter.wrapper.js';

export interface PaymentOptionsRequest {
  currency: string;
  country: string;
  amount: number;
}

export interface AvailablePaymentOption {
  id: string;
  name: string;
  adapter_key: string;
  supported_currencies: string[];
  min_amount: number;
  max_amount: number;
}

export class PaymentOptionsService {
  constructor(
    private readonly railsRepo: PaymentRailsRepository,
    private readonly registry: AdapterRegistry
  ) {}

  async getAvailableOptions(req: PaymentOptionsRequest): Promise<AvailablePaymentOption[]> {
    const matchingRails = await this.railsRepo.filterAvailable({
      currency: req.currency,
      country: req.country,
      amount: req.amount,
    });

    const availableOptions: AvailablePaymentOption[] = [];

    for (const rail of matchingRails) {
      if (!this.registry.has(rail.adapter_key)) {
        logger.warn(`Rail '${rail.name}' is enabled in DB but no adapter is registered for key '${rail.adapter_key}'`, {
          adapter_key: rail.adapter_key,
        });
        continue;
      }

      const adapter = this.registry.get(rail.adapter_key);

      // Validate capability consistency
      const validation = validateRailCapabilityConsistency(rail, adapter);
      if (!validation.valid) {
        logger.error(`Capability mismatch for rail '${rail.adapter_key}'`, {
          adapter_key: rail.adapter_key,
          mismatches: validation.mismatches,
        });
        throw new CapabilityMismatchError(rail.adapter_key, validation.mismatches);
      }

      // Check if adapter is wrapped with a circuit breaker and circuit is OPEN
      if (adapter instanceof ResilientPaymentAdapter) {
        if (adapter.circuitBreaker.getState() === 'OPEN') {
          logger.warn(`Adapter '${rail.adapter_key}' circuit breaker is OPEN. Excluding from checkout options.`, {
            adapter_key: rail.adapter_key,
          });
          continue;
        }
      }

      availableOptions.push({
        id: rail.id,
        name: rail.name,
        adapter_key: rail.adapter_key,
        supported_currencies: rail.supported_currencies,
        min_amount: rail.min_amount,
        max_amount: rail.max_amount,
      });
    }

    return availableOptions;
  }
}
