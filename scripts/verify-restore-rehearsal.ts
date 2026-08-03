import { writeFile } from 'node:fs/promises'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import nextEnv from '@next/env'

import { RECOVERY_CRITICAL_LEDGERS, evaluateRestoreRehearsal, type LedgerObservation } from '../lib/restore-rehearsal.ts'

nextEnv.loadEnvConfig(process.cwd())

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function optionalNumber(name: string) {
  const value = process.env[name]?.trim()
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer of seconds.`)
  return parsed
}

const host = (url: string) => new URL(url).host

const restoreUrl = required('RESTORE_SUPABASE_URL')
const productionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()

// The whole point is to prove a scratch copy is usable. Pointing this at the
// live project would read production under the guise of a rehearsal and, worse,
// would report a passing result that proves nothing.
if (productionUrl && host(restoreUrl) === host(productionUrl)) {
  throw new Error('RESTORE_SUPABASE_URL is the live project. Restore into a separate project first.')
}

const restore = createClient(restoreUrl, required('RESTORE_SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Loss detection needs a live comparison, but reading the live database must be
// a deliberate choice rather than a side effect of running the script.
const compareLive = process.env.RESTORE_COMPARE_LIVE === 'true'
const live: SupabaseClient | null = compareLive && productionUrl
  ? createClient(productionUrl, required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
  : null

/** Count and newest timestamp only. No row contents are read or recorded. */
async function observe(client: SupabaseClient, table: string, timestampColumn: string): Promise<LedgerObservation> {
  try {
    const { data, error, count } = await client
      .from(table)
      .select(timestampColumn, { count: 'exact' })
      .order(timestampColumn, { ascending: false })
      .limit(1)
    if (error) return { table, rows: null, latestAt: null, error: error.code ?? error.message }
    const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined
    const latestAt = row?.[timestampColumn]
    return { table, rows: typeof count === 'number' ? count : 0, latestAt: typeof latestAt === 'string' ? latestAt : null }
  } catch (error) {
    return { table, rows: null, latestAt: null, error: error instanceof Error ? error.message : 'unknown error' }
  }
}

const restored = await Promise.all(RECOVERY_CRITICAL_LEDGERS.map((ledger) => observe(restore, ledger.table, ledger.timestampColumn)))
const source = live ? await Promise.all(RECOVERY_CRITICAL_LEDGERS.map((ledger) => observe(live, ledger.table, ledger.timestampColumn))) : undefined

const report = evaluateRestoreRehearsal({
  recoveryPoint: required('RESTORE_RECOVERY_POINT'),
  restoreStartedAt: required('RESTORE_STARTED_AT'),
  restoreCompletedAt: required('RESTORE_COMPLETED_AT'),
  restored,
  source,
  maxRtoSeconds: optionalNumber('RESTORE_MAX_RTO_SECONDS'),
  maxRpoSeconds: optionalNumber('RESTORE_MAX_RPO_SECONDS'),
})

const outputPath = process.env.RESTORE_OUTPUT_PATH?.trim()
if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })

console.log(JSON.stringify(report, null, 2))
if (!report.ok) {
  console.error(`\nRestore rehearsal failed with ${report.findings.length} finding(s).`)
  process.exitCode = 1
}
