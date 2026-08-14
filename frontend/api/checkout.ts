import { PaymentIntent, Profile } from './types';

/**
 * MOCK CONTRACT
 * Input: alias string (e.g. "@acme", "@alex")
 * Output: Profile
 * Notes: Resolves alias to recipient profile details for guest checkout
 */
export async function resolveAlias(alias: string): Promise<Profile> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const clean = alias.replace('@', '').toLowerCase();
      if (clean === 'acme') {
        resolve({
          id: 'prof_acme',
          account_type: 'business',
          display_name: 'Acme Enterprises',
          owner_name: 'Sarah Jenkins',
          business_name: 'Acme Enterprises',
          verification_status: 'verified',
          admin_role: null,
        });
      } else {
        resolve({
          id: 'prof_alex',
          account_type: 'individual',
          display_name: 'Alex Johnson',
          owner_name: 'Alex Johnson',
          verification_status: 'verified',
          admin_role: null,
        });
      }
    }, 400);
  });
}

/**
 * MOCK CONTRACT
 * Input: amount number
 * Output: { totalPayerAmount: number, recipientReceivesAmount: number, fee: number }
 * Notes: Calculates fee breakdown for payer transparency
 */
export async function getFeeEstimate(amount: number) {
  return new Promise<{ totalPayerAmount: number; recipientReceivesAmount: number; fee: number }>((resolve) => {
    setTimeout(() => {
      const fee = Math.round(amount * 0.01 + 10); // 1% + 10 KES fee
      resolve({
        totalPayerAmount: amount + fee,
        recipientReceivesAmount: amount,
        fee
      });
    }, 300);
  });
}

/**
 * MOCK CONTRACT
 * Input: amount, recipientProfileId, payerPhone
 * Output: PaymentIntent
 * Notes: Initiates an unauthenticated payment intent
 */
export async function createPaymentIntent(
  amount: number,
  recipientProfileId: string,
  payerPhone: string
): Promise<PaymentIntent> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: `pi_${Math.random().toString(36).substring(2, 9)}`,
        recipient_profile_id: recipientProfileId,
        amount,
        currency: 'KES',
        payer_phone: payerPhone,
        status: 'pending',
        provider_reference: 'MPESA_STK_99210',
      });
    }, 500);
  });
}

/**
 * MOCK CONTRACT
 * Input: intentId string
 * Output: PaymentIntent
 * Notes: Polls status of a guest payment intent
 */
export async function getPaymentIntentStatus(intentId: string): Promise<PaymentIntent> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: intentId,
        recipient_profile_id: 'prof_acme',
        amount: 2500,
        currency: 'KES',
        payer_phone: '+254 700 000 000',
        status: 'succeeded',
        provider_reference: 'MPESA_STK_99210',
      });
    }, 400);
  });
}
