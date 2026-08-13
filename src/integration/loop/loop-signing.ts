import crypto from 'crypto';

export interface LoopSignatureInput {
  merchantTill: string;
  timestamp: string; // ISO-8601 UTC, e.g. "2026-07-21T07:37:56Z"
  nonce: string; // lowercase UUID v4
  secretKey: string;
}

/**
 * Computes the canonical HMAC-SHA256 signature for LOOP payment request headers/parameters.
 * Canonical string: `${merchantTill}|${timestamp}|${nonce}`
 * Output format: lowercase hex string.
 */
export function generateLoopSignature(input: LoopSignatureInput): string {
  const canonicalString = `${input.merchantTill}|${input.timestamp}|${input.nonce}`;
  return crypto
    .createHmac('sha256', input.secretKey)
    .update(canonicalString, 'utf-8')
    .digest('hex')
    .toLowerCase();
}
