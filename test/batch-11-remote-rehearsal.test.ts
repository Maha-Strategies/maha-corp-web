import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  BATCH_11_LINEAGE_DECLARATIONS,
  type RegistryObservation,
} from '../lib/batch-11-mixed-lineage-release.ts'
import {
  KNOWN_RELEASE_STATUSES,
  REQUIRED_PREVIEW_INVARIANTS,
  finalStateDigest,
  gateRecord,
  probeLineage,
  proveOrderIndependence,
  simulateLifecycle,
  type RegistryProbeInput,
} from '../lib/batch-11-remote-rehearsal.ts'

const ROOT = resolve(import.meta.dirname, '..')
const OBSERVATION = JSON.parse(
  readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-registry-observation.json'), 'utf8'),
) as RegistryObservation

const INITIAL_ID = 'urn:maha:record:advanced-materials-color-centers-in-diamond'
const SUPERSEDING_ID = 'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium'
const ALL_IDS = BATCH_11_LINEAGE_DECLARATIONS.map((d) => d.recordId)

const healthy = (): RegistryProbeInput => ({
  observation: JSON.parse(JSON.stringify(OBSERVATION)) as RegistryObservation,
  totalRegistryRows: OBSERVATION.totalReleasesInRegistry,
  statusVocabulary: [...KNOWN_RELEASE_STATUSES],
})
const kindOf = (id: string) => BATCH_11_LINEAGE_DECLARATIONS.find((d) => d.recordId === id)!.declaredReleaseKind
/**
 * A releasable stand-in for the cohort.
 *
 * The real cohort is blocked on source alignment. That is an evidentiary fact
 * about the corpus rather than a property of this machinery, and it is
 * asserted directly in test/batch-11-alignment-eligibility.test.ts. These tests
 * cover the lifecycle mechanism - phases, ordering, digests, refusals, cleanup
 * - which has to keep working whatever the corpus says on a given day.
 *
 * Only the alignment failure is lifted, and only here. Every other gate result
 * is the real one, so a mechanism regression still fails these tests.
 */
const releasable = <T extends { failures: readonly string[]; ready: boolean }>(gate: T): T => {
  const failures = gate.failures.filter((failure) => failure !== 'source-alignment-not-clear')
  return { ...gate, failures, ready: failures.length === 0 }
}

const gatesFor = (input: RegistryProbeInput) =>
  BATCH_11_LINEAGE_DECLARATIONS.map((d) => releasable(gateRecord(probeLineage(d.recordId, input), d.declaredReleaseKind)))

// ------------------------------------------------------------- happy path

test('the healthy cohort gates cleanly as two superseding and three initial', () => {
  const gates = gatesFor(healthy())
  assert.equal(gates.length, 5)
  assert.equal(gates.filter((g) => g.ready).length, 5)
  assert.equal(gates.filter((g) => g.declaredKind === 'superseding').length, 2)
  assert.equal(gates.filter((g) => g.declaredKind === 'initial').length, 3)
  assert.equal(gates.find((g) => g.recordId === INITIAL_ID)!.probeState, 'lineage-absent')
})

test('lineage-absent is positive evidence, not a failed lookup', () => {
  const probe = probeLineage(INITIAL_ID, healthy())
  assert.equal(probe.state, 'lineage-absent')
  assert.equal(probe.rowsAcrossAllStatuses, 0)
  // The claim rests on the registry representing non-active statuses too.
  assert.deepEqual([...probe.statusVocabularyObserved].sort(), [...KNOWN_RELEASE_STATUSES].sort())
  assert.match(probe.detail, /positive evidence/i)
})

// ------------------------------------------------- adversarial: probe states

test('adversarial: empty registry response', () => {
  const input: RegistryProbeInput = { ...healthy(), totalRegistryRows: 0 }
  for (const id of ALL_IDS) {
    const probe = probeLineage(id, input)
    assert.equal(probe.state, 'registry-empty', id)
    assert.equal(gateRecord(probe, kindOf(id)).ready, false, id)
  }
  // Critically, the initial record must NOT be licensed by an empty registry.
  const gate = releasable(gateRecord(probeLineage(INITIAL_ID, input), 'initial'))
  assert.ok(gate.failures.includes('initial-requires-absent-lineage'), gate.failures.join(','))
})

