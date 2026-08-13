<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/send-money-m-pesa -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# Send Money — M-Pesa

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/send-money-m-pesa> (transcribed 2026-08-13)

Pays money out of the LOOP BIZ account into a recipient's **M-Pesa account**, in a
single synchronous call.

The same underlying endpoint serves three channels (`LOOP`, `MPESA`, `PESALINK`) with
an identical request body; only the `channel` value and destination differ. This page
covers `MPESA`.

**There is no callback.** By the time you receive `statusCode 200` the transfer has
already been executed and the response carries its references; a non-200 means the
transfer did not happen.

This page has the most complete error taxonomy of any captured endpoint — use it as
the reference when debugging any Send Money failure.

## Endpoint

```
POST https://sandbox.loop.co.ke/gateway/send-money-mpesa/1.0/services/process-request
```

`serviceCode`: `MRCHNT_SENDMONEY`

## Request parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `serviceCode` | String | Yes | Must be exactly `MRCHNT_SENDMONEY`. |
| `txnReference` | String | Yes | Unique across every request you have ever sent — a repeat is refused as a duplicate (`statusCode 404`), which is what makes a retry safe. UUID v4 recommended. Reuse only when retrying the same payout after a timeout, 500 or 502. |
| `requestParameters` | Object | Yes | |
| `requestParameters.channel` | String | Yes | Accepts `LOOP`, `MPESA`, `PESALINK` (case-insensitive); anything else is rejected with `statusCode 400`. Set to `MPESA` for this flow. |
| `requestParameters.merchantTill` | String | Yes | The till the payout is drawn from. In sandbox one of `133238`, `133239`, `133240`. Also an input to the signature. |
| `requestParameters.recipientMobileNo` | String | Yes | Recipient's mobile number identifying their **M-Pesa account**. Accepts `2547XXXXXXXX`, `07XXXXXXXX` or `+2547XXXXXXXX` — 8–12 digits, numeric apart from an optional leading `+`. **Validated against the mobile money register before any money moves** — the recipient needs an active M-Pesa account, not a LOOP account. |
| `requestParameters.amount` | String | Yes | Decimal string. Numeric, greater than zero. Fee and tax are applied on top and drawn from your till — the recipient receives the full amount specified. |
| `requestParameters.purposeOfPayment` | String | Yes | Reason carried on the transfer record; reflected in the receiving rail's confirmation to the recipient. |
| `requestParameters.timestamp` | String (date-time) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.nonce` | String (uuid) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.signature` | String | Yes | See [`signing.md`](./signing.md). |

`Content-Type` must be `application/json`.

## Request example

```bash
curl -X POST 'https://sandbox.loop.co.ke/gateway/send-money-mpesa/1.0/services/process-request' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "serviceCode": "MRCHNT_SENDMONEY",
    "txnReference": "7b3d9f2a-5e8c-4a1d-9f6b-2e4c7a0d8b5f",
    "requestParameters": {
      "channel": "MPESA",
      "merchantTill": "133239",
      "recipientMobileNo": "254705568254",
      "amount": "1500.00",
      "purposeOfPayment": "Refund for order INV-2026-000123",
      "timestamp": "2026-07-21T08:47:12Z",
      "nonce": "c2a91b7e-4d05-4f8a-a3c6-9e1f5d7b2a48",
      "signature": "8b48798149f4f71095dabbeea88c116730fb56f18c90970b39d992442f9561c9"
    }
  }'
```

## Response (HTTP 200 — branch on `statusCode`)

Checks are applied **in order and fail fast** — the first failure ends the request, and
**no money leaves your till until every check passes**.

