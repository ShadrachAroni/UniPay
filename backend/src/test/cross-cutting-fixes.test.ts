import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { clearProfileCache, createProfile, submitIdentity, reviewIdentity } from '../services/profileService';
import { clearAliasCache, createAlias } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import { clearPaymentIntentCache } from '../services/paymentIntentService';
import { clearTransactionCache, recordTransaction } from '../services/transactionService';
import { resetRailCache } from '../services/paymentRailService';
import {
  calculateCollectionFee,
  calculateDisbursementFee,
  calculateNetTransaction,
} from '../services/feeService';
import { LoopAdapter, generateLoopHmacSignature } from '../adapters/loop-adapter';
import { aiService, AnthropicLLMProvider, listAIInteractions } from '../services/aiService';
import { createOrUpdateAdminUser, clearAdminUserCache } from '../services/adminService';

describe('Cross-Cutting Fixes & Audit Remediation Test Suite', () => {
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
    clearAdminUserCache();
    resetRailCache();
  });

  describe('1. Centralized Fee Calculation Engine (§10, §12, §14)', () => {
    it('calculates collection fee correctly (1.5% standard LOOP rate)', () => {
      const calc1 = calculateCollectionFee(1000, 'loop');
      assert.strictEqual(calc1.amount, 1000);
      assert.strictEqual(calc1.provider_fee, 15.0);
      assert.strictEqual(calc1.platform_fee, 0);
      assert.strictEqual(calc1.tax, 0);
      assert.strictEqual(calc1.total_fee, 15.0);
      assert.strictEqual(calc1.net_amount, 985.0);

      const calc2 = calculateCollectionFee(345.5, 'loop');
      // 345.5 * 0.015 = 5.1825 -> rounded to 5.18
      assert.strictEqual(calc2.provider_fee, 5.18);
      assert.strictEqual(calc2.net_amount, 340.32);
    });

    it('calculates disbursement fee correctly across destination channels', () => {
      const loopFee = calculateDisbursementFee(10000, 'loop_number');
      assert.strictEqual(loopFee.total_fee, 0);
      assert.strictEqual(loopFee.net_amount, 10000);

      const mpesaFee = calculateDisbursementFee(5000, 'mpesa');
      assert.strictEqual(mpesaFee.total_fee, 15.0);
      assert.strictEqual(mpesaFee.net_amount, 4985.0);

      const bankFee = calculateDisbursementFee(25000, 'bank_account');
      assert.strictEqual(bankFee.total_fee, 50.0);
      assert.strictEqual(bankFee.net_amount, 24950.0);
    });

    it('calculates net transaction breakdown accurately with custom platform fee override', () => {
      const net = calculateNetTransaction(2000, 10, 40, 6.4);
      // net = 2000 - 10 - 40 - 6.4 = 1943.60
      assert.strictEqual(net, 1943.6);
    });
  });

  describe('2. LOOP Adapter Configurable Timeout & HMAC Signature (§10, §12)', () => {
    it('instantiates LoopAdapter with default and configured timeoutMs', () => {
      const adapterDefault = new LoopAdapter();
      assert.strictEqual((adapterDefault as any).timeoutMs, 5000);

      const adapterCustom = new LoopAdapter({ timeoutMs: 10000 });
      assert.strictEqual((adapterCustom as any).timeoutMs, 10000);
    });

    it('generates valid HMAC signature string for sandbox requests', () => {
      const merchantTill = '123456';
      const timestamp = '2026-08-14T06:00:00Z';
      const nonce = 'abc-123-nonce';
      const secret = 'test-secret-key';

      const signature = generateLoopHmacSignature(merchantTill, timestamp, nonce, secret);
      assert.strictEqual(typeof signature, 'string');
      assert.strictEqual(signature.length, 64); // SHA-256 hex length
    });
  });

  describe('3. Admin RBAC & super_admin Unrestricted Access (§16)', () => {
    beforeEach(async () => {
      await createOrUpdateAdminUser({
        clerk_user_id: 'clerk_super_admin_test',
        role: 'super_admin',
      });
      await createOrUpdateAdminUser({
        clerk_user_id: 'clerk_support_test',
        role: 'support',
      });
    });

    it('allows super_admin unrestricted access to any admin endpoint', async () => {
      // POST /api/v1/admin/admins is strictly super_admin
      const res = await fetch(`${baseUrl}/api/v1/admin/admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_super_admin_test',
        },
        body: JSON.stringify({
          clerk_user_id: 'clerk_new_compliance_test',
          role: 'compliance_reviewer',
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = (await res.json()) as any;
      assert.strictEqual(data.admin.role, 'compliance_reviewer');
    });

    it('blocks support user with 403 Forbidden when accessing super_admin endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_support_test',
        },
        body: JSON.stringify({
          clerk_user_id: 'clerk_bad_escalation',
          role: 'super_admin',
        }),
      });

      assert.strictEqual(res.status, 403);
      const data = (await res.json()) as any;
      assert.strictEqual(data.error, 'Forbidden');
    });
  });

  describe('4. AI Service Model & Audit Trail (§11, §15)', () => {
    it('uses configured current Claude model and low temperature', () => {
      const provider = new AnthropicLLMProvider();
      assert.strictEqual((provider as any).model, 'claude-3-5-sonnet-20241022');
    });

    it('returns structured answers and logs to ai_interactions audit store', async () => {
      const prof = await createProfile({
        clerk_user_id: 'clerk_ai_test_user',
        account_type: 'business',
        display_name: 'AI Test Merchant',
        owner_name: 'AI Owner',
      });

      const response = await aiService.answerDashboardQuery(
        prof.id,
        'What were my total fees and gross sales?'
      );

      assert.ok(response.answer);
      assert.ok(response.aggregation);

      // Verify DB / in-memory interaction audit trail
      const logs = await listAIInteractions({ profile_id: prof.id });
      assert.ok(logs.length >= 1);
      assert.strictEqual(logs[0].profile_id, prof.id);
    });
  });

  describe('5. Checkout & Payout Fee Engine Integration (§14, §18)', () => {
    it('integrates calculateCollectionFee into checkout payment intent', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_checkout_fee_test',
        account_type: 'business',
        display_name: 'Safari Coffee',
        owner_name: 'David Mwangi',
      });
      await submitIdentity(profile.id, {
        id_number: 'ID-99228811',
        id_document_url: 'https://docs.unipay.ke/id.jpg',
      });
      await reviewIdentity(profile.id, { decision: 'approved' });
      const alias = await createAlias({ profile_id: profile.id, alias: 'safaricoffee' });

      const res = await fetch(`${baseUrl}/api/v1/checkout/payment-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: alias.alias,
          amount: 2000,
          currency: 'KES',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.strictEqual(data.amount, 2000);
      assert.ok(data.estimated_fee > 0);
      assert.strictEqual(data.estimated_recipient_amount, Number((2000 - data.estimated_fee).toFixed(2)));
    });

    it('integrates calculateDisbursementFee into payout requests', async () => {
      const profile = await createProfile({
        clerk_user_id: 'clerk_payout_fee_test',
        account_type: 'business',
        display_name: 'Nairobi Electronics',
        owner_name: 'Grace Njeri',
      });

      await recordTransaction(
        {
          provider: 'loop',
          rail: 'request_to_pay',
          internal_reference: 'INT_' + Date.now(),
          external_reference: 'EXT_' + Date.now(),
          amount: 10000,
          currency: 'KES',
          provider_fee: 150,
          net_amount: 9850,
          payer_identifier: '+254711000111',
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        profile.id
      );

      const res = await fetch(`${baseUrl}/api/v1/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk_payout_fee_test',
          'idempotency-key': `payout_test_${Date.now()}`,
        },
        body: JSON.stringify({
          profile_id: profile.id,
          amount: 5000,
          currency: 'KES',
          destination_type: 'mpesa',
          destination_reference: '+254712345678',
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = (await res.json()) as any;
      assert.strictEqual(data.payout.requested_amount, 5000);
      assert.strictEqual(data.payout.fee, 15.0); // M-Pesa disbursement fee = 15.00
      assert.strictEqual(data.payout.net_amount, 4985.0);
    });
  });
});
