import crypto from 'crypto';
import { pool } from '../db';
import { NormalizedTransaction } from '@unipay/shared';
import { rootLogger } from '../utils/logger';

export interface TransactionEntity {
  id: string;
  recipient_profile_id: string;
  payment_intent_id?: string | null;
  provider: string;
  rail: string;
  internal_reference: string;
  external_reference: string;
  amount: number;
  currency: string;
  provider_fee: number;
  net_amount: number;
  payer_identifier?: string | null;
  payment_status: 'initiated' | 'successful' | 'failed' | 'reversed';
  settlement_status: 'pending' | 'settled' | 'delayed';
  refund_status: 'none' | 'partial' | 'full';
  transaction_time: string;
  settled_at?: string | null;
  ai_category?: string | null;
  raw_payload?: unknown;
  created_at: string;
}

// In-memory transaction storage for offline/test execution
const inMemoryTransactions = new Map<string, TransactionEntity>();
const externalRefMap = new Map<string, string>(); // external_reference -> id

export async function recordTransaction(
  normalized: NormalizedTransaction,
  recipientProfileId: string,
  paymentIntentId?: string | null
): Promise<TransactionEntity> {
  const existingId = externalRefMap.get(normalized.external_reference);
  if (existingId && inMemoryTransactions.has(existingId)) {
    // Update existing transaction
    const existing = inMemoryTransactions.get(existingId)!;
    const updated: TransactionEntity = {
      ...existing,
      payment_status: normalized.payment_status,
      settlement_status: normalized.settlement_status,
      provider_fee: normalized.provider_fee,
      net_amount: normalized.net_amount,
      raw_payload: normalized.raw_payload,
    };
    inMemoryTransactions.set(existing.id, updated);
    return updated;
  }

  const transactionId = crypto.randomUUID();
  const txTime =
    typeof normalized.transaction_time === 'string'
      ? normalized.transaction_time
      : normalized.transaction_time instanceof Date
        ? normalized.transaction_time.toISOString()
        : new Date().toISOString();

  const record: TransactionEntity = {
    id: transactionId,
    recipient_profile_id: recipientProfileId,
    payment_intent_id: paymentIntentId || null,
    provider: normalized.provider,
    rail: normalized.rail,
    internal_reference: normalized.internal_reference,
    external_reference: normalized.external_reference,
    amount: normalized.amount,
    currency: normalized.currency,
    provider_fee: normalized.provider_fee,
    net_amount: normalized.net_amount,
    payer_identifier: normalized.payer_identifier,
    payment_status: normalized.payment_status,
    settlement_status: normalized.settlement_status,
    refund_status: normalized.refund_status,
    transaction_time: txTime,
    settled_at: normalized.settlement_status === 'settled' ? new Date().toISOString() : null,
    ai_category: null,
    raw_payload: normalized.raw_payload,
    created_at: new Date().toISOString(),
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO transactions (
        id, recipient_profile_id, payment_intent_id, provider, rail,
        internal_reference, external_reference, amount, currency,
        provider_fee, net_amount, payer_identifier, payment_status,
        settlement_status, refund_status, transaction_time, settled_at,
        ai_category, raw_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (internal_reference) DO UPDATE SET
        payment_status = EXCLUDED.payment_status,
        settlement_status = EXCLUDED.settlement_status,
        raw_payload = EXCLUDED.raw_payload
      RETURNING *`,
      [
        record.id,
        record.recipient_profile_id,
        record.payment_intent_id,
        record.provider,
        record.rail,
        record.internal_reference,
        record.external_reference,
        record.amount,
        record.currency,
        record.provider_fee,
        record.net_amount,
        record.payer_identifier,
        record.payment_status,
        record.settlement_status,
        record.refund_status,
        record.transaction_time,
        record.settled_at,
        record.ai_category,
        JSON.stringify(record.raw_payload || {}),
      ]
    );

    if (rows.length > 0) {
      const persisted: TransactionEntity = {
        ...rows[0],
        amount: Number(rows[0].amount),
        provider_fee: Number(rows[0].provider_fee),
        net_amount: Number(rows[0].net_amount),
      };
      inMemoryTransactions.set(persisted.id, persisted);
      externalRefMap.set(persisted.external_reference, persisted.id);
      return persisted;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for recording transaction', {
      error: (err as Error).message,
    });
  }

  inMemoryTransactions.set(record.id, record);
  externalRefMap.set(record.external_reference, record.id);
  return record;
}

export async function getTransactionById(id: string): Promise<TransactionEntity | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM transactions WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length > 0) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
        provider_fee: Number(rows[0].provider_fee),
        net_amount: Number(rows[0].net_amount),
      };
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for getTransactionById', {
      error: (err as Error).message,
    });
  }

  return inMemoryTransactions.get(id) || null;
}

export async function getTransactionByExternalReference(
  externalRef: string
): Promise<TransactionEntity | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM transactions WHERE external_reference = $1 LIMIT 1`,
      [externalRef]
    );
    if (rows.length > 0) {
      return {
        ...rows[0],
        amount: Number(rows[0].amount),
        provider_fee: Number(rows[0].provider_fee),
        net_amount: Number(rows[0].net_amount),
      };
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for getTransactionByExternalReference', {
      error: (err as Error).message,
    });
  }

  const id = externalRefMap.get(externalRef);
  if (id) {
    return inMemoryTransactions.get(id) || null;
  }

  for (const tx of inMemoryTransactions.values()) {
    if (tx.external_reference === externalRef || tx.internal_reference === externalRef) {
      return tx;
    }
  }
  return null;
}

export async function listTransactions(filters?: {
  profile_id?: string;
  payment_status?: string;
  settlement_status?: string;
  limit?: number;
}): Promise<TransactionEntity[]> {
  try {
    let query = `SELECT * FROM transactions WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (filters?.profile_id) {
      query += ` AND recipient_profile_id = $${idx++}`;
      params.push(filters.profile_id);
    }
    if (filters?.payment_status) {
      query += ` AND payment_status = $${idx++}`;
      params.push(filters.payment_status);
    }
    if (filters?.settlement_status) {
      query += ` AND settlement_status = $${idx++}`;
      params.push(filters.settlement_status);
    }

    query += ` ORDER BY transaction_time DESC LIMIT $${idx}`;
    params.push(filters?.limit || 50);

    const { rows } = await pool.query(query, params);
    if (rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
        provider_fee: Number(r.provider_fee),
        net_amount: Number(r.net_amount),
      }));
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for listTransactions', {
      error: (err as Error).message,
    });
  }

  let list = Array.from(inMemoryTransactions.values());
  if (filters?.profile_id) {
    list = list.filter((tx) => tx.recipient_profile_id === filters.profile_id);
  }
  if (filters?.payment_status) {
    list = list.filter((tx) => tx.payment_status === filters.payment_status);
  }
  if (filters?.settlement_status) {
    list = list.filter((tx) => tx.settlement_status === filters.settlement_status);
  }

  return list.slice(0, filters?.limit || 50);
}

export function clearTransactionCache(): void {
  inMemoryTransactions.clear();
  externalRefMap.clear();
}
