import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import { PHASE_ORDER } from '../lib/batch-11-rehearsal-phases.ts'
import {
  REQUIRED_EXECUTION_ORDERS,
  repositoryContract,
  scanForProhibitedContent,
  verifyRehearsalEvidence,
  type RefusalCode,
  type TeardownObservation,
} from '../lib/batch-11-evidence-verifier.ts'

/**
 * The verifier must refuse a bad run, not describe one.
 *
 * Every case below is a way a rehearsal could look successful while something
 * went wrong, so each asserts a specific refusal code rather than merely that
 * the verdict was not "verified" - a verifier that refuses everything for the
 * wrong reason would pass a weaker test.
 */

const ROOT = resolve(import.meta.dirname, '..')
const FIXTURE = JSON.parse(readFileSync(resolve(ROOT, 'test/fixtures/batch-11-compliant-artifact.json'), 'utf8'))
const CONTRACT = repositoryContract(resolve(ROOT, 'content/frontier-alignment/batch-11-registry-observation.json'))

type Artifact = Record<string, unknown>
const artifact = (): Artifact => structuredClone(FIXTURE.artifact) as Artifact
const teardown = (): TeardownObservation[] => structuredClone(FIXTURE.teardown) as TeardownObservation[]
const COMMIT: string = FIXTURE.reviewedCommit

function verify(over: { artifact?: Artifact; reviewedCommit?: string; teardown?: TeardownObservation[] | null } = {}) {
  return verifyRehearsalEvidence({
    artifact: over.artifact ?? artifact(),
    reviewedCommit: over.reviewedCommit ?? COMMIT,
    teardown: over.teardown === undefined ? teardown() : over.teardown,
  }, CONTRACT)
}

const refusesWith = (code: RefusalCode, over: Parameters<typeof verify>[0] = {}) => {
  const report = verify(over)
  assert.equal(report.verdict, 'refused')
  assert.ok(report.refusals.includes(code), `expected ${code}, got ${report.refusals.join(', ') || 'none'}`)
  return report
}

/* --------------------------------------------------------- the baseline -- */

test('the bundled fixture is explicitly synthetic and never mistakable for evidence', () => {
  assert.equal(FIXTURE.syntheticFixture, true)
  assert.match(FIXTURE.note, /Not evidence of any rehearsal/i)
})

test('a compliant artifact with confirmed teardown verifies', () => {
  const report = verify()
  assert.equal(report.verdict, 'verified', report.refusals.join(', '))
  assert.deepEqual(report.refusals, [])
  assert.ok(report.checks.length >= 20)
  assert.match(report.verificationDigest, /^sha256:[0-9a-f]{64}$/)
})

/* ------------------------------------------------------------- phases ---- */

test('a missing phase refuses', () => {
  const bad = artifact()
  bad.phases = (bad.phases as unknown[]).slice(0, PHASE_ORDER.length - 1)
  refusesWith('phase-count-wrong', { artifact: bad })
})

test('a duplicated phase refuses', () => {
  const bad = artifact()
  const phases = bad.phases as Record<string, unknown>[]
  phases[phases.length - 1] = structuredClone(phases[0])
  refusesWith('phase-duplicated', { artifact: bad })
})

test('reordered phases refuse even when all seven are present', () => {
  const bad = artifact()
  const phases = bad.phases as Record<string, unknown>[]
  ;[phases[0], phases[1]] = [phases[1], phases[0]]
  const report = refusesWith('phase-out-of-order', { artifact: bad })
  assert.ok(!report.refusals.includes('phase-count-wrong'), 'the count is still right; only the order is wrong')
})

test('a phase that did not execute refuses', () => {
  const bad = artifact()
  ;(bad.phases as Record<string, unknown>[])[3].status = 'refused'
  refusesWith('phase-not-executed', { artifact: bad })
})

/* ------------------------------------------------------------ releases --- */

test('a forged release count refuses', () => {
  for (const count of [4, 6, 0, 50]) {
    const bad = artifact()
    bad.releasesIssued = count
    refusesWith('release-count-mismatch', { artifact: bad })
  }
})

