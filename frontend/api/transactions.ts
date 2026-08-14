import { Transaction, ReconciliationMatch } from './types';

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx_1', recipient_profile_id: 'prof_123', payer_reference: 'Alice Mwangi', amount: 5000, currency: 'KES', provider_fee: 50, net_amount: 4950, payment_status: 'completed', settlement_status: 'settled', transaction_time: new Date(Date.now() - 86400000 * 2).toISOString(), settled_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'tx_2', recipient_profile_id: 'prof_123', payer_reference: 'Brian Ouma', amount: 1250, currency: 'KES', provider_fee: 15, net_amount: 1235, payment_status: 'completed', settlement_status: 'processing', transaction_time: new Date(Date.now() - 3600000).toISOString() },
  { id: 'tx_3', recipient_profile_id: 'prof_123', payer_reference: 'Caroline Achieng', amount: 10000, currency: 'KES', provider_fee: 100, net_amount: 9900, payment_status: 'failed', settlement_status: 'failed', transaction_time: new Date(Date.now() - 7200000).toISOString() },
];

/**
 * MOCK CONTRACT
 * Input: none (uses implicit auth)
 * Output: Transaction[]
 * Notes: Returns list of recent transactions
 */
export async function getTransactions(): Promise<Transaction[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_TRANSACTIONS), 600));
}

/**
 * MOCK CONTRACT
 * Input: transactionId string
 * Output: Transaction
 * Notes: Fetches single transaction details
 */
export async function getTransactionDetails(id: string): Promise<Transaction> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const tx = MOCK_TRANSACTIONS.find(t => t.id === id);
      if (tx) resolve(tx);
      else reject(new Error('Not found'));
    }, 400);
  });
}

/**
 * MOCK CONTRACT
 * Input: transactionId string
 * Output: ReconciliationMatch[]
 * Notes: Returns AI reconciliation matches for a transaction
 */
export async function getReconciliationMatches(id: string): Promise<ReconciliationMatch[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve([
      {
        id: `match_${Math.random()}`,
        transaction_id: id,
        confidence_score: 0.95,
        ai_explanation: 'Amount matches expected payment from same phone number.',
        match_type: 'ai_inferred',
        status: 'pending'
      }
    ]), 600);
  });
}
