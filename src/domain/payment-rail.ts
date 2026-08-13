import { ProviderCapabilities, PaymentProviderAdapter } from '../types/payment-provider.js';

export interface PaymentRail {
  id: string;
  name: string;
  adapter_key: string;
  is_enabled: boolean;
  supported_currencies: string[];
  supported_countries: string[];
  min_amount: number;
  max_amount: number;
  capabilities_json: ProviderCapabilities;
}

export function validateRailCapabilityConsistency(
  rail: PaymentRail,
  adapter: PaymentProviderAdapter
): { valid: boolean; mismatches: string[] } {
  const adapterCaps = adapter.capabilities();
  const railCaps = rail.capabilities_json;
  const mismatches: string[] = [];

  const booleanKeys: (keyof ProviderCapabilities)[] = [
    'collection',
    'statusInquiry',
    'refund',
    'disbursement',
    'webhooks',
  ];

  for (const key of booleanKeys) {
    if (railCaps[key] !== adapterCaps[key]) {
      mismatches.push(
        `Capability '${key}': DB config has ${railCaps[key]}, adapter has ${adapterCaps[key]}`
      );
    }
  }

  // Check if rail supported_currencies are supported by adapter
  for (const cur of rail.supported_currencies) {
    if (!adapterCaps.supportedCurrencies.includes(cur)) {
      mismatches.push(`Currency '${cur}': DB rail allows '${cur}', but adapter only supports [${adapterCaps.supportedCurrencies.join(', ')}]`);
    }
  }

  // Check if rail supported_countries are supported by adapter
  for (const country of rail.supported_countries) {
    if (!adapterCaps.supportedCountries.includes(country)) {
      mismatches.push(`Country '${country}': DB rail allows '${country}', but adapter only supports [${adapterCaps.supportedCountries.join(', ')}]`);
    }
  }

  return {
    valid: mismatches.length === 0,
    mismatches,
  };
}
