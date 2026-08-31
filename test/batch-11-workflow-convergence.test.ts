import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import test from 'node:test'

import { BATCH_11_LINEAGE_DECLARATIONS } from '../lib/batch-11-mixed-lineage-release.ts'
import {
  IMPORT_ALLOWLIST,
  PRODUCTION_REGISTRY_URL,
  PRODUCTION_SUPABASE_PROJECT_REF,
  REQUIRED_MIGRATIONS,
  RehearsalRefused,
  assertImportAllowed,
  assertMigrationsAllowed,
  assertProductionReadOnly,
  assertTransitions,
} from '../lib/batch-11-rehearsal-phases.ts'

/**
 * Convergence of the Batch 11 remote path onto a single protected workflow.
 *
 * An earlier plan-only workflow ran with no protected environment, no
 * reviewed-commit pin, and two secret names that do not exist in this
 * repository, while being wired to a release-authority token. It has been
 * removed. These tests exist so a second runnable path cannot come back
 * quietly: the dangerous property was never what that workflow did, but that
 * it *could* be dispatched by anyone with write access.
 */

const ROOT = resolve(import.meta.dirname, '..')
const WORKFLOW_DIR = join(ROOT, '.github/workflows')
const AUTHORITATIVE = 'preview-batch-11-remote-rehearsal.yml'

function workflows(): Array<{ name: string; text: string }> {
  return readdirSync(WORKFLOW_DIR)
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map((file) => ({ name: file, text: readFileSync(join(WORKFLOW_DIR, file), 'utf8') }))
}

/** Workflows that can run any Batch 11 script, whatever they are named. */
function batch11Workflows(): Array<{ name: string; text: string }> {
  return workflows().filter(({ text }) => /run:[^\n]*batch-11/.test(text) || /scripts\/[a-z0-9-]*batch-11[a-z0-9-]*\.ts/.test(text))
}

const AUTH_TEXT = readFileSync(join(WORKFLOW_DIR, AUTHORITATIVE), 'utf8')

// 1
test('exactly one runnable Batch 11 remote workflow exists', () => {
  const found = batch11Workflows().map((entry) => entry.name)
  assert.deepEqual(found, [AUTHORITATIVE], `expected only ${AUTHORITATIVE}, found: ${found.join(', ') || 'none'}`)
  assert.ok(!existsSync(join(WORKFLOW_DIR, 'preview-batch-11-lineage-rehearsal.yml')), 'the retired workflow must not return')
  assert.ok(!existsSync(join(ROOT, 'scripts/run-batch-11-preview-lineage-rehearsal.ts')), 'the retired driver must not return')
})

// 2
test('the authoritative workflow is workflow_dispatch only', () => {
  const triggers = AUTH_TEXT.slice(AUTH_TEXT.indexOf('\non:'), AUTH_TEXT.indexOf('\npermissions:'))
  assert.ok(triggers.includes('workflow_dispatch:'))
  for (const trigger of ['push:', 'pull_request:', 'pull_request_target:', 'schedule:', 'workflow_run:', 'workflow_call:', 'repository_dispatch:']) {
    assert.ok(!triggers.includes(trigger), `${trigger} would make the rehearsal reachable without a human`)
  }
})

// 3
test('the authoritative workflow requires the protected rehearsal environment', () => {
  assert.match(AUTH_TEXT, /environment:\s*batch-11-preview-rehearsal/)
  // Every job in the file must carry it; a second unprotected job would be a
  // way back in.
  // Scoped to the jobs block: `on:` also has two-space keys, and
  // `workflow_dispatch:` is not a job.
  const jobsBlock = AUTH_TEXT.slice(AUTH_TEXT.indexOf('\njobs:'))
  const jobEnvironments = [...jobsBlock.matchAll(/^\s{4}environment:\s*(\S+)/gm)].map((match) => match[1])
  const jobs = [...jobsBlock.matchAll(/^ {2}([a-z][a-z0-9_-]*):$/gm)].map((match) => match[1])
  assert.equal(jobs.length, jobEnvironments.length, `each job needs a protected environment; jobs=${jobs.join(',')}`)
  for (const environment of jobEnvironments) assert.equal(environment, 'batch-11-preview-rehearsal')
})

