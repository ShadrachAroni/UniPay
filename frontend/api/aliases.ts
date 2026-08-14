import { Alias } from './types';

/**
 * MOCK CONTRACT
 * Input: profileId string
 * Output: Array of Alias objects
 * Notes: Returns list of known payment aliases (e.g. M-PESA paybill or username)
 */
export async function getAliases(profileId: string): Promise<Alias[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve([
      { id: 'alias_1', profile_id: profileId, alias: '@shadrach', is_verified: true, status: 'active' },
      { id: 'alias_2', profile_id: profileId, alias: 'Paybill 123456', is_verified: true, status: 'active' }
    ]), 500);
  });
}

/**
 * MOCK CONTRACT
 * Input: profileId string, alias string
 * Output: Alias object
 * Notes: Simulates creating a new alias and putting it in pending verification
 */
export async function createAlias(profileId: string, alias: string): Promise<Alias> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({
      id: `alias_${Math.random()}`,
      profile_id: profileId,
      alias,
      is_verified: false,
      status: 'inactive'
    }), 600);
  });
}
