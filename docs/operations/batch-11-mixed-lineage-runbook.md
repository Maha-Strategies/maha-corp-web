# Batch 11 mixed-lineage release runbook

Five records, two lineage classes. Two supersede existing canonical releases;
three have none and must be released as initial. The batch was frozen on the assumption that
all five supersede, and that assumption was wrong.

**Nothing in this document has been executed.** No release was performed, no
Preview database was created, no migration was applied, and no credential was
presented.

## Verified classification

| Record | Kind | Prior release | Proposed revision |
|---|---|---|---|
| `advanced-materials-color-centers-in-diamond` | **initial** | — none — | generated from the accepted replacement and exact-revision review |
| `fusion-plasma-systems-tokamak-plasma-equilibrium` | **superseding** | epirelease_8e947374097d4695815dbf9ab653177b | generated from the accepted replacement and exact-revision review |
| `longevity-metabolism-mitophagy-flux` | **initial** | — none — | generated from the accepted replacement and exact-revision review |
| `mechanistic-interpretability-activation-patching` | **initial** | — none — | generated from the accepted replacement and exact-revision review |
| `mechanistic-interpretability-representation-probing-boundary` | **superseding** | epirelease_93c92eb7a317465b83fabf8d3e6962da | generated from the accepted replacement and exact-revision review |

The manifest digest is generated from the reconciled cohort and is not copied
into this hand-authored runbook, preventing documentation drift.

## Why the initial release is declared, not inferred

Deriving `initial` from a lookup that returned nothing would make three different
situations indistinguishable: a record that genuinely has no prior release, a
registry that failed to load, and a typo in a record id. All three would produce
an initial release that supersedes nothing.

So each record carries an explicitly declared kind, and reconciliation checks the
declaration against observed registry state. A superseding record whose prior
release has vanished fails with `prior-release-disappeared`; it does not become
initial. An initial record that acquires a prior release fails with
`prior-release-appeared`; it does not become superseding. Both directions are
covered by tests.

## Fail-closed codes

- `prior-release-appeared`
- `prior-release-disappeared`
- `multiple-active-prior-releases`
- `prior-revision-digest-changed`
- `proposed-revision-digest-changed`
- `decision-targets-other-revision`
- `decision-coverage-incomplete`
- `release-kind-disagrees-with-registry`
- `canonical-path-mismatch`
- `record-not-observed`
- `held-decision-cannot-release`

## Preview rehearsal

There is exactly one runnable remote Batch 11 workflow:
`.github/workflows/preview-batch-11-remote-rehearsal.yml`, driven by
`scripts/run-batch-11-remote-rehearsal.ts`.

The earlier plan-only path — `preview-batch-11-lineage-rehearsal.yml` and
`run-batch-11-preview-lineage-rehearsal.ts` — has been removed. Its authorized
branch was never implemented, it declared two secret names that do not exist in
this repository, and it ran without a protected environment or a reviewed-commit
pin. Every capability it had is a subset of the authoritative path, including
its declaration-coverage check, which the surviving script now performs before
anything else. Its lineage tests were kept and rebound.

```bash
# Dry run. Gates the cohort, proves order independence, performs nothing.
node --experimental-strip-types scripts/run-batch-11-remote-rehearsal.ts
```

The remote phases run only under three simultaneous locks — an authorization
flag, an exact operation name, and an exact confirmation phrase — inside a
protected environment whose reviewers must approve first, from a checkout pinned
to a reviewed commit SHA. See
[`batch-11-remote-rehearsal.md`](batch-11-remote-rehearsal.md) for the phases
and the remaining operational prerequisite.

### Required protected secret names

- `SUPABASE_ACCESS_TOKEN` — Supabase Management API; creates and destroys the
  ephemeral branch. Currently bound only to `production-database`.
- `SUPABASE_PROJECT_REF` — must identify a non-Production parent project.
- `EPISTEMIC_OPERATIONS_TOKEN`
- `EPISTEMIC_RELEASE_AUTHORITY_TOKEN`
- `VERCEL_AUTOMATION_BYPASS_SECRET`
- `VERCEL_TOKEN` — deploys and destroys the exact-commit isolated Preview.

The branch's database password and one-hour service-role JWT are derived from
the newly created branch inside the protected runner. They are never repository
secrets, command arguments, artifacts or log output. Names only appear here; no
credential value appears in this repository, and tests assert that boundary.

### Migration scope

Six migrations, applied in exactly this order:

1. `20260824050000_epistemic_ingestion_and_expert_review.sql`
2. `20260824073000_epistemic_source_completion_queue.sql`
3. `20260824133000_epistemic_controlled_reingestion.sql`
4. `20260824190000_epistemic_canonical_release_control.sql`
5. `20260831120000_batch_11_mixed_lineage_rehearsal.sql`
6. `20260831123000_batch_11_mixed_lineage_rehearsal_execution.sql`

The first four are prerequisites, not extras. An earlier version of this runbook
described the two Batch 11 migrations as sufficient, on the assumption that a
Preview branch arrives carrying the epistemic tables. It does not. A schema-only
branch is genuinely empty, and the first protected rehearsal failed applying
migration 5 because `public.epistemic_ingestion_batches` did not exist.

The four are derived rather than chosen: the Batch 11 migrations alter or
reference exactly four relations they do not create, and these are the
migrations that create them and their transitive dependencies. A test re-derives
that closure from the SQL, so the list stays correct if a migration starts
referencing something new.

Order is part of the allowlist. Each entry depends on relations the earlier ones
create, so a reordered or duplicated sequence is refused before anything is
applied. Every `INSERT` in the four prerequisites sits inside a function body:
the bootstrap installs schema and RPCs and seeds no rows. No existing table is
altered outside this set, no row outside the five records is touched, and
Production is never a target — its only access is an unauthenticated HTTPS GET
of the public release registry.

### Cleanup

The exact-commit Vercel Preview and ephemeral branch are both destroyed in a
`finally` block, with an independent workflow backstop that runs `if: always()`.
Destroying the branch removes the entire isolated schema and its temporary
constraint changes. Cleanup touches no Production or persistent Preview object.

## What the rehearsal would prove

- All five records enter the release gate.
- The two superseding releases each bind their exact declared prior release id.
- Each of the three initial releases binds no superseded target and carries `supersedesReleaseId` null.
- The publication queue admits a record only after its exact-revision release exists.
- A stale revision digest is refused at the gate.
- An older revision cannot render revised material.
- An unreleased revision stays out of the queue, the sitemap and `llms.txt`.
- Five routes, provenance chains, sitemap entries, `llms.txt` entries and registry entries converge on the same five exact revisions.

## Production

Out of scope here. A Production release requires the rehearsal to pass first and
a separate, explicit authorization of the exact run. The cohort is not released,
not public, and not Production-ready.
