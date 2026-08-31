import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

/**
 * Operational hardening for the protected Batch 11 rehearsal.
 *
 * The workflow is the only thing that can create a Preview branch and a bound
 * deployment, so the properties that matter are the ones that hold when a run
 * goes wrong: it cannot start without a human, it stops before touching
 * anything if a credential is missing, and it cannot finish green while a
 * resource it created is still alive.
 *
 * The cleanup script is not string-matched. It is extracted from the workflow
 * and executed against a stubbed Supabase API, because "cleanup converges" is a
 * behaviour and asserting on its source text would not establish it.
 */

const ROOT = resolve(import.meta.dirname, '..')
const WORKFLOW_PATH = resolve(ROOT, '.github/workflows/preview-batch-11-remote-rehearsal.yml')
const WORKFLOW = readFileSync(WORKFLOW_PATH, 'utf8')

const PRODUCTION_PROJECT_REF = 'uhwuullakihgszxhiygz'
const REQUIRED_SECRETS = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_PROJECT_REF',
  'EPISTEMIC_OPERATIONS_TOKEN',
  'EPISTEMIC_RELEASE_AUTHORITY_TOKEN',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
  'VERCEL_TOKEN',
]

/* ------------------------------------------------------- the trigger gate -- */

test('push, pull-request and schedule events cannot start the workflow', () => {
  const triggers = WORKFLOW.slice(WORKFLOW.indexOf('\non:'), WORKFLOW.indexOf('\npermissions:'))
  assert.ok(triggers.includes('workflow_dispatch:'), 'manual dispatch must be the way in')
  for (const trigger of [
    'push:', 'pull_request:', 'pull_request_target:', 'schedule:',
    'workflow_run:', 'workflow_call:', 'repository_dispatch:', 'issue_comment:',
  ]) {
    assert.ok(!triggers.includes(trigger), `${trigger} would start the rehearsal without a human`)
  }
})

test('every job requires the protected rehearsal environment', () => {
  const jobs = WORKFLOW.slice(WORKFLOW.indexOf('\njobs:'))
  const names = [...jobs.matchAll(/^ {2}([a-z][a-z0-9_-]*):$/gm)].map((m) => m[1])
  const environments = [...jobs.matchAll(/^ {4}environment:\s*(\S+)/gm)].map((m) => m[1])
  assert.ok(names.length > 0)
  assert.equal(environments.length, names.length, `jobs=${names.join(',')} environments=${environments.join(',')}`)
  for (const environment of environments) assert.equal(environment, 'batch-11-preview-rehearsal')
})

test('the run is pinned to an exact reviewed commit and refuses any other', () => {
  assert.match(WORKFLOW, /reviewed_commit:/)
  assert.match(WORKFLOW, /ref:\s*\$\{\{\s*inputs\.reviewed_commit\s*\}\}/)
  const step = WORKFLOW.slice(WORKFLOW.indexOf('Refuse a commit that is not the reviewed one'))
  assert.match(step, /git rev-parse HEAD/)
  assert.match(step, /\[ "\$actual" = "\$REVIEWED" \] \|\|/, 'a mismatch must exit non-zero')
  assert.match(step, /exit 1/)
})

test('exact operation and confirmation strings are required and compared exactly', () => {
  for (const input of ['operation:', 'confirmation:']) assert.ok(WORKFLOW.includes(input))
  assert.match(WORKFLOW, /MAHA_B11_OPERATION:\s*\$\{\{\s*inputs\.operation\s*\}\}/)
  assert.match(WORKFLOW, /MAHA_B11_CONFIRMATION:\s*\$\{\{\s*inputs\.confirmation\s*\}\}/)
  const script = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  assert.match(script, /const OPERATION = 'batch-11-mixed-lineage-preview-rehearsal'/)
  assert.match(script, /const CONFIRMATION = 'rehearse-batch-11-mixed-lineage-in-preview-only'/)
  assert.match(script, /operation !== OPERATION \|\| confirmation !== CONFIRMATION/,
    'exact inequality, never a prefix or case-insensitive match')
})

