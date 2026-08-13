<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/ (security controls stated across the endpoint pages) -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->
<!-- derived: true — maps LOOP's documented security controls to self-tests you run against YOUR OWN integration in the sandbox -->

# Security self-testing in the LOOP sandbox

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/> (analysed 2026-08-13)
> Every control below is documented on a LOOP endpoint page. This file maps each one
> to a test you run **against your own integration, with your own sandbox credentials,
> in the sandbox environment LOOP provides for exactly this purpose.**

## Scope — read this first

This is a guide to **hardening your own integration**. It is defensive security:
verifying that *your* code, and the sandbox, behave the way the documentation says
under adversarial conditions.

**In scope** — because it is your code, your credentials, and an environment LOOP
publishes for testing that moves no real money:
- Confirming your client rejects a tampered or replayed response.
- Confirming the gateway rejects a reused nonce, a stale timestamp, a bad signature.
- Confirming your retry logic cannot double-pay.
- Confirming you never log or echo a secret.

**Out of scope** — this skill will not help with any of it:
- Probing LOOP's **production** systems.
- Testing credentials, tills, or integrations that are not yours.
- Load-testing, fuzzing, or denial-of-service against LOOP infrastructure.
- Anything whose goal is unauthorised access rather than hardening your own build.

If you need to test beyond the sandbox, get **written authorisation from LOOP first**
(`apisupport@loop.co.ke`). The sandbox's own limits are a signal: the repeated-invalid-
signature lockout on Send Money — M-Pesa exists to stop brute-forcing, and tripping it
on purpose just locks you out.

---

## The one design principle worth taking from elsewhere: fail closed

Twitter's open-source recommendation code (`visibilitylib`) has a class called
`FailClosedException`: when a rule cannot get the signal it needs, it does **not** shrug
and allow the content — it denies. That is the single most important idea in both
content safety and payments security, and **LOOP already implements it**:

> The gateway's checks run in order and fail fast, and **no money leaves your till until
> every check passes**. A missing recipient (`461`), an unresolved till (`463`), no
> instrument (`462`) — every one of them ends the request with the money still in place.
> See [`api-flows.md`](./api-flows.md).

The lesson for anything **you** build on top of LOOP — a risk check, an approval gate,
a spending limit — is the same: when your own control cannot decide, **block the
payout, don't wave it through.** An uncertain fraud check that lets money out "to be
safe" is failing open, which is the expensive direction.

---

## The controls LOOP documents, and how to test each

| # | Control | What it defends against | Where it's documented |
| :-: | :--- | :--- | :--- |
| 1 | HMAC-SHA256 signature | Request tampering, forged requests | [`signing.md`](./signing.md) |
| 2 | Single-use nonce | Replay of a captured request | [`signing.md`](./signing.md) |
| 3 | Timestamp window | Replay of an old captured request | [`signing.md`](./signing.md) |
| 4 | `txnReference` idempotency | Double-spend on retry | [`conventions.md`](./conventions.md) |
| 5 | Signature-failure lockout | Brute-forcing a signature | [`send-money-mpesa.md`](./send-money-mpesa.md) |
| 6 | Token expiry before signature check | Stale/stolen token reuse | [`authorisation.md`](./authorisation.md) |
| 7 | Recipient validation before transfer | Paying a non-existent account | [`send-money-mpesa.md`](./send-money-mpesa.md) |
| 8 | `statusCode`-in-body, not HTTP status | Silent mis-booking of failures | [`conventions.md`](./conventions.md) |

Below, each as a self-test. All run in **sandbox** against **your** till.

### 1. Signature integrity — is a tampered body rejected?

The signature covers `merchantTill|timestamp|nonce` only — **not the amount, recipient,
or channel.** Those are protected by TLS alone.

- **Test:** send a correctly signed request, then send a second with the **same
  signature** but a changed `amount`. It should be rejected (`401`, signature mismatch —
  because changing `merchantTill` breaks the signature; changing `amount` alone does
  not, which is the point below).
- **The real finding:** because `amount` and `recipient` are *not* signed, an attacker
  who can sit between you and LOOP on a broken TLS path could alter them. Your hardening
  is therefore: **pin TLS, never proxy a signed request through an untrusted hop, and
  reconcile every `transferOrderId` against what you intended to send** — the signature
  will not catch an altered amount for you.

### 2 & 3. Replay resistance — nonce and timestamp

- **Nonce test:** capture a valid request, resend it **byte-for-byte**. It must be
  rejected — the nonce is single-use, refused even on a legitimate retry.
- **Timestamp test:** sign a request with a timestamp well in the past (or future) and
  send it. It must be rejected as a replay / outside the window.
- **What this proves:** an attacker who captures one of your requests cannot re-fire it.
  If either test *succeeds* in moving money twice, stop and contact LOOP — that is a
  finding worth reporting.

### 4. Idempotency — can a retry double-pay?

This is the highest-value test for a payments integration.

