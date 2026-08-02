# Production release health and recovery

Maha uses three GitHub Actions workflows to separate monitoring, recovery validation, and production mutation.

## Release health

`production-release-health.yml` runs at minutes 7, 22, 37, and 52 of every hour and can also be dispatched manually. It verifies the canonical homepage, OpenAPI document, billing readiness, and observability readiness. Every request is read-only, uses a ten-second timeout, and records only status, bounded diagnostic codes, and latency.

A successful run stores `production-last-known-good`, a fourteen-day artifact containing the exact ready Vercel deployment ID and the four successful checks. Failed runs upload diagnostic evidence but never replace the last-known-good artifact.

## Recovery drill

`production-recovery-drill.yml` runs every Monday at 06:19 UTC. It downloads the most recent successful last-known-good manifest, validates its age and project binding, asks Vercel to confirm the deployment remains `READY`, and executes all four health checks against the immutable deployment URL. It does not change Production aliases.

## Rollback

`production-rollback.yml` is manual and uses the reviewer-protected `production-canary` environment. The operator must type `ROLLBACK PRODUCTION` exactly and provide a reason of at least twelve characters. The workflow then:

1. Downloads the newest successful last-known-good manifest.
2. Validates the deployment ID, URL, project, target, state, and recovery age.
3. Saves the current deployment metadata for recovery evidence.
4. Runs `vercel rollback` against the verified deployment ID.
5. Confirms the canonical alias resolves to a ready deployment.
6. Requires HTTP 200 from billing and observability readiness.
7. Runs the full MCP discovery, gateway, circuit-breaker, rate-limit, CSV, and PDF canary.

The requesting actor, timestamp, reason, workflow run, pre-rollback deployment, post-rollback deployment, and verification report are retained as protected workflow evidence for ninety days.

The workflow deliberately does not automatically roll forward after a failed post-rollback test. Restoring the known-bad deployment would compound the incident; the rolled-back state remains in place for operator diagnosis.

## Required GitHub environments

`production-monitoring` is restricted to `main` and has no reviewer gate because scheduled jobs must run unattended. It contains:

- Secret `PRODUCTION_RELEASE_HEALTH_TOKEN` (read-only; must match Vercel `RELEASE_HEALTH_TOKEN`)
- Secret `MAHA_OPS_WEBHOOK_SECRET` (signs bounded failure and recovery notifications)
- Secret `VERCEL_AUTOMATION_BYPASS_SECRET` (required only for protected immutable deployment URLs)
- Secret `VERCEL_TOKEN`
- Variable `PRODUCTION_BASE_URL=https://www.mahastrategies.com`
- Variable `VERCEL_TEAM_ID=team_KTJouKHTcPGeMXNMDqh6CoYs`
- Variable `VERCEL_PROJECT_ID=prj_afSBk4GaUchbuPuHF3ctZSS42iRU`

The reviewer-protected `production-canary` environment additionally needs the same two secrets and Vercel variables. Existing canary API and Modal upstream credentials remain unchanged. The unattended workflows never receive `REVENUE_CONTROL_TOKEN`.

Use a Vercel access token scoped to the Maha team. Rotate it immediately if it is exposed. Neither workflow prints bearer tokens or Vercel credentials.

Release-health and recovery-drill failures are retried with an event ID anchored to the latest prior successful run, so repeated failed runs do not create duplicate email. A recovery notification is sent only when the immediately preceding completed run failed. Notifications contain workflow/run metadata and bounded stage outcomes; application and dependency response bodies are excluded.
