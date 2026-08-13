<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/introduction -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# Introduction

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/introduction> (transcribed 2026-08-13)

> ⚠️ **This page describes a broader platform than the documented API surface.** It
> speaks of payments, credit, identity, wallets and commerce across East Africa; the
> endpoints actually documented are **payments only**. Several of its "Core Concepts"
> are contradicted by every endpoint page — see [`doc-conflicts.md`](./doc-conflicts.md)
> items 7 and 8. Treat this page as positioning, and the endpoint pages as the
> contract.

## What LOOP describes

A unified financial infrastructure layer. Rather than integrating separately with
mobile money operators, card schemes, credit bureaus and KYC providers, you connect
once to LOOP and reach them through a consistent REST interface.

Every product vertical — payments, e-commerce, credit, identity, wallets — is
described as sharing the same authentication model, error format and webhook pattern.

## Core Concepts as stated

| Concept | The Introduction says | What the endpoint pages actually show |
| --- | --- | --- |
| **Authentication** | Every payment API call carries `Authorization: Bearer <token>` | ✅ Confirmed on every endpoint page. See [`authorisation.md`](./authorisation.md). |
| **Environments** | Sandbox mirrors production exactly; switch by changing base URL and credentials, no code changes | ✅ Confirmed. See [`overview.md`](./overview.md). |
| **Webhooks** | Async events for payment status, KYC and credit decisions; register your endpoint once per app | ⚠️ **Not corroborated.** Only LOOP Prompt has a callback, and it is per-request `callBackUrl`. Everything else is synchronous. |
| **Idempotency** | Pass an `X-Idempotency-Key` header on any write request | ⚠️ **Not corroborated.** No endpoint documents this header; all use `txnReference` in the body. |

For what the endpoints actually implement, read
[`conventions.md`](./conventions.md).

## Get help

- **Developer Support** — open a ticket with the LOOP integration team. Response
  within 1 business day.
- **API Status** — real-time uptime, incident reports, scheduled maintenance windows.
- Email: `apisupport@loop.co.ke`
- Tel: +254 709 714 444 / +254 730 714 444
