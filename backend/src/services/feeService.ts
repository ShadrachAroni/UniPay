/**
 * Centralized Money-Flow Fee Calculation Engine (§13, §18)
 * 
 * Computes exact provider and platform fees with explicit rounding rules.
 * Formula: Net = Amount − Provider Fee − Platform Fee − Tax
 */

export interface FeeCalculationInput {
  amount: number;
  currency?: string;
  rail?: string;
  operation?: 'collection' | 'disbursement';
  destination_type?: string;
}

export interface FeeCalculationResult {
  amount: number;
  currency: string;
  provider_fee: number;
  platform_fee: number;
  tax: number;
  total_fee: number;
  net_amount: number;
  settlement_estimate: 'instant' | 't+1' | 'end_of_day';
}

// Configured Fee Schedules
export const FEE_SCHEDULES = {
  collection: {
    loop: { fixed: 0, percentage: 0.015 }, // 1.5% LOOP Prompt collection
    seeded: { fixed: 0, percentage: 0.005 }, // 0.5% Seeded test rail
    mpesa: { fixed: 0, percentage: 0.015 },
    default: { fixed: 0, percentage: 0.015 },
  },
  disbursement: {
    loop: { fixed: 0, percentage: 0.0 }, // Free internal LOOP transfer
    loop_number: { fixed: 0, percentage: 0.0 }, // Free internal LOOP transfer
    mpesa: { fixed: 15.0, percentage: 0.0 }, // KES 15 B2C mobile money fee
    bank_account: { fixed: 50.0, percentage: 0.0 }, // KES 50 PesaLink fee
    bank: { fixed: 50.0, percentage: 0.0 }, // KES 50 PesaLink fee
    default: { fixed: 0, percentage: 0.0 },
  },
  platform_margin: {
    percentage: 0.0, // Default 0.0% pass-through margin
    fixed: 0.0,
  },
};

/**
 * Calculates collection fees for incoming checkout / Request-to-Pay payments
 */
export function calculateCollectionFee(
  amount: number,
  rail = 'loop',
  currency = 'KES'
): FeeCalculationResult {
  const schedule =
    FEE_SCHEDULES.collection[rail as keyof typeof FEE_SCHEDULES.collection] ||
    FEE_SCHEDULES.collection.default;

  const providerFee = Number(
    ((schedule.fixed || 0) + amount * (schedule.percentage || 0)).toFixed(2)
  );

  const platformFee = Number(
    (
      (FEE_SCHEDULES.platform_margin.fixed || 0) +
      amount * (FEE_SCHEDULES.platform_margin.percentage || 0)
    ).toFixed(2)
  );

  const tax = 0.0; // Kenya excise duty or tax if applicable
  const totalFee = Number((providerFee + platformFee + tax).toFixed(2));
  const netAmount = Number(Math.max(0, amount - totalFee).toFixed(2));

  return {
    amount: Number(amount.toFixed(2)),
    currency,
    provider_fee: providerFee,
    platform_fee: platformFee,
    tax,
    total_fee: totalFee,
    net_amount: netAmount,
    settlement_estimate: 'instant',
  };
}

/**
 * Calculates disbursement / withdrawal fees for outgoing payouts
 */
export function calculateDisbursementFee(
  amount: number,
  destinationType = 'loop_number',
  currency = 'KES'
): FeeCalculationResult {
  const schedule =
    FEE_SCHEDULES.disbursement[
      destinationType as keyof typeof FEE_SCHEDULES.disbursement
    ] || FEE_SCHEDULES.disbursement.default;

  const providerFee = Number(
    ((schedule.fixed || 0) + amount * (schedule.percentage || 0)).toFixed(2)
  );

  const platformFee = 0.0;
  const tax = 0.0;
  const totalFee = Number((providerFee + platformFee + tax).toFixed(2));
  const netAmount = Number(Math.max(0, amount - totalFee).toFixed(2));

  return {
    amount: Number(amount.toFixed(2)),
    currency,
    provider_fee: providerFee,
    platform_fee: platformFee,
    tax,
    total_fee: totalFee,
    net_amount: netAmount,
    settlement_estimate: 'instant',
  };
}

/**
 * Verifies and recalculates Net Amount formula for a transaction
 */
export function calculateNetTransaction(
  amount: number,
  providerFee: number,
  platformFee = 0,
  tax = 0
): number {
  return Number((amount - providerFee - platformFee - tax).toFixed(2));
}
