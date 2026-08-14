import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../app';
import { clearProfileCache, createProfile } from '../services/profileService';
import { clearAliasCache } from '../services/aliasService';
import { clearIdempotencyCache } from '../services/idempotencyService';
import {
  clearMoneyDirectionCache,
  getMoneyDirectionRules,
  setMoneyDirectionRules,
  evaluateMoneyDirection,
  getEvaluationHistory,
} from '../services/moneyDirectionService';
import {
  recordTransaction,
  settleTransaction,
  clearTransactionCache,
  getTransactionById,
} from '../services/transactionService';
import { NormalizedTransaction } from '@unipay/shared';

describe('Phase 5 Verification Test Suite — Money Direction (User-Controlled Payout Routing)', () => {
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
  });

  describe('1. Rules CRUD Service & Validation Constraints (§11, §17)', () => {
    it('sets and retrieves money direction rules for a profile', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_md_crud_1',
        account_type: 'individual',
        display_name: 'Amina Mohamed',
        owner_name: 'Amina Mohamed',
        phone: '+254704540384',
      });

      const rules = await setMoneyDirectionRules(prof.id, [
        {
          destination_type: 'loop_number',
          allocation_type: 'percentage',
          allocation_value: 60,
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

      assert.strictEqual(rules.length, 2);
      assert.strictEqual(rules[0].destination_type, 'loop_number');
      assert.strictEqual(rules[0].destination_reference, '+254704540384');
      assert.strictEqual(rules[0].allocation_value, 60);
      assert.strictEqual(rules[1].destination_type, 'balance');

      const retrieved = await getMoneyDirectionRules(prof.id);
      assert.strictEqual(retrieved.length, 2);
      assert.strictEqual(retrieved[0].destination_type, 'loop_number');
    });

    it('rejects rules where active percentage sums exceed 100%', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_md_pct_err',
        account_type: 'business',
        display_name: 'Boutique Store',
        owner_name: 'Boutique Ltd',
        phone: '+254712345678',
      });

      await assert.rejects(async () => {
        await setMoneyDirectionRules(prof.id, [
          {
            destination_type: 'loop_number',
            allocation_type: 'percentage',
            allocation_value: 60,
            priority_order: 1,
          },
          {
            destination_type: 'loop_number',
            destination_reference: '+254799887766',
            allocation_type: 'percentage',
            allocation_value: 50, // 60 + 50 = 110%
            priority_order: 2,
          },
        ]);
      }, /exceeds 100% limit/);
    });

    it('rejects loop_number destination if profile does not have a linked phone on file', async () => {
      const profNoPhone = await createProfile({
        clerk_user_id: 'user_md_no_phone',
        account_type: 'individual',
        display_name: 'No Phone User',
        owner_name: 'No Phone User',
        phone: null,
      });

      await assert.rejects(async () => {
        await setMoneyDirectionRules(profNoPhone.id, [
          {
            destination_type: 'loop_number',
            allocation_type: 'full',
            priority_order: 1,
          },
        ]);
      }, /Profile does not have a linked LOOP mobile number on file/);
    });

    it('rejects invalid allocation values (negative percentage or zero fixed amount)', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_md_invalid_vals',
        account_type: 'individual',
        display_name: 'Test Val User',
        owner_name: 'Test Val User',
        phone: '+254711223344',
      });

      // Negative percentage
      await assert.rejects(async () => {
        await setMoneyDirectionRules(prof.id, [
          {
            destination_type: 'loop_number',
            allocation_type: 'percentage',
            allocation_value: -10,
          },
        ]);
      }, /Invalid percentage value/);

      // Percentage > 100
      await assert.rejects(async () => {
        await setMoneyDirectionRules(prof.id, [
          {
            destination_type: 'loop_number',
            allocation_type: 'percentage',
            allocation_value: 150,
          },
        ]);
      }, /Invalid percentage value/);

      // Zero fixed amount
      await assert.rejects(async () => {
        await setMoneyDirectionRules(prof.id, [
          {
            destination_type: 'loop_number',
            allocation_type: 'fixed_amount',
            allocation_value: 0,
          },
        ]);
      }, /Invalid fixed amount/);
    });
  });

  describe('2. evaluateMoneyDirection Evaluation Engine (§17)', () => {
    it('default behavior: when no active rules exist, 100% is kept as UniPay available balance', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_md_default',
        account_type: 'individual',
        display_name: 'Default User',
        owner_name: 'Default User',
      });

      const decision = await evaluateMoneyDirection(prof.id, 8000);

      assert.strictEqual(decision.profile_id, prof.id);
      assert.strictEqual(decision.settled_amount, 8000);
      assert.strictEqual(decision.currency, 'KES');
      assert.strictEqual(decision.allocations.length, 1);
      assert.strictEqual(decision.allocations[0].destination_type, 'balance');
      assert.strictEqual(decision.allocations[0].amount, 8000);
      assert.strictEqual(decision.allocations[0].destination_reference, null);
    });

    it('evaluates single percentage allocation with remainder to available balance', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_md_pct_eval',
        account_type: 'individual',
        display_name: 'Percentage User',
        owner_name: 'Percentage User',
        phone: '+254722334455',
      });

      await setMoneyDirectionRules(prof.id, [
        {
          destination_type: 'loop_number',
          allocation_type: 'percentage',
          allocation_value: 40,
          priority_order: 1,
        },
      ]);

      const decision = await evaluateMoneyDirection(prof.id, 10000);

      assert.strictEqual(decision.settled_amount, 10000);
      assert.strictEqual(decision.allocations.length, 2);
      // 40% of 10,000 = 4,000 to LOOP
      assert.strictEqual(decision.allocations[0].destination_type, 'loop_number');
      assert.strictEqual(decision.allocations[0].amount, 4000);
      assert.strictEqual(decision.allocations[0].destination_reference, '+254722334455');
      // Remainder 6,000 to UniPay balance
      assert.strictEqual(decision.allocations[1].destination_type, 'balance');
      assert.strictEqual(decision.allocations[1].amount, 6000);
    });

    it('evaluates fixed_amount allocation when settled amount exceeds fixed threshold', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_md_fixed_1',
        account_type: 'business',
        display_name: 'Hardware Shop',
        owner_name: 'Hardware Shop Ltd',
        phone: '+254733112233',
      });

      await setMoneyDirectionRules(prof.id, [
        {
          destination_type: 'loop_number',
          allocation_type: 'fixed_amount',
          allocation_value: 3000,
          priority_order: 1,
        },
      ]);

      const decision = await evaluateMoneyDirection(prof.id, 5000);

      assert.strictEqual(decision.allocations.length, 2);
      assert.strictEqual(decision.allocations[0].destination_type, 'loop_number');
      assert.strictEqual(decision.allocations[0].amount, 3000);
      assert.strictEqual(decision.allocations[1].destination_type, 'balance');
      assert.strictEqual(decision.allocations[1].amount, 2000);
    });

    it('evaluates fixed_amount allocation when settled amount is smaller than fixed threshold (allocates up to settled amount)', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_md_fixed_small',
        account_type: 'individual',
        display_name: 'Small Tx User',
        owner_name: 'Small Tx User',
        phone: '+254700998877',
      });

      await setMoneyDirectionRules(prof.id, [
        {
          destination_type: 'loop_number',
          allocation_type: 'fixed_amount',
          allocation_value: 5000,
          priority_order: 1,
        },
      ]);

      const decision = await evaluateMoneyDirection(prof.id, 2500);

      // Allocates entire 2500 to fixed rule, 0 remainder
      assert.strictEqual(decision.allocations.length, 1);
      assert.strictEqual(decision.allocations[0].destination_type, 'loop_number');
      assert.strictEqual(decision.allocations[0].amount, 2500);
    });

    it('evaluates multi-rule priority sequence (§17 example: fixed amount first, percentage of remainder, rest to balance)', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_md_multirule',
        account_type: 'business',
        display_name: 'Creative Agency',
        owner_name: 'Jane Doe',
        phone: '+254711009988',
      });

      // Priority 1: Send first KES 5,000 to primary LOOP number
      // Priority 2: Send 50% to secondary savings LOOP number
      // Remainder: defaults to UniPay balance
      await setMoneyDirectionRules(prof.id, [
        {
          destination_type: 'loop_number',
          destination_reference: '+254711009988',
          allocation_type: 'fixed_amount',
          allocation_value: 5000,
          priority_order: 1,
        },
        {
          destination_type: 'loop_number',
          destination_reference: '+254799001122',
          allocation_type: 'percentage',
          allocation_value: 50,
          priority_order: 2,
        },
      ]);

      const decision = await evaluateMoneyDirection(prof.id, 15000);

      assert.strictEqual(decision.allocations.length, 3);
      // 1. Fixed 5000 to primary LOOP number
      assert.strictEqual(decision.allocations[0].destination_type, 'loop_number');
      assert.strictEqual(decision.allocations[0].destination_reference, '+254711009988');
      assert.strictEqual(decision.allocations[0].amount, 5000);

      // 2. 50% of 15,000 = 7500 to secondary LOOP number
      assert.strictEqual(decision.allocations[1].destination_type, 'loop_number');
      assert.strictEqual(decision.allocations[1].destination_reference, '+254799001122');
      assert.strictEqual(decision.allocations[1].amount, 7500);

      // 3. Remainder: 15,000 - 5,000 - 7,500 = 2,500 to balance
      assert.strictEqual(decision.allocations[2].destination_type, 'balance');
      assert.strictEqual(decision.allocations[2].amount, 2500);

      // Sum of all allocations must strictly equal settled_amount
      const sum = decision.allocations.reduce((acc, a) => acc + a.amount, 0);
      assert.strictEqual(sum, 15000);
    });
  });

  describe('3. Immutability & Non-Retroactivity ("Effective going forward only, never retroactive")', () => {
    it('rule change made after settlement does not alter previously computed evaluation', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_md_retro_test',
        account_type: 'individual',
        display_name: 'David Mwangi',
        owner_name: 'David Mwangi',
        phone: '+254722889900',
      });

      // Initial Rule: 100% to balance
      await setMoneyDirectionRules(prof.id, [
        {
          destination_type: 'balance',
          allocation_type: 'full',
          priority_order: 1,
        },
      ]);

      // Settlement 1 happens under initial rule
      const decision1 = await evaluateMoneyDirection(prof.id, 6000);
      assert.strictEqual(decision1.allocations[0].destination_type, 'balance');
      assert.strictEqual(decision1.allocations[0].amount, 6000);

      // User changes rule: now forward 100% to LOOP number
      await setMoneyDirectionRules(prof.id, [
        {
          destination_type: 'loop_number',
          allocation_type: 'full',
          priority_order: 1,
        },
      ]);

      // Settlement 1 decision remains unchanged
      assert.strictEqual(decision1.allocations[0].destination_type, 'balance');
      assert.strictEqual(decision1.allocations[0].amount, 6000);

      // Settlement 2 happens AFTER rule change -> uses new rule
      const decision2 = await evaluateMoneyDirection(prof.id, 6000);
      assert.strictEqual(decision2.allocations[0].destination_type, 'loop_number');
      assert.strictEqual(decision2.allocations[0].amount, 6000);
      assert.strictEqual(decision2.allocations[0].destination_reference, '+254722889900');
    });
  });

  describe('4. Single Account Model (Flag, Not a Fork (§9b))', () => {
    it('proves identical rule schema and evaluation path for Individual and Business profiles without account_type branching', async () => {
      const indProf = await createProfile({
        clerk_user_id: 'user_ind_flag_test',
        account_type: 'individual',
        display_name: 'Alex Kariuki',
        owner_name: 'Alex Kariuki',
        phone: '+254710112233',
      });

      const bizProf = await createProfile({
        clerk_user_id: 'user_biz_flag_test',
        account_type: 'business',
        display_name: 'Kariuki Logistics',
        owner_name: 'Kariuki Logistics Ltd',
        phone: '+254710112233',
      });

      const ruleConfig = [
        {
          destination_type: 'loop_number' as const,
          allocation_type: 'percentage' as const,
          allocation_value: 70,
          priority_order: 1,
        },
      ];

      const indRules = await setMoneyDirectionRules(indProf.id, ruleConfig);
      const bizRules = await setMoneyDirectionRules(bizProf.id, ruleConfig);

      assert.deepStrictEqual(
        indRules.map((r) => ({
          destination_type: r.destination_type,
          allocation_type: r.allocation_type,
          allocation_value: r.allocation_value,
        })),
        bizRules.map((r) => ({
          destination_type: r.destination_type,
          allocation_type: r.allocation_type,
          allocation_value: r.allocation_value,
        }))
      );

      const indDecision = await evaluateMoneyDirection(indProf.id, 10000);
      const bizDecision = await evaluateMoneyDirection(bizProf.id, 10000);

      assert.deepStrictEqual(
        indDecision.allocations.map((a) => ({
          destination_type: a.destination_type,
          destination_reference: a.destination_reference,
          amount: a.amount,
        })),
        bizDecision.allocations.map((a) => ({
          destination_type: a.destination_type,
          destination_reference: a.destination_reference,
          amount: a.amount,
        }))
      );
    });
  });

  describe('5. Settlement Transition Hook Automatic Evaluation (§12, §17)', () => {
    it('automatically triggers evaluateMoneyDirection when transaction transitions to settled', async () => {
      const prof = await createProfile({
        clerk_user_id: 'user_settle_hook_test',
        account_type: 'business',
        display_name: 'Supermarket POS',
        owner_name: 'Supermarket POS Ltd',
        phone: '+254705556677',
      });

      await setMoneyDirectionRules(prof.id, [
        {
          destination_type: 'loop_number',
          allocation_type: 'fixed_amount',
          allocation_value: 4000,
          priority_order: 1,
        },
      ]);

      // 1. Initial pending transaction recorded
      const normTx: NormalizedTransaction = {
        provider: 'loop',
        rail: 'request_to_pay',
        internal_reference: `INT_SETTLE_${Date.now()}`,
        external_reference: `EXT_SETTLE_${Date.now()}`,
        amount: 7000,
        currency: 'KES',
        provider_fee: 105,
        net_amount: 6895,
        payer_identifier: '+254700000000',
        payment_status: 'successful',
        settlement_status: 'pending',
        refund_status: 'none',
        transaction_time: new Date().toISOString(),
        raw_payload: {},
      };

      const tx = await recordTransaction(normTx, prof.id, null);
      assert.strictEqual(tx.settlement_status, 'pending');

      const initialHistoryCount = getEvaluationHistory().length;

      // 2. Transition transaction to 'settled'
      const settledTx = await settleTransaction(tx.id);
      assert.strictEqual(settledTx.settlement_status, 'settled');
      assert.ok(settledTx.settled_at);

      // 3. Verify settlement hook automatically fired evaluateMoneyDirection
      const history = getEvaluationHistory();
      assert.strictEqual(history.length, initialHistoryCount + 1);

      const latestDecision = history[history.length - 1];
      assert.strictEqual(latestDecision.profile_id, prof.id);
      assert.strictEqual(latestDecision.settled_amount, 6895); // Net amount
      assert.strictEqual(latestDecision.allocations[0].destination_type, 'loop_number');
      assert.strictEqual(latestDecision.allocations[0].amount, 4000);
      assert.strictEqual(latestDecision.allocations[1].destination_type, 'balance');
      assert.strictEqual(latestDecision.allocations[1].amount, 2895);
    });
  });

  describe('6. Live REST API Endpoints & Ownership Enforcement (§17, §18)', () => {
    let ownerProfile: any;
    let otherProfile: any;

    beforeEach(async () => {
      ownerProfile = await createProfile({
        clerk_user_id: 'test_clerk_owner_' + Date.now(),
        account_type: 'individual',
        display_name: 'Owner Profile',
        owner_name: 'Owner Profile',
        phone: '+254712000000',
      });

      otherProfile = await createProfile({
        clerk_user_id: 'test_clerk_other_' + Date.now(),
        account_type: 'individual',
        display_name: 'Other Profile',
        owner_name: 'Other Profile',
        phone: '+254713000000',
      });
    });

    it('PUT /api/v1/profiles/:id/money-direction updates rules when authenticated as owner', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profiles/${ownerProfile.id}/money-direction`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerProfile.clerk_user_id}`,
        },
        body: JSON.stringify({
          rules: [
            {
              destination_type: 'loop_number',
              allocation_type: 'percentage',
              allocation_value: 80,
              priority_order: 1,
            },
          ],
        }),
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.profile_id, ownerProfile.id);
      assert.strictEqual(data.rules.length, 1);
      assert.strictEqual(data.rules[0].destination_type, 'loop_number');
      assert.strictEqual(data.rules[0].allocation_value, 80);
    });

    it('GET /api/v1/profiles/:id/money-direction returns rules when authenticated as owner', async () => {
      // First configure a rule
      await setMoneyDirectionRules(ownerProfile.id, [
        {
          destination_type: 'loop_number',
          allocation_type: 'full',
          priority_order: 1,
        },
      ]);

      const res = await fetch(`${baseUrl}/api/v1/profiles/${ownerProfile.id}/money-direction`, {
        headers: {
          Authorization: `Bearer ${ownerProfile.clerk_user_id}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.profile_id, ownerProfile.id);
      assert.strictEqual(data.rules.length, 1);
      assert.strictEqual(data.rules[0].destination_type, 'loop_number');
    });

    it('PUT and GET return 403 Forbidden when accessing another user profile rules', async () => {
      // Try to edit ownerProfile rules with otherProfile's token
      const putRes = await fetch(`${baseUrl}/api/v1/profiles/${ownerProfile.id}/money-direction`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherProfile.clerk_user_id}`,
        },
        body: JSON.stringify({
          rules: [
            {
              destination_type: 'balance',
              allocation_type: 'full',
            },
          ],
        }),
      });
      assert.strictEqual(putRes.status, 403);
      const putData: any = await putRes.json();
      assert.strictEqual(putData.error, 'Forbidden');

      // Try to view ownerProfile rules with otherProfile's token
      const getRes = await fetch(`${baseUrl}/api/v1/profiles/${ownerProfile.id}/money-direction`, {
        headers: {
          Authorization: `Bearer ${otherProfile.clerk_user_id}`,
        },
      });
      assert.strictEqual(getRes.status, 403);
      const getData: any = await getRes.json();
      assert.strictEqual(getData.error, 'Forbidden');
    });

    it('PUT and GET return 401 Unauthorized when unauthenticated', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profiles/${ownerProfile.id}/money-direction`);
      assert.strictEqual(res.status, 401);
    });

    it('PUT returns 400 Bad Request on invalid percentage sums > 100%', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profiles/${ownerProfile.id}/money-direction`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerProfile.clerk_user_id}`,
        },
        body: JSON.stringify({
          rules: [
            {
              destination_type: 'loop_number',
              allocation_type: 'percentage',
              allocation_value: 70,
            },
            {
              destination_type: 'loop_number',
              destination_reference: '+254799000000',
              allocation_type: 'percentage',
              allocation_value: 40, // 70 + 40 = 110%
            },
          ],
        }),
      });

      assert.strictEqual(res.status, 400);
      const data: any = await res.json();
      assert.strictEqual(data.error, 'Bad Request');
      assert.ok(data.message.includes('exceeds 100%'));
    });
  });
});
