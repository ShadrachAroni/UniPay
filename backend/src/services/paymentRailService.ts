import crypto from 'crypto';
import { pool } from '../db';
import { rootLogger } from '../utils/logger';
import { ProviderCapabilities } from '@unipay/shared';

export interface PaymentRailEntity {
  id: string;
  name: string;
  adapter_key: string;
  is_enabled: boolean;
  supported_currencies: string[];
  supported_countries: string[];
  min_amount: number;
  max_amount: number;
  capabilities_json: ProviderCapabilities;
  created_at: string;
  updated_at: string;
}

// In-memory fallback store for offline tests and DB unreachability
const inMemoryRails = new Map<string, PaymentRailEntity>();

function initDefaultSeededRail(): void {
  const seededId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const now = new Date().toISOString();
  const seededRail: PaymentRailEntity = {
    id: seededId,
    name: 'Seeded Rail (Simulated Fixture)',
    adapter_key: 'seeded',
    is_enabled: true,
    supported_currencies: ['KES'],
    supported_countries: ['KE'],
    min_amount: 10.0,
    max_amount: 500000.0,
    capabilities_json: {
      collection: true,
      statusInquiry: true,
      refund: true,
      disbursement: true,
      webhooks: true,
      supportedCurrencies: ['KES'],
      supportedCountries: ['KE'],
      settlementEstimate: 'instant',
      feeStructure: {
        fixed: 0,
        percentage: 0.005,
      },
    },
    created_at: now,
    updated_at: now,
  };
  inMemoryRails.set(seededRail.adapter_key.toLowerCase(), seededRail);
}

// Initialize default seeded rail
initDefaultSeededRail();

export async function getRailByAdapterKey(adapterKey: string): Promise<PaymentRailEntity | null> {
  const key = adapterKey.toLowerCase();
  try {
    const { rows } = await pool.query(
      `SELECT * FROM payment_rails WHERE LOWER(adapter_key) = $1 LIMIT 1`,
      [key]
    );
    if (rows.length > 0) {
      return {
        ...rows[0],
        min_amount: Number(rows[0].min_amount),
        max_amount: Number(rows[0].max_amount),
      };
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for getRailByAdapterKey', {
      error: (err as Error).message,
    });
  }

  return inMemoryRails.get(key) || null;
}

export async function getEnabledRailsFor(
  currency: string,
  country = 'KE',
  amount?: number
): Promise<PaymentRailEntity[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM payment_rails 
       WHERE is_enabled = TRUE 
         AND $1 = ANY(supported_currencies) 
         AND $2 = ANY(supported_countries)
       ORDER BY created_at ASC`,
      [currency.toUpperCase(), country.toUpperCase()]
    );

    if (rows.length > 0) {
      const parsed = rows.map((r) => ({
        ...r,
        min_amount: Number(r.min_amount),
        max_amount: Number(r.max_amount),
      }));

      if (amount !== undefined) {
        return parsed.filter((r) => amount >= r.min_amount && amount <= r.max_amount);
      }
      return parsed;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for getEnabledRailsFor', {
      error: (err as Error).message,
    });
  }

  const matching: PaymentRailEntity[] = [];
  for (const rail of inMemoryRails.values()) {
    if (!rail.is_enabled) continue;
    const matchesCurrency = rail.supported_currencies.includes(currency.toUpperCase());
    const matchesCountry = rail.supported_countries.includes(country.toUpperCase());
    if (matchesCurrency && matchesCountry) {
      if (amount === undefined || (amount >= rail.min_amount && amount <= rail.max_amount)) {
        matching.push(rail);
      }
    }
  }
  return matching;
}

export async function setRailEnabled(
  adapterKey: string,
  isEnabled: boolean
): Promise<PaymentRailEntity> {
  const key = adapterKey.toLowerCase();
  const now = new Date().toISOString();

  try {
    const { rows } = await pool.query(
      `UPDATE payment_rails 
       SET is_enabled = $1, updated_at = $2 
       WHERE LOWER(adapter_key) = $3 
       RETURNING *`,
      [isEnabled, now, key]
    );
    if (rows.length > 0) {
      const updated = {
        ...rows[0],
        min_amount: Number(rows[0].min_amount),
        max_amount: Number(rows[0].max_amount),
      };
      inMemoryRails.set(key, updated);
      return updated;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for setRailEnabled', {
      error: (err as Error).message,
    });
  }

  const existing = inMemoryRails.get(key);
  if (!existing) {
    throw new Error(`Payment rail with adapter_key '${adapterKey}' not found`);
  }

  const updated: PaymentRailEntity = {
    ...existing,
    is_enabled: isEnabled,
    updated_at: now,
  };
  inMemoryRails.set(key, updated);
  return updated;
}

export async function listAllRails(): Promise<PaymentRailEntity[]> {
  try {
    const { rows } = await pool.query(`SELECT * FROM payment_rails ORDER BY created_at ASC`);
    if (rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        min_amount: Number(r.min_amount),
        max_amount: Number(r.max_amount),
      }));
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for listAllRails', {
      error: (err as Error).message,
    });
  }

  return Array.from(inMemoryRails.values());
}

export function resetRailCache(): void {
  inMemoryRails.clear();
  initDefaultSeededRail();
}
