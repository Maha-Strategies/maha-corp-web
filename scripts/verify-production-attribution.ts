/**
 * Prove that attributed spend persists in Production.
 *
 *   PRODUCTION_API_KEY=… node --experimental-strip-types scripts/verify-production-attribution.ts
 *
 * Deliberately a separate script from the Preview probe, which refuses to touch
 * a production host at all. That refusal is load-bearing and should not gain an
 * override flag; a run that spends production credit and writes production rows
 * is a different operation with different authorization, so it gets its own
 * entry point and its own explicit intent.
 *
 * Costs one production credit. It sends exactly one attributed call -- enough
 * to prove a row lands, and no more.
 *
 * Two legs, and the split is the whole point. A 201 proves the route ran; it
 * does not prove the ledger accepted the write, because attribution failures
 * are swallowed by design so a billing report can never fail a paying request.
 * The row has to be read back or nothing is established. The 2026-08-10 staging
 * run showed a green write leg against rows that were never stored.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const BASE_URL = (process.env.PRODUCTION_BASE_URL || 'https://www.mahastrategies.com').replace(/\/$/, '')
const API_KEY = process.env.PRODUCTION_API_KEY?.trim()
const OPERATOR_TOKEN = process.env.REVENUE_CONTROL_TOKEN?.trim()
const OUTPUT = process.env.PRODUCTION_ATTRIBUTION_OUTPUT_PATH?.trim()

if (!API_KEY) throw new Error('PRODUCTION_API_KEY is required. This check spends one production credit.')

// The inverse of the Preview probe's guard, and for the same reason: an
// operation that costs real money should refuse to run anywhere it was not
// meant to. Pointing this at a preview URL would report a healthy Production
// on evidence gathered somewhere else entirely.
const host = new URL(BASE_URL).host
if (!/(^|\.)mahastrategies\.com$/.test(host)) {
  throw new Error(`Refusing to verify Production against ${host}. Set PRODUCTION_BASE_URL to the canonical host.`)
}

const runId = process.env.GITHUB_RUN_ID ?? String(Date.now())
const taskId = `verify_prod_${runId}`
const costCenter = 'verification'

type Check = { label: string; ok: boolean; detail: string }
const checks: Check[] = []
const record = (label: string, ok: boolean, detail: string) => {
  checks.push({ label, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n      ${detail}`)
}

const filler = Array.from({ length: 12 }, (_, index) =>
  `Routine note ${index}. Staffing, dashboards, meeting cadence and maintenance calendars for the quarter.`).join(' ')

console.log(`\nProduction attribution verification — ${BASE_URL}`)
console.log(`  task ${taskId}, cost centre ${costCenter}, cost: one credit\n`)

// --- Write leg -------------------------------------------------------------

const written = await fetch(`${BASE_URL}/api/v1/compress`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${API_KEY}`,
    'x-maha-task-id': taskId,
    'x-maha-cost-center': costCenter,
  },
  body: JSON.stringify({
    clientRequestId: `verify_prod_${runId}`.slice(0, 120),
    task: 'Retain the rollback trigger and the release condition.',
    tokenBudget: 128,
    documents: [
      { id: 'release', title: 'Release condition', text: `${filler} Release after the production canary passes.` },
      { id: 'rollback', title: 'Rollback trigger', text: `${filler} Rollback if API errors exceed two percent for five minutes.` },
    ],
  }),
})

const body = await written.json().catch(() => ({})) as {
  metrics?: { tokensSaved?: number }
  billing?: { flatCredits?: number; meteredCredits?: number; model?: string }
  error?: unknown
}

record('attributed call succeeds', written.status === 201,
  `HTTP ${written.status}${written.status === 201 ? '' : ` ${JSON.stringify(body).slice(0, 300)}`}`)
record('billing is disclosed', Boolean(body.billing), JSON.stringify(body.billing))
record('the pack reports a saving', (body.metrics?.tokensSaved ?? 0) > 0, `tokensSaved=${body.metrics?.tokensSaved}`)

// --- Read leg --------------------------------------------------------------

let rowPersisted: boolean | null = null
let contentHash: string | null = null

if (!OPERATOR_TOKEN) {
  console.log('\nSKIP  chargeback read leg')
  console.log('      REVENUE_CONTROL_TOKEN is not set, so the row written above was NOT verified.')
  console.log('      The write returning 201 does not establish persistence: attribution failures')
  console.log('      are swallowed so a report can never fail a paying request.')
} else {
  const tenantResponse = await fetch(`${BASE_URL}/api/v1/keys/balance`, { headers: { authorization: `Bearer ${API_KEY}` } })
  const tenant = await tenantResponse.json().catch(() => ({})) as { tenant_id?: string; api_key_id?: string }
  const tenantId = tenant.tenant_id?.trim() || (tenant.api_key_id ? `tenant_${tenant.api_key_id}` : '')
  record('tenant identity is discoverable', Boolean(tenantId), tenantId || 'balance carried no tenant identity')

  if (tenantId) {
    const today = new Date().toISOString().slice(0, 10)
    const url = new URL(`${BASE_URL}/api/admin/chargeback-export`)
    url.searchParams.set('tenantId', tenantId)
    url.searchParams.set('startDate', today)
    url.searchParams.set('endDate', today)
    url.searchParams.set('granularity', 'task')

    const exported = await fetch(url, { headers: { authorization: `Bearer ${OPERATOR_TOKEN}` } })
    const csv = await exported.text()
    contentHash = exported.headers.get('x-maha-content-hash')
    record('chargeback export answers', exported.status === 200, `HTTP ${exported.status} ${csv.slice(0, 200)}`)

    if (exported.status === 200) {
      console.log(`\n--- production chargeback CSV (${exported.headers.get('x-maha-row-count')} rows) ---`)
      console.log(csv.trimEnd())
      console.log(`--- content hash: ${contentHash}\n`)
      rowPersisted = csv.includes(taskId)
      record('the attributed row persisted in Postgres', rowPersisted,
        rowPersisted ? taskId : `${taskId} is absent — the write was accepted but not stored`)
      record('the cost centre is the one that was sent', csv.includes(costCenter), costCenter)
    }
  }
}

const failed = checks.filter((check) => !check.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`)
if (rowPersisted === null) {
  console.log('Persistence was NOT verified. This run does not close the audit trail.')
}

if (OUTPUT) {
  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify({
    verifiedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    taskId,
    costCenter,
    checks,
    rowPersisted,
    contentHash,
  }, null, 2)}\n`, { mode: 0o600 })
}

if (failed.length > 0) {
  console.error(`\nFailed: ${failed.map((check) => check.label).join('; ')}`)
  process.exitCode = 1
}