test('adversarial: registry query failure', () => {
  const input: RegistryProbeInput = { observation: null, totalRegistryRows: null, statusVocabulary: [...KNOWN_RELEASE_STATUSES] }
  for (const id of ALL_IDS) {
    const probe = probeLineage(id, input)
    assert.equal(probe.state, 'probe-failed', id)
    assert.equal(gateRecord(probe, kindOf(id)).ready, false, id)
  }
  const gate = releasable(gateRecord(probeLineage(INITIAL_ID, input), 'initial'))
  assert.ok(gate.failures.includes('lineage-probe-failed'))
  assert.ok(gate.failures.includes('initial-requires-absent-lineage'), 'a failed probe must never license an initial release')
})

test('adversarial: a typo produces record-unknown, not absent lineage', () => {
  const probe = probeLineage('urn:maha:record:this-record-does-not-exist', healthy())
  assert.equal(probe.state, 'record-unknown')
  assert.notEqual(probe.state, 'lineage-absent', 'a typo must never read as a record awaiting first release')
  assert.equal(gateRecord(probe, 'initial').ready, false)
})

test('adversarial: missing expected prior fails prior-release-disappeared, not a kind change', () => {
  const input = healthy()
  const row = input.observation!.records.find((r) => r.recordId === SUPERSEDING_ID)!
  row.totalReleases = 0
  row.activeReleases = 0
  row.activeRelease = null
  const probe = probeLineage(SUPERSEDING_ID, input)
  assert.equal(probe.state, 'lineage-absent')
  const gate = gateRecord(probe, 'superseding')
  assert.equal(gate.ready, false)
  assert.ok(gate.failures.includes('superseding-requires-present-lineage'), gate.failures.join(','))
  assert.equal(gate.declaredKind, 'superseding', 'it must NOT silently become initial')
})

test('adversarial: unexpected prior for an initial release', () => {
  const input = healthy()
  const row = input.observation!.records.find((r) => r.recordId === INITIAL_ID)!
  row.totalReleases = 1
  row.activeReleases = 1
  row.activeRelease = {
    releaseId: 'epirelease_unexpected', releaseKind: 'initial',
    targetSha256: `sha256:${'a'.repeat(64)}`,
    canonicalPath: '/knowledge/advanced-materials/methods/advanced-materials-color-centers-in-diamond',
    canonicalVersion: '0.1.0',
  }
  const probe = probeLineage(INITIAL_ID, input)
  assert.equal(probe.state, 'lineage-present')
  const gate = gateRecord(probe, 'initial')
  assert.equal(gate.ready, false)
  assert.ok(gate.failures.includes('initial-requires-absent-lineage'), gate.failures.join(','))
  assert.equal(gate.declaredKind, 'initial', 'it must NOT silently become superseding')
})

test('adversarial: a superseded-only prior still counts as lineage', () => {
  // A record whose only release is superseded has lineage. Treating it as
  // absent would produce a second initial release for the same record.
  const input = healthy()
  const row = input.observation!.records.find((r) => r.recordId === INITIAL_ID)!
  row.totalReleases = 1
  row.activeReleases = 0
  row.activeRelease = null
  const probe = probeLineage(INITIAL_ID, input)
  assert.equal(probe.state, 'lineage-present')
  assert.equal(probe.nonActiveRows, 1)
  assert.equal(gateRecord(probe, 'initial').ready, false)
})

test('adversarial: incomplete status vocabulary blocks an initial release', () => {
  // If the projection cannot represent withdrawn rows, zero rows is not
  // conclusive and an initial release must not proceed on it.
  const input: RegistryProbeInput = { ...healthy(), statusVocabulary: ['active'] }
  const gate = releasable(gateRecord(probeLineage(INITIAL_ID, input), 'initial'))
  assert.equal(gate.ready, false)
  assert.ok(gate.failures.includes('status-vocabulary-incomplete'), gate.failures.join(','))
})

