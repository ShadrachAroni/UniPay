import { ExpectedPayment } from './types';

const MOCK_EXPECTED: ExpectedPayment[] = [
  {
    id: 'exp_1',
    owner_profile_id: 'prof_123',
    payer_reference: '+254 712 345 678',
    amount: 15000,
    reference: 'Invoice #1042 - Software Dev',
    due_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'overdue',
    amount_paid_to_date: 5000,
  },
  {
    id: 'exp_2',
    owner_profile_id: 'prof_123',
    payer_reference: 'Acme Client',
    amount: 25000,
    reference: 'Design Retainer - Q3',
    due_at: new Date(Date.now() + 86400000 * 5).toISOString(),
    status: 'partially_paid',
    amount_paid_to_date: 10000,
  },
  {
    id: 'exp_3',
    owner_profile_id: 'prof_123',
    payer_reference: 'John Doe',
    amount: 8000,
    reference: 'Consulting Fee',
    due_at: new Date(Date.now() + 86400000 * 10).toISOString(),
    status: 'open',
    amount_paid_to_date: 0,
  },
];

export async function getExpectedPayments(): Promise<ExpectedPayment[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_EXPECTED), 400);
  });
}

export async function getExpectedPayment(id: string): Promise<ExpectedPayment> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const found = MOCK_EXPECTED.find((ep) => ep.id === id);
      if (found) {
        resolve(found);
      } else {
        reject(new Error('Not found'));
      }
    }, 300);
  });
}

export async function createExpectedPayment(
  data: Partial<ExpectedPayment>,
): Promise<ExpectedPayment> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newEp: ExpectedPayment = {
        id: `exp_${Math.random().toString(36).substring(2, 9)}`,
        owner_profile_id: 'prof_123',
        payer_reference: data.payer_reference || 'Payer Ref',
        amount: data.amount || 0,
        reference: data.reference || 'Expected Payment',
        due_at: data.due_at || new Date(Date.now() + 86400000 * 7).toISOString(),
        status: 'open',
        amount_paid_to_date: 0,
      };
      MOCK_EXPECTED.unshift(newEp);
      resolve(newEp);
    }, 500);
  });
}
