---
name: loop-api
description: >-
  Expert guide to the Loop (NCBA Loop, loop.co.ke) developer API — authentication,
  endpoints, request and response shapes, error codes, sandbox vs production, and
  working integration code. Use this skill whenever the developer mentions Loop, NCBA
  Loop, the Loop devportal, or sandbox.loop.co.ke; whenever they are building or
  debugging a payment, payout, collection, balance check, transaction lookup, or
  account integration against Loop; and whenever they ask whether something is
  possible with Loop, which endpoint to call, why a Loop request is failing, or what
  a Loop error code means. Use it even when they do not name an endpoint — questions
  like "can I disburse to M-Pesa from my Kenyan bank account programmatically", "why
  am I getting 401 from the bank sandbox", or "how do I reconcile these transactions"
  should pull this skill in so answers come from the real documentation instead of
  guesswork.
license: MIT
---

# Loop API

Help developers integrate with the Loop developer API — and be *right*, because this
is a banking API where a wrong endpoint or a misread error code costs real money and
real time.

## The one rule that matters

**Every factual claim you make about Loop — a URL, a header, a field name, an error
code, a limit — must come from a file you have just read in `references/`.**

Do not answer from memory or from general knowledge of "how banking APIs usually
work". Loop is a specific product; plausible-sounding invented endpoints are the main
way an assistant wastes a developer's afternoon. `references/` is generated directly
from Loop's published documentation by `tools/ingest_docs.py`, so every line in it
traces back to a source URL and a fetch date recorded at the top of the file.

If the answer is not in `references/`, say so plainly and point the developer at the
relevant doc page. "I don't see this documented — here's the page to check" is a
genuinely useful answer. A confident guess is not.

## Start here

Read `references/INDEX.md` first. It lists every documentation page with its topic, so
you can load only the one or two files that bear on the question instead of pulling
the whole corpus into context.

Then read the specific file(s) you need. Common entry points:

- `references/api-flows.md` — what each operation actually does, end to end: the order
  the gateway runs its checks, the point at which money moves, and the retry decision
  tree. **Read this for any "is this possible?" or "why did this fail?" question** — it
  also carries a table mapping common product ideas to documented / partly-supported /
  undocumented, which is the fastest honest answer to a feasibility question.
- `references/conventions.md` — the cross-cutting request/response rules. **Read this
  before writing any integration code**, not just when asked about it. It carries the
  rules a developer is most likely to get wrong in a way that costs money rather than
  merely failing.
- `references/signing.md` — if the product requires signed requests, an implementation
  that is subtly wrong fails in ways that look like an auth problem. It carries
  published test vectors; have the developer verify against those before debugging
  against the live API.
- `references/doc-conflicts.md` — **check this before telling a developer their code is
  wrong.** Where the vendor's own documentation contradicts itself, a request that
  "matches the docs" is ambiguous, and this file is often the fastest explanation for
  an inexplicable failure.
- `references/coverage.md` — **check this before saying a capability doesn't exist.**
  Absent from the corpus is not the same as absent from the product.
- `references/manifest.json` — what was captured, from where, when, and by which
  capture method. Check the `fetched` date when a developer reports that reality
  disagrees with the docs, and the `capture` field when precision matters.
- Authentication pages — read these before answering *any* question that involves a
  request, because nearly every failure a developer brings you is an auth failure
  wearing a costume.
- Endpoint pages — for request/response shapes and required fields.

### Capture method affects how firmly you should speak

`manifest.json` records how the corpus was built. A crawler-generated corpus is a
mechanical copy of the published pages. A manually transcribed one carries the same
content but has not been machine-verified, so a typo is possible in a way it is not
for a crawl.

When the corpus is transcribed and the developer is about to move real money on the
strength of an exact value — a field name, an enum, a URL — say the value should be
confirmed against the live portal or its Swagger. Do not let that caveat turn into
hedging on everything: the content is the vendor's, and it is the best available
source until someone runs the crawler.

### If `references/` is empty or missing

The skill has not been populated yet. Tell the developer, and run:

```bash
pip install -r tools/requirements.txt
python tools/ingest_docs.py            # add --render if the portal is client-rendered
```

Do not attempt to answer Loop API questions from memory in the meantime.

### If the references look stale

The `fetched` date is in every reference file. If a developer reports behaviour that
contradicts the docs, treat the live API as the source of truth, say the docs may have
moved, and offer to re-run the ingest and diff the result.

## Workflow: "Is this possible with Loop?"

This is the most valuable question you answer, and it deserves a real investigation
rather than a yes/no reflex.

1. **Restate the goal in banking terms.** "Pay my suppliers automatically each Friday"
   is a bulk payout on a schedule. "Let customers pay me in the app" is a collection.
   Naming the operation tells you which reference pages to open.
2. **Search the references** for that operation. Grep across `references/` for the
   nouns and verbs involved before concluding anything is absent.
3. **Answer with the evidence:**
   - *Directly supported* — name the exact endpoint(s), in call order, and cite the
     reference file. Then show the minimal request.
   - *Supported with caveats* — say what works and what the developer must handle
     themselves (approval steps, callbacks, reconciliation, limits, onboarding).
   - *Not documented* — say the documentation does not cover it, describe the closest
     documented capability, and suggest what to ask Loop support. Do not invent an
     endpoint to be helpful.
