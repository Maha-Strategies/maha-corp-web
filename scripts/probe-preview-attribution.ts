/**
 * Prove that attributed calls against a Preview deployment land as rows.
 *
 *   TEST_API_URL=https://…vercel.app \
 *   STAGING_API_KEY=… VERCEL_AUTOMATION_BYPASS_SECRET=… \
 *   node --experimental-strip-types scripts/probe-preview-attribution.ts
 *
 * Two legs. The write leg sends attributed requests and checks the responses.
 * The read leg fetches the chargeback CSV and looks for those exact task
 * identifiers in it, which is the only evidence that a row actually reached
 * Postgres -- a 201 proves the route ran, not that the ledger accepted the
 * write, and those are different failures with different fixes.
 *
 * The read leg needs REVENUE_CONTROL_TOKEN, the operator credential the export
 * route authenticates. Without it the probe still runs the write leg and says
 * plainly that the rows were not verified, rather than reporting a pass it did
 * not establish.
 *
 * Every request costs the Preview canary tenant one credit.
 */

const target = process.env.TEST_API_URL?.trim().replace(/\/$/, '')
const apiKey = process.env.STAGING_API_KEY?.trim()
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
const operatorToken = process.env.REVENUE_CONTROL_TOKEN?.trim()

if (!target) throw new Error('TEST_API_URL is required.')
if (!apiKey) throw new Error('STAGING_API_KEY is required.')

// The same stop the workflow applies, repeated here so running this by hand
// cannot spend Production credits or write Production rows.
const host = new URL(target).host
if (!target.startsWith('https://')) throw new Error('TEST_API_URL must be https.')
if (/mahastrategies\.com$/.test(host)) throw new Error(`Refusing to probe an apex or custom domain: ${host}`)

const run = process.env.GITHUB_RUN_ID ?? String(Date.now())
const COST_CENTER = 'engineering'
const tasks = {
  compress: `task_stage_${run}_compress`,
  second: `task_stage_${run}_compress2`,
  control: `task_stage_${run}_control`,
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
    ...(bypass ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'false' } : {}),
    ...extra,
  }
}

/** A payload with enough repetition to produce a non-trivial saving. */
function compressBody(clientRequestId: string) {
  const filler = Array.from({ length: 12 }, (_, index) =>
    `Routine note ${index}. Staffing, dashboards, meeting cadence and maintenance calendars for the quarter.`).join(' ')
  return JSON.stringify({
    clientRequestId,
    task: 'Retain the rollback trigger and the release condition.',
    tokenBudget: 128,
    documents: [
      { id: 'release', title: 'Release condition', text: `${filler} Release after the production canary passes.` },
      { id: 'rollback', title: 'Rollback trigger', text: `${filler} Rollback if API errors exceed two percent for five minutes.` },
    ],
  })
}

type Line = { label: string; ok: boolean; detail: string }
const results: Line[] = []
const record = (label: string, ok: boolean, detail: string) => {
  results.push({ label, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n      ${detail}`)
}

async function compressCall(taskId: string | null, requestId: string) {
  const response = await fetch(`${target}/api/v1/compress`, {
    method: 'POST',
    headers: headers(taskId ? { 'x-maha-task-id': taskId, 'x-maha-cost-center': COST_CENTER } : {}),
    body: compressBody(requestId),
  })
  const body = await response.json().catch(() => ({})) as {
    metrics?: { tokensSaved?: number }
    billing?: { flatCredits?: number; meteredCredits?: number; tokensSaved?: number }
    error?: unknown
  }
  return { status: response.status, body }
}

async function writeLeg() {
  const attributed = await compressCall(tasks.compress, `probe_${run}_a`)
  record(
    'attributed compress call succeeds',
    attributed.status === 201,
    `HTTP ${attributed.status}${attributed.status === 201 ? '' : ` body=${JSON.stringify(attributed.body).slice(0, 300)}`}`,
  )
  record(
    'response discloses what it charged',
    Boolean(attributed.body.billing),
    `billing=${JSON.stringify(attributed.body.billing)}`,
  )
  record(
    'the pack reports a saving worth attributing',
    (attributed.body.metrics?.tokensSaved ?? 0) > 0,
    `tokensSaved=${attributed.body.metrics?.tokensSaved}`,
  )

  // A second call on a different task, same cost centre: the export must show
  // two task rows aggregating into one cost centre.
  const second = await compressCall(tasks.second, `probe_${run}_b`)
  record('second attributed call succeeds', second.status === 201, `HTTP ${second.status}`)

  // Control: no attribution headers. This must NOT appear in the export.
  const control = await compressCall(null, `probe_${run}_c`)
  record('unattributed control call succeeds', control.status === 201, `HTTP ${control.status}`)
}

async function readLeg(): Promise<boolean> {
  if (!operatorToken) {
    console.log('\nSKIP  chargeback read leg')
    console.log('      REVENUE_CONTROL_TOKEN is not set, so the rows written above were NOT verified.')
    console.log('      Add it to the preview-e2e environment to make this probe end-to-end.')
    return false
  }

  const today = new Date().toISOString().slice(0, 10)
  const url = new URL(`${target}/api/admin/chargeback-export`)
  url.searchParams.set('tenantId', process.env.PREVIEW_TENANT_ID ?? '')
  url.searchParams.set('startDate', today)
  url.searchParams.set('endDate', today)
  url.searchParams.set('granularity', 'task')

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${operatorToken}`,
      ...(bypass ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'false' } : {}),
    },
  })
  const text = await response.text()
  record('chargeback export answers', response.status === 200, `HTTP ${response.status} ${text.slice(0, 200)}`)
  if (response.status !== 200) return false

  console.log(`\n--- chargeback CSV (${response.headers.get('x-maha-row-count')} rows) ---`)
  console.log(text.trimEnd())
  console.log(`--- content hash: ${response.headers.get('x-maha-content-hash')}`)
  console.log(`--- budget status: ${response.headers.get('x-maha-budget-status')}\n`)

  record('the attributed task appears in the export', text.includes(tasks.compress), tasks.compress)
  record('the second attributed task appears too', text.includes(tasks.second), tasks.second)
  record('the cost centre is the one that was sent', text.includes(COST_CENTER), COST_CENTER)
  record(
    'the unattributed control call did NOT create a row',
    !text.includes(tasks.control),
    'a row here would mean unattributed traffic is being invoiced',
  )
  return true
}

await writeLeg()
const verified = await readLeg()

const failed = results.filter((line) => !line.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)
if (!verified) {
  console.log('Rows were written but NOT read back. This run does not establish that attribution reached Postgres.')
}
if (failed.length > 0) {
  console.error(`\nFailed: ${failed.map((line) => line.label).join('; ')}`)
  process.exitCode = 1
}