/* ----------------------------------------------- credentials and targets -- */

test('all six Preview-only secrets are required before anything is checked out', () => {
  const boundary = WORKFLOW.slice(
    WORKFLOW.indexOf('Enforce the Preview boundary'),
    WORKFLOW.indexOf('actions/checkout'),
  )
  assert.ok(boundary.length > 0, 'the boundary step must precede checkout')
  for (const name of REQUIRED_SECRETS) {
    assert.ok(boundary.includes(name), `${name} must be checked before checkout`)
  }
  assert.match(boundary, /exit 1/)
  // And nothing remote can run first: the boundary is the first step.
  const firstStep = WORKFLOW.slice(WORKFLOW.indexOf('    steps:'), WORKFLOW.indexOf('- uses: actions/checkout'))
  assert.match(firstStep, /Enforce the Preview boundary/)
})

test('the workflow references only the six Preview-scoped secret names', () => {
  const referenced = [...new Set([...WORKFLOW.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]))]
  for (const name of referenced) assert.ok(REQUIRED_SECRETS.includes(name), `${name} is outside the Preview-scoped set`)
  for (const name of REQUIRED_SECRETS) assert.ok(referenced.includes(name), `${name} is never bound`)
  for (const forbidden of ['PRODUCTION_RELEASE_HEALTH_TOKEN', 'SUPABASE_DB_PASSWORD', 'PRODUCTION_CANARY_API_KEY']) {
    assert.ok(!referenced.includes(forbidden), `${forbidden} must not reach a Preview rehearsal`)
  }
  for (const environment of ['environment: Production', 'environment: production-database']) {
    assert.ok(!WORKFLOW.includes(environment))
  }
})

test('operations and release-authority tokens must be distinct', () => {
  assert.match(WORKFLOW, /\[ "\$EPISTEMIC_OPERATIONS_TOKEN" != "\$EPISTEMIC_RELEASE_AUTHORITY_TOKEN" \]/)
})

test('the Production Supabase project is forbidden as a rehearsal target', () => {
  assert.match(WORKFLOW, new RegExp(`!=\\s*'${PRODUCTION_PROJECT_REF}'`))
  assert.match(WORKFLOW, /The Production Supabase project is forbidden/)
})

/* ------------------------------------------------ cleanup, as behaviour --- */

/** The cleanup script the workflow actually runs, lifted out of the YAML. */
function cleanupScript(): string {
  const opener = "node --input-type=module -e '"
  const start = WORKFLOW.indexOf(opener)
  assert.notEqual(start, -1, 'the branch cleanup script must be present')
  const from = start + opener.length
  const end = WORKFLOW.indexOf("'", from)
  assert.notEqual(end, -1)
  return WORKFLOW.slice(from, end)
}

interface Scenario {
  /** Branch rows returned by each successive listing call. */
  listings: Array<{ status: number; rows: Array<{ id: string; name: string }> }>
  /** DELETE status by branch id. */
  deletes?: Record<string, number>
}

