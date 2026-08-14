import { Payout } from './types';

const MOCK_PAYOUTS: Payout[] = [
  { id: 'po_1', profile_id: 'prof_123', requested_amount: 10000, destination_reference: 'KCB Bank ****1234', status: 'completed', requested_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'po_2', profile_id: 'prof_123', requested_amount: 5000, destination_reference: 'M-PESA', status: 'processing', requested_at: new Date(Date.now() - 3600000).toISOString() },
];

/**
 * MOCK CONTRACT
 * Input: none
 * Output: Payout[]
 */
export async function getPayouts(): Promise<Payout[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_PAYOUTS), 500));
}

/**
 * MOCK CONTRACT
 * Input: amount, destination_reference
 * Output: Payout
 */
export async function requestPayout(amount: number, destination_reference: string): Promise<Payout> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({
      id: `po_${Math.random()}`,
      profile_id: 'prof_123',
      requested_amount: amount,
      destination_reference,
      status: 'pending',
      requested_at: new Date().toISOString()
    }), 800);
  });
}