test('a wrong initial/superseding classification refuses', () => {
  const bad = artifact()
  const fingerprint = bad.fingerprint as Record<string, unknown>
  // The total is still five; only the split is wrong.
  fingerprint.supersedingCount = 3
  fingerprint.initialCount = 2
  refusesWith('release-composition-mismatch', { artifact: bad })
})

test('a cohort of the wrong size refuses', () => {
  const bad = artifact()
  ;(bad.fingerprint as Record<string, unknown>).cohortSize = 6
  refusesWith('cohort-size-mismatch', { artifact: bad })
})

/* --------------------------------------------------- digests and records -- */

test('an altered revision or record digest refuses', () => {
  const bad = artifact()
  ;(bad.fingerprint as Record<string, unknown>).planDigest = `sha256:${'f'.repeat(64)}`
  refusesWith('plan-digest-mismatch', { artifact: bad })
})

test('a substituted record refuses', () => {
  const bad = artifact()
  const ids = [...(bad.cohortRecordIds as string[])]
  ids[0] = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
  bad.cohortRecordIds = ids
  refusesWith('record-substituted-or-undeclared', { artifact: bad })
})

test('an unrelated record refuses', () => {
  const bad = artifact()
  bad.cohortRecordIds = [...(bad.cohortRecordIds as string[]), 'urn:maha:record:something-entirely-else']
  refusesWith('record-substituted-or-undeclared', { artifact: bad })
})

test('self-consistent tampering refuses because the digest is re-derived, not echoed', () => {
  // The artifact is internally coherent: the record list, the counts and the
  // plan digest all agree with each other. They disagree with the repository,
  // which is the only reason this is catchable.
  const bad = artifact()
  bad.cohortRecordIds = [
    'urn:maha:record:agentic-systems-mcp-tool-deny-by-default',
    ...(bad.cohortRecordIds as string[]).slice(1),
  ]
  ;(bad.fingerprint as Record<string, unknown>).planDigest = `sha256:${'a1b2c3d4'.repeat(8)}`
  const report = verify({ artifact: bad })
  assert.equal(report.verdict, 'refused')
  assert.ok(report.refusals.includes('plan-digest-mismatch'))
  assert.ok(report.refusals.includes('record-substituted-or-undeclared'))
})

/* ------------------------------------------------- order convergence ----- */

test('a missing order-convergence proof refuses', () => {
  const bad = artifact()
  delete (bad.fingerprint as Record<string, unknown>).orderIndependent
  refusesWith('order-convergence-missing', { artifact: bad })
})

test('an incomplete order-convergence proof refuses', () => {
  for (const orders of [1, 60, REQUIRED_EXECUTION_ORDERS - 1, REQUIRED_EXECUTION_ORDERS + 1]) {
    const bad = artifact()
    ;(bad.fingerprint as Record<string, unknown>).ordersProvenIndependent = orders
    refusesWith('order-convergence-incomplete', { artifact: bad })
  }
})

/* ------------------------------------------------------------ Production -- */

test('any Production write refuses', () => {
  for (const writes of [1, 5, -1]) {
    const bad = artifact()
    bad.productionWritesPerformed = writes
    refusesWith('production-write-detected', { artifact: bad })
  }
})

test('credential-presented Production access refuses', () => {
  const bad = artifact()
  ;(bad.productionAccess as Record<string, unknown>).credentialPresented = true
  refusesWith('production-access-credentialed', { artifact: bad })
})

test('Production access by any means other than a public GET refuses', () => {
  for (const kind of ['postgres', 'authenticated-https-get', 'service-role', undefined]) {
    const bad = artifact()
    ;(bad.productionAccess as Record<string, unknown>).kind = kind
    refusesWith('production-access-not-public-get', { artifact: bad })
  }
})

/* -------------------------------------------------- reviewed commit ------ */

test('a stale reviewed SHA refuses', () => {
  refusesWith('reviewed-commit-mismatch', { reviewedCommit: 'c'.repeat(40) })
})

test('an artifact that names no reviewed commit cannot be tied to reviewed code', () => {
  const bad = artifact()
  delete bad.reviewedCommit
  refusesWith('reviewed-commit-unbound-in-artifact', { artifact: bad })
})

