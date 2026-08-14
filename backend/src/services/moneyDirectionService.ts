import crypto from 'crypto';
import { pool } from '../db';
import { rootLogger } from '../utils/logger';
import { getProfileById } from './profileService';
import {
  MoneyDirectionRule,
  MoneyDirectionAllocation,
  MoneyDirectionDecision,
  MoneyDirectionDestinationType,
  MoneyDirectionAllocationType,
} from '@unipay/shared';
import { TransactionEntity } from './transactionService';

// In-memory fallback map for test/offline execution (profileId -> MoneyDirectionRule[])
const inMemoryRules = new Map<string, MoneyDirectionRule[]>();
const evaluationHistory: MoneyDirectionDecision[] = [];

export interface RuleInputDTO {
  id?: string;
  destination_type: MoneyDirectionDestinationType;
  destination_reference?: string | null;
  allocation_type: MoneyDirectionAllocationType;
  allocation_value?: number | null;
  priority_order?: number;
  is_active?: boolean;
}

/**
 * Validates money direction rules configuration against business constraints (§17)
 */
export async function validateRules(
  profileId: string,
  rules: RuleInputDTO[]
): Promise<void> {
  const profile = await getProfileById(profileId);
  if (!profile) {
    throw new Error('Profile not found');
  }

  let totalActivePercentage = 0;

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const isActive = r.is_active !== false;

    // 1. Destination check
    if (r.destination_type === 'loop_number') {
      if (!profile.phone && !r.destination_reference) {
        throw new Error(
          'Profile does not have a linked LOOP mobile number on file'
        );
      }
    }

    // 2. Allocation type & value check
    if (r.allocation_type === 'percentage') {
      if (
        r.allocation_value === undefined ||
        r.allocation_value === null ||
        r.allocation_value <= 0 ||
        r.allocation_value > 100
      ) {
        throw new Error(
          `Invalid percentage value ${r.allocation_value}. Percentage must be between 0 and 100.`
        );
      }
      if (isActive) {
        totalActivePercentage += Number(r.allocation_value);
      }
    } else if (r.allocation_type === 'fixed_amount') {
      if (
        r.allocation_value === undefined ||
        r.allocation_value === null ||
        r.allocation_value <= 0
      ) {
        throw new Error(
          `Invalid fixed amount ${r.allocation_value}. Amount must be greater than 0.`
        );
      }
    } else if (r.allocation_type === 'full') {
      // Valid without allocation_value
    } else {
      throw new Error(`Unsupported allocation type: ${r.allocation_type}`);
    }
  }

  // Reject active percentage sums > 100%
  if (totalActivePercentage > 100) {
    throw new Error(
      `Active percentage rules sum to ${totalActivePercentage}%, which exceeds 100% limit`
    );
  }
}

/**
 * Retrieves all money direction rules for a profile, sorted by priority_order
 */
export async function getMoneyDirectionRules(
  profileId: string
): Promise<MoneyDirectionRule[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM money_direction_rules
       WHERE profile_id = $1
       ORDER BY priority_order ASC, created_at ASC`,
      [profileId]
    );

    if (rows.length > 0) {
      const mapped: MoneyDirectionRule[] = rows.map((r) => ({
        ...r,
        allocation_value:
          r.allocation_value !== null ? Number(r.allocation_value) : null,
      }));
      inMemoryRules.set(profileId, mapped);
      return mapped;
    }
  } catch (err) {
    rootLogger.debug(
      'Falling back to memory store for getMoneyDirectionRules',
      {
        error: (err as Error).message,
      }
    );
  }

  return inMemoryRules.get(profileId) || [];
}

/**
 * Atomically updates/replaces money direction rules for a profile (§17)
 */
export async function setMoneyDirectionRules(
  profileId: string,
  ruleInputs: RuleInputDTO[]
): Promise<MoneyDirectionRule[]> {
  await validateRules(profileId, ruleInputs);

  const profile = await getProfileById(profileId);
  const now = new Date().toISOString();

  const formattedRules: MoneyDirectionRule[] = ruleInputs.map((r, index) => {
    let destRef = r.destination_reference || null;
    if (r.destination_type === 'loop_number' && !destRef && profile?.phone) {
      destRef = profile.phone;
    } else if (r.destination_type === 'balance') {
      destRef = null;
    }

    return {
      id: r.id || crypto.randomUUID(),
      profile_id: profileId,
      destination_type: r.destination_type,
      destination_reference: destRef,
      allocation_type: r.allocation_type,
      allocation_value:
        r.allocation_value !== undefined && r.allocation_value !== null
          ? Number(r.allocation_value)
          : null,
      priority_order: r.priority_order !== undefined ? r.priority_order : index + 1,
      is_active: r.is_active !== false,
      created_at: now,
      updated_at: now,
    };
  });

  // Sort by priority_order ASC
  formattedRules.sort((a, b) => a.priority_order - b.priority_order);

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'DELETE FROM money_direction_rules WHERE profile_id = $1',
        [profileId]
      );

      for (const r of formattedRules) {
        await client.query(
          `INSERT INTO money_direction_rules
            (id, profile_id, destination_type, destination_reference, allocation_type, allocation_value, priority_order, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            r.id,
            r.profile_id,
            r.destination_type,
            r.destination_reference,
            r.allocation_type,
            r.allocation_value,
            r.priority_order,
            r.is_active,
            r.created_at,
            r.updated_at,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    rootLogger.debug(
      'Falling back to memory store for setMoneyDirectionRules',
      {
        error: (err as Error).message,
      }
    );
  }

  inMemoryRules.set(profileId, formattedRules);
  rootLogger.info('Updated money direction rules for profile', {
    profile_id: profileId,
    rule_count: formattedRules.length,
  });

  return formattedRules;
}

