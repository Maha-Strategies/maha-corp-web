# x402 promotion readiness evidence — 2026-08-11

Pre-flight for promoting Deep Context Evaluation ($0.01) and the Autonomous MPS
Audit ($0.10) to Production. **Promotion did not proceed.** Two stop conditions
were hit at step 2, before any Preview enablement, any Production change, and
any settlement.

No secret value appears in this file. Variables are recorded by presence only.

## Stop conditions

### 1. Production readiness returns HTTP 503

`GET /api/admin/x402-readiness` (Production, authenticated) → `503`,
`state: "unavailable"`.

The failing check is on the **already-live** Context Compression offer, not on
anything being promoted:

```
[fail] x402.catalog.agreement
  X402_RESOURCES contradicts the published catalog in 2 place(s).
  - context-compression: X402_RESOURCES describes POST /api/v1/compress
    differently from the catalog. The challenge and the manifests would disagree.
  - context-compression: X402_RESOURCES caps POST /api/v1/compress at 10 but
    the catalog publishes 8.
```

The **amount agrees** (1000), and the catalog's values win at runtime by design,
so nothing is currently mispriced — the live 402 serves the catalog description
and a cap of 8. The Production variable is simply stale: it was written before
the catalog became authoritative for description and concurrency.

Section 8 requires stopping on a 503, and step 4 requires readiness 200 both
before and after promotion, so this must be reconciled regardless.

### 2. `X402_RETRIEVAL_TOKEN_SECRET` is absent in Preview *and* Production

Step 5 requires it at ≥32 characters in both environments before MPS may be
enabled anywhere. It exists in neither.

This is not a formality. The MPS route derives its retrieval credential from
this secret and **refuses with 503 before the Anthropic boundary** when it is
missing, precisely so a payment cannot settle against a job nobody could open.
Enabling MPS today would therefore take $0.10 and fail — the exact outcome the
durable-recovery design exists to prevent.

MPS promotion is blocked at its first precondition.

## Migration evidence

Workflow: `production-migrations.yml`, target asserted against the Production
project ref by the workflow's own guard.

| Run | Result | Note |
| --- | --- | --- |
| `31478415051` (09:35Z) | **failure** | applied all 10, then the drift check failed |
| `31478015930` (09:30Z) | success | |
| `31477683473` (09:26Z) | success | |

Request: `mode: apply`, actor `mayonerajan`, reason "Apply ten reviewed unified
Maha Production migrations", commit `76c69fe5`. Integrity: *"Migration integrity
check passed: 79 migrations verified against 76c69fe5."*

`applied.txt` from the failing run records all ten as applied, including the
four this promotion depends on:

- `20260810000300_x402_offer_telemetry.sql`
- `20260810000400_x402_mps_audit_jobs.sql`
- `20260810000500_x402_offer_admissions.sql`
- `20260810000600_x402_repeat_payers_confirmed_only.sql`

`migration-list-after.txt` shows all four present in the remote migration table
(`20260810000300` … `20260810000600`).

**The run's failure is not x402 drift.** Two things went wrong in the
*verification* step, after a clean apply: a Docker Hub rate limit, and pgdelta
failing to read its TLS certificate
(`ENOENT … pgdelta-target-ca.crt`), which made the catalog export produce no
output. The residual `drift-after.sql` is 1,348 bytes and contains **zero**
x402 references — only three legacy trigger functions that predate this work:
`handle_new_node`, `handle_new_user`, `join_fireteam`.

That residual drift is real and unrelated, and is worth a separate ticket. It
does not block these offers.

## Database objects

Readiness only probes offers that are *enabled*, so Deep Context and MPS were
not probed directly. The probe fails closed — a function probe that cannot run
marks every function missing — so the passing check below is positive evidence,
not a skip.

```
[ok] x402.offer.context-compression.storage:
     context-compression has the tables and functions it needs.
```

That single check transitively proves more than it appears to:

| Object | Status | How established |
| --- | --- | --- |
| `x402_payments` | present | probed |
| `x402_offer_usage_daily` | present | probed |
| `record_x402_offer_usage` | present | probed |
| `x402_readiness_functions` | present | the function probe executed at all; it is defined in migration `…000500` |
| `x402_offer_admissions`, `reserve/settle/release_x402_admission` | present | same migration `…000500` |
| `x402_mps_audits`, `resume_x402_mps_audit` | applied per migration list | migration `…000400`; not directly probed |
| `x402_repeat_payers` | applied per migration list | migration `…000600`; not directly probed |

**Deep Context requires exactly the objects already proven present**
(`x402_payments`, `x402_offer_usage_daily`, `record_x402_offer_usage`). Its
database prerequisites are met.

## Production variable presence

Checked by name only.

