<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/ (portal navigation) -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->
<!-- derived: true — what this corpus does and does not contain -->

# Coverage and gaps

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/> (assessed 2026-08-13)

**Read this before saying "LOOP doesn't support that".** Some things are absent from
this corpus without being absent from LOOP.

## Captured (11 of 13 portal pages)

| Portal nav entry | Reference file |
| --- | --- |
| Introduction | [`introduction.md`](./introduction.md) |
| Overview | [`overview.md`](./overview.md) |
| Authorisation | [`authorisation.md`](./authorisation.md) |
| LOOP Prompt | [`loop-prompt.md`](./loop-prompt.md) |
| Transaction Status Inquiry | [`transaction-status-inquiry.md`](./transaction-status-inquiry.md) |
| Pay to LOOP till | [`pay-to-loop-till.md`](./pay-to-loop-till.md) |
| Pay to M-Pesa Till | [`pay-to-mpesa-till.md`](./pay-to-mpesa-till.md) |
| Pay To M-Pesa Paybill | [`pay-to-mpesa-paybill.md`](./pay-to-mpesa-paybill.md) |
| Send Money - Loop | [`send-money-loop.md`](./send-money-loop.md) |
| Send Money - M-Pesa | [`send-money-mpesa.md`](./send-money-mpesa.md) |
| Send Money - Pesalink | [`send-money-pesalink.md`](./send-money-pesalink.md) |

Plus three derived files: [`signing.md`](./signing.md),
[`conventions.md`](./conventions.md), [`doc-conflicts.md`](./doc-conflicts.md).

## ❌ Not captured — these pages exist but their content is missing

Both appear in the portal's sidebar navigation. **Do not tell a developer these
features don't exist** — say the reference corpus doesn't cover them yet and point at
the portal.

| Portal nav entry | Status |
| --- | --- |
| **Transaction History** | Page exists; content not captured. Distinct from Transaction Status Inquiry, which looks up a single transaction by reference. If a developer needs to list or reconcile transactions over a period, this is the page to check. |
| **LOOP M-Pesa Prompt** | Page exists; content not captured. Presumably the M-Pesa STK Push counterpart to LOOP Prompt (which pushes to the LOOP app instead). Likely the right endpoint for "collect from a customer who is on M-Pesa, not LOOP". |

## ❌ Schemas referenced but not captured

The endpoint pages name schema objects whose field definitions were not in the
captured text:

- `CompletionCallbackPayload` — **the LOOP Prompt callback body**. Needed to build a
  callback handler. This is the most consequential gap in the corpus.
- `ProcessLoopPromptRequest`, `ProcessSendMoneyMpesaRequest`,
  `ProcessSendMoneyPesalinkRequest`, `ProcessPayToLoopTillRequest`,
  `ProcessPayToMpesaTillRequest`, `ProcessPayToMpesaPaybillRequest`,
  `SendMoneyLoopRequest`, `TransactionInquiryRequest`
- `RtpSuccessData`, `SendMoneySuccessData`, `SendMoneyMpesaSuccessData`,
  `SendMoneyPesalinkSuccessData`, `PayToLoopTillSuccessData`,
  `PayToMpesaTillSuccessData`, `PayToMpesaPaybillSuccessData`, `InquirySuccessData`

The parameter tables in each reference file cover the same ground for requests. The
gap that matters is the **callback payload**.

## ❌ Not documented anywhere in the captured pages

Absent from the corpus. Whether LOOP supports them is **unknown** — do not assert
either way:

- **Bulk or batch payouts.** Every Send Money call is one recipient. Paying many
  suppliers means N calls, which you must sequence and reconcile yourself.
- **Scheduled or recurring payments.** No cron primitive; scheduling is your side.
- **Balance inquiry.** No endpoint for checking till balance, though `statusCode 462`
  ("no payment instrument for this channel and amount") implies balance is enforced.
- **Reversals or refunds.** None documented. Payouts are described as
  **non-reversible** in production.
- **Transaction limits or fee schedules.** Fees are stated to exist and be drawn from
  your till on top of `amount`, but no rates are published.
- **Rate limits.** None documented, other than the signature-failure lockout on Send
  Money — M-Pesa.
- **The e-commerce, credit, identity and wallet verticals** named on the Introduction
  page. No endpoints captured.

## Better sources than this corpus

Every endpoint page links these. They are authoritative where this corpus is a
transcription:

- **Swagger** — `/swagger.json`, linked from each endpoint page. A machine-readable
  spec settles every ambiguity in [`doc-conflicts.md`](./doc-conflicts.md).
  `tools/ingest_docs.py --openapi <url>` ingests it directly.
- **Postman collection** — linked from each endpoint page.
- **"Try out API"** — an in-portal console on each endpoint page.

## How to close these gaps

```bash
./tools/crawl_loop.sh                                   # finds Swagger automatically
python tools/ingest_docs.py --input-dir .cache/loop-docs/pages
```

Run from a machine that can reach `sandbox.loop.co.ke` while signed in. This replaces
the transcribed corpus with a crawler-generated one and picks up the two missing pages.
