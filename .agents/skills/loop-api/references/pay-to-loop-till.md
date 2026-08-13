<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/pay-to-loop-till -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# Pay to LOOP Till

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/pay-to-loop-till> (transcribed 2026-08-13)

Pay from your LOOP till to **another LOOP merchant till**. The payment stays entirely
within the LOOP network. Useful for inter-merchant payments, settling dues between
LOOP accounts, or moving funds between your own tills.

Fully synchronous — **no callback**.

## Endpoint

```
POST https://sandbox.loop.co.ke/gateway/pay-to-looptill/1.0/services/process-request
```

`serviceCode`: `MRCHNT_PAYMENTS`

## Choosing between the three Pay-to endpoints

| Destination | Use |
| --- | --- |
| A registered **LOOP** merchant till | **This endpoint** |
| An **M-Pesa buy-goods till** | [Pay to M-Pesa Till](./pay-to-mpesa-till.md) |
| An **M-Pesa paybill** business number | [Pay to M-Pesa Paybill](./pay-to-mpesa-paybill.md) |

This endpoint is **LOOP-to-LOOP only**. `merchantRcvTill` must be a registered LOOP
merchant till.

## Request parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `serviceCode` | String | Yes | Must be exactly `MRCHNT_PAYMENTS`. |
| `txnReference` | String | Yes | Your unique reference, used to track and reconcile on both sides. |
| `requestParameters` | Object | Yes | |
| `requestParameters.merchantTill` | String | Yes | Your merchant till. Funds are sent **from** this till. Also an input to the signature. |
| `requestParameters.merchantRcvTill` | String | Yes | The LOOP till you are paying **to**. Must be a registered LOOP merchant till. |
| `requestParameters.accountNumber` | String | Yes | A reference associated with the receiving till. |
| `requestParameters.amount` | String | Yes | Amount to pay, in KES. |
| `requestParameters.channel` | String | Yes | Set to `LOOP` to route within the LOOP network. |
| `requestParameters.timestamp` | String (date-time) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.nonce` | String (uuid) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.signature` | String | Yes | See [`signing.md`](./signing.md). |

## Request example

```bash
curl -X POST 'https://sandbox.loop.co.ke/gateway/pay-to-looptill/1.0/services/process-request' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "serviceCode": "MRCHNT_PAYMENTS",
    "txnReference": "t1GFdyfqv4IFpNbCV1S1DlRGzRY63Yyd",
    "requestParameters": {
      "merchantTill": "133239",
      "merchantRcvTill": "247247",
      "accountNumber": "247247",
      "amount": "350",
      "channel": "LOOP",
      "timestamp": "2026-08-07T11:55:09Z",
      "nonce": "7f768f08-20e5-4720-ba6c-5431f67e3c5c",
      "signature": "a0c4d3e2f1b6..."
    }
  }'
```

## Response (HTTP 200 — branch on `statusCode`)

| statusCode | Cause | Resolution |
| --- | --- | --- |
| `200` | Success | Transfer accepted; check `data.serviceTransactionStatus` and `responseDetails.rspCode`. No callback. |
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
    "requestReference": "20778",
    "txnReference": "t1GFdyfqv4IFpNbCV1S1DlRGzRY63Yyd",
    "response": {
      "rspMessage": "SUCCESS",
      "transactionRef": "20778",
      "responseDetails": {
        "rspCode": "OGW00000",
        "requestId": "178575814838875652",
        "service": "confirmPayment",
        "responseId": "914725535588490a946721e4588db9f0"
      }
    }
  }
}
```

`rspCode` of `OGW00000` means the payment was confirmed. Check
`data.serviceTransactionStatus` (`COMPLETED`, `PENDING` or `FAILED`) **and**
`responseDetails.rspCode` before considering the payment settled.

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
once your integration is approved. The same signing secret is used across all payment
endpoints for a given till.
