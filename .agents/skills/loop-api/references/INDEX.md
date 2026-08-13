# LOOP API reference index

Transcribed from <https://sandbox.loop.co.ke/devportal/docs/loop-api/> on 2026-08-13.

> **Capture method: manual transcription**, not the crawler. The portal was not
> reachable from the machine that built this corpus, so the maintainer supplied the
> rendered page text and it was transcribed into these files. Every file records this
> in its `capture:` header.
>
> This matters for how much you trust it: the *content* is LOOP's, but the
> *transcription* has not been machine-verified against the live pages. The signing
> scheme has been independently verified — all four of LOOP's published HMAC test
> vectors were recomputed and reproduce exactly. Deep-link URLs other than
> `/introduction` are inferred from the portal's navigation.
>
> Re-run `./tools/crawl_loop.sh && python tools/ingest_docs.py --input-dir .cache/loop-docs/pages`
> from a machine that can reach the portal to replace this with a crawler-generated,
> machine-verified corpus.

## Read these first

| File | Why |
| --- | --- |
| [`api-flows.md`](./api-flows.md) | **What each API actually does**, as sequence diagrams — the order the gateway runs its checks, where money moves, the retry decision tree, and a table for validating an idea before building it. |
| [`conventions.md`](./conventions.md) | **HTTP 200 does not mean success.** The envelope, the `statusCode` banding, and the retry rules. Getting these wrong causes double payments. |
| [`signing.md`](./signing.md) | The HMAC-SHA256 scheme every payment endpoint shares, with verified test vectors. |
| [`doc-conflicts.md`](./doc-conflicts.md) | 15 contradictions inside LOOP's own docs. Check here before telling a developer their code is wrong. |
| [`coverage.md`](./coverage.md) | What this corpus does **not** contain. Check before saying "LOOP doesn't support that". |
| [`security-testing.md`](./security-testing.md) | Hardening your integration: the security controls LOOP documents, each as a self-test you run in the sandbox — replay, idempotency/double-spend, token hygiene, fail-closed behaviour — plus where a fraud/risk layer would live. |

## Getting started

| Topic | File |
| --- | --- |
| Platform positioning, core concepts | [`introduction.md`](./introduction.md) |
| Environments, base URLs, auth model, going live | [`overview.md`](./overview.md) |
| OAuth 2.0 token endpoint | [`authorisation.md`](./authorisation.md) |

## Endpoints

| Operation | Direction | `serviceCode` | File |
| --- | --- | --- | --- |
| LOOP Prompt (request to pay) | money **in** | `NEO_MRCHNT_RTP` | [`loop-prompt.md`](./loop-prompt.md) |
| Transaction Status Inquiry | read-only | `MRCHNT_TXN_INQUIRY` | [`transaction-status-inquiry.md`](./transaction-status-inquiry.md) |
| Pay to LOOP Till | money **out** | `MRCHNT_PAYMENTS` | [`pay-to-loop-till.md`](./pay-to-loop-till.md) |
| Pay to M-Pesa Till | money **out** | `MRCHNT_PAYMENTS` | [`pay-to-mpesa-till.md`](./pay-to-mpesa-till.md) |
| Pay to M-Pesa Paybill | money **out** | `MRCHNT_PAYMENTS` | [`pay-to-mpesa-paybill.md`](./pay-to-mpesa-paybill.md) |
| Send Money — LOOP wallet | money **out** | `MRCHNT_SENDMONEY` | [`send-money-loop.md`](./send-money-loop.md) |
| Send Money — M-Pesa | money **out** | `MRCHNT_SENDMONEY` | [`send-money-mpesa.md`](./send-money-mpesa.md) |
| Send Money — PesaLink (bank) | money **out** | `MRCHNT_SENDMONEY` | [`send-money-pesalink.md`](./send-money-pesalink.md) |

## Picking the right endpoint

**Collecting money from a customer** → [LOOP Prompt](./loop-prompt.md) (pushes to the
LOOP mobile app). If the customer is on M-Pesa rather than LOOP, the portal has a
"LOOP M-Pesa Prompt" page that this corpus does not cover — see
[`coverage.md`](./coverage.md).

**Paying money out** — pick by what the destination *is*:

| Destination | Endpoint |
| --- | --- |
| A person's LOOP wallet | [Send Money — LOOP](./send-money-loop.md) |
| A person's M-Pesa account | [Send Money — M-Pesa](./send-money-mpesa.md) |
| A person's bank account | [Send Money — PesaLink](./send-money-pesalink.md) |
| A LOOP merchant till | [Pay to LOOP Till](./pay-to-loop-till.md) |
| An M-Pesa buy-goods till | [Pay to M-Pesa Till](./pay-to-mpesa-till.md) |
| An M-Pesa paybill | [Pay to M-Pesa Paybill](./pay-to-mpesa-paybill.md) |

**Finding out what happened** → [Transaction Status Inquiry](./transaction-status-inquiry.md).
Note its retry rules are the *opposite* of the payment endpoints.

## Endpoint URL quick reference

Base: `https://sandbox.loop.co.ke` (sandbox) / `https://api.loop.co.ke` (production).

```
POST /gateway/auth/1.0/oauth2/token                             # token (but see doc-conflicts #1)
POST /gateway/loop-prompt/2/services/process-request            # LOOP Prompt (see doc-conflicts #5)
POST /gateway/transaction-inquiry/1.0.0/services/process-request
POST /gateway/pay-to-looptill/1.0/services/process-request
POST /gateway/pay-to-mpesa-till/1.0/services/process-request
POST /gateway/pay-to-paybill/1.0/services/process-request
POST /gateway/send-money-loop/1.0/services/process-service-request2   # note the "2"
POST /gateway/send-money-mpesa/1.0/services/process-request
POST /gateway/send-money-pesalink/1.0/services/process-request
```