| statusCode | Meaning | Returned when | Your action |
| --- | --- | --- | --- |
| `200` | Success | The transfer was executed. | Record the references. |
| `400` | Bad request | Required field missing/empty; `amount` non-numeric or ≤ 0; `recipientMobileNo` fails format validation; `channel` not one of `LOOP`/`MPESA`/`PESALINK`. | Fix the payload. |
| `401` | Unauthorized | Till not registered to you, or signature/timestamp/nonce did not verify. | Check the till and re-sign. |
| `404` | Duplicate reference | A request already exists for this `txnReference`. | If retrying, the original was already accepted — **do not resend with a new reference**. |
| `461` | Recipient validation failed | The mobile number could not be validated as an active M-Pesa account. **Nothing was sent.** | Verify the recipient's number with them and retry. |
| `462` | No payment instrument | No usable payment instrument for this channel and amount. | Check the till balance and the amount. |
| `463` | Merchant lookup failed | The till did not resolve to a merchant. | Verify the till number. |
| `464` | Transfer declined | Declined because of the data supplied. | Read `message`, correct and retry. |
| `500` | System error | Unexpected error while processing. | Retry with the same `txnReference`; escalate if persistent. |
| `502` | Service error | Temporarily unable to process. Not caused by your payload. | Retry with the same `txnReference`; escalate if persistent. |
| `503` | Validation unavailable | Recipient validation service temporarily unavailable. **No money moved.** | Retry after a short delay with the same `txnReference`. |
| `562` | Validation data error | The validation reply was missing data required to proceed. **No money moved.** | **Escalate** — a problem on LOOP's side, not your payload. |

A `statusCode` can arise from more than one check; `message` distinguishes the cause.
`data` is `{}` on every non-200 `statusCode`.

```json
{
  "statusCode": 200,
  "message": "service process accepted",
  "data": {
    "serviceTransactionStatus": "COMPLETED",
    "requestReference": "1184",
    "txnReference": "7b3d9f2a-5e8c-4a1d-9f6b-2e4c7a0d8b5f",
    "response": {
      "transactionRef": "TXN-20260721-000001184",
      "rspMessage": "SUCCESS",
      "transferStatus": "S",
      "transferOrderId": "TAM202607219372641058",
      "transferRefNo": "5e8b2d4f7a1c40e9b6d3f8a25c7e1b93",
      "rspCode": "SAP00000",
      "requestId": "176905963874052",
      "responseId": "8c2f61d9a47e3b05f9c1e6d24a8b7f30"
    }
  }
}
```

`data.serviceTransactionStatus` is `COMPLETED` once the transfer has executed;
`response.transferStatus` of `S` confirms the rail's own success signal. Individual
response fields are returned only when available — key your reconciliation on
`transactionRef` and `transferOrderId`, and log both with your own `txnReference` for
every payout.

## Retries

- **Never retry a timeout with a new `txnReference`.** You don't know whether the
  transfer executed. A repeat with the same reference is safely refused as a duplicate
  if it already went through; a new reference risks paying twice.
- On `500`, `502`, or a timeout: retry with the same `txnReference` and fresh
  timestamp/nonce/signature, using exponential backoff.
- On any `4xx`: correct the payload before retrying.
- A `461` **always** means nothing was sent.
- If you do not receive a response, treat it as **unresolved, never as a failure** —
  resolve it with [Transaction Status Inquiry](./transaction-status-inquiry.md).

## Signature lockout

**Repeated invalid signatures trigger a temporary lockout**, during which even a
correct request fails. Verify against the worked example in
[`signing.md`](./signing.md) rather than by trial and error against the live sandbox.

An unregistered till is rejected with `statusCode 401` *before a signature is even
evaluated*, since it has no secret key to verify against.

## Error responses

| HTTP Code | Description |
| --- | --- |
| `500` | Genuine unhandled server error (rare — distinct from the handled `statusCode 500` inside a 200). Carries real HTTP 500 and `statusCode 500` in the body. |

## Sandbox → production

Sandbox exercises the same validation, statusCodes and response shape as production
without moving funds — use one of tills `133238`, `133239`, `133240` with channel
`MPESA` and any correctly formatted mobile number.

> **Payouts move real, non-reversible funds in production.** This endpoint sends
> whatever it is asked to send — authorise payouts on your side before the call, and
> start with small amounts.