/* ------------------------------------------------------------- teardown -- */

test('absent teardown observations refuse: self-reported cleanup is not confirmation', () => {
  refusesWith('teardown-observations-absent', { teardown: null })
  refusesWith('teardown-observations-absent', { teardown: [] })
})

test('partial cleanup refuses', () => {
  // The branch is gone; the deployment was never observed.
  const partial = teardown().filter((entry) => entry.resourceKind === 'supabase-branch')
  refusesWith('teardown-observations-absent', { teardown: partial })
})

test('cleanup reported but not independently observed refuses', () => {
  const reported = teardown()
  reported[0].observedState = 'reported-not-observed'
  refusesWith('teardown-reported-not-observed', { teardown: reported })
})

test('unknown API state refuses rather than being read as absence', () => {
  const unknown = teardown()
  unknown[1].observedState = 'unknown'
  refusesWith('teardown-state-unknown', { teardown: unknown })
})

test('a surviving Preview resource refuses', () => {
  const surviving = teardown()
  surviving[1].observedState = 'present'
  refusesWith('teardown-resource-present', { teardown: surviving })
})

test('only confirmed absence passes, for every resource kind', () => {
  for (const state of ['reported-not-observed', 'unknown', 'present'] as const) {
    for (const index of [0, 1]) {
      const observations = teardown()
      observations[index].observedState = state
      assert.equal(verify({ teardown: observations }).verdict, 'refused', `${state} on ${observations[index].resourceKind}`)
    }
  }
})

/* ------------------------------------------------------------- content --- */

test('secret-shaped content refuses', () => {
  const join = (...parts: string[]) => parts.join('')
  for (const injected of [
    { note: join('Authorization: Bearer ', 'sk-', 'abcdefghijklmnopqrstuvwxyz012345') },
    { note: join('sbp', '_', '0123456789abcdef0123456789abcdef01234567') },
    { note: join('postgresql://postgres:', 'hunter2hunter2', '@db.host.supabase.co:5432/postgres') },
    { note: join('eyJ', 'hbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.abc') },
  ]) {
    const bad = { ...artifact(), ...injected }
    refusesWith('secret-shaped-content', { artifact: bad })
  }
})

test('participant, natal, customer, enquiry and payment data refuse', () => {
  for (const injected of [
    { participantId: 'p-1' },
    { natal: { birthTime: '12:00' } },
    { customerEmail: 'someone@example.com' },
    { enquiry: 'inbound' },
    { paymentIntent: 'pi_x' },
  ]) {
    const bad = { ...artifact(), ...injected }
    refusesWith('sensitive-data-detected', { artifact: bad })
  }
})

test('private corpus excerpts and unhashed authority values refuse', () => {
  refusesWith('sensitive-data-detected', { artifact: { ...artifact(), note: 'disposition: reject-or-hold' } })
  refusesWith('sensitive-data-detected', { artifact: { ...artifact(), authorizationBasis: 'the owner approved' } })
})

test('a digest is not mistaken for a secret', () => {
  assert.deepEqual(scanForProhibitedContent({ planDigest: `sha256:${'6'.repeat(64)}` }), { secrets: [], sensitive: [] })
})

/* ---------------------------------------------------------- malformed ---- */

test('a malformed artifact refuses instead of throwing', () => {
  for (const value of [null, 'not an object', 42, []]) {
    const report = verifyRehearsalEvidence({ artifact: value, reviewedCommit: COMMIT }, CONTRACT)
    assert.equal(report.verdict, 'refused')
    assert.deepEqual(report.refusals, ['artifact-malformed'])
  }
})

test('mode other than executed refuses', () => {
  for (const mode of ['blocked', 'dry-run', 'refused', 'authorized-but-unimplemented', undefined]) {
    const bad = artifact()
    bad.mode = mode
    refusesWith('mode-not-executed', { artifact: bad })
  }
})

/* ------------------------------------------------- determinism & digest -- */

