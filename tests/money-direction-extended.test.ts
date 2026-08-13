/**
 * Phase 6 — Extended Test Suite (money-direction-extended.test.ts)
 *
 * Covers 8 scenarios NOT exercised by the original money-direction.test.ts:
 *
 *  1.  Zero-rules default fallback — engine allocates 100% to unipay_balance when
 *      no active rules exist for the profile.
 *  2.  Settlement routing is idempotent — re-calling processSettlementRouting for
 *      an already-routed settlement returns the existing payouts without creating
 *      duplicate rows.
 *  3.  Multi-currency balance isolation — a KES balance does not bleed into a USD
 *      available-balance query for the same profile.
 *  4.  In-flight (processing) reservation blocks a concurrent withdrawal — a payout
 *      in status='processing' reserves funds from availableToWithdraw.
 *  5.  Zero net-amount settlement produces no payouts — guard against routing
 *      a ghost settlement.
 *  6.  Rule snapshot is frozen at settlement time — the persisted ruleSnapshot on a
 *      payout row reflects the rule at routing time, not the post-edit value.
 *  7.  Disabled rail rejects manual withdrawal before adapter call — a rail with
 *      is_enabled=false throws before any provider I/O.
 *  8.  Circuit-breaker OPEN causes external disbursement to fail and mark the payout
 *      'failed' — the balance reservation is subsequently released.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from '../src/services/adapter-registry.js';
import { SeededPaymentAdapter } from '../src/adapters/seeded.adapter.js';
import { ResilientPaymentAdapter } from '../src/resilience/resilient-adapter.wrapper.js';
import { PaymentRailsRepository, defaultSeededRail } from '../src/repository/payment-rails.repository.js';
import { MoneyDirectionRulesRepository } from '../src/repository/money-direction-rules.repository.js';
import { PayoutsRepository } from '../src/repository/payouts.repository.js';
import { MoneyDirectionEngine } from '../src/services/money-direction/money-direction.engine.js';
import { BalanceService } from '../src/services/money-direction/balance.service.js';
import { DisbursementService } from '../src/services/money-direction/disbursement.service.js';
import {
  MoneyDirectionRule,
  Settlement,
  Payout,
  InsufficientBalanceError,
} from '../src/types/money-direction.types.js';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const PROFILE_A = 'prof_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: `set_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    profileId: PROFILE_A,
    provider: 'seeded',
    settlementReference: `REF_${Date.now()}`,
    currency: 'KES',
    grossAmount: 10000.0,
    fees: 100.0,
    netAmount: 9900.0,
    status: 'settled',
    expectedAt: new Date(),
    settledAt: new Date(),
    ...overrides,
  };
}

function makeRule(overrides: Partial<MoneyDirectionRule> = {}): MoneyDirectionRule {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    profileId: PROFILE_A,
    destinationType: 'loop_number',
    destinationReference: '+254700000000',
    allocationType: 'percentage',
    allocationValue: 100,
    priorityOrder: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRetainedPayout(
  profileId: string,
  amount: number,
  currency: string,
  idempotencyKey: string
): Payout {
  return {
    id: `po_inflow_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    profileId,
    provider: 'seeded',
    requestedAmount: amount,
    requestedCurrency: currency,
    destinationType: 'unipay_balance',
    destinationReference: 'RETAINED',
    fee: 0,
    netAmount: amount,
    status: 'completed',
    isManualWithdrawal: false,
    requestedAt: new Date(),
    processedAt: new Date(),
    idempotencyKey,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Phase 6 Extended: Money Direction & Disbursement Engine', () => {
  let registry: AdapterRegistry;
  let railsRepo: PaymentRailsRepository;
  let rulesRepo: MoneyDirectionRulesRepository;
  let payoutsRepo: PayoutsRepository;
  let engine: MoneyDirectionEngine;
  let balanceService: BalanceService;
  let disbursementService: DisbursementService;
  let seededAdapter: SeededPaymentAdapter;
  let resilientAdapter: ResilientPaymentAdapter;

  beforeEach(() => {
    railsRepo = new PaymentRailsRepository([{ ...defaultSeededRail }]);
    registry = new AdapterRegistry();
    seededAdapter = new SeededPaymentAdapter();
    resilientAdapter = new ResilientPaymentAdapter(seededAdapter);
    registry.register('seeded', resilientAdapter);

    rulesRepo = new MoneyDirectionRulesRepository();
    payoutsRepo = new PayoutsRepository();
    engine = new MoneyDirectionEngine();
    balanceService = new BalanceService(payoutsRepo);
    disbursementService = new DisbursementService(
      registry,
      railsRepo,
      rulesRepo,
      payoutsRepo,
      balanceService
    );
  });

  // ── Test 1 ─────────────────────────────────────────────────────────────────
  describe('Zero-Rules Default Fallback', () => {
    it('engine routes 100% to unipay_balance when no active rules exist for profile', () => {
      const allocations = engine.calculateAllocations(5000.0, []);

      expect(allocations).toHaveLength(1);
      expect(allocations[0].destinationType).toBe('unipay_balance');
      expect(allocations[0].allocatedAmount).toBe(5000.0);
      expect(allocations[0].allocationType).toBe('full');
    });

    it('DisbursementService creates a single completed unipay_balance payout for a profile with no rules', async () => {
      const settlement = makeSettlement({ netAmount: 7500.0 });

      const payouts = await disbursementService.processSettlementRouting(settlement);

      expect(payouts).toHaveLength(1);
      expect(payouts[0].destinationType).toBe('unipay_balance');
      expect(payouts[0].requestedAmount).toBe(7500.0);
      expect(payouts[0].status).toBe('completed');

      const avail = await balanceService.getAvailableBalance(PROFILE_A);
      expect(avail).toBe(7500.0);
    });
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  describe('Settlement Routing Idempotency Guard', () => {
    it('re-routing the same settlement returns existing payouts without creating duplicate rows', async () => {
      await rulesRepo.save(makeRule({ allocationType: 'full', allocationValue: 100 }));

      const settlement = makeSettlement({ netAmount: 4000.0 });

      const first = await disbursementService.processSettlementRouting(settlement);
      expect(first).toHaveLength(1);

      const second = await disbursementService.processSettlementRouting(settlement);

      expect(second).toHaveLength(1);
      expect(second[0].id).toBe(first[0].id);

      const all = await payoutsRepo.findByProfileId(PROFILE_A);
      expect(all).toHaveLength(1);
    });
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  describe('Multi-Currency Balance Isolation', () => {
    it('KES retained balance does not bleed into USD available balance for the same profile', async () => {
      await payoutsRepo.save(makeRetainedPayout(PROFILE_A, 10000.0, 'KES', 'inflow_kes_001'));
      await payoutsRepo.save(makeRetainedPayout(PROFILE_A, 500.0, 'USD', 'inflow_usd_001'));

      const kesBalance = await balanceService.getAvailableBalance(PROFILE_A, 'KES');
      const usdBalance = await balanceService.getAvailableBalance(PROFILE_A, 'USD');

      expect(kesBalance).toBe(10000.0);
      expect(usdBalance).toBe(500.0);
    });

    it('a KES withdrawal does not affect the USD available balance', async () => {
      await payoutsRepo.save(makeRetainedPayout(PROFILE_A, 3000.0, 'KES', 'inflow_kes_002'));
      await payoutsRepo.save(makeRetainedPayout(PROFILE_A, 800.0, 'USD', 'inflow_usd_002'));

      await disbursementService.requestManualWithdrawal({
        profileId: PROFILE_A,
        destinationType: 'loop_number',
        destinationReference: '+254712345678',
        amount: 1000.0,
        currency: 'KES',
        idempotencyKey: 'kes_withdraw_mc_001',
        railKey: 'seeded',
      });

      const usdBalance = await balanceService.getAvailableBalance(PROFILE_A, 'USD');
      expect(usdBalance).toBe(800.0);
    });
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────
  describe('In-Flight (processing) Reservation', () => {
    it('a payout in status=processing reserves funds and reduces availableToWithdraw', async () => {
      await payoutsRepo.save(makeRetainedPayout(PROFILE_A, 5000.0, 'KES', 'inflow_proc_001'));

      await payoutsRepo.save({
        id: 'po_processing_1',
        profileId: PROFILE_A,
        provider: 'seeded',
        requestedAmount: 2000.0,
        requestedCurrency: 'KES',
        destinationType: 'loop_number',
        destinationReference: '+254711111111',
        fee: 0,
        netAmount: 2000.0,
        status: 'processing',
        isManualWithdrawal: true,
        requestedAt: new Date(),
        idempotencyKey: 'processing_key_111',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const avail = await balanceService.getAvailableBalance(PROFILE_A);
      expect(avail).toBe(3000.0);
    });

    it('a subsequent withdrawal that would over-draw the processing-reserved balance is rejected', async () => {
      await payoutsRepo.save(makeRetainedPayout(PROFILE_A, 5000.0, 'KES', 'inflow_proc_002'));

      await payoutsRepo.save({
        id: 'po_processing_2',
        profileId: PROFILE_A,
        provider: 'seeded',
        requestedAmount: 4000.0,
        requestedCurrency: 'KES',
        destinationType: 'loop_number',
        destinationReference: '+254711111111',
        fee: 0,
        netAmount: 4000.0,
        status: 'processing',
        isManualWithdrawal: true,
        requestedAt: new Date(),
        idempotencyKey: 'processing_key_222',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        disbursementService.requestManualWithdrawal({
          profileId: PROFILE_A,
          destinationType: 'loop_number',
          destinationReference: '+254799999999',
          amount: 1500.0,
          currency: 'KES',
          idempotencyKey: 'overdraw_proc_333',
          railKey: 'seeded',
        })
      ).rejects.toThrow(InsufficientBalanceError);
    });
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────────
  describe('Zero Net-Amount & Non-Settled Settlement Guard', () => {
    it('engine returns no allocations for a zero net-amount settlement', () => {
      const allocations = engine.calculateAllocations(0, [
        makeRule({ allocationType: 'full', allocationValue: 100 }),
      ]);
      expect(allocations).toHaveLength(0);
    });

    it('DisbursementService skips non-settled settlements and returns empty array', async () => {
      const settlement = makeSettlement({ status: 'pending', netAmount: 5000.0 });
      const payouts = await disbursementService.processSettlementRouting(settlement);
      expect(payouts).toHaveLength(0);
    });
  });

  // ── Test 6 ─────────────────────────────────────────────────────────────────
  describe('Rule Snapshot Integrity (Non-Retroactivity §7)', () => {
    it('ruleSnapshot on the persisted payout reflects the rule values at routing time, not post-edit values', async () => {
      const rule = makeRule({
        id: 'rule_snap_001',
        allocationType: 'percentage',
        allocationValue: 60,
        priorityOrder: 1,
        destinationType: 'loop_number',
      });
      await rulesRepo.save(rule);

      await rulesRepo.save(makeRule({
        id: 'rule_snap_remainder',
        allocationType: 'percentage',
        allocationValue: 40,
        priorityOrder: 2,
        destinationType: 'unipay_balance',
        destinationReference: 'RETAINED',
      }));

      const settlement = makeSettlement({ netAmount: 10000.0 });
      const payouts = await disbursementService.processSettlementRouting(settlement);

      const payout60 = payouts.find((p) => p.destinationType === 'loop_number');
      expect(payout60).toBeDefined();
      expect(payout60!.requestedAmount).toBe(6000.0);
      expect((payout60!.ruleSnapshot as Record<string, unknown>)?.allocationValue).toBe(60);
      expect((payout60!.ruleSnapshot as Record<string, unknown>)?.ruleId).toBe('rule_snap_001');

      // Mutate the rule post-routing
      rule.allocationValue = 90;
      await rulesRepo.save(rule);

      // Snapshot on persisted row must still read 60
      const allPayouts = await payoutsRepo.findBySettlementId(settlement.id);
      const persisted = allPayouts.find((p) => p.destinationType === 'loop_number');
      expect((persisted!.ruleSnapshot as Record<string, unknown>)?.allocationValue).toBe(60);
    });
  });

  // ── Test 7 ─────────────────────────────────────────────────────────────────
  describe('Disabled Rail Rejection', () => {
    it('manual withdrawal against a disabled rail throws before any adapter call', async () => {
      await payoutsRepo.save(makeRetainedPayout(PROFILE_A, 5000.0, 'KES', 'inflow_rail_001'));

      const rail = await railsRepo.findByAdapterKey('seeded');
      if (rail) {
        rail.is_enabled = false;
        await railsRepo.save(rail);
      }

      await expect(
        disbursementService.requestManualWithdrawal({
          profileId: PROFILE_A,
          destinationType: 'loop_number',
          destinationReference: '+254712345678',
          amount: 1000.0,
          currency: 'KES',
          idempotencyKey: 'disabled_rail_key_001',
          railKey: 'seeded',
        })
      ).rejects.toThrow(/not enabled/i);
    });
  });

  // ── Test 8 ─────────────────────────────────────────────────────────────────
  describe('Circuit Breaker OPEN — Disbursement Guard', () => {
    it('when the circuit is OPEN the external disbursement fails and the payout is marked failed', async () => {
      await payoutsRepo.save(makeRetainedPayout(PROFILE_A, 8000.0, 'KES', 'inflow_cb_001'));

      resilientAdapter.circuitBreaker.forceState('OPEN');

      const payout = await disbursementService.requestManualWithdrawal({
        profileId: PROFILE_A,
        destinationType: 'loop_number',
        destinationReference: '+254700000001',
        amount: 3000.0,
        currency: 'KES',
        idempotencyKey: 'cb_open_withdraw_001',
        railKey: 'seeded',
      });

      expect(payout.status).toBe('failed');
    });

    it('a failed payout caused by an OPEN circuit releases its balance reservation', async () => {
      await payoutsRepo.save(makeRetainedPayout(PROFILE_A, 8000.0, 'KES', 'inflow_cb_002'));

      resilientAdapter.circuitBreaker.forceState('OPEN');

      await disbursementService.requestManualWithdrawal({
        profileId: PROFILE_A,
        destinationType: 'loop_number',
        destinationReference: '+254700000002',
        amount: 5000.0,
        currency: 'KES',
        idempotencyKey: 'cb_open_withdraw_002',
        railKey: 'seeded',
      });

      // Failed payout does not burn balance
      const avail = await balanceService.getAvailableBalance(PROFILE_A);
      expect(avail).toBe(8000.0);
    });
  });
});