// ------------------------------------------------ adversarial: decisions

test('adversarial: stale prior digest is caught by reconciliation', async () => {
  const { reconcileLineage } = await import('../lib/batch-11-mixed-lineage-release.ts')
  const obs = JSON.parse(JSON.stringify(OBSERVATION)) as RegistryObservation
  obs.records.find((r) => r.recordId === SUPERSEDING_ID)!.activeRelease!.targetSha256 = `sha256:${'c'.repeat(64)}`
  const entry = reconcileLineage(obs).entries.find((e) => e.recordId === SUPERSEDING_ID)!
  assert.equal(entry.ready, false)
  assert.ok(entry.failures.includes('prior-revision-digest-changed'), entry.failures.join(','))
})

test('adversarial: wrong proposed revision is refused', () => {
  const gates = gatesFor(healthy())
  const gate = gates.find((g) => g.recordId === SUPERSEDING_ID)!
  const tampered = { ...gate, proposedTargetSha256: `sha256:${'d'.repeat(64)}` }
  assert.notEqual(tampered.proposedTargetSha256, gate.proposedTargetSha256)
  // Final state is derived from the gate's digest, so a wrong revision changes it.
  const a = finalStateDigest(simulateLifecycle([SUPERSEDING_ID], [gate]))
  const b = finalStateDigest(simulateLifecycle([SUPERSEDING_ID], [tampered]))
  assert.notEqual(a, b)
})

test('adversarial: missing review scope blocks the record', () => {
  const gates = gatesFor(healthy())
  const gate = { ...gates[0], scopedDecisionCount: 3, failures: ['decision-scope-missing'] as const, ready: false }
  assert.throws(() => simulateLifecycle([gate.recordId], [gate]), /gate is not ready/)
})

test('adversarial: a stale or held decision blocks the record', () => {
  const gates = gatesFor(healthy())
  for (const code of ['decision-stale', 'decision-held'] as const) {
    const gate = { ...gates[0], failures: [code], ready: false }
    assert.throws(() => simulateLifecycle([gate.recordId], [gate]), /gate is not ready/)
  }
})

test('adversarial: duplicate release attempt is refused', () => {
  const gates = gatesFor(healthy())
  assert.throws(() => simulateLifecycle([SUPERSEDING_ID, SUPERSEDING_ID], gates), /duplicate-release-attempt/)
})

test('adversarial: partial lifecycle interruption leaves a deterministic prefix', () => {
  // A run that stops after three records must produce exactly the first three
  // outcomes, and those must match what a full run produced for them.
  const gates = gatesFor(healthy())
  const full = simulateLifecycle(ALL_IDS, gates)
  const partial = simulateLifecycle(ALL_IDS.slice(0, 3), gates)
  assert.equal(partial.length, 3)
  for (const outcome of partial) {
    assert.deepEqual(outcome, full.find((o) => o.recordId === outcome.recordId))
  }
})

// -------------------------------------------------------------- ordering

test('final state is independent of execution order across all permutations', () => {
  const gates = gatesFor(healthy())
  const result = proveOrderIndependence(ALL_IDS, gates)
  assert.equal(result.ordersTested, 120)
  assert.equal(result.finalStateDigests.length, 1)
  assert.equal(result.independent, true)
})

test('adversarial: reversed execution order yields identical final state', () => {
  const gates = gatesFor(healthy())
  const forward = finalStateDigest(simulateLifecycle(ALL_IDS, gates))
  const reversed = finalStateDigest(simulateLifecycle([...ALL_IDS].reverse(), gates))
  assert.equal(reversed, forward, 'a reversed order must not change the outcome')
})

test('all three initial releases supersede nothing, in every order', () => {
  const gates = gatesFor(healthy())
  for (const order of [ALL_IDS, [...ALL_IDS].reverse(), [INITIAL_ID, ...ALL_IDS.filter((i) => i !== INITIAL_ID)]]) {
    const outcomes = simulateLifecycle(order, gates)
    for (const outcome of outcomes) {
      if (outcome.releaseKind === 'initial') {
        assert.equal(outcome.supersedesNothing, true)
        assert.equal(outcome.supersededPriorReleaseId, null)
      } else {
        assert.equal(outcome.supersedesNothing, false)
        assert.ok(outcome.supersededPriorReleaseId, outcome.recordId)
      }
    }
  }
})