/** Runs the real cleanup script against a stubbed Supabase API. */
function runCleanup(scenario: Scenario, runId = '77'): { code: number; stdout: string; stderr: string; deleted: string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'b11-cleanup-'))
  const calls = join(dir, 'deleted.json')
  const driver = `
import { writeFileSync as record } from 'node:fs'
const scenario = ${JSON.stringify(scenario)}
const deleted = []
let listing = 0
globalThis.fetch = async (url, init = {}) => {
  const method = init.method ?? 'GET'
  if (method === 'DELETE') {
    const id = String(url).split('/').pop()
    deleted.push(id)
    const status = (scenario.deletes ?? {})[id] ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => ({}) }
  }
  const next = scenario.listings[Math.min(listing, scenario.listings.length - 1)]
  listing += 1
  return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.rows }
}
process.on('exit', () => { record(${JSON.stringify(calls)}, JSON.stringify(deleted)) })
${cleanupScript()}
`
  const file = join(dir, 'driver.mjs')
  writeFileSync(file, driver)
  const env = {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: 'stub-token-value-not-a-real-credential',
    SUPABASE_PROJECT_REF: 'previewprojectref00',
    GITHUB_RUN_ID: runId,
  }
  try {
    const stdout = execFileSync('node', [file], { encoding: 'utf8', env })
    return { code: 0, stdout, stderr: '', deleted: JSON.parse(readFileSync(calls, 'utf8')) }
  } catch (error) {
    const shell = error as { status?: number; stdout?: string; stderr?: string }
    let deleted: string[] = []
    try { deleted = JSON.parse(readFileSync(calls, 'utf8')) } catch { deleted = [] }
    return { code: shell.status ?? 1, stdout: shell.stdout ?? '', stderr: shell.stderr ?? '', deleted }
  }
}

const branch = (runId: string, id = 'br_1') => ({ id, name: `batch-11-mixed-lineage-rehearsal-${runId}` })

test('cleanup converges when there is nothing to remove', () => {
  const result = runCleanup({ listings: [{ status: 200, rows: [] }] })
  assert.equal(result.code, 0)
  assert.match(result.stdout, /Cleanup converged\. 0 branch\(es\) destroyed, 0 surviving\./)
  assert.deepEqual(result.deleted, [])
})

test('cleanup destroys a branch this run created and proves it is gone', () => {
  const result = runCleanup({
    listings: [{ status: 200, rows: [branch('77')] }, { status: 200, rows: [] }],
  })
  assert.equal(result.code, 0)
  assert.deepEqual(result.deleted, ['br_1'])
  assert.match(result.stdout, /Cleanup converged\. 1 branch\(es\) destroyed, 0 surviving\./)
})

test('cleanup targets only identifiers created by this run', () => {
  // A branch from a different run, and an unrelated branch, must be untouched.
  const result = runCleanup({
    listings: [
      { status: 200, rows: [branch('77'), branch('99', 'br_other'), { id: 'br_unrelated', name: 'someone-elses-branch' }] },
      { status: 200, rows: [branch('99', 'br_other'), { id: 'br_unrelated', name: 'someone-elses-branch' }] },
    ],
  })
  assert.equal(result.code, 0)
  assert.deepEqual(result.deleted, ['br_1'], 'only this run’s branch may be deleted')
})

test('cleanup is idempotent: an already-removed branch is not a failure', () => {
  const result = runCleanup({
    listings: [{ status: 200, rows: [branch('77')] }, { status: 200, rows: [] }],
    deletes: { br_1: 404 },
  })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Cleanup converged/)
})

test('a failed delete fails the run rather than reporting success', () => {
  const result = runCleanup({
    listings: [{ status: 200, rows: [branch('77')] }, { status: 200, rows: [] }],
    deletes: { br_1: 500 },
  })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /Failed to destroy branch br_1: 500/)
})

test('a surviving resource fails the run rather than appearing successful', () => {
  // Delete reports success, but the branch is still there on re-listing.
  const result = runCleanup({
    listings: [{ status: 200, rows: [branch('77')] }, { status: 200, rows: [branch('77')] }],
  })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /1 ephemeral branch\(es\) survived cleanup for run 77/)
})

test('an unreadable branch listing fails rather than being read as clean', () => {
  // Unknown state is not converged state. Reporting it as clean is how a
  // branch outlives the rehearsal that created it.
  const result = runCleanup({ listings: [{ status: 500, rows: [] }] })
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /Branch listing returned 500; cleanup cannot prove convergence/)
})

