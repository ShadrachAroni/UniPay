import {
  MoneyDirectionRule,
  AllocationResult,
} from '../../types/money-direction.types.js';

export class MoneyDirectionEngine {
  /**
   * Deterministic Funds Routing (Handbook M1 & §6/§7)
   * Executes active rules in priority_order ascending.
   * Produces destination-typed allocations guaranteed not to exceed settledNetAmount.
   */
  calculateAllocations(
    settledNetAmount: number,
    rules: MoneyDirectionRule[]
  ): AllocationResult[] {
    if (settledNetAmount <= 0) return [];

    // Sort rules by priority_order ascending
    const sortedRules = [...rules].sort((a, b) => a.priorityOrder - b.priorityOrder);

    let remaining = Number(settledNetAmount.toFixed(2));
    const results: AllocationResult[] = [];

    // If no rules configured, default 100% allocation to unipay_balance
    if (sortedRules.length === 0) {
      results.push({
        destinationType: 'unipay_balance',
        destinationReference: 'DEFAULT_UNIPAY_RETAINED',
        allocationType: 'full',
        allocationValue: 100,
        allocatedAmount: remaining,
        ruleSnapshot: { note: 'Default fallback 100% unipay_balance allocation' },
      });
      return results;
    }

    for (let i = 0; i < sortedRules.length; i++) {
      if (remaining <= 0.001) break; // All funds allocated

      const rule = sortedRules[i];
      let allocated = 0;

      if (rule.allocationType === 'full') {
        // 'full' consumes all remaining eligible funds
        allocated = remaining;
      } else if (rule.allocationType === 'percentage') {
        // 'percentage' calculates ratio of original settledNetAmount
        const targetPercent = Number(((settledNetAmount * rule.allocationValue) / 100).toFixed(2));
        allocated = Math.min(remaining, targetPercent);
      } else if (rule.allocationType === 'fixed_amount') {
        // 'fixed_amount' capped at remaining
        allocated = Math.min(remaining, Number(rule.allocationValue.toFixed(2)));
      }

      // Round allocated amount
      allocated = Number(allocated.toFixed(2));

      if (allocated > 0) {
        remaining = Number((remaining - allocated).toFixed(2));
        results.push({
          ruleId: rule.id,
          destinationType: rule.destinationType,
          destinationReference: rule.destinationReference,
          allocationType: rule.allocationType,
          allocationValue: rule.allocationValue,
          allocatedAmount: allocated,
          ruleSnapshot: {
            ruleId: rule.id,
            profileId: rule.profileId,
            destinationType: rule.destinationType,
            destinationReference: rule.destinationReference,
            allocationType: rule.allocationType,
            allocationValue: rule.allocationValue,
            priorityOrder: rule.priorityOrder,
            snapshotTimestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Exact Rounding Reconciliation:
    // If remaining cents exist due to fractional rounding across percentage rules,
    // attribute remainder to the last allocation or add default unipay_balance entry.
    if (remaining > 0.001) {
      if (results.length > 0) {
        // Reconcile leftover cents onto last allocation
        const last = results[results.length - 1];
        last.allocatedAmount = Number((last.allocatedAmount + remaining).toFixed(2));
      } else {
        results.push({
          destinationType: 'unipay_balance',
          destinationReference: 'REMAINDER_UNIPAY_RETAINED',
          allocationType: 'fixed_amount',
          allocationValue: remaining,
          allocatedAmount: remaining,
          ruleSnapshot: { note: 'Rounding remainder allocation' },
        });
      }
    }

    return results;
  }
}
