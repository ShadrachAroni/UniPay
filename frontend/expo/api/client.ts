// ============================================
// MOCK TRANSPORT — the single swap point.
//
// Every api/* function goes through `mock()` today. When Dev A/B/C ship a real
// endpoint, replace ONLY that function's `mock(...)` body with `request(...)`.
// No screen changes are required: screens already branch on ApiResult.kind
// ("ok" | "rate_limited" | "error").
//
// Backend applies TOKEN-BUCKET RATE LIMITING on public endpoints (checkout,
// alias resolve, intent status polling). 429 is a normal, expected response —
// every screen must render a distinct "too many requests" state for it.
// ============================================

import type { ApiResult } from "../types";

export const API_BASE_URL = "https://api.unipay.test";
export const API_VERSION = "v1";

/** Flip to true to exercise 429 states across the whole app during QA. */
export let FORCE_RATE_LIMIT = false;
export const setForceRateLimit = (v: boolean) => {
  FORCE_RATE_LIMIT = v;
};

/** Flip to true to exercise generic error states (distinct from empty state). */
export let FORCE_ERROR = false;
export const setForceError = (v: boolean) => {
  FORCE_ERROR = v;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Simulates a network call against mock data. */
export async function mock<T>(data: T | (() => T), delayMs = 550): Promise<ApiResult<T>> {
  await sleep(delayMs);
  if (FORCE_RATE_LIMIT) return { kind: "rate_limited", retryAfterSeconds: 30 };
  if (FORCE_ERROR) return { kind: "error", message: "Something went wrong. Please try again." };
  const value = typeof data === "function" ? (data as () => T)() : data;
  return { kind: "ok", data: value };
}

/**
 * REAL transport. Not used yet — every endpoint in §18 is currently a 501 stub.
 * Kept here so swapping a function is a one-line change.
 */
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/${API_VERSION}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? 30);
      return { kind: "rate_limited", retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : 30 };
    }
    if (res.status === 501) {
      return { kind: "error", message: "This feature is not available yet." };
    }
    if (!res.ok) {
      return { kind: "error", message: `Request failed (${res.status}).` };
    }
    return { kind: "ok", data: (await res.json()) as T };
  } catch {
    return { kind: "error", message: "Network unavailable. Check your connection." };
  }
}

/** Deep-clone helper so screens can mutate mock results without corrupting fixtures. */
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
