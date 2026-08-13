<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/authorisation -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# Authorisation

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/authorisation> (transcribed 2026-08-13)

OAuth 2.0 token lifecycle for the LOOP Developer Portal running on LOOP API Manager.
Before calling any protected API, obtain a Bearer access token.

> **Security notice (from the docs).** Keep your Consumer Key and Consumer Secret
> confidential. Never expose them in client-side code, public repositories, or logs.

## Endpoint

```
POST https://sandbox.loop.co.ke/gateway/auth/1.0/oauth2/token
```

> ⚠️ The Overview page and this page's own manual-steps example both use
> `https://sandbox.loop.co.ke/oauth2/token` instead. Both forms appear in LOOP's
> documentation. See [`doc-conflicts.md`](./doc-conflicts.md) — try the gateway path
> first and fall back, or confirm with LOOP support.

Grant type: **client credentials** (machine-to-machine).

## How to authenticate

1. Retrieve your Consumer Key and Consumer Secret from the Developer Portal
   (Application → Sandbox Keys → Generate Keys).
2. Concatenate them as `consumer_key:consumer_secret`.
3. Base64-encode the concatenated string.
4. Pass the encoded value in the `Authorization` header as `Basic <encoded>`.
5. Send `grant_type=client_credentials` in the request body.

```bash
echo -n "myConsumerKey:myConsumerSecret" | base64
# bXlDb25zdW1lcktleTpteUNvbnN1bWVyU2VjcmV0
```

```bash
curl -X POST https://sandbox.loop.co.ke/oauth2/token \
  -H "Authorization: Basic bXlDb25zdW1lcktleTpteUNvbnN1bWVyU2VjcmV0" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials"
```

Most HTTP clients do this for you — `curl -u key:secret`, `requests` with
`auth=(key, secret)`, or `axios` with `auth: { username, password }`.

## Request parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `grant_type` | String | Yes | Must be `client_credentials` for machine-to-machine (M2M) token generation. |

> ⚠️ **The page's "Request Examples" block is wrong.** It shows a `Bearer` token, a
> JSON body, and `Content-Type: application/json` — which cannot work for obtaining a
> token via client credentials. Use the Basic-auth + form-encoded form above, which
> the same page documents in its manual steps and which matches the Overview page.
> See [`doc-conflicts.md`](./doc-conflicts.md).

## Success response (HTTP 200)

| Field | Type | Description |
| --- | --- | --- |
| `access_token` | String | Bearer token for subsequent calls via `Authorization: Bearer <access_token>`. |
| `refresh_token` | String | Token to obtain a new `access_token` without re-authenticating. **Not always returned** for the `client_credentials` grant. |
| `token_type` | String | Always `Bearer`. |
| `expires_in` | Integer (int64) | Token validity in seconds from issuance. Generate a new token after it elapses. |

```json
{
  "access_token": "b8c8b8c8-b8c8-b8c8-b8c8-b8c8b8c8b8c8",
  "refresh_token": "d8d8d8d8-d8d8-d8d8-d8d8-d8d8d8d8d8d8",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

> ⚠️ This sample shows `expires_in: 3600`; the Overview page states 15 minutes and
> shows `900`. **Refresh on the `expires_in` value the live API returns**, never on a
> hardcoded constant. See [`doc-conflicts.md`](./doc-conflicts.md).
>
> Note the sample `access_token` here is a UUID while the Overview page's sample is a
> JWT (`eyJhbGciOiJSUzI1NiIs…`). Treat the token as an opaque string; do not build
> logic that parses it.

## Error responses

The token endpoint uses standard OAuth 2.0 error bodies — a different shape from the
payment endpoints' `statusCode` envelope.

| HTTP Code | Description |
| --- | --- |
| `400` | Bad Request — missing or invalid parameters |
| `401` | Unauthorized — invalid or missing client credentials |
| `500` | Internal Server Error |

```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed",
  "error_uri": "https://sandbox.loop.co.ke/devportal/docs/errors"
}
```

> All three documented codes show the same `invalid_client` example body, so the
> `error` value alone will not tell you which of the three occurred. Branch on the
> HTTP status here — unlike the payment endpoints, where you branch on `statusCode`
> in the body.

## Using the token

```
Authorization: Bearer <access_token>
Content-Type: application/json
X-Loop-Version: 2024-01
```

An expired token is rejected **before the signature is even checked** — so a stale
token surfaces as a `401` that looks like a signing problem. Obtain a fresh token
before it expires.
