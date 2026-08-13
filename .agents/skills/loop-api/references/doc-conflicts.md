<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/ (cross-page analysis) -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->
<!-- derived: true — findings from comparing the captured pages against each other -->

# Known documentation conflicts

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/> (analysed 2026-08-13)
> These are contradictions **within LOOP's own published documentation**, found by
> comparing the captured pages against each other. They are not errors in this skill.

**Read this before telling a developer their code is wrong.** When a request fails
despite matching the docs, one of these is a likely cause — the docs disagree with
themselves, so "matching the docs" is ambiguous.

Nothing here is resolved. Where a value is disputed, say so and give the developer the
evidence rather than picking one silently.

---

## 1. Token endpoint path — two different URLs

| Source | URL |
| --- | --- |
| Overview page, sandbox cURL | `https://sandbox.loop.co.ke/oauth2/token` |
| Authorisation page, "Endpoint" field | `https://sandbox.loop.co.ke/gateway/auth/1.0/oauth2/token` |
| Authorisation page, its own cURL example | `https://sandbox.loop.co.ke/oauth2/token` |

Two of three use the short path. **Unresolved.** Try one, fall back to the other, and
confirm with LOOP support.

## 2. Token lifetime — 900 vs 3600 seconds

| Source | `expires_in` |
| --- | --- |
| Overview page (prose and sample) | `900` — "short-lived (15 minutes)" |
| Authorisation page sample response | `3600` |

**Never hardcode either.** Refresh on the `expires_in` the live API returns.

## 3. The Authorisation page's "Request Examples" block cannot work

It shows:

```bash
curl -X POST '.../oauth2/token' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{ "grant_type": "client_credentials" }'
```

This asks for a token while *presenting* a token, and sends a JSON body where OAuth 2.0
client credentials requires `application/x-www-form-urlencoded` with HTTP Basic auth.

The same page's manual steps and the Overview page both document the correct form.
**Use Basic auth + form-encoded.** The "Request Examples" block appears to be a
template applied to every endpoint page without adjusting for the token endpoint.

## 4. `channel` value for the M-Pesa Pay-to endpoints

| Endpoint | Parameter table | cURL example | Step 3 example |
| --- | --- | --- | --- |
| Pay to M-Pesa Till | `LOOP` | `LOOP` | **`MPESATILL`** |
| Pay to M-Pesa Paybill | `LOOP` | `LOOP` | **`MPESAPAYBILL`** |
| Pay to LOOP Till | `LOOP` | `LOOP` | `LOOP` (consistent) |

Two of three sources say `LOOP` on each. Note that Send Money uses `channel` to select
the rail (`LOOP`/`MPESA`/`PESALINK`), which makes a routing-style value plausible for
Pay-to as well — so this is not obviously a typo. **Unresolved and worth confirming
before go-live**, since a wrong `channel` yields a `400` with a generic message.

## 5. LOOP Prompt endpoint path

| Source | Path |
| --- | --- |
| LOOP Prompt page, "Endpoint" field | `/gateway/loop-prompt/2/services/process-request` |
| Overview page, "Call LOOP APIs" example (shown twice) | `/gateway/loop-prompt/2/services/process-service-request2` |

Note that Send Money — LOOP genuinely uses a `process-service-request2` suffix while
its M-Pesa and PesaLink siblings use `process-request`, so both suffixes exist in this
API. That makes this a real ambiguity rather than an obvious slip. **Unresolved.**

## 6. "signed per the RSA signing guide" — it is not RSA

Every endpoint page's Request Parameters section opens with:

> "Send as a JSON body with the request signed per the RSA signing guide."

The actual documented scheme is **HMAC-SHA256 with a shared secret** — symmetric, not
RSA. Every signing example on every page uses `hmac.new(..., hashlib.sha256)`.

This is boilerplate text. **Ignore the RSA reference**; a developer who goes looking
for a key pair will waste an afternoon. See [`signing.md`](./signing.md).

