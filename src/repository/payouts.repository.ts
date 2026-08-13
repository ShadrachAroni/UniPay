import { Payout, AccountBalanceSummary } from '../types/money-direction.types.js';

export class PayoutsRepository {
  private payouts: Map<string, Payout> = new Map(); // id -> Payout
  private idempotencyIndex: Map<string, Payout> = new Map(); // idempotencyKey -> Payout

  async save(payout: Payout): Promise<Payout> {
    const existing = this.idempotencyIndex.get(payout.idempotencyKey);
    if (existing && existing.id !== payout.id) {
      // Idempotency violation guard
      throw new Error(`Duplicate idempotency key '${payout.idempotencyKey}'`);
    }

    const updated = { ...payout, updatedAt: new Date() };
    this.payouts.set(payout.id, updated);
    this.idempotencyIndex.set(payout.idempotencyKey, updated);
    return { ...updated };
  }

  async findById(id: string): Promise<Payout | null> {
    const p = this.payouts.get(id);
    return p ? { ...p } : null;
  }

  async findByIdempotencyKey(key: string): Promise<Payout | null> {
    const p = this.idempotencyIndex.get(key);
    return p ? { ...p } : null;
  }

  async findByProfileId(profileId: string): Promise<Payout[]> {
    return Array.from(this.payouts.values())
      .filter((p) => p.profileId === profileId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  async findBySettlementId(settlementId: string): Promise<Payout[]> {
    return Array.from(this.payouts.values()).filter((p) => p.settlementId === settlementId);
  }

  /**
   * Sub-Ledger Balance Query (Handbook M1 / §1 design)
   * Available = Completed unipay_balance allocations - Manual Withdrawals (completed or in-flight)
   */
  async getBalanceSummary(profileId: string, currency: string = 'KES'): Promise<AccountBalanceSummary> {
    const profilePayouts = await this.findByProfileId(profileId);

    let totalRetained = 0;
    let totalWithdrawn = 0;
    let totalInFlight = 0;

    for (const p of profilePayouts) {
      if (p.requestedCurrency !== currency) continue;

      // 1. Inflow: Automatic settlements routed into unipay_balance
      if (!p.isManualWithdrawal && p.destinationType === 'unipay_balance' && p.status === 'completed') {
        totalRetained += p.netAmount;
      }

      // 2. Outflow: Manual withdrawals requested against unipay_balance
      if (p.isManualWithdrawal) {
        if (p.status === 'completed') {
          totalWithdrawn += p.requestedAmount;
        } else if (p.status === 'requested' || p.status === 'processing') {
          totalInFlight += p.requestedAmount;
        }
        // Note: Failed manual withdrawals (status === 'failed') do not count against balance!
      }
    }

    const availableToWithdraw = Math.max(0, totalRetained - totalWithdrawn - totalInFlight);

    return {
      profileId,
      totalRetained: Number(totalRetained.toFixed(2)),
      totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
      totalInFlight: Number(totalInFlight.toFixed(2)),
      availableToWithdraw: Number(availableToWithdraw.toFixed(2)),
      currency,
    };
  }

  async clear(): Promise<void> {
    this.payouts.clear();
    this.idempotencyIndex.clear();
  }
}
