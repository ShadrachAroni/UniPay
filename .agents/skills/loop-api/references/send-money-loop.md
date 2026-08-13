<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/send-money-loop -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# Send Money — LOOP

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/send-money-loop> (transcribed 2026-08-13)

Moves funds directly out of your LOOP BIZ account into a recipient's **LOOP mobile
wallet**. Payout — money goes *out*. Fully synchronous, no callback.

## Endpoint

```
POST https://sandbox.loop.co.ke/gateway/send-money-loop/1.0/services/process-service-request2
```

`serviceCode`: `MRCHNT_SENDMONEY`

> Note the path suffix: `process-service-request2`, **not** `process-request` as on the
> M-Pesa and PesaLink variants. This is the only Send Money endpoint with the `2`
> suffix in the captured documentation.

## Request parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `serviceCode` | String | Yes | Must be exactly `MRCHNT_SENDMONEY`. |
| `txnReference` | String | Yes | Your unique reference for this payout. Unique across every request you have ever sent — a repeat is refused as a duplicate (`statusCode 404`), which is what makes a retry safe. UUID v4 recommended. Reuse **only** when retrying the same payout after a 5xx or timeout — never for a new payout. |
| `requestParameters` | Object | Yes | |
| `requestParameters.channel` | String | Yes | The rail. Accepted: `LOOP`, `MPESA`, `PESALINK` (case-insensitive). Set to `LOOP` for this flow. |
| `requestParameters.merchantTill` | String | Yes | The till the payout is drawn from. In sandbox one of `133238`, `133239`, `133240`. Also an input to the signature. |
| `requestParameters.recipientMobileNo` | String | Yes | Recipient's mobile number, identifying their **LOOP wallet**. Accepts `2547XXXXXXXX`, `07XXXXXXXX` or `+2547XXXXXXXX` — 8–12 digits, numeric apart from an optional leading `+`. |
| `requestParameters.amount` | String | Yes | Decimal string (e.g. `500.00`). Numeric, greater than zero. **Fee and tax are applied on top and drawn from your till** — the recipient receives the full amount specified. |
| `requestParameters.purposeOfPayment` | String | Yes | Reason carried on the transfer record. What you and the recipient reconcile against; the receiving rail sends its own confirmation to the recipient. |
| `requestParameters.timestamp` | String (date-time) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.nonce` | String (uuid) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.signature` | String | Yes | See [`signing.md`](./signing.md). Does **not** cover amount, recipient or channel. |

## Request example

```bash
curl -X POST 'https://sandbox.loop.co.ke/gateway/send-money-loop/1.0/services/process-service-request2' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "serviceCode": "MRCHNT_SENDMONEY",
    "txnReference": "4a8c2e6f-1d9b-4f3a-b7e5-0c6d8a2f4e1b",
    "requestParameters": {
      "channel": "LOOP",
      "merchantTill": "133239",
      "recipientMobileNo": "254705568254",
      "amount": "500.00",
      "purposeOfPayment": "Supplier payment",
      "timestamp": "2026-07-21T08:45:56Z",
      "nonce": "f68836cd-ea13-49d9-85fd-b08fc2f1b795",
      "signature": "1868bb7e1b601ce255c732da494dff0797d36451e59e5d3c4bf79bd8ee70d86a"
    }
  }'
```

## Response (HTTP 200 — branch on `statusCode`)

Codes are banded: `4xx` = correct the payload before retrying; `5xx` = failure on
LOOP's side, retrying with the same `txnReference` is reasonable.

| statusCode | Meaning | Returned when |
| --- | --- | --- |
| `200` | Success | The transfer was executed. |
| `400` | Bad request | Required field missing/empty, `amount` non-numeric or ≤ 0, `recipientMobileNo` fails format validation, or `channel` not one of `LOOP`/`MPESA`/`PESALINK`. |
| `401` | Unauthorized | Till not registered to you, or signature/timestamp/nonce did not verify. |
| `462` | No payment instrument | No usable payment instrument for this channel and amount. |
| `463` | Merchant lookup failed | The till did not resolve to a merchant. |
| `464` | Transfer declined / recipient not resolvable | Declined because of the data supplied, or the mobile number did not resolve to a registered LOOP user. |
| `500` | System error | Unexpected error — retry with the same `txnReference`. |
| `502` | Service error | Temporarily unable to process, not caused by your payload — retry with the same `txnReference`. |

`data` is `{}` on every non-200 `statusCode`.

> The parameter table also references `statusCode 404` for a duplicate `txnReference`,
> though `404` is not listed in this page's statusCode table. Handle it.

```json
{
  "statusCode": 200,
  "message": "service process accepted",
  "data": {
    "serviceTransactionStatus": "COMPLETED",
    "requestReference": "1183",
    "txnReference": "4a8c2e6f-1d9b-4f3a-b7e5-0c6d8a2f4e1b",
    "response": {
      "transactionRef": "TXN-20260721-000001183",
      "rspMessage": "SUCCESS",
      "transferStatus": "S",
      "transferOrderId": "TAM202607215104738291",
      "transferRefNo": "9c1f4b7e2a8d40f6b3e5c7a91d2f8b64",
      "rspCode": "SAP00000",
      "requestId": "176905955621637",
      "responseId": "3d7a91c5e02b48f6a1c9d4e7b25f8036"
    }
  }
}
```

## Retries — this is a payout endpoint

- On a **timeout, 500, or 502**: retry with the **SAME** `txnReference` and a fresh
  timestamp/nonce/signature. **Never a new reference** — the original may already have
  executed, and a new reference would send the money twice.
- A duplicate rejection (`404`) on retry **confirms the original went through**.
- On any `4xx`: correct the payload before retrying. Do not resend unchanged.
- If declined because the recipient can't be reached on this rail, you may resend on
  a different channel (`MPESA` or `PESALINK`) — but that is a **new attempt** needing
  a **NEW** `txnReference`, not a retry.

Record `transactionRef` and `transferOrderId` against your payment record.
`transferOrderId` is your primary reconciliation key against a statement;
`transactionRef` is what you quote in a support query.

## Error responses

| HTTP Code | Description |
| --- | --- |
| `500` | Genuine unhandled server error (rare — distinct from the handled `statusCode 500` inside a 200). Carries real HTTP 500 and `statusCode 500` in the body. |

## Sandbox → production

Sandbox accepts only tills `133238`, `133239`, `133240`, sharing one secret key; any
other till is rejected with `statusCode 401`. Production tills, secrets and endpoint
URL are issued per merchant at onboarding — everything else about the contract stays
the same.

> **Payouts move real, non-reversible funds in production.** Test with accounts you
> control and start with small amounts.
