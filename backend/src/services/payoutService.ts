import crypto from 'crypto';
import { pool } from '../db';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import { getProfileById } from './profileService';
import { listTransactions, TransactionEntity } from './transactionService';
import { getMoneyDirectionRules } from './moneyDirectionService';
import { rootLogger } from '../utils/logger';
import { MoneyDirectionDecision, PayoutStatus } from '@unipay/shared';
import { calculateDisbursementFee } from './feeService';

export interface PayoutEntity {
  id: string;
  profile_id: string;
  provider: string;
  requested_amount: number;
  requested_currency: string;
  destination_type: string;
  destination_reference: string | null;
  fee: number;
  net_amount: number;
  status: PayoutStatus;
  provider_reference?: string | null;
  requested_at: string;
  processed_at?: string | null;
  raw_payload?: unknown;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileBalanceDTO {
  profile_id: string;
  available_balance: number;
  ledger_balance: number;
  total_settled: number;
  total_payouts: number;
  pending_payouts: number;
  currency: string;
}

export interface CreatePayoutInput {
  profile_id: string;
  amount: number;
  currency?: string;
  destination_type?: string;
  destination_reference?: string | null;
  idempotency_key: string;
  provider?: string;
  remarks?: string;
}

// In-memory fallbacks for test/offline executions
const inMemoryPayouts = new Map<string, PayoutEntity>();
const idempotencyKeyMap = new Map<string, string>(); // idempotency_key -> payout_id

/**
 * Calculates the available-to-withdraw and ledger balances for a profile (§18, Task 3)
 * Settled amounts minus amounts already committed to a payout (in any non-failed status)
 */
export async function calculateProfileBalance(
  profileId: string
): Promise<ProfileBalanceDTO> {
  const profile = await getProfileById(profileId);
  const currency = profile?.currency || 'KES';

  let totalSettled = 0;
  let totalPayouts = 0;
  let pendingPayouts = 0;

  // 1. Calculate settled revenue from transactions
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(net_amount), 0) as total_settled
       FROM transactions
       WHERE recipient_profile_id = $1 AND settlement_status = 'settled'`,
      [profileId]
    );
    if (rows.length > 0) {
      totalSettled = Number(rows[0].total_settled);
    }
  } catch {
    // In-memory fallback
  }

  // Fallback to in-memory transactions if DB returned 0
  if (totalSettled === 0) {
    const transactions = await listTransactions({
      profile_id: profileId,
      settlement_status: 'settled',
      limit: 1000,
    });
    totalSettled = transactions.reduce(
      (sum, tx) => sum + (tx.net_amount ?? tx.amount),
      0
    );
  }

  // 2. Calculate committed payouts (requested, processing, completed)
  try {
    const { rows } = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN status IN ('requested', 'processing', 'completed') THEN requested_amount ELSE 0 END), 0) as total_committed,
         COALESCE(SUM(CASE WHEN status IN ('requested', 'processing') THEN requested_amount ELSE 0 END), 0) as pending_amount
       FROM payouts
       WHERE profile_id = $1`,
      [profileId]
    );
    if (rows.length > 0) {
      totalPayouts = Number(rows[0].total_committed);
      pendingPayouts = Number(rows[0].pending_amount);
    }
  } catch {
    // In-memory fallback
  }

  // Fallback to in-memory payouts if DB returned 0
  if (totalPayouts === 0 && inMemoryPayouts.size > 0) {
    for (const p of inMemoryPayouts.values()) {
      if (p.profile_id === profileId) {
        if (p.status === 'requested' || p.status === 'processing' || p.status === 'completed') {
          totalPayouts += p.requested_amount;
        }
        if (p.status === 'requested' || p.status === 'processing') {
          pendingPayouts += p.requested_amount;
        }
      }
    }
  }

  totalSettled = Math.round(totalSettled * 100) / 100;
  totalPayouts = Math.round(totalPayouts * 100) / 100;
  pendingPayouts = Math.round(pendingPayouts * 100) / 100;

  const availableBalance = Math.max(
    0,
    Math.round((totalSettled - totalPayouts) * 100) / 100
  );

  return {
    profile_id: profileId,
    available_balance: availableBalance,
    ledger_balance: totalSettled,
    total_settled: totalSettled,
    total_payouts: totalPayouts,
    pending_payouts: pendingPayouts,
    currency,
  };
}

/**
 * Creates and orchestrates a payout (Manual Withdraw or Automatic Rule-Driven) (§11, §12, §18)
 */
