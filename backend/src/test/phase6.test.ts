import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { clearProfileCache, createProfile } from '../services/profileService';
import { clearAliasCache } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import {
  clearMoneyDirectionCache,
  setMoneyDirectionRules,
} from '../services/moneyDirectionService';
import {
  recordTransaction,
  settleTransaction,
  clearTransactionCache,
} from '../services/transactionService';
import {
  calculateProfileBalance,
  createPayout,
  getPayoutById,
  listPayouts,
  clearPayoutCache,
} from '../services/payoutService';
import { LoopAdapter } from '../adapters/loop-adapter';
import { ResilientAdapterWrapper } from '../adapters/resilient-adapter-wrapper';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import { NormalizedTransaction } from '@unipay/shared';

describe('Phase 6 Verification Test Suite — Disbursement & Payout Orchestration', () => {
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
    clearMoneyDirectionCache();
    clearTransactionCache();
    clearPayoutCache();
    // Reset loop adapter failure simulation if any
    const loopAdapter = defaultAdapterRegistry.get('loop') as any;
    if (loopAdapter?.reset) {
      loopAdapter.reset();
    }
  });

  describe('1. LOOP Adapter disburse() & Resilient Circuit Breaker Wrapping (§10, §12)', () => {
    it('executes disburse() on LoopAdapter returning a correctly-shaped ProviderPayoutResult', async () => {
      const adapter = new LoopAdapter();
      const result = await adapter.disburse({
        recipientIdentifier: '+254704540384',
        amount: 2500,
        currency: 'KES',
        idempotencyKey: 'test_loop_disb_001',
        remarks: 'Merchant Settlement',
      });

      assert.ok(result.disbursementReference);
      assert.ok(result.disbursementReference.startsWith('LOOP_DISB_') || result.disbursementReference.length > 5);
      assert.strictEqual(result.status, 'completed');
      assert.ok(result.rawResponse);
    });

    it('rejects disburse() on LoopAdapter for unsupported currencies or missing recipient', async () => {
      const adapter = new LoopAdapter();
      await assert.rejects(async () => {
        await adapter.disburse({
          recipientIdentifier: '+254704540384',
          amount: 100,
          currency: 'USD',
          idempotencyKey: 'test_usd_err',
        });
      }, /Unsupported currency/);

      await assert.rejects(async () => {
        await adapter.disburse({
          recipientIdentifier: '',
          amount: 100,
          currency: 'KES',
          idempotencyKey: 'test_no_recip',
        });
      }, /Recipient mobile number or account identifier is required/);
    });

    it('engages circuit breaker around disburse() upon repeated simulated failures', async () => {
      const baseAdapter = new LoopAdapter();
      const resilientWrapper = new ResilientAdapterWrapper(baseAdapter, {
        circuitBreaker: {
          failureThreshold: 2,
          cooldownMs: 1000,
        },
        retry: {
          maxRetries: 0,
        },
      });

      baseAdapter.setSimulateFailure(true, 'Simulated upstream LOOP gateway error');

      // First failure
      await assert.rejects(async () => {
        await resilientWrapper.disburse({
          recipientIdentifier: '+254704540384',
          amount: 500,
          currency: 'KES',
          idempotencyKey: 'test_breaker_1',
        });
      }, /Simulated upstream LOOP gateway error/);

      // Second failure trips circuit breaker
      await assert.rejects(async () => {
        await resilientWrapper.disburse({
          recipientIdentifier: '+254704540384',
          amount: 500,
          currency: 'KES',
          idempotencyKey: 'test_breaker_2',
        });
      }, /Simulated upstream LOOP gateway error/);

      // Breaker should now be OPEN and fast-fail
      assert.strictEqual(resilientWrapper.getCircuitBreaker().getState(), 'OPEN');

      await assert.rejects(async () => {
        await resilientWrapper.disburse({
          recipientIdentifier: '+254704540384',
          amount: 500,
          currency: 'KES',
          idempotencyKey: 'test_breaker_3',
        });
      }, /Circuit breaker is OPEN/);
    });
  });

  describe('2. Available-to-Withdraw Balance Calculation Service (§11, §18, Task 3)', () => {
    it('calculates available and ledger balance against settled transactions and mixed payout statuses', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_bal_test_1',
        account_type: 'business',
        display_name: 'Amina Electronics',
        owner_name: 'Amina Electronics Ltd',
        phone: '+254704540384',
      });

      // 1. Initial balance should be zero
      let bal = await calculateProfileBalance(prof.id);
      assert.strictEqual(bal.available_balance, 0);
      assert.strictEqual(bal.ledger_balance, 0);
      assert.strictEqual(bal.total_settled, 0);

      // 2. Add a pending transaction (not yet settled)
      const tx1: NormalizedTransaction = {
        provider: 'loop',
        rail: 'loop',
        internal_reference: 'INT_TX_PEND_01',
        external_reference: 'EXT_TX_PEND_01',
        amount: 5000,
        currency: 'KES',
        provider_fee: 75,
        net_amount: 4925,
        payer_identifier: '+254711111111',
        payment_status: 'initiated',
        settlement_status: 'pending',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      await recordTransaction(tx1, prof.id);

      bal = await calculateProfileBalance(prof.id);
      assert.strictEqual(bal.available_balance, 0, 'Pending transaction should not count towards available balance');

      // 3. Add settled transaction of net 9850 KES (10,000 gross - 150 fee)
      const tx2: NormalizedTransaction = {
        provider: 'loop',
        rail: 'loop',
        internal_reference: 'INT_TX_SETT_01',
        external_reference: 'EXT_TX_SETT_01',
        amount: 10000,
        currency: 'KES',
        provider_fee: 150,
        net_amount: 9850,
        payer_identifier: '+254722222222',
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      await recordTransaction(tx2, prof.id);

      bal = await calculateProfileBalance(prof.id);
      assert.strictEqual(bal.available_balance, 9850);
      assert.strictEqual(bal.ledger_balance, 9850);
      assert.strictEqual(bal.total_settled, 9850);

      // 4. Create a completed payout of 3000 KES
      await createPayout({
        profile_id: prof.id,
        amount: 3000,
        currency: 'KES',
        idempotency_key: 'idem_payout_bal_01',
      });

      bal = await calculateProfileBalance(prof.id);
      assert.strictEqual(bal.available_balance, 6850);
      assert.strictEqual(bal.total_payouts, 3000);
      assert.strictEqual(bal.ledger_balance, 9850);

      // 5. Create a manual payout of 2000 KES
      await createPayout({
        profile_id: prof.id,
        amount: 2000,
        currency: 'KES',
        idempotency_key: 'idem_payout_bal_02',
      });

      bal = await calculateProfileBalance(prof.id);
      assert.strictEqual(bal.available_balance, 4850);
      assert.strictEqual(bal.total_payouts, 5000);
    });
  });

  describe('3. Automatic Disbursement Orchestration on Settlement Transition (§12, §17)', () => {
    it('creates exactly one payout row and calls disburse() when money direction routes to LOOP number', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_auto_disb_1',
        account_type: 'individual',
        display_name: 'David Kimani',
        owner_name: 'David Kimani',
        phone: '+254722998877',
      });

      // Configure rules: 70% to LOOP linked phone number, 30% left in UniPay balance
      await setMoneyDirectionRules(prof.id, [
        {
          destination_type: 'loop_number',
          allocation_type: 'percentage',
          allocation_value: 70,
          priority_order: 1,
          is_active: true,
        },
        {
          destination_type: 'balance',
          allocation_type: 'full',
          priority_order: 2,
          is_active: true,
        },
      ]);

      // Settle a transaction of net 10,000 KES
      const tx: NormalizedTransaction = {
        provider: 'loop',
        rail: 'loop',
        internal_reference: 'INT_TX_AUTO_01',
        external_reference: 'EXT_TX_AUTO_01',
        amount: 10000,
        currency: 'KES',
        provider_fee: 0,
        net_amount: 10000,
        payer_identifier: '+254733333333',
        payment_status: 'successful',
        settlement_status: 'pending',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      const recorded = await recordTransaction(tx, prof.id);

      // Now settle it — this fires onSettlementTransition -> evaluateMoneyDirection -> processAutomaticDisbursements
      await settleTransaction(recorded.id);

      // Verify payouts table
      const payouts = await listPayouts({ profile_id: prof.id });
      assert.strictEqual(payouts.length, 1, 'Exactly one payout row should be created for the 70% allocation');
      assert.strictEqual(payouts[0].requested_amount, 7000);
      assert.strictEqual(payouts[0].destination_type, 'loop_number');
      assert.strictEqual(payouts[0].destination_reference, '+254722998877');
      assert.strictEqual(payouts[0].status, 'completed');
      assert.ok(payouts[0].provider_reference);

      // Verify remaining available balance is 3,000 KES
      const bal = await calculateProfileBalance(prof.id);
      assert.strictEqual(bal.total_settled, 10000);
      assert.strictEqual(bal.total_payouts, 7000);
      assert.strictEqual(bal.available_balance, 3000);
    });

    it('does not create any payout row when money direction allocates 100% to balance', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_auto_bal_1',
        account_type: 'individual',
        display_name: 'Grace Hopper',
        owner_name: 'Grace Hopper',
        phone: '+254700112233',
      });

      // No custom rules = default 100% balance
      const tx: NormalizedTransaction = {
        provider: 'loop',
        rail: 'loop',
        internal_reference: 'INT_TX_DEF_BAL',
        external_reference: 'EXT_TX_DEF_BAL',
        amount: 4000,
        currency: 'KES',
        provider_fee: 0,
        net_amount: 4000,
        payer_identifier: '+254744444444',
        payment_status: 'successful',
        settlement_status: 'settled',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };
      await recordTransaction(tx, prof.id);

      const payouts = await listPayouts({ profile_id: prof.id });
      assert.strictEqual(payouts.length, 0, 'No payouts should be created when 100% goes to balance');

      const bal = await calculateProfileBalance(prof.id);
      assert.strictEqual(bal.available_balance, 4000);
    });
  });

  describe('4. Manual Disbursement (POST /payouts) & Idempotency (§12, §18)', () => {
    it('enforces available balance ceiling and rejects payout requests above balance', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_man_payout_1',
        account_type: 'business',
        display_name: 'TechMart',
        owner_name: 'TechMart Ltd',
        phone: '+254711223344',
      });

      // Give 5000 KES settled balance
      await recordTransaction(
        {
          provider: 'loop',
          rail: 'loop',
          internal_reference: 'INT_TX_TM_01',
          external_reference: 'EXT_TX_TM_01',
          amount: 5000,
          currency: 'KES',
          provider_fee: 0,
          net_amount: 5000,
          payer_identifier: '+254755555555',
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        prof.id
      );

      // Attempt to withdraw 6000 KES (exceeds balance)
      await assert.rejects(async () => {
        await createPayout({
          profile_id: prof.id,
          amount: 6000,
          currency: 'KES',
          idempotency_key: 'idem_overdraw_001',
        });
      }, /exceeds available balance/);

      // Successfully withdraw 4000 KES
      const payout = await createPayout({
        profile_id: prof.id,
        amount: 4000,
        currency: 'KES',
        idempotency_key: 'idem_valid_withdraw_001',
      });

      assert.strictEqual(payout.requested_amount, 4000);
      assert.strictEqual(payout.status, 'completed');

      // Remaining available balance is 1000 KES
      const bal = await calculateProfileBalance(prof.id);
      assert.strictEqual(bal.available_balance, 1000);
    });

    it('deduplicates manual payout on idempotency key without double-disbursing', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_idem_payout',
        account_type: 'individual',
        display_name: 'Alice Wambui',
        owner_name: 'Alice Wambui',
        phone: '+254788990011',
      });

      await recordTransaction(
        {
          provider: 'loop',
          rail: 'loop',
          internal_reference: 'INT_TX_AW_01',
          external_reference: 'EXT_TX_AW_01',
          amount: 8000,
          currency: 'KES',
          provider_fee: 0,
          net_amount: 8000,
          payer_identifier: '+254766666666',
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        prof.id
      );

      const key = 'withdraw_tap_retry_key_001';

      // First call
      const p1 = await createPayout({
        profile_id: prof.id,
        amount: 3000,
        currency: 'KES',
        idempotency_key: key,
      });

      // Second call with same idempotency key
      const p2 = await createPayout({
        profile_id: prof.id,
        amount: 3000,
        currency: 'KES',
        idempotency_key: key,
      });

      assert.strictEqual(p1.id, p2.id);
      assert.strictEqual(p1.provider_reference, p2.provider_reference);

      // Ensure total payouts is exactly 3,000 (not 6,000)
      const bal = await calculateProfileBalance(prof.id);
      assert.strictEqual(bal.available_balance, 5000);
      assert.strictEqual(bal.total_payouts, 3000);
    });
  });

  describe('5. Live REST API Endpoints & Ownership Enforcement (§18)', () => {
    it('GET /api/v1/profiles/:id/balance returns balance for authenticated owner', async () => {
      const ownerClerkId = 'test_clerk_owner_bal_' + Date.now();
      const prof = await createProfile({
        clerk_user_id: ownerClerkId,
        account_type: 'business',
        display_name: 'Nairobi Kiosk',
        owner_name: 'Nairobi Kiosk Ltd',
        phone: '+254704540384',
      });

      await recordTransaction(
        {
          provider: 'loop',
          rail: 'loop',
          internal_reference: 'INT_TX_REST_BAL_01',
          external_reference: 'EXT_TX_REST_BAL_01',
          amount: 12000,
          currency: 'KES',
          provider_fee: 180,
          net_amount: 11820,
          payer_identifier: '+254777777777',
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        prof.id
      );

      const res = await fetch(`${baseUrl}/api/v1/profiles/${prof.id}/balance`, {
        headers: {
          Authorization: `Bearer ${ownerClerkId}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.strictEqual(data.profile_id, prof.id);
      assert.strictEqual(data.available_balance, 11820);
      assert.strictEqual(data.ledger_balance, 11820);
    });

    it('GET /api/v1/profiles/:id/balance returns 403 Forbidden when accessed by non-owner, and 401 when unauthenticated', async () => {
      const ownerClerkId = 'test_clerk_owner_bal_1_' + Date.now();
      const otherClerkId = 'test_clerk_other_bal_2_' + Date.now();

      const prof = await createProfile({
        clerk_user_id: ownerClerkId,
        account_type: 'individual',
        display_name: 'Private Profile',
        owner_name: 'Private Owner',
      });

      // 403 Forbidden
      const res = await fetch(`${baseUrl}/api/v1/profiles/${prof.id}/balance`, {
        headers: {
          Authorization: `Bearer ${otherClerkId}`,
        },
      });
      assert.strictEqual(res.status, 403);

      // 401 Unauthorized
      const unauthRes = await fetch(`${baseUrl}/api/v1/profiles/${prof.id}/balance`);
      assert.strictEqual(unauthRes.status, 401);
    });

    it('POST /api/v1/payouts creates payout and enforces balance check via REST', async () => {
      const ownerClerkId = 'test_clerk_payout_owner_' + Date.now();
      const prof = await createProfile({
        clerk_user_id: ownerClerkId,
        account_type: 'business',
        display_name: 'Mama Mboga',
        owner_name: 'Mama Mboga',
        phone: '+254722334455',
      });

      await recordTransaction(
        {
          provider: 'loop',
          rail: 'loop',
          internal_reference: 'INT_TX_MM_01',
          external_reference: 'EXT_TX_MM_01',
          amount: 6000,
          currency: 'KES',
          provider_fee: 0,
          net_amount: 6000,
          payer_identifier: '+254788888888',
          payment_status: 'successful',
          settlement_status: 'settled',
          refund_status: 'none',
          transaction_time: new Date().toISOString(),
          raw_payload: {},
        },
        prof.id
      );

      // 1. Rejection when overdrawn
      const badRes = await fetch(`${baseUrl}/api/v1/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerClerkId}`,
        },
        body: JSON.stringify({
          profile_id: prof.id,
          amount: 7000,
          idempotency_key: 'rest_payout_overdraw',
        }),
      });

      assert.strictEqual(badRes.status, 400);
      const badData = (await badRes.json()) as any;
      assert.ok(badData.message?.includes('exceeds available balance'));

      // 2. Successful payout
      const goodRes = await fetch(`${baseUrl}/api/v1/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerClerkId}`,
        },
        body: JSON.stringify({
          profile_id: prof.id,
          amount: 2500,
          idempotency_key: 'rest_payout_good_01',
          destination_type: 'loop_number',
          destination_reference: '+254722334455',
        }),
      });

      assert.strictEqual(goodRes.status, 201);
      const goodData = (await goodRes.json()) as any;
      assert.ok(goodData.payout);
      assert.strictEqual(goodData.payout.requested_amount, 2500);
      assert.strictEqual(goodData.payout.status, 'completed');
      assert.ok(goodData.payout.provider_reference);

      // 3. GET /api/v1/payouts/:id
      const payoutId = goodData.payout.id;
      const getRes = await fetch(`${baseUrl}/api/v1/payouts/${payoutId}`, {
        headers: {
          Authorization: `Bearer ${ownerClerkId}`,
        },
      });

      assert.strictEqual(getRes.status, 200);
      const getData = (await getRes.json()) as any;
      assert.strictEqual(getData.payout.id, payoutId);
      assert.strictEqual(getData.payout.requested_amount, 2500);

      // 4. GET /api/v1/payouts list
      const listRes = await fetch(`${baseUrl}/api/v1/payouts?profile_id=${prof.id}`, {
        headers: {
          Authorization: `Bearer ${ownerClerkId}`,
        },
      });

      assert.strictEqual(listRes.status, 200);
      const listData = (await listRes.json()) as any;
      assert.strictEqual(listData.payouts.length, 1);
      assert.strictEqual(listData.payouts[0].id, payoutId);
    });

    it('POST /api/v1/payouts returns 403 when trying to disburse from another user profile', async () => {
      const ownerClerkId = 'test_clerk_real_owner_' + Date.now();
      const thiefClerkId = 'test_clerk_attacker_' + Date.now();

      const prof = await createProfile({
        clerk_user_id: ownerClerkId,
        account_type: 'individual',
        display_name: 'Target Profile',
        owner_name: 'Target Owner',
      });

      const res = await fetch(`${baseUrl}/api/v1/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${thiefClerkId}`,
        },
        body: JSON.stringify({
          profile_id: prof.id,
          amount: 500,
          idempotency_key: 'rest_thief_attempt',
        }),
      });

      assert.strictEqual(res.status, 403);
    });
  });
});
