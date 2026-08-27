# Production database migrations

Maha OS and Maha's infrastructure products intentionally use one governed
Production project. The ownership and isolation rules are recorded in
[maha-platform-database-boundary.md](./maha-platform-database-boundary.md).

Schema changes reach Production through `production-migrations.yml`, not through
the Supabase SQL editor. Applying by hand is how the migration history came to
need manual repair once already, and it is the highest-consequence failure mode
in this system: the ledgers hold commercial history that cannot be reconstructed.

> **Production workflow verified.** Reviewer-approved run
> [#8](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/30815131758)
> completed successfully on 2026-08-03. It applied the pending convergence
> migration, proved the resulting schema matched the migration tree, and passed
> post-apply application health. The durable evidence index is recorded in
> [production-migration-evidence-2026-08-03.md](./production-migration-evidence-2026-08-03.md).
> Every future migration must still begin with a fresh `dry-run` whose evidence
> is reviewed before `apply` is approved.

## Two gates, one before review and one before apply

`scripts/check-migrations.ts` runs on every pull request and again inside the
migration workflow. It enforces four properties:

- Filenames are `<14-digit UTC timestamp>_<lower_snake_case>.sql`. Bare dates
  collide in the Supabase CLI's `schema_migrations` version column.
- Timestamps are unique and are real UTC instants.
- Already-committed migrations are never edited, renamed, or deleted. A file
  that may already have run cannot be changed retroactively; add a new forward
  migration instead.
- A new migration sorts after every migration already on the base branch.
  Otherwise environments past that point would never apply it.
- Destructive DDL (`drop table`, `drop column`, `drop schema`, `truncate`)
  requires an explicit `-- migration-allow-destructive: <reason>` comment, so
  discarding recorded history is always a stated decision.

Run it locally before pushing:

```bash
node --experimental-strip-types scripts/check-migrations.ts
```

It reads the working tree, not just committed state, so an uncommitted edit to
an old migration fails immediately.

## Dispatching the workflow

Inputs are `mode` (`dry-run`, one-time `baseline`, or `apply`), a `reason` of at
least twelve characters, `confirmation`, and `check_schema_drift`, which
defaults on. `baseline` requires `RECORD PRODUCTION BASELINE`; `apply` requires
`APPLY PRODUCTION MIGRATIONS`.

A `dry-run` links the project, records the migration history, captures a
schema-only snapshot, checks for drift, and reports what `db push` would apply.
It changes nothing. Read `migration-list-before.txt` and `pending.txt` in the
uploaded evidence and confirm the pending set is exactly what you expect.

`baseline` is a narrowly bounded history repair for
`20260809000250_maha_os_unified_schema_baseline.sql`. The Maha OS objects in
that file existed in Production before this migration tree governed the unified
database, so the workflow records that exact version as applied without
executing its SQL. It then reports the remaining pending migrations and drift.
Do not reuse this mode for ordinary schema changes.

An `apply` repeats all of that, pushes, records the resulting history, and then
runs the same readiness verification the release-health and rollback workflows
use — homepage, OpenAPI document, billing readiness, and observability readiness
— against the canonical deployment. A schema change is not finished until the
running application still works against it.

## Drift, and how it is gated

`supabase db diff --linked` compares the live schema against the migration tree.
Output means the live schema and the fully migrated tree differ. A pending
migration can explain that difference; without one, the likely cause is a direct
edit in the SQL editor.

The check runs twice, because the obvious design deadlocks. Failing before
applying whenever live and the tree disagree means a migration *written to
reconcile drift* can never run: the drift it exists to remove is still present
when the gate fires. The first real dry-run hit exactly that.

**Before applying**, the schema delta is recorded to `drift-before.sql`. When
pending migrations explain that delta, the workflow labels it
`expected-pending-delta` without emitting a warning. It warns and fails only
when a delta exists and **no migration is pending** to account for it — which is
the case the gate was built for: Production changed outside this workflow, with
nothing on its way to explain it.

**After applying**, `drift-after.sql` must be empty. This is the stronger
property: rather than refusing to act on a disagreement, it requires the end
state to agree. Anything remaining is a real difference the applied migrations
did not reconcile, and the run fails with both files retained for comparison.
Every run publishes a GitHub step summary that distinguishes the pre-apply
classification, residual post-apply drift, and convergence state.

Reconcile drift by writing a migration that expresses what is already true, or
that removes what should not be there. Do not disable `check_schema_drift` to
get past a finding; the flag exists because the check needs a Docker shadow
database on the runner and may be unavailable, not because the finding is
optional.

## There is no automatic revert

If verification fails after a push, the schema stays as applied. This matches the
deployment rollback workflow's stance: automatically reverting would compound the
incident, and a down-migration against an append-only ledger can destroy recorded
commercial outcomes. The workflow emits an explicit error saying the schema was
not reverted, and preserves `schema-before.sql` for diagnosis.

Recovery is an operator decision: write a forward migration that corrects the
state. Restoring the database wholesale is a last resort and depends on the
Supabase project's backup and point-in-time-recovery settings, which are
configured in the Supabase dashboard and are **not** covered by this workflow.

## Evidence

Every run uploads a ninety-day artifact containing the authorized request
(actor, mode, reason, commit, run ID), the integrity-check output, the migration
history before and after, the pending and applied sets, the drift diff, the
pre-apply schema snapshot, and the post-apply health report.

The schema snapshot is `--schema public` and schema-only. Never add `--data-only`
or a full dump: that would place customer records and commercial history into a
workflow artifact.

The first successful Production apply is indexed in
[`production-migration-evidence-2026-08-03.md`](./production-migration-evidence-2026-08-03.md).
For every later apply, add a comparable evidence record containing the run URL,
reviewed commit, applied migration versions, final convergence result, health
result, artifact name, and artifact SHA-256 digest. The record must not copy a
schema dump or any customer data into Git.

## GitHub environment

The reviewer-protected environment `production-database` is configured and was
exercised successfully by run #8. Keep a required reviewer; unlike the
monitoring workflows, nothing here runs unattended.

- Secret `SUPABASE_ACCESS_TOKEN` — a Supabase personal access token. Rotate it
  immediately if exposed.
- Secret `SUPABASE_DB_PASSWORD` — the Production database password, read by the
  CLI from the environment and never passed on a command line.
- Secret `PRODUCTION_RELEASE_HEALTH_TOKEN` — read-only; must match Vercel's
  `RELEASE_HEALTH_TOKEN`, same value the monitoring environments use.
- Secret `VERCEL_TOKEN` and secret `VERCEL_AUTOMATION_BYPASS_SECRET`.
- Variable `SUPABASE_PROJECT_REF` — the Production project reference.
- Variable `PRODUCTION_BASE_URL=https://www.mahastrategies.com`
- Variable `VERCEL_TEAM_ID=team_KTJouKHTcPGeMXNMDqh6CoYs`
- Variable `VERCEL_PROJECT_ID=prj_afSBk4GaUchbuPuHF3ctZSS42iRU`

The workflow never receives `REVENUE_CONTROL_TOKEN`, `MPS_OPERATIONS_TOKEN`, or
any other mutating application token, and it prints no credential.

The Supabase CLI is pinned to 2.116.0 — the version verified against this
migration tree. Bump it deliberately, and re-run a `dry-run` after any bump.

## Concurrency

This workflow holds the `production-database` lock, deliberately separate from
the `production-recovery` lock used by rollback and rehearsal. An emergency
deployment rollback must never queue behind a database job. Note the corollary:
a rollback does not revert schema, so a deployment rolled back across a migration
boundary runs older code against a newer schema. Prefer migrations that are
backward compatible with the previous release for exactly this reason.