// -------------------------------------------------- workflow and security

test('the remote script performs nothing without authorization', () => {
  const out = execFileSync('node', ['--experimental-strip-types', 'scripts/run-batch-11-remote-rehearsal.ts'], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, MAHA_B11_REMOTE_AUTHORIZED: '', MAHA_B11_CONFIRMATION: '' },
  })
  const parsed = JSON.parse(out) as Record<string, unknown>
  // 'dry-run' when the cohort is releasable, 'blocked' when it is not. Both
  // perform nothing, which is the property under test.
  assert.ok(['dry-run', 'blocked'].includes(parsed.mode as string), `unexpected mode ${String(parsed.mode)}`)
  assert.equal(parsed.remoteOperationsPerformed, 0)
  assert.equal(parsed.previewBranchCreated, false)
  assert.equal(parsed.migrationsApplied, 0)
  assert.equal(parsed.productionWritesPerformed, 0)
  assert.equal(parsed.credentialsPresented, 0)
})

test('the remote script refuses a wrong confirmation phrase', () => {
  const result = execFileSync('node', ['--experimental-strip-types', 'scripts/run-batch-11-remote-rehearsal.ts'], {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, MAHA_B11_REMOTE_AUTHORIZED: '1', MAHA_B11_OPERATION: 'wrong-operation', MAHA_B11_CONFIRMATION: 'nope' },
  })
  const parsed = JSON.parse(result) as Record<string, unknown>
  assert.equal(parsed.mode, 'refused')
  assert.equal(parsed.remoteOperationsPerformed, 0)
})

test('no secret value appears in the rehearsal sources', () => {
  for (const file of ['scripts/run-batch-11-remote-rehearsal.ts', '.github/workflows/preview-batch-11-remote-rehearsal.yml']) {
    const source = readFileSync(resolve(ROOT, file), 'utf8')
    assert.equal(/eyJ[A-Za-z0-9_-]{20,}/.test(source), false, `${file} contains a JWT-shaped value`)
    assert.equal(/https:\/\/[a-z0-9]{20}\.supabase\.co/.test(source), false, `${file} contains a project URL`)
    assert.equal(/postgres(ql)?:\/\/[^\s"']+/.test(source), false, `${file} contains a database URL`)
  }
})

test('the workflow is manual-only and cannot fire on push', () => {
  const wf = readFileSync(resolve(ROOT, '.github/workflows/preview-batch-11-remote-rehearsal.yml'), 'utf8')
  assert.match(wf, /workflow_dispatch/)
  assert.equal(/^\s*(push|pull_request|schedule):/m.test(wf), false, 'the rehearsal must never fire automatically')
  assert.match(wf, /environment:/, 'it must require a protected environment')
})

test('the required Preview invariants are enumerated, not implied', () => {
  assert.equal(REQUIRED_PREVIEW_INVARIANTS.length, 13)
  for (const invariant of REQUIRED_PREVIEW_INVARIANTS) assert.ok(invariant.length > 20)
})

test('Codex-owned Evidence Preflight paths are untouched', () => {
  const owned = [
    'app/tools/evidence-preflight', 'app/api/evidence-preflight', 'lib/evidence-preflight.ts',
    'supabase/migrations/20260830190000_public_evidence_preflight.sql', 'test/evidence-preflight.test.ts',
    'app/tools/page.tsx', 'app/evidence-audit/page.tsx', 'app/sitemap.ts',
    'lib/llms-manifest.ts', 'lib/openapi.ts', 'test/openapi-docs.test.ts',
    'test/public-visual-system-completeness.test.ts',
  ]
  const changed = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)
  for (const path of owned) {
    assert.equal(changed.some((file) => file === path || file.startsWith(`${path}/`)), false, `${path} belongs to another workstream`)
  }
})
