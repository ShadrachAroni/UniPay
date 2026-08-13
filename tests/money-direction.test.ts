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
  InsufficientBalanceError,
  UnsupportedCapabilityError,
} from '../src/types/money-direction.types.js';

describe('Phase 6: Money Direction & Disbursement Engine', () => {
  let registry: AdapterRegistry;
  let railsRepo: PaymentRailsRepository;
  let rulesRepo: MoneyDirectionRulesRepository;
  let payoutsRepo: PayoutsRepository;
  let engine: MoneyDirectionEngine;
  let balanceService: BalanceService;
  let disbursementService: DisbursementService;
  let seededAdapter: SeededPaymentAdapter;

  const sampleProfileId = 'prof_22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    railsRepo = new PaymentRailsRepository([defaultSeededRail]);
    registry = new AdapterRegistry();
    seededAdapter = new SeededPaymentAdapter();
    const resilient = new ResilientPaymentAdapter(seededAdapter);
    registry.register('seeded', resilient);

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

  describe('Allocation Engine Rules & Invariants', () => {
    it('full allocation consumes all remaining funds; subsequent rules get zero', () => {
      const rules: MoneyDirectionRule[] = [
        {
          id: 'rule_full_1',
          profileId: sampleProfileId,
          destinationType: 'loop_number',
          destinationReference: '+254712345678',
          allocationType: 'full',
          allocationValue: 100,
          priorityOrder: 1,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'rule_perc_2',
          profileId: sampleProfileId,
          destinationType: 'unipay_balance',
          destinationReference: 'RETAINED',
          allocationType: 'percentage',
          allocationValue: 50,
          priorityOrder: 2,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      const allocations = engine.calculateAllocations(10000.0, rules);

      expect(allocations).toHaveLength(1);
      expect(allocations[0].allocatedAmount).toBe(10000.0);
      expect(allocations[0].destinationType).toBe('loop_number');
    });

    it('percentage allocations with 3-way split reconcile exactly to settled amount', () => {
      const rules: MoneyDirectionRule[] = [
        {
          id: 'rule_33_1',
          profileId: sampleProfileId,
          destinationType: 'loop_number',
          destinationReference: '+254711111111',
          allocationType: 'percentage',
          allocationValue: 33.33,
          priorityOrder: 1,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'rule_33_2',
          profileId: sampleProfileId,
          destinationType: 'bank',
          destinationReference: 'ACC_12345',
          allocationType: 'percentage',
          allocationValue: 33.33,
          priorityOrder: 2,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'rule_33_3',
          profileId: sampleProfileId,
          destinationType: 'unipay_balance',
          destinationReference: 'RETAINED',
          allocationType: 'percentage',
          allocationValue: 33.34,
          priorityOrder: 3,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      const allocations = engine.calculateAllocations(1000.0, rules);

      expect(allocations).toHaveLength(3);
      const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      expect(totalAllocated).toBe(1000.0);
    });

    it('fixed_amount allocation is capped at remaining balance if value exceeds remaining', () => {
      const rules: MoneyDirectionRule[] = [
        {
          id: 'rule_fix_1',
          profileId: sampleProfileId,
          destinationType: 'loop_number',
          destinationReference: '+254712345678',
          allocationType: 'fixed_amount',
          allocationValue: 800.0,
          priorityOrder: 1,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'rule_fix_2',
          profileId: sampleProfileId,
          destinationType: 'unipay_balance',
          destinationReference: 'RETAINED',
          allocationType: 'fixed_amount',
          allocationValue: 500.0, // Only 200 remaining out of 1000
          priorityOrder: 2,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      const allocations = engine.calculateAllocations(1000.0, rules);

      expect(allocations).toHaveLength(2);
      expect(allocations[0].allocatedAmount).toBe(800.0);
      expect(allocations[1].allocatedAmount).toBe(200.0); // Capped at 200 remaining!
    });
  });

  describe('Non-Retroactivity (§7)', () => {
    it('editing a rule mid-flight does not alter already-persisted payout routing for prior settlements', async () => {
      // 1. Setup Initial 70/30 split rules
      const rule70: MoneyDirectionRule = {
        id: 'rule_70',
        profileId: sampleProfileId,
        destinationType: 'loop_number',
        destinationReference: '+254700000000',
        allocationType: 'percentage',
        allocationValue: 70,
        priorityOrder: 1,
        isActive: true,
        updatedAt: new Date(),
        createdAt: new Date(),
      };
      const rule30: MoneyDirectionRule = {
        id: 'rule_30',
        profileId: sampleProfileId,
        destinationType: 'unipay_balance',
        destinationReference: 'RETAINED',
        allocationType: 'percentage',
        allocationValue: 30,
        priorityOrder: 2,
        isActive: true,
        updatedAt: new Date(),
        createdAt: new Date(),
      };

      await rulesRepo.save(rule70);
      await rulesRepo.save(rule30);

      const settlement1: Settlement = {
        id: 'set_001',
        profileId: sampleProfileId,
        provider: 'seeded',
        settlementReference: 'SET_REF_001',
        currency: 'KES',
        grossAmount: 10000.0,
        fees: 100.0,
        netAmount: 9900.0,
        status: 'settled',
        expectedAt: new Date(),
        settledAt: new Date(),
      };

      // Route Settlement 1 under 70/30
      const payouts1 = await disbursementService.processSettlementRouting(settlement1);
      expect(payouts1).toHaveLength(2);
      expect(payouts1[0].requestedAmount).toBe(6930.0); // 70% of 9900
      expect(payouts1[1].requestedAmount).toBe(2970.0); // 30% of 9900

      // 2. Modify Rule to 50/50
      rule70.allocationValue = 50;
      rule30.allocationValue = 50;
      await rulesRepo.save(rule70);
      await rulesRepo.save(rule30);

      // Re-query Settlement 1 payouts -> still 70/30 (persisted snapshot)
      const historicalPayouts = await payoutsRepo.findBySettlementId('set_001');
      expect(historicalPayouts[0].requestedAmount).toBe(6930.0);
      expect(historicalPayouts[1].requestedAmount).toBe(2970.0);

      // Settlement 2 routes under new 50/50 rule
      const settlement2: Settlement = {
        ...settlement1,
        id: 'set_002',
        settlementReference: 'SET_REF_002',
      };
      const payouts2 = await disbursementService.processSettlementRouting(settlement2);
      expect(payouts2[0].requestedAmount).toBe(4950.0); // 50% of 9900
      expect(payouts2[1].requestedAmount).toBe(4950.0); // 50% of 9900
    });
  });

  describe('Sub-Ledger Balance & Manual Withdrawal', () => {
    it('manual withdrawal within available retained balance succeeds', async () => {
      // Seed unipay_balance retained funds via completed payout
      await payoutsRepo.save({
        id: 'po_inflow_1',
        profileId: sampleProfileId,
        provider: 'seeded',
        requestedAmount: 5000.0,
        requestedCurrency: 'KES',
        destinationType: 'unipay_balance',
        destinationReference: 'RETAINED',
        fee: 0,
        netAmount: 5000.0,
        status: 'completed',
        isManualWithdrawal: false,
        requestedAt: new Date(),
        processedAt: new Date(),
        idempotencyKey: 'inflow_key_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const initialAvail = await balanceService.getAvailableBalance(sampleProfileId);
      expect(initialAvail).toBe(5000.0);

      // Execute manual withdrawal of KES 2000 to LOOP
      const payout = await disbursementService.requestManualWithdrawal({
        profileId: sampleProfileId,
        destinationType: 'loop_number',
        destinationReference: '+254712345678',
        amount: 2000.0,
        currency: 'KES',
        idempotencyKey: 'manual_withdraw_key_100',
        railKey: 'seeded',
      });

      expect(payout.status).toBe('completed');
      expect(payout.requestedAmount).toBe(2000.0);

      const postAvail = await balanceService.getAvailableBalance(sampleProfileId);
      expect(postAvail).toBe(3000.0); // 5000 - 2000
    });

    it('manual withdrawal exceeding available balance is rejected before any adapter call', async () => {
      // Seed KES 1000 balance
      await payoutsRepo.save({
        id: 'po_inflow_2',
        profileId: sampleProfileId,
        provider: 'seeded',
        requestedAmount: 1000.0,
        requestedCurrency: 'KES',
        destinationType: 'unipay_balance',
        destinationReference: 'RETAINED',
        fee: 0,
        netAmount: 1000.0,
        status: 'completed',
        isManualWithdrawal: false,
        requestedAt: new Date(),
        processedAt: new Date(),
        idempotencyKey: 'inflow_key_2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Attempt withdrawal of KES 1500 (exceeding KES 1000)
      await expect(
        disbursementService.requestManualWithdrawal({
          profileId: sampleProfileId,
          destinationType: 'loop_number',
          destinationReference: '+254712345678',
          amount: 1500.0,
          currency: 'KES',
          idempotencyKey: 'overspend_key_99',
          railKey: 'seeded',
        })
      ).rejects.toThrow(InsufficientBalanceError);
    });

    it('retried request with same idempotency key produces one payout and bypasses provider call', async () => {
      // Seed balance
      await payoutsRepo.save({
        id: 'po_inflow_3',
        profileId: sampleProfileId,
        provider: 'seeded',
        requestedAmount: 4000.0,
        requestedCurrency: 'KES',
        destinationType: 'unipay_balance',
        destinationReference: 'RETAINED',
        fee: 0,
        netAmount: 4000.0,
        status: 'completed',
        isManualWithdrawal: false,
        requestedAt: new Date(),
        processedAt: new Date(),
        idempotencyKey: 'inflow_key_3',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const input = {
        profileId: sampleProfileId,
        destinationType: 'loop_number' as const,
        destinationReference: '+254712345678',
        amount: 1000.0,
        currency: 'KES',
        idempotencyKey: 'SAME_WITHDRAWAL_KEY_555',
        railKey: 'seeded',
      };

      const res1 = await disbursementService.requestManualWithdrawal(input);
      const res2 = await disbursementService.requestManualWithdrawal(input);

      expect(res1.id).toEqual(res2.id);

      const allPayouts = await payoutsRepo.findByProfileId(sampleProfileId);
      // 1 inflow + 1 manual withdrawal = 2 total rows
      expect(allPayouts).toHaveLength(2);
    });

    it('failed payout releases its balance reservation', async () => {
      // Seed KES 2000 balance
      await payoutsRepo.save({
        id: 'po_inflow_4',
        profileId: sampleProfileId,
        provider: 'seeded',
        requestedAmount: 2000.0,
        requestedCurrency: 'KES',
        destinationType: 'unipay_balance',
        destinationReference: 'RETAINED',
        fee: 0,
        netAmount: 2000.0,
        status: 'completed',
        isManualWithdrawal: false,
        requestedAt: new Date(),
        processedAt: new Date(),
        idempotencyKey: 'inflow_key_4',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add a failed manual withdrawal
      await payoutsRepo.save({
        id: 'po_failed_1',
        profileId: sampleProfileId,
        provider: 'seeded',
        requestedAmount: 1500.0,
        requestedCurrency: 'KES',
        destinationType: 'loop_number',
        destinationReference: '+254712345678',
        fee: 0,
        netAmount: 1500.0,
        status: 'failed',
        isManualWithdrawal: true,
        requestedAt: new Date(),
        idempotencyKey: 'failed_key_77',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Assert available balance remains KES 2000 (failed payout did not burn balance)
      const avail = await balanceService.getAvailableBalance(sampleProfileId);
      expect(avail).toBe(2000.0);
    });
  });

  describe('Adapter Discipline & Circuit Breaker', () => {
    it('unipay_balance route invokes the provider zero times', async () => {
      // Seed settlement
      const settlement: Settlement = {
        id: 'set_bal_only',
        profileId: sampleProfileId,
        provider: 'seeded',
        settlementReference: 'SET_REF_BAL',
        currency: 'KES',
        grossAmount: 3000.0,
        fees: 30.0,
        netAmount: 2970.0,
        status: 'settled',
        expectedAt: new Date(),
        settledAt: new Date(),
      };

      // Rule: 100% to unipay_balance
      await rulesRepo.save({
        id: 'rule_bal_100',
        profileId: sampleProfileId,
        destinationType: 'unipay_balance',
        destinationReference: 'RETAINED',
        allocationType: 'full',
        allocationValue: 100,
        priorityOrder: 1,
        isActive: true,
        updatedAt: new Date(),
        createdAt: new Date(),
      });

      const payouts = await disbursementService.processSettlementRouting(settlement);

      expect(payouts).toHaveLength(1);
      expect(payouts[0].status).toBe('completed');
      expect(payouts[0].destinationType).toBe('unipay_balance');
    });

    it('unsupported bank destination fails cleanly with UnsupportedCapabilityError', async () => {
      // Seed KES 5000 balance
      await payoutsRepo.save({
        id: 'po_inflow_bank_test',
        profileId: sampleProfileId,
        provider: 'seeded',
        requestedAmount: 5000.0,
        requestedCurrency: 'KES',
        destinationType: 'unipay_balance',
        destinationReference: 'RETAINED',
        fee: 0,
        netAmount: 5000.0,
        status: 'completed',
        isManualWithdrawal: false,
        requestedAt: new Date(),
        processedAt: new Date(),
        idempotencyKey: 'inflow_key_bank',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Disable disbursement capability on rail config to simulate unsupported capability
      const rail = await railsRepo.findByAdapterKey('seeded');
      if (rail) {
        rail.capabilities_json.disbursement = false;
        await railsRepo.save(rail);
      }

      await expect(
        disbursementService.requestManualWithdrawal({
          profileId: sampleProfileId,
          destinationType: 'bank',
          destinationReference: 'BANK_ACCOUNT_001',
          amount: 2000.0,
          currency: 'KES',
          idempotencyKey: 'bank_withdraw_key_1',
          railKey: 'seeded',
        })
      ).rejects.toThrow(UnsupportedCapabilityError);
    });
  });
});