- **Test:** send a payout, then send the **exact same `txnReference`** again with a
  fresh timestamp/nonce/signature. The second must come back `404` (duplicate) with **no
  second transfer.**
- **Then test your own layer:** kill your process mid-payout and restart it. Does your
  retry logic reuse the original `txnReference`, or mint a new one? A new one is a
  double-payment waiting for a bad network day. See the retry decision tree in
  [`api-flows.md`](./api-flows.md).

### 5. Brute-force resistance — the signature lockout

Documented on Send Money — M-Pesa: repeated invalid signatures trigger a temporary
lockout during which even a correct request fails.

- **Do not test this by tripping it** — you will lock yourself out. Instead, **read the
  behaviour and design for it:** if your signing is subtly wrong, you will not get
  clean `401`s, you will get a lockout that looks like an outage. Verify signing against
  the published test vectors in [`signing.md`](./signing.md) *before* firing at the
  sandbox, exactly as the docs instruct.

### 6. Token hygiene — expiry is checked first

An expired token is rejected **before the signature is even evaluated**, so a stale
token surfaces as a `401` that mimics a signing bug.

- **Test:** let a token expire (minutes), then use it. Confirm you get `401`, and
  confirm your client **refreshes and retries** rather than surfacing a signing error.
- **Hardening:** refresh on the `expires_in` the API returns — not a hardcoded
  constant, since the docs state both 900 and 3600 seconds
  ([`doc-conflicts.md`](./doc-conflicts.md), item 2).

### 7. Fail-closed recipient validation

- **Test:** send a payout to a correctly formatted but non-existent recipient number.
  Expect `461` (M-Pesa) / `464` / `422` (PesaLink) and **no money moved.**
- **What it proves:** LOOP validates before it pays. Your job is to not undermine it —
  never treat a validation failure as "probably fine, retry harder."

### 8. Detection — do you mis-book failures as successes?

Not an attack, but the most common way money goes missing on the books.

- **Test:** force a handled failure (bad field → `statusCode 400` inside an **HTTP
  200**). Confirm your code branches on the body's `statusCode`, **not** on the HTTP
  status. A client that checks `response.ok` will record that failed payment as a
  success. See [`conventions.md`](./conventions.md).

---

## A self-test checklist

Run these in sandbox before going live. Each maps to a row above.

- [ ] Reused nonce → rejected, no double transfer
- [ ] Stale timestamp → rejected as replay
- [ ] Duplicate `txnReference` → `404`, no second payout
- [ ] Process killed mid-payout → restart **reuses** the reference
- [ ] Expired token → client refreshes and retries, does not report a signing error
- [ ] Non-existent recipient → `461`/`464`/`422`, no money moved
- [ ] Handled failure (200 + non-200 `statusCode`) → booked as a **failure**, not a success
- [ ] No secret, token, or account number appears in any log, error, or echoed message
- [ ] Signing verified against the published test vectors **before** the first live call
- [ ] Every `transferOrderId` reconciled against the amount and recipient you intended

## Where fraud detection would live

LOOP gives you the **rails and the primitives**; it does not document a fraud-scoring
service (see [`coverage.md`](./coverage.md) — no balance endpoint, no fee schedule, no
risk API). So a fraud/risk layer is **something you build on top**, and this is where
the *architecture* from a recommendation system genuinely informs you — not its code:

- **Layered signals over a hard rule.** Content-safety systems score with many weak
  signals (reputation, behaviour, history) rather than one boolean. A payout risk score
  is the same shape: velocity (how many payouts to this recipient this hour), novelty
  (first time paying them), amount deviation, time-of-day.
- **Reputation as a signal.** Twitter's `tweepcred` is PageRank over the follow graph.
  The payments analogue is a recipient/merchant reputation built from your own history.
- **Real-time aggregation.** Their `user-signal-service` aggregates signals live; a
  fraud check needs the same — you cannot score a payout on yesterday's data.
- **Fail closed, always.** Covered above. When your score is unavailable, hold the
  payout for review; do not release it.

**But keep the honesty rule.** None of that is in LOOP's documentation. If you build a
risk layer, it is yours — this skill can help you design it, but it must not claim LOOP
provides fraud primitives it does not.

---

## Which way to head — a recommendation

1. **First, harden the integration** using the checklist above. This is concrete,
   authorised, and entirely inside the sandbox. It is also the highest-leverage work:
   most payment incidents are double-pays and mis-booked failures, not exotic attacks.
2. **Then, if you need risk controls, build a thin fail-closed layer** in front of your
   payouts — velocity + amount + recipient-novelty, holding on uncertainty. Design it
   with the layered-signal shape above; do not wait for a LOOP fraud API that the docs
   do not promise.
3. **Do not point offensive tooling at LOOP.** The value here is defensive: a payments
   integration that provably resists replay and double-spend, and books its failures
   honestly. That is what earns production approval — see [`overview.md`](./overview.md).
