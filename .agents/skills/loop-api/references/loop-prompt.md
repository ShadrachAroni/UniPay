<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/loop-prompt -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# LOOP Prompt (request to pay)

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/loop-prompt> (transcribed 2026-08-13)

Sends a request-to-pay (RTP) prompt to a customer's mobile number, asking them to
authorize a payment to a merchant till. Similar to STK Push but modelled as a
merchant-initiated payment request with a stated reason. **A push notification is sent
to the LOOP mobile app.**

This is the **collection** endpoint — money comes *in*. For paying money *out*, see
the Send Money pages.

## Endpoint

```
POST https://sandbox.loop.co.ke/gateway/loop-prompt/2/services/process-request
```

`serviceCode`: `NEO_MRCHNT_RTP`

> ⚠️ The Overview page shows this product at
> `/gateway/loop-prompt/2/services/process-service-request2` instead. See
> [`doc-conflicts.md`](./doc-conflicts.md).

**This is the only documented endpoint with a callback.**

## Request parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `serviceCode` | String | Yes | Must be exactly `NEO_MRCHNT_RTP`. |
| `txnReference` | String | Yes | Your unique reference. Unique across every request you have ever sent — a repeat is refused as a duplicate (`statusCode 404`). UUID v4 recommended. Reuse only when retrying the same payment after a 5xx or timeout. |
| `requestParameters` | Object | Yes | |
| `requestParameters.merchantTill` | String | Yes | The till collecting the payment. Must be issued to you — in sandbox one of `133238`, `133239`, `133240`. Also an input to the signature. |
| `requestParameters.mobileNo` | String | Yes | The customer's mobile number, which receives the prompt. Accepts `2547XXXXXXXX`, `07XXXXXXXX` or `+2547XXXXXXXX` — 8–12 digits, numeric apart from an optional leading `+`. |
| `requestParameters.amount` | String | Yes | Amount to request, decimal string (e.g. `100.00`). Numeric and greater than zero. |
| `requestParameters.reason` | String | Yes | Human-readable narration. **Shown to the customer on the prompt** — keep it recognisable. |
| `requestParameters.callBackUrl` | String (uri) | Yes | Absolute **https** URL receiving the completion notification. Must include a host; a plain `http` URL is rejected at request time. |
| `requestParameters.timestamp` | String (date-time) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.nonce` | String (uuid) | Yes | See [`signing.md`](./signing.md). |
| `requestParameters.signature` | String | Yes | See [`signing.md`](./signing.md). |

## Request example

```bash
curl -X POST 'https://sandbox.loop.co.ke/gateway/loop-prompt/2/services/process-request' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "serviceCode": "NEO_MRCHNT_RTP",
    "txnReference": "9f1b2c3e-8a4d-4f6b-9c2e-7d5a1e8b4f0c",
    "requestParameters": {
      "merchantTill": "133239",
      "mobileNo": "254704540384",
      "amount": "100.00",
      "reason": "Payment for goods",
      "callBackUrl": "https://partner.example.com/api/v1/payments/callback",
      "timestamp": "2026-07-21T07:37:56Z",
      "nonce": "3a4c1f3d-5b00-478f-bd18-4ccf6fae895a",
      "signature": "557dc74f9e53ec51b1c48aeaebe60bc89e108b753d7874336286c333a3692c5c"
    }
  }'
```

## Response (HTTP 200 — branch on `statusCode`)

**The synchronous call confirms only that the prompt was delivered — not that the
customer has paid.**

| statusCode | Meaning | Returned when |
| --- | --- | --- |
| `200` | Success | The prompt was accepted and delivered to the customer. |
| `400` | Bad request | Missing/empty required field, `amount` non-numeric or ≤ 0, `mobileNo` fails format validation, `callBackUrl` is not an absolute https URL, or `txnReference` missing. |
| `401` | Unauthorized | Till not registered to you, or signature/timestamp/nonce did not verify. |
| `413` | Data parsing error | The request payload could not be parsed. |
| `463` | Merchant lookup failed | The till did not resolve to a merchant. |
| `464` | Request declined | Declined because of the data supplied — see `message`. |
| `500` | System error | Unexpected error while processing. |
| `502` | Service error | Temporarily unable to process; not caused by your payload. |

`data` is `{}` on every non-200 `statusCode`.

```json
{
  "statusCode": 200,
  "message": "service process accepted",
  "data": {
    "serviceTransactionStatus": "COMPLETED",
    "requestReference": "1042",
    "txnReference": "9f1b2c3e-8a4d-4f6b-9c2e-7d5a1e8b4f0c",
    "response": {
      "transactionRef": "TXN-20260721-000001042",
      "rspMessage": "SUCCESS",
      "orderNo": "RPM202607215839217406",
      "orderToken": "20260721RPM202607215839217406",
      "orderDate": "20260721",
      "totalAmount": "100.00",
      "rspCode": "00000000",
      "loopRefNo": "K7QW3ZP1D8XM",
      "serverTime": "20260721073757",
      "responseId": "8f2c41d7a9b34e15b6c0d2e7f31a5c94"
    }
  }
}
```

## The completion callback

Once the customer authorises, LOOP POSTs the actual payment confirmation to the
`callBackUrl` you supplied.

- Acknowledge with a `2xx` **quickly**.
- Stay **idempotent on `transactionRef`** — assume it can be delivered more than once.
- **Only release goods on this callback.** Never on the synchronous response alone.

> The docs reference a `CompletionCallbackPayload` schema for the callback body, but
> the page text captured here does not include its fields. Retrieve it from the
> portal's Swagger (`/swagger.json`) or the Postman collection before building your
> handler. See [`coverage.md`](./coverage.md).

## Error responses

| HTTP Code | Description |
| --- | --- |
| `500` | Genuine unhandled server error (rare — distinct from a handled `statusCode 500` inside a 200). Carries real HTTP 500. |

```json
{ "statusCode": 500, "message": "An unexpected error occurred while processing the request", "data": {} }
```

For `503` errors, implement exponential backoff and retry with the **same** reference.
Do not generate a new reference on a gateway failure — the original transaction may
have been partially processed.

## ⚠️ Stale field names on this page

The page's "Key Characteristics" section refers to `payMblNo`, `refNo`, and to the
customer authorising with an **M-Pesa PIN** on an STK prompt. None of that matches
this endpoint's own parameter table, which uses `mobileNo` and `txnReference`, and
whose description says the prompt is a **push notification to the LOOP mobile app**.

Treat the parameter table as authoritative and ignore "Key Characteristics" — it
appears to be leftover text from an M-Pesa STK Push document. See
[`doc-conflicts.md`](./doc-conflicts.md).

## Sandbox

Sandbox accepts only tills `133238`, `133239`, `133240`, sharing one secret key. Any
other till is rejected with `statusCode 401`.
