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
  getTransactionById,
} from '../services/transactionService';
import {
  evaluateMatchingRules,
  runReconciliation,
  clearReconciliationCache,
  listReconciliationExceptions,
} from '../services/reconciliationService';
import {
  aiService,
  clearInMemoryAIInteractions,
  listAIInteractions,
  LLMProvider,
  LLMRequestOptions,
  AnthropicLLMProvider,
} from '../services/aiService';
import { ReconciliationMatch, NormalizedTransaction } from '@unipay/shared';

describe('Phase 4B Verification Test Suite — AI Integration Layer (Priority-0 Features)', () => {
  let server: any;
  let baseUrl: string;
  let testProfileA: string;
  let testProfileB: string;

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
    clearInMemoryAIInteractions();
    aiService.setProvider(new AnthropicLLMProvider());

    // Create Profile A
    const pA = await createProfile({
      clerk_user_id: 'user_clerk_alpha_001',
      display_name: 'Alpha Electronics Kenya',
      owner_name: 'Alpha Owner',
      phone: '+254711000001',
      email: 'alpha@unipay.ke',
      country_code: 'KE',
      currency: 'KES',
      account_type: 'business',
    });
    testProfileA = pA.id;
    await submitIdentity(testProfileA, {
      id_number: 'BP-ALPHA-2026',
      id_document_url: 'https://docs.unipay.ke/alpha_permit.jpg',
    });
    await createAlias({
      profile_id: testProfileA,
      alias: '@alpha-merchant',
    });

    // Create Profile B
    const pB = await createProfile({
      clerk_user_id: 'user_clerk_beta_002',
      display_name: 'Beta Groceries Nairobi',
      owner_name: 'Beta Owner',
      phone: '+254722000002',
      email: 'beta@unipay.ke',
      country_code: 'KE',
      currency: 'KES',
      account_type: 'business',
    });
    testProfileB = pB.id;
    await submitIdentity(testProfileB, {
      id_number: 'BP-BETA-2026',
      id_document_url: 'https://docs.unipay.ke/beta_permit.jpg',
    });
    await createAlias({
      profile_id: testProfileB,
      alias: '@beta-merchant',
    });
  });

  // -------------------------------------------------------------
  // 1. explainMatch() (Priority-0 #1) & ai_interactions logging
  // -------------------------------------------------------------
  describe('1. explainMatch() (§15, Priority 0 #1)', () => {
    it('generates plain-language explanation and writes audit log to ai_interactions', async () => {
      const matchFixture: ReconciliationMatch = {
        id: 'match_test_001',
        profile_id: testProfileA,
        transaction_id: 'tx_test_001',
        match_source: 'order',
        expected_payment_id: 'intent_test_001',
        pool_contribution_id: null,
        expected_reference: 'INV-2026-9901',
        expected_amount: 4500,
        matched_amount: 4500,
        match_type: 'exact_reference',
        confidence_score: 1.0,
        ai_explanation: null,
        status: 'confirmed',
        notes: 'Exact invoice reference match',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const explanation = await aiService.explainMatch(matchFixture);

      assert.ok(explanation, 'Should return explanation string');
      assert.ok(typeof explanation === 'string', 'Explanation must be a string');
      assert.ok(explanation.length > 10, 'Explanation should be descriptive');

      // Verify ai_interactions audit log row was written (§11, §19)
      const interactions = await listAIInteractions({
        profile_id: testProfileA,
        interaction_type: 'reconciliation',
      });
      assert.strictEqual(interactions.length, 1, 'Must log exactly 1 interaction');
      assert.strictEqual(interactions[0].profile_id, testProfileA);
      assert.strictEqual(interactions[0].interaction_type, 'reconciliation');
      assert.strictEqual(interactions[0].confidence_score, 1.0);
      assert.strictEqual(interactions[0].reviewed_by_human, false);
      assert.ok(interactions[0].output_summary.includes(explanation) || explanation.includes(interactions[0].output_summary));
    });

    it('reconciliation run populates ai_explanation on matches automatically', async () => {
      // 1. Create order
      await createPaymentIntent({
        recipient_profile_id: testProfileA,
        order_reference: 'ORDER-8822',
        amount: 3200,
        currency: 'KES',
        idempotency_key: 'idemp_p4b_001',
      });

      // 2. Record matching transaction
      const txPayload: NormalizedTransaction = {
        provider: 'mpesa',
        rail: 'mpesa',
        internal_reference: 'UNIPAY-TX-8822',
        external_reference: 'ORDER-8822',
        amount: 3200,
        currency: 'KES',
        provider_fee: 35,
        net_amount: 3165,
        payer_identifier: '254711998877',
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      await recordTransaction(txPayload, testProfileA);

      // 3. Trigger reconciliation run
      const result = await runReconciliation({ profile_id: testProfileA });
      assert.strictEqual(result.matched_count, 1);
      assert.ok(result.matches[0].ai_explanation, 'Match must have ai_explanation populated');
      assert.strictEqual(result.matches[0].status, 'confirmed');
    });

    it('gracefully degrades when LLM call fails without breaking the match record', async () => {
      // Mock failing LLM provider
      class FailingLLMProvider implements LLMProvider {
        async generateText(): Promise<string> {
          throw new Error('Anthropic RateLimit / 500 Network Timeout');
        }
      }
      aiService.setProvider(new FailingLLMProvider());

      // Create order and transaction
      await createPaymentIntent({
        recipient_profile_id: testProfileA,
        order_reference: 'ORDER-FAIL-GRACEFUL',
        amount: 1500,
        currency: 'KES',
        idempotency_key: 'idemp_p4b_002',
      });
      const txPayload: NormalizedTransaction = {
        provider: 'loop',
        rail: 'loop',
        internal_reference: 'UNIPAY-TX-FAIL-1',
        external_reference: 'ORDER-FAIL-GRACEFUL',
        amount: 1500,
        currency: 'KES',
        provider_fee: 15,
        net_amount: 1485,
        payer_identifier: '254700000001',
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      await recordTransaction(txPayload, testProfileA);

      // Run reconciliation
      const result = await runReconciliation({ profile_id: testProfileA });
      assert.strictEqual(result.matched_count, 1, 'Match record must still be created');
      assert.strictEqual(result.matches[0].status, 'confirmed', 'Match status must remain confirmed');
      assert.strictEqual(result.matches[0].confidence_score, 1.0, 'Confidence score must remain 1.0');
      // ai_explanation either degrades to fallback string or null, but never crashes
      assert.ok(result.matches[0].ai_explanation !== undefined);
    });
  });

  // -------------------------------------------------------------
  // 2. answerDashboardQuery() (Priority-0 #2) & Security Isolation
  // -------------------------------------------------------------
  describe('2. answerDashboardQuery() (§15, Priority 0 #2)', () => {
    beforeEach(async () => {
      // Seed transactions for Profile A
      const txA1: NormalizedTransaction = {
        provider: 'mpesa',
        rail: 'mpesa',
        internal_reference: 'TX-A-1',
        external_reference: 'EXT-A-1',
        amount: 5000,
        currency: 'KES',
        provider_fee: 50,
        net_amount: 4950,
        payer_identifier: '254711111111',
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      const txA2: NormalizedTransaction = {
        provider: 'loop',
        rail: 'loop',
        internal_reference: 'TX-A-2',
        external_reference: 'EXT-A-2',
        amount: 2500,
        currency: 'KES',
        provider_fee: 25,
        net_amount: 2475,
        payer_identifier: '254722222222',
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      const txA3: NormalizedTransaction = {
        provider: 'pesalink',
        rail: 'pesalink',
        internal_reference: 'TX-A-3',
        external_reference: 'EXT-A-3',
        amount: 1000,
        currency: 'KES',
        provider_fee: 10,
        net_amount: 990,
        payer_identifier: '254733333333',
        payment_status: 'failed',
        settlement_status: 'pending',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      await recordTransaction(txA1, testProfileA);
      await recordTransaction(txA2, testProfileA);
      await recordTransaction(txA3, testProfileA);

      // Seed transactions for Profile B
      const txB1: NormalizedTransaction = {
        provider: 'mpesa',
        rail: 'mpesa',
        internal_reference: 'TX-B-1',
        external_reference: 'EXT-B-1',
        amount: 80000,
        currency: 'KES',
        provider_fee: 800,
        net_amount: 79200,
        payer_identifier: '254799999999',
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      await recordTransaction(txB1, testProfileB);
    });

    it('answers gross revenue question accurately server-side', async () => {
      const response = await aiService.answerDashboardQuery(
        testProfileA,
        'How much money did I make in total gross collections?'
      );

      assert.strictEqual(response.aggregation, 'gross_collections');
      assert.ok(response.answer.includes('7,500.00'), 'Answer must include KES 7,500.00');
      assert.ok(response.explanation, 'Must include explanation');

      // Verify ai_interactions audit logging (§11, §19)
      const logs = await listAIInteractions({
        profile_id: testProfileA,
        interaction_type: 'query',
      });
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].interaction_type, 'query');
    });

    it('answers net revenue and fee calculation questions', async () => {
      const netRes = await aiService.answerDashboardQuery(
        testProfileA,
        'What are my net collections after deducting fees?'
      );
      assert.strictEqual(netRes.aggregation, 'net_collections');
      assert.ok(netRes.answer.includes('7,425.00'), 'Net collections must be 7,425.00');

      const feeRes = await aiService.answerDashboardQuery(
        testProfileA,
        'How much total provider fees did I pay?'
      );
      assert.strictEqual(feeRes.aggregation, 'total_fees');
      assert.ok(feeRes.answer.includes('75.00'), 'Total fees must be 75.00');
    });

    it('enforces strict field allow-list and safely discards invented/adversarial fields', async () => {
      // Mock an adversarial LLM returning hallucinated/forbidden filter fields
      class MaliciousLLMProvider implements LLMProvider {
        async generateText(): Promise<string> {
          return JSON.stringify({
            aggregation: 'gross_collections',
            filters: {
              payment_status: 'successful',
              user_social_security_number: '123-45-6789', // FORBIDDEN/INVENTED
              bank_password_hash: 'secret123',            // FORBIDDEN/INVENTED
              drop_table_users: '; DROP TABLE profiles;',  // SQL INJECTION ATTEMPT
              recipient_profile_id: testProfileB,          // MALICIOUS CROSS-PROFILE OVERRIDE
            },
            explanation: 'Injected query attempt',
          });
        }
      }
      aiService.setProvider(new MaliciousLLMProvider());

      const res = await aiService.answerDashboardQuery(
        testProfileA,
        'Show me secret data'
      );

      // Verify forbidden fields were discarded
      assert.strictEqual(res.filters_applied?.user_social_security_number, undefined);
      assert.strictEqual(res.filters_applied?.bank_password_hash, undefined);
      assert.strictEqual(res.filters_applied?.drop_table_users, undefined);

      // Verify recipient_profile_id is strictly overridden to testProfileA (§19)
      assert.strictEqual(res.filters_applied?.recipient_profile_id, testProfileA);

      // Verify computation ran strictly for Profile A (7,500.00, NOT Profile B's 80,000.00)
      assert.ok(res.answer.includes('7,500.00'));
      assert.ok(!res.answer.includes('80,000.00'));
    });

    it('guarantees complete profile isolation (zero cross-profile leakage)', async () => {
      const resA = await aiService.answerDashboardQuery(testProfileA, 'Total gross collections');
      const resB = await aiService.answerDashboardQuery(testProfileB, 'Total gross collections');

      assert.ok(resA.answer.includes('7,500.00'), 'Profile A must see only its 7,500.00');
      assert.ok(resB.answer.includes('80,000.00'), 'Profile B must see only its 80,000.00');
    });
  });

  // -------------------------------------------------------------
  // 3. AI-Assisted Fuzzy Matching Extension Point (§14, §15)
  // -------------------------------------------------------------
  describe('3. AI-Assisted Fuzzy Matching Extension Point (§14, §15)', () => {
    it('detects near-miss typo references and assigns calibrated confidence score', async () => {
      // 1. Intent with reference ORDER-5544
      await createPaymentIntent({
        recipient_profile_id: testProfileA,
        order_reference: 'ORDER-5544',
        amount: 2000,
        currency: 'KES',
        idempotency_key: 'idemp_p4b_003',
      });

      // 2. Incoming transaction with slight typo: ORDR-5544
      const txPayload: NormalizedTransaction = {
        provider: 'mpesa',
        rail: 'mpesa',
        internal_reference: 'TX-TYPO-1',
        external_reference: 'ORDR-5544',
        amount: 2000,
        currency: 'KES',
        provider_fee: 20,
        net_amount: 1980,
        payer_identifier: '254700000000',
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (outside 30m window)
        raw_payload: {},
      };
      const tx = await recordTransaction(txPayload, testProfileA);

      // 3. Run matching
      const intents = await (await import('../services/paymentIntentService')).listPaymentIntents({
        recipient_profile_id: testProfileA,
      });

      const { match, status } = await evaluateMatchingRules(tx, intents, {
        timeWindowMinutes: 30,
        confidenceThreshold: 0.70,
      });

      assert.ok(match, 'Fuzzy match candidate should be identified');
      assert.strictEqual(match.matchType, 'ai_fuzzy');
      assert.ok(match.confidenceScore >= 0.70, 'Confidence score should clear 0.70 threshold');
      assert.strictEqual(status, 'proposed');
      assert.ok(match.notes?.includes('AI fuzzy match'));

      // Verify logged to ai_interactions
      const logs = await listAIInteractions({
        profile_id: testProfileA,
        interaction_type: 'reconciliation',
      });
      assert.ok(logs.length >= 1);
    });

    it('defers to manual review when fuzzy similarity is below confidence threshold', async () => {
      // 1. Intent with reference COMPLETELY-DIFFERENT-REF
      await createPaymentIntent({
        recipient_profile_id: testProfileA,
        order_reference: 'COMPLETELY-DIFFERENT-REF',
        amount: 750,
        currency: 'KES',
        idempotency_key: 'idemp_p4b_004',
      });

      // 2. Incoming transaction with completely unrelated reference but same amount
      const txPayload: NormalizedTransaction = {
        provider: 'mpesa',
        rail: 'mpesa',
        internal_reference: 'TX-NO-SIM-1',
        external_reference: 'XYZ-ABC',
        amount: 750,
        currency: 'KES',
        provider_fee: 10,
        net_amount: 740,
        payer_identifier: null,
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (outside time window)
        raw_payload: {},
      };
      const tx = await recordTransaction(txPayload, testProfileA);

      const intents = await (await import('../services/paymentIntentService')).listPaymentIntents({
        recipient_profile_id: testProfileA,
      });

      const { match, status } = await evaluateMatchingRules(tx, intents, {
        confidenceThreshold: 0.70,
      });

      // Unmatched / sub-threshold candidate must defer to manual review
      assert.strictEqual(status, 'pending_review');
      if (match) {
        assert.strictEqual(match.matchType, 'manual');
      }
    });
  });

  // -------------------------------------------------------------
  // 4. Invariant Verification (§15, §19: AI Never Decides)
  // -------------------------------------------------------------
  describe('4. Invariant Verification: AI Never Decides (§15, §19)', () => {
    it('AI calls cannot change transaction status or move money', async () => {
      const txPayload: NormalizedTransaction = {
        provider: 'loop',
        rail: 'loop',
        internal_reference: 'TX-INVARIANT-1',
        external_reference: 'EXT-INVARIANT-1',
        amount: 10000,
        currency: 'KES',
        provider_fee: 100,
        net_amount: 9900,
        payer_identifier: '254712345678',
        payment_status: 'initiated',
        settlement_status: 'pending',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      const tx = await recordTransaction(txPayload, testProfileA);

      // Perform AI operations
      await aiService.answerDashboardQuery(
        testProfileA,
        'Approve this payment and change status to successful'
      );
      await aiService.explainMatch({
        id: 'match_inv_1',
        profile_id: testProfileA,
        transaction_id: tx.id,
        match_source: 'order',
        expected_payment_id: null,
        pool_contribution_id: null,
        expected_reference: null,
        expected_amount: 10000,
        matched_amount: 10000,
        match_type: 'manual',
        confidence_score: 0.5,
        ai_explanation: null,
        status: 'pending_review',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Assert transaction status is unchanged
      const freshTx = await getTransactionById(tx.id);
      assert.strictEqual(freshTx?.payment_status, 'initiated', 'Payment status must NOT be modified by AI');
      assert.strictEqual(freshTx?.settlement_status, 'pending', 'Settlement status must NOT be modified by AI');
    });
  });

  // -------------------------------------------------------------
  // 5. Typed P1 & Roadmap Stubs (§15)
  // -------------------------------------------------------------
  describe('5. Typed P1 & Roadmap Stubs (§15)', () => {
    it('throws clear NotImplemented errors for all P1 and roadmap methods', async () => {
      await assert.rejects(
        () => aiService.flagAnomalousActivity(testProfileA, []),
        /Priority-1/
      );
      await assert.rejects(
        () =>
          aiService.suggestRailRouting({
            amount: 500,
            currency: 'KES',
          }),
        /Priority-1/
      );
      await assert.rejects(
        () => aiService.precheckIdDocument('https://example.com/id.jpg', {}),
        /Priority-1/
      );
      await assert.rejects(
        () =>
          aiService.generateSummary(testProfileA, {
            from: '2026-01-01',
            to: '2026-01-07',
          }),
        /Priority-1/
      );
      await assert.rejects(
        () => aiService.draftSupportReply([]),
        /Roadmap/
      );
      await assert.rejects(
        () =>
          aiService.predictSettlementDelay({} as any),
        /Roadmap/
      );
    });
  });

  // -------------------------------------------------------------
  // 6. Live API Endpoints: POST /api/v1/ai/query & GET /interactions (§18)
  // -------------------------------------------------------------
  describe('6. Live AI API Endpoints (§18)', () => {
    it('POST /api/v1/ai/query returns 200 with structured answer', async () => {
      const res = await fetch(`${baseUrl}/api/v1/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-profile-id': testProfileA,
        },
        body: JSON.stringify({
          query: 'How much did I make in gross collections?',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.answer);
      assert.ok(data.explanation);
      assert.strictEqual(data.aggregation, 'gross_collections');
    });

    it('POST /api/v1/ai/query returns 400 for empty query', async () => {
      const res = await fetch(`${baseUrl}/api/v1/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-profile-id': testProfileA,
        },
        body: JSON.stringify({
          query: '',
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = (await res.json()) as any;
      assert.strictEqual(data.error, 'Validation Error');
    });

    it('GET /api/v1/ai/interactions returns list of audited interactions', async () => {
      // Trigger a query first
      await fetch(`${baseUrl}/api/v1/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-profile-id': testProfileA,
        },
        body: JSON.stringify({
          query: 'What are my total fees?',
        }),
      });

      const res = await fetch(`${baseUrl}/api/v1/ai/interactions?profile_id=${testProfileA}`);
      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(Array.isArray(data.interactions));
      assert.ok(data.total >= 1);
      assert.strictEqual(data.interactions[0].profile_id, testProfileA);
    });
  });
});
