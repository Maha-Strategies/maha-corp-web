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

One dedicated ephemeral-branch migration,
`supabase/migrations/20260831120000_batch_11_mixed_lineage_rehearsal.sql`,
creates the Batch 11 witness and observation tables, admits one exact five-record
adapter, installs dedicated ingestion and release RPCs, and relaxes the local
supersession foreign key so a new Preview release can name an external public
predecessor witness. Those changes are intentionally allowed only inside the
disposable schema-only branch; Production never receives this migration. No
row outside the five targets and two predecessor witnesses is written.
Production is never a target of the rehearsal script — its only Production
access is an unauthenticated HTTPS GET of the public release registry.

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
