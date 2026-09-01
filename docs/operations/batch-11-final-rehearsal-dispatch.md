# Batch 11 final rehearsal: dispatch instructions

Everything in the repository is ready. The rehearsal is blocked on five
credentials that no longer exist, and provisioning them needs provider accounts
Claude does not hold.

All previous temporary credentials were revoked after the last run. **Do not
reuse any of them.** Only `SUPABASE_PROJECT_REF` and `VERCEL_TOKEN` remain bound.

## Reviewed commit

```
6e3504e4fcf199154e6f9a619aef5e4b97e78116
```

This is the commit the run must be dispatched at. The workflow checks out this
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
| `reviewed_commit` | `6e3504e4fcf199154e6f9a619aef5e4b97e78116` |
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
the temporary GitHub secrets, then confirm with each provider that they no
longer resolve. An operator's own statement that they revoked something reduces
to `reported-revoked`, which does not close.

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