/**
 * Settlement-time rule evaluation engine (§17)
 * Evaluates active rules in priority_order and produces a routing decision without moving money.
 */
export async function evaluateMoneyDirection(
  profileId: string,
  settledAmount: number
): Promise<MoneyDirectionDecision> {
  const profile = await getProfileById(profileId);
  const currency = profile?.currency || 'KES';
  const now = new Date().toISOString();

  if (settledAmount <= 0) {
    const emptyDecision: MoneyDirectionDecision = {
      profile_id: profileId,
      settled_amount: settledAmount,
      currency,
      allocations: [
        {
          rule_id: null,
          destination_type: 'balance',
          destination_reference: null,
          amount: 0,
        },
      ],
      evaluated_at: now,
    };
    evaluationHistory.push(emptyDecision);
    return emptyDecision;
  }

  const allRules = await getMoneyDirectionRules(profileId);
  const activeRules = allRules
    .filter((r) => r.is_active)
    .sort((a, b) => a.priority_order - b.priority_order);

  // Default behavior if no active rules apply: keep 100% as UniPay available balance (§17)
  if (activeRules.length === 0) {
    const defaultDecision: MoneyDirectionDecision = {
      profile_id: profileId,
      settled_amount: settledAmount,
      currency,
      allocations: [
        {
          rule_id: null,
          destination_type: 'balance',
          destination_reference: null,
          amount: Math.round(settledAmount * 100) / 100,
        },
      ],
      evaluated_at: now,
    };
    evaluationHistory.push(defaultDecision);
    return defaultDecision;
  }

  let remaining = settledAmount;
  const allocations: MoneyDirectionAllocation[] = [];

  for (const rule of activeRules) {
    if (remaining <= 0) break;

    let allocated = 0;

    if (rule.allocation_type === 'fixed_amount') {
      const targetAmount = rule.allocation_value || 0;
      allocated = Math.min(remaining, targetAmount);
    } else if (rule.allocation_type === 'percentage') {
      const percentage = rule.allocation_value || 0;
      const targetAmount = Math.round(((settledAmount * percentage) / 100) * 100) / 100;
      allocated = Math.min(remaining, targetAmount);
    } else if (rule.allocation_type === 'full') {
      allocated = remaining;
    }

    allocated = Math.round(allocated * 100) / 100;

    if (allocated > 0) {
      let destRef = rule.destination_reference || null;
      if (rule.destination_type === 'loop_number' && !destRef && profile?.phone) {
        destRef = profile.phone;
      }

      allocations.push({
        rule_id: rule.id,
        destination_type: rule.destination_type,
        destination_reference: destRef,
        amount: allocated,
      });

      remaining = Math.round((remaining - allocated) * 100) / 100;
    }
  }

  // Any remaining unrouted funds default to UniPay available balance
  if (remaining > 0) {
    allocations.push({
      rule_id: null,
      destination_type: 'balance',
      destination_reference: null,
      amount: remaining,
    });
  }

  const decision: MoneyDirectionDecision = {
    profile_id: profileId,
    settled_amount: settledAmount,
    currency,
    allocations,
    evaluated_at: now,
  };

  evaluationHistory.push(decision);

  rootLogger.info('Evaluated money direction routing decision', {
    profile_id: profileId,
    settled_amount: settledAmount,
    allocation_count: allocations.length,
    allocations,
  });

  return decision;
}

/**
 * Settlement transition hook: invoked automatically whenever a transaction moves to 'settled'
 */
export async function onSettlementTransition(
  transaction: TransactionEntity
): Promise<MoneyDirectionDecision> {
  const settledAmount = transaction.net_amount ?? transaction.amount;
  rootLogger.info('Settlement transition hook triggered', {
    transaction_id: transaction.id,
    profile_id: transaction.recipient_profile_id,
    settled_amount: settledAmount,
  });

  const decision = await evaluateMoneyDirection(
    transaction.recipient_profile_id,
    settledAmount
  );

  // Trigger automatic payouts for non-balance allocations (§12, §17)
  try {
    const { processAutomaticDisbursements } = await import('./payoutService');
    await processAutomaticDisbursements(decision, transaction);
  } catch (err) {
    rootLogger.error('Error executing automatic disbursements on settlement hook', {
      transaction_id: transaction.id,
      error: (err as Error).message,
    });
  }

  return decision;
}

export function getEvaluationHistory(): MoneyDirectionDecision[] {
  return [...evaluationHistory];
}

export function clearMoneyDirectionCache(): void {
  inMemoryRules.clear();
  evaluationHistory.length = 0;
}
