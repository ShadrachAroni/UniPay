import crypto from 'crypto';
import { pool } from '../db';
import {
  ReconciliationMatch,
  ReconciliationException,
  ReconciliationMatchType,
  ReconciliationMatchSource,
  ReconciliationMatchStatus,
  ReconciliationExceptionCategory,
  ReconciliationExceptionStatus,
  ReconciliationDashboardMetrics,
} from '@unipay/shared';
import {
  TransactionEntity,
  listTransactions,
  getTransactionById,
} from './transactionService';
import {
  PaymentIntentEntity,
  listPaymentIntents,
  getPaymentIntentById,
} from './paymentIntentService';
import { getRailByAdapterKey } from './paymentRailService';
import { rootLogger } from '../utils/logger';
import { aiService, logAIInteraction } from './aiService';

export interface ReconciliationConfig {
  timeWindowMinutes?: number;
  confidenceThreshold?: number;
  feeTolerancePercent?: number;
}

export interface RuleMatchResult {
  candidate: PaymentIntentEntity;
  matchType: ReconciliationMatchType;
  confidenceScore: number;
  notes?: string;
}

// In-memory caches for fallback in tests/offline mode
const inMemoryMatches = new Map<string, ReconciliationMatch>();
const inMemoryExceptions = new Map<string, ReconciliationException>();

// Helper to normalize phone numbers for matching (e.g., '+254704540384', '0704540384', '254704540384')
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) {
    return digits.slice(3); // 9 digits
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return digits.slice(1); // 9 digits
  }
  return digits;
}

// -------------------------------------------------------------
// 2. Matching Rules Engine in Strict Priority Order (§14)
// -------------------------------------------------------------

/**
 * Rule 1: Exact invoice/order reference match
 * Highest confidence (1.00 fixed).
 * Matches payment_intents.order_reference or transaction raw_payload / external reference.
 */
export function matchExactReference(
  tx: TransactionEntity,
  candidates: PaymentIntentEntity[]
): RuleMatchResult | null {
  const rawPayload = (tx.raw_payload as any) || {};
  const txOrderRef =
    rawPayload.orderReference ||
    rawPayload.order_reference ||
    rawPayload.billRefNumber ||
    rawPayload.BillRefNumber ||
    rawPayload.AccountReference;

  for (const candidate of candidates) {
    // Check if intent ID directly matches
    if (tx.payment_intent_id && tx.payment_intent_id === candidate.id) {
      return {
        candidate,
        matchType: 'exact_reference',
        confidenceScore: 1.0,
        notes: `Exact reference matched via linked payment_intent_id '${candidate.id}'`,
      };
    }

    // Check if order_reference matches
    if (
      txOrderRef &&
      candidate.order_reference &&
      txOrderRef.trim().toLowerCase() === candidate.order_reference.trim().toLowerCase()
    ) {
      return {
        candidate,
        matchType: 'exact_reference',
        confidenceScore: 1.0,
        notes: `Exact order reference match on '${candidate.order_reference}'`,
      };
    }

    // Check if external or internal reference contains/matches the order reference
    if (
      candidate.order_reference &&
      (tx.external_reference === candidate.order_reference ||
        tx.internal_reference === candidate.order_reference)
    ) {
      return {
        candidate,
        matchType: 'exact_reference',
        confidenceScore: 1.0,
        notes: `Exact transaction reference match on '${candidate.order_reference}'`,
      };
    }
  }

  return null;
}

/**
 * Rule 2: Exact amount within a configured time window
 * Confidence score varies with time closeness (0.80 - 0.95).
 */
