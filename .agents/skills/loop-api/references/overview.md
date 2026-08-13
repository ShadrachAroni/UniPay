<!-- source: https://sandbox.loop.co.ke/devportal/docs/loop-api/overview -->
<!-- fetched: 2026-08-13 -->
<!-- capture: manual-transcription -->

# LOOP API Overview

> Source: <https://sandbox.loop.co.ke/devportal/docs/loop-api/overview> (transcribed 2026-08-13)

The LOOP API provides secure payment capabilities that let your application initiate,
process, and track payments through a consistent API integration.

## Environments

LOOP provides two isolated environments. Use Sandbox for all development and testing —
it mirrors production behaviour without moving real funds.

| Environment | Base URL | Status |
| --- | --- | --- |
| Sandbox | `https://sandbox.loop.co.ke` | Active |
| Production | `https://api.loop.co.ke` | By request |

Switching environments means changing the base URL and your credentials — no code
changes.

## Authentication model

LOOP APIs use **OAuth 2.0 client credentials**. The flow differs between Sandbox and
Production only in how you obtain keys.

### Sandbox — instant keys

1. **Create an application** in the Developer Portal, select Sandbox, and subscribe to
   the required LOOP APIs.
2. **Generate Sandbox keys.** Click "Generate Keys" under the Sandbox section. Copy
   the Consumer Key and Consumer Secret.
3. **Generate an access token:**

   ```bash
   curl -vk \
     -u "<CONSUMER_KEY>:<CONSUMER_SECRET>" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials" \
     "https://sandbox.loop.co.ke/oauth2/token"
   ```

   ```json
   {
     "access_token": "eyJhbGciOiJSUzI1NiIs...",
     "expires_in": 900,
     "token_type": "Bearer"
   }
   ```

4. **Use the token in the Authorization header** on every request:

   ```
   Authorization: Bearer <access_token>
   X-Loop-Version: 2024-01
   ```

5. **Call any subscribed LOOP API:**

   ```http
   POST /gateway/loop-prompt/2/services/process-service-request2 HTTP/1.1
   Host: sandbox.loop.co.ke
   Authorization: Bearer <access_token>
   Content-Type: application/json
   X-Loop-Version: 2024-01
   ```

Sandbox tokens and keys are issued instantly and usable immediately. They are for
testing only and must not be used in production.

### Production — requires approval

Same five steps, plus an approval gate:

1. Create your application and subscribe to the required APIs.
2. **Request production keys.** Clicking "Generate Keys" under Production triggers an
   approval workflow. Until approved, keys remain hidden and unprovisioned.
3. **Get notified** once approved.
4. **Access your keys** in the Production section (`prd_live…` prefix).
5. Generate a token against `https://api.loop.co.ke/oauth2/token` with your production
   credentials.
6. Use `Authorization: Bearer <access_token>` and `X-Loop-Version: 2024-01`.
7. Call the APIs against `Host: api.loop.co.ke`.

> **Plan for this lead time.** Production access is gated on an approval workflow, not
> on your code. It is frequently the real answer to "why can't I go live yet".

Do not share keys or tokens. Revoke and regenerate if compromised.

## Token lifetime

The Overview page states tokens are **short-lived (15 minutes)** and its sample
response shows `expires_in: 900`.

The Authorisation endpoint page shows `expires_in: 3600` in its sample. These
contradict — see [`doc-conflicts.md`](./doc-conflicts.md). Treat `expires_in` from the
live response as authoritative and refresh on it rather than on a hardcoded constant.

## What you can build

The LOOP Payment APIs give you building blocks to integrate digital payment
capabilities into your applications:

- **Build payment experiences** — initiate, collect and track payments.
- **Accept payments** — integrate payment capability so customers can pay.
- **Automate payment workflows** — connect transactions to existing business
  processes.
- **Track transactions** — retrieve payment information and status.
- **Build payment-powered products** — marketplaces, e-commerce platforms, business
  applications.

## Getting help

- **Developer Support** — open a ticket with the LOOP integration team. Response
  within 1 business day.
- **API Status** — real-time uptime, incident reports, scheduled maintenance.
- Email: `apisupport@loop.co.ke`
- Tel: +254 709 714 444 / +254 730 714 444
