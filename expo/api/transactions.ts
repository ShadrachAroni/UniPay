import reconciliation from "../mockData/reconciliationMatches.json";
import transactions from "../mockData/transactions.json";
import type { ApiResult, ReconciliationMatch, Transaction } from "../types";
import { mock } from "./client";

// ============================================
// API CONTRACT: List transactions for the signed-in profile
// Endpoint: GET /api/v1/transactions?cursor=&limit=&payment_status=&settlement_status=
// Owned by: Dev C (Phase 4 — ledger & reconciliation)
// Request shape: { cursor?: string, limit?: number, payment_status?, settlement_status? }
// Response shape: { items: Transaction[], next_cursor: string | null }
// Currently: filters mockData/transactions.json in memory.
// payment_status and settlement_status are INDEPENDENT axes and must stay separate
// in both the API and the UI — never collapsed into one derived status.
// ============================================
export async function listTransactions(profileId: string): Promise<ApiResult<Transaction[]>> {
  return mock<Transaction[]>(
    () =>
      (transactions as Transaction[])
        .filter((t) => t.recipient_profile_id === profileId)
        .sort((a, b) => b.transaction_time.localeCompare(a.transaction_time)),
    700,
  );
}

export interface TransactionDetail {
  transaction: Transaction;
  match: ReconciliationMatch | null;
}

// ============================================
// API CONTRACT: Single transaction with its AI reconciliation annotation
// Endpoint: GET /api/v1/transactions/{id}
// Owned by: Dev C (Phase 4 — reconciliation) + Dev C (Phase 5 — AI explanation)
// Request shape: { id: string } (path param)
// Response shape: { transaction: Transaction,
//                   match: { confidence_score, ai_explanation, match_type, status } | null }
// Currently: joins mockData/transactions.json to reconciliationMatches.json.
// ai_explanation renders as an annotated line under the amount — the confidence
// score alone is never shown without its explanation text.
// ============================================
export async function getTransaction(id: string): Promise<ApiResult<TransactionDetail | null>> {
  return mock<TransactionDetail | null>(() => {
    const transaction = (transactions as Transaction[]).find((t) => t.id === id);
    if (!transaction) return null;
    const match =
      (reconciliation as ReconciliationMatch[]).find((r) => r.transaction_id === id) ?? null;
    return { transaction, match };
  }, 600);
}

// ============================================
// API CONTRACT: Reconciliation exceptions for the signed-in profile
// Endpoint: GET /api/v1/reconciliation/exceptions
// Owned by: Dev C (Phase 4 — reconciliation)
// Request shape: { status?: "exception" | "escalated" }
// Response shape: { items: ReconciliationMatch[] }
// Currently: filters mockData/reconciliationMatches.json.
// ============================================
export async function listExceptions(): Promise<ApiResult<ReconciliationMatch[]>> {
  return mock<ReconciliationMatch[]>(
    () =>
      (reconciliation as ReconciliationMatch[]).filter(
        (r) => r.status === "exception" || r.status === "escalated",
      ),
    650,
  );
}
