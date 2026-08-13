import type { ApiResult } from "../types";
import { mock } from "./client";

export interface ExportJob {
  job_id: string;
  status: "queued" | "ready";
  download_url: string | null;
  row_count: number;
}

// ============================================
// API CONTRACT: CSV export of transactions
// Endpoint: POST /api/v1/exports/transactions
// Owned by: Dev C (Phase 4 — ledger)
// Request shape: { from?: string, to?: string, payment_status?, settlement_status? }
// Response shape: { job_id, status: "queued"|"ready", download_url, row_count }
// Currently: returns a fake job id after a delay; no file is produced.
//
// !! PRIVACY REQUIREMENT (server-side, non-negotiable) !!
// The generated CSV MUST NOT contain id_number or id_document_url columns, nor any
// other identity-document field. Column allow-list is enforced on the SERVER — the
// client cannot be trusted to strip columns. Approved columns:
//   transaction_id, transaction_time, amount, currency, provider_fee, net_amount,
//   payment_status, settlement_status, settled_at, reference
// ============================================
export async function exportTransactionsCsv(profileId: string): Promise<ApiResult<ExportJob>> {
  return mock<ExportJob>(
    () => ({
      job_id: "exp_" + Math.random().toString(36).slice(2, 9),
      status: "ready",
      download_url: null,
      row_count: 8,
    }),
    900,
  );
}

// ============================================
// API CONTRACT: CSV export of a pool's contributions
// Endpoint: POST /api/v1/exports/pools/{pool_id}
// Owned by: Dev C (Phase 4B — pooled payments)
// Request shape: { pool_id: string } (path param)
// Response shape: { job_id, status, download_url, row_count }
// Currently: fake job id. Same server-side column allow-list rule as above —
// contributor identity documents are never exportable.
// ============================================
export async function exportPoolCsv(poolId: string): Promise<ApiResult<ExportJob>> {
  return mock<ExportJob>(
    () => ({
      job_id: "exp_" + Math.random().toString(36).slice(2, 9),
      status: "ready",
      download_url: null,
      row_count: 5,
    }),
    900,
  );
}