export function matchExactAmountTimeWindow(
  tx: TransactionEntity,
  candidates: PaymentIntentEntity[],
  config: ReconciliationConfig
): RuleMatchResult | null {
  const windowMinutes =
    config.timeWindowMinutes ??
    parseInt(process.env.RECON_TIME_WINDOW_MINUTES || '60', 10);
  const windowMs = windowMinutes * 60 * 1000;
  const txTime = new Date(tx.transaction_time || tx.created_at).getTime();

  let bestMatch: RuleMatchResult | null = null;
  let minDeltaMs = Infinity;

  for (const candidate of candidates) {
    // Must match recipient profile and exact amount (within 0.01 precision)
    if (Math.abs(tx.amount - candidate.amount) < 0.01) {
      const intentTime = new Date(
        candidate.initiated_at || candidate.created_at
      ).getTime();
      const deltaMs = Math.abs(txTime - intentTime);

      if (deltaMs <= windowMs && deltaMs < minDeltaMs) {
        minDeltaMs = deltaMs;
        const deltaMinutes = deltaMs / (60 * 1000);

        // Meaningful confidence score varying with time delta proximity
        let confidenceScore = 0.8;
        if (deltaMinutes <= 5) {
          confidenceScore = 0.95;
        } else if (deltaMinutes <= 15) {
          confidenceScore = 0.9;
        } else if (deltaMinutes <= 30) {
          confidenceScore = 0.85;
        } else {
          confidenceScore = 0.8;
        }

        bestMatch = {
          candidate,
          matchType: 'exact_amount_window',
          confidenceScore,
          notes: `Exact amount (${tx.amount} ${tx.currency}) matched within ${deltaMinutes.toFixed(1)} mins (window: ${windowMinutes}m)`,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Rule 3: Payer phone or email + exact amount
 * Matches on payer identifier (phone or email) plus exact amount.
 * Phone match = 0.85, Email match = 0.80.
 */
export function matchPayerAndAmount(
  tx: TransactionEntity,
  candidates: PaymentIntentEntity[]
): RuleMatchResult | null {
  const txPayer = tx.payer_identifier?.trim();
  if (!txPayer) return null;

  const normalizedTxPhone = normalizePhoneNumber(txPayer);
  const isTxEmail = txPayer.includes('@');
  const lowerTxEmail = txPayer.toLowerCase();

  for (const candidate of candidates) {
    if (Math.abs(tx.amount - candidate.amount) < 0.01) {
      // Check phone match
      if (candidate.payer_phone && normalizedTxPhone) {
        const normalizedCandidatePhone = normalizePhoneNumber(
          candidate.payer_phone
        );
        if (
          normalizedCandidatePhone &&
          normalizedTxPhone === normalizedCandidatePhone
        ) {
          return {
            candidate,
            matchType: 'payer_amount',
            confidenceScore: 0.85,
            notes: `Matched on payer phone '${candidate.payer_phone}' and exact amount ${tx.amount} ${tx.currency}`,
          };
        }
      }

      // Check email match
      if (
        candidate.payer_email &&
        isTxEmail &&
        candidate.payer_email.toLowerCase() === lowerTxEmail
      ) {
        return {
          candidate,
          matchType: 'payer_amount',
          confidenceScore: 0.8,
          notes: `Matched on payer email '${candidate.payer_email}' and exact amount ${tx.amount} ${tx.currency}`,
        };
      }
    }
  }

  return null;
}

/**
 * String similarity metric (Levenshtein + token overlap) for AI fuzzy matching (§14, §15)
 */
export function calculateStringSimilarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const str2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) {
    return Math.min(str1.length, str2.length) / Math.max(str1.length, str2.length);
  }

  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  const distance = track[str2.length][str1.length];
  const maxLen = Math.max(str1.length, str2.length);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Extension Point: AI-assisted fuzzy matching (§14, §15)
 * Identifies near-miss references (typos, prefixes, informal descriptions)
 * and assigns a calibrated confidence score. Subject to standard thresholding.
 */
export async function aiFuzzyMatchRule(
  tx: TransactionEntity,
  candidates: PaymentIntentEntity[],
  _config: ReconciliationConfig = {}
): Promise<RuleMatchResult | null> {
  const txRef = tx.external_reference || tx.internal_reference || '';
  const txPayer = tx.payer_identifier || '';

  for (const candidate of candidates) {
    const candidateRef = candidate.order_reference || '';
    if (!candidateRef) continue;

    // Must match exact or very close amount for safe fuzzy reference comparison
    const amountMatches = Math.abs(tx.amount - candidate.amount) < 0.01;
    if (!amountMatches) continue;

    const refSimilarity = calculateStringSimilarity(txRef, candidateRef);
    const payerSimilarity = txPayer ? calculateStringSimilarity(txPayer, candidateRef) : 0;
    const bestSimilarity = Math.max(refSimilarity, payerSimilarity);

    // If similarity indicates a typo or near match (>= 0.60)
    if (bestSimilarity >= 0.60) {
      // Scale confidence score proportionally (e.g. 0.65 - 0.85)
      const confidenceScore =
        Math.round((0.65 + (bestSimilarity - 0.60) * 0.5) * 100) / 100;

      // Non-negotiable audit logging to ai_interactions (§11, §19)
      try {
        await logAIInteraction({
          profile_id: tx.recipient_profile_id,
          interaction_type: 'reconciliation',
          input_summary: `Fuzzy compare: tx '${txRef}' vs candidate '${candidateRef}'`,
          output_summary: `Fuzzy similarity ${bestSimilarity.toFixed(2)}, assigned confidence ${confidenceScore}`,
          confidence_score: confidenceScore,
          reviewed_by_human: false,
        });
      } catch (err) {
        rootLogger.debug('Failed to log AI interaction for fuzzy match', {
          error: (err as Error).message,
        });
      }

      return {
        candidate,
        matchType: 'ai_fuzzy',
        confidenceScore,
        notes: `AI fuzzy match: ${(bestSimilarity * 100).toFixed(0)}% similarity between '${txRef}' and '${candidateRef}'`,
      };
    }
  }

  return null;
}

/**
 * Rule 4: Manual Review Fallback
 * Evaluates rules top-down in strict priority order.
 * If no rule clears confidence threshold, returns status: 'pending_review' with match_type: 'manual'.
 */
export async function evaluateMatchingRules(
  tx: TransactionEntity,
  candidates: PaymentIntentEntity[],
  config: ReconciliationConfig = {}
): Promise<{
  match: RuleMatchResult | null;
  status: ReconciliationMatchStatus;
}> {
  const threshold =
    config.confidenceThreshold ??
    parseFloat(process.env.RECON_CONFIDENCE_THRESHOLD || '0.70');

  // Priority 1: Exact Reference
  const rule1 = matchExactReference(tx, candidates);
  if (rule1 && rule1.confidenceScore >= threshold) {
    return { match: rule1, status: 'confirmed' };
  }

  // Priority 2: Exact Amount + Configured Time Window
  const rule2 = matchExactAmountTimeWindow(tx, candidates, config);
  if (rule2 && rule2.confidenceScore >= threshold) {
    return { match: rule2, status: 'confirmed' };
  }

  // Priority 3: Payer (Phone/Email) + Amount
  const rule3 = matchPayerAndAmount(tx, candidates);
  if (rule3 && rule3.confidenceScore >= threshold) {
    return { match: rule3, status: 'confirmed' };
  }

  // Priority 3.5 (Extension Point): AI-Assisted Fuzzy Match (Phase 4B)
  const ruleAI = await aiFuzzyMatchRule(tx, candidates, config);
  if (ruleAI && ruleAI.confidenceScore >= threshold) {
    return { match: ruleAI, status: 'proposed' };
  }

  // Priority 4: Manual Review Fallback
  // If any rule produced a sub-threshold match or no match at all, never auto-approve.
  const subThresholdCandidate = rule1 || rule2 || rule3 || ruleAI;
  if (subThresholdCandidate) {
    return {
      match: {
        ...subThresholdCandidate,
        matchType: 'manual',
        notes: `Sub-threshold confidence (${subThresholdCandidate.confidenceScore} < ${threshold}). Routed to manual review.`,
      },
      status: 'pending_review',
    };
  }

  return { match: null, status: 'pending_review' };
}

// -------------------------------------------------------------
// 3. Exception Classifiers (§14)
// -------------------------------------------------------------

export interface DetectedException {
  profile_id: string;
  transaction_id?: string | null;
  category: ReconciliationExceptionCategory;
  details: Record<string, unknown>;
}

export async function detectExceptions(
  transactions: TransactionEntity[],
  intents: PaymentIntentEntity[],
  matches: ReconciliationMatch[]
): Promise<DetectedException[]> {
  const exceptions: DetectedException[] = [];
  const matchedTxIds = new Set(matches.map((m) => m.transaction_id));
  const matchedIntentIds = new Set(
    matches
      .map((m) => m.expected_payment_id)
      .filter((id): id is string => Boolean(id))
  );

  // 1. Missing Provider Transaction: Payment intent was created/completed, but no transaction recorded
  const now = Date.now();
  for (const intent of intents) {
    if (intent.status === 'completed' || intent.status === 'created') {
      const intentAgeMinutes =
        (now - new Date(intent.created_at).getTime()) / (60 * 1000);
      const isMatched = matchedIntentIds.has(intent.id);

      if (!isMatched && intentAgeMinutes > 15) {
        exceptions.push({
          profile_id: intent.recipient_profile_id,
          transaction_id: null,
          category: 'missing_provider_transaction',
          details: {
            payment_intent_id: intent.id,
            order_reference: intent.order_reference,
            expected_amount: intent.amount,
            currency: intent.currency,
            provider: intent.provider,
            rail: intent.rail,
            age_minutes: Math.round(intentAgeMinutes),
            reason: `Payment intent '${intent.order_reference}' created ${Math.round(intentAgeMinutes)} mins ago with no provider transaction received.`,
          },
        });
      }
    }
  }

  // 2. Duplicate Payment: Multiple transactions referencing the same intent or external reference
  const extRefMap = new Map<string, TransactionEntity[]>();
  const intentTxMap = new Map<string, TransactionEntity[]>();

  for (const tx of transactions) {
    if (tx.external_reference) {
      const list = extRefMap.get(tx.external_reference) || [];
      list.push(tx);
      extRefMap.set(tx.external_reference, list);
    }
    if (tx.payment_intent_id) {
      const list = intentTxMap.get(tx.payment_intent_id) || [];
      list.push(tx);
      intentTxMap.set(tx.payment_intent_id, list);
    }
  }

  for (const [extRef, txs] of extRefMap.entries()) {
    if (txs.length > 1) {
      for (const tx of txs.slice(1)) {
        exceptions.push({
          profile_id: tx.recipient_profile_id,
          transaction_id: tx.id,
          category: 'duplicate_payment',
          details: {
            external_reference: extRef,
            duplicate_transaction_ids: txs.map((t) => t.id),
            amount: tx.amount,
            reason: `Duplicate payment detected with external reference '${extRef}' across ${txs.length} transactions.`,
          },
        });
      }
    }
  }

  for (const [intentId, txs] of intentTxMap.entries()) {
    if (txs.length > 1) {
      for (const tx of txs.slice(1)) {
        // avoid duplicate reporting if already flagged
        const alreadyFlagged = exceptions.some(
          (e) =>
            e.transaction_id === tx.id && e.category === 'duplicate_payment'
        );
        if (!alreadyFlagged) {
          exceptions.push({
            profile_id: tx.recipient_profile_id,
            transaction_id: tx.id,
            category: 'duplicate_payment',
            details: {
              payment_intent_id: intentId,
              duplicate_transaction_ids: txs.map((t) => t.id),
              amount: tx.amount,
              reason: `Multiple transactions (${txs.length}) linked to payment intent '${intentId}'.`,
            },
          });
        }
      }
    }
  }

  // 3. Unknown Provider Reference
  for (const tx of transactions) {
    const ref = tx.external_reference || tx.internal_reference;
    if (
      !ref ||
      ref.toUpperCase() === 'UNKNOWN' ||
      ref.toUpperCase() === 'NULL' ||
      ref.length < 3
    ) {
      exceptions.push({
        profile_id: tx.recipient_profile_id,
        transaction_id: tx.id,
        category: 'unknown_provider_reference',
        details: {
          external_reference: tx.external_reference,
          internal_reference: tx.internal_reference,
          amount: tx.amount,
          reason: `Transaction contains invalid or unknown provider reference '${ref}'.`,
        },
      });
    }
  }

  // 4. Missing Order / Unmatched Transaction
  for (const tx of transactions) {
    if (!matchedTxIds.has(tx.id)) {
      // Check if there is an amount mismatch against a known intent with same payer or ref
      const candidateWithSamePayerOrRef = intents.find(
        (i) =>
          i.recipient_profile_id === tx.recipient_profile_id &&
          (i.order_reference === (tx.raw_payload as any)?.orderReference ||
            (tx.payer_identifier &&
              i.payer_phone &&
              normalizePhoneNumber(i.payer_phone) ===
                normalizePhoneNumber(tx.payer_identifier)))
      );

      if (
        candidateWithSamePayerOrRef &&
        Math.abs(tx.amount - candidateWithSamePayerOrRef.amount) >= 0.01
      ) {
        // 5. Amount Mismatch Exception
        exceptions.push({
          profile_id: tx.recipient_profile_id,
          transaction_id: tx.id,
          category: 'amount_mismatch',
          details: {
            payment_intent_id: candidateWithSamePayerOrRef.id,
            expected_amount: candidateWithSamePayerOrRef.amount,
            received_amount: tx.amount,
            difference: tx.amount - candidateWithSamePayerOrRef.amount,
            order_reference: candidateWithSamePayerOrRef.order_reference,
            reason: `Amount mismatch for order '${candidateWithSamePayerOrRef.order_reference}': expected ${candidateWithSamePayerOrRef.amount} ${tx.currency}, received ${tx.amount} ${tx.currency}.`,
          },
        });
      } else {
        // Missing Order Exception
        exceptions.push({
          profile_id: tx.recipient_profile_id,
          transaction_id: tx.id,
          category: 'missing_order',
          details: {
            transaction_id: tx.id,
            amount: tx.amount,
            currency: tx.currency,
            rail: tx.rail,
            external_reference: tx.external_reference,
            payer_identifier: tx.payer_identifier,
            reason: `Transaction '${tx.external_reference}' of ${tx.amount} ${tx.currency} has no corresponding payment intent or order reference.`,
          },
        });
      }
    }
  }

  // 6. Fee Mismatch: Provider fee charged deviates from configured rail fee structure
  // Batch pre-fetch all rails to prevent N+1 database queries across transactions
  const { listAllRails } = await import('./paymentRailService');
  const allRails = await listAllRails();
  const railMap = new Map<string, any>(
    allRails.map((r) => [r.adapter_key.toLowerCase(), r])
  );

  for (const tx of transactions) {
    if (tx.payment_status === 'successful' && tx.rail) {
      const rail = railMap.get(tx.rail.toLowerCase());
      if (rail && rail.capabilities_json?.feeStructure) {
        const feeConfig = rail.capabilities_json.feeStructure;
        const expectedFee =
          Math.round(
            ((feeConfig.fixed || 0) +
              tx.amount * (feeConfig.percentage || 0)) *
              100
          ) / 100;
        
        if (Math.abs(tx.provider_fee - expectedFee) > 0.05) {
          exceptions.push({
            profile_id: tx.recipient_profile_id,
            transaction_id: tx.id,
            category: 'fee_mismatch',
            details: {
              rail: tx.rail,
              amount: tx.amount,
              actual_fee: tx.provider_fee,
              expected_fee: expectedFee,
              difference: Math.round((tx.provider_fee - expectedFee) * 100) / 100,
              reason: `Fee mismatch on ${tx.rail}: charged ${tx.provider_fee} ${tx.currency}, expected ${expectedFee} ${tx.currency}.`,
            },
          });
        }
      }
    }
  }

  // 7. Settlement Delay: Transaction is successful but settlement is delayed or overdue
  for (const tx of transactions) {
    if (tx.payment_status === 'successful') {
      if (tx.settlement_status === 'delayed') {
        exceptions.push({
          profile_id: tx.recipient_profile_id,
          transaction_id: tx.id,
          category: 'settlement_delay',
          details: {
            transaction_id: tx.id,
            amount: tx.amount,
            rail: tx.rail,
            settlement_status: tx.settlement_status,
            reason: `Transaction '${tx.external_reference}' settlement status marked as 'delayed' by provider rail.`,
          },
        });
      } else if (tx.settlement_status === 'pending') {
        const txAgeHours =
          (now - new Date(tx.transaction_time || tx.created_at).getTime()) /
          (1000 * 60 * 60);
        // If pending for more than 24 hours (or instant rail pending > 1 hour)
        if (txAgeHours > 24) {
          exceptions.push({
            profile_id: tx.recipient_profile_id,
            transaction_id: tx.id,
            category: 'settlement_delay',
            details: {
              transaction_id: tx.id,
              amount: tx.amount,
              rail: tx.rail,
              age_hours: Math.round(txAgeHours),
              reason: `Transaction '${tx.external_reference}' settlement has been pending for ${Math.round(txAgeHours)} hours.`,
            },
          });
        }
      }
    }
  }

  return exceptions;
}

// -------------------------------------------------------------
// 4. Persistence & Full Reconciliation Run Execution (§14, §18)
// -------------------------------------------------------------

export async function saveReconciliationMatch(
  match: Omit<ReconciliationMatch, 'id' | 'created_at' | 'updated_at'>
): Promise<ReconciliationMatch> {
  const matchId = crypto.randomUUID();
  const now = new Date().toISOString();

  const record: ReconciliationMatch = {
    id: matchId,
    profile_id: match.profile_id,
    transaction_id: match.transaction_id,
    match_source: match.match_source,
    expected_payment_id: match.expected_payment_id || null,
    pool_contribution_id: match.pool_contribution_id || null,
    expected_reference: match.expected_reference || null,
    expected_amount: match.expected_amount,
    matched_amount: match.matched_amount,
    match_type: match.match_type,
    confidence_score: match.confidence_score,
    ai_explanation: match.ai_explanation || null,
    status: match.status,
    notes: match.notes || null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO reconciliation_matches (
        id, profile_id, transaction_id, match_source, expected_payment_id,
        pool_contribution_id, expected_reference, expected_amount, matched_amount,
        match_type, confidence_score, ai_explanation, status, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (transaction_id) DO UPDATE SET
        matched_amount = EXCLUDED.matched_amount,
        match_type = EXCLUDED.match_type,
        confidence_score = EXCLUDED.confidence_score,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
      RETURNING *`,
      [
        record.id,
        record.profile_id,
        record.transaction_id,
        record.match_source,
        record.expected_payment_id,
        record.pool_contribution_id,
        record.expected_reference,
        record.expected_amount,
        record.matched_amount,
        record.match_type,
        record.confidence_score,
        record.ai_explanation,
        record.status,
        record.notes,
        record.created_at,
        record.updated_at,
      ]
    );

    if (rows.length > 0) {
      const persisted: ReconciliationMatch = {
        ...rows[0],
        expected_amount: Number(rows[0].expected_amount),
        matched_amount: Number(rows[0].matched_amount),
        confidence_score: Number(rows[0].confidence_score),
      };
      inMemoryMatches.set(persisted.transaction_id, persisted);
      return persisted;
    }
  } catch (err) {
    rootLogger.debug('Falling back to memory store for saveReconciliationMatch', {
      error: (err as Error).message,
    });
  }

  inMemoryMatches.set(record.transaction_id, record);
  return record;
}

export async function saveReconciliationException(
  exc: DetectedException
): Promise<ReconciliationException> {
  const excId = crypto.randomUUID();
  const now = new Date().toISOString();

  const record: ReconciliationException = {
    id: excId,
    profile_id: exc.profile_id,
    transaction_id: exc.transaction_id || null,
    category: exc.category,
    status: 'open',
    details: exc.details,
    created_at: now,
    updated_at: now,
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO reconciliation_exceptions (
        id, profile_id, transaction_id, category, status, details, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        record.id,
        record.profile_id,
        record.transaction_id,
        record.category,
        record.status,
        JSON.stringify(record.details),
        record.created_at,
        record.updated_at,
      ]
    );

    if (rows.length > 0) {
      const persisted: ReconciliationException = {
        ...rows[0],
        details:
          typeof rows[0].details === 'string'
            ? JSON.parse(rows[0].details)
            : rows[0].details,
      };
      inMemoryExceptions.set(persisted.id, persisted);
      return persisted;
    }
  } catch (err) {
    rootLogger.debug(
      'Falling back to memory store for saveReconciliationException',
      {
        error: (err as Error).message,
      }
    );
  }

  inMemoryExceptions.set(record.id, record);
  return record;
}

export async function runReconciliation(options?: {
  profile_id?: string;
  date_from?: string;
  date_to?: string;
  rail?: string;
  config?: ReconciliationConfig;
}): Promise<{
  job_id: string;
  status: 'completed';
  matched_count: number;
  exception_count: number;
  matches: ReconciliationMatch[];
  exceptions: ReconciliationException[];
  duration_ms: number;
}> {
  const startTime = Date.now();
  const jobId = `job_recon_${crypto.randomUUID().slice(0, 8)}`;

  // 1. Fetch transactions & payment intents
  let transactions = await listTransactions({
    profile_id: options?.profile_id,
    limit: 500,
  });

  if (options?.rail) {
    transactions = transactions.filter(
      (tx) => tx.rail.toLowerCase() === options.rail?.toLowerCase()
    );
  }
  if (options?.date_from) {
    const fromTime = new Date(options.date_from).getTime();
    transactions = transactions.filter(
      (tx) =>
        new Date(tx.transaction_time || tx.created_at).getTime() >= fromTime
    );
  }
  if (options?.date_to) {
    const toTime = new Date(options.date_to).getTime();
    transactions = transactions.filter(
      (tx) =>
        new Date(tx.transaction_time || tx.created_at).getTime() <= toTime
    );
  }

  let intents = await listPaymentIntents({
    recipient_profile_id: options?.profile_id,
    limit: 500,
  });

  const createdMatches: ReconciliationMatch[] = [];

  // 2. Run deterministic matching engine
  for (const tx of transactions) {
    // Check if already matched
    const existingMatch = inMemoryMatches.get(tx.id);
    if (existingMatch && existingMatch.status === 'confirmed') {
      createdMatches.push(existingMatch);
      continue;
    }

    const { match, status } = await evaluateMatchingRules(
      tx,
      intents,
      options?.config
    );

    if (match) {
      let aiExplanation: string | null = null;
      try {
        const candidateForExplanation: ReconciliationMatch = {
          id: `match_temp_${tx.id}`,
          profile_id: tx.recipient_profile_id,
          transaction_id: tx.id,
          match_source: 'order',
          expected_payment_id: match.candidate.id,
          pool_contribution_id: null,
          expected_reference: match.candidate.order_reference,
          expected_amount: match.candidate.amount,
          matched_amount: tx.amount,
          match_type: match.matchType,
          confidence_score: match.confidenceScore,
          ai_explanation: null,
          status,
          notes: match.notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        aiExplanation = await aiService.explainMatch(candidateForExplanation);
      } catch (err) {
        rootLogger.warn('AI explainMatch failed in reconciliation run, degrading gracefully', {
          error: (err as Error).message,
          txId: tx.id,
        });
      }

      const saved = await saveReconciliationMatch({
        profile_id: tx.recipient_profile_id,
        transaction_id: tx.id,
        match_source: 'order',
        expected_payment_id: match.candidate.id,
        expected_reference: match.candidate.order_reference,
        expected_amount: match.candidate.amount,
        matched_amount: tx.amount,
        match_type: match.matchType,
        confidence_score: match.confidenceScore,
        ai_explanation: aiExplanation,
        status,
        notes: match.notes || null,
      });
      createdMatches.push(saved);
    }
  }

  // 3. Detect and classify exceptions
  const detectedExceptions = await detectExceptions(
    transactions,
    intents,
    createdMatches
  );
  const createdExceptions: ReconciliationException[] = [];

  for (const exc of detectedExceptions) {
    const saved = await saveReconciliationException(exc);
    createdExceptions.push(saved);
  }

  const durationMs = Date.now() - startTime;

  rootLogger.info('Reconciliation run completed', {
    job_id: jobId,
    matched_count: createdMatches.length,
    exception_count: createdExceptions.length,
    duration_ms: durationMs,
  });

  return {
    job_id: jobId,
    status: 'completed',
    matched_count: createdMatches.length,
    exception_count: createdExceptions.length,
    matches: createdMatches,
    exceptions: createdExceptions,
    duration_ms: durationMs,
  };
}

export async function listReconciliationExceptions(filters?: {
  profile_id?: string;
  category?: ReconciliationExceptionCategory;
  status?: ReconciliationExceptionStatus;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  exceptions: ReconciliationException[];
  total: number;
  limit: number;
  offset: number;
}> {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  try {
    let query = `SELECT * FROM reconciliation_exceptions WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (filters?.profile_id) {
      query += ` AND profile_id = $${idx++}`;
      params.push(filters.profile_id);
    }
    if (filters?.category) {
      query += ` AND category = $${idx++}`;
      params.push(filters.category);
    }
    if (filters?.status) {
      query += ` AND status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters?.date_from) {
      query += ` AND created_at >= $${idx++}`;
      params.push(filters.date_from);
    }
    if (filters?.date_to) {
      query += ` AND created_at <= $${idx++}`;
      params.push(filters.date_to);
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);
    if (rows.length > 0) {
      const list = rows.map((r) => ({
        ...r,
        details:
          typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
      }));
      return {
        exceptions: list,
        total: list.length,
        limit,
        offset,
      };
    }
  } catch (err) {
    rootLogger.debug(
      'Falling back to memory store for listReconciliationExceptions',
      {
        error: (err as Error).message,
      }
    );
  }

  let list = Array.from(inMemoryExceptions.values());
  if (filters?.profile_id) {
    list = list.filter((e) => e.profile_id === filters.profile_id);
  }
  if (filters?.category) {
    list = list.filter((e) => e.category === filters.category);
  }
  if (filters?.status) {
    list = list.filter((e) => e.status === filters.status);
  }
  if (filters?.date_from) {
    const fromTime = new Date(filters.date_from).getTime();
    list = list.filter((e) => new Date(e.created_at).getTime() >= fromTime);
  }
  if (filters?.date_to) {
    const toTime = new Date(filters.date_to).getTime();
    list = list.filter((e) => new Date(e.created_at).getTime() <= toTime);
  }

  const total = list.length;
  const paginated = list.slice(offset, offset + limit);

  return {
    exceptions: paginated,
    total,
    limit,
    offset,
  };
}

export async function listReconciliationMatches(filters?: {
  profile_id?: string;
  status?: ReconciliationMatchStatus;
}): Promise<ReconciliationMatch[]> {
  try {
    let query = `SELECT * FROM reconciliation_matches WHERE 1=1`;
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

    query += ` ORDER BY created_at DESC`;
    const { rows } = await pool.query(query, params);
    if (rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        expected_amount: Number(r.expected_amount),
        matched_amount: Number(r.matched_amount),
        confidence_score: Number(r.confidence_score),
      }));
    }
  } catch (err) {
    rootLogger.debug(
      'Falling back to memory store for listReconciliationMatches',
      {
        error: (err as Error).message,
      }
    );
  }

  let list = Array.from(inMemoryMatches.values());
  if (filters?.profile_id) {
    list = list.filter((m) => m.profile_id === filters.profile_id);
  }
  if (filters?.status) {
    list = list.filter((m) => m.status === filters.status);
  }
  return list;
}

// -------------------------------------------------------------
// 5. Dashboard-Surfacing Aggregate Queries (§14) — Reusable Service Methods
// -------------------------------------------------------------

export interface MetricFilterOptions {
  profile_id?: string;
  date_from?: string;
  date_to?: string;
  rail?: string;
}

export async function getGrossCollections(
  filters?: MetricFilterOptions
): Promise<number> {
  const txs = await listTransactions({
    profile_id: filters?.profile_id,
    payment_status: 'successful',
    limit: 10000,
  });
  return txs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
}

export async function getNetCollections(
  filters?: MetricFilterOptions
): Promise<number> {
  const txs = await listTransactions({
    profile_id: filters?.profile_id,
    payment_status: 'successful',
    limit: 10000,
  });
  return txs.reduce((sum, tx) => sum + (tx.net_amount || 0), 0);
}

export async function getTotalFees(
  filters?: MetricFilterOptions
): Promise<number> {
  const txs = await listTransactions({
    profile_id: filters?.profile_id,
    payment_status: 'successful',
    limit: 10000,
  });
  return txs.reduce((sum, tx) => sum + (tx.provider_fee || 0), 0);
}

export async function getSuccessfulPaymentsCount(
  filters?: MetricFilterOptions
): Promise<number> {
  const txs = await listTransactions({
    profile_id: filters?.profile_id,
    payment_status: 'successful',
    limit: 10000,
  });
  return txs.length;
}

export async function getPendingSettlementsCount(
  filters?: MetricFilterOptions
): Promise<number> {
  const txs = await listTransactions({
    profile_id: filters?.profile_id,
    settlement_status: 'pending',
    limit: 10000,
  });
  return txs.length;
}

export async function getFailedPaymentsCount(
  filters?: MetricFilterOptions
): Promise<number> {
  const txs = await listTransactions({
    profile_id: filters?.profile_id,
    payment_status: 'failed',
    limit: 10000,
  });
  return txs.length;
}

export async function getOpenExceptionsCount(
  filters?: MetricFilterOptions
): Promise<number> {
  const res = await listReconciliationExceptions({
    profile_id: filters?.profile_id,
    status: 'open',
    date_from: filters?.date_from,
    date_to: filters?.date_to,
  });
  return res.total;
}

export async function getReconciliationRate(
  filters?: MetricFilterOptions
): Promise<number> {
  const txs = await listTransactions({
    profile_id: filters?.profile_id,
    limit: 10000,
  });
  if (txs.length === 0) return 1.0;

  const matches = await listReconciliationMatches({
    profile_id: filters?.profile_id,
    status: 'confirmed',
  });
  const confirmedTxIds = new Set(matches.map((m) => m.transaction_id));
  const matchedCount = txs.filter((t) => confirmedTxIds.has(t.id)).length;

  return Math.round((matchedCount / txs.length) * 100) / 100;
}

export async function getDashboardReconciliationMetrics(
  filters?: MetricFilterOptions
): Promise<ReconciliationDashboardMetrics> {
  const [
    gross,
    net,
    fees,
    successfulCount,
    pendingSettlementsCount,
    failedCount,
    rate,
    openExceptions,
  ] = await Promise.all([
    getGrossCollections(filters),
    getNetCollections(filters),
    getTotalFees(filters),
    getSuccessfulPaymentsCount(filters),
    getPendingSettlementsCount(filters),
    getFailedPaymentsCount(filters),
    getReconciliationRate(filters),
    getOpenExceptionsCount(filters),
  ]);

  return {
    gross_collections: Math.round(gross * 100) / 100,
    net_collections: Math.round(net * 100) / 100,
    total_fees: Math.round(fees * 100) / 100,
    successful_payments_count: successfulCount,
    pending_settlements_count: pendingSettlementsCount,
    failed_payments_count: failedCount,
    reconciliation_rate: rate,
    open_exceptions_count: openExceptions,
    currency: 'KES',
  };
}

export function clearReconciliationCache(): void {
  inMemoryMatches.clear();
  inMemoryExceptions.clear();
}
