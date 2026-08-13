import { NormalizedTransaction } from '../../types/payment-provider.js';
import {
  ReconciliationCandidate,
  ReconciliationMatch,
  ReconciliationException,
  ReconciliationEngineOptions,
  CONFIDENCE_SCORES,
  FuzzyMatchProvider,
  NoOpFuzzyMatchProvider,
  ExceptionCategory,
} from '../../types/reconciliation.types.js';
import { CandidateSourceRegistry } from './candidate-source.js';
import { ReconciliationRepository } from '../../repository/reconciliation.repository.ts';
import { logger } from '../../utils/logger.js';

function normalizeReference(ref?: string): string {
  if (!ref) return '';
  return ref.trim().toUpperCase();
}

function normalizePayerIdentifier(payer?: string): string {
  if (!payer) return '';
  return payer.trim().toLowerCase();
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

export interface ReconcileTransactionInput {
  transaction: NormalizedTransaction;
  expectedFee?: number;
  knownPaymentIntentIds?: Set<string>;
  knownProviderReferences?: Set<string>;
  knownInternalReferences?: Set<string>;
}

export class ReconciliationEngine {
  private amountWindowHours: number;
  private settlementDelayThresholdHours: number;
  private fuzzyProvider: FuzzyMatchProvider;

  constructor(
    private readonly candidateRegistry: CandidateSourceRegistry,
    private readonly repository: ReconciliationRepository,
    options: ReconciliationEngineOptions = {}
  ) {
    this.amountWindowHours = options.amountWindowHours ?? 24;
    this.settlementDelayThresholdHours = options.settlementDelayThresholdHours ?? 24;
    this.fuzzyProvider = options.fuzzyProvider ?? new NoOpFuzzyMatchProvider();
  }

  /**
   * Batch Reconciliation Process (No N+1)
   * Fetches all candidates for all transactions in one batched call, executes matching in memory,
   * and persists matches/exceptions in controlled batch writes.
   */
  async reconcileBatch(
    transactionsWithMetadata: ReconcileTransactionInput[]
  ): Promise<{
    matches: ReconciliationMatch[];
    exceptions: ReconciliationException[];
  }> {
    const startTime = Date.now();
    const transactions = transactionsWithMetadata.map((t) => t.transaction);

    // 1. Fetch all candidates for all transactions in a single batched operation across registered sources
    const candidatesMap = await this.candidateRegistry.fetchAllCandidates(transactions);

    const matchesToSave: ReconciliationMatch[] = [];
    const exceptionsToSave: ReconciliationException[] = [];

    // Track duplicate payments across the batch
    const seenPaymentIntentIds = new Set<string>();
    const seenProviderReferences = new Set<string>();
    const seenInternalReferences = new Set<string>();

    for (const item of transactionsWithMetadata) {
      const tx = item.transaction;
      const txId = (tx as any).id || tx.internalReference;
      const profileId = (tx as any).recipientProfileId || (tx as any).profileId || '00000000-0000-0000-0000-000000000000';
      const candidates = candidatesMap.get(txId) || [];

      // 2. Exception Check: Duplicate Payment
      let isDuplicate = false;
      const intentId = (tx as any).paymentIntentId;
      const extRef = tx.externalReference;
      const intRef = tx.internalReference;

      if (intentId && seenPaymentIntentIds.has(intentId)) {
        isDuplicate = true;
      } else if (extRef && seenProviderReferences.has(extRef)) {
        isDuplicate = true;
      } else if (intRef && seenInternalReferences.has(intRef)) {
        isDuplicate = true;
      }

      if (intentId) seenPaymentIntentIds.add(intentId);
      if (extRef) seenProviderReferences.add(extRef);
      if (intRef) seenInternalReferences.add(intRef);

      if (isDuplicate) {
        exceptionsToSave.push(this.createException(profileId, txId, 'duplicate_payment', {
          reason: 'Duplicate payment intent or reference detected across transactions',
          externalReference: extRef,
          internalReference: intRef,
        }));
      }

      // 3. Exception Check: Fee Mismatch
      if (item.expectedFee !== undefined && !amountsEqual(item.expectedFee, tx.providerFee)) {
        exceptionsToSave.push(this.createException(profileId, txId, 'fee_mismatch', {
          expectedFee: item.expectedFee,
          providerFee: tx.providerFee,
        }));
      }

      // 4. Exception Check: Settlement Delay
      if (
        tx.paymentStatus === 'successful' &&
        tx.settlementStatus === 'pending'
      ) {
        const txTime = new Date(tx.transactionTime).getTime();
        const now = Date.now();
        const diffHours = (now - txTime) / (1000 * 60 * 60);
        if (diffHours > this.settlementDelayThresholdHours) {
          exceptionsToSave.push(this.createException(profileId, txId, 'settlement_delay', {
            transactionTime: tx.transactionTime,
            hoursPending: diffHours,
            thresholdHours: this.settlementDelayThresholdHours,
          }));
        }
      }

      // 5. Exception Check: Unknown Provider Reference
      if (
        tx.externalReference &&
        item.knownProviderReferences &&
        !item.knownProviderReferences.has(tx.externalReference) &&
        item.knownPaymentIntentIds &&
        !item.knownPaymentIntentIds.has((tx as any).paymentIntentId)
      ) {
        exceptionsToSave.push(this.createException(profileId, txId, 'unknown_provider_reference', {
          externalReference: tx.externalReference,
        }));
      }

      // 6. Execute Rule-Based Matching Tiers
      const matchResult = await this.evaluateMatchingTiers(tx, candidates, profileId);

      if (matchResult.match) {
        matchesToSave.push(matchResult.match);
      }
      if (matchResult.exception) {
        exceptionsToSave.push(matchResult.exception);
      }
    }

    // 7. Batch Save Matches and Exceptions
    const savedMatches = await this.repository.saveMatchesBatch(matchesToSave);
    const savedExceptions = await this.repository.saveExceptionsBatch(exceptionsToSave);

    const durationMs = Date.now() - startTime;
    logger.info('Reconciliation batch completed', {
      batch_size: transactionsWithMetadata.length,
      candidate_count: Array.from(candidatesMap.values()).reduce((acc, c) => acc + c.length, 0),
      duration_ms: durationMs,
      matches_count: savedMatches.length,
      exceptions_count: savedExceptions.length,
      query_count: this.repository.getQueryCount(),
      outcome: 'success',
    });

    return { matches: savedMatches, exceptions: savedExceptions };
  }

  private async evaluateMatchingTiers(
    tx: NormalizedTransaction,
    candidates: ReconciliationCandidate[],
    profileId: string
  ): Promise<{ match?: ReconciliationMatch; exception?: ReconciliationException }> {
    const txId = (tx as any).id || tx.internalReference;
    const normExtRef = normalizeReference(tx.externalReference);
    const normPayer = normalizePayerIdentifier(tx.payerIdentifier);

    // Rule: Amount mismatch check
    // If a candidate matches reference or payer signal but the amount doesn't match,
    // emit amount_mismatch exception and exclude that candidate from clean matching.
    const validCandidates: ReconciliationCandidate[] = [];

    for (const cand of candidates) {
      const normCandRef = normalizeReference(cand.reference);
      const normCandPayer = normalizePayerIdentifier(cand.payerIdentifier);

      const refMatches = normExtRef.length > 0 && normCandRef === normExtRef;
      const payerMatches = normPayer.length > 0 && normCandPayer === normPayer;

      if ((refMatches || payerMatches) && !amountsEqual(cand.expectedAmount, tx.amount)) {
        // Emit amount_mismatch exception
        const exception = this.createException(profileId, txId, 'amount_mismatch', {
          candidateId: cand.id,
          expectedAmount: cand.expectedAmount,
          transactionAmount: tx.amount,
          reference: cand.reference,
        });
        return { exception };
      }

      // Filter compatible currency
      if (cand.currency === tx.currency) {
        validCandidates.push(cand);
      }
    }

    // If zero valid candidates available
    if (validCandidates.length === 0) {
      const match = this.createManualMatch(profileId, txId, tx.amount, 0, 'Zero eligible candidates');
      const exception = this.createException(profileId, txId, 'missing_order', {
        reason: 'Zero eligible candidates found for transaction',
        externalReference: tx.externalReference,
      });
      return { match, exception };
    }

    // Tier 1: exact_reference
    if (normExtRef.length > 0) {
      const refMatches = validCandidates.filter(
        (c) => normalizeReference(c.reference) === normExtRef && amountsEqual(c.expectedAmount, tx.amount)
      );

      if (refMatches.length === 1) {
        const cand = refMatches[0];
        return {
          match: this.createMatch({
            profileId,
            transactionId: txId,
            matchSource: 'order',
            expectedReference: cand.reference,
            expectedAmount: cand.expectedAmount,
            matchedAmount: tx.amount,
            matchType: 'exact_reference',
            confidenceScore: CONFIDENCE_SCORES.EXACT_REFERENCE,
          }),
        };
      } else if (refMatches.length > 1) {
        // Ambiguity -> manual review fallback
        return {
          match: this.createManualMatch(profileId, txId, tx.amount, refMatches[0].expectedAmount, 'Multiple candidates match exact_reference'),
        };
      }
    }

    // Tier 2: exact_amount_window
    const amountMatches = validCandidates.filter((c) => {
      if (!amountsEqual(c.expectedAmount, tx.amount)) return false;
      if (!c.expectedFrom && !c.expectedUntil) return true;

      const txTime = new Date(tx.transactionTime).getTime();
      const fromTime = c.expectedFrom ? new Date(c.expectedFrom).getTime() : txTime - this.amountWindowHours * 3600 * 1000;
      const untilTime = c.expectedUntil ? new Date(c.expectedUntil).getTime() : txTime + this.amountWindowHours * 3600 * 1000;

      return txTime >= fromTime && txTime <= untilTime;
    });

    if (amountMatches.length === 1) {
      const cand = amountMatches[0];
      return {
        match: this.createMatch({
          profileId,
          transactionId: txId,
          matchSource: 'order',
          expectedReference: cand.reference,
          expectedAmount: cand.expectedAmount,
          matchedAmount: tx.amount,
          matchType: 'exact_amount_window',
          confidenceScore: CONFIDENCE_SCORES.EXACT_AMOUNT_WINDOW,
        }),
      };
    } else if (amountMatches.length > 1) {
      // Ambiguity -> manual review fallback
      return {
        match: this.createManualMatch(profileId, txId, tx.amount, amountMatches[0].expectedAmount, 'Multiple candidates match exact_amount_window'),
      };
    }

    // Tier 3: payer_amount
    if (normPayer.length > 0) {
      const payerMatches = validCandidates.filter(
        (c) =>
          normalizePayerIdentifier(c.payerIdentifier) === normPayer &&
          amountsEqual(c.expectedAmount, tx.amount)
      );

      if (payerMatches.length === 1) {
        const cand = payerMatches[0];
        return {
          match: this.createMatch({
            profileId,
            transactionId: txId,
            matchSource: 'order',
            expectedReference: cand.reference,
            expectedAmount: cand.expectedAmount,
            matchedAmount: tx.amount,
            matchType: 'payer_amount',
            confidenceScore: CONFIDENCE_SCORES.PAYER_AMOUNT,
          }),
        };
      } else if (payerMatches.length > 1) {
        // Ambiguity -> manual review fallback
        return {
          match: this.createManualMatch(profileId, txId, tx.amount, payerMatches[0].expectedAmount, 'Multiple candidates match payer_amount'),
        };
      }
    }

    // Tier 4: ai_fuzzy (injectable extension point)
    const fuzzyResult = await this.fuzzyProvider.propose(tx, validCandidates);
    if (fuzzyResult) {
      const cand = validCandidates.find((c) => c.id === fuzzyResult.candidateId);
      if (cand) {
        return {
          match: this.createMatch({
            profileId,
            transactionId: txId,
            matchSource: 'order',
            expectedReference: cand.reference,
            expectedAmount: cand.expectedAmount,
            matchedAmount: tx.amount,
            matchType: 'ai_fuzzy',
            confidenceScore: fuzzyResult.confidenceScore || CONFIDENCE_SCORES.AI_FUZZY,
            notes: fuzzyResult.reasoning,
          }),
        };
      }
    }

    // Tier 5: manual review
    const match = this.createManualMatch(profileId, txId, tx.amount, 0, 'No rule tier matched candidate');
    const exception = this.createException(profileId, txId, 'missing_order', {
      reason: 'No rule tier matched eligible candidates',
      externalReference: tx.externalReference,
    });
    return { match, exception };
  }

  private createMatch(input: {
    profileId: string;
    transactionId: string;
    matchSource: 'order' | 'expected_payment' | 'pool_contribution';
    expectedReference?: string;
    expectedAmount: number;
    matchedAmount: number;
    matchType: 'exact_reference' | 'exact_amount_window' | 'payer_amount' | 'ai_fuzzy' | 'manual';
    confidenceScore: number;
    notes?: string;
  }): ReconciliationMatch {
    const now = new Date();
    return {
      id: `rc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      profileId: input.profileId,
      transactionId: input.transactionId,
      matchSource: input.matchSource,
      expectedPaymentId: null, // null in Phase 4
      poolContributionId: null, // null in Phase 4
      expectedReference: input.expectedReference ?? null,
      expectedAmount: input.expectedAmount,
      matchedAmount: input.matchedAmount,
      matchType: input.matchType,
      confidenceScore: input.confidenceScore,
      aiExplanation: null, // null in Phase 4 (Dev C populates in Phase 5)
      status: 'proposed', // Per rule: status is ALWAYS proposed
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private createManualMatch(
    profileId: string,
    transactionId: string,
    matchedAmount: number,
    expectedAmount: number,
    notes: string
  ): ReconciliationMatch {
    return this.createMatch({
      profileId,
      transactionId,
      matchSource: 'order',
      expectedAmount,
      matchedAmount,
      matchType: 'manual',
      confidenceScore: CONFIDENCE_SCORES.MANUAL,
      notes,
    });
  }

  private createException(
    profileId: string,
    transactionId: string | null,
    category: ExceptionCategory,
    details: Record<string, unknown>
  ): ReconciliationException {
    const now = new Date();
    return {
      id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      profileId,
      transactionId,
      category,
      status: 'open',
      details,
      createdAt: now,
      updatedAt: now,
    };
  }
}
