// Append-only ledgers protect against bad writes. They do not protect against
// losing the database. Nothing in this repository has ever proven that a
// Supabase restore produces a usable database, or measured how long it takes
// and how much would be lost.
//
// This evaluates a restore an operator has already performed into a scratch
// project. It never triggers a restore and never writes.
//
// Two numbers are reported, defined narrowly so they mean something:
//
//   RTO — how long the operator took to obtain a usable database. Measured,
//         not estimated.
//   RPO — how far back the recovery point sits from the moment of
//         verification: everything written after it would have been lost.
//
// Per-table staleness is deliberately NOT treated as RPO. A ledger that last
// received a row three weeks ago is quiet, not lossy.

export type LedgerDefinition = { table: string; timestampColumn: string }

/**
 * The ledgers holding commercial history that cannot be reconstructed from
 * anywhere else. A restore that cannot serve these is not a usable restore.
 * A test asserts every table and column here exists in the migration tree.
 */
export const RECOVERY_CRITICAL_LEDGERS: readonly LedgerDefinition[] = [
  { table: 'api_credit_checkouts', timestampColumn: 'created_at' },
  { table: 'api_credit_ledger_entries', timestampColumn: 'created_at' },
  { table: 'api_credit_payment_reversals', timestampColumn: 'created_at' },
  { table: 'api_credit_stripe_events', timestampColumn: 'processed_at' },
  { table: 'mps_credit_checkouts', timestampColumn: 'created_at' },
  { table: 'mps_credit_ledger_entries', timestampColumn: 'created_at' },
  { table: 'mps_operator_actions', timestampColumn: 'created_at' },
  { table: 'book_checkouts', timestampColumn: 'created_at' },
  { table: 'book_entitlements', timestampColumn: 'granted_at' },
  { table: 'book_payment_reversals', timestampColumn: 'created_at' },
  { table: 'revenue_opportunity_events', timestampColumn: 'created_at' },
  { table: 'revenue_payment_reconciliations', timestampColumn: 'paid_at' },
  { table: 'revenue_stripe_webhook_events', timestampColumn: 'processed_at' },
  { table: 'stripe_webhook_events', timestampColumn: 'processed_at' },
  { table: 'agent_client_credentials', timestampColumn: 'issued_at' },
]

export type LedgerObservation = {
  table: string
  /** null when the table could not be read at all. */
  rows: number | null
  latestAt: string | null
  error?: string
}

export type RehearsalFinding = { code: string; table?: string; message: string }

export type RestoreRehearsalReport = {
  schema: 'maha.restore-rehearsal.v1'
  generatedAt: string
  recoveryPoint: string
  rtoSeconds: number
  rpoSeconds: number
  targets: { maxRtoSeconds?: number; maxRpoSeconds?: number }
  ledgers: (LedgerObservation & { comparedRows?: number | null })[]
  findings: RehearsalFinding[]
  ok: boolean
}

export type RestoreRehearsalInput = {
  recoveryPoint: string
  restoreStartedAt: string
  restoreCompletedAt: string
  verifiedAt?: string
  restored: readonly LedgerObservation[]
  /** Optional read-only snapshot of the live database, for loss detection. */
  source?: readonly LedgerObservation[]
  expected?: readonly LedgerDefinition[]
  maxRtoSeconds?: number
  maxRpoSeconds?: number
}

function instant(value: string, label: string): number {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) throw new Error(`${label} must be an ISO 8601 timestamp.`)
  return parsed
}

const seconds = (ms: number) => Math.round(ms / 1000)

export function evaluateRestoreRehearsal(input: RestoreRehearsalInput): RestoreRehearsalReport {
  const expected = input.expected ?? RECOVERY_CRITICAL_LEDGERS
  const recoveryPoint = instant(input.recoveryPoint, 'recoveryPoint')
  const startedAt = instant(input.restoreStartedAt, 'restoreStartedAt')
  const completedAt = instant(input.restoreCompletedAt, 'restoreCompletedAt')
  const verifiedAt = input.verifiedAt ? instant(input.verifiedAt, 'verifiedAt') : Date.now()

  if (completedAt < startedAt) throw new Error('restoreCompletedAt precedes restoreStartedAt.')
  if (recoveryPoint > completedAt) throw new Error('recoveryPoint is after the restore completed.')

  const findings: RehearsalFinding[] = []
  const byTable = new Map(input.restored.map((observation) => [observation.table, observation]))
  const sourceByTable = new Map((input.source ?? []).map((observation) => [observation.table, observation]))

  const ledgers = expected.map((definition) => {
    const observed = byTable.get(definition.table)
    const compared = sourceByTable.get(definition.table)

    if (!observed) {
      findings.push({ code: 'ledger_not_observed', table: definition.table, message: 'The restored database was not queried for this ledger.' })
      return { table: definition.table, rows: null, latestAt: null, comparedRows: compared?.rows ?? undefined }
    }
    if (observed.rows === null) {
      findings.push({ code: 'ledger_unreadable', table: definition.table, message: `The restored database could not serve this ledger: ${observed.error ?? 'unknown error'}.` })
    }
    // A record written after the point restored to means the restore did not
    // honour that point, or the clocks disagree. Either invalidates the run.
    if (observed.latestAt && Date.parse(observed.latestAt) > recoveryPoint) {
      findings.push({ code: 'record_after_recovery_point', table: definition.table, message: `Contains a record dated ${observed.latestAt}, after the recovery point.` })
    }
    // Loss detection needs the live comparison; a restore is expected to hold
    // no more than the source, and never nothing where the source has history.
    if (compared && typeof compared.rows === 'number' && typeof observed.rows === 'number') {
      if (observed.rows > compared.rows) {
        findings.push({ code: 'restored_exceeds_source', table: definition.table, message: `Restored ${observed.rows} rows against ${compared.rows} live rows.` })
      }
      if (observed.rows === 0 && compared.rows > 0) {
        findings.push({ code: 'ledger_empty_after_restore', table: definition.table, message: `Empty after restore while the live database holds ${compared.rows} rows.` })
      }
    }
    return { ...observed, comparedRows: compared?.rows ?? undefined }
  })

  const rtoSeconds = seconds(completedAt - startedAt)
  const rpoSeconds = seconds(verifiedAt - recoveryPoint)

  if (input.maxRtoSeconds !== undefined && rtoSeconds > input.maxRtoSeconds) {
    findings.push({ code: 'rto_exceeded', message: `Restore took ${rtoSeconds}s against a ${input.maxRtoSeconds}s target.` })
  }
  if (input.maxRpoSeconds !== undefined && rpoSeconds > input.maxRpoSeconds) {
    findings.push({ code: 'rpo_exceeded', message: `Recovery point is ${rpoSeconds}s old against a ${input.maxRpoSeconds}s target.` })
  }

  return {
    schema: 'maha.restore-rehearsal.v1',
    generatedAt: new Date(verifiedAt).toISOString(),
    recoveryPoint: new Date(recoveryPoint).toISOString(),
    rtoSeconds,
    rpoSeconds,
    targets: { maxRtoSeconds: input.maxRtoSeconds, maxRpoSeconds: input.maxRpoSeconds },
    ledgers,
    findings,
    ok: findings.length === 0,
  }
}
