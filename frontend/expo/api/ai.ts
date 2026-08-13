import type { ApiResult } from "../types";
import { mock } from "./client";

export interface DashboardAnswer {
  /** Short natural-language answer. MUST always be displayed with `explanation`. */
  answer: string;
  /** How the number was derived: source rows, filters, time window. */
  explanation: string;
  /** Optional structured value backing the answer. */
  value?: { amount: number; currency: string } | { count: number };
}

// ============================================
// API CONTRACT: Natural-language dashboard query
// Endpoint: POST /api/v1/ai/dashboard-query
// Owned by: Dev C (Phase 5 — AI service)
// Request shape: { query: string, profile_id: string }
// Response shape: { answer: string, explanation: string,
//                   value?: { amount, currency } | { count } }
// Currently: answerDashboardQuery() returns canned {answer, explanation} pairs.
// HARD UI RULE: never render `answer`/`value` without `explanation`. A bare number
// with no derivation is unauditable and is treated as a product defect.
// Rate limited more aggressively than other endpoints (AI cost) — the 429 state
// must be visible, not silent.
// ============================================
export async function answerDashboardQuery(
  query: string,
  profileId: string,
): Promise<ApiResult<DashboardAnswer>> {
  return mock<DashboardAnswer>(() => {
    const q = query.toLowerCase();
    if (q.includes("owe") || q.includes("outstanding") || q.includes("expect")) {
      return {
        answer: "KES 40,100.00 is still outstanding across 3 expected payments.",
        explanation:
          "Summed (amount − amount_paid_to_date) for expected_payments with status open, partially_paid or overdue. Excludes 1 cancelled record.",
        value: { amount: 40100, currency: "KES" },
      };
    }
    if (q.includes("exception") || q.includes("unmatched")) {
      return {
        answer: "You have 3 open reconciliation exceptions.",
        explanation:
          "Counted reconciliation_matches with status exception or escalated. Two are fuzzy matches below 0.75 confidence; one has no candidate at all.",
        value: { count: 3 },
      };
    }
    if (q.includes("withdraw") || q.includes("balance") || q.includes("available")) {
      return {
        answer: "KES 20,438.75 is available to withdraw right now.",
        explanation:
          "Only transactions with settlement_status = settled are counted, using net_amount after provider fees. KES 26,348.75 more is completed but still unsettled.",
        value: { amount: 20438.75, currency: "KES" },
      };
    }
    return {
      answer: "Your last 7 days settled KES 20,438.75 across 3 payments.",
      explanation:
        "Filtered transactions by transaction_time within 7 days and settlement_status = settled, then summed net_amount. Failed and processing payments were excluded.",
      value: { amount: 20438.75, currency: "KES" },
    };
  }, 1100);
}