4. **Flag the non-code blockers early.** Banking integrations are usually gated by
   business onboarding, entitlements, or approvals rather than by code. If the
   documentation mentions such a prerequisite, lead with it — it's often the real
   answer to "why can't I do this yet".

## Workflow: building an integration

1. Read the authentication reference and get the developer authenticating
   successfully **before** writing any business logic. An integration that can't get a
   token can't do anything else, so this is where to spend the first effort.
2. Confirm they are pointed at **sandbox**, and that they know which base URL they are
   using. Mixing sandbox credentials with production URLs (and vice versa) produces
   confusing auth errors that look like bugs in the code.
3. Write the smallest call that proves the connection works — typically a read-only
   one — and get a real response back.
4. Only then build the actual feature, matching the request/response shapes in the
   references field by field.
5. Cover the failure paths the references document: expired tokens, rejected
   transactions, timeouts, and duplicate submissions. In payments the failure paths
   are the feature — a payment integration without idempotency and retry handling is
   an outage waiting for a bad network day.

Match the developer's existing stack and conventions. If their codebase uses `axios`
and repository classes, don't hand them a `curl` command and a global function.

## Workflow: hardening and security testing

When a developer asks about security, fraud, replay, idempotency, penetration testing,
or "how do I make this safe", read `references/security-testing.md` and work from it.

- **Keep it defensive and authorised.** Help them test *their own* integration, with
  *their own* credentials, in the *sandbox* — replay resistance, double-spend, token
  hygiene, fail-closed behaviour. Do **not** help probe Loop's production systems, other
  people's tills, or anything whose purpose is unauthorised access. If a request points
  that way, say so plainly and redirect to authorised sandbox self-testing.
- **Fraud detection is something they build on top.** Loop documents no risk-scoring or
  fraud API (`references/coverage.md`). If they want one, help them design a
  fail-closed risk layer — hold the payout when a check is uncertain, never release it —
  but do not imply Loop provides fraud primitives it does not.
- The single most valuable test is idempotency: a retry with the same `txnReference`
  must not pay twice. Lead with it.

## Workflow: debugging a failing call

Work down this list — in practice the cause is usually near the top:

1. **Read the actual error.** Get the real status code and response body from the
   developer rather than working from their paraphrase. Then look the code up in the
   references — Loop's own error semantics beat generic HTTP intuition.
2. **Environment mismatch.** Sandbox credentials against production, or the reverse.
3. **Auth.** Expired or not-yet-refreshed token, wrong credential in the wrong field,
   wrong header name, missing scope or entitlement.
4. **Request shape.** Compare the payload field by field against the reference — wrong
   casing, a string where a number belongs, a missing required field, a misformatted
   amount, account, or phone number.
5. **Preconditions.** Account not enabled for the operation, insufficient balance,
   limits exceeded, business profile not approved.
6. **Transport.** IP allowlisting, TLS, timeouts, or a proxy interfering.

Ask for the request (**with secrets removed**) and the full response before
speculating. One look at the real payload usually beats three rounds of guessing.

When you have the cause, give the developer the corrected request and a one-line
explanation of what was wrong — they need to recognise it themselves next time.

## Handling credentials — non-negotiable

This is a banking API. Treat every credential as live money.

- **Never** write an API key, secret, token, password, or account number into source,
  a config file that gets committed, an example, or a message. Use environment
  variables, and add them to `.gitignore`.
- **Never** print a secret back into the conversation. Agent transcripts get pasted
  into issues and chat threads. If a developer pastes a real credential, tell them to
  rotate it.
- **Default to sandbox** in every snippet you write. Moving to production should be a
  deliberate act, not something that happens because an example had a production URL
  in it.
- **Do not execute money-moving calls on your own initiative.** Draft the request,
  explain what it will do, and let a human run it. Read-only calls are fine.
- When showing a captured request or response, redact tokens and account numbers.

## How to answer well

- **Cite as you go.** "Per `references/<file>.md`" lets the developer verify you in
  one click, and keeps you honest about which claims are grounded.
- **Give runnable code**, not pseudocode — correct field names, real error handling,
  credentials from the environment.
- **Separate what's documented from what you're inferring.** If you're reasoning past
  the documentation, say so explicitly. Developers can work with a flagged inference;
  they cannot work with an inference disguised as a fact.
- **Be direct about gaps.** Loop's docs, like all docs, will not cover everything.
  Naming the gap and the workaround is the useful move.

## Bundled helpers

- `scripts/search_docs.py` — grep the reference corpus with context. Faster than
  loading whole files when you only need the page that mentions a field or error code.
- `scripts/validate_skill.py` — checks this skill's structure and links. Run it after
  editing the skill.
- `tools/ingest_docs.py` (repo root) — regenerates `references/` from the live portal.

## Scope and honesty

This is an unofficial, community-maintained skill. It is not published or endorsed by
NCBA or Loop, and the references are a snapshot of public documentation, not a
contract. When correctness genuinely matters — settlement behaviour, limits, fees,
compliance obligations — tell the developer to confirm with Loop directly rather than
relying on a snapshot.
