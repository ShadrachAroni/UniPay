import { Profile } from './types';

/**
 * MOCK CONTRACT
 * Input: { phone: string }
 * Output: { success: boolean, message: string }
 * Notes: Simulates sending an OTP. Rejects empty phones.
 */
export async function login(phone: string) {
  if (!phone) throw new Error('Phone is required');
  return new Promise((resolve) => {
    setTimeout(() => resolve({ success: true, message: 'OTP sent' }), 800);
  });
}

/**
 * MOCK CONTRACT
 * Input: { phone: string, code: string }
 * Output: { token: string, profile: Profile }
 * Notes: Simulates verifying an OTP. Code "0000" simulates login.
 */
export async function verifyOtp(phone: string, code: string) {
  if (code !== '0000') throw new Error('Invalid OTP');
  return new Promise<{ token: string, profile: Partial<Profile> }>((resolve) => {
    setTimeout(() => resolve({
      token: 'mock-jwt-token-123',
      profile: {
        id: 'prof_123',
        display_name: 'Shadrach Aroni',
        phone,
        verification_status: 'verified'
      }
    }), 800);
  });
}
