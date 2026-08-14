import { PaymentIntent } from './types';

/**
 * MOCK CONTRACT
 * Input: { recipientId, amount, currency, payerPhone }
 * Output: PaymentIntent
 * Notes: Simulates initiating an STK push or checkout session
 */
export async function createPaymentIntent(
  recipientId: string, 
  amount: number, 
  currency: string, 
  payerPhone: string
): Promise<PaymentIntent> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({
      id: `pi_${Math.random().toString(36).substring(2, 9)}`,
      recipient_profile_id: recipientId,
      amount,
      currency,
      payer_phone: payerPhone,
      status: 'pending'
    }), 800);
  });
}
