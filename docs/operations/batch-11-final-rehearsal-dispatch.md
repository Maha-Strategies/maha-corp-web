# Batch 11 final rehearsal: dispatch instructions

Everything in the repository is ready. The rehearsal is blocked on five
credentials that no longer exist, and provisioning them needs provider accounts
Claude does not hold.

All previous temporary credentials were revoked after the last run. **Do not
reuse any of them.** Only `SUPABASE_PROJECT_REF` and `VERCEL_TOKEN` remain bound.

## Reviewed commit

The run must be dispatched at **the exact current merged `main`**. Read it at
dispatch time rather than copying a value from here:

```bash
git fetch origin && git rev-parse origin/main
```

A SHA written into this file goes stale the moment the file is merged, because
merging it moves `main`. That already happened once. The workflow checks out this
SHA and refuses if `HEAD` differs, and the artifact digest binds it, so a run
from any other tree fails verification afterwards even if it succeeds.

## What to provision

Five values, bound to the protected `batch-11-preview-rehearsal` environment.
It already exists with one required reviewer.

| Secret | What it is |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | A **new** Supabase personal access token, seven-day expiry, scoped to the staging project only. Never the Production project. |
| `SUPABASE_ACCESS_TOKEN_SHA256` | `sha256:` followed by the 64-character lowercase hex digest **of that token**. |
| `EPISTEMIC_OPERATIONS_TOKEN` | A temporary operations credential, at least 32 bytes. |
| `EPISTEMIC_RELEASE_AUTHORITY_TOKEN` | A temporary release-authority credential, at least 32 bytes, **different from the operations token**. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | A temporary Vercel automation-bypass secret. |

### Computing the fingerprint

Run this where the token already is. It prints only the digest, and the token
never leaves the machine:

```bash
printf '%s' "$SUPABASE_ACCESS_TOKEN" | shasum -a 256 | awk '{print "sha256:"$1}'
```

Bind that output as `SUPABASE_ACCESS_TOKEN_SHA256`. The workflow refuses before
checkout if the value is not exactly `sha256:` plus 64 lowercase hex characters,
and refuses if it equals the token itself.

The run then hashes the bound token and compares it against this value with a
timing-safe comparison **before creating anything**. A stale or wrong token
stops the run at zero remote operations rather than after a branch exists —
which is what the previous run did the expensive way.

## Dispatching

Workflow: **Batch 11 remote Preview rehearsal**, manual dispatch only.

| Input | Exact value |
|---|---|
| `operation` | `batch-11-mixed-lineage-preview-rehearsal` |
| `confirmation` | `rehearse-batch-11-mixed-lineage-in-preview-only` |
| `reviewed_commit` | the output of `git rev-parse origin/main` |
| `preview_origin` | the HTTPS Vercel Preview origin for that commit |

All four are compared exactly. A reviewer must approve the environment before
any step runs.

## What the run must show

Seven phases in order; five releases, two superseding and three initial, each
binding its exact revision, source-alignment audit and scoped decision bundle;
zero Production writes; a private Preview only; and every temporary resource
destroyed.

## After the run

Two things are needed before closure can be verified, and neither comes from
the run itself.

**Teardown observations.** Query the four providers for surviving resources and
feed the sanitized results to the producer. A query that failed, was never
attempted, or covered a partial scope produces `unknown`, not absence.

**Revocation checks.** Revoke the Supabase token, the Vercel bypass secret and
the temporary GitHub secrets, then run the collector. It asks each provider
directly and records only what the provider answers:

```bash
MAHA_B11_RUN_ID=<the run id> \
MAHA_B11_REVIEWED_COMMIT=<the reviewed commit> \
SUPABASE_ACCESS_TOKEN=<the revoked token> \
VERCEL_TOKEN=<...> VERCEL_PROJECT_ID=<...> \
VERCEL_AUTOMATION_BYPASS_SECRET=<the revoked bypass> \
GITHUB_TOKEN=<...> \
node --experimental-strip-types scripts/collect-batch-11-revocation-evidence.ts \
  --out batch-11-teardown/revocation.json
```

Supply the exact credential you are testing — the collector fingerprints the
value, and the closure verifier checks that fingerprint against the one the run
artifact recorded. A different token, however genuinely revoked, will not close
this run. A credential that is not supplied yields `not-attempted`, which does
not close, and an operator's own statement reduces to `reported-revoked`, which
also does not close.

The Vercel probe needs the revoked bypass **value**, not just a project id. The
question it answers is whether that exact key is gone from the project's
`protectionBypass` map — a map this project legitimately shares with unrelated
automation bypasses, so "the project has bypasses" answers nothing. Other keys
may remain without affecting closure.

| Provider answer | Meaning |
| --- | --- |
| Supabase `401` | Confirmed revoked. The only status that closes. |
| Supabase `200` | **Still active.** The token was not revoked. |
| Supabase `403` | Unknown — a valid fine-grained token that lacks permission answers 403, so this is not revocation. Same for `404`, `429`, `5xx` and transport failures. |
| Vercel: exact key absent | Confirmed revoked. |
| Vercel: exact key present | Still active. |
| Vercel: unreadable | Unknown. |
| GitHub: none of the five names listed | Confirmed revoked, bound to the environment/run/commit slot. |

There is no Supabase token-introspection endpoint to use instead: the Management
API's only token paths are the OAuth application flows, and `/v1/oauth/revoke`
is a `POST` that revokes rather than reports. Nothing in this step may mutate.

### Why closure is a post-run step

The workflow cannot close itself. The temporary credentials are still live while
it runs — they have to be, it is using them — so revocation can only be observed
afterwards. The run uploads `batch-11-sanitized-teardown-partial`; the GitHub
portion, the revocation checks and the closure verification are all operator
steps that follow it.

Then:

```bash
node --experimental-strip-types scripts/verify-batch-11-closure.ts \
  --artifact <run evidence.json> \
  --teardown <teardown observations.json> \
  --revocation <revocation evidence.json>
```

It exits non-zero unless every check passes, and writes a deterministic JSON
report plus a Markdown summary.

## Why Claude stopped here

Minting a Supabase personal access token needs a Supabase account session, and
minting a Vercel bypass secret needs a Vercel one. Neither CLI is authenticated
in Claude's environment, and binding the values through `gh` would mean handling
raw secrets, which the standing instructions forbid. The boundary is
provisioning, not capability: everything downstream of it is built and tested.
