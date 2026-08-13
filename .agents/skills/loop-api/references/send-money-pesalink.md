<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/send-money-pesalink -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# Send Money — PesaLink

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/send-money-pesalink> (transcribed 2026-08-13)

Sends money from your LOOP BIZ account directly to a recipient's **bank account**.
Funds are routed through PesaLink using the recipient's registered mobile number —
useful for paying suppliers, staff, or any individual whose bank account is linked to
their mobile number.

Fully synchronous — **no callback**.

## Endpoint

```
POST https://sandbox.loop.co.ke/gateway/send-money-pesalink/1.0/services/process-request
```

`serviceCode`: `MRCHNT_SENDMONEY`

## Request parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `serviceCode` | String | Yes | Must be exactly `MRCHNT_SENDMONEY`. |
| `txnReference` | String | Yes | Your unique reference, used to track and reconcile on both sides. |
| `requestParameters` | Object | Yes | |
| `requestParameters.merchantTill` | String | Yes | Your merchant till. Funds are sent from this till. Also an input to the signature. |
| `requestParameters.recipientMobileNo` | String | Yes | Recipient's mobile number in **international format without a leading plus sign**, no spaces or brackets (e.g. `254705568254`). **Must be linked to a PesaLink-enabled bank account.** |
| `requestParameters.amount` | String | Yes | Amount to send, in KES. |
| `requestParameters.purposeOfPayment` | String | Yes | Brief description of why the payment is being made. |
| `requestParameters.channel` | String | Yes | Set to `PESALINK` to route through the PesaLink network. |
| `requestParameters.timestamp` | String (date-time) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.nonce` | String (uuid) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.signature` | String | Yes | See [`signing.md`](./signing.md). |

> Note the stricter phone format here. Send Money — LOOP and — M-Pesa accept
> `07XXXXXXXX` and `+2547XXXXXXXX`; this page specifies international format **without**
> the leading `+`.

## Request example

```bash
curl -X POST 'https://sandbox.loop.co.ke/gateway/send-money-pesalink/1.0/services/process-request' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "serviceCode": "MRCHNT_SENDMONEY",
    "txnReference": "86bebc3a-8c2b-4b37-a774-a70e10c591b1",
    "requestParameters": {
      "merchantTill": "133177",
      "recipientMobileNo": "254705568254",
      "amount": "500",
      "purposeOfPayment": "Supplier payment",
      "channel": "PESALINK",
      "timestamp": "2026-08-07T10:30:00Z",
      "nonce": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "signature": "c5e0f3a4b1d8..."
    }
  }'
```

> ⚠️ This example uses till `133177`, which is **not** one of the three sandbox tills
> (`133238`/`133239`/`133240`) that every other page lists. Copying it verbatim into
> sandbox will fail with `statusCode 401`. See [`doc-conflicts.md`](./doc-conflicts.md).

## Response (HTTP 200 — branch on `statusCode`)

| statusCode | Cause | Resolution |
| --- | --- | --- |
| `200` | Success | Transfer accepted; check `data.serviceTransactionStatus` and `responseDetails.transferStatus` for the actual outcome. No callback. |
| `400` | Timestamp expired or set in the future. | Generate a fresh UTC timestamp at request time. |
| `400` | Nonce already used. | Generate a new unique nonce for every request — never reuse, even on retry. |
| `400` | Signing fields at the request root instead of inside `requestParameters`. | Move `timestamp`, `nonce` and `signature` into `requestParameters`. |
| `400` | A required field is missing or invalid. | Review all required parameters and formats. |
| `401` | Bearer token missing, invalid, or expired. | Generate a fresh token and retry. |
| `401` | Signature verification failed. | Check signing order (`merchantTill`, then `timestamp`, then `nonce`), the secret key, and hex encoding. |
| `422` | The recipient mobile number is not linked to a PesaLink-enabled bank account. | Verify the number and that the recipient's bank supports PesaLink before retrying. |

`data` is `{}` on every non-200 `statusCode`.

```json
{
  "statusCode": 200,
  "message": "service process accepted",
  "data": {
    "serviceTransactionStatus": "COMPLETED",
    "requestReference": "19881",
    "txnReference": "86bebc3a-8c2b-4b37-a774-a70e10c591b1",
    "response": {
      "rspMessage": "SUCCESS",
      "transactionRef": "19881",
      "responseDetails": {
        "rspCode": "SAP00000",
        "transferStatus": "S",
        "requestId": "178533175623154612",
        "transferOrderId": "TAM202607295633998615",
        "transferRefNo": "777eab120a0d4da8bd9e7540eb1b71ae",
        "responseId": "9e75497c972a46f8a08743a0021436b2"
      }
    }
  }
}
```

Check `data.serviceTransactionStatus` (`COMPLETED`, `PENDING` or `FAILED`) and
`responseDetails.transferStatus` (`S` means the transfer completed successfully; any
other value indicates pending or failed) before considering the transfer settled.

> Note the nesting differs from Send Money — LOOP/M-Pesa: the result fields sit under
> `response.responseDetails` here, but directly under `response` there. Do not share a
> response parser across the three Send Money variants without accounting for this.

## Retries

- On `422`: the recipient's number is not linked to a PesaLink-enabled bank account.
  Verify the number and the recipient's bank before retrying — or route through
  [Send Money — LOOP](./send-money-loop.md) if the recipient is on LOOP instead.
- On any `400`/`401`: correct the payload or credentials first. Resending unchanged
  fails identically.

## Error responses

| HTTP Code | Description |
| --- | --- |
| `500` | Genuine unhandled server error (rare — distinct from a handled failure returned inside a 200). Carries real HTTP 500. |

## Sandbox → production

Sandbox till number and signing secret are issued on the Developer Portal for testing;
do not use them in production. Production credentials come from the Merchant Portal
once your integration is approved — everything else about the contract stays the same.
