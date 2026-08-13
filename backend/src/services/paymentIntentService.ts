import crypto from 'crypto';
import { pool } from '../db';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import { getRailByAdapterKey, getEnabledRailsFor } from './paymentRailService';
import { getProfileById } from './profileService';
import { rootLogger } from '../utils/logger';

export interface PaymentIntentEntity {
  id: string;
  recipient_profile_id: string;
  order_reference: string;
  amount: number;
  currency: string;
  payer_phone?: string | null;
  payer_email?: string | null;
  provider: string;
  rail: string;
  status: 'created' | 'pending' | 'completed' | 'expired' | 'failed';
  provider_reference?: string | null;
  idempotency_key: string;
  expires_at: string;
  initiated_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentIntentInput {
  recipient_profile_id: string;
  order_reference: string;
  amount: number;
  currency?: string;
  payer_phone?: string | null;
  payer_email?: string | null;
  payer_identifier?: string | null;
  provider?: string;
  rail?: string;
  idempotency_key: string;
  expires_in_minutes?: number;
}

// In-memory fallback for offline test environments
const inMemoryIntents = new Map<string, PaymentIntentEntity>();
const idempotencyKeyMap = new Map<string, string>(); // idempotency_key -> id

export async function createPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<PaymentIntentEntity> {
  const currency = input.currency || 'KES';
  const phone = input.payer_phone || input.payer_identifier || null;

  // 1. Enforce Idempotency at DB / memory level
  const existingId = idempotencyKeyMap.get(input.idempotency_key);
  if (existingId && inMemoryIntents.has(existingId)) {
    return inMemoryIntents.get(existingId)!;
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM payment_intents WHERE idempotency_key = $1 LIMIT 1`,
      [input.idempotency_key]
    );
    if (rows.length > 0) {
      const intent: PaymentIntentEntity = {
        ...rows[0],
        amount: Number(rows[0].amount),
      };
      inMemoryIntents.set(intent.id, intent);
      idempotencyKeyMap.set(intent.idempotency_key, intent.id);
      return intent;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for idempotency check on payment intent', {
      error: (err as Error).message,
    });
  }

  // 2. Validate recipient profile
  const profile = await getProfileById(input.recipient_profile_id);
  if (!profile) {
    throw new Error(`Recipient profile '${input.recipient_profile_id}' not found`);
  }

  // 3. Resolve payment rail and adapter
  const targetRailKey = (input.rail || input.provider || 'seeded').toLowerCase();
  const railEntity = await getRailByAdapterKey(targetRailKey);
  if (!railEntity || !railEntity.is_enabled) {
    // If specific rail is not requested or disabled, fallback to first enabled rail for currency
    const enabledRails = await getEnabledRailsFor(currency, profile.country_code || 'KE', input.amount);
    if (enabledRails.length === 0) {
      throw new Error(`No enabled payment rails available for ${currency}`);
    }
  }

  const resolvedRail = railEntity?.adapter_key || targetRailKey;
  const adapter = defaultAdapterRegistry.get(resolvedRail);

  // 4. Create intent record
  const intentId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.expires_in_minutes || 60) * 60 * 1000);

  const newIntent: PaymentIntentEntity = {
    id: intentId,
    recipient_profile_id: input.recipient_profile_id,
    order_reference: input.order_reference,
    amount: input.amount,
    currency,
    payer_phone: phone,
    payer_email: input.payer_email || null,
    provider: adapter.name(),
    rail: resolvedRail,
    status: 'created',
    provider_reference: null,
    idempotency_key: input.idempotency_key,
    expires_at: expiresAt.toISOString(),
    initiated_at: now.toISOString(),
    completed_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // 5. Execute Provider Adapter createPayment
  try {
    const paymentResult = await adapter.createPayment({
      amount: input.amount,
      currency,
      orderReference: input.order_reference,
      idempotencyKey: input.idempotency_key,
      payerPhone: phone,
      payerEmail: input.payer_email,
      payerIdentifier: phone,
    });

    newIntent.provider_reference = paymentResult.providerReference;
    newIntent.status = paymentResult.status === 'completed' ? 'completed' : 'pending';
    if (newIntent.status === 'completed') {
      newIntent.completed_at = new Date().toISOString();
    }
  } catch (adapterErr) {
    newIntent.status = 'failed';
    rootLogger.error('Failed to initiate provider payment', {
      intent_id: intentId,
      provider: resolvedRail,
      error: (adapterErr as Error).message,
    });
  }

  // 6. Persist to Postgres or memory
  try {
    const { rows } = await pool.query(
      `INSERT INTO payment_intents (
        id, recipient_profile_id, order_reference, amount, currency,
        payer_phone, payer_email, provider, rail, status,
        provider_reference, idempotency_key, expires_at, initiated_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (idempotency_key) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        newIntent.id,
        newIntent.recipient_profile_id,
        newIntent.order_reference,
        newIntent.amount,
        newIntent.currency,
        newIntent.payer_phone,
        newIntent.payer_email,
        newIntent.provider,
        newIntent.rail,
        newIntent.status,
        newIntent.provider_reference,
        newIntent.idempotency_key,
        newIntent.expires_at,
        newIntent.initiated_at,
        newIntent.completed_at,
      ]
    );

    if (rows.length > 0) {
      const persisted: PaymentIntentEntity = {
        ...rows[0],
        amount: Number(rows[0].amount),
      };
      inMemoryIntents.set(persisted.id, persisted);
      idempotencyKeyMap.set(persisted.idempotency_key, persisted.id);
      return persisted;
    }
  } catch (dbErr) {
    rootLogger.debug('Falling back to memory store for payment intent creation', {
      error: (dbErr as Error).message,
    });
  }

