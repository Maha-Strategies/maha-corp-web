import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import {
  CLOSURE_REQUIREMENTS,
  closureDigest,
  verifyBatch11Closure,
  type ClosureRefusal,
} from '../lib/batch-11-closure-verifier.ts'
import { REQUIRED_TEARDOWN_KINDS, repositoryContract, type TeardownEvidence } from '../lib/batch-11-evidence-verifier.ts'
import { recomputeObservationsDigest, TEARDOWN_PRODUCER_VERSION } from '../lib/batch-11-teardown-observations.ts'

/**
 * Closure is a stronger claim than success.
 *
 * A run can execute every phase, release the right records, and still leave a
 * branch alive or a secret bound - or leave no way to tell which credential
 * did the work. These tests pin the answers that would otherwise be assumed.
 */

const ROOT = resolve(import.meta.dirname, '..')
const FIXTURE = JSON.parse(readFileSync(resolve(ROOT, 'test/fixtures/batch-11-compliant-artifact.json'), 'utf8'))
const CONTRACT = repositoryContract(resolve(ROOT, 'content/frontier-alignment/batch-11-registry-observation.json'))

type Artifact = Record<string, unknown>
const artifact = (): Artifact => structuredClone(FIXTURE.artifact) as Artifact
const teardown = (): TeardownEvidence => structuredClone(FIXTURE.teardown) as TeardownEvidence

const close = (over: { artifact?: unknown; teardown?: unknown } = {}) =>
  verifyBatch11Closure(
    over.artifact === undefined ? artifact() : over.artifact,
    over.teardown === undefined ? teardown() : over.teardown,
    CONTRACT,
  )

const refusesWith = (code: ClosureRefusal, over: Parameters<typeof close>[0] = {}) => {
  const report = close(over)
  assert.equal(report.closed, false)
  assert.ok(report.refusals.includes(code), `expected ${code}, got ${report.refusals.join(', ') || 'none'}`)
  return report
}

/** Mutates observations and re-seals the producer digest. */
function resealed(mutate: (evidence: TeardownEvidence) => void): TeardownEvidence {
  const evidence = teardown()
  mutate(evidence)
  evidence.observationsDigest = recomputeObservationsDigest({
    schemaVersion: TEARDOWN_PRODUCER_VERSION,
    runMarker: evidence.runMarker,
    reviewedCommit: evidence.reviewedCommit,
    observations: evidence.observations as never,
    allConfirmedAbsent: evidence.observations.every((entry) => entry.observedState === 'confirmed-absent'),
  })
  return evidence
}

/* ------------------------------------------------------------ baseline --- */

test('a complete run closes, and says exactly what it proved', () => {
  const report = close()
  assert.equal(report.closed, true, report.refusals.join(', '))
  assert.deepEqual(report.refusals, [])
  assert.equal(report.summary.phasesExecuted, CLOSURE_REQUIREMENTS.phases)
  assert.equal(report.summary.releases.total, CLOSURE_REQUIREMENTS.releases)
  assert.equal(report.summary.releases.superseding, CLOSURE_REQUIREMENTS.superseding)
  assert.equal(report.summary.releases.initial, CLOSURE_REQUIREMENTS.initial)
  assert.equal(report.summary.productionWrites, 0)
  assert.equal(report.summary.resourcesConfirmedDestroyed, REQUIRED_TEARDOWN_KINDS.length)
  assert.equal(report.summary.credentialFingerprintMatched, true)
  assert.equal(report.summary.capabilityPreflightStatus, 200)
  assert.match(report.closureDigest, /^sha256:[0-9a-f]{64}$/)
})

test('malformed inputs refuse instead of throwing', () => {
  for (const value of [null, 'text', 42, []]) {
    assert.deepEqual(close({ artifact: value }).refusals, ['artifact-malformed'])
  }
  for (const value of [null, 'text', 42, {}, { observations: 'no' }]) {
    assert.deepEqual(close({ teardown: value }).refusals, ['teardown-malformed'])
  }
})

/* -------------------------------------------------- credential identity -- */

test('a run that cannot name its credential is not closed', () => {
  for (const value of [false, undefined, 'true', null]) {
    const bad = artifact()
    if (value === undefined) delete bad.credentialFingerprintMatched
    else bad.credentialFingerprintMatched = value
    refusesWith('credential-fingerprint-unproven', { artifact: bad })
  }
})

