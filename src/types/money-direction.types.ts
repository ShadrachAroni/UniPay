export type DestinationType = 'loop_number' | 'unipay_balance' | 'bank';

export type AllocationType = 'full' | 'percentage' | 'fixed_amount';

export type PayoutStatus = 'requested' | 'processing' | 'completed' | 'failed';

export interface MoneyDirectionRule {
  id: string;
  profileId: string;
  destinationType: DestinationType;
  destinationReference: string;
  allocationType: AllocationType;
  allocationValue: number;
  priorityOrder: number;
  isActive: boolean;
  updatedAt: Date;
  createdAt: Date;
}

export interface Settlement {
  id: string;
  profileId: string;
  provider: string;
  settlementReference: string;
  currency: string;
  grossAmount: number;
  fees: number;
  netAmount: number;
  status: 'pending' | 'settled' | 'failed';
  expectedAt: Date;
  settledAt?: Date | null;
}

export interface Payout {
  id: string;
  profileId: string;
  provider: string;
  requestedAmount: number;
  requestedCurrency: string;
  destinationType: DestinationType;
  destinationReference: string;
  fee: number;
  netAmount: number;
  status: PayoutStatus;
  providerReference?: string | null;
  settlementId?: string | null;
  ruleId?: string | null;
  ruleSnapshot?: Record<string, unknown> | null;
  isManualWithdrawal: boolean;
  requestedAt: Date;
  processedAt?: Date | null;
  rawPayload?: unknown;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AllocationResult {
  ruleId?: string;
  destinationType: DestinationType;
  destinationReference: string;
  allocationType: AllocationType;
  allocationValue: number;
  allocatedAmount: number;
  ruleSnapshot?: Record<string, unknown>;
}

export interface ManualWithdrawalInput {
  profileId: string;
  destinationType: DestinationType;
  destinationReference: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  railKey: string;
}

export interface AccountBalanceSummary {
  profileId: string;
  totalRetained: number;      // Sum of completed unipay_balance payouts
  totalWithdrawn: number;     // Sum of completed manual withdrawals
  totalInFlight: number;      // Sum of requested/processing manual withdrawals
  availableToWithdraw: number;// totalRetained - totalWithdrawn - totalInFlight
  currency: string;
}

export class InsufficientBalanceError extends Error {
  constructor(public profileId: string, public requested: number, public available: number) {
    super(`Insufficient balance for profile ${profileId}: requested KES ${requested}, available KES ${available}`);
    this.name = 'InsufficientBalanceError';
  }
}

export class UnsupportedCapabilityError extends Error {
  constructor(public capability: string, public railKey: string) {
    super(`Capability '${capability}' is unsupported by rail '${railKey}'`);
    this.name = 'UnsupportedCapabilityError';
  }
}

export class DuplicatePayoutError extends Error {
  constructor(public idempotencyKey: string) {
    super(`Duplicate payout request for idempotencyKey '${idempotencyKey}'`);
    this.name = 'DuplicatePayoutError';
  }
}
