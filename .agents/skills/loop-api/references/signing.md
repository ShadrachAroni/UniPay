<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/ (signing steps repeated on every payment endpoint page) -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->
<!-- derived: true — consolidated from the identical "Step 2 — Sign the payload" block on all nine payment endpoint pages -->

# Request signing (HMAC-SHA256)

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/> (transcribed 2026-08-13)
> Consolidated from the signing block that repeats verbatim on every payment endpoint page.

Every LOOP payment endpoint uses the **same** signing scheme. An implementation
written for one endpoint works unchanged on all of them.

## The canonical string

```
merchantTill|timestamp|nonce
```

Pipe-joined, **no whitespace**, no trailing separator. Compute the **lowercase-hex**
HMAC-SHA256 digest of that string, keyed with your till's signing secret.

A Base64 digest or an uppercase-hex digest **will not verify**.

## What the signature does and does not cover

The signature covers **only** `merchantTill`, `timestamp` and `nonce`.

It does **not** cover `amount`, the recipient, or `channel`. Integrity of the rest of
the payload comes from TLS alone — so send over `https` only, and never relay a
signed request through an untrusted intermediary. (Stated explicitly on the Send Money
— LOOP and Send Money — M-Pesa pages.)

## Where the fields go

`timestamp`, `nonce` and `signature` go **inside `requestParameters`**, not at the
request root. Putting them at the root is a documented cause of a `400` — it appears
in the statusCode table of every Pay-to and Send Money page.

## Field rules

| Field | Rule |
| --- | --- |
| `timestamp` | ISO-8601 UTC, `yyyy-MM-dd'T'HH:mm:ss'Z'`, second precision, generated at the moment of sending. Outside the accepted window the request is rejected as a replay. |
| `nonce` | Single-use lowercase UUID v4, **fresh for every request including retries**. Reuse inside the replay window is rejected even when retrying the same `txnReference`. |
| `signature` | Lowercase hex HMAC-SHA256 of the canonical string, keyed with the till's secret. |

Generate `timestamp` and `nonce` fresh on **every** request — including retries and
including repeat polls of Transaction Status Inquiry.

## Reference implementation

```python
import hmac, hashlib, uuid
from datetime import datetime, timezone

SECRET_KEY = "<your_signing_secret_key>"   # issued at onboarding; never sent in the request
MERCHANT_TILL = "<your_merchantTill>"

# Fresh for every request, including retries
timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
nonce = str(uuid.uuid4()).lower()

message = f"{MERCHANT_TILL}|{timestamp}|{nonce}"
signature = hmac.new(
    SECRET_KEY.encode("utf-8"),
    message.encode("utf-8"),
    hashlib.sha256,
).hexdigest()          # lowercase hex — not Base64

# timestamp, nonce and signature go inside requestParameters
```

## Known-good test vectors

The docs publish worked examples so you can verify your implementation before sending
a live request. **All four reproduce exactly** — they were recomputed during
transcription, so they are verified, not merely copied.

Sandbox signing secret (published in LOOP's public docs, shared by all three sandbox
tills, testing only):

```
hyqd7bwMr9Kv-C5PW4n7uF4TiMnMp_hyvyhYYkYlcU8
```

| Page | merchantTill | timestamp | nonce | expected signature |
| --- | --- | --- | --- | --- |
| Send Money — LOOP | `133239` | `2026-07-21T08:45:56Z` | `f68836cd-ea13-49d9-85fd-b08fc2f1b795` | `1868bb7e1b601ce255c732da494dff0797d36451e59e5d3c4bf79bd8ee70d86a` |
| Send Money — M-Pesa | `133239` | `2026-07-21T08:47:12Z` | `c2a91b7e-4d05-4f8a-a3c6-9e1f5d7b2a48` | `8b48798149f4f71095dabbeea88c116730fb56f18c90970b39d992442f9561c9` |
| Transaction Status Inquiry | `133239` | `2026-07-21T08:47:12Z` | `c2a91b7e-4d05-4f8a-a3c6-9e1f5d7b2a48` | `8b48798149f4f71095dabbeea88c116730fb56f18c90970b39d992442f9561c9` |
| LOOP Prompt | `133239` | `2026-07-21T07:37:56Z` | `3a4c1f3d-5b00-478f-bd18-4ccf6fae895a` | `557dc74f9e53ec51b1c48aeaebe60bc89e108b753d7874336286c333a3692c5c` |

Verify against these rather than by trial and error against the live sandbox. The
Send Money — M-Pesa page warns that **repeated invalid signatures trigger a temporary
lockout**, during which even a correct request fails.

## Sandbox credentials

| Merchant Till | Status |
| --- | --- |
| `133238` | Active |
| `133239` | Active |
| `133240` | Active |

All three share the single sandbox secret above. Sandbox accepts **only** these three
tills — any other till is rejected with `statusCode 401` before the signature is even
evaluated, because an unregistered till has no secret to verify against.

The same signing secret is used across **all** payment endpoints for a given till.
You do not need a different key per endpoint.

Production secret keys come from the Merchant Portal; your production till is the one
registered with LOOP for your merchant account. Never commit a production secret to
source control or ship it in client-side code.
