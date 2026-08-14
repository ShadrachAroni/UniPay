import { Profile, Alias } from './types';

/**
 * MOCK CONTRACT
 * Input: profileId string
 * Output: Profile object
 * Notes: Simulates fetching user profile details
 */
export async function getProfile(id: string): Promise<Profile> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({
      id,
      account_type: 'business',
      display_name: 'Shadrach Aroni',
      owner_name: 'Shadrach Aroni',
      phone: '+254 712 345 678',
      email: 'shadrach@unipay.test',
      currency: 'KES',
      verification_status: 'verified'
    }), 500);
  });
}

/**
 * MOCK CONTRACT
 * Input: profileId string, updates Partial<Profile>
 * Output: Profile object updated
 * Notes: Simulates saving profile changes
 */
export async function updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
  const current = await getProfile(id);
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ...current, ...updates }), 600);
  });
}
