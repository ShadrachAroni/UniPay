import aliases from "../mockData/aliases.json";
import profiles from "../mockData/profiles.json";
import type { ApiResult, PaymentIntent, PaymentIntentStatus, Profile } from "../types";
import { mock } from "./client";

export interface ResolvedAlias {
  alias: string;
  profile_id: string;
  display_name: string;
  is_verified: boolean;
  account_type: Profile["account_type"];
}

// ============================================
// API CONTRACT: Resolve a payment alias to a recipient (guest, unauthenticated)
// Endpoint: GET /api/v1/aliases/{alias}/resolve
// Owned by: Dev A (Phase 1 — identity & aliases)
// Request shape: { alias: string }  (path param)
// Response shape: { alias, profile_id, display_name, is_verified, account_type }
// Currently: looks up mockData/aliases.json + profiles.json with a 700ms delay.
// PUBLIC endpoint — token-bucket rate limited. Handle 429 explicitly in the UI.
// Never return phone/email here; the payer must not learn the recipient's PII.
// ============================================
export async function resolveAlias(alias: string): Promise<ApiResult<ResolvedAlias | null>> {
  return mock<ResolvedAlias | null>(() => {
    const found = aliases.find(
      (a) => a.alias.toLowerCase() === alias.trim().toLowerCase() && a.status === "active",
    );
    if (!found) return null;
    const profile = profiles.find((p) => p.id === found.profile_id) as Profile | undefined;
    if (!profile) return null;
    return {
      alias: found.alias,
      profile_id: profile.id,
      display_name: profile.display_name,
      is_verified: found.is_verified && profile.verification_status === "verified",
      account_type: profile.account_type,
    };
  }, 700);
}

export interface FeeEstimate {
  amount: number;
  provider_fee: number;
  net_amount: number;
  currency: string;
  rail: string;
}

// ============================================
// API CONTRACT: Fee transparency quote before the payer commits
// Endpoint: POST /api/v1/fees/estimate
// Owned by: Dev B (Phase 3 — LOOP adapter & fee engine)
// Request shape: { amount: number, currency: "KES", recipient_profile_id: string }
// Response shape: { amount, provider_fee, net_amount, currency, rail }
// Currently: computes 1.5% locally. The real fee table lives on the rail adapter
// and MUST be the displayed source of truth — never re-derive fees on the client.
// PUBLIC endpoint — token-bucket rate limited.
// ============================================
export async function estimateFee(
  amount: number,
  recipientProfileId: string,
): Promise<ApiResult<FeeEstimate>> {
  return mock<FeeEstimate>(() => {
    const fee = Math.round(amount * 0.015 * 100) / 100;
    return {
      amount,
      provider_fee: fee,
      net_amount: Math.round((amount - fee) * 100) / 100,
      currency: "KES",
      rail: "LOOP",
    };
  }, 500);
}

// ============================================
// API CONTRACT: Create a payment intent and trigger the LOOP STK push
// Endpoint: POST /api/v1/payment-intents
// Owned by: Dev B (Phase 3 — LOOP adapter)
// Request shape: { recipient_profile_id: string, amount: number, currency: "KES",
//                  payer_phone: string, reference?: string }
// Response shape: PaymentIntent { id, recipient_profile_id, amount, currency,
//                  payer_phone, status, provider_reference }
// Currently: returns a synthetic intent with status "awaiting_payer".
// PUBLIC endpoint — token-bucket rate limited; a 429 here must NOT look like a
// payment failure to the payer (no money moved).
// ============================================
export async function createPaymentIntent(input: {
  recipient_profile_id: string;
  amount: number;
  payer_phone: string;
  reference?: string;
}): Promise<ApiResult<PaymentIntent>> {
  return mock<PaymentIntent>(
    () => ({
      id: "pi_" + Math.random().toString(36).slice(2, 10),
      recipient_profile_id: input.recipient_profile_id,
      amount: input.amount,
      currency: "KES",
      payer_phone: input.payer_phone,
      status: "awaiting_payer",
      provider_reference: null,
    }),
    900,
  );
}

// ============================================
// API CONTRACT: Poll payment intent status while the payer approves on their phone
// Endpoint: GET /api/v1/payment-intents/{id}
// Owned by: Dev B (Phase 3 — LOOP adapter + webhook receiver)
// Request shape: { id: string } (path param)
// Response shape: PaymentIntent (status transitions awaiting_payer -> pending ->
//                  succeeded | failed; provider_reference set on completion)
// Currently: a scripted state machine that resolves after ~4 polls.
// REAL BEHAVIOUR: the rail webhook POSTs /api/v1/webhooks/loop (Dev B) and this
// GET is the client-safe read of that result. Poll at >= 2s and stop after 90s;
// this endpoint is token-bucket rate limited.
// ============================================
let pollCount = 0;
export const resetIntentPolling = () => {
  pollCount = 0;
};

export async function getPaymentIntent(
  id: string,
  opts?: { forceFailure?: boolean },
): Promise<ApiResult<PaymentIntent>> {
  return mock<PaymentIntent>(() => {
    pollCount += 1;
    let status: PaymentIntentStatus = "awaiting_payer";
    if (pollCount >= 2) status = "pending";
    if (pollCount >= 4) status = opts?.forceFailure ? "failed" : "succeeded";
    return {
      id,
      recipient_profile_id: "prf_001",
      amount: 0,
      currency: "KES",
      payer_phone: "",
      status,
      provider_reference:
        status === "succeeded" || status === "failed"
          ? "LOOP-" + id.slice(-6).toUpperCase()
          : null,
    };
  }, 1400);
}
