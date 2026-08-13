import expectedPayments from "../mockData/expectedPayments.json";
import poolsData from "../mockData/pools.json";
import reconciliation from "../mockData/reconciliationMatches.json";
import transactions from "../mockData/transactions.json";
import type {
  ApiResult,
  ExpectedPayment,
  PaymentPool,
  PoolContribution,
  ReconciliationMatch,
  Transaction,
} from "../types";
import { mock } from "./client";

export interface DashboardSummary {
  available_to_withdraw: number;
  pending_settlement: number;
  currency: string;
  exceptions_count: number;
  outstanding_expected_total: number;
  outstanding_expected_count: number;
  active_pool: { pool: PaymentPool; raised: number } | null;
  recent_transactions: Transaction[];
  /** Business-only widget payload. null for individual accounts -> DO NOT RENDER the slot. */
  business_widget: { today_volume: number; today_count: number; top_alias: string } | null;
}

// ============================================
// API CONTRACT: Unified dashboard summary (single aggregate read)
// Endpoint: GET /api/v1/dashboard/summary
// Owned by: Dev C (Phase 7 backend aggregate — reconciliation + balances)
// Request shape: {} (profile derived from the bearer token)
// Response shape: { available_to_withdraw, pending_settlement, currency,
//                   exceptions_count, outstanding_expected_total,
//                   outstanding_expected_count,
//                   active_pool: { pool, raised } | null,
//                   recent_transactions: Transaction[],
//                   business_widget: {...} | null }
// Currently: aggregated client-side from mockData/*.json.
// available_to_withdraw MUST come from settled funds only (settlement_status ===
// "settled"); never sum payment_status alone or we promise money that hasn't landed.
// business_widget is null for individual accounts — the UI must not render the slot.
// ============================================
export async function getDashboardSummary(profileId: string): Promise<ApiResult<DashboardSummary>> {
  return mock<DashboardSummary>(() => {
    const mine = (transactions as Transaction[]).filter((t) => t.recipient_profile_id === profileId);
    const settled = mine.filter((t) => t.settlement_status === "settled");
    const pending = mine.filter(
      (t) => t.payment_status === "completed" && t.settlement_status !== "settled",
    );
    const exceptions = (reconciliation as ReconciliationMatch[]).filter(
      (r) => r.status === "exception" || r.status === "escalated",
    );
    const outstanding = (expectedPayments as ExpectedPayment[]).filter(
      (e) => e.status === "open" || e.status === "partially_paid" || e.status === "overdue",
    );
    const pools = poolsData.payment_pools as PaymentPool[];
    const contributions = poolsData.pool_contributions as PoolContribution[];
    const openPool = pools.find((p) => p.owner_profile_id === profileId && p.status === "open") ?? null;
    const raised = openPool
      ? contributions
          .filter((c) => c.pool_id === openPool.id)
          .reduce((sum, c) => sum + c.amount_paid, 0)
      : 0;

    return {
      available_to_withdraw: settled.reduce((s, t) => s + t.net_amount, 0),
      pending_settlement: pending.reduce((s, t) => s + t.net_amount, 0),
      currency: "KES",
      exceptions_count: exceptions.length,
      outstanding_expected_total: outstanding.reduce(
        (s, e) => s + (e.amount - e.amount_paid_to_date),
        0,
      ),
      outstanding_expected_count: outstanding.length,
      active_pool: openPool ? { pool: openPool, raised } : null,
      recent_transactions: mine
        .slice()
        .sort((a, b) => b.transaction_time.localeCompare(a.transaction_time))
        .slice(0, 6),
      business_widget: { today_volume: 30700, today_count: 4, top_alias: "mamanjeri" },
    };
  }, 800);
}
