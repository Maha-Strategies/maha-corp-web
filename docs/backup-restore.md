# Backup and restore

Append-only ledgers protect against bad writes. They do not protect against
losing the database. This records what recovery actually exists, what it costs,
and when proving it becomes worth doing.

## What Supabase provides today

Verified in the dashboard on 3 August 2026, under **Database → Backups**:

- **Scheduled backups**, daily at roughly 09:57 UTC, three retained. Physical
  backups, restorable at any time.
- **Point in time** — a paid add-on. Check whether it is active; if it is, the
  recovery window is minutes rather than a day.
- **Restore to new project** (beta) — a side-by-side restore that leaves
  Production untouched. This is what a rehearsal uses.

Two limits matter more than the mechanism:

**Recovery point is up to 24 hours.** With scheduled backups alone, everything
written since the last one is lost. That is the number to state when anyone
asks what a database failure would cost.

**Storage objects are not backed up.** Supabase backs up the database, not
objects written through the Storage API. Receipt uploads live in a Storage
bucket, and `utility_upload_objects` rows reference them, so a database restore
returns rows pointing at files that no longer exist. Nothing in this repository
covers that gap; treat uploaded objects as unrecoverable unless copied
elsewhere.

## The free half: take dumps

This costs nothing, needs no add-on, and covers the realistic disaster — losing
the project, or a bad operation against it:

```bash
supabase db dump --linked -f prod-backup-$(date -u +%Y%m%d).sql
```

```bash
supabase db dump --linked --data-only -f prod-data-$(date -u +%Y%m%d).sql
```

Keep them somewhere that is not Supabase. The schema comes from the migration
tree, so the data-only dump is the part that cannot be regenerated. Both files
contain customer records; store them accordingly and do not commit them.

Time the dump while you are there. That is a real measurement of the extraction
half of recovery.

## The paid half: when a restore rehearsal is worth doing

`Restore to new project` provisions a project at the current compute size:
about **$10.18 per month, recurring** — not a one-off. It is worth that when
the database holds something that cannot be reconstructed.

As of 3 August 2026 it does not. Every commercial ledger is empty: zero
checkouts, zero Stripe events, zero ledger entries, zero reversals, and zero
paid API requests in ninety days. A rehearsal now would prove that Supabase can
restore an empty database, which is the least informative version of the test.

**The trigger is the first real transaction.** When a row appears in
`api_credit_ledger_entries` or `mps_credit_ledger_entries`, the database starts
holding money that cannot be reconstructed, and the rehearsal becomes clearly
worth ten dollars. `/api/admin/revenue-readiness` and the billing readiness
endpoint both report those tables, so the signal is already visible.

## Running the rehearsal, when that day comes

1. Note the timestamp of the backup you are restoring — that is the recovery
   point, not "now".
2. **Database → Backups → Restore to new project**, select that backup, record
   the minute you start.
3. Record when the new project can serve queries. Start to usable is the RTO.
4. Verify it. No schema setup is needed; the restore is a full copy:

```bash
RESTORE_SUPABASE_URL=https://<new-ref>.supabase.co RESTORE_SUPABASE_SERVICE_ROLE_KEY=<new service role key> RESTORE_RECOVERY_POINT=<backup timestamp> RESTORE_STARTED_AT=<step 2> RESTORE_COMPLETED_AT=<step 3> RESTORE_OUTPUT_PATH=./restore-rehearsal.json node --experimental-strip-types scripts/verify-restore-rehearsal.ts
```

5. **Delete the new project.** It is a full copy of customer and commercial
   data, and it bills monthly until removed.
6. File `restore-rehearsal.json` as evidence, and set
   `RESTORE_MAX_RTO_SECONDS` and `RESTORE_MAX_RPO_SECONDS` from what was
   measured, so later rehearsals grade themselves.

## What fails a rehearsal

| Finding | Meaning |
| --- | --- |
| `ledger_unreadable` | The restore cannot serve a ledger holding commercial history. `PGRST205` means the table is missing or the schema cache is stale. |
| `ledger_not_observed` | A critical ledger was never queried. |
| `record_after_recovery_point` | The restore contains a record newer than the point requested. The restore did not honour the point, or clocks disagree. |
| `ledger_empty_after_restore` | Empty where the live database holds rows. Loss. |
| `restored_exceeds_source` | More rows than the source. The comparison is not measuring what it should be. |
| `rto_exceeded` / `rpo_exceeded` | Only when targets are supplied. |

`RESTORE_COMPARE_LIVE=true` additionally reads the live project to detect loss,
using the existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
It is off by default: reading Production should be a deliberate choice. Only
counts and newest timestamps are read in either case, never row contents.

## Safety

The verification script refuses to run when `RESTORE_SUPABASE_URL` resolves to
the same host as `NEXT_PUBLIC_SUPABASE_URL`. Pointing it at the live project
would read Production under the guise of a rehearsal and report a pass that
proves nothing.

`RECOVERY_CRITICAL_LEDGERS` in `lib/restore-rehearsal.ts` lists the fifteen
ledgers that cannot be reconstructed from anywhere else. A test asserts every
table and column there exists in the migration tree. Extend it when a new ledger
holds commercial history.

## Cadence

Dumps: often enough that losing the interval would not hurt. Weekly is a
reasonable floor while the ledgers are empty; daily once they are not.

Rehearsal: once the trigger above is met, then annually, and after any change
large enough to alter the recovery surface. Record each run's RTO and RPO so
the trend is visible — a restore that has quietly grown from twenty minutes to
two hours is worth knowing about before an incident rather than during one.
