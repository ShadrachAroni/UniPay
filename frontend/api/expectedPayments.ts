import { ExpectedPayment } from './types';

const MOCK_EXPECTED_PAYMENTS: ExpectedPayment[] = [
  { id: 'ep_1', owner_profile_id: 'prof_123', amount: 5000, reference: 'Invoice #001', due_at: new Date(Date.now() + 86400000 * 5).toISOString(), status: 'open', amount_paid_to_date: 0 },
  { id: 'ep_2', owner_profile_id: 'prof_123', amount: 15000, reference: 'Rent Aug', due_at: new Date(Date.now() - 86400000).toISOString(), status: 'partially_paid', amount_paid_to_date: 5000 },
];

/**
 * MOCK CONTRACT
 * Input: none
 * Output: ExpectedPayment[]
 * Notes: Lists expected payments for the user
 */
export async function getExpectedPayments(): Promise<ExpectedPayment[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_EXPECTED_PAYMENTS), 600));
}

/**
 * MOCK CONTRACT
 * Input: Omit<ExpectedPayment, 'id' | 'status' | 'amount_paid_to_date'>
 * Output: ExpectedPayment
 * Notes: Creates a new expected payment record
 */
export async function createExpectedPayment(data: any): Promise<ExpectedPayment> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({
      ...data,
      id: `ep_${Math.random()}`,
      status: 'open',
      amount_paid_to_date: 0
    }), 700);
  });
}
