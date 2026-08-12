# Autonomous MPS Audit promotion

Promotes `mps-autonomous-audit` from `withheld` to `available`: `POST
/api/v1/mps/audit`, 100,000 USDC base units ($0.10), Base Mainnet.

Flipping `status` is the entire promotion: the moment it deploys, an autonomous
agent can sign for $0.10.

An earlier draft of this document said *"do not merge until every Production
gate passes."* That is circular and was wrong. The Production endpoint cannot
answer a payment challenge, let alone accept a settlement, until this change is
merged and deployed — so the paid gates are unreachable before the merge they
were supposed to authorize. The gates are therefore ordered into four stages
below, each with its own approval, and the paid one comes **after** deployment
on purpose.

## What is deliberately unchanged

A promotion that also re-priced or re-scoped the offer would be two changes
wearing one review. All of the following are identical to `origin/main`:

| | |
| --- | --- |
| Endpoint | `POST /api/v1/mps/audit` |
| Price | 100,000 USDC base units ($0.10) |
| Network | Base Mainnet, `eip155:8453` |
| Asset | Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Payee | `0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28` |
| Concurrency cap | 2 |
| Request limit | 32 KiB |
| Idempotency | required: idempotency key + input hash, claimed **before** settlement |
| Limitations | automated claim triage; not certification, legal advice, or human verification |
| Retention | complete passage not stored; 6–25 word verbatim claim excerpts retained |
| Retrieval | `GET /api/v1/mps/audit/{auditId}` — authenticated by one-time retrieval token, **unpriced** |

The retrieval path stays free on purpose: recovering a job you already bought
must never cost a second payment.

## Why the previous evidence was not enough

The catalog's first blocker was *"the required Production paid-job and admission
migrations have not yet been applied and verified."* The migrations were applied
in the 2026-08-11 batch, and the migration list showed them present — but the
read-only Production census (`production-x402-settlement-verification.yml`)
deliberately restricts itself to `x402_offer_usage_daily`, `x402_payments` and
`x402_settlements`. `x402_mps_audits` and `resume_x402_mps_audit` were never
directly observed.

Readiness cannot close that gap either: it probes storage only for offers that
are *enabled*, and MPS is not enabled anywhere. Its passing
`x402.offer.mps-autonomous-audit.runtime` check reports environment variables —
the Anthropic key and the retrieval-token secret — not database objects.

So the honest position before this change is: **applied, inferred, not
observed.** Gate 1 exists to convert that into an observation. The same class of
mistake — reading a probe that could not run as a probe that passed — already
cost a day on the Deep Context promotion.

## Stage 1 — Pre-merge gates

All of these are reachable without merging, deploying or spending. Every one
must pass before the deployment approval in Stage 2 is requested.

| # | Gate | Status |
| --- | --- | --- |
| 1.1 | **Preview** database census green — every listed table and function `true` | **PASSED 2026-08-12**: all ten `true` after applying `…000400` (census run 31575178797) |
| 1.2 | **Production** database census green | **PASSED 2026-08-12**: all ten objects `true` (run 31573419127) |
| 1.3 | Preview readiness HTTP 200 | **FAILED** — HTTP 401, token mismatch; see below |
| 1.4 | Preview unpaid `POST /api/v1/mps/audit` returns **402** — never 401, never 400 | **PASSED 2026-08-12** (run 31581546606) |
| 1.5 | Challenge amount exactly `100000` | **PASSED** — `100000 eip155:84532 exact` |
| 1.6 | Crawler probe of the published example returns **402**, never 400 | **PASSED** — HTTP 402 |
| 1.7 | `x402-doctor` 0 errors | **PASSED** — `ok=true http=402 crawler=402 errors=0` |
| 1.8 | Anthropic and retrieval-secret runtime checks pass | confirmed via Production readiness |
| 1.9 | MPS, admission, settlement and telemetry objects present | **PASSED** — via 1.1 and 1.2 |
| 1.10 | Recovery and idempotency exercised in Preview | **deferred** — no funded Sepolia wallet |

**Gate 1.1 passed on the second attempt, after a repair the census exposed.**
The first Preview census, run
[31573354515](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/31573354515),
reported `x402_mps_audits=false` and `resume_x402_mps_audit=false`: migration
`20260810000400_x402_mps_audit_jobs.sql` had never been applied to the Preview
database. It was applied on 2026-08-12 under explicit authorization, through
`preview-migrations.yml` run
[31575096596](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/31575096596)
— whose target guard confirmed a non-Production ref before touching anything —
creating one table, three indexes and one function. Migration sha256
`7ec278c353f1e9863f8bf455fa941a733c5729bf0d12a75ede25eac5ff73fc13`.

