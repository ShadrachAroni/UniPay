<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/ (response conventions repeated across all endpoint pages) -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->
<!-- derived: true — consolidated from the response and retry sections of all nine endpoint pages -->

# Request/response conventions

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/> (transcribed 2026-08-13)
> Consolidated from the response sections that repeat across every endpoint page.

Read this before any other endpoint page. Getting these three rules wrong is the
difference between a payment integration that reconciles and one that double-pays.

## Rule 1 — branch on `statusCode`, never on the HTTP status

**The gateway returns HTTP 200 for essentially every outcome, success and handled
failure alike.** The authoritative result is the `statusCode` field *inside the
response body*.

```jsonc
{
  "statusCode": 200,          // <- branch on THIS
  "message": "service process accepted",
  "data": { }                 // empty object {} on every non-200 statusCode
}
```

Code that checks `response.ok` or `resp.status_code == 200` and treats it as success
will silently book failed payments as successful.

A genuine unhandled server error is the one exception — it carries a real HTTP 500
*and* `statusCode: 500` in the body.

## Rule 2 — the request envelope

Every payment endpoint takes the same three-part envelope:

```jsonc
{
  "serviceCode": "...",        // fixed per operation — see the table below
  "txnReference": "...",       // YOUR unique reference for this request
  "requestParameters": {       // operation fields + timestamp/nonce/signature
    ...
  }
}
```

Signing fields belong **inside** `requestParameters`. See [`signing.md`](./signing.md).

### `serviceCode` values

| Operation | `serviceCode` |
| --- | --- |
| LOOP Prompt (request to pay) | `NEO_MRCHNT_RTP` |
| Transaction Status Inquiry | `MRCHNT_TXN_INQUIRY` |
| Pay to LOOP Till / M-Pesa Till / M-Pesa Paybill | `MRCHNT_PAYMENTS` |
| Send Money (LOOP, M-Pesa, PesaLink) | `MRCHNT_SENDMONEY` |

## Rule 3 — `txnReference` is your idempotency key

`txnReference` must be unique across every request you have ever sent. A repeat is
refused as a duplicate (`statusCode 404`) — **and that refusal is the safety
mechanism**, not an error to work around.

### Retry semantics for money-moving endpoints

| Situation | What to do |
| --- | --- |
| Timeout, `500`, or `502` | Retry with the **same** `txnReference` and a **fresh** timestamp/nonce/signature. Use exponential backoff. |
| Any `4xx` statusCode | Correct the payload first. Resending it unchanged fails identically. |
| Duplicate rejection (`404`) on a retry | Confirms the original request already went through. Do **not** resend with a new reference. |
| Payout declined on one rail, resending on another | This is a **new attempt** and needs a **new** `txnReference` — not a retry. |

**Never retry a timeout with a new `txnReference`.** You do not know whether the
transfer executed; a repeat with the same reference is safely refused if it did, while
a new reference risks paying twice.

Transaction Status Inquiry is the exception — see below.

## statusCode banding

Codes are banded: `4xx` means correct the payload before retrying; `5xx` means the
failure was on LOOP's side and retrying with the same `txnReference` is reasonable.

| Code | Meaning | Where it appears |
| --- | --- | --- |
| `200` | Success | all |
| `400` | Bad request — missing/invalid field, bad amount, bad phone format, invalid channel, expired/future timestamp, reused nonce, or signing fields at the request root | all |
| `401` | Unauthorized — till not registered to you, or signature/timestamp/nonce did not verify | all |
| `404` | Duplicate `txnReference` | Send Money, LOOP Prompt, Transaction Inquiry |
| `413` | Data parsing error — payload could not be parsed | LOOP Prompt |
| `422` | Recipient/destination not valid for this rail | Pay to M-Pesa Paybill, Send Money — PesaLink |
| `461` | Recipient validation failed — nothing was sent | Send Money — M-Pesa |
| `462` | No usable payment instrument for this channel and amount | Send Money — LOOP, Send Money — M-Pesa |
| `463` | Merchant lookup failed — till did not resolve to a merchant | Send Money, LOOP Prompt |
| `464` | Transfer/request declined because of the data supplied | Send Money, LOOP Prompt |
| `500` | System error — retry with the same `txnReference` | all |
| `502` | Service error, not caused by your payload — retry with the same `txnReference` | all |
| `503` | Recipient validation service temporarily unavailable. No money moved. | Send Money — M-Pesa |
| `504` | Gateway timeout. Carries `request_id` instead of `data`. | Transaction Status Inquiry |
| `562` | Validation reply missing required data. No money moved. Escalate — LOOP-side problem. | Send Money — M-Pesa |

A `statusCode` can arise from more than one check; the `message` field distinguishes
the cause.

## Reading the success payload

On `statusCode: 200`, `data` carries the outcome — and **HTTP 200 alone does not mean
the money moved**:

```jsonc
{
  "statusCode": 200,
  "data": {
    "serviceTransactionStatus": "COMPLETED",   // COMPLETED | PENDING | FAILED
    "requestReference": "...",                 // LOOP's internal reference
    "txnReference": "...",                     // echoes yours
    "response": {
      "rspMessage": "SUCCESS",
      "transactionRef": "...",
      "transferStatus": "S",                   // transfers: S = success
      "transferOrderId": "...",                // primary reconciliation key
      "rspCode": "SAP00000"                    // or OGW00000 / 00000000 — see below
    }
  }
}
```

Check `serviceTransactionStatus` **and** the response code before considering a
payment settled.

### Success codes by product family

| Code | Returned by |
| --- | --- |
| `OGW00000` | Pay to LOOP Till, Pay to M-Pesa Till, Pay to M-Pesa Paybill |
| `SAP00000` | Send Money (LOOP, M-Pesa, PesaLink) |
| `00000000` | LOOP Prompt, Transaction Status Inquiry (`resultCode`) |

### What to record

Record `transactionRef` and `transferOrderId` against your own payment record.
`transferOrderId` is your primary reconciliation key against a statement;
`transactionRef` is what you quote in a support query. Log both alongside your own
`txnReference` for every payout.

## Callbacks

**Only LOOP Prompt has a callback.** It takes a per-request `callBackUrl` and POSTs
the payment confirmation there once the customer authorises.

Every other documented endpoint — all three Pay-to endpoints, all three Send Money
endpoints, and Transaction Status Inquiry — is **fully synchronous with no callback**.
The response you get is the complete answer.

For LOOP Prompt: acknowledge the callback with a `2xx` quickly, stay idempotent on
`transactionRef`, and **only release goods on the callback** — never on the
synchronous response alone, which confirms delivery of the prompt, not payment.

See [`doc-conflicts.md`](./doc-conflicts.md) — the portal's Introduction page
describes a different, app-level webhook registration model that no endpoint page
corroborates.
