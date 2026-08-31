# Batch 11 mixed-lineage release runbook

Five records, two lineages. Four supersede an existing canonical release; one has
none and must be released as initial. The batch was frozen on the assumption that
all five supersede, and that assumption was wrong.

**Nothing in this document has been executed.** No release was performed, no
Preview database was created, no migration was applied, and no credential was
presented.

## Verified classification

| Record | Kind | Prior release | Proposed revision |
|---|---|---|---|
| `agentic-systems-mcp-tool-allowlisting` | **initial** | — none — | `sha256:655c3ae116314eb3d2f…` |
| `biomolecular-engineering-structure-prediction-filtering` | **superseding** | epirelease_9bf9b14ec8fb48f884efdc43e44ea349 | `sha256:4f41045346753387198…` |
| `critical-supply-chains-high-purity-quartz-deposits` | **superseding** | epirelease_d9b0cd28c1614fa58192be24afcd2a7a | `sha256:bf577646700efe497e3…` |
| `fusion-plasma-systems-tokamak-plasma-equilibrium` | **superseding** | epirelease_8e947374097d4695815dbf9ab653177b | `sha256:b06ae30e9f4b9907e6a…` |
| `mechanistic-interpretability-representation-probing-boundary` | **superseding** | epirelease_93c92eb7a317465b83fabf8d3e6962da | `sha256:c87bdda2c7cf974f864…` |

Manifest digest: `sha256:2765fd7430f37a5de403a0bc8b8aa009d17f1488f6a711fcf7175e56fd3d6a4a`

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

### Required secret names

Every name is an existing repository secret. No credential is minted for this
rehearsal.

- `SUPABASE_ACCESS_TOKEN` — Supabase Management API; creates and destroys the
  ephemeral branch. Currently bound only to `production-database`.
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `EPISTEMIC_OPERATIONS_TOKEN`
- `EPISTEMIC_RELEASE_AUTHORITY_TOKEN`
- `VERCEL_AUTOMATION_BYPASS_SECRET`

Names only. No value appears in this repository, and a test asserts that.

### Migration scope

One additive migration,
`supabase/migrations/20260831120000_batch_11_mixed_lineage_rehearsal.sql`,
creating only the Batch 11 rehearsal tables and admitting one dedicated adapter.
No existing table is altered. No row outside the five records is touched.
Production is never a target of the rehearsal script — its only Production
access is an unauthenticated HTTPS GET of the public release registry.

### Cleanup

The ephemeral branch is destroyed in a `finally` block, and again by a workflow
step that runs `if: always()`. Because the migration is additive and scoped to
new tables, cleanup touches no pre-existing object.

## What the rehearsal would prove

- All five records enter the release gate.
- The four superseding releases each bind their exact declared prior release id.
- The initial release binds no superseded target and carries `supersedesReleaseId` null.
- The publication queue admits a record only after its exact-revision release exists.
- A stale revision digest is refused at the gate.
- An older revision cannot render revised material.
- An unreleased revision stays out of the queue, the sitemap and `llms.txt`.
- Five routes, provenance chains, sitemap entries, `llms.txt` entries and registry entries converge on the same five exact revisions.

## Production

Out of scope here. A Production release requires the rehearsal to pass first and
a separate, explicit authorization of the exact run. The cohort is not released,
not public, and not Production-ready.
