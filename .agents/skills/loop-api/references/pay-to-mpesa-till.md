<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/pay-to-m-pesa-till -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# Pay to M-Pesa Till

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/pay-to-m-pesa-till> (transcribed 2026-08-13)

Pay directly from your LOOP BIZ account to an **M-Pesa buy-goods till**. You provide
the till number, a reference, and the amount — the equivalent of scanning a till for a
buy-goods payment, initiated programmatically from your system.

Fully synchronous — **no callback**.

## Endpoint

```
POST https://sandbox.loop.co.ke/gateway/pay-to-mpesa-till/1.0/services/process-request
```

`serviceCode`: `MRCHNT_PAYMENTS`

For a LOOP merchant till use [Pay to LOOP Till](./pay-to-loop-till.md); for a paybill
business number use [Pay to M-Pesa Paybill](./pay-to-mpesa-paybill.md).

## Request parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `serviceCode` | String | Yes | Must be exactly `MRCHNT_PAYMENTS`. |
| `txnReference` | String | Yes | Your unique reference, used to track and reconcile on both sides. |
| `requestParameters` | Object | Yes | |
| `requestParameters.merchantTill` | String | Yes | Your merchant till. Funds are sent **from** this till. Also an input to the signature. |
| `requestParameters.merchantRcvTill` | String | Yes | The **M-Pesa buy-goods till number** you are paying to. |
| `requestParameters.accountNumber` | String | Yes | A reference associated with the receiving till. |
| `requestParameters.amount` | String | Yes | Amount to pay, in KES. |
| `requestParameters.channel` | String | Yes | The parameter table says set to `LOOP`. **See the conflict note below.** |
| `requestParameters.timestamp` | String (date-time) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.nonce` | String (uuid) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.signature` | String | Yes | See [`signing.md`](./signing.md). |

### ⚠️ Conflicting `channel` value

LOOP's page contradicts itself:

| Where on the page | `channel` value |
| --- | --- |
| Parameter table | `LOOP` |
| cURL example | `LOOP` |
| "Step 3 — Build the request body" example | `MPESATILL` |

Two of three say `LOOP`, so that is the more likely correct value — but this is
**unresolved**, and it is the kind of mismatch that produces a `400` with an unhelpful
message. Confirm with LOOP support or the portal's Swagger before going live. See
[`doc-conflicts.md`](./doc-conflicts.md).

The same page's Step 3 example also **omits `accountNumber`**, which its own parameter
table marks required. The cURL example includes it. Include it.

## Request example

```bash
curl -X POST 'https://sandbox.loop.co.ke/gateway/pay-to-mpesa-till/1.0/services/process-request' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "serviceCode": "MRCHNT_PAYMENTS",
    "txnReference": "e9f0a1b2-c3d4-5678-ef01-345678901234",
    "requestParameters": {
      "merchantTill": "133239",
      "merchantRcvTill": "247247",
      "accountNumber": "247247",
      "amount": "350",
      "channel": "LOOP",
      "timestamp": "2026-08-07T10:30:00Z",
      "nonce": "e5f6a7b8-c9d0-1234-efab-345678901234",
      "signature": "f8b3c2d1e0a5..."
    }
  }'
```

## Response (HTTP 200 — branch on `statusCode`)

| statusCode | Cause | Resolution |
| --- | --- | --- |
| `200` | Success | Payment accepted; check `data.serviceTransactionStatus` and `responseDetails.rspCode`. No callback. |
| `400` | Timestamp expired or set in the future. | Generate a fresh UTC timestamp at request time. |
| `400` | Nonce already used. | Generate a new unique nonce for every request — never reuse, even on retry. |
| `400` | Signing fields at the request root instead of inside `requestParameters`. | Move `timestamp`, `nonce` and `signature` into `requestParameters`. |
| `400` | A required field is missing or invalid. | Review all required parameters and formats. |
| `401` | Bearer token missing, invalid, or expired. | Generate a fresh token and retry. |
| `401` | Signature verification failed. | Check signing order (`merchantTill`, then `timestamp`, then `nonce`), the secret key, and hex encoding. |

`data` is `{}` on every non-200 `statusCode`.

```json
{
  "statusCode": 200,
  "message": "service process accepted",
  "data": {
    "serviceTransactionStatus": "COMPLETED",
    "requestReference": "20687",
    "txnReference": "e9f0a1b2-c3d4-5678-ef01-345678901234",
    "response": {
      "rspMessage": "SUCCESS",
      "transactionRef": "20687",
      "responseDetails": {
        "rspCode": "OGW00000",
        "requestId": "178575126742334648",
        "service": "confirmPayment",
        "responseId": "6f588c96bc1852249dg7832f5699ec5d"
      }
    }
  }
}
```

`rspCode` of `OGW00000` means the payment was confirmed.

## Retries

On any `400`/`401` `statusCode`, correct the payload or credentials before retrying —
resending it unchanged fails the same way.

## Error responses

| HTTP Code | Description |
| --- | --- |
| `500` | Genuine unhandled server error (rare — distinct from a handled failure returned inside a 200). Carries real HTTP 500. |

## Sandbox → production

Sandbox till number and signing secret are issued on the Developer Portal for testing;
do not use them in production. Production credentials come from the Merchant Portal
once your integration is approved.
