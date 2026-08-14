import { PaymentPool, PoolContribution } from './types';

const MOCK_POOLS: PaymentPool[] = [
  { id: 'pool_1', owner_profile_id: 'prof_123', title: 'Office Party', target_amount: 20000, status: 'open', deadline: new Date(Date.now() + 86400000 * 3).toISOString() }
];

/**
 * MOCK CONTRACT
 * Input: none
 * Output: PaymentPool[]
 */
export async function getPaymentPools(): Promise<PaymentPool[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_POOLS), 500));
}

/**
 * MOCK CONTRACT
 * Input: poolId string
 * Output: PaymentPool
 */
export async function getPoolDetails(id: string): Promise<PaymentPool> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const pool = MOCK_POOLS.find(p => p.id === id);
      if (pool) resolve(pool);
      else reject(new Error('Not found'));
    }, 400);
  });
}

/**
 * MOCK CONTRACT
 * Input: poolId string
 * Output: PoolContribution[]
 */
export async function getPoolContributions(id: string): Promise<PoolContribution[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve([
      { id: 'pc_1', pool_id: id, contributor_reference: 'Alice', expected_amount: 5000, amount_paid: 5000, status: 'paid' },
      { id: 'pc_2', pool_id: id, contributor_reference: 'Bob', expected_amount: 5000, amount_paid: 0, status: 'unpaid' },
    ]), 600);
  });
}