// 4
test('the authoritative workflow requires an exact commit, operation and confirmation', () => {
  for (const input of ['operation:', 'confirmation:', 'reviewed_commit:']) {
    assert.ok(AUTH_TEXT.includes(input), `${input} must be a required dispatch input`)
  }
  assert.match(AUTH_TEXT, /ref:\s*\$\{\{\s*inputs\.reviewed_commit\s*\}\}/, 'checkout must pin to the reviewed commit')
  assert.match(AUTH_TEXT, /git rev-parse HEAD/, 'the run must verify what it actually checked out')
  assert.match(AUTH_TEXT, /Refuse a commit that is not the reviewed one/)

  const script = readFileSync(join(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  assert.match(script, /const OPERATION = 'batch-11-mixed-lineage-preview-rehearsal'/)
  assert.match(script, /const CONFIRMATION = 'rehearse-batch-11-mixed-lineage-in-preview-only'/)
  // All three locks, and an exact match on each.
  assert.match(script, /operation !== OPERATION \|\| confirmation !== CONFIRMATION/)
})

// 5
test('Production access is an unauthenticated HTTPS GET of the public registry only', () => {
  assert.equal(PRODUCTION_REGISTRY_URL, 'https://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json')
  assert.doesNotThrow(() => assertProductionReadOnly({ kind: 'public-https-get', url: PRODUCTION_REGISTRY_URL, credentialPresented: false }))

  for (const descriptor of [
    { kind: 'postgres', url: PRODUCTION_REGISTRY_URL, credentialPresented: false },
    { kind: 'public-https-get', url: PRODUCTION_REGISTRY_URL, credentialPresented: true },
    { kind: 'public-https-get', url: 'https://www.mahastrategies.com/api/admin/epistemic-releases', credentialPresented: false },
    { kind: 'public-https-get', url: 'postgresql://postgres:pw@host:5432/postgres', credentialPresented: false },
    { kind: 'public-https-get', url: 'http://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json', credentialPresented: false },
  ]) {
    assert.throws(() => assertProductionReadOnly(descriptor), RehearsalRefused, `${JSON.stringify(descriptor)} must be refused`)
  }

  const script = readFileSync(join(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  assert.match(script, /method: 'GET'/, 'the Production read must be an explicit GET')
  // No literal Production URL anywhere: the single constant is the only route in.
  assert.deepEqual([...script.matchAll(/https:\/\/[^\s'"`]*mahastrategies\.com[^\s'"`]*/g)].map((m) => m[0]), [])
})

// 6
test('no Production write credential is referenced', () => {
  const referenced = [...AUTH_TEXT.matchAll(/secrets\.([A-Z_]+)/g)].map((match) => match[1])
  const previewOnly = [
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_PROJECT_REF',
    'EPISTEMIC_OPERATIONS_TOKEN',
    'EPISTEMIC_RELEASE_AUTHORITY_TOKEN',
    'VERCEL_AUTOMATION_BYPASS_SECRET',
    'VERCEL_TOKEN',
  ]
  for (const name of referenced) assert.ok(previewOnly.includes(name), `${name} is not a bounded Preview-rehearsal credential`)
  for (const forbidden of ['PRODUCTION_RELEASE_HEALTH_TOKEN', 'PRODUCTION_CANARY_API_KEY', 'SUPABASE_DB_PASSWORD', 'MAHA_PRODUCTION_READONLY_URL']) {
    assert.ok(!referenced.includes(forbidden), `${forbidden} must not reach a Preview rehearsal`)
  }
  for (const environment of ['environment: Production', 'environment: production-database', 'environment: production-canary']) {
    assert.ok(!AUTH_TEXT.includes(environment))
  }
  // The Production Supabase project is named only so it can be refused.
  assert.match(AUTH_TEXT, new RegExp(`!=\\s*'${PRODUCTION_SUPABASE_PROJECT_REF}'`))
})

// 7
test('only the two declared predecessor lineages can be imported', () => {
  const declaredPredecessors = BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => entry.declaredPriorReleaseId !== null)
  assert.equal(IMPORT_ALLOWLIST.length, 2)
  assert.deepEqual(
    IMPORT_ALLOWLIST.map((entry) => entry.priorReleaseId).sort(),
    declaredPredecessors.map((entry) => entry.declaredPriorReleaseId).sort(),
  )
  const good = IMPORT_ALLOWLIST.map((entry) => ({ recordId: entry.recordId, releaseId: entry.priorReleaseId, targetSha256: entry.priorTargetSha256, status: 'active' }))
  assert.doesNotThrow(() => assertImportAllowed(good))
  assert.throws(() => assertImportAllowed([...good, { recordId: 'urn:maha:record:elsewhere', releaseId: 'epirelease_x', targetSha256: 'sha256:00', status: 'active' }]), RehearsalRefused)
  assert.throws(() => assertImportAllowed(good.slice(0, 1)), RehearsalRefused)
})

// 8
test('only the two dedicated forward migrations can be applied', () => {
  assert.deepEqual(REQUIRED_MIGRATIONS, [
    '20260831120000_batch_11_mixed_lineage_rehearsal.sql',
    '20260831123000_batch_11_mixed_lineage_rehearsal_execution.sql',
  ])
  for (const migration of REQUIRED_MIGRATIONS) {
    assert.ok(existsSync(join(ROOT, 'supabase/migrations', migration)))
  }
  assert.doesNotThrow(() => assertMigrationsAllowed([...REQUIRED_MIGRATIONS]))
  assert.throws(() => assertMigrationsAllowed([...REQUIRED_MIGRATIONS, '20260830200000_substantial_scale_release_targets.sql']), RehearsalRefused)
  assert.throws(() => assertMigrationsAllowed([]), RehearsalRefused)
})

// 9
test('the cohort remains two superseding plus three initial', () => {
  const superseding = BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => entry.declaredReleaseKind === 'superseding')
  const initial = BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => entry.declaredReleaseKind === 'initial')
  assert.equal(BATCH_11_LINEAGE_DECLARATIONS.length, 5)
  assert.equal(superseding.length, 2)
  assert.equal(initial.length, 3)
  for (const entry of superseding) assert.ok(entry.declaredPriorReleaseId, `${entry.recordId} must declare a predecessor`)
})

// 10
test('every initial release always supersedes nothing', () => {
  const initials = BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => entry.declaredReleaseKind === 'initial')
  assert.equal(initials.length, 3)
  for (const initial of initials) {
    assert.equal(initial.declaredPriorReleaseId, null)
    assert.equal(initial.declaredPriorTargetSha256, null)
    assert.ok(!IMPORT_ALLOWLIST.some((entry) => entry.recordId === initial.recordId), 'no predecessor may be imported for it')
  }

  // And the observation-time check refuses one that superseded anything.
  const observed = BATCH_11_LINEAGE_DECLARATIONS.map((entry) => ({
    recordId: entry.recordId,
    releaseKind: entry.declaredReleaseKind,
    activeTargetSha256: '',
    supersededReleaseId: entry.declaredPriorReleaseId,
    priorStillPresent: true,
    priorStatus: entry.declaredPriorReleaseId === null ? null : 'superseded',
  }))
  const index = observed.findIndex((row) => row.recordId === initials[0].recordId)
  observed[index] = { ...observed[index], supersededReleaseId: 'epirelease_93c92eb7a317465b83fabf8d3e6962da' }
  assert.throws(() => assertTransitions(observed, []), RehearsalRefused)
})

// 11
test('cleanup runs after every success or failure', () => {
  const cleanup = AUTH_TEXT.slice(AUTH_TEXT.indexOf('Destroy any surviving Preview deployment and ephemeral branch'))
  assert.match(cleanup, /if: always\(\)/)
  assert.match(cleanup, /vercel remove/)
  const engine = readFileSync(join(ROOT, 'lib/batch-11-rehearsal-phases.ts'), 'utf8')
  assert.match(engine, /destroyBoundPreview/, 'the exact deployment must be destroyed before the branch')
  assert.match(engine, /\}\s*finally\s*\{[\s\S]*destroyEphemeralBranch/, 'destruction must be in a finally block')
})

// 12
test('no Batch 11 rehearsal artifact reaches a public route, sitemap, llms.txt or a client bundle', () => {
  const guarded = ['batch-11-rehearsal-phases', 'batch-11-remote-rehearsal', 'batch-11-mixed-lineage-release']

  // A bounded reachability walk from every app/ entry over local imports. A
  // grep would miss a module pulled in three hops away; this does not.
  const seen = new Set<string>()
  const queue: string[] = []
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) collect(path)
      else if (/\.tsx?$/.test(entry.name)) queue.push(path)
    }
  }
  collect(join(ROOT, 'app'))
  for (const extra of ['lib/llms-manifest.ts', 'lib/openapi.ts']) {
    if (existsSync(join(ROOT, extra))) queue.push(join(ROOT, extra))
  }

  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = resolve(dirname(file), match[1])
      for (const candidate of [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts')]) {
        if (existsSync(candidate) && !seen.has(candidate)) queue.push(candidate)
      }
    }
    for (const guardedModule of guarded) {
      assert.ok(
        !file.includes(guardedModule),
        `${guardedModule} is reachable from a public entry point via ${file.replace(ROOT, '')}`,
      )
    }
  }

  // The rehearsal evidence directory is a runner artifact, never served.
  assert.ok(!existsSync(join(ROOT, 'public/batch-11-rehearsal')))
  for (const served of ['app/sitemap.ts', 'lib/llms-manifest.ts']) {
    if (!existsSync(join(ROOT, served))) continue
    const source = readFileSync(join(ROOT, served), 'utf8')
    assert.ok(!/batch-11-rehearsal|batch_11_rehearsal/.test(source), `${served} must not reference the rehearsal`)
  }
})
