# Batch 11 mixed-lineage Preview rehearsal

Five records are released together: two supersede an existing canonical
release, three do not. The rehearsal exists because that mixture is the part
most likely to go wrong quietly — a run that releases five initials, or that
supersedes the wrong predecessor, produces a registry that looks healthy.

## What runs

`.github/workflows/preview-batch-11-remote-rehearsal.yml`, manually dispatched.
There is no push, pull-request or schedule trigger, filtered or otherwise.

Three locks must all be satisfied before anything remote happens: the
environment's reviewers approve the run, the operator types the exact operation
name and confirmation phrase, and the checkout is pinned to a reviewed commit
SHA that must equal `HEAD`.

## The seven phases

| # | Phase | Effect |
|---|---|---|
| 1 | `provision-ephemeral-branch` | Creates a schema-only Supabase branch on the Preview project |
| 2 | `apply-migrations` | Applies exactly the immutable plan migration and its dedicated forward execution migration, then deploys the reviewed commit to a private Vercel Preview bound to the new branch |
| 3 | `import-prior-lineages` | Reads two predecessor facts from the public Production registry and stores exact external-lineage witnesses; it does not reconstruct private release rows |
| 4 | `ingest-revisions-and-decisions` | Ingests five proposed revisions and twenty exact-revision decisions |
| 5 | `issue-releases` | Issues five releases under Preview release authority |
| 6 | `verify-transitions` | Checks each transition against its own declaration, independently |
| 7 | `destroy-ephemeral-branch` | Destroys the branch, in a `finally` block and again as a workflow backstop |

## Production is read-only by construction

The rehearsal's only Production access is an unauthenticated `GET` of
`https://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json`.

That is not a policy the code follows; it is the only Production capability the
code has. `RehearsalDriver` exposes no Production write method, so there is no
call to forbid. `assertProductionReadOnly` additionally refuses any Production
descriptor that is a connection string, presents a credential, or names any URL
other than that one — a write-capable credential inside the job is the hazard,
not only the write.

The job holds no Production database password, no Production service-role key
and no Production release-authority token. No corpus or unrelated release is
read into the branch or touched: the import is constrained to two exact tuples
of record id, predecessor release id, and predecessor target digest.

## Fail-closed points

- **Absent branch credential.** Phase 1 refuses before any mutation.
- **Production project as branch parent.** Refused from the input, and again
  from the created branch's reported parent.
- **Import outside the allowlist.** Any record other than the two external
  predecessor witnesses, any wrong predecessor id, any wrong digest, a short import, or
  a duplicate — each refuses. The three initial records have no predecessors
  and can never appear here; importing one would manufacture the lineage its
  gate requires to be absent.
- **A migration this lifecycle did not declare.** Refused in both directions:
  an extra migration and either missing required migration.
- **A release binding a revision other than the gated one.** Refused.
- **A predecessor removed rather than superseded.** Refused; release history is
  append-only.
- **An initial release that superseded something.** Refused.
- **Secret-shaped text in the evidence.** Refused, not redacted. Checked in the
  script, and again in the workflow against the artifact that leaves the runner.
- **Private corpus text in a served bundle.** Checked against the rendered HTML
  *and* the RSC flight payload, which can carry text the markup never shows.

## Replay safety

Idempotency keys are derived from the exact revision digest and contain no
timestamp and no run id. Re-running the rehearsal presents the same key for the
same intent, so the server recognises a replay and creates nothing. A key
carrying run identity would make every replay look novel, which is precisely
how a rehearsal becomes a duplicate release.

## Evidence

`batch-11-rehearsal/evidence.json` is sanitized: it carries no credential,
customer data, source passage, absolute path, or private review prose. GitHub
retains the workflow run time separately. The evidence records bounded phase
counts, cleanup status, non-reversible digests and the fact that Production
access was a credential-free public HTTPS GET.

## Remaining operational prerequisite

The rehearsal is implemented and its phases are exercised end to end in tests,
but an authorized protected run has **not** executed. Two environment facts
block it, both of which require repository-settings access:

1. The `batch-11-preview-rehearsal` environment does not exist. The
   environments that do exist are `Preview`, `preview-capacity`, `preview-e2e`,
   `Production`, `production-canary`, `production-database`,
   `production-monitoring` and `production-x402-canary`. It must be created
   with required reviewers.

2. **`SUPABASE_ACCESS_TOKEN` must be bound to that environment.** This is the
   established name for the Supabase Management API token and is
   the credential that creates and destroys a branch. It is currently bound
   only to `production-database`. No new credential is introduced by this
   rehearsal, and none should be minted for it.

   Because that token is account-scoped rather than branch-scoped, the parent
   project ref is refused if it equals the Production project — in the workflow
   before checkout, in the runner before provisioning, and once more against
   the created branch's reported parent.

The environment also needs `SUPABASE_PROJECT_REF` for the designated
non-Production parent,
the Preview-scoped `EPISTEMIC_OPERATIONS_TOKEN`,
`EPISTEMIC_RELEASE_AUTHORITY_TOKEN`, and
`VERCEL_AUTOMATION_BYPASS_SECRET`, plus a protected `VERCEL_TOKEN` that can
create and delete a Preview deployment. The workflow no longer accepts an
operator-supplied Preview origin: it creates the deployment itself from the
exact reviewed commit after the branch is ready and migrations have applied.

The branch configuration supplies its own database password and JWT signing
secret. The runner derives a one-hour service-role JWT, passes it to Vercel by
environment-variable name rather than command argument, verifies deployment
protection, and destroys both resources in `finally`. No parent database
password is copied into the rehearsal environment.

Until then, dispatching the workflow refuses at phase 1 with
`branch-credential-absent`, having created nothing, applied nothing and
released nothing. That is the intended outcome, not a degraded one.
