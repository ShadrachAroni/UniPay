import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { createApp } from '../app';
import { clearProfileCache, createProfile, submitIdentity, reviewIdentity } from '../services/profileService';
import { clearAliasCache, createAlias } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import { clearPaymentIntentCache, updatePaymentIntentStatus } from '../services/paymentIntentService';
import { clearTransactionCache } from '../services/transactionService';
import { resetRailCache } from '../services/paymentRailService';

describe('Phase 7 Verification Test Suite — Checkout UI & Unified Responsive Frontend', () => {
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
    clearPaymentIntentCache();
    clearTransactionCache();
    resetRailCache();
  });

  describe('1. Unauthenticated Checkout Security & Routing Guarantee (§19)', () => {
    it('allows public access to GET /api/v1/aliases/:alias without JWT/Clerk token', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_test_public_checkout',
        account_type: 'business',
        display_name: 'Safari Bakes',
        owner_name: 'Jane Doe',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-99001122',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@safaribakes',
      });

      const res = await fetch(`${baseUrl}/api/v1/aliases/@safaribakes`);
      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.recipient.display_name, 'Safari Bakes');
    });

    it('allows public access to POST /api/v1/checkout/payment-options without auth headers', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_test_fee_check',
        account_type: 'individual',
        display_name: 'Kipchoge Supplies',
        owner_name: 'Eliud Kip',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-55443322',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@kipchoge',
      });

      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: '@kipchoge',
          amount: 5000,
          currency: 'KES',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.amount, 5000);
      assert.strictEqual(typeof data.estimated_fee, 'number');
      assert.strictEqual(typeof data.estimated_recipient_amount, 'number');
    });

    it('allows public access to POST /api/v1/payment-intents and polling GET /api/v1/payment-intents/:id', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_test_public_intent',
        account_type: 'business',
        display_name: 'Nairobi Tech Hub',
        owner_name: 'Tech Owner',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-11223344',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@techhub',
      });

      const idemKey = crypto.randomUUID();
      const res = await fetch(`${baseUrl}/api/v1/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          alias: '@techhub',
          order_reference: 'ORD_TEST_PUB_1',
          amount: 1500,
          currency: 'KES',
          payer_phone: '254711000111',
          idempotency_key: idemKey,
        }),
      });

      assert.strictEqual(res.status, 201);
      const intent: any = await res.json();
      assert.strictEqual(intent.amount, 1500);

      // Verify unauthenticated poll
      const pollRes = await fetch(`${baseUrl}/api/v1/payment-intents/${intent.id}`);
      assert.strictEqual(pollRes.status, 200);
      const polled: any = await pollRes.json();
      assert.strictEqual(polled.id, intent.id);
    });
  });

  describe('2. Alias Resolution Step & Verified Checkmark States (§5)', () => {
    it('returns 404 with structured error when alias does not exist', async () => {
      const res = await fetch(`${baseUrl}/api/v1/aliases/@nonexistent_merchant_999`);
      assert.strictEqual(res.status, 404);
      const data: any = await res.json();
      assert.strictEqual(data.error, 'Not Found');
      assert.ok(data.message.includes('not found'));
    });

    it('distinguishes unverified profile state (verification_status: submitted)', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_unverified_merchant',
        account_type: 'individual',
        display_name: 'Unverified Artisan',
        owner_name: 'Artisan One',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-77889900',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@artisan',
      });

      const res = await fetch(`${baseUrl}/api/v1/aliases/@artisan`);
      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.recipient.display_name, 'Unverified Artisan');
      assert.strictEqual(data.recipient.verification_status, 'submitted');
      assert.strictEqual(data.alias.is_verified, false);
    });

    it('identifies verified profile state (verification_status: approved) for green checkmark badge', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_verified_merchant',
        account_type: 'business',
        display_name: 'M-Verified Boutique',
        owner_name: 'Grace Hopper',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-88990011',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await reviewIdentity(profile.id, {
        decision: 'approved',
        reviewer_note: 'Verified with official registrar',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@boutique',
      });

      const res = await fetch(`${baseUrl}/api/v1/aliases/@boutique`);
      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.recipient.display_name, 'M-Verified Boutique');
      assert.strictEqual(data.recipient.verification_status, 'approved');
      assert.strictEqual(data.alias.is_verified, true);
    });
  });

  describe('3. Fee Transparency & Net Amount Computation (§13)', () => {
    it('returns exact fee breakdown matching Net Amount = Amount - Fee formula without frontend recalculation', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_fee_merchant',
        account_type: 'business',
        display_name: 'Coffee Exchange',
        owner_name: 'Coffee Master',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-33445566',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@coffee',
      });

      const testAmounts = [100, 2500, 10000];

      for (const amount of testAmounts) {
        const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alias: '@coffee',
            amount,
            currency: 'KES',
          }),
        });

        assert.strictEqual(res.status, 200);
        const data: any = await res.json();
        assert.strictEqual(data.amount, amount);
        assert.strictEqual(data.currency, 'KES');
        assert.strictEqual(
          Number((data.amount - data.estimated_fee).toFixed(2)),
          data.estimated_recipient_amount,
          'Net recipient amount must strictly equal Amount - Estimated Fee'
        );
      }
    });

    it('rejects zero or negative amount with validation error (400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: '@coffee',
          amount: -50,
          currency: 'KES',
        }),
      });

      assert.strictEqual(res.status, 400);
      const data: any = await res.json();
      assert.strictEqual(data.error, 'Validation Error');
    });
  });

  describe('4. Idempotency Key Stability & Retry Life Cycle (§12, Task 5)', () => {
    it('reuses identical idempotency key on repeated payment initiation to guarantee no double-charge', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_idempotency_payer',
        account_type: 'business',
        display_name: 'Hardware Hub',
        owner_name: 'Bob Builder',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-44556677',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@hardware',
      });

      const stableIdempotencyKey = crypto.randomUUID();

      // First submission
      const res1 = await fetch(`${baseUrl}/api/v1/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': stableIdempotencyKey,
        },
        body: JSON.stringify({
          alias: '@hardware',
          order_reference: 'ORD_HARDWARE_1',
          amount: 3200,
          currency: 'KES',
          payer_phone: '254722111222',
          idempotency_key: stableIdempotencyKey,
        }),
      });

      assert.strictEqual(res1.status, 201);
      const intent1: any = await res1.json();

      // Re-submission with identical idempotency key (simulating double-tap / retry)
      const res2 = await fetch(`${baseUrl}/api/v1/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': stableIdempotencyKey,
        },
        body: JSON.stringify({
          alias: '@hardware',
          order_reference: 'ORD_HARDWARE_1',
          amount: 3200,
          currency: 'KES',
          payer_phone: '254722111222',
          idempotency_key: stableIdempotencyKey,
        }),
      });

      assert.strictEqual(res2.status, 201);
      const intent2: any = await res2.json();

      assert.strictEqual(intent1.id, intent2.id, 'Idempotency must return the exact same payment intent');
      assert.strictEqual(intent1.idempotency_key, intent2.idempotency_key);
    });

    it('handles status transition from pending to completed via polling loop', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_poll_success',
        account_type: 'individual',
        display_name: 'Fast Courier',
        owner_name: 'Speedy Express',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-22334455',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@courier',
      });

      const idemKey = crypto.randomUUID();
      const res = await fetch(`${baseUrl}/api/v1/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          alias: '@courier',
          order_reference: 'ORD_COURIER_99',
          amount: 450,
          currency: 'KES',
          payer_phone: '254799888777',
          idempotency_key: idemKey,
        }),
      });

      const intent: any = await res.json();
      assert.strictEqual(intent.payment_status || intent.status, 'pending');

      // Update status to simulate LOOP user approval
      await updatePaymentIntentStatus(intent.id, 'completed');

      // Poll endpoint
      const pollRes = await fetch(`${baseUrl}/api/v1/payment-intents/${intent.id}`);
      const updated: any = await pollRes.json();
      assert.strictEqual(updated.payment_status || updated.status, 'completed');
    });

    it('handles retry endpoint POST /api/v1/payment-intents/:id/retry upon failed status', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_retry_flow',
        account_type: 'individual',
        display_name: 'City Pharmacy',
        owner_name: 'Doc Care',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-66778899',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@pharmacy',
      });

      const idemKey = crypto.randomUUID();
      const res = await fetch(`${baseUrl}/api/v1/payment-intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          alias: '@pharmacy',
          order_reference: 'ORD_PHARM_01',
          amount: 1800,
          currency: 'KES',
          idempotency_key: idemKey,
        }),
      });

      const intent: any = await res.json();
      await updatePaymentIntentStatus(intent.id, 'failed');

      // Payer hits Retry
      const retryRes = await fetch(`${baseUrl}/api/v1/payment-intents/${intent.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      assert.strictEqual(retryRes.status, 200);
      const retried: any = await retryRes.json();
      assert.strictEqual(retried.id, intent.id);
    });
  });

  describe('5. Link & QR Code Entry Point Equivalence (§20)', () => {
    it('resolves both @alias (standard) and alias (without @ prefix) to identical recipient profile', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_qr_link_equiv',
        account_type: 'business',
        display_name: 'Savannah Tours',
        owner_name: 'Guide Ken',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-12345678',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await createAlias({
        profile_id: profile.id,
        alias: '@savannah',
      });

      // Query with @
      const resWithAt = await fetch(`${baseUrl}/api/v1/aliases/@savannah`);
      const dataWithAt: any = await resWithAt.json();

      // Query without @ (as might be extracted from a bare URL or QR payload)
      const resWithoutAt = await fetch(`${baseUrl}/api/v1/aliases/savannah`);
      const dataWithoutAt: any = await resWithoutAt.json();

      assert.strictEqual(resWithAt.status, 200);
      assert.strictEqual(resWithoutAt.status, 200);
      assert.strictEqual(dataWithAt.recipient.profile_id, dataWithoutAt.recipient.profile_id);
      assert.strictEqual(dataWithAt.recipient.display_name, 'Savannah Tours');
      assert.strictEqual(dataWithoutAt.recipient.display_name, 'Savannah Tours');
    });
  });
});