test('the verification digest is stable and excludes free text and timestamps', () => {
  const first = verify()
  const second = verify()
  assert.equal(first.verificationDigest, second.verificationDigest)

  // Reworded detail and an added observation timestamp must not move it.
  const reworded = teardown()
  reworded[0].detail = 'Completely different prose describing the same observation.'
  reworded[0].observedAt = '2026-08-31T12:00:00.000Z'
  assert.equal(verify({ teardown: reworded }).verificationDigest, first.verificationDigest)

  // A changed verdict must move it.
  const bad = artifact()
  bad.productionWritesPerformed = 1
  assert.notEqual(verify({ artifact: bad }).verificationDigest, first.verificationDigest)
})

test('the reports regenerate byte-identically', () => {
  const paths = [
    'content/frontier-audit/batch-11-verification-report.json',
    'docs/frontier-audit/batch-11-verification-report.md',
    'test/fixtures/batch-11-compliant-artifact.json',
  ]
  const before = paths.map((path) => readFileSync(resolve(ROOT, path), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-batch-11-verification-fixture.ts'], { cwd: ROOT })
  execFileSync('node', ['--experimental-strip-types', 'scripts/verify-batch-11-rehearsal-evidence.ts'], { cwd: ROOT })
  paths.forEach((path, index) => {
    assert.equal(readFileSync(resolve(ROOT, path), 'utf8'), before[index], `${path} is not deterministic`)
  })
})

test('the reports carry no generation timestamp or absolute path', () => {
  for (const path of [
    'content/frontier-audit/batch-11-verification-report.json',
    'docs/frontier-audit/batch-11-verification-report.md',
  ]) {
    const text = readFileSync(resolve(ROOT, path), 'utf8')
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text), `${path} contains a timestamp`)
    assert.ok(!/\/(Users|home|private\/tmp)\//.test(text), `${path} contains an absolute path`)
  }
})

test('the verifier makes no remote call and mutates nothing', () => {
  const source = readFileSync(resolve(ROOT, 'lib/batch-11-evidence-verifier.ts'), 'utf8')
  // Invocation shapes, not vocabulary: the module legitimately names
  // "vercel-preview" as a resource kind and "vercel token" as a scanner label.
  for (const forbidden of ['fetch(', 'execFileSync', 'spawnSync', 'writeFileSync', 'https://api.', 'psql']) {
    assert.ok(!source.includes(forbidden), `the verifier must not contain ${forbidden}`)
  }
  // readFileSync is the one filesystem call it makes, and only for manifests.
  const reads = [...source.matchAll(/readFileSync\(([^)]*)\)/g)].map((m) => m[1])
  assert.equal(reads.length, 1, 'the verifier reads exactly one path, the registry observation')
  assert.match(reads[0], /observationPath/)
})

/* ------------------------------------------------------ public boundary -- */

test('no verifier artifact reaches a client bundle, route, sitemap or llms.txt', () => {
  const markers = ['batch-11-evidence-verifier', 'batch-11-verification-report', 'batch-11-compliant-artifact']
  const clientEntries: string[] = []
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) collect(path)
      else if (/\.tsx?$/.test(entry.name) && /^\s*['"]use client['"]/.test(readFileSync(path, 'utf8'))) clientEntries.push(path)
    }
  }
  for (const dir of ['app', 'components']) if (existsSync(join(ROOT, dir))) collect(join(ROOT, dir))
  assert.ok(clientEntries.length > 0)

  const seen = new Set<string>()
  const queue = [...clientEntries]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const marker of markers) {
      assert.ok(!source.includes(marker), `${file.replace(ROOT, '')} pulls ${marker} into a client bundle`)
    }
    for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = resolve(dirname(file), match[1])
      for (const candidate of [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts')]) {
        if (existsSync(candidate) && !seen.has(candidate)) queue.push(candidate)
      }
    }
  }
  for (const served of ['app/sitemap.ts', 'lib/llms-manifest.ts']) {
    if (!existsSync(join(ROOT, served))) continue
    const source = readFileSync(join(ROOT, served), 'utf8')
    for (const marker of markers) assert.ok(!source.includes(marker), `${served} references ${marker}`)
  }
  assert.ok(!existsSync(join(ROOT, 'public/frontier-audit')))
})
