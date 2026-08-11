# Maha platform database boundary

Maha OS and Maha's agent-infrastructure products use one governed Production
Supabase project. This is an intentional platform boundary, not a temporary
cross-product dependency.

The Production project currently has the Supabase reference
`uhwuullakihgszxhiygz` and the dashboard name `maha-production-shared`. The
dashboard name is historical; it does not authorize Preview, staging, or an
unrelated application to use the project.

## What may share the project

- Maha OS application state.
- Maha API commercial ledgers and durable jobs.
- Agent discovery, Navigator, compatibility and x402 telemetry.
- Append-only evidence needed to operate those products as one platform.

Sharing the project does not mean sharing credentials or bypassing table-level
controls. Every migration must keep least-privilege grants, row-level security
where applicable, append-only history, and content-minimizing retention.

## What remains isolated

- Preview uses `maha-corp-staging` (`wukyzcqxzkbwuledzxlx`) and must have
  different Supabase credentials.
- `agentic-publisher` (`cupmukvslgflahdymzde`) remains a separate application.
- Upstash, Stripe, worker and signing credentials remain environment-scoped.
- GitHub's `production-database` environment remains reviewer-protected.

## Migration rule

Production schema changes run only through
`.github/workflows/production-migrations.yml`. A reviewed dry-run must identify
the exact pending versions and record drift before an apply is approved. The
workflow pins the Production project reference in reviewed source so a staging
or unrelated project cannot silently accept a Production migration.

An offer is not promoted because its tables exist. Promotion additionally
requires readiness, durable recovery where applicable, and a bounded paid
end-to-end settlement against the deployed contract.

The pre-existing Maha OS schema is represented by the reproducible
`20260809000250` baseline. Production records that version as already applied;
`20260809000251` performs the actual least-privilege reconciliation, including
restricting the user-deletion function and token/session tables to
`service_role`. This makes a clean database reproducible without executing
duplicate `CREATE` statements against live Maha OS data.
