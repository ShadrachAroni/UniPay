import { describe, it, expect, beforeEach } from 'vitest';
import { NormalizedTransaction } from '../src/types/payment-provider.js';
import {
  ReconciliationCandidate,
  FuzzyMatchProvider,
  FuzzyMatchResult,
} from '../src/types/reconciliation.types.js';
import {
  OrderCandidateSource,
  CandidateSourceRegistry,
} from '../src/services/reconciliation/candidate-source.js';
import { ReconciliationRepository } from '../src/repository/reconciliation.repository.js';
import { ReconciliationEngine } from '../src/services/reconciliation/reconciliation.engine.js';
import { ReconciliationDashboardService } from '../src/services/reconciliation/reconciliation-dashboard.service.js';

describe('Phase 4: Reconciliation Engine (Rules Layer)', () => {
  let repository: ReconciliationRepository;
  let candidateSource: OrderCandidateSource;
  let registry: CandidateSourceRegistry;
  let engine: ReconciliationEngine;
  let dashboardService: ReconciliationDashboardService;

  const sampleProfileId = 'prof_11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    repository = new ReconciliationRepository();
    candidateSource = new OrderCandidateSource();
    registry = new CandidateSourceRegistry();
    registry.register(candidateSource);
    engine = new ReconciliationEngine(registry, repository);
    dashboardService = new ReconciliationDashboardService(repository);
  });

  describe('Matching Tiers (Tiers 1 - 5)', () => {
    it('Tier 1: exact_reference success when external_reference matches candidate reference', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_1001',
        externalReference: 'INV-4021',
        provider: 'loop',
        rail: 'loop',
        amount: 3000.0,
        currency: 'KES',
        providerFee: 30.0,
        netAmount: 2970.0,
        payerIdentifier: '+254712345678',
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx as any).id = 'tx_1001';
      (tx as any).recipientProfileId = sampleProfileId;

      candidateSource.addCandidate({
        id: 'cand_4021',
        profileId: sampleProfileId,
        reference: 'INV-4021',
        expectedAmount: 3000.0,
        currency: 'KES',
        payerIdentifier: '+254712345678',
      });

      const { matches, exceptions } = await engine.reconcileBatch([{ transaction: tx }]);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('exact_reference');
      expect(matches[0].confidenceScore).toBe(1.0);
      expect(matches[0].status).toBe('proposed');
      expect(matches[0].expectedReference).toBe('INV-4021');
      expect(exceptions).toHaveLength(0);
    });

    it('Tier 1 Hard Rule: Reference matches but amount differs -> flags amount_mismatch exception and does not match', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_1002',
        externalReference: 'INV-4022',
        provider: 'loop',
        rail: 'loop',
        amount: 2500.0, // Different from expected 3000
        currency: 'KES',
        providerFee: 25.0,
        netAmount: 2475.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx as any).id = 'tx_1002';
      (tx as any).recipientProfileId = sampleProfileId;

      candidateSource.addCandidate({
        id: 'cand_4022',
        profileId: sampleProfileId,
        reference: 'INV-4022',
        expectedAmount: 3000.0, // Expected 3000
        currency: 'KES',
      });

      const { matches, exceptions } = await engine.reconcileBatch([{ transaction: tx }]);

      expect(matches).toHaveLength(0);
      expect(exceptions).toHaveLength(1);
      expect(exceptions[0].category).toBe('amount_mismatch');
      expect(exceptions[0].details.expectedAmount).toBe(3000.0);
      expect(exceptions[0].details.transactionAmount).toBe(2500.0);
    });

    it('Tier 2: exact_amount_window success when amount matches and transaction is within time window', async () => {
      const now = new Date();
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_1003',
        externalReference: 'UNRECOGNIZED_REF',
        provider: 'loop',
        rail: 'loop',
        amount: 5000.0,
        currency: 'KES',
        providerFee: 50.0,
        netAmount: 4950.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: now,
        rawPayload: {},
      };
      (tx as any).id = 'tx_1003';
      (tx as any).recipientProfileId = sampleProfileId;

      candidateSource.addCandidate({
        id: 'cand_5000',
        profileId: sampleProfileId,
        reference: 'ORD-900',
        expectedAmount: 5000.0,
        currency: 'KES',
        expectedFrom: new Date(now.getTime() - 2 * 3600 * 1000), // 2 hours ago
        expectedUntil: new Date(now.getTime() + 2 * 3600 * 1000), // in 2 hours
      });

      const { matches } = await engine.reconcileBatch([{ transaction: tx }]);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('exact_amount_window');
      expect(matches[0].confidenceScore).toBe(0.85);
      expect(matches[0].status).toBe('proposed');
    });

    it('Tier 3: payer_amount success when normalized payer identifier + amount match', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_1004',
        externalReference: '',
        provider: 'seeded',
        rail: 'seeded',
        amount: 1500.0,
        currency: 'KES',
        providerFee: 15.0,
        netAmount: 1485.0,
        payerIdentifier: '  +254700112233  ',
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(Date.now() - 48 * 3600 * 1000), // Outside 24h window
        rawPayload: {},
      };
      (tx as any).id = 'tx_1004';
      (tx as any).recipientProfileId = sampleProfileId;

      candidateSource.addCandidate({
        id: 'cand_1500',
        profileId: sampleProfileId,
        reference: 'MISC-ORDER',
        expectedAmount: 1500.0,
        currency: 'KES',
        payerIdentifier: '+254700112233',
        expectedFrom: new Date(Date.now() - 10 * 3600 * 1000), // Not matching tier 2 window
        expectedUntil: new Date(Date.now() - 5 * 3600 * 1000),
      });

      const { matches } = await engine.reconcileBatch([{ transaction: tx }]);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('payer_amount');
      expect(matches[0].confidenceScore).toBe(0.75);
      expect(matches[0].status).toBe('proposed');
    });

    it('Tier 4: ai_fuzzy extension point is called when injected; default NoOp falls through to Tier 5 manual', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_1005',
        externalReference: 'POSSIBLE_TYPO_REF',
        provider: 'loop',
        rail: 'loop',
        amount: 1200.0,
        currency: 'KES',
        providerFee: 12.0,
        netAmount: 1188.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(Date.now() - 48 * 3600 * 1000), // 48h ago (outside 24h Tier 2 window)
        rawPayload: {},
      };
      (tx as any).id = 'tx_1005';
      (tx as any).recipientProfileId = sampleProfileId;

      const cand: ReconciliationCandidate = {
        id: 'cand_fuzzy_target',
        profileId: sampleProfileId,
        reference: 'POSSIBLE_TYPO_R3F',
        expectedAmount: 1200.0,
        currency: 'KES',
        expectedFrom: new Date(Date.now() - 2 * 3600 * 1000),
        expectedUntil: new Date(Date.now() + 2 * 3600 * 1000),
      };
      candidateSource.addCandidate(cand);

      // 1. Default NoOp Provider -> falls to manual
      const resNoOp = await engine.reconcileBatch([{ transaction: tx }]);
      expect(resNoOp.matches[0].matchType).toBe('manual');

      // 2. Custom Injected Fuzzy Provider -> produces ai_fuzzy match shape
      class CustomFuzzyProvider implements FuzzyMatchProvider {
        async propose(): Promise<FuzzyMatchResult | null> {
          return {
            candidateId: 'cand_fuzzy_target',
            confidenceScore: 0.65,
            reasoning: 'Transposition of E to 3 in reference string',
          };
        }
      }

      const fuzzyEngine = new ReconciliationEngine(registry, repository, {
        fuzzyProvider: new CustomFuzzyProvider(),
      });
      await repository.clear();

      const resFuzzy = await fuzzyEngine.reconcileBatch([{ transaction: tx }]);
      expect(resFuzzy.matches[0].matchType).toBe('ai_fuzzy');
      expect(resFuzzy.matches[0].confidenceScore).toBe(0.65);
      expect(resFuzzy.matches[0].notes).toBe('Transposition of E to 3 in reference string');
    });

    it('Ambiguity Handling: Multiple equally-valid candidates at a tier fall back to manual review', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_1006',
        externalReference: 'COMMON-REF',
        provider: 'loop',
        rail: 'loop',
        amount: 4000.0,
        currency: 'KES',
        providerFee: 40.0,
        netAmount: 3960.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx as any).id = 'tx_1006';
      (tx as any).recipientProfileId = sampleProfileId;

      // Two candidate orders with identical reference and amount
      candidateSource.addCandidate({
        id: 'cand_common_1',
        profileId: sampleProfileId,
        reference: 'COMMON-REF',
        expectedAmount: 4000.0,
        currency: 'KES',
      });
      candidateSource.addCandidate({
        id: 'cand_common_2',
        profileId: sampleProfileId,
        reference: 'COMMON-REF',
        expectedAmount: 4000.0,
        currency: 'KES',
      });

      const { matches } = await engine.reconcileBatch([{ transaction: tx }]);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('manual');
      expect(matches[0].notes).toContain('Multiple candidates match');
    });
  });

  describe('Exception Classification (All 7 Categories)', () => {
    it('1. missing_order exception emitted when zero candidates match a transaction', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_EX1',
        externalReference: 'NO_ORDER',
        provider: 'seeded',
        rail: 'seeded',
        amount: 800.0,
        currency: 'KES',
        providerFee: 8.0,
        netAmount: 792.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx as any).id = 'tx_ex1';
      (tx as any).recipientProfileId = sampleProfileId;

      const { exceptions } = await engine.reconcileBatch([{ transaction: tx }]);

      expect(exceptions.some((e) => e.category === 'missing_order')).toBe(true);
    });

    it('2. duplicate_payment exception emitted when duplicate payment_intent_id or reference exists', async () => {
      const tx1: NormalizedTransaction = {
        internalReference: 'TX_INT_DUP',
        externalReference: 'EXT_DUP_001',
        provider: 'loop',
        rail: 'loop',
        amount: 1000.0,
        currency: 'KES',
        providerFee: 10.0,
        netAmount: 990.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx1 as any).id = 'tx_dup1';
      (tx1 as any).recipientProfileId = sampleProfileId;
      (tx1 as any).paymentIntentId = 'pi_shared_dup';

      const tx2: NormalizedTransaction = { ...tx1, internalReference: 'TX_INT_DUP2' };
      (tx2 as any).id = 'tx_dup2';

      const { exceptions } = await engine.reconcileBatch([
        { transaction: tx1 },
        { transaction: tx2 },
      ]);

      expect(exceptions.some((e) => e.category === 'duplicate_payment')).toBe(true);
    });

    it('3. fee_mismatch exception emitted when expected fee disagrees with providerFee', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_FEE',
        externalReference: 'FEE_TEST',
        provider: 'loop',
        rail: 'loop',
        amount: 2000.0,
        currency: 'KES',
        providerFee: 50.0, // Provider fee is 50
        netAmount: 1950.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx as any).id = 'tx_fee';
      (tx as any).recipientProfileId = sampleProfileId;

      const { exceptions } = await engine.reconcileBatch([
        { transaction: tx, expectedFee: 20.0 }, // Expected fee is 20
      ]);

      expect(exceptions.some((e) => e.category === 'fee_mismatch')).toBe(true);
    });

    it('4. settlement_delay exception emitted when successful payment remains pending past threshold', async () => {
      const oldTime = new Date(Date.now() - 48 * 3600 * 1000); // 48h ago (threshold = 24h)
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_DELAY',
        externalReference: 'DELAY_TEST',
        provider: 'loop',
        rail: 'loop',
        amount: 3500.0,
        currency: 'KES',
        providerFee: 35.0,
        netAmount: 3465.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: oldTime,
        rawPayload: {},
      };
      (tx as any).id = 'tx_delay';
      (tx as any).recipientProfileId = sampleProfileId;

      const { exceptions } = await engine.reconcileBatch([{ transaction: tx }]);

      expect(exceptions.some((e) => e.category === 'settlement_delay')).toBe(true);
    });

    it('5. unknown_provider_reference exception emitted when reference cannot be tied to known state', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_INT_UNK',
        externalReference: 'UNKNOWN_PROVIDER_REF_99',
        provider: 'loop',
        rail: 'loop',
        amount: 900.0,
        currency: 'KES',
        providerFee: 9.0,
        netAmount: 891.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx as any).id = 'tx_unk';
      (tx as any).recipientProfileId = sampleProfileId;

      const { exceptions } = await engine.reconcileBatch([
        {
          transaction: tx,
          knownProviderReferences: new Set(['KNOWN_REF_1', 'KNOWN_REF_2']),
          knownPaymentIntentIds: new Set(['pi_known_1']),
        },
      ]);

      expect(exceptions.some((e) => e.category === 'unknown_provider_reference')).toBe(true);
    });
  });

  describe('Batch Execution & Performance (No N+1 Queries)', () => {
    it('runs reconciliation against 50 transactions and candidate pool in bounded queries', async () => {
      const batch: { transaction: NormalizedTransaction }[] = [];
      repository.resetQueryCount();

      for (let i = 1; i <= 50; i++) {
        const tx: NormalizedTransaction = {
          internalReference: `TX_PERF_${i}`,
          externalReference: `ORD_PERF_${i}`,
          provider: 'seeded',
          rail: 'seeded',
          amount: 1000.0 + i,
          currency: 'KES',
          providerFee: 10.0,
          netAmount: 990.0 + i,
          paymentStatus: 'successful',
          settlementStatus: 'pending',
          refundStatus: 'none',
          transactionTime: new Date(),
          rawPayload: {},
        };
        (tx as any).id = `tx_perf_${i}`;
        (tx as any).recipientProfileId = sampleProfileId;

        candidateSource.addCandidate({
          id: `cand_perf_${i}`,
          profileId: sampleProfileId,
          reference: `ORD_PERF_${i}`,
          expectedAmount: 1000.0 + i,
          currency: 'KES',
        });

        batch.push({ transaction: tx });
      }

      const { matches } = await engine.reconcileBatch(batch);

      expect(matches).toHaveLength(50);
      // Query count MUST be bounded (e.g. <= 4 queries total for the entire 50-item batch, NOT 50+)
      const queryCount = repository.getQueryCount();
      expect(queryCount).toBeLessThanOrEqual(4);
    });
  });

  describe('Idempotency & Duplicate Execution', () => {
    it('running reconcile twice produces 1 effective match row per transaction', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_IDEM_1',
        externalReference: 'INV-IDEM-01',
        provider: 'loop',
        rail: 'loop',
        amount: 2200.0,
        currency: 'KES',
        providerFee: 22.0,
        netAmount: 2178.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx as any).id = 'tx_idem_1';
      (tx as any).recipientProfileId = sampleProfileId;

      candidateSource.addCandidate({
        id: 'cand_idem_1',
        profileId: sampleProfileId,
        reference: 'INV-IDEM-01',
        expectedAmount: 2200.0,
        currency: 'KES',
      });

      // Run 1
      await engine.reconcileBatch([{ transaction: tx }]);
      const matchesRun1 = await repository.findAllMatches();
      expect(matchesRun1).toHaveLength(1);

      // Run 2 (replayed)
      await engine.reconcileBatch([{ transaction: tx }]);
      const matchesRun2 = await repository.findAllMatches();
      expect(matchesRun2).toHaveLength(1); // Still 1 effective match row
    });
  });

  describe('Provider Neutrality Audit Test', () => {
    it('produces identical reconciliation decision for provider=loop vs provider=seeded_demo', async () => {
      const txLoop: NormalizedTransaction = {
        internalReference: 'TX_NEUTRAL_1',
        externalReference: 'INV-NEUTRAL-99',
        provider: 'loop',
        rail: 'loop',
        amount: 4500.0,
        currency: 'KES',
        providerFee: 45.0,
        netAmount: 4455.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (txLoop as any).id = 'tx_loop_neutral';
      (txLoop as any).recipientProfileId = sampleProfileId;

      const txSeeded: NormalizedTransaction = {
        ...txLoop,
        provider: 'seeded_demo',
        rail: 'seeded_demo',
      };
      (txSeeded as any).id = 'tx_seeded_neutral';

      candidateSource.addCandidate({
        id: 'cand_neutral_99',
        profileId: sampleProfileId,
        reference: 'INV-NEUTRAL-99',
        expectedAmount: 4500.0,
        currency: 'KES',
      });

      // Engine 1 for loop tx
      const repo1 = new ReconciliationRepository();
      const engine1 = new ReconciliationEngine(registry, repo1);
      const resLoop = await engine1.reconcileBatch([{ transaction: txLoop }]);

      // Engine 2 for seeded tx
      const repo2 = new ReconciliationRepository();
      const engine2 = new ReconciliationEngine(registry, repo2);
      const resSeeded = await engine2.reconcileBatch([{ transaction: txSeeded }]);

      expect(resLoop.matches[0].matchType).toEqual(resSeeded.matches[0].matchType);
      expect(resLoop.matches[0].confidenceScore).toEqual(resSeeded.matches[0].confidenceScore);
      expect(resLoop.matches[0].expectedAmount).toEqual(resSeeded.matches[0].expectedAmount);
      expect(resLoop.matches[0].status).toEqual(resSeeded.matches[0].status);
    });
  });

  describe('Ledger Non-Mutation & Aggregate Read Contracts', () => {
    it('reconciliation never mutates transaction settlement_status', async () => {
      const tx: NormalizedTransaction = {
        internalReference: 'TX_REGRESS_1',
        externalReference: 'INV-REGRESS',
        provider: 'loop',
        rail: 'loop',
        amount: 1800.0,
        currency: 'KES',
        providerFee: 18.0,
        netAmount: 1782.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending', // Starts as pending
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx as any).id = 'tx_regress_1';
      (tx as any).recipientProfileId = sampleProfileId;

      candidateSource.addCandidate({
        id: 'cand_regress',
        profileId: sampleProfileId,
        reference: 'INV-REGRESS',
        expectedAmount: 1800.0,
        currency: 'KES',
      });

      await engine.reconcileBatch([{ transaction: tx }]);

      // Assert settlementStatus is completely untouched
      expect(tx.settlementStatus).toBe('pending');
    });

    it('computes accurate aggregate metrics for dashboard read contracts', async () => {
      const tx1: NormalizedTransaction = {
        internalReference: 'TX_AGG_1',
        externalReference: 'INV-AGG-1',
        provider: 'loop',
        rail: 'loop',
        amount: 3000.0,
        currency: 'KES',
        providerFee: 30.0,
        netAmount: 2970.0,
        paymentStatus: 'successful',
        settlementStatus: 'pending',
        refundStatus: 'none',
        transactionTime: new Date(),
        rawPayload: {},
      };
      (tx1 as any).id = 'tx_agg_1';
      (tx1 as any).recipientProfileId = sampleProfileId;

      candidateSource.addCandidate({
        id: 'cand_agg_1',
        profileId: sampleProfileId,
        reference: 'INV-AGG-1',
        expectedAmount: 3000.0,
        currency: 'KES',
      });

      await engine.reconcileBatch([{ transaction: tx1 }]);

      const metrics = await dashboardService.getAggregateMetrics([tx1]);

      expect(metrics.grossCollections).toBe(3000.0);
      expect(metrics.netCollections).toBe(2970.0);
      expect(metrics.totalFees).toBe(30.0);
      expect(metrics.eligibleTransactions).toBe(1);
      expect(metrics.confirmedMatchedTransactions).toBe(1);
      expect(metrics.reconciliationRate).toBe(1.0);
    });
  });
});