Re-censused independently afterwards rather than trusting the migration's own
verification step: run
[31575178797](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/31575178797)
reports all ten objects `true` in Preview.

**Gate 1.2 passed.** Census run
[31573419127](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/31573419127),
through the reviewer-protected `production-database` environment, reports all
ten objects `true` in Production.

The two databases now agree. Before the census they did not, and nobody knew:
the objects existed where money moves and were missing where the behaviour
would be rehearsed. Recovery and idempotency can now be exercised in Preview
without spending $0.10, which was the entire point of insisting on this gate.

This is exactly what the census was built to find, and why "applied, inferred,
not observed" was not good enough to promote on. Neither database had been
looked at; one of them would have been wrong.

Applying that migration to Preview is a reviewed dispatch of
`preview-migrations.yml`, and it needs its own authorization.

Gates 1.4 and 1.7 are unreachable before Stage 2 for the same circular reason
this document was restructured to fix. `x402-doctor` against the live MPS
endpoint reports one error today —
`x402.http.challenge_status: The unpaid request returned HTTP 401; Bazaar
requires HTTP 402` — because an offer that is not in `X402_RESOURCES` has no
payment contract to validate. The doctor is correct; the endpoint is behind the
API-key gate. Both gates are re-run against Preview once the path is enabled
there, and against Production immediately after Stage 2 step 4.

Gate 1.4 deserves its own line because MPS currently answers **401**, not 402.
Until the path is in `X402_RESOURCES` for the environment under test, the offer
is behind the API-key gate and no payment challenge exists to check.

Gate 1.6 is separate from 1.7 because the crawler probe sends the offer's own
published input example. A **400** there means the published example does not
satisfy the live schema — a product defect that only becomes visible once the
offer is priced.

### Preview gate results

MPS is enabled in Preview. `X402_RESOURCES` is set **branch-scoped to
`codex/promote-mps-audit`** with method and path for all three offers, so no
other Preview branch is affected and the environment-wide value is untouched.

Run
[31581546606](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/31581546606)
of `preview-mps-gates.yml`:

```
1.3 readiness            : failure   (HTTP 401)
1.4/1.5 unpaid challenge : success   100000 eip155:84532 exact -> 0x86C2372038774e160b61903D5EDC14bE9233752F
1.6 crawler example      : success   HTTP 402
1.7 x402-doctor          : success   ok=true http=402 crawler=402 errors=0 warnings=1
```

The single doctor warning is the standing informational note about
`EXTENSION-RESPONSES` not being observable, which describes what the
facilitator forwards rather than anything wrong with the offer. Zero errors.

**The unpaid contract is correct.** The offer answers 402 rather than 401, at
exactly 100,000 base units, and the crawler replay of its own published example
returns 402 rather than 400 — so the declaration a buying agent would read
matches the schema the endpoint enforces.

Two things the run corrected along the way, both worth recording because both
were mistakes in the *gate* rather than the product:

1. The first version asserted `eip155:8453` in Preview and failed a correctly
   configured environment. Preview settles on **Base Sepolia**
   (`eip155:84532`) by design. Asserting Mainnet there would also have *passed*
   a Preview accidentally pointed at real money, which is the expensive
   direction to be wrong in, so the gate now fails explicitly if it ever sees
   Mainnet in Preview. The Mainnet assertion belongs to Stage 2 step 5.
2. Readiness aborted the job and hid the other three gates. Each gate now
   reports independently; readiness is deferred, not waived.

### Gate 1.3 outstanding: readiness returns 401

Not a deployment-protection problem any more — the bypass works, and the 302
became a 401 from the application itself. `authorizeReadiness` compares the
`Authorization: Bearer` value against `RELEASE_HEALTH_TOKEN` in constant time,
so a 401 means the token GitHub holds is not the token the Preview deployment
holds.

This is a value mismatch an operator resolves: set the GitHub `Preview`
environment's `RELEASE_HEALTH_TOKEN` to the same value as the Vercel Preview
variable of that name. Nothing in the promotion changes; the gate is a
verification, not a dependency.

### Recovery and idempotency (1.10)

