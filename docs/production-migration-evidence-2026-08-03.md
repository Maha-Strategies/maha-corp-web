# Production migration evidence — 2026-08-03

> **CORRECTION, 2026-08-10.** This run targeted the **staging** project, not
> Production. The `SUPABASE_PROJECT_REF` variable in the `production-database`
> environment held `wukyzcqxzkbwuledzxlx` (`maha-corp-staging.`) instead of the
> Production ref `uhwuullakihgszxhiygz`, so the migration history, pending list,
> drift report and convergence check recorded below all describe staging. The
> apply itself succeeded and the evidence is internally consistent — it simply
> describes a different database than its title claims. Production had no
> migration applied through this workflow before 2026-08-10. The variable is
> corrected and the workflow now asserts its target against a literal before
> doing any work.

This record indexes the first successful, reviewer-approved execution of the
Production database migration workflow. It contains identifiers and outcomes,
not a database dump or customer data.

## Authorization and execution

- Workflow: [Production database migrations #8](https://github.com/Maha-Strategies/maha-corp-web/actions/runs/30815131758)
- Run ID: `30815131758`
- Job ID: `91690892237`
- Environment: `production-database`
- Requested branch: `main`
- Reviewed commit: `64997c5fb16a8bca025b21b00b35ef5f85bae9e8`
- Reviewer: `mayonerajan`
- Completed: 2026-08-03
- Result: success

GitHub recorded the required environment approval before releasing the job.
The workflow also enforced the exact apply confirmation and retained the
authorized request metadata in its evidence artifact.

## Database outcome

The pre-apply drift check found a declared difference with a pending migration
available to reconcile it. The approved apply executed:

- `20260803000400_converge_discovery_meter_grant.sql`

`supabase db push` completed. The subsequent migration-history check completed,
and the post-apply `supabase db diff --linked --schema public` convergence step
succeeded. Therefore, the workflow's final state was that the live `public`
schema matched the committed migration tree.

The Supabase CLI emitted a non-fatal catalog-cache warning concerning its
temporary `pg-delta` certificate file. The push itself finished, and the
independent post-apply convergence check passed. Preserve this distinction when
reviewing the raw log; the warning was not treated as proof of success.

## Application outcome

After schema convergence, the workflow resolved the canonical Vercel Production
deployment and ran `scripts/verify-production-release.ts`. The post-migration
application-health step completed successfully, covering the same homepage,
OpenAPI, billing-readiness, and observability-readiness surfaces used by release
health and recovery automation.

## Evidence artifact

- Artifact: `production-migrations-30815131758`
- Artifact ID: `8856512586`
- Size reported by GitHub: 73.4 KB
- SHA-256: `e0ee74bd5ab286839909fc5a317052be47b3c0147f5854896ec4558b615906b6`
- Retention configured by the workflow: 90 days

The artifact contains the request record, integrity result, migration history,
pending/applied output, schema-only snapshot, drift evidence, resolved deployment
metadata, and post-apply health output. Download it from the workflow run before
GitHub's retention window expires and retain it in the protected operational
evidence store. Verify the downloaded artifact against the digest above.

## Rule for future runs

This successful baseline does not authorize unattended migration. Each future
change requires a new dry-run, evidence review, required-environment approval,
explicit apply confirmation, zero post-apply drift, and successful application
health. Add a new evidence index alongside this file for every Production apply.
