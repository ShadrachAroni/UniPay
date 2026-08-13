import { AccountBalanceSummary } from '../../types/money-direction.types.js';
import { PayoutsRepository } from '../../repository/payouts.repository.js';

export class BalanceService {
  constructor(private readonly payoutsRepo: PayoutsRepository) {}

  async getAccountBalance(profileId: string, currency: string = 'KES'): Promise<AccountBalanceSummary> {
    return this.payoutsRepo.getBalanceSummary(profileId, currency);
  }

  async getAvailableBalance(profileId: string, currency: string = 'KES'): Promise<number> {
    const summary = await this.getAccountBalance(profileId, currency);
    return summary.availableToWithdraw;
  }
}
