import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { clearProfileCache, createProfile, submitIdentity } from '../services/profileService';
import { clearAliasCache, createAlias } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import { SeededRailAdapter } from '../adapters/seeded-rail-adapter';
import { ResilientAdapterWrapper } from '../adapters/resilient-adapter-wrapper';
import { CircuitBreaker, CircuitBreakerOpenError } from '../resilience/circuit-breaker';
import { retryWithJitter } from '../resilience/retry';
import { AdapterRegistry, ProviderNotFoundError, defaultAdapterRegistry } from '../adapters/adapter-registry';
import {
  getEnabledRailsFor,
  getRailByAdapterKey,
  setRailEnabled,
  resetRailCache,
} from '../services/paymentRailService';
import { NormalizedTransaction, PaymentRequest } from '@unipay/shared';

describe('Phase 2 Verification Test Suite — Provider Adapter Architecture & Payment Rails', () => {
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

  beforeEach(() => {
    clearProfileCache();
    clearAliasCache();
    clearIdempotencyCache();
    resetRailCache();
  });

  describe('1. PaymentProviderAdapter Contract & SeededRailAdapter Fixture (§9b, §10, §11)', () => {
    it('executes full createPayment -> getStatus -> refund -> disburse -> verifyWebhook lifecycle', async () => {
      const adapter = new SeededRailAdapter();

      assert.strictEqual(adapter.name(), 'seeded');
      const caps = adapter.capabilities();
      assert.strictEqual(caps.collection, true);
      assert.strictEqual(caps.statusInquiry, true);
      assert.strictEqual(caps.refund, true);
      assert.strictEqual(caps.disbursement, true);
      assert.strictEqual(caps.webhooks, true);
      assert.deepStrictEqual(caps.supportedCurrencies, ['KES']);
      assert.deepStrictEqual(caps.supportedCountries, ['KE']);
      assert.strictEqual(caps.settlementEstimate, 'instant');

      // 1. Create Payment
      const paymentReq: PaymentRequest = {
        amount: 3000,
        currency: 'KES',
        orderReference: 'ORD_1001',
        idempotencyKey: 'idemp_pay_001',
        payerPhone: '+254712345678',
      };
      const payResult = await adapter.createPayment(paymentReq);
      assert.ok(payResult.providerReference.startsWith('SEEDED_PAY_'));
      assert.strictEqual(payResult.status, 'pending');

      // 2. Get Status (default completed, and configurable mock status)
      const statusResult = await adapter.getStatus(payResult.providerReference);
      assert.strictEqual(statusResult.status, 'completed');
      assert.strictEqual(statusResult.providerReference, payResult.providerReference);

      adapter.setMockStatus(payResult.providerReference, 'failed');
      const failedStatusResult = await adapter.getStatus(payResult.providerReference);
      assert.strictEqual(failedStatusResult.status, 'failed');

      // 3. Refund
      const refundResult = await adapter.refund({
        providerReference: payResult.providerReference,
        amount: 1500,
        currency: 'KES',
        idempotencyKey: 'idemp_ref_001',
      });
      assert.ok(refundResult.refundReference.startsWith('SEEDED_REF_'));
      assert.strictEqual(refundResult.status, 'completed');

      // 4. Disburse / Payout
      const payoutResult = await adapter.disburse({
        recipientIdentifier: '+254799887766',
        amount: 2985,
        currency: 'KES',
        idempotencyKey: 'idemp_disb_001',
      });
      assert.ok(payoutResult.disbursementReference.startsWith('SEEDED_DISB_'));
      assert.strictEqual(payoutResult.status, 'completed');

      // 5. Verify Webhook
      assert.strictEqual(adapter.verifyWebhook({ headers: {}, body: {} }), true);
    });

    it('normalizes adapter payloads into exact NormalizedTransaction shape matching §11 schema', () => {
      const adapter = new SeededRailAdapter();
      const rawPayload = {
        provider: 'seeded',
        reference: 'SEEDED_PAY_9876ABCD',
        amount: 3000,
        currency: 'KES',
        status: 'COMPLETED',
        payerPhone: '+254712345678',
        timestamp: '2026-08-14T00:00:00.000Z',
      };

      const normalized: NormalizedTransaction = adapter.normalize(rawPayload);

      assert.strictEqual(normalized.provider, 'seeded');
      assert.strictEqual(normalized.rail, 'request_to_pay');
      assert.ok(normalized.internal_reference);
      assert.strictEqual(normalized.external_reference, 'SEEDED_PAY_9876ABCD');
      assert.strictEqual(normalized.amount, 3000);
      assert.strictEqual(normalized.currency, 'KES');
      assert.strictEqual(normalized.provider_fee, 15); // 0.5% of 3000
      assert.strictEqual(normalized.net_amount, 2985); // 3000 - 15
      assert.strictEqual(normalized.payer_identifier, '+254712345678');
      assert.strictEqual(normalized.payment_status, 'successful');
      assert.strictEqual(normalized.settlement_status, 'settled');
      assert.strictEqual(normalized.refund_status, 'none');
      assert.strictEqual(normalized.transaction_time, '2026-08-14T00:00:00.000Z');
      assert.strictEqual(normalized.raw_payload, rawPayload);
    });
  });

  describe('2. Payment Rails Table & Adapter Registry Resolution (§11, §18)', () => {
    it('resolves enabled payment rails for KES/KE currency and country', async () => {
      const rails = await getEnabledRailsFor('KES', 'KE', 3000);
      assert.ok(rails.length >= 1);
      assert.strictEqual(rails[0].adapter_key, 'seeded');
      assert.strictEqual(rails[0].is_enabled, true);
      assert.deepStrictEqual(rails[0].supported_currencies, ['KES']);
      assert.deepStrictEqual(rails[0].supported_countries, ['KE']);
    });

    it('strictly excludes disabled rails from resolution when is_enabled = false', async () => {
      // 1. Verify rail resolves initially
      const initial = await getEnabledRailsFor('KES', 'KE', 3000);
      assert.strictEqual(initial.length, 1);

      // 2. Disable rail
      await setRailEnabled('seeded', false);
      const rail = await getRailByAdapterKey('seeded');
      assert.strictEqual(rail?.is_enabled, false);

      // 3. Verify it is now excluded
      const afterDisable = await getEnabledRailsFor('KES', 'KE', 3000);
      assert.strictEqual(afterDisable.length, 0);

      // 4. Re-enable rail
      await setRailEnabled('seeded', true);
      const afterReenable = await getEnabledRailsFor('KES', 'KE', 3000);
      assert.strictEqual(afterReenable.length, 1);
    });

    it('AdapterRegistry registers, retrieves, and enforces adapter existence', () => {
      const registry = new AdapterRegistry();
      const adapter = new SeededRailAdapter();

      registry.register('seeded', adapter);
      assert.strictEqual(registry.has('seeded'), true);
      assert.strictEqual(registry.get('seeded').name(), 'seeded');

      assert.throws(() => registry.get('unknown_provider'), (err: any) => {
        assert.ok(err instanceof ProviderNotFoundError);
        return true;
      });
    });
  });

  describe('3. Circuit Breaker State Machine & Resilience (Handbook Module 3)', () => {
    it('transitions CLOSED -> OPEN upon reaching failure threshold, then fails fast', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        cooldownMs: 50,
      });

      assert.strictEqual(breaker.getState(), 'CLOSED');

      // 1st failure
      await assert.rejects(async () => {
        await breaker.execute(async () => {
          throw new Error('Failure 1');
        });
      }, /Failure 1/);
      assert.strictEqual(breaker.getState(), 'CLOSED');

      // 2nd failure
      await assert.rejects(async () => {
        await breaker.execute(async () => {
          throw new Error('Failure 2');
        });
      }, /Failure 2/);
      assert.strictEqual(breaker.getState(), 'CLOSED');

      // 3rd failure — reaches threshold 3, trips OPEN
      await assert.rejects(async () => {
        await breaker.execute(async () => {
          throw new Error('Failure 3');
        });
      }, /Failure 3/);
      assert.strictEqual(breaker.getState(), 'OPEN');

      // Fast-fail while OPEN without executing underlying function
      let called = false;
      await assert.rejects(async () => {
        await breaker.execute(async () => {
          called = true;
          return 'ok';
        });
      }, CircuitBreakerOpenError);
      assert.strictEqual(called, false);
    });

    it('transitions OPEN -> HALF_OPEN after cooldown and recovers to CLOSED on successful probe', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 30, // 30ms cooldown for fast test execution
      });

      // Trip breaker to OPEN
      for (let i = 0; i < 2; i++) {
        await assert.rejects(async () => {
          await breaker.execute(async () => {
            throw new Error('Fail');
          });
        });
      }
      assert.strictEqual(breaker.getState(), 'OPEN');

      // Wait for cooldown duration
      await new Promise((r) => setTimeout(r, 40));

      assert.strictEqual(breaker.getState(), 'HALF_OPEN');

      // Probe call succeeds
      const result = await breaker.execute(async () => 'probe_success');
      assert.strictEqual(result, 'probe_success');
      assert.strictEqual(breaker.getState(), 'CLOSED');
    });

    it('ResilientAdapterWrapper protects all adapter execution methods', async () => {
      const innerAdapter = new SeededRailAdapter();
      const wrapper = new ResilientAdapterWrapper(innerAdapter, {
        circuitBreaker: { failureThreshold: 2, cooldownMs: 30 },
        retry: { maxRetries: 1, baseDelayMs: 2 },
      });

      innerAdapter.setSimulateFailure(true, 'Provider down');

      // Failures trip the breaker
      await assert.rejects(async () => {
        await wrapper.createPayment({
          amount: 1000,
          currency: 'KES',
          orderReference: 'ORD_ERR',
          idempotencyKey: 'idemp_err_1',
        });
      });

      await assert.rejects(async () => {
        await wrapper.getStatus('SEEDED_PAY_123');
      });

      // Breaker is now OPEN — fail fast with CircuitBreakerOpenError
      await assert.rejects(async () => {
        await wrapper.refund({
          providerReference: 'SEEDED_PAY_123',
          amount: 500,
          currency: 'KES',
          idempotencyKey: 'idemp_err_2',
        });
      }, CircuitBreakerOpenError);

      await assert.rejects(async () => {
        await wrapper.disburse({
          recipientIdentifier: '+254700000000',
          amount: 500,
          currency: 'KES',
          idempotencyKey: 'idemp_err_3',
        });
      }, CircuitBreakerOpenError);
    });
  });

  describe('4. Retry with Exponential Backoff and Jitter (Handbook Module 3)', () => {
    it('retries transient failures and returns success if recovery occurs within maxRetries', async () => {
      let attempts = 0;
      const result = await retryWithJitter(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient error');
          }
          return 'success_after_retries';
        },
        { maxRetries: 3, baseDelayMs: 2, maxDelayMs: 10, jitter: false }
      );

      assert.strictEqual(result, 'success_after_retries');
      assert.strictEqual(attempts, 3);
    });

    it('throws error when failures exceed maxRetries', async () => {
      let attempts = 0;
      await assert.rejects(async () => {
        await retryWithJitter(
          async () => {
            attempts++;
            throw new Error('Persistent failure');
          },
          { maxRetries: 2, baseDelayMs: 2, maxDelayMs: 10, jitter: false }
        );
      }, /Persistent failure/);

      assert.strictEqual(attempts, 3); // 1 initial + 2 retries
    });
  });

  describe('5. Real POST /api/v1/checkout/payment-options Endpoint (§18)', () => {
    let aliasHandle: string;

    beforeEach(async () => {
      // Create profile and alias for checkout testing
      const prof = await createProfile({
        clerk_user_id: 'user_checkout_test_' + Date.now(),
        account_type: 'individual',
        display_name: 'Amina Mwangi',
        owner_name: 'Amina Jane Mwangi',
      });

      await submitIdentity(prof.id, {
        id_number: '31224567',
        id_document_url: 'https://storage.unipay.ke/docs/id.jpg',
      });

      const aliasObj = await createAlias({
        profile_id: prof.id,
        alias: 'amina',
      });
      aliasHandle = aliasObj.alias;
    });

    it('returns real seeded-adapter backed payment options with fee & net calculations', async () => {
      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: aliasHandle,
          amount: 3000,
          currency: 'KES',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();

      assert.strictEqual(data.provider, 'seeded');
      assert.strictEqual(data.rail, 'request_to_pay');
      assert.strictEqual(data.amount, 3000);
      assert.strictEqual(data.currency, 'KES');
      assert.strictEqual(data.estimated_fee, 15); // 0.5% of 3000
      assert.strictEqual(data.estimated_recipient_amount, 2985);
      assert.strictEqual(data.settlement_estimate, 'instant');
      assert.strictEqual(data.recipient.display_name, 'Amina Mwangi');
      assert.strictEqual(data.recipient.alias, '@amina');
    });

    it('returns 404 when alias handle does not exist', async () => {
      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: '@nonexistent_alias_999',
          amount: 500,
          currency: 'KES',
        }),
      });

      assert.strictEqual(res.status, 404);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'Not Found');
    });

    it('returns 422 when all rails for currency/country are disabled', async () => {
      await setRailEnabled('seeded', false);

      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: aliasHandle,
          amount: 1000,
          currency: 'KES',
        }),
      });

      assert.strictEqual(res.status, 422);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'Unprocessable Entity');
      assert.ok(body.message.includes('No enabled payment rails available'));
    });

    it('validates request parameters with 400 for invalid amount', async () => {
      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: aliasHandle,
          amount: -50,
          currency: 'KES',
        }),
      });

      assert.strictEqual(res.status, 400);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'Validation Error');
    });
  });
});
