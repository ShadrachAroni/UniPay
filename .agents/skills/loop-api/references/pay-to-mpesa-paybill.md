<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/pay-to-m-pesa-paybill -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# Pay to M-Pesa Paybill

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/pay-to-m-pesa-paybill> (transcribed 2026-08-13)

Pay a bill directly from your LOOP till to any **M-Pesa paybill**. You provide the
paybill number, an account reference, and the amount — useful for settling utility
bills, vendor invoices, or any obligation that accepts payment via an M-Pesa paybill.

Fully synchronous — **no callback**.

## Endpoint

```
POST https://sandbox.loop.co.ke/gateway/pay-to-paybill/1.0/services/process-request
```

`serviceCode`: `MRCHNT_PAYMENTS`

> Note the path is `pay-to-paybill`, not `pay-to-mpesa-paybill` as the page title
> might suggest.

For an M-Pesa buy-goods till use [Pay to M-Pesa Till](./pay-to-mpesa-till.md); for a
LOOP merchant till use [Pay to LOOP Till](./pay-to-loop-till.md).

## Request parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `serviceCode` | String | Yes | Must be exactly `MRCHNT_PAYMENTS`. |
| `txnReference` | String | Yes | Your unique reference, used to track and reconcile on both sides. |
| `requestParameters` | Object | Yes | |
| `requestParameters.merchantTill` | String | Yes | Your merchant till. Funds are sent **from** this till. Also an input to the signature. |
| `requestParameters.merchantRcvTill` | String | Yes | The **M-Pesa paybill business number** you are paying to. |
| `requestParameters.accountNumber` | String | Yes | The account reference the paybill expects — a customer account number, invoice number, or meter number. **This varies by paybill operator.** |
| `requestParameters.amount` | String | Yes | Amount to pay, in KES. |
| `requestParameters.channel` | String | Yes | The parameter table says set to `LOOP`. **See the conflict note below.** |
| `requestParameters.timestamp` | String (date-time) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.nonce` | String (uuid) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.signature` | String | Yes | See [`signing.md`](./signing.md). |

### ⚠️ Conflicting `channel` value

| Where on the page | `channel` value |
| --- | --- |
| Parameter table | `LOOP` |
| cURL example | `LOOP` |
| "Step 3 — Build the request body" example | `MPESAPAYBILL` |

Same unresolved contradiction as Pay to M-Pesa Till. Two of three say `LOOP`. Confirm
before going live — see [`doc-conflicts.md`](./doc-conflicts.md).

## Request example

```bash
curl -X POST 'https://sandbox.loop.co.ke/gateway/pay-to-paybill/1.0/services/process-request' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "serviceCode": "MRCHNT_PAYMENTS",
    "txnReference": "d8176892-cec5-494a-b33c-f6708985d2e6",
    "requestParameters": {
      "merchantTill": "133239",
      "merchantRcvTill": "247247",
      "accountNumber": "247247",
      "amount": "350",
      "channel": "LOOP",
      "timestamp": "2026-08-07T10:30:00Z",
      "nonce": "d4e5f6a7-b8c9-0123-defa-234567890123",
      "signature": "e7a2b1c0d9f4..."
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
| `422` | The paybill number or account reference provided is not valid. | Verify both with the recipient before retrying. |

`data` is `{}` on every non-200 `statusCode`.

```json
{
  "statusCode": 200,
  "message": "service process accepted",
  "data": {
    "serviceTransactionStatus": "COMPLETED",
    "requestReference": "20686",
    "txnReference": "d8176892-cec5-494a-b33c-f6708985d2e6",
    "response": {
      "rspMessage": "SUCCESS",
      "transactionRef": "20686",
      "responseDetails": {
        "rspCode": "OGW00000",
        "requestId": "178575126742334647",
        "service": "confirmPayment",
        "responseId": "5e477b85ab0741138cf2c8150fd3f46c"
      }
    }
  }
}
```

`rspCode` of `OGW00000` means the payment was confirmed. Check
`data.serviceTransactionStatus` **and** `responseDetails.rspCode` before considering
the bill paid.

## Retries

- On `422`: verify the paybill number and account reference with the recipient before
  retrying — the paybill may not be reachable through the LOOP payment network, or the
  account reference may not be valid for it. **Contact the LOOP integrations team if a
  paybill you expect to work keeps failing.**
- On any `400`/`401`: correct the payload or credentials before retrying.

## Error responses

| HTTP Code | Description |
| --- | --- |
| `500` | Genuine unhandled server error (rare — distinct from a handled failure returned inside a 200). Carries real HTTP 500. |

## Sandbox → production

Sandbox till number and signing secret are issued on the Developer Portal for testing;
do not use them in production. Production credentials come from the Merchant Portal
once your integration is approved.
