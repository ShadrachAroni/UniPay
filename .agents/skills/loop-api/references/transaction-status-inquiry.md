<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/transaction-status-inquiry -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# Transaction Status Inquiry

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/transaction-status-inquiry> (transcribed 2026-08-13)

Gets the current status of a transaction. Read-only, fully synchronous, no callback.

This is how you resolve an unknown outcome after a timeout — and it is the endpoint
whose retry rules are the **opposite** of the payment endpoints.

## Endpoint

```
POST https://sandbox.loop.co.ke/gateway/transaction-inquiry/1.0.0/services/process-request
```

`serviceCode`: `MRCHNT_TXN_INQUIRY`

## ⚠️ The two `txnReference` fields

**This is the most common integration mistake on this endpoint**, called out as such
in LOOP's own docs. There are two different `txnReference` fields, one per level:

| Where | What it identifies | Changes between polls? |
| --- | --- | --- |
| Envelope `txnReference` | **This inquiry call** | **Yes — must be fresh on every call**, including repeat polls. A repeat is refused as a duplicate (`404`). |
| `requestParameters.txnReference` | **The original transaction** you are asking about | **No — stays the same** across every poll. |

## Request parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `serviceCode` | String | Yes | Must be exactly `MRCHNT_TXN_INQUIRY`. |
| `txnReference` | String | Yes | Envelope reference for **this inquiry call only**. Unique per call including repeat polls — a repeat is refused as a duplicate (`statusCode 404`). UUID v4 recommended. |
| `requestParameters` | Object | Yes | |
| `requestParameters.merchantTill` | String | Yes | The till the original transaction belongs to. In sandbox one of `133238`, `133239`, `133240`. Also an input to the signature. |
| `requestParameters.txnReference` | String | Yes | The reference of the **ORIGINAL** transaction being inquired about — the one generated when it was initiated. Not the envelope reference. |
| `requestParameters.timestamp` | String (date-time) | Yes | Fresh on every call. See [`signing.md`](./signing.md). |
| `requestParameters.nonce` | String (uuid) | Yes | Fresh on every call including repeat polls. See [`signing.md`](./signing.md). |
| `requestParameters.signature` | String | Yes | See [`signing.md`](./signing.md). |

The signing scheme is identical to the payment products — an implementation built for
Send Money or LOOP Prompt works here unchanged.

## Request example

```bash
curl -X POST 'https://sandbox.loop.co.ke/gateway/transaction-inquiry/1.0.0/services/process-request' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "serviceCode": "MRCHNT_TXN_INQUIRY",
    "txnReference": "a8d4f2b9-1e7d-4a4b-9b64-c0e785a2d614",
    "requestParameters": {
      "merchantTill": "133239",
      "txnReference": "7f3c2e91-6a84-4d17-9b52-3c8f6e1a4d70",
      "timestamp": "2026-07-21T08:47:12Z",
      "nonce": "c2a91b7e-4d05-4f8a-a3c6-9e1f5d7b2a48",
      "signature": "8b48798149f4f71095dabbeea88c116730fb56f18c90970b39d992442f9561c9"
    }
  }'
```

## Response (HTTP 200 — branch on `statusCode`)

| statusCode | Meaning | Returned when |
| --- | --- | --- |
| `200` | Success | The lookup ran; details are in `data`. |
| `401` | Unauthorized | Till not registered to you, or signature/timestamp/nonce did not verify. |
| `404` | Duplicate reference | The **envelope** `txnReference` of this inquiry has been used before. |

`data` is `{}` on every non-200 `statusCode`.

```json
{
  "statusCode": 200,
  "message": "service process accepted",
  "data": {
    "serviceTransactionStatus": "COMPLETED",
    "requestReference": "24711",
    "txnReference": "a8d4f2b9-1e7d-4a4b-9b64-c0e785a2d614",
    "response": {
      "rspMessage": "SUCCESS",
      "amount": "500",
      "initiatedAt": "2026-08-12 11:11:35",
      "lastUpdatedAt": "2026-08-12 11:11:37",
      "resultCode": "00000000",
      "transactionRef": "24711",
      "resultDesc": "Transaction completed successfully",
      "txnReference": "7f3c2e91-6a84-4d17-9b52-3c8f6e1a4d70",
      "originalTransactionRef": "24366",
      "currency": "KES",
      "tillNo": "133239",
      "finalState": true,
      "status": "COMPLETED",
      "transaction": {
        "txnReference": "7f3c2e91-6a84-4d17-9b52-3c8f6e1a4d70",
        "transactionRef": "24366",
        "status": "COMPLETED",
        "resultCode": "00000000",
        "resultDesc": "Transaction completed successfully",
        "finalState": true,
        "amount": "500",
        "currency": "KES",
        "tillNo": "133239",
        "initiatedAt": "2026-08-12 11:11:35",
        "lastUpdatedAt": "2026-08-12 11:11:37",
        "retryCount": 0
      }
    }
  }
}
```

## `finalState` — the field that tells you when to stop polling

| `finalState` | Meaning | Action |
| --- | --- | --- |
| `true` | Terminal. The status can no longer change. | **Stop polling.** |
| `false` | Still in flight. | Poll again later with backoff — fresh envelope `txnReference`, `timestamp`, `nonce` and `signature` each time. |

## Retries — inverted relative to the payment endpoints

Because the inquiry is **read-only, retrying is always safe**.

| Situation | Action |
| --- | --- |
| `statusCode 404` (duplicate envelope reference) | Retry with a **fresh** envelope `txnReference` and fresh security parameters. |
| `504` gateway timeout | Same — retry with a fresh envelope reference. |
| `statusCode 401` | Check the till and re-sign before retrying. |

This is **the opposite of the payment products**, where a retry reuses the original
reference. Getting it backwards means every poll after the first fails with a
duplicate error.

## Error responses

| HTTP Code | Description |
| --- | --- |
| `504` | Gateway timeout — upstream did not respond in time. Carries a `request_id` instead of a `data` object. |

```json
{
  "statusCode": 504,
  "message": "The upstream server is timing out",
  "request_id": "571b8e58f7f4d906819ed5373a3fbe11"
}
```
