/**
 * MOCK CONTRACT
 * Input: none
 * Output: { balance: number, pending: number, recentCount: number, currency: string }
 * Notes: Provides high-level numbers for the home tab
 */
export async function getDashboardStats() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({
      balance: 14500,
      pending: 3200,
      recentCount: 12,
      currency: 'KES'
    }), 500);
  });
}