test('cleanup runs even when the rehearsal fails or is interrupted', () => {
  const cleanup = WORKFLOW.slice(WORKFLOW.indexOf('Destroy any surviving Preview deployment'))
  assert.match(cleanup, /if: always\(\)/)
  // The evidence upload must also survive a failure, so a failed run is still
  // inspectable.
  const upload = WORKFLOW.slice(WORKFLOW.indexOf('actions/upload-artifact'))
  assert.match(upload.slice(0, 200), /if: always\(\)/)
  // And the script destroys its own resources rather than relying on this.
  const script = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  assert.match(script, /finally\s*\{/)
})

test('the Preview deployment removal is idempotent and scoped to this run', () => {
  const cleanup = WORKFLOW.slice(WORKFLOW.indexOf('Destroy any surviving Preview deployment'))
  // The identifier comes from a marker this run wrote, never from a listing.
  assert.match(cleanup, /preview-deployment\.json/)
  assert.match(cleanup, /jq -r '\.deploymentId \/\/ empty'/)
  assert.match(cleanup, /not be found\|does not exist\|not found/, 'an absent deployment must be treated as converged')
  assert.match(cleanup, /::error::Failed to destroy Preview deployment/, 'any other failure must fail the run')
})

/* --------------------------------------------------- secret containment --- */

test('no credential is passed as a command argument', () => {
  // argv is visible in the process list; tokens travel in headers or env.
  for (const name of REQUIRED_SECRETS) {
    assert.ok(
      !new RegExp(`(vercel|psql|curl)[^\\n]*\\$\\{?${name}`).test(WORKFLOW),
      `${name} must not reach a command line`,
    )
  }
  assert.match(WORKFLOW, /authorization: `Bearer \$\{token\}`/, 'the branch token travels in a header')
})

test('evidence leaving the runner is scanned for secret-shaped text', () => {
  const verify = WORKFLOW.slice(WORKFLOW.indexOf('Verify the sanitized evidence boundary'))
  assert.match(verify, /bearer \[A-Za-z0-9\._~\+\/-\]\{16,\}/i, 'bearer credentials')
  assert.match(verify, /sbp_/, 'Supabase access tokens')
  assert.match(verify, /postgres\(ql\)\?:\/\//, 'database URLs carrying a password')
  assert.match(verify, /^\s*! grep -qEi/m, 'a match must fail the step')
})

test('error output is redacted before it reaches the log', () => {
  const cleanup = WORKFLOW.slice(WORKFLOW.indexOf('Destroy any surviving Preview deployment'))
  assert.match(cleanup, /sed -E 's\/\[A-Za-z0-9_-\]\{24,\}\/REDACTED\/g'/,
    'client error output may quote a token and must be redacted before printing')
})

/* ------------------------------------------------ the evidence contract --- */

test('the evidence contract distinguishes every operational outcome', () => {
  const verify = WORKFLOW.slice(
    WORKFLOW.indexOf('Verify the sanitized evidence boundary'),
    WORKFLOW.indexOf('actions/upload-artifact'),
  )
  for (const [claim, assertion] of [
    ['rehearsal executed', '.mode == "executed"'],
    ['seven phases completed', '([.phases[] | select(.status == "executed")] | length) == 7'],
    ['phase count is exact', '(.phases | length) == 7'],
    ['Preview branch created', '.previewBranchCreated == true'],
    ['Preview branch destroyed', '.previewBranchDestroyed == true'],
    ['Preview deployment created', '.previewDeploymentCreated == true'],
    ['Preview deployment destroyed', '.previewDeploymentDestroyed == true'],
    ['zero Production writes', '.productionWritesPerformed == 0'],
    ['Production access is a credential-free GET', '.productionAccess.credentialPresented == false'],
  ] as const) {
    assert.ok(verify.includes(assertion), `the evidence contract must assert ${claim}`)
  }
})

test('the rehearsal script emits each field the contract checks', () => {
  const script = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  for (const field of [
    'previewBranchCreated', 'previewBranchDestroyed',
    'previewDeploymentCreated', 'previewDeploymentDestroyed',
    'productionWritesPerformed', 'productionAccess',
  ]) {
    assert.ok(script.includes(field), `${field} is asserted by the workflow but never emitted`)
  }
})