## 7. Idempotency — `X-Idempotency-Key` is documented nowhere else

The Introduction page states:

> "Pass an `X-Idempotency-Key` header on any write request. Safe to retry without
> creating duplicate transactions."

**No endpoint page mentions this header.** Every endpoint implements idempotency
through the `txnReference` field in the request body instead, and the retry guidance
is written entirely around `txnReference`.

**Use `txnReference`.** Treat `X-Idempotency-Key` as unverified until confirmed.

## 8. Webhooks — per-app registration vs per-request `callBackUrl`

The Introduction page states:

> "Async events for payment status, KYC outcomes, and credit decisions. Register your
> endpoint once per app."

No captured endpoint page describes app-level webhook registration. **LOOP Prompt is
the only documented endpoint with a callback at all**, and it takes a per-request
`callBackUrl`. Every other endpoint explicitly states it is fully synchronous with no
callback.

The Introduction describes a broader platform (credit, identity, KYC, wallets,
e-commerce) than the captured API surface, which is payments-only. Its four "Core
Concepts" may describe an intended platform-wide model rather than what these
endpoints implement today.

## 9. `X-Loop-Version: 2024-01` appears only on the Overview page

The Overview page shows this header in every example. **No endpoint page's cURL
example includes it.** Whether it is required, optional, or aspirational is not stated
anywhere. Sending it appears harmless; relying on version pinning does not seem safe
yet.

## 10. Send Money — PesaLink example uses an invalid sandbox till

Its request example uses `merchantTill: "133177"`. Every other page states sandbox
accepts **only** `133238`, `133239`, `133240`. Copying the PesaLink example verbatim
into sandbox will fail with `statusCode 401`.

## 11. LOOP Prompt "Key Characteristics" describes a different product

That section refers to `payMblNo`, `refNo`, and the customer authorising with an
**M-Pesa PIN on an STK prompt**. The page's own parameter table uses `mobileNo` and
`txnReference`, and its description says the prompt is a **push notification to the
LOOP mobile app**.

**Leftover text from an M-Pesa STK Push document.** Trust the parameter table.

## 12. Response nesting differs across the Send Money variants

| Endpoint | Where the result fields sit |
| --- | --- |
| Send Money — LOOP | directly under `data.response` |
| Send Money — M-Pesa | directly under `data.response` |
| Send Money — PesaLink | under `data.response.responseDetails` |
| All three Pay-to endpoints | under `data.response.responseDetails` |

A response parser shared across products **must** account for this. It is a real
structural difference in the samples, not a documentation typo.

## 13. Pay to M-Pesa Till: Step 3 example omits a required field

`accountNumber` is marked **required** in that page's parameter table and appears in
its cURL example, but is absent from its Step 3 request-body example. Include it.

## 14. Phone number format is stricter on PesaLink

| Endpoint | Accepted formats |
| --- | --- |
| Send Money — LOOP / M-Pesa | `2547XXXXXXXX`, `07XXXXXXXX`, `+2547XXXXXXXX` |
| Send Money — PesaLink | international format **without** a leading `+` (e.g. `254705568254`) |

Normalising to `2547XXXXXXXX` satisfies all three.

## 15. `statusCode 404` on Send Money — LOOP is documented only in passing

That page's `txnReference` description says a duplicate is refused with `statusCode
404`, but `404` does not appear in the page's own statusCode table. It is documented
properly on Send Money — M-Pesa. **Handle it on both.**

---

## How to use this file

When a developer reports a failure that "should work per the docs":

1. Check whether the field involved appears above.
2. If it does, tell them the documentation is internally inconsistent, show both
   values, and suggest trying the majority reading first.
3. Recommend they confirm with `apisupport@loop.co.ke` — and if they get an answer,
   it is worth contributing back to this file.

**Do not silently pick a side.** A developer who knows a value is disputed will debug
it in minutes; one who thinks it is settled can lose a day.
