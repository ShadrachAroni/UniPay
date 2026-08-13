import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { clearProfileCache, createProfile, submitIdentity } from '../services/profileService';
import { clearAliasCache, createAlias } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import { resetRailCache } from '../services/paymentRailService';
import {
  createPaymentIntent,
  clearPaymentIntentCache,
} from '../services/paymentIntentService';
import {
  recordTransaction,
  clearTransactionCache,
} from '../services/transactionService';
import {
  matchExactReference,
  matchExactAmountTimeWindow,
  matchPayerAndAmount,
  evaluateMatchingRules,
  aiFuzzyMatchRule,
  detectExceptions,
  runReconciliation,
  clearReconciliationCache,
  getDashboardReconciliationMetrics,
} from '../services/reconciliationService';
import { NormalizedTransaction } from '@unipay/shared';

describe('Phase 4A Verification Test Suite — Reconciliation Engine (Rule-Based)', () => {
  let server: any;
  let baseUrl: string;
  let testProfileId: string;

  before(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    clearProfileCache();
    clearAliasCache();
    clearIdempotencyCache();
    resetRailCache();
    clearPaymentIntentCache();
    clearTransactionCache();
    clearReconciliationCache();

    // Create a verified merchant profile for testing
    const profile = await createProfile({
      clerk_user_id: 'user_test_clerk_001',
      account_type: 'business',
      display_name: 'Amina Boutique',
      owner_name: 'Amina Mwangi',
      phone: '+254704540384',
      email: 'amina@boutique.co.ke',
      currency: 'KES',
      country_code: 'KE',
    });
    await submitIdentity(profile.id, {
      id_number: 'ID-99228811',
      id_document_url: 'https://docs.unipay.ke/id_front.jpg',
    });
    await createAlias({
      profile_id: profile.id,
      alias: '@aminaboutique',
    });
    testProfileId = profile.id;
  });

  describe('1. Matching Rules in Isolation (§14)', () => {
    it('Rule 1: Exact invoice/order reference match yields highest fixed confidence (1.00)', async () => {
      const intent = await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'INV-2026-001',
        amount: 3500,
        currency: 'KES',
        idempotency_key: 'idemp_ref_001',
      });

      const normalizedTx: NormalizedTransaction = {
        internal_reference: 'TX_INT_001',
        external_reference: 'LOOP_EXT_001',
        provider: 'loop',
        rail: 'loop',
        amount: 3500,
        currency: 'KES',
        provider_fee: 52.5,
        net_amount: 3447.5,
        payer_identifier: null,
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {
          orderReference: 'INV-2026-001',
          data: { txnReference: 'LOOP_EXT_001' },
        },
      };
      const tx = await recordTransaction(normalizedTx, testProfileId, null);

      const result = matchExactReference(tx, [intent]);
      assert.ok(result, 'Expected exact reference match');
      assert.strictEqual(result.matchType, 'exact_reference');
      assert.strictEqual(result.confidenceScore, 1.0);
      assert.strictEqual(result.candidate.id, intent.id);
    });

    it('Rule 2: Exact amount within configured time window assigns varying confidence score based on proximity', async () => {
      const now = new Date();
      const intentNow = await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'ORD_TIME_001',
        amount: 1500,
        currency: 'KES',
        idempotency_key: 'idemp_time_001',
      });

      // Transaction 2 minutes after intent -> should have 0.95 confidence
      const tx2MinLater = await recordTransaction(
        {
          internal_reference: 'TX_TIME_2M',
          external_reference: 'LOOP_TIME_2M',
          provider: 'loop',
          rail: 'loop',
          amount: 1500,
          currency: 'KES',
          provider_fee: 22.5,
          net_amount: 1477.5,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date(now.getTime() + 2 * 60 * 1000).toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const matchClose = matchExactAmountTimeWindow(tx2MinLater, [intentNow], {
        timeWindowMinutes: 60,
      });
      assert.ok(matchClose);
      assert.strictEqual(matchClose.matchType, 'exact_amount_window');
      assert.strictEqual(matchClose.confidenceScore, 0.95);

      // Transaction 25 minutes after intent -> should have 0.85 confidence
      const tx25MinLater = await recordTransaction(
        {
          internal_reference: 'TX_TIME_25M',
          external_reference: 'LOOP_TIME_25M',
          provider: 'loop',
          rail: 'loop',
          amount: 1500,
          currency: 'KES',
          provider_fee: 22.5,
          net_amount: 1477.5,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date(now.getTime() + 25 * 60 * 1000).toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const matchFarther = matchExactAmountTimeWindow(tx25MinLater, [intentNow], {
        timeWindowMinutes: 60,
      });
      assert.ok(matchFarther);
      assert.strictEqual(matchFarther.confidenceScore, 0.85);

      // Transaction outside window (e.g. 120 mins later when window is 60 mins) -> should be null
      const txOutWindow = await recordTransaction(
        {
          internal_reference: 'TX_TIME_OUT',
          external_reference: 'LOOP_TIME_OUT',
          provider: 'loop',
          rail: 'loop',
          amount: 1500,
          currency: 'KES',
          provider_fee: 22.5,
          net_amount: 1477.5,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const matchOut = matchExactAmountTimeWindow(txOutWindow, [intentNow], {
        timeWindowMinutes: 60,
      });
      assert.strictEqual(matchOut, null, 'Transaction outside window should not match');
    });

    it('Rule 3: Payer phone or email + amount matches correctly', async () => {
      const intentPhone = await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'ORD_PHONE_001',
        amount: 2800,
        currency: 'KES',
        payer_phone: '+254711223344',
        idempotency_key: 'idemp_phone_001',
      });

      const txPhoneMatch = await recordTransaction(
        {
          internal_reference: 'TX_PAYER_PHONE',
          external_reference: 'EXT_PAYER_PHONE',
          provider: 'loop',
          rail: 'loop',
          amount: 2800,
          currency: 'KES',
          provider_fee: 42,
          net_amount: 2758,
          payer_identifier: '0711223344', // Formatted differently but same normalized phone
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const matchPhone = matchPayerAndAmount(txPhoneMatch, [intentPhone]);
      assert.ok(matchPhone);
      assert.strictEqual(matchPhone.matchType, 'payer_amount');
      assert.strictEqual(matchPhone.confidenceScore, 0.85);

      // Email match
      const intentEmail = await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'ORD_EMAIL_001',
        amount: 5000,
        currency: 'KES',
        payer_email: 'buyer@domain.com',
        idempotency_key: 'idemp_email_001',
      });

      const txEmailMatch = await recordTransaction(
        {
          internal_reference: 'TX_PAYER_EMAIL',
          external_reference: 'EXT_PAYER_EMAIL',
          provider: 'seeded',
          rail: 'seeded',
          amount: 5000,
          currency: 'KES',
          provider_fee: 50,
          net_amount: 4950,
          payer_identifier: 'BUYER@DOMAIN.COM',
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const matchEmail = matchPayerAndAmount(txEmailMatch, [intentEmail]);
      assert.ok(matchEmail);
      assert.strictEqual(matchEmail.matchType, 'payer_amount');
      assert.strictEqual(matchEmail.confidenceScore, 0.8);
    });

    it('AI Fuzzy Match extension point returns null in Phase 4A', async () => {
      const tx = await recordTransaction(
        {
          internal_reference: 'TX_FUZZY',
          external_reference: 'EXT_FUZZY',
          provider: 'loop',
          rail: 'loop',
          amount: 1000,
          currency: 'KES',
          provider_fee: 15,
          net_amount: 985,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );
      const res = await aiFuzzyMatchRule(tx, [], {});
      assert.strictEqual(res, null, 'AI fuzzy rule placeholder must return null in Phase 4A');
    });
  });

  describe('2. Rule Priority Ordering & Manual Review Fallback (§14)', () => {
    it('enforces strict top-down priority ordering when multiple rules could match', async () => {
      // Create Intent A with specific reference and amount 2000
      const intentA = await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'INV-PRIORITY-A',
        amount: 2000,
        currency: 'KES',
        payer_phone: '+254722000000',
        idempotency_key: 'idemp_prio_a',
      });

      // Create Intent B with different reference but same amount 2000 and same phone
      const intentB = await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'INV-PRIORITY-B',
        amount: 2000,
        currency: 'KES',
        payer_phone: '+254722000000',
        idempotency_key: 'idemp_prio_b',
      });

      // Transaction contains exact reference for Intent A
      const tx = await recordTransaction(
        {
          internal_reference: 'TX_PRIORITY_TEST',
          external_reference: 'EXT_PRIORITY_TEST',
          provider: 'loop',
          rail: 'loop',
          amount: 2000,
          currency: 'KES',
          provider_fee: 30,
          net_amount: 1970,
          payer_identifier: '+254722000000',
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {
            orderReference: 'INV-PRIORITY-A',
          },
        },
        testProfileId
      );

      const evaluation = await evaluateMatchingRules(tx, [intentB, intentA], {
        timeWindowMinutes: 60,
      });

      assert.ok(evaluation.match);
      assert.strictEqual(
        evaluation.match.matchType,
        'exact_reference',
        'Rule 1 (Exact reference) must take priority over Rule 2 & 3'
      );
      assert.strictEqual(evaluation.match.candidate.id, intentA.id);
      assert.strictEqual(evaluation.match.confidenceScore, 1.0);
      assert.strictEqual(evaluation.status, 'confirmed');
    });

    it('falls through to manual review without auto-approving when no rule clears threshold', async () => {
      // Transaction that has no reference, amount is completely unmatched
      const txUnmatched = await recordTransaction(
        {
          internal_reference: 'TX_UNMATCHED_001',
          external_reference: 'EXT_UNMATCHED_001',
          provider: 'loop',
          rail: 'loop',
          amount: 99999,
          currency: 'KES',
          provider_fee: 1499.98,
          net_amount: 98499.02,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const evalResult = await evaluateMatchingRules(txUnmatched, [], {
        confidenceThreshold: 0.7,
      });

      assert.strictEqual(evalResult.status, 'pending_review');
      assert.strictEqual(evalResult.match, null);
    });
  });

  describe('3. Exception Category Classifications (§14)', () => {
    it('detects missing_provider_transaction when intent has no matching provider transaction', async () => {
      // Create an intent with a backdated creation time (>15 mins ago)
      const intent = await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'ORD_OLD_INTENT',
        amount: 4500,
        currency: 'KES',
        idempotency_key: 'idemp_old_intent',
      });
      // Backdate created_at to 30 mins ago
      intent.created_at = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      intent.status = 'created';

      const exceptions = await detectExceptions([], [intent], []);
      const found = exceptions.find(
        (e) => e.category === 'missing_provider_transaction'
      );
      assert.ok(found, 'Should flag missing_provider_transaction');
      assert.strictEqual(found.details.order_reference, 'ORD_OLD_INTENT');
    });

    it('detects missing_order when transaction arrives with no corresponding intent', async () => {
      const tx = await recordTransaction(
        {
          internal_reference: 'TX_ORPHAN',
          external_reference: 'EXT_ORPHAN',
          provider: 'loop',
          rail: 'loop',
          amount: 1200,
          currency: 'KES',
          provider_fee: 18,
          net_amount: 1182,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const exceptions = await detectExceptions([tx], [], []);
      const found = exceptions.find((e) => e.category === 'missing_order');
      assert.ok(found, 'Should flag missing_order exception');
      assert.strictEqual(found.transaction_id, tx.id);
    });

    it('detects amount_mismatch when order reference matches but amount is different', async () => {
      const intent = await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'ORD_AMT_MISMATCH',
        amount: 5000,
        currency: 'KES',
        idempotency_key: 'idemp_amt_mismatch',
      });

      const tx = await recordTransaction(
        {
          internal_reference: 'TX_AMT_DIFF',
          external_reference: 'EXT_AMT_DIFF',
          provider: 'loop',
          rail: 'loop',
          amount: 4500, // Expected 5000
          currency: 'KES',
          provider_fee: 67.5,
          net_amount: 4432.5,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {
            orderReference: 'ORD_AMT_MISMATCH',
          },
        },
        testProfileId
      );

      const exceptions = await detectExceptions([tx], [intent], []);
      const found = exceptions.find((e) => e.category === 'amount_mismatch');
      assert.ok(found, 'Should flag amount_mismatch');
      assert.strictEqual(found.details.expected_amount, 5000);
      assert.strictEqual(found.details.received_amount, 4500);
    });

    it('detects duplicate_payment when multiple transactions share identical external references', async () => {
      const tx1 = await recordTransaction(
        {
          internal_reference: 'TX_DUP_1',
          external_reference: 'LOOP_REF_DUPLICATE',
          provider: 'loop',
          rail: 'loop',
          amount: 1000,
          currency: 'KES',
          provider_fee: 15,
          net_amount: 985,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const tx2 = await recordTransaction(
        {
          internal_reference: 'TX_DUP_2',
          external_reference: 'LOOP_REF_DUPLICATE', // Identical external reference
          provider: 'loop',
          rail: 'loop',
          amount: 1000,
          currency: 'KES',
          provider_fee: 15,
          net_amount: 985,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const exceptions = await detectExceptions([tx1, tx2], [], []);
      const found = exceptions.find((e) => e.category === 'duplicate_payment');
      assert.ok(found, 'Should detect duplicate_payment');
      assert.strictEqual(found.details.external_reference, 'LOOP_REF_DUPLICATE');
    });

    it('detects fee_mismatch when provider fee deviates from configured rail fee percentage', async () => {
      // Loop rail configured fee is 1.5% (fee on 10,000 should be 150)
      const txFeeMismatched = await recordTransaction(
        {
          internal_reference: 'TX_FEE_BAD',
          external_reference: 'EXT_FEE_BAD',
          provider: 'loop',
          rail: 'loop',
          amount: 10000,
          currency: 'KES',
          provider_fee: 500, // Charged 500 instead of 150
          net_amount: 9500,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const exceptions = await detectExceptions([txFeeMismatched], [], []);
      const found = exceptions.find((e) => e.category === 'fee_mismatch');
      assert.ok(found, 'Should detect fee_mismatch');
      assert.strictEqual(found.details.actual_fee, 500);
      assert.strictEqual(found.details.expected_fee, 150);
    });

    it('detects settlement_delay when settlement status is delayed or overdue', async () => {
      const txDelayed = await recordTransaction(
        {
          internal_reference: 'TX_DELAYED',
          external_reference: 'EXT_DELAYED',
          provider: 'loop',
          rail: 'loop',
          amount: 3000,
          currency: 'KES',
          provider_fee: 45,
          net_amount: 2955,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'delayed',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const exceptions = await detectExceptions([txDelayed], [], []);
      const found = exceptions.find((e) => e.category === 'settlement_delay');
      assert.ok(found, 'Should detect settlement_delay');
    });

    it('detects unknown_provider_reference when provider reference is corrupt or unmapped', async () => {
      const txCorrupt = await recordTransaction(
        {
          internal_reference: 'TX_CORRUPT',
          external_reference: 'UNKNOWN',
          provider: 'loop',
          rail: 'loop',
          amount: 2500,
          currency: 'KES',
          provider_fee: 37.5,
          net_amount: 2462.5,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      const exceptions = await detectExceptions([txCorrupt], [], []);
      const found = exceptions.find(
        (e) => e.category === 'unknown_provider_reference'
      );
      assert.ok(found, 'Should detect unknown_provider_reference');
    });
  });

  describe('4. Dashboard-Surfacing Aggregate Queries (§14)', () => {
    it('computes correct financial totals and operational metrics against a known fixture dataset', async () => {
      // Setup known fixture dataset
      // Tx 1: Successful (amount: 1000, fee: 15, net: 985, settlement: settled)
      const tx1 = await recordTransaction(
        {
          internal_reference: 'TX_AGG_1',
          external_reference: 'EXT_AGG_1',
          provider: 'loop',
          rail: 'loop',
          amount: 1000,
          currency: 'KES',
          provider_fee: 15,
          net_amount: 985,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: { orderReference: 'ORD_AGG_1' },
        },
        testProfileId
      );

      // Tx 2: Successful (amount: 2000, fee: 30, net: 1970, settlement: pending)
      const tx2 = await recordTransaction(
        {
          internal_reference: 'TX_AGG_2',
          external_reference: 'EXT_AGG_2',
          provider: 'loop',
          rail: 'loop',
          amount: 2000,
          currency: 'KES',
          provider_fee: 30,
          net_amount: 1970,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'pending',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: { orderReference: 'ORD_AGG_2' },
        },
        testProfileId
      );

      // Tx 3: Failed (amount: 500, fee: 0, net: 500, settlement: pending)
      const tx3 = await recordTransaction(
        {
          internal_reference: 'TX_AGG_3',
          external_reference: 'EXT_AGG_3',
          provider: 'loop',
          rail: 'loop',
          amount: 500,
          currency: 'KES',
          provider_fee: 0,
          net_amount: 500,
          payer_identifier: null,
          payment_status: 'failed',
          settlement_status: 'pending',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      // Intents for matching Tx 1 and Tx 2
      await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'ORD_AGG_1',
        amount: 1000,
        currency: 'KES',
        idempotency_key: 'idemp_agg_1',
      });
      await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'ORD_AGG_2',
        amount: 2000,
        currency: 'KES',
        idempotency_key: 'idemp_agg_2',
      });

      // Run reconciliation
      await runReconciliation({ profile_id: testProfileId });

      const metrics = await getDashboardReconciliationMetrics({
        profile_id: testProfileId,
      });

      // Verification of ground truth values:
      // Gross collections = 1000 + 2000 = 3000
      assert.strictEqual(metrics.gross_collections, 3000);
      // Net collections = 985 + 1970 = 2955
      assert.strictEqual(metrics.net_collections, 2955);
      // Total fees = 15 + 30 = 45
      assert.strictEqual(metrics.total_fees, 45);
      // Successful payments count = 2 (tx1, tx2)
      assert.strictEqual(metrics.successful_payments_count, 2);
      // Pending settlements count = 2 (tx2, tx3)
      assert.strictEqual(metrics.pending_settlements_count, 2);
      // Failed payments count = 1 (tx3)
      assert.strictEqual(metrics.failed_payments_count, 1);
      // Reconciliation rate = 2 / 3 = 0.67
      assert.strictEqual(metrics.reconciliation_rate, 0.67);
      assert.strictEqual(metrics.currency, 'KES');
    });
  });

  describe('5. Reconciliation API Endpoints (§18)', () => {
    it('POST /api/v1/reconciliation/run triggers matching and returns completed summary', async () => {
      await createPaymentIntent({
        recipient_profile_id: testProfileId,
        order_reference: 'ORD_API_001',
        amount: 1250,
        currency: 'KES',
        idempotency_key: 'idemp_api_001',
      });

      await recordTransaction(
        {
          internal_reference: 'TX_API_001',
          external_reference: 'EXT_API_001',
          provider: 'loop',
          rail: 'loop',
          amount: 1250,
          currency: 'KES',
          provider_fee: 18.75,
          net_amount: 1231.25,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: { orderReference: 'ORD_API_001' },
        },
        testProfileId
      );

      const res = await fetch(`${baseUrl}/api/v1/reconciliation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: testProfileId }),
      });

      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.strictEqual(data.status, 'completed');
      assert.ok(data.job_id.startsWith('job_recon_'));
      assert.strictEqual(data.matched_count, 1);
      assert.strictEqual(data.matches[0].match_type, 'exact_reference');
    });

    it('GET /api/v1/reconciliation/exceptions lists exceptions filterable by category and status', async () => {
      // Create an unmatched transaction to produce an exception
      await recordTransaction(
        {
          internal_reference: 'TX_API_EXC',
          external_reference: 'EXT_API_EXC',
          provider: 'loop',
          rail: 'loop',
          amount: 7777,
          currency: 'KES',
          provider_fee: 116.65,
          net_amount: 7660.35,
          payer_identifier: null,
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        testProfileId
      );

      await runReconciliation({ profile_id: testProfileId });

      const res = await fetch(
        `${baseUrl}/api/v1/reconciliation/exceptions?profile_id=${testProfileId}&status=open`
      );
      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.exceptions.length >= 1);
      assert.strictEqual(data.exceptions[0].status, 'open');
    });

    it('GET /api/v1/reconciliation/metrics returns aggregate financial metrics via API', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/reconciliation/metrics?profile_id=${testProfileId}`
      );
      assert.strictEqual(res.status, 200);
      const metrics = (await res.json()) as any;
      assert.strictEqual(typeof metrics.gross_collections, 'number');
      assert.strictEqual(typeof metrics.net_collections, 'number');
      assert.strictEqual(typeof metrics.reconciliation_rate, 'number');
      assert.strictEqual(metrics.currency, 'KES');
    });
  });
});