No funded Base Sepolia wallet exists, and none was created: the standing
instruction is not to fund a wallet merely to satisfy this gate, and the
Mainnet key must never be used for a testnet assertion.

Exercised in Preview **if a funded Base Sepolia wallet exists**. If none does,
this gate is **explicitly deferred to the single authorized Production
verification** in Stage 4, and that deferral must be stated in the approval
request rather than left implicit.

**The Mainnet key must never be used for a testnet assertion.** Do not create or
fund a wallet solely to satisfy this gate.

## Stage 2 — Deployment gate

Requires explicit approval to merge and promote. Not implied by Stage 1 passing.

1. Explicit human approval to merge this PR and deploy.
2. Production `X402_RESOURCES` gains **method and path only**:
   `{"method":"POST","path":"/api/v1/mps/audit"}`.
   No description, no amount, no concurrency cap — the catalog owns those, and a
   stale copy in the variable is what put readiness at 503 on 2026-08-11.
3. **Take care not to reprice the existing deployment.** The variable must be
   read, appended to, and rewritten whole; the two existing entries must survive
   byte-identical. Verify Context Compression still challenges at `1000` and
   Deep Context at `10000` **after** the change.
4. Deploy, then require readiness **HTTP 200**.
5. Unpaid Production `POST /api/v1/mps/audit` must return **402 for exactly
   100000** before any signature is produced.

If step 5 disagrees in any particular, go to Rollback. Do not pay.

## Stage 3 — Paid verification gate

**Requires fresh human authorization for exactly one 100,000 base-unit ($0.10)
Base Mainnet settlement.**

No earlier authorization counts. The $0.001 canary authorization does not count.
The $0.01 Deep Context authorization of 2026-08-11 does not count. Approval of
this document does not count, and neither does merging the PR.

Stop before signing until Mayone explicitly authorizes this exact transaction:
this offer, this amount, this network, this payer.

## Stage 4 — Post-payment evidence

1. Confirmed `PAYMENT-RESPONSE` transaction, corroborated on chain.
2. A completed MPS job and its one-time retrieval token.
3. Free retrieval at `/api/v1/mps/audit/{auditId}` succeeds.
4. An identical idempotent replay returns the **same job** with **no second
   payment**.
5. Exactly **one** settlement row, **one** MPS job row, **one** telemetry
   increment. Not "at least one" — a duplicate here is a double charge.
6. Bazaar record and declaration digest current for the offer.
7. **No recurring paid canary**, and none added afterwards.

### Why no canary

The Context Compression canary settles $0.001 on a schedule to protect its
Bazaar listing. MPS is a hundred times that price. A scheduled job that pays
$0.10 to keep a listing warm converts silence into a standing charge nobody
approved. If the MPS listing nears the 30-day inactivity threshold, the
read-only inactivity watch escalates it to a human and a refresh is a manual,
authorized dispatch.

The buyer wallet holds 754,000 base units ($0.754) — seven settlements. That is
a reason for care, not a budget.

## Rollback

**If the unpaid contract is wrong at any point: do not pay.** A wrong challenge
is cheap to fix and expensive to buy.

- Remove `/api/v1/mps/audit` from Production `X402_RESOURCES` and redeploy, or
  revert the promotion commit — whichever restores the correct state faster.
  Removing the path is sufficient to stop settlement: the route falls back to
  the API-key gate and answers 401 rather than charging.
- Verify the two compression offers still challenge at `1000` and `10000`
  afterwards. A rollback that repriced a working offer is a worse outcome than
  the fault it fixed.

**If paid delivery fails**, preserve the transaction hash, the `auditId`, the
retrieval token and the response body before changing anything. Then keep the
offer unpriced until the failure is understood. Do not retry with a second
signed authorization on an ambiguous result: an x402 settlement can broadcast
and then fail to answer, so a retry can double-spend against a delivery nobody
observed.

## Ordering against the offer selection guide

Resolved. PR #58 merged first, and this branch now integrates the MPS audit
into the published selection contract: its own objective
(`claim-provenance-triage`), its 100,000 base-unit price, the 6,000-character
passage limit, its idempotency requirement, its retained claim excerpts, and its
non-fit conditions. Triage is reachable only by asking for it — a compression
request never falls through into a $0.10 model call — and an over-budget or
unavailable MPS rejects rather than substituting a cheaper offer that would
answer a different question.