test('a missing, failed or malformed capability preflight is not closed', () => {
  const missing = artifact()
  delete missing.poolerCapabilityPreflight
  refusesWith('capability-preflight-missing', { artifact: missing })

  for (const status of [401, 403, 404, 429, 500, 0]) {
    const bad = artifact()
    ;(bad.poolerCapabilityPreflight as Record<string, unknown>).status = status
    refusesWith('capability-preflight-unsuccessful', { artifact: bad })
  }

  for (const over of [
    { databaseType: 'READ_REPLICA' },
    { poolMode: '' },
    { primaryHostFingerprint: 'aws-0-us-east-1.pooler.supabase.com' },
    { parentProjectRefFingerprint: 'osmccujuezymcgckgwxo' },
  ]) {
    const bad = artifact()
    Object.assign(bad.poolerCapabilityPreflight as Record<string, unknown>, over)
    refusesWith('capability-preflight-malformed', { artifact: bad })
  }
})

test('the preflight record carries only non-reversible fingerprints', () => {
  const capability = artifact().poolerCapabilityPreflight as Record<string, unknown>
  const serialized = JSON.stringify(capability)
  assert.ok(!serialized.includes('pooler.supabase.com'))
  assert.match(String(capability.primaryHostFingerprint), /^sha256:[0-9a-f]{64}$/)
  assert.match(String(capability.parentProjectRefFingerprint), /^sha256:[0-9a-f]{64}$/)
})

test('a mutation that began before the preflight is not closed', () => {
  const bad = artifact()
  bad.mutationStartedAfterPreflight = false
  refusesWith('mutation-preceded-preflight', { artifact: bad })
})

/* ------------------------------------------------ exact resource identity */

test('an observation that fingerprints a different resource is refused', () => {
  const evidence = resealed((draft) => {
    draft.observations[0].identifierFingerprint = `sha256:${'d'.repeat(64)}`
  })
  refusesWith('resource-identity-unbound', { teardown: evidence })
})

test('a missing or duplicated observation is refused', () => {
  refusesWith('resource-identity-missing', {
    teardown: resealed((draft) => { draft.observations = draft.observations.slice(1) }),
  })
  refusesWith('resource-identity-missing', {
    teardown: resealed((draft) => { draft.observations = [...draft.observations, draft.observations[0]] }),
  })
})

test('an artifact with no handle digests cannot bind its resources', () => {
  const bad = artifact()
  delete bad.teardownHandleDigests
  refusesWith('resource-identity-unbound', { artifact: bad })
})

/* -------------------------------------------------------- destruction ---- */

test('every resource must be independently confirmed absent', () => {
  for (const state of ['reported-not-observed', 'unknown', 'present'] as const) {
    for (let index = 0; index < REQUIRED_TEARDOWN_KINDS.length; index += 1) {
      const evidence = resealed((draft) => { draft.observations[index].observedState = state })
      const report = close({ teardown: evidence })
      assert.equal(report.closed, false, `${state} on ${evidence.observations[index].resourceKind}`)
      assert.ok(report.refusals.includes('resource-not-confirmed-destroyed'))
    }
  }
})

test('a run that reports incomplete cleanup is not closed', () => {
  for (const key of ['branchDestroyed', 'deploymentDestroyed', 'markerRemoved']) {
    const bad = artifact()
    const cleanup = bad.cleanup as Record<string, unknown>
    if (key in cleanup) {
      cleanup[key] = false
      refusesWith('cleanup-incomplete', { artifact: bad })
    }
  }
})

/* ------------------------------------------------------- run consistency - */

test('artifacts describing different runs are refused', () => {
  refusesWith('run-identity-inconsistent', {
    teardown: { ...teardown(), workflowRunId: '999' },
  })
  refusesWith('run-identity-inconsistent', {
    teardown: { ...teardown(), runMarker: 'batch-11-mixed-lineage-rehearsal-999' },
  })
  refusesWith('run-identity-inconsistent', {
    teardown: { ...teardown(), reviewedCommit: 'd'.repeat(40) },
  })
})

