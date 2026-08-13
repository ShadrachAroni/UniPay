import { NormalizedTransaction } from '../../types/payment-provider.js';
import { AggregateMetrics, ExceptionCategory } from '../../types/reconciliation.types.js';
import { ReconciliationRepository } from '../../repository/reconciliation.repository.js';

export class ReconciliationDashboardService {
  constructor(private readonly repository: ReconciliationRepository) {}

  async getAggregateMetrics(transactions: NormalizedTransaction[]): Promise<AggregateMetrics> {
    const allMatches = await this.repository.findAllMatches();
    const allExceptions = await this.repository.findAllExceptions('open');

    const matchByTxId = new Map(allMatches.map((m) => [m.transactionId, m]));

    let grossCollections = 0;
    let netCollections = 0;
    let totalFees = 0;
    let totalTransactions = transactions.length;
    let eligibleTransactions = 0;
    let confirmedMatchedTransactions = 0;

    const exceptionsByCategory: Record<ExceptionCategory, number> = {
      missing_provider_transaction: 0,
      missing_order: 0,
      amount_mismatch: 0,
      duplicate_payment: 0,
      fee_mismatch: 0,
      settlement_delay: 0,
      unknown_provider_reference: 0,
      overpayment: 0,
    };

    for (const ex of allExceptions) {
      if (exceptionsByCategory[ex.category] !== undefined) {
        exceptionsByCategory[ex.category]++;
      }
    }

    for (const tx of transactions) {
      const status = tx.paymentStatus;
      // Exclude initiated, failed, reversed from eligible
      if (status === 'initiated' || status === 'failed' || status === 'reversed') {
        continue;
      }

      eligibleTransactions++;
      grossCollections += tx.amount;
      netCollections += tx.netAmount;
      totalFees += tx.providerFee;

      const txId = (tx as any).id || tx.internalReference;
      const match = matchByTxId.get(txId);

      if (match && match.matchType !== 'manual') {
        confirmedMatchedTransactions++;
      }
    }

    const reconciliationRate = eligibleTransactions > 0 ? confirmedMatchedTransactions / eligibleTransactions : 0;

    return {
      grossCollections,
      netCollections,
      totalFees,
      totalTransactions,
      eligibleTransactions,
      confirmedMatchedTransactions,
      reconciliationRate: Number(reconciliationRate.toFixed(4)),
      openExceptionsCount: allExceptions.length,
      exceptionsByCategory,
    };
  }

  async getOpenExceptions(profileId?: string) {
    if (profileId) {
      return this.repository.findExceptionsByProfileId(profileId);
    }
    return this.repository.findAllExceptions('open');
  }
}
