import { AdminAuditLog, PaymentRail } from './types';

const MOCK_AUDIT_LOGS: AdminAuditLog[] = [
  { id: 'log_1', admin_user_id: 'admin_1', action: 'MANUAL_RECONCILIATION_APPROVE', target_type: 'transaction', target_id: 'tx_3', details: 'Approved matching M-PESA float discrepancy', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'log_2', admin_user_id: 'admin_1', action: 'SUSPEND_PROFILE', target_type: 'profile', target_id: 'prof_999', details: 'Suspended due to fraud flags', created_at: new Date(Date.now() - 86400000).toISOString() },
];

const MOCK_RAILS: PaymentRail[] = [
  { id: 'rail_1', name: 'M-PESA STK', adapter_key: 'mpesa_daraja', is_enabled: true, supported_currencies: ['KES'], supported_countries: ['KE'] },
  { id: 'rail_2', name: 'Airtel Money', adapter_key: 'airtel_money', is_enabled: false, supported_currencies: ['KES', 'TZS', 'UGX'], supported_countries: ['KE', 'TZ', 'UG'] },
];

/**
 * MOCK CONTRACT
 * Input: none
 * Output: AdminAuditLog[]
 */
export async function getAuditLogs(): Promise<AdminAuditLog[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_AUDIT_LOGS), 500));
}

/**
 * MOCK CONTRACT
 * Input: none
 * Output: PaymentRail[]
 */
export async function getPaymentRails(): Promise<PaymentRail[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_RAILS), 500));
}
