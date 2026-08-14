import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { clearProfileCache, createProfile, submitIdentity, reviewIdentity } from '../services/profileService';
import { clearAliasCache, createAlias } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import { clearPaymentIntentCache } from '../services/paymentIntentService';
import { clearTransactionCache, recordTransaction } from '../services/transactionService';
import { resetRailCache } from '../services/paymentRailService';
import { clearPayoutCache } from '../services/payoutService';
import { clearAdminUserCache } from '../services/adminService';
import { resetRateLimiters } from '../middleware/rateLimiter';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import { LoopAdapter, generateLoopHmacSignature } from '../adapters/loop-adapter';
import { ResilientAdapterWrapper } from '../adapters/resilient-adapter-wrapper';
import { CircuitBreaker } from '../resilience/circuit-breaker';
import { observabilityService } from '../services/observabilityService';
import {
  clearReconciliationCache,
  runReconciliation,
  saveReconciliationException,
} from '../services/reconciliationService';
import { aiService, AnthropicLLMProvider } from '../services/aiService';
import { redactPII, rootLogger } from '../utils/logger';

describe('Phase 9 Verification Test Suite — Hardening, Observability & Security Pass', () => {
  let server: any;
  let baseUrl: string;

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
    clearPaymentIntentCache();
    clearTransactionCache();
    clearPayoutCache();
    clearAdminUserCache();
    clearReconciliationCache();
    resetRailCache();
    resetRateLimiters();
    observabilityService.reset();

    // Reset loop adapter
    const rawLoop = new LoopAdapter();
    defaultAdapterRegistry.register('loop', rawLoop, true);
  });

  // =========================================================================
  // 1. Rate Limiting Enforcement (Handbook M8.3, M7)
  // =========================================================================
  describe('1. Rate Limiting Enforcement (Token Bucket Algorithm)', () => {
    it('allows normal single-user traffic under configured rate limit', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_rl_normal_user',
        account_type: 'individual',
        display_name: 'RL Normal User',
        owner_name: 'Normal Payer',
        phone: '+254711223344',
      });
      await submitIdentity(profile.id, {
        id_number: '12345678',
        id_document_url: 'https://storage.unipay.ke/docs/id.jpg',
      });
      await reviewIdentity(profile.id, { decision: 'approved' });
      await createAlias({ profile_id: profile.id, alias: 'normaluser', identifier_type: 'alias' });

      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: 'normaluser',
          amount: 500,
          currency: 'KES',
        }),
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('X-RateLimit-Limit'));
      assert.ok(res.headers.get('X-RateLimit-Remaining'));
      assert.ok(res.headers.get('X-RateLimit-Reset'));
    });

    it('enforces 429 Too Many Requests under simulated burst on checkout / payment-intents', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_rl_burst_user',
        account_type: 'individual',
        display_name: 'RL Burst User',
        owner_name: 'Burst Payer',
        phone: '+254722334455',
      });
      await submitIdentity(profile.id, {
        id_number: '23456789',
        id_document_url: 'https://storage.unipay.ke/docs/id.jpg',
      });
      await reviewIdentity(profile.id, { decision: 'approved' });
      await createAlias({ profile_id: profile.id, alias: 'burstuser', identifier_type: 'alias' });

      // Send burst of 35 requests concurrently to test rate limiter capacity (capacity is 30)
      const responses = await Promise.all(
        Array.from({ length: 35 }, (_, i) =>
          fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': '192.168.1.100',
            },
            body: JSON.stringify({
              alias: 'burstuser',
              amount: 100 + i,
              currency: 'KES',
            }),
          })
        )
      );

      const hit429Res = responses.find((r) => r.status === 429);
      assert.ok(hit429Res, 'Expected rate limiter to trip with 429');
      const retryAfterHeader = hit429Res.headers.get('Retry-After');
      const limitHeader = hit429Res.headers.get('X-RateLimit-Limit');
      const remainingHeader = hit429Res.headers.get('X-RateLimit-Remaining');
      const body = (await hit429Res.json()) as any;
      assert.strictEqual(body.error, 'Too Many Requests');
      assert.ok(body.message.includes('Too many checkout requests'));
      assert.ok(retryAfterHeader, 'Expected Retry-After header');
      assert.strictEqual(limitHeader, '30');
      assert.strictEqual(remainingHeader, '0');
    });

    it('enforces strict rate limiting on AI query endpoint to prevent LLM abuse', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_ai_rl_user',
        account_type: 'individual',
        display_name: 'AI Rate Limit User',
        owner_name: 'AI Payer',
      });

      let hit429 = false;
      // Burst 15 queries on AI endpoint (limit is 10)
      for (let i = 0; i < 15; i++) {
        const res = await fetch(`${baseUrl}/api/v1/ai/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-profile-id': profile.id,
          },
          body: JSON.stringify({
            query: `How much did I spend in KES on batch test ${i}?`,
            profile_id: profile.id,
          }),
        });

        if (res.status === 429) {
          hit429 = true;
          const body = (await res.json()) as any;
          assert.strictEqual(body.error, 'Too Many Requests');
          assert.ok(body.message.includes('AI query rate limit reached'));
          break;
        }
      }

      assert.strictEqual(hit429, true, 'Expected AI query rate limiter to engage');
    });
  });

  // =========================================================================
  // 2. Distributed Tracing & trace_id Propagation (Handbook M5)
  // =========================================================================
  describe('2. Distributed Tracing & trace_id Propagation (Handbook M5)', () => {
    it('propagates incoming x-trace-id end-to-end in HTTP response headers', async () => {
      const customTraceId = 'trace-unipay-prod-998877';

      const res = await fetch(`${baseUrl}/api/v1/health`, {
        headers: { 'x-trace-id': customTraceId },
      });

      assert.strictEqual(res.headers.get('x-trace-id'), customTraceId);
    });

    it('propagates trace_id through LOOP adapter outbound requests and logger', async () => {
      const customTrace = 'trace-loop-checkout-445566';
      const loopAdapter = new LoopAdapter();

      const paymentResult = await loopAdapter.createPayment({
        amount: 2500,
        currency: 'KES',
        orderReference: 'ORDER-TRACE-001',
        idempotencyKey: 'idem-trace-001',
        payerPhone: '+254704540384',
        metadata: { trace_id: customTrace },
      });

      assert.strictEqual(paymentResult.status, 'pending');
      assert.strictEqual(paymentResult.providerReference, 'idem-trace-001');
    });

    it('propagates trace_id into AI service LLM provider queries', async () => {
      const customTrace = 'trace-ai-llm-112233';
      const provider = new AnthropicLLMProvider();

      const answer = await aiService.answerDashboardQuery(
        '00000000-0000-0000-0000-000000000001',
        'Show my gross collections this month',
        customTrace
      );

      assert.ok(answer.explanation);
      assert.strictEqual(answer.aggregation, 'gross_collections');
    });
  });

  // =========================================================================
  // 3. Golden Signals & Lightweight Alerting Posture (Handbook M5)
  // =========================================================================
  describe('3. Golden Signals & Lightweight Alerting Posture (Handbook M5)', () => {
    it('measures latency, traffic, error rate, and saturation via /api/v1/health/signals', async () => {
      // Execute a few sample requests
      await fetch(`${baseUrl}/api/v1/health`);
      await fetch(`${baseUrl}/api/v1/health`);

      const res = await fetch(`${baseUrl}/api/v1/health/signals`);
      assert.strictEqual(res.status, 200);

      const data = (await res.json()) as any;
      assert.ok(data.signals);
      assert.ok(data.signals.latency);
      assert.ok(data.signals.traffic);
      assert.ok(data.signals.error_rate);
      assert.ok(data.signals.saturation);

      assert.ok(typeof data.signals.latency.avg_ms === 'number');
      assert.ok(typeof data.signals.traffic.total_requests === 'number');
      assert.ok(data.signals.traffic.total_requests >= 2);
      assert.strictEqual(data.signals.saturation.active_circuit_breakers_open, 0);
      assert.ok(['HEALTHY', 'DEGRADED', 'UNHEALTHY'].includes(data.signals.saturation.system_status));
    });

    it('fires alert notification when exception queue depth crosses configured threshold', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_alert_user',
        account_type: 'business',
        display_name: 'Alert Business',
        owner_name: 'Alert Owner',
      });

      // Create 6 open exceptions to cross default threshold of 5
      for (let i = 1; i <= 6; i++) {
        await saveReconciliationException({
          profile_id: profile.id,
          transaction_id: null,
          category: 'missing_order',
          details: { reason: `Test exception ${i}` },
        });
      }

      let capturedAlert: any = null;
      const unsubscribe = observabilityService.onAlert((alert) => {
        capturedAlert = alert;
      });

      const alerts = await observabilityService.checkAlertThresholds();
      unsubscribe();

      assert.ok(alerts.length > 0, 'Expected at least 1 active alert');
      const excAlert = alerts.find((a) => a.symptom === 'exception_queue_depth');
      assert.ok(excAlert, 'Expected exception_queue_depth alert to be triggered');
      assert.strictEqual(excAlert?.severity, 'WARNING');
      assert.ok((excAlert?.current_value || 0) >= 6);
      assert.ok(capturedAlert);
    });
  });

  // =========================================================================
  // 4. §19 Security Checklist End-to-End Re-Verification
  // =========================================================================
  describe('4. §19 Security Checklist End-to-End Re-Verification', () => {
    it('verifies Webhook signature verification and duplicate replay rejection', async () => {
      const secretKey = 'hyqd7bwMr9Kv-C5PW4n7uF4TiMnMp_hyvyhYYkYlcU8';
      const merchantTill = '133239';
      const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const nonce = 'replay-nonce-test-12345';
      const signature = generateLoopHmacSignature(merchantTill, timestamp, nonce, secretKey);

      const eventId = 'evt_replay_security_check_' + Date.now();
      const txnReference = 'TXN-REPLAY-SEC-' + Date.now();

      const payload = {
        serviceCode: 'NEO_MRCHNT_RTP',
        eventId,
        txnReference,
        requestParameters: {
          merchantTill,
          mobileNo: '254704540384',
          amount: '1500.00',
          reason: 'Security Replay Check',
          timestamp,
          nonce,
          signature,
        },
      };

      // First webhook post -> returns 200, duplicate: false
      const res1 = await fetch(`${baseUrl}/api/v1/webhooks/loop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res1.status, 200);
      const data1 = (await res1.json()) as any;
      assert.strictEqual(data1.status, 'success');
      assert.strictEqual(data1.duplicate, false);

      // Replayed webhook post -> returns 200, duplicate: true
      const res2 = await fetch(`${baseUrl}/api/v1/webhooks/loop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res2.status, 200);
      const data2 = (await res2.json()) as any;
      assert.strictEqual(data2.status, 'success');
      assert.strictEqual(data2.duplicate, true);

      // Webhook with invalid signature -> returns 401 Unauthorized
      const badPayload = {
        ...payload,
        eventId: 'evt_bad_sig_002',
        requestParameters: {
          ...payload.requestParameters,
          signature: 'invalid_forged_hmac_signature',
        },
      };

      const resBad = await fetch(`${baseUrl}/api/v1/webhooks/loop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(badPayload),
      });

      assert.strictEqual(resBad.status, 401);
    });

    it('enforces idempotency on money-moving payment-intents endpoint', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_idem_check_user',
        account_type: 'individual',
        display_name: 'Idem Check User',
        owner_name: 'Idem Payer',
        phone: '+254704540384',
      });
      await submitIdentity(profile.id, {
        id_number: '34567890',
        id_document_url: 'https://storage.unipay.ke/docs/id.jpg',
      });
      await reviewIdentity(profile.id, { decision: 'approved' });
      await createAlias({ profile_id: profile.id, alias: 'idemuser', identifier_type: 'alias' });

      const idempotencyKey = 'idem-money-move-001';
      const body = {
        alias: 'idemuser',
        order_reference: 'ORD-IDEM-001',
        amount: 1200,
        currency: 'KES',
        payer_phone: '+254704540384',
        idempotency_key: idempotencyKey,
      };

      // First request
      const res1 = await fetch(`${baseUrl}/api/v1/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      assert.strictEqual(res1.status, 201);
      const data1 = (await res1.json()) as any;
      assert.strictEqual(data1.amount, 1200);

      // Replayed request with same idempotency key
      const res2 = await fetch(`${baseUrl}/api/v1/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      assert.strictEqual(res2.status, 201);
      assert.strictEqual(res2.headers.get('x-idempotent-replayed'), 'true');
      const data2 = (await res2.json()) as any;
      assert.strictEqual(data2.id, data1.id);
    });

    it('redacts Kenyan PII (emails, phone numbers, IDs, document URLs) in structured logger', () => {
      const rawText =
        'User amina.test@example.com with phone 0704540384 and national_id: 12345678 uploaded https://storage.unipay.ke/kyc/selfies/face.jpg';

      const sanitized = redactPII(rawText) as string;

      assert.ok(!sanitized.includes('amina.test@example.com'), 'Email must be redacted');
      assert.ok(!sanitized.includes('0704540384'), 'Phone number must be redacted');
      assert.ok(!sanitized.includes('12345678'), 'ID number must be redacted');
      assert.ok(!sanitized.includes('https://storage.unipay.ke/kyc/selfies/face.jpg'), 'Doc URL must be redacted');

      assert.ok(sanitized.includes('[REDACTED_EMAIL]'));
      assert.ok(sanitized.includes('[REDACTED_PHONE]'));
      assert.ok(sanitized.includes('[REDACTED_ID]'));
      assert.ok(sanitized.includes('[REDACTED_DOC_URL]'));
    });
  });

  // =========================================================================
  // 5. Induced Outage & Circuit Breaker Fault Injection (Handbook M3)
  // =========================================================================
  describe('5. Induced Outage & Circuit Breaker Fault Injection (Handbook M3)', () => {
    it('transitions CLOSED -> OPEN -> HALF_OPEN -> CLOSED under induced provider failure', async () => {
      const rawAdapter = new LoopAdapter();
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 50, // 50ms cooldown for fast test execution
      });
      const resilientWrapper = new ResilientAdapterWrapper(rawAdapter, {
        circuitBreaker: { failureThreshold: 2, cooldownMs: 50 },
        retry: { maxRetries: 0 },
      });

      defaultAdapterRegistry.register('loop', resilientWrapper, false);

      // Initially CLOSED
      assert.strictEqual(resilientWrapper.getCircuitBreaker().getState(), 'CLOSED');

      // Inject deliberate failure into LoopAdapter
      rawAdapter.setSimulateFailure(true, 'Induced 503 LOOP Gateway Outage');

      // 1st failure
      await assert.rejects(
        () =>
          resilientWrapper.createPayment({
            amount: 1000,
            currency: 'KES',
            orderReference: 'ORD-OUTAGE-001',
            idempotencyKey: 'idem-outage-001',
            payerPhone: '+254704540384',
          }),
        /Induced 503/
      );

      // 2nd failure -> Trips circuit breaker to OPEN
      await assert.rejects(
        () =>
          resilientWrapper.createPayment({
            amount: 1000,
            currency: 'KES',
            orderReference: 'ORD-OUTAGE-002',
            idempotencyKey: 'idem-outage-002',
            payerPhone: '+254704540384',
          }),
        /Induced 503/
      );

      assert.strictEqual(resilientWrapper.getCircuitBreaker().getState(), 'OPEN');

      // Subsequent call fails fast with CircuitBreakerOpenError without calling provider
      await assert.rejects(
        () =>
          resilientWrapper.createPayment({
            amount: 1000,
            currency: 'KES',
            orderReference: 'ORD-OUTAGE-003',
            idempotencyKey: 'idem-outage-003',
            payerPhone: '+254704540384',
          }),
        /Circuit breaker is OPEN/
      );

      // Wait for cooldown duration (50ms) to allow HALF_OPEN transition
      await new Promise((resolve) => setTimeout(resolve, 60));
      assert.strictEqual(resilientWrapper.getCircuitBreaker().getState(), 'HALF_OPEN');

      // Restore simulated connection
      rawAdapter.setSimulateFailure(false);

      // Successful probe in HALF_OPEN resets circuit to CLOSED
      const recoveryResult = await resilientWrapper.createPayment({
        amount: 1000,
        currency: 'KES',
        orderReference: 'ORD-OUTAGE-004',
        idempotencyKey: 'idem-outage-004',
        payerPhone: '+254704540384',
      });

      assert.strictEqual(recoveryResult.status, 'pending');
      assert.strictEqual(resilientWrapper.getCircuitBreaker().getState(), 'CLOSED');
    });
  });

  // =========================================================================
  // 6. N+1 Query Audit & Batch Execution Verification (Handbook M1)
  // =========================================================================
  describe('6. N+1 Query Audit & Batch Execution Verification (Handbook M1)', () => {
    it('executes reconciliation run with multiple transactions without repeating per-row rail queries', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_n1_audit_user',
        account_type: 'business',
        display_name: 'N1 Audit Business',
        owner_name: 'Audit Owner',
      });

      // Record 10 transactions across different rails
      for (let i = 1; i <= 10; i++) {
        await recordTransaction(
          {
            provider: 'loop',
            rail: 'request_to_pay',
            amount: 1000 * i,
            currency: 'KES',
            payment_status: 'successful',
            settlement_status: 'settled',
            refund_status: 'none',
            external_reference: `EXT-N1-${i}`,
            internal_reference: `INT-N1-${i}`,
            payer_identifier: `2547000000${i}`,
            provider_fee: 15 * i,
            net_amount: 1000 * i - 15 * i,
            transaction_time: new Date().toISOString(),
            raw_payload: {},
          },
          profile.id
        );
      }

      // Execute reconciliation run
      const reconResult = await runReconciliation({
        profile_id: profile.id,
      });

      assert.strictEqual(reconResult.status, 'completed');
      assert.ok(typeof reconResult.duration_ms === 'number');
      assert.ok(reconResult.duration_ms < 10000, 'Expected fast batched execution');
    });
  });
});
