import { NormalizedTransaction } from './payment-provider.js';

export type ReconciliationMatchSource = 'order' | 'expected_payment' | 'pool_contribution';

export type ReconciliationMatchType =
  | 'exact_reference'
  | 'exact_amount_window'
  | 'payer_amount'
  | 'ai_fuzzy'
  | 'manual';

export type ReconciliationMatchStatus = 'proposed' | 'confirmed' | 'rejected';

export type ExceptionCategory =
  | 'missing_provider_transaction'
  | 'missing_order'
  | 'amount_mismatch'
  | 'duplicate_payment'
  | 'fee_mismatch'
  | 'settlement_delay'
  | 'unknown_provider_reference'
  | 'overpayment';

export type ExceptionStatus = 'open' | 'resolved' | 'ignored';

export const CONFIDENCE_SCORES = {
  EXACT_REFERENCE: 1.00,
  EXACT_AMOUNT_WINDOW: 0.85,
  PAYER_AMOUNT: 0.75,
  AI_FUZZY: 0.60,
  MANUAL: 0.00,
} as const;

export interface ReconciliationCandidate {
  id: string;
  profileId: string;
  reference: string;
  expectedAmount: number;
  currency: string;
  payerIdentifier?: string;
  expectedFrom?: Date;
  expectedUntil?: Date;
  expectedFee?: number;
}

export interface CandidateSource {
  priority: number; // lower number = higher priority
  fetch(transactions: NormalizedTransaction[]): Promise<Map<string, ReconciliationCandidate[]>>;
}

export interface FuzzyMatchResult {
  candidateId: string;
  confidenceScore: number;
  reasoning: string;
}

export interface FuzzyMatchProvider {
  propose(
    transaction: NormalizedTransaction,
    candidates: ReconciliationCandidate[]
  ): Promise<FuzzyMatchResult | null>;
}

export class NoOpFuzzyMatchProvider implements FuzzyMatchProvider {
  async propose(): Promise<FuzzyMatchResult | null> {
    return null;
  }
}

export interface ReconciliationMatch {
  id: string;
  profileId: string;
  transactionId: string;
  matchSource: ReconciliationMatchSource;
  expectedPaymentId?: string | null;
  poolContributionId?: string | null;
  expectedReference?: string | null;
  expectedAmount: number;
  matchedAmount: number;
  matchType: ReconciliationMatchType;
  confidenceScore: number;
  aiExplanation?: string | null;
  status: ReconciliationMatchStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationException {
  id: string;
  profileId: string;
  transactionId?: string | null;
  category: ExceptionCategory;
  status: ExceptionStatus;
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationEngineOptions {
  amountWindowHours?: number; // default: 24
  settlementDelayThresholdHours?: number; // default: 24
  fuzzyProvider?: FuzzyMatchProvider;
}

export interface AggregateMetrics {
  grossCollections: number;
  netCollections: number;
  totalFees: number;
  totalTransactions: number;
  eligibleTransactions: number;
  confirmedMatchedTransactions: number;
  reconciliationRate: number; // 0.0 - 1.0
  openExceptionsCount: number;
  exceptionsByCategory: Record<ExceptionCategory, number>;
}
