import { AdapterRegistry } from '../adapter-registry.js';
import { PaymentRailsRepository } from '../../repository/payment-rails.repository.js';
import { MoneyDirectionRulesRepository } from '../../repository/money-direction-rules.repository.js';
import { PayoutsRepository } from '../../repository/payouts.repository.js';
import { BalanceService } from './balance.service.js';
import { MoneyDirectionEngine } from './money-direction.engine.ts';
import {
  Settlement,
  Payout,
  ManualWithdrawalInput,
  InsufficientBalanceError,
  UnsupportedCapabilityError,
} from '../../types/money-direction.types.js';
import { logger } from '../../utils/logger.js';

export class DisbursementService {
  private engine = new MoneyDirectionEngine();

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly railsRepo: PaymentRailsRepository,
    private readonly rulesRepo: MoneyDirectionRulesRepository,
    private readonly payoutsRepo: PayoutsRepository,
    private readonly balanceService: BalanceService
  ) {}

  /**
   * Automatic Settlement Routing (Handbook M1 / §9)
   * Converts a settled net amount into payouts rows per active money_direction_rules.
   */
  async processSettlementRouting(settlement: Settlement): Promise<Payout[]> {
    if (settlement.status !== 'settled') {
      logger.warn(`Attempted routing on non-settled settlement '${settlement.id}'`, {
        settlement_id: settlement.id,
        status: settlement.status,
      });
      return [];
    }

    // Idempotency check: if settlement already routed, return existing payouts
    const existingPayouts = await this.payoutsRepo.findBySettlementId(settlement.id);
    if (existingPayouts.length > 0) {
      logger.info(`Settlement '${settlement.id}' already routed idempotently`, {
        settlement_id: settlement.id,
        payout_count: existingPayouts.length,
      });
      return existingPayouts;
    }

    // Fetch active rules for profile
    const activeRules = await this.rulesRepo.findActiveByProfileId(settlement.profileId);
    const allocations = this.engine.calculateAllocations(settlement.netAmount, activeRules);

    const generatedPayouts: Payout[] = [];

    for (let idx = 0; idx < allocations.length; idx++) {
      const alloc = allocations[idx];
      const now = new Date();
      const idempotencyKey = `rout_${settlement.id}_${idx}_${alloc.destinationType}`;

      const payout: Payout = {
        id: `po_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        profileId: settlement.profileId,
        provider: settlement.provider,
        requestedAmount: alloc.allocatedAmount,
        requestedCurrency: settlement.currency,
        destinationType: alloc.destinationType,
        destinationReference: alloc.destinationReference,
        fee: 0,
        netAmount: alloc.allocatedAmount,
        status: alloc.destinationType === 'unipay_balance' ? 'completed' : 'requested',
        settlementId: settlement.id,
        ruleId: alloc.ruleId ?? null,
        ruleSnapshot: alloc.ruleSnapshot ?? null,
        isManualWithdrawal: false,
        requestedAt: now,
        processedAt: alloc.destinationType === 'unipay_balance' ? now : null,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      };

      // Persist payout row
      const savedPayout = await this.payoutsRepo.save(payout);

      // If internal unipay_balance -> completed immediately with 0 provider calls
      if (alloc.destinationType === 'unipay_balance') {
        generatedPayouts.push(savedPayout);
        continue;
      }

      // External allocation -> disburse via adapter if rail available
      const processed = await this.executeExternalDisbursement(savedPayout, settlement.provider);
      generatedPayouts.push(processed);
    }

    return generatedPayouts;
  }

  /**
   * Manual Withdrawal Request (§9)
   * Draws against available retained unipay_balance.
   */
  async requestManualWithdrawal(input: ManualWithdrawalInput): Promise<Payout> {
    // 1. Idempotency Check
    const existing = await this.payoutsRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      logger.info(`Idempotent match for manual withdrawal '${input.idempotencyKey}'`, {
        idempotency_key: input.idempotencyKey,
        payout_id: existing.id,
      });
      return existing;
    }

    // 2. Check Available Retained Balance (Sub-Ledger)
    const availableBalance = await this.balanceService.getAvailableBalance(
      input.profileId,
      input.currency
    );

    if (input.amount > availableBalance) {
      logger.warn(`Manual withdrawal rejected: insufficient balance`, {
        profile_id: input.profileId,
        requested: input.amount,
        available: availableBalance,
      });
      throw new InsufficientBalanceError(input.profileId, input.amount, availableBalance);
    }

    // 3. Check Rail & Capabilities for External Destinations
    const rail = await this.railsRepo.findByAdapterKey(input.railKey);
    if (!rail || !rail.is_enabled) {
      throw new Error(`Payment rail '${input.railKey}' is not enabled`);
    }

    if (input.destinationType === 'bank' && !rail.capabilities_json.disbursement) {
      throw new UnsupportedCapabilityError('bank_disbursement', input.railKey);
    }

    const now = new Date();

    const payout: Payout = {
      id: `po_man_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      profileId: input.profileId,
      provider: rail.adapter_key,
      requestedAmount: input.amount,
      requestedCurrency: input.currency,
      destinationType: input.destinationType,
      destinationReference: input.destinationReference,
      fee: 0,
      netAmount: input.amount,
      status: input.destinationType === 'unipay_balance' ? 'completed' : 'requested',
      isManualWithdrawal: true,
      requestedAt: now,
      processedAt: input.destinationType === 'unipay_balance' ? now : null,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    // Save initial payout (status = requested reserves amount from balance)
    const saved = await this.payoutsRepo.save(payout);

    if (input.destinationType === 'unipay_balance') {
      return saved;
    }

    // Execute external disburse
    return this.executeExternalDisbursement(saved, rail.adapter_key);
  }

  private async executeExternalDisbursement(payout: Payout, railKey: string): Promise<Payout> {
    const adapter = this.registry.get(railKey);

    // Capability check against adapter
    if (!adapter.capabilities().disbursement) {
      logger.error(`Adapter '${railKey}' does not support disbursement capability`, {
        adapter_key: railKey,
        payout_id: payout.id,
      });
      payout.status = 'failed';
      payout.updatedAt = new Date();
      return this.payoutsRepo.save(payout);
    }

    try {
      payout.status = 'processing';
      await this.payoutsRepo.save(payout);

      const result = await adapter.disburse({
        recipientIdentifier: payout.destinationReference,
        amount: payout.requestedAmount,
        currency: payout.requestedCurrency,
        idempotencyKey: payout.idempotencyKey,
        remarks: `UniPay payout ${payout.id}`,
      });

      if (result.status === 'completed' || result.status === 'requested') {
        payout.status = 'completed';
        payout.providerReference = result.disbursementReference;
        payout.processedAt = new Date();
        payout.rawPayload = result.rawResponse;
      } else {
        payout.status = 'failed';
        payout.rawPayload = result.rawResponse;
      }
    } catch (err) {
      logger.error(`External disbursement failed for payout '${payout.id}'`, {
        payout_id: payout.id,
        error: (err as Error).message,
      });
      payout.status = 'failed'; // Failure releases reservation automatically!
    }

    return this.payoutsRepo.save(payout);
  }
}
