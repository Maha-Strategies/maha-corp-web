# Supabase projects

The canonical mapping of project ref to role. **Refs are the identity; names are
a convenience and have been wrong.** Anything automated should assert against a
ref from this table, never against a project name and never against an
unverified variable.

| Ref | Name should be | Role | Contains |
|---|---|---|---|
| `uhwuullakihgszxhiygz` | `maha-production-shared` | **Production** | maha OS *and* AI infrastructure, sharing one database |
| `wukyzcqxzkbwuledzxlx` | `maha-ai-staging` | **Staging** | AI infrastructure only, built purely from `supabase/migrations` |
| `cupmukvslgflahdymzde` | `agentic-publisher` | unrelated | not part of this repository |

`maha-production-shared` is named for what it is rather than what it should be.
Once the AI infrastructure moves to its own project it becomes
`maha-os-production`, and the new one is `maha-ai-production`. Naming it that
way today would describe an intention rather than a fact, which is the class of
mistake this file exists to prevent.

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

## Separation

The AI infrastructure and maha OS share `uhwuullakihgszxhiygz` today. The
dividing line is exact and needs no judgement: a table is AI infrastructure if
and only if `supabase/migrations` declares it.

- 90 tables declared by the tree — the AI infrastructure
- 15 tables in Production that the tree does not declare — maha OS and legacy:
  `fireteams`, `fireteam_messages`, `fireteam_waitlist`, `vanguard_links`,
  `ios_vanguard_waitlist`, `gateway_sessions`, `knowledge_network_gsc_*`,
  `nodes`, `ledgers`, `nodal_feedback_ledger`, `profiles`, `scan_ledger`,
  `ugc_reports`, `maha_dispatch_subscribers`

There is no Supabase Auth coupling: no migration references `auth.users`, the
application uses no auth client, and `profiles` is referenced by no code. The
AI infrastructure reaches `public` with a service-role key and nothing else,
which is why a separation moves tables and not identities.