Present: `X402_ENABLED`, `X402_RESOURCES`, `X402_FACILITATOR_URL`,
`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `X402_PAY_TO`, `X402_ASSET`,
`X402_NETWORK`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
Supabase URL and service-role credentials, `ANTHROPIC_API_KEY`,
`RELEASE_HEALTH_TOKEN`.

Absent: `X402_CHAIN_RPC_URL`, `X402_RETRIEVAL_TOKEN_SECRET`.

`X402_CHAIN_RPC_URL` is **not** blocking: Base carries a built-in default RPC,
and readiness confirms *"Settlements are corroborated against the chain."* It is
worth setting explicitly so confirmation does not depend on a public endpoint's
rate limits, but chain confirmation is live today.

## Live endpoint state

| Endpoint | HTTP | Detail |
| --- | --- | --- |
| `POST /api/v1/compress` | **402** | amount `1000`, `eip155:8453`, Base USDC (`0x833589fC…`), merchant payee (`0xec84c1cd…`), `offerId: context-compression`, `status: available` |
| `POST /api/v1/compress/evaluate` | **401** | unpriced; refused by the API-key gate |
| `POST /api/v1/mps/audit` | **401** | unpriced; refused by the API-key gate |

The two unpromoted routes fail in the safe direction: unpriced means no money
can be taken, rather than mispriced.

## Regression gates (branch `codex/promote-x402-offers`, from `origin/main`)

| Gate | Result |
| --- | --- |
| Unit/integration suite | **729 pass / 0 fail** |
| TypeScript | clean |
| ESLint | 0 errors (1 pre-existing warning, unrelated script) |
| Production build | succeeds, 294 pages |
| x402 conformance corpus | 16/16 |
| Public-contract consistency | pass |

## What would unblock each offer

**Deep Context** — one reconciliation: correct Production `X402_RESOURCES` so its
description and concurrency cap agree with the catalog (the amount already
does), returning readiness to 200. Database objects, settlement configuration
and chain confirmation are already proven. Then Preview enablement, unpaid
gates, and one authorized $0.01 settlement.

**MPS** — provision `X402_RETRIEVAL_TOKEN_SECRET` (≥32 characters) in Preview
and Production, then direct verification of `x402_mps_audits` and
`resume_x402_mps_audit`, then the Preview recovery gates.

Both are configuration changes to Production and were not made unilaterally.


---

# Update — option (b) attempted, blocked at step 1

## Completed since the first report

- Production `X402_RESOURCES` corrected to method+path only; readiness **HTTP 200 / ready**; the $0.001 contract verified unchanged (amount 1000, `eip155:8453`, Base USDC, merchant payee).
- Two distinct 32-byte secrets set for `X402_RETRIEVAL_TOKEN_SECRET` (Preview and Production, separately generated, never printed or persisted).
- MPS runtime precondition confirmed in Preview **without enabling MPS**:
  `[ok] MPS paid-job runtime dependencies are configured; the offer is not enabled here.`
- Deep Context enabled in branch-scoped Preview; all unpaid gates pass, x402-doctor **PASS / 0 errors** on both compression offers.

## Blocked: no reachable path to the Preview database

Step 1 asks for the telemetry migration to be applied to the Preview database,
with the target verified as Preview beforehand. Neither is possible with the
access available here.

| Path | Result |
| --- | --- |
| GitHub `Preview` environment | **no secrets, no variables** — no CI migration path exists |
| `production-database` environment | has `SUPABASE_DB_PASSWORD` / `SUPABASE_ACCESS_TOKEN`, but `SUPABASE_PROJECT_REF=uhwuullakihgszxhiygz` is **Production** |
| Preview `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Vercel-Sensitive; pull returns `[SENSITIVE]` |
| Supabase management API | access token is in the OS keyring, not readable |
| Client bundle scan | `NEXT_PUBLIC_SUPABASE_URL` is not inlined in any served bundle |

What *is* established: Preview and Production use **different** databases —
Production readiness reports `record_x402_offer_usage` present, Preview reports
it missing. Of the three Supabase projects on the account
(`maha-production-shared`, `agentic-publisher`, `maha-corp-staging.`), staging is
the only plausible Preview target by elimination.

Elimination is not verification. Running DDL against a database identified by
inference is precisely the mistake the migration workflow's own target-assertion
guard exists to prevent — and the same class of error as the 2026-08-03
staging/Production mix-up recorded in that workflow's header. It was not done.

The Preview shortfall is narrow: tables and `x402_readiness_functions` are
present; only `record_x402_offer_usage()` is missing, so migration
`…000300` appears to have not reached that database while `…000500` did.

## Consequence

A Preview settlement remains possible and would prove settlement, delivery,
`PAYMENT-RESPONSE`, retention and non-regression — but **not** the telemetry
increment, which is the one criterion that motivated option (b). It would also
run on Base Sepolia rather than Mainnet.
