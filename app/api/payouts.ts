import { Payout } from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export async function getPayouts(token?: string): Promise<Payout[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_URL}/api/v1/payouts`, { headers });
    if (res.ok) {
      const data = await res.json();
      return (data.payouts || []).map((p: any) => ({
        id: p.id,
        profile_id: p.profile_id,
        requested_amount: Number(p.requested_amount),
        destination_reference: p.destination_reference || p.destination_type,
        status: p.status,
        requested_at: p.requested_at,
      }));
    }
  } catch (err: any) {
    console.log('Error fetching payouts from API:', err.message);
  }

  // Demo fallback
  return [
    {
      id: 'po_1',
      profile_id: 'p-1001',
      requested_amount: 10000,
      destination_reference: 'NCBA Bank ****1023',
      status: 'completed',
      requested_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'po_2',
      profile_id: 'p-1001',
      requested_amount: 5000,
      destination_reference: 'M-PESA (+254704540384)',
      status: 'processing',
      requested_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
}

export async function requestPayout(
  amount: number,
  destination_reference: string,
  destination_type = 'mpesa',
  token?: string,
  profileId?: string
): Promise<Payout> {
  const idempotencyKey = `po_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'idempotency-key': idempotencyKey,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/api/v1/payouts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        profile_id: profileId,
        amount,
        currency: 'KES',
        destination_type,
        destination_reference,
        remarks: `UniPay payout to ${destination_reference}`,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const p = data.payout;
      return {
        id: p.id,
        profile_id: p.profile_id,
        requested_amount: Number(p.requested_amount),
        destination_reference: p.destination_reference || destination_reference,
        status: p.status,
        requested_at: p.requested_at,
      };
    }
  } catch (err: any) {
    console.log('Error requesting payout via API:', err.message);
  }

  // Simulation fallback
  return {
    id: idempotencyKey,
    profile_id: profileId || 'p-1001',
    requested_amount: amount,
    destination_reference,
    status: 'processing',
    requested_at: new Date().toISOString(),
  };
}