  inMemoryIntents.set(newIntent.id, newIntent);
  idempotencyKeyMap.set(newIntent.idempotency_key, newIntent.id);
  return newIntent;
}

export async function getPaymentIntentById(id: string): Promise<PaymentIntentEntity | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM payment_intents WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length > 0) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
      };
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for getPaymentIntentById', {
      error: (err as Error).message,
    });
  }

  return inMemoryIntents.get(id) || null;
}

export async function getPaymentIntentByProviderReference(
  providerRef: string
): Promise<PaymentIntentEntity | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM payment_intents WHERE provider_reference = $1 OR idempotency_key = $1 LIMIT 1`,
      [providerRef]
    );
    if (rows.length > 0) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
      };
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for getPaymentIntentByProviderReference', {
      error: (err as Error).message,
    });
  }

  for (const intent of inMemoryIntents.values()) {
    if (intent.provider_reference === providerRef || intent.idempotency_key === providerRef) {
      return intent;
    }
  }
  return null;
}

export async function updatePaymentIntentStatus(
  id: string,
  status: PaymentIntentEntity['status'],
  providerReference?: string
): Promise<PaymentIntentEntity | null> {
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  const now = new Date().toISOString();

  try {
    const { rows } = await pool.query(
      `UPDATE payment_intents 
       SET status = $1, 
           provider_reference = COALESCE($2, provider_reference), 
           completed_at = COALESCE($3, completed_at),
           updated_at = $4
       WHERE id = $5
       RETURNING *`,
      [status, providerReference || null, completedAt, now, id]
    );

    if (rows.length > 0) {
      const updated: PaymentIntentEntity = {
        ...rows[0],
        amount: Number(rows[0].amount),
      };
      inMemoryIntents.set(updated.id, updated);
      return updated;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for updatePaymentIntentStatus', {
      error: (err as Error).message,
    });
  }

  const existing = inMemoryIntents.get(id);
  if (!existing) return null;

  const updated: PaymentIntentEntity = {
    ...existing,
    status,
    provider_reference: providerReference || existing.provider_reference,
    completed_at: completedAt || existing.completed_at,
    updated_at: now,
  };
  inMemoryIntents.set(id, updated);
  return updated;
}

export async function listPaymentIntents(filters?: {
  recipient_profile_id?: string;
  status?: string;
  limit?: number;
}): Promise<PaymentIntentEntity[]> {
  try {
    let query = `SELECT * FROM payment_intents WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (filters?.recipient_profile_id) {
      query += ` AND recipient_profile_id = $${idx++}`;
      params.push(filters.recipient_profile_id);
    }
    if (filters?.status) {
      query += ` AND status = $${idx++}`;
      params.push(filters.status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(filters?.limit || 100);

    const { rows } = await pool.query(query, params);
    if (rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      }));
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for listPaymentIntents', {
      error: (err as Error).message,
    });
  }

  let list = Array.from(inMemoryIntents.values());
  if (filters?.recipient_profile_id) {
    list = list.filter((i) => i.recipient_profile_id === filters.recipient_profile_id);
  }
  if (filters?.status) {
    list = list.filter((i) => i.status === filters.status);
  }

  return list.slice(0, filters?.limit || 100);
}

export function clearPaymentIntentCache(): void {
  inMemoryIntents.clear();
  idempotencyKeyMap.clear();
}