export async function createPayout(
  input: CreatePayoutInput
): Promise<PayoutEntity> {
  const profileId = input.profile_id;
  const idempotencyKey = input.idempotency_key;

  if (!idempotencyKey) {
    throw new Error('idempotency_key is required for payout execution');
  }

  // 1. Idempotency check: Return existing payout if idempotency_key is repeated
  const existingId = idempotencyKeyMap.get(idempotencyKey);
  if (existingId && inMemoryPayouts.has(existingId)) {
    return inMemoryPayouts.get(existingId)!;
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM payouts WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey]
    );
    if (rows.length > 0) {
      const p = mapRowToPayout(rows[0]);
      inMemoryPayouts.set(p.id, p);
      idempotencyKeyMap.set(p.idempotency_key, p.id);
      return p;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for payout idempotency lookup', {
      error: (err as Error).message,
    });
  }

  // 2. Validate Profile
  const profile = await getProfileById(profileId);
  if (!profile) {
    throw new Error(`Profile '${profileId}' not found`);
  }

  // 3. Available balance check (ceiling enforcement)
  const balance = await calculateProfileBalance(profileId);
  if (input.amount <= 0) {
    throw new Error('Payout amount must be greater than zero');
  }

  if (input.amount > balance.available_balance) {
    throw new Error(
      `Requested payout amount ${input.amount} exceeds available balance ${balance.available_balance} ${balance.currency}`
    );
  }

  // 4. Resolve destination and reference
  let destinationType = input.destination_type || 'loop_number';
  let destinationReference = input.destination_reference || null;

  if (!destinationReference) {
    if (destinationType === 'loop_number' && profile.phone) {
      destinationReference = profile.phone;
    } else {
      const rules = await getMoneyDirectionRules(profileId);
      const firstActiveDest = rules.find((r) => r.is_active && r.destination_reference);
      if (firstActiveDest?.destination_reference) {
        destinationType = firstActiveDest.destination_type;
        destinationReference = firstActiveDest.destination_reference;
      } else if (profile.phone) {
        destinationReference = profile.phone;
      }
    }
  }

  const currency = input.currency || profile.currency || 'KES';
  const provider = input.provider || 'loop';
  const feeResult = calculateDisbursementFee(input.amount, destinationType, currency);
  const fee = feeResult.total_fee;
  const netAmount = feeResult.net_amount;
  const now = new Date().toISOString();
  const payoutId = crypto.randomUUID();

  const payoutRecord: PayoutEntity = {
    id: payoutId,
    profile_id: profileId,
    provider,
    requested_amount: input.amount,
    requested_currency: currency,
    destination_type: destinationType,
    destination_reference: destinationReference,
    fee,
    net_amount: netAmount,
    status: 'requested',
    provider_reference: null,
    requested_at: now,
    processed_at: null,
    raw_payload: null,
    idempotency_key: idempotencyKey,
    created_at: now,
    updated_at: now,
  };

  // 5. Insert initial 'requested' record
  try {
    await pool.query(
      `INSERT INTO payouts
        (id, profile_id, provider, requested_amount, requested_currency, destination_type, destination_reference, fee, net_amount, status, provider_reference, requested_at, processed_at, raw_payload, idempotency_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        payoutRecord.id,
        payoutRecord.profile_id,
        payoutRecord.provider,
        payoutRecord.requested_amount,
        payoutRecord.requested_currency,
        payoutRecord.destination_type,
        payoutRecord.destination_reference,
        payoutRecord.fee,
        payoutRecord.net_amount,
        payoutRecord.status,
        payoutRecord.provider_reference,
        payoutRecord.requested_at,
        payoutRecord.processed_at,
        JSON.stringify(payoutRecord.raw_payload),
        payoutRecord.idempotency_key,
        payoutRecord.created_at,
        payoutRecord.updated_at,
      ]
    );
  } catch (err) {
    rootLogger.debug('Falling back to memory for initial payout insert', {
      error: (err as Error).message,
    });
  }

  inMemoryPayouts.set(payoutRecord.id, payoutRecord);
  idempotencyKeyMap.set(payoutRecord.idempotency_key, payoutRecord.id);

  // 6. Execute disbursement via provider adapter
  const adapter = defaultAdapterRegistry.get(provider);
  try {
    payoutRecord.status = 'processing';

    const payoutResult = await adapter.disburse({
      recipientIdentifier: destinationReference || profile.phone || '254700000000',
      amount: netAmount,
      currency,
      idempotencyKey,
      remarks: input.remarks || 'UniPay Disbursement',
    });

    const processedAt = new Date().toISOString();
    payoutRecord.status = payoutResult.status === 'processing' ? 'processing' : (payoutResult.status === 'failed' ? 'failed' : 'completed');
    payoutRecord.provider_reference = payoutResult.disbursementReference;
    payoutRecord.processed_at = processedAt;
    payoutRecord.raw_payload = payoutResult.rawResponse;
    payoutRecord.updated_at = processedAt;

    try {
      await pool.query(
        `UPDATE payouts
         SET status = $1,
             provider_reference = $2,
             processed_at = $3,
             raw_payload = $4,
             updated_at = $5
         WHERE id = $6`,
        [
          payoutRecord.status,
          payoutRecord.provider_reference,
          payoutRecord.processed_at,
          JSON.stringify(payoutRecord.raw_payload),
          payoutRecord.updated_at,
          payoutRecord.id,
        ]
      );
    } catch (err) {
      rootLogger.debug('Falling back to memory for updating payout status', {
        error: (err as Error).message,
      });
    }

    inMemoryPayouts.set(payoutRecord.id, payoutRecord);

    rootLogger.info('Payout disbursement completed', {
      payout_id: payoutRecord.id,
      status: payoutRecord.status,
      provider_reference: payoutRecord.provider_reference,
      amount: payoutRecord.requested_amount,
    });

    return payoutRecord;
  } catch (disburseErr) {
    const failedAt = new Date().toISOString();
    payoutRecord.status = 'failed';
    payoutRecord.processed_at = failedAt;
    payoutRecord.raw_payload = { error: (disburseErr as Error).message };
    payoutRecord.updated_at = failedAt;

    try {
      await pool.query(
        `UPDATE payouts
         SET status = 'failed',
             processed_at = $1,
             raw_payload = $2,
             updated_at = $3
         WHERE id = $4`,
        [failedAt, JSON.stringify(payoutRecord.raw_payload), failedAt, payoutRecord.id]
      );
    } catch {
      // Ignored in fallback
    }

    inMemoryPayouts.set(payoutRecord.id, payoutRecord);

    rootLogger.error('Payout disbursement execution failed', {
      payout_id: payoutRecord.id,
      error: (disburseErr as Error).message,
    });

    throw disburseErr;
  }
}

/**
 * Handles automatic disbursements triggered by settlement-transition rule evaluation (§12, §17)
 */
export async function processAutomaticDisbursements(
  decision: MoneyDirectionDecision,
  transaction: TransactionEntity
): Promise<PayoutEntity[]> {
  const results: PayoutEntity[] = [];

  for (const allocation of decision.allocations) {
    // Skip allocations that stay in UniPay balance
    if (allocation.destination_type === 'balance' || allocation.amount <= 0) {
      continue;
    }

    const idempotencyKey = `auto_payout_${transaction.id}_${allocation.rule_id || 'rule'}_${allocation.destination_type}`;

    try {
      const payout = await createPayout({
        profile_id: decision.profile_id,
        amount: allocation.amount,
        currency: decision.currency,
        destination_type: allocation.destination_type,
        destination_reference: allocation.destination_reference,
        idempotency_key: idempotencyKey,
        provider: 'loop',
        remarks: `Auto-disbursement for transaction ${transaction.internal_reference}`,
      });
      results.push(payout);
    } catch (err) {
      rootLogger.error('Failed to process automatic disbursement allocation', {
        profile_id: decision.profile_id,
        transaction_id: transaction.id,
        allocation,
        error: (err as Error).message,
      });
    }
  }

  return results;
}

export async function getPayoutById(id: string): Promise<PayoutEntity | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM payouts WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length > 0) {
      return mapRowToPayout(rows[0]);
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for getPayoutById', {
      error: (err as Error).message,
    });
  }

  return inMemoryPayouts.get(id) || null;
}

export async function listPayouts(filters?: {
  profile_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<PayoutEntity[]> {
  try {
    let query = `SELECT * FROM payouts WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (filters?.profile_id) {
      query += ` AND profile_id = $${idx++}`;
      params.push(filters.profile_id);
    }
    if (filters?.status) {
      query += ` AND status = $${idx++}`;
      params.push(filters.status);
    }

    query += ` ORDER BY requested_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(filters?.limit || 50);
    params.push(filters?.offset || 0);

    const { rows } = await pool.query(query, params);
    if (rows.length > 0) {
      return rows.map(mapRowToPayout);
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory for listPayouts', {
      error: (err as Error).message,
    });
  }

  let list = Array.from(inMemoryPayouts.values());
  if (filters?.profile_id) {
    list = list.filter((p) => p.profile_id === filters.profile_id);
  }
  if (filters?.status) {
    list = list.filter((p) => p.status === filters.status);
  }

  list.sort(
    (a, b) =>
      new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
  );

  const offset = filters?.offset || 0;
  const limit = filters?.limit || 50;
  return list.slice(offset, offset + limit);
}

function mapRowToPayout(row: any): PayoutEntity {
  return {
    ...row,
    requested_amount: Number(row.requested_amount),
    fee: Number(row.fee || 0),
    net_amount: Number(row.net_amount),
    raw_payload:
      typeof row.raw_payload === 'string'
        ? JSON.parse(row.raw_payload)
        : row.raw_payload,
  };
}

export function clearPayoutCache(): void {
  inMemoryPayouts.clear();
  idempotencyKeyMap.clear();
}