test('a run marker that does not derive from the run id is refused', () => {
  const bad = artifact()
  bad.runMarker = 'batch-11-mixed-lineage-rehearsal-999'
  refusesWith('run-identity-inconsistent', { artifact: bad })
})

test('a missing run id is refused', () => {
  const bad = artifact()
  delete bad.workflowRunId
  refusesWith('run-identity-inconsistent', { artifact: bad })
})

/* ------------------------------------- composed evidence still governs ---- */

test('reordered phases, forged releases and Production writes still refuse', () => {
  const reordered = artifact()
  const phases = reordered.phases as Record<string, unknown>[]
  ;[phases[0], phases[1]] = [phases[1], phases[0]]
  refusesWith('evidence-verification-refused', { artifact: reordered })

  const forged = artifact()
  forged.releasesIssued = 4
  refusesWith('evidence-verification-refused', { artifact: forged })

  const written = artifact()
  written.productionWritesPerformed = 1
  refusesWith('evidence-verification-refused', { artifact: written })
})

/* --------------------------------------------------------- output safety - */

test('a report that would carry credential-shaped content refuses instead', () => {
  const bad = artifact()
  // Lands in the cleanup-status detail, which serialises the value.
  bad.cleanup = { branchDestroyed: ['postgresql://postgres:', 'hunter2hunter2', '@db.host:5432/db'].join('') }
  const report = close({ artifact: bad })
  assert.equal(report.closed, false)
  assert.deepEqual(report.refusals, ['closure-output-credential-shaped'])
  assert.ok(!JSON.stringify(report).includes('hunter2hunter2'), 'the refusal must not carry the value it refused')
})

test('the closure digest is stable and moves only on a changed answer', () => {
  const first = close()
  assert.equal(first.closureDigest, close().closureDigest)
  const changed = artifact()
  changed.credentialFingerprintMatched = false
  assert.notEqual(close({ artifact: changed }).closureDigest, first.closureDigest)
  // Recomputable from the report itself.
  const { closureDigest: recorded, ...rest } = first
  assert.equal(closureDigest(rest), recorded)
})

/* -------------------------------------------- determinism and boundaries -- */

test('the reports regenerate byte-identically', () => {
  const paths = [
    'content/frontier-audit/batch-11-closure-report.json',
    'docs/frontier-audit/batch-11-closure-report.md',
  ]
  const before = paths.map((path) => readFileSync(resolve(ROOT, path), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/verify-batch-11-closure.ts'], { cwd: ROOT })
  paths.forEach((path, index) => {
    assert.equal(readFileSync(resolve(ROOT, path), 'utf8'), before[index], `${path} is not deterministic`)
  })
})

test('the reports carry no timestamp, absolute path or secret, and stay labelled synthetic', () => {
  for (const path of [
    'content/frontier-audit/batch-11-closure-report.json',
    'docs/frontier-audit/batch-11-closure-report.md',
  ]) {
    const text = readFileSync(resolve(ROOT, path), 'utf8')
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text), `${path} contains a timestamp`)
    assert.ok(!/\/(Users|home|private\/tmp)\//.test(text), `${path} contains an absolute path`)
    assert.ok(!/sbp_[A-Za-z0-9]{16,}|postgres(ql)?:\/\/[^\s"]*:[^\s"@]+@/.test(text), `${path} contains a credential`)
  }
  assert.match(readFileSync(resolve(ROOT, 'docs/frontier-audit/batch-11-closure-report.md'), 'utf8'), /Synthetic fixture/)
  assert.match(readFileSync(resolve(ROOT, 'content/frontier-audit/batch-11-closure-report.json'), 'utf8'), /"syntheticFixture": true/)
})

test('the verifier makes no remote call and mutates nothing', () => {
  const source = readFileSync(resolve(ROOT, 'lib/batch-11-closure-verifier.ts'), 'utf8')
  for (const forbidden of ['fetch(', 'execFileSync', 'spawnSync', 'writeFileSync', 'https://api.', 'psql']) {
    assert.ok(!source.includes(forbidden), `the closure verifier must not contain ${forbidden}`)
  }
})

test('no closure artifact reaches a client bundle, route, sitemap or llms.txt', () => {
  const markers = ['batch-11-closure-verifier', 'batch-11-closure-report', 'closureDigest']
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
})
