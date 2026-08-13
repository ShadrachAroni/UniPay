import { PaymentRail } from '../domain/payment-rail.js';
import { ProviderCapabilities } from '../types/payment-provider.js';

export class PaymentRailsRepository {
  private rails: Map<string, PaymentRail> = new Map();

  constructor(initialRails: PaymentRail[] = []) {
    for (const rail of initialRails) {
      this.rails.set(rail.adapter_key, { ...rail });
    }
  }

  async findAll(): Promise<PaymentRail[]> {
    return Array.from(this.rails.values());
  }

  async findAllEnabled(): Promise<PaymentRail[]> {
    return Array.from(this.rails.values()).filter((r) => r.is_enabled);
  }

  async findByAdapterKey(adapterKey: string): Promise<PaymentRail | null> {
    const rail = this.rails.get(adapterKey);
    return rail ? { ...rail } : null;
  }

  async filterAvailable(criteria: {
    currency: string;
    country: string;
    amount: number;
  }): Promise<PaymentRail[]> {
    const enabledRails = await this.findAllEnabled();
    return enabledRails.filter((rail) => {
      const currencySupported = rail.supported_currencies.includes(criteria.currency);
      const countrySupported = rail.supported_countries.includes(criteria.country);
      const amountWithinBounds =
        criteria.amount >= rail.min_amount && criteria.amount <= rail.max_amount;

      return currencySupported && countrySupported && amountWithinBounds;
    });
  }

  async setRailEnabled(adapterKey: string, isEnabled: boolean): Promise<PaymentRail | null> {
    const rail = this.rails.get(adapterKey);
    if (!rail) return null;
    rail.is_enabled = isEnabled;
    this.rails.set(adapterKey, rail);
    return { ...rail };
  }

  async save(rail: PaymentRail): Promise<PaymentRail> {
    this.rails.set(rail.adapter_key, { ...rail });
    return { ...rail };
  }
}

export const defaultSeededCapabilities: ProviderCapabilities = {
  collection: true,
  statusInquiry: true,
  refund: true,
  disbursement: true,
  webhooks: true,
  supportedCurrencies: ['KES'],
  supportedCountries: ['KE'],
};

export const defaultLoopCapabilities: ProviderCapabilities = {
  collection: true,
  statusInquiry: true,
  refund: false,
  disbursement: true,
  webhooks: true,
  supportedCurrencies: ['KES'],
  supportedCountries: ['KE'],
};

export const defaultSeededRail: PaymentRail = {
  id: 'rail_seeded_001',
  name: 'Seeded Payment Rail',
  adapter_key: 'seeded',
  is_enabled: true,
  supported_currencies: ['KES'],
  supported_countries: ['KE'],
  min_amount: 1,
  max_amount: 500000,
  capabilities_json: defaultSeededCapabilities,
};

export const defaultLoopRail: PaymentRail = {
  id: 'rail_loop_001',
  name: 'LOOP Mobile Money',
  adapter_key: 'loop',
  is_enabled: true,
  supported_currencies: ['KES'],
  supported_countries: ['KE'],
  min_amount: 1,
  max_amount: 250000,
  capabilities_json: defaultLoopCapabilities,
};
