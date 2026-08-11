# Supabase projects

The canonical mapping of project ref to role. **Refs are the identity; names are
a convenience and have been wrong.** Anything automated should assert against a
ref from this table, never against a project name and never against an
unverified variable.

| Ref | Name should be | Role | Contains |
|---|---|---|---|
| `uhwuullakihgszxhiygz` | `maha-production-shared` | **Production** | maha OS *and* AI infrastructure, sharing one database |
| `wukyzcqxzkbwuledzxlx` | `maha-ai-staging` | **Staging** | isolated non-Production data with the reproducible unified platform schema |
| `cupmukvslgflahdymzde` | `agentic-publisher` | unrelated | not part of this repository |

`maha-production-shared` is the intentional Maha platform boundary. Maha OS and
the infrastructure products share schema governance while retaining separate
table permissions, ledgers, application credentials and environment data.

## What went wrong, so it is not repeated

On 2026-08-03 the `SUPABASE_PROJECT_REF` variable in the `production-database`
environment was set to `wukyzcqxzkbwuledzxlx` — staging. Every run of the
workflow named *Production database migrations* between then and 2026-08-10
therefore linked to staging, applied migrations there, and reported staging's
history, pending list, drift and convergence as Production's. Nothing failed.
`supabase link` succeeds against any project the access token can reach, and
every check afterwards asks the database it was handed.

Two things made it invisible for a week:

- **The production project is called `mayonerajan's Project`.** Nothing in that
  name says production, so nobody re-read the ref.
- **The database password was set two minutes before the ref**, so the pair
  agreed with each other about the wrong database. The first honest attempt at
  Production failed instantly on the password, which is how the pairing was
  found.

A correct name would have made this easier to notice. It would not have
prevented it. The assertion below is what prevents it.

## The rule

Every automated path that can write to a database asserts its target ref
against a literal in a reviewed file before doing any work:

- `.github/workflows/production-migrations.yml` asserts
  `SUPABASE_PROJECT_REF == uhwuullakihgszxhiygz` as its first step, before
  checkout.
- `test/supabase-project-targets.test.ts` asserts that literal still matches
  this document, so the two cannot drift apart silently.

A variable checked against another variable proves nothing. The literal is
version-controlled and changing it requires review; the variable is only what
`supabase link` consumes.

## Unified schema baseline

The schema tree now declares both product families. Migration `20260809000250`
captures the pre-existing Maha OS tables, functions, policies and event trigger
without customer data. Production records that baseline version as applied
because those objects already exist; clean and staging databases execute it.

Migration `20260809000251` is deliberately separate and executes everywhere.
It removes an obsolete billing function, restores the stricter content-source
gate, restricts session and refresh-token tables, and makes the destructive
Maha OS user-purge function callable only by `service_role`. Maha OS retains
its required `auth.users` relationships; infrastructure tables remain isolated
by their own grants and service credentials.
