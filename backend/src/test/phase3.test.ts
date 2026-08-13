import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { clearProfileCache, createProfile, submitIdentity } from '../services/profileService';
import { clearAliasCache, createAlias } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import { SeededRailAdapter } from '../adapters/seeded-rail-adapter';
import { LoopAdapter, generateLoopHmacSignature } from '../adapters/loop-adapter';
import { ResilientAdapterWrapper } from '../adapters/resilient-adapter-wrapper';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import {
  getEnabledRailsFor,
  getRailByAdapterKey,
  setRailEnabled,
  resetRailCache,
} from '../services/paymentRailService';
import {
  createPaymentIntent,
  getPaymentIntentById,
  clearPaymentIntentCache,
} from '../services/paymentIntentService';
import {
  recordTransaction,
  getTransactionById,
  getTransactionByExternalReference,
  clearTransactionCache,
} from '../services/transactionService';
import {
  processProviderWebhook,
  clearWebhookCache,
  isEventProcessed,
} from '../services/webhookService';
import { NormalizedTransaction, PaymentRequest } from '@unipay/shared';
import { redactPII } from '../utils/logger';

describe('Phase 3 Verification Test Suite — LOOP Integration & Payment Lifecycle', () => {
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
    clearPaymentIntentCache();
    clearTransactionCache();
    clearWebhookCache();
  });

  describe('1. LoopAdapter Implementation & Structural Normalization Equivalence (§10, §11)', () => {
    it('implements the full PaymentProviderAdapter interface against LOOP sandbox model', async () => {
      const adapter = new LoopAdapter();

      assert.strictEqual(adapter.name(), 'loop');
      const caps = adapter.capabilities();
      assert.strictEqual(caps.collection, true);
      assert.strictEqual(caps.statusInquiry, true);
      assert.strictEqual(caps.refund, false); // Automated refund not exposed by sandbox
      assert.strictEqual(caps.disbursement, true);
      assert.strictEqual(caps.webhooks, true);
      assert.deepStrictEqual(caps.supportedCurrencies, ['KES']);
      assert.deepStrictEqual(caps.supportedCountries, ['KE']);
      assert.strictEqual(caps.settlementEstimate, 'instant');
      assert.strictEqual(caps.feeStructure?.percentage, 0.015);

      // Create Payment
      const payReq: PaymentRequest = {
        amount: 2500,
        currency: 'KES',
        orderReference: 'ORD_LOOP_001',
        idempotencyKey: 'idemp_loop_pay_001',
        payerPhone: '+254704540384',
      };
      const payResult = await adapter.createPayment(payReq);
      assert.strictEqual(payResult.status, 'pending');
      assert.ok(payResult.providerReference);

      // Get Status
      const statusResult = await adapter.getStatus('idemp_loop_pay_001');
      assert.strictEqual(statusResult.status, 'completed');
      assert.strictEqual(statusResult.currency, 'KES');

      // Refund explicitly throws unsupported error
      await assert.rejects(async () => {
        await adapter.refund({
          providerReference: 'idemp_loop_pay_001',
          amount: 500,
          currency: 'KES',
          idempotencyKey: 'idemp_loop_ref_001',
        });
      }, /does not support automated refunds/);

      // Disburse
      const disbResult = await adapter.disburse({
        recipientIdentifier: '+254704540384',
        amount: 2400,
        currency: 'KES',
        idempotencyKey: 'idemp_loop_disb_001',
      });
      assert.ok(disbResult.disbursementReference.startsWith('LOOP_DISB_'));
      assert.strictEqual(disbResult.status, 'requested');
    });

    it('proves normalize() produces structurally identical NormalizedTransaction shape for seeded and LOOP adapters (§10, §11)', () => {
      const seededAdapter = new SeededRailAdapter();
      const loopAdapter = new LoopAdapter();

      const seededRaw = {
        provider: 'seeded',
        reference: 'SEEDED_TX_12345',
        amount: 3000,
        currency: 'KES',
        fee: 15,
        status: 'COMPLETED',
        payerPhone: '+254712345678',
        timestamp: '2026-08-14T00:00:00.000Z',
      };

      const loopRaw = {
        statusCode: 200,
        data: {
          serviceTransactionStatus: 'COMPLETED',
          txnReference: 'idemp_loop_123',
          response: {
            status: 'COMPLETED',
            transactionRef: 'TXN-20260814-000099',
            amount: '3000.00',
            currency: 'KES',
            fee: '45.00',
            payerMobile: '+254704540384',
            timestamp: '2026-08-14T00:00:00.000Z',
          },
        },
      };

      const seededNorm: NormalizedTransaction = seededAdapter.normalize(seededRaw);
      const loopNorm: NormalizedTransaction = loopAdapter.normalize(loopRaw);

      // Verify exact same keys present on both objects
      const seededKeys = Object.keys(seededNorm).sort();
      const loopKeys = Object.keys(loopNorm).sort();
      assert.deepStrictEqual(seededKeys, loopKeys);

      // Verify exact same types for every property
      for (const key of seededKeys) {
        const seededVal = (seededNorm as any)[key];
        const loopVal = (loopNorm as any)[key];
        assert.strictEqual(
          typeof seededVal,
          typeof loopVal,
          `Property '${key}' type mismatch: ${typeof seededVal} vs ${typeof loopVal}`
        );
      }

      // Verify required §11 fields on loopNorm
      assert.strictEqual(loopNorm.provider, 'loop');
      assert.strictEqual(loopNorm.rail, 'request_to_pay');
      assert.strictEqual(loopNorm.amount, 3000);
      assert.strictEqual(loopNorm.currency, 'KES');
      assert.strictEqual(loopNorm.provider_fee, 45); // 1.5% fee
      assert.strictEqual(loopNorm.net_amount, 2955);
      assert.strictEqual(loopNorm.payer_identifier, '+254704540384');
      assert.strictEqual(loopNorm.payment_status, 'successful');

      // Rule (§5, §12): Payment success leaves settlement_status as 'pending'
      assert.strictEqual(loopNorm.settlement_status, 'pending');
      assert.strictEqual(loopNorm.refund_status, 'none');
    });

    it('LoopAdapter is automatically protected by ResilientAdapterWrapper via defaultAdapterRegistry', async () => {
      const registeredAdapter = defaultAdapterRegistry.get('loop');
      assert.ok(registeredAdapter instanceof ResilientAdapterWrapper);
      assert.strictEqual(registeredAdapter.name(), 'loop');
    });
  });

  describe('2. Payment Intent Lifecycle & Database Idempotency (§11, §12)', () => {
    let profileId: string;

    beforeEach(async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_intent_test_' + Date.now(),
        account_type: 'business',
        display_name: 'Safari Tech Ventures',
        owner_name: 'John Kiptoo',
      });
      profileId = prof.id;
    });

    it('creates payment intent and enforces unique idempotency_key (second call returns existing intent)', async () => {
      const idemKey = `idemp_unique_${Date.now()}`;

      // First creation call
      const intent1 = await createPaymentIntent({
        recipient_profile_id: profileId,
        order_reference: 'ORD_TEST_900',
        amount: 5000,
        currency: 'KES',
        payer_phone: '+254704540384',
        provider: 'loop',
        rail: 'loop',
        idempotency_key: idemKey,
      });

      assert.ok(intent1.id);
      assert.strictEqual(intent1.status, 'pending');
      assert.strictEqual(intent1.amount, 5000);
      assert.strictEqual(intent1.provider, 'loop');

      // Duplicate call with exact same idempotency_key
      const intent2 = await createPaymentIntent({
        recipient_profile_id: profileId,
        order_reference: 'ORD_TEST_900',
        amount: 5000,
        currency: 'KES',
        payer_phone: '+254704540384',
        provider: 'loop',
        rail: 'loop',
        idempotency_key: idemKey,
      });

      // Must return identical intent, not creating a second row
      assert.strictEqual(intent2.id, intent1.id);
      assert.strictEqual(intent2.idempotency_key, intent1.idempotency_key);
    });

    it('POST /api/v1/payment-intents API endpoint creates intent and returns 201', async () => {
      const idemKey = `idemp_api_test_${Date.now()}`;
      const res = await fetch(`${baseUrl}/api/v1/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          recipient_profile_id: profileId,
          order_reference: 'ORD_API_101',
          amount: 1500,
          currency: 'KES',
          payer_phone: '+254712345678',
          provider: 'loop',
        }),
      });

      assert.strictEqual(res.status, 201);
      const data: any = await res.json();
      assert.ok(data.id);
      assert.strictEqual(data.amount, 1500);
      assert.strictEqual(data.provider, 'loop');
      assert.strictEqual(data.idempotency_key, idemKey);

      // Query GET /api/v1/payment-intents/:id
      const getRes = await fetch(`${baseUrl}/api/v1/payment-intents/${data.id}`);
      assert.strictEqual(getRes.status, 200);
      const retrieved: any = await getRes.json();
      assert.strictEqual(retrieved.id, data.id);
    });
  });

  describe('3. Webhook Signature Verification, Deduplication & Outbox (§12, §19, Handbook M2)', () => {
    it('rejects webhooks with invalid signatures', async () => {
      const res = await fetch(`${baseUrl}/api/v1/webhooks/loop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-loop-signature': 'invalid_sig',
        },
        body: JSON.stringify({
          eventId: 'evt_invalid_001',
          txnReference: 'TXN_TEST_ERR',
        }),
      });

      assert.strictEqual(res.status, 401);
      const data: any = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });

    it('processes valid webhook, updates payment intent, and normalizes into transactions ledger', async () => {
      // 1. Create recipient and intent
      const prof = await createProfile({
        clerk_user_id: 'user_webhook_test_' + Date.now(),
        account_type: 'individual',
        display_name: 'Grace Kimani',
        owner_name: 'Grace Wambui Kimani',
      });

      const intent = await createPaymentIntent({
        recipient_profile_id: prof.id,
        order_reference: 'ORD_WH_001',
        amount: 3500,
        currency: 'KES',
        payer_phone: '+254722001122',
        provider: 'loop',
        rail: 'loop',
        idempotency_key: `idemp_wh_${Date.now()}`,
      });

      // 2. Deliver webhook
      const webhookPayload = {
        eventId: `evt_loop_${Date.now()}`,
        statusCode: 200,
        data: {
          serviceTransactionStatus: 'COMPLETED',
          txnReference: intent.idempotency_key,
          response: {
            status: 'COMPLETED',
            transactionRef: 'TXN-NCBA-987654321',
            amount: '3500.00',
            currency: 'KES',
            fee: '52.50',
            payerMobile: '+254722001122',
            timestamp: new Date().toISOString(),
          },
        },
      };

      const res = await fetch(`${baseUrl}/api/v1/webhooks/loop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer loop_valid_token_123',
        },
        body: JSON.stringify(webhookPayload),
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.status, 'success');
      assert.strictEqual(data.duplicate, false);
      assert.ok(data.transaction_id);

      // 3. Verify payment intent completed
      const updatedIntent = await getPaymentIntentById(intent.id);
      assert.strictEqual(updatedIntent?.status, 'completed');

      // 4. Verify transaction recorded in ledger
      const tx = await getTransactionById(data.transaction_id);
      assert.ok(tx);
      assert.strictEqual(tx.amount, 3500);
      assert.strictEqual(tx.provider, 'loop');
      assert.strictEqual(tx.provider_fee, 52.5);
      assert.strictEqual(tx.net_amount, 3447.5);
      assert.strictEqual(tx.payment_status, 'successful');
      assert.strictEqual(tx.settlement_status, 'pending'); // Independent state machine
    });

    it('deduplicates replayed webhooks: duplicate event does not create duplicate transaction (Handbook M2)', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_dedup_test_' + Date.now(),
        account_type: 'individual',
        display_name: 'Daniel Otieno',
        owner_name: 'Daniel Otieno',
      });

      const intent = await createPaymentIntent({
        recipient_profile_id: prof.id,
        order_reference: 'ORD_DEDUP_001',
        amount: 2000,
        currency: 'KES',
        payer_phone: '+254733445566',
        provider: 'loop',
        rail: 'loop',
        idempotency_key: `idemp_dedup_${Date.now()}`,
      });

      const eventId = `evt_dedup_${Date.now()}`;
      const webhookPayload = {
        eventId,
        statusCode: 200,
        data: {
          serviceTransactionStatus: 'COMPLETED',
          txnReference: intent.idempotency_key,
          response: {
            status: 'COMPLETED',
            transactionRef: 'TXN-DEDUP-12345',
            amount: '2000.00',
            currency: 'KES',
            fee: '30.00',
            payerMobile: '+254733445566',
          },
        },
      };

      // First webhook delivery
      const res1 = await fetch(`${baseUrl}/api/v1/webhooks/loop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_token',
        },
        body: JSON.stringify(webhookPayload),
      });
      assert.strictEqual(res1.status, 200);
      const data1: any = await res1.json();
      assert.strictEqual(data1.duplicate, false);

      // Replay identical webhook with same eventId
      const res2 = await fetch(`${baseUrl}/api/v1/webhooks/loop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_token',
        },
        body: JSON.stringify(webhookPayload),
      });
      assert.strictEqual(res2.status, 200);
      const data2: any = await res2.json();
      assert.strictEqual(data2.duplicate, true);
    });
  });

  describe('4. Payment Rails Configuration & Checkout Options Integration (§9b, §13, §18)', () => {
    let aliasHandle: string;

    beforeEach(async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_checkout_p3_' + Date.now(),
        account_type: 'business',
        display_name: 'Nairobi Fresh Market',
        owner_name: 'Nairobi Fresh Ltd',
      });

      await submitIdentity(prof.id, {
        id_number: '29887766',
        id_document_url: 'https://storage.unipay.ke/docs/business_id.jpg',
      });

      const aliasObj = await createAlias({
        profile_id: prof.id,
        alias: 'freshmarket',
      });
      aliasHandle = aliasObj.alias;
    });

    it('resolves both seeded and loop rails dynamically from payment_rails table', async () => {
      const enabledRails = await getEnabledRailsFor('KES', 'KE', 2000);
      const adapterKeys = enabledRails.map((r) => r.adapter_key);

      assert.ok(adapterKeys.includes('seeded'));
      assert.ok(adapterKeys.includes('loop'));
    });

    it('POST /api/v1/checkout/payment-options calculates fee transparency correctly without rail-specific branching', async () => {
      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: aliasHandle,
          amount: 4000,
          currency: 'KES',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();

      assert.ok(data.provider);
      assert.strictEqual(data.amount, 4000);
      assert.strictEqual(data.currency, 'KES');
      assert.ok(data.estimated_fee > 0);
      assert.strictEqual(
        data.estimated_recipient_amount,
        Number((data.amount - data.estimated_fee).toFixed(2))
      );
      assert.strictEqual(data.recipient.alias, '@freshmarket');
    });

    it('excludes loop rail when disabled in payment_rails config', async () => {
      await setRailEnabled('loop', false);

      const enabledRails = await getEnabledRailsFor('KES', 'KE', 2000);
      const adapterKeys = enabledRails.map((r) => r.adapter_key);
      assert.strictEqual(adapterKeys.includes('loop'), false);
      assert.strictEqual(adapterKeys.includes('seeded'), true);

      // Re-enable
      await setRailEnabled('loop', true);
      const reenabled = await getEnabledRailsFor('KES', 'KE', 2000);
      assert.ok(reenabled.map((r) => r.adapter_key).includes('loop'));
    });
  });

  describe('5. PII Redaction & Security Invariant Checks (§19)', () => {
    it('verifies PII redaction masks phone numbers, emails, and ID credentials in logs', () => {
      const rawLog = {
        message: 'Processing payment for amina@example.com with phone +254712345678',
        payer_phone: '+254704540384',
        payer_email: 'ken@example.co.ke',
        id_number: '12345678',
        id_document_url: 'https://storage.unipay.ke/documents/passport.jpg',
      };

      const redacted: any = redactPII(rawLog);

      assert.strictEqual(redacted.message.includes('amina@example.com'), false);
      assert.strictEqual(redacted.message.includes('+254712345678'), false);
      assert.strictEqual(redacted.id_number, '[REDACTED]');
      assert.strictEqual(redacted.id_document_url, '[REDACTED]');
    });
  });
});
