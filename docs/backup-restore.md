# Backup and restore rehearsal

Append-only ledgers protect against bad writes. They do not protect against
losing the database. Nothing has yet proven that a Supabase restore produces a
usable database, how long it takes, or how much would be lost — and an untested
backup is not a backup.

`scripts/verify-restore-rehearsal.ts` verifies a restore you have already
performed and measures the two numbers that matter. **It never triggers a
restore and never writes.** Running it is not the same as closing this gap; only
an actual restore does that.

## Before the first rehearsal

Confirm in the Supabase dashboard, and record here once known:

- Whether point-in-time recovery is enabled on the Production project, and the
  retention window.
- The daily backup schedule and its retention.
- Whether the plan permits restoring into a *separate* project. The rehearsal
  requires it; restoring over Production is not a rehearsal.

Also confirm Upstash persistence separately. Redis holds live credit balances
and rate-limit state, and a Supabase restore does not cover it.

## The two numbers

**RTO** — how long you took to obtain a usable database, measured from when you
initiated the restore to when it could serve queries. Measured, not estimated.

**RPO** — how far back the recovery point sits from the moment of verification.
Everything written after it would have been lost.

Per-table staleness is deliberately not treated as RPO. A ledger that last
received a row three weeks ago is quiet, not lossy — the script only reports
loss when a live comparison shows rows that the restore does not have.

## Procedure

1. Note the UTC time and choose a recovery point. Restoring to *now* is the
   realistic drill; restoring to an hour ago exercises the PITR path harder.
2. In the Supabase dashboard, restore into a **new scratch project**. Record the
   exact start time.
3. When the scratch project can serve queries, record the completion time.
4. Run the verification, pointing it at the scratch project:

```bash
RESTORE_SUPABASE_URL=https://<scratch-ref>.supabase.co \
RESTORE_SUPABASE_SERVICE_ROLE_KEY=<scratch service role key> \
RESTORE_RECOVERY_POINT=2026-08-02T09:00:00Z \
RESTORE_STARTED_AT=2026-08-02T09:05:00Z \
RESTORE_COMPLETED_AT=2026-08-02T09:26:00Z \
RESTORE_OUTPUT_PATH=./restore-rehearsal.json \
node --experimental-strip-types scripts/verify-restore-rehearsal.ts
```

5. File `restore-rehearsal.json` as evidence, with the date and who ran it.
6. **Delete the scratch project.** It holds a full copy of customer and
   commercial data and is a standing liability while it exists.

## Detecting loss

Counts alone cannot show loss without something to compare against. Add
`RESTORE_COMPARE_LIVE=true` to also read the live project, using the existing
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It then flags a
ledger that is empty after the restore while the live database holds rows, or
that somehow holds more rows than the source.

This is off by default: reading the live database should be a deliberate choice,
not a side effect. Only counts and newest timestamps are read in either case —
never row contents.

## What fails a rehearsal

| Finding | Meaning |
| --- | --- |
| `ledger_unreadable` | The restore cannot serve a ledger holding commercial history. A `PGRST205` here means the table is missing or the schema cache is stale. |
| `ledger_not_observed` | A critical ledger was never queried. |
| `record_after_recovery_point` | The restore contains a record newer than the point requested. The restore did not honour the point, or clocks disagree. |
| `ledger_empty_after_restore` | Empty where the live database holds rows. Loss. |
| `restored_exceeds_source` | More rows than the source. The comparison is not measuring what it should be. |
| `rto_exceeded` / `rpo_exceeded` | Only when targets are supplied. |

Targets are unset by default, so a first rehearsal reports numbers rather than
grading them. Set `RESTORE_MAX_RTO_SECONDS` and `RESTORE_MAX_RPO_SECONDS` once
you have measured what is actually achievable and decided what is acceptable.
Pick them from the business consequence of losing that much time and data, not
from the first measurement.

## Safety

The script refuses to run when `RESTORE_SUPABASE_URL` resolves to the same host
as `NEXT_PUBLIC_SUPABASE_URL`. Pointing it at the live project would read
Production under the guise of a rehearsal and report a pass that proves nothing.

`RECOVERY_CRITICAL_LEDGERS` in `lib/restore-rehearsal.ts` lists the fifteen
ledgers that cannot be reconstructed from anywhere else — API and MPS credit
ledgers, book entitlements and reversals, revenue reconciliation, Stripe webhook
event records, operator actions, and issued credentials. A test asserts every
table and column there exists in the migration tree. Extend it when a new ledger
holds commercial history.

## Cadence

Quarterly, and after any change to the migration tree large enough to alter the
recovery surface. Record each run's RTO and RPO so the trend is visible; a
restore that has quietly grown from twenty minutes to two hours is worth knowing
about before an incident rather than during one.
