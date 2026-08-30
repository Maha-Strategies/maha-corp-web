import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import {
  BATCH_11_LINEAGE_DECLARATIONS,
  assertDeclarationCoverage,
  lineageManifestDigest,
  reconcileLineage,
  type RegistryObservation,
} from '../lib/batch-11-mixed-lineage-release.ts'
import { BATCH_11_CANARY_RECORD_IDS, BATCH_11_REVISION_AUDITS } from '../lib/batch-11-revision-canary.ts'

const ROOT = resolve(import.meta.dirname, '..')
const OBSERVATION = JSON.parse(
  readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-registry-observation.json'), 'utf8'),
) as RegistryObservation
const EMITTED = JSON.parse(
  readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-mixed-lineage-manifest.json'), 'utf8'),
) as ReturnType<typeof reconcileLineage> & { manifestDigest: string }

const clone = (): RegistryObservation => JSON.parse(JSON.stringify(OBSERVATION)) as RegistryObservation
const entryFor = (m: ReturnType<typeof reconcileLineage>, needle: string) =>
  m.entries.find((e) => e.recordId.endsWith(needle))!

// --------------------------------------------------------- classification

test('the cohort is four superseding and one initial', () => {
  const m = reconcileLineage(OBSERVATION)
  assert.equal(m.totals.records, 5)
  assert.equal(m.totals.superseding, 4)
  assert.equal(m.totals.initial, 1)
  assert.equal(m.totals.blocked, 0)
  assert.equal(entryFor(m, 'tool-allowlisting').releaseKind, 'initial')
})

test('declarations cover exactly the canary cohort', () => {
  assertDeclarationCoverage()
  assert.equal(BATCH_11_LINEAGE_DECLARATIONS.length, BATCH_11_CANARY_RECORD_IDS.length)
})

test('the initial release declares no prior target, and the others do', () => {
  for (const d of BATCH_11_LINEAGE_DECLARATIONS) {
    if (d.declaredReleaseKind === 'initial') {
      assert.equal(d.declaredPriorReleaseId, null, d.recordId)
      assert.equal(d.declaredPriorTargetSha256, null, d.recordId)
    } else {
      assert.ok(d.declaredPriorReleaseId, d.recordId)
      assert.match(d.declaredPriorTargetSha256!, /^sha256:[0-9a-f]{64}$/, d.recordId)
    }
    assert.ok(d.classificationBasis.length > 40, `${d.recordId} must state why it is classified as it is`)
  }
})

test('classification is declared, not inferred from a missing lookup', () => {
  // An empty observation must not silently reclassify four superseding records
  // as initial. Every one of them has to fail.
  const empty: RegistryObservation = { ...clone(), records: [] }
  const m = reconcileLineage(empty)
  assert.equal(m.totals.ready, 0, 'no record may be ready against an empty observation')
  for (const entry of m.entries) {
    assert.ok(entry.failures.includes('record-not-observed'), entry.recordId)
    // The declared kind is unchanged; only readiness moves.
    const declared = BATCH_11_LINEAGE_DECLARATIONS.find((d) => d.recordId === entry.recordId)!
    assert.equal(entry.releaseKind, declared.declaredReleaseKind)
  }
})

// ------------------------------------------------------------ fail closed

test('a disappeared prior release fails closed rather than becoming initial', () => {
  const obs = clone()
  const row = obs.records.find((r) => r.recordId.endsWith('tokamak-plasma-equilibrium'))!
  row.activeReleases = 0
  row.totalReleases = 0
  row.activeRelease = null
  const entry = entryFor(reconcileLineage(obs), 'tokamak-plasma-equilibrium')
  assert.equal(entry.ready, false)
  assert.ok(entry.failures.includes('prior-release-disappeared'), entry.failures.join(','))
  assert.equal(entry.releaseKind, 'superseding', 'it must NOT silently fall back to initial')
})

test('an appeared prior release fails closed rather than becoming superseding', () => {
  const obs = clone()
  const row = obs.records.find((r) => r.recordId.endsWith('tool-allowlisting'))!
  row.activeReleases = 1
  row.totalReleases = 1
  row.activeRelease = {
    releaseId: 'epirelease_unexpected',
    releaseKind: 'initial',
    targetSha256: `sha256:${'a'.repeat(64)}`,
    canonicalPath: '/knowledge/agentic-systems-mcp/measurements/agentic-systems-mcp-tool-allowlisting',
    canonicalVersion: '0.1.0',
  }
  const entry = entryFor(reconcileLineage(obs), 'tool-allowlisting')
  assert.equal(entry.ready, false)
  assert.ok(entry.failures.includes('prior-release-appeared'), entry.failures.join(','))
  assert.equal(entry.releaseKind, 'initial', 'it must NOT silently become superseding')
})

test('more than one active prior release fails closed', () => {
  const obs = clone()
  obs.records.find((r) => r.recordId.endsWith('high-purity-quartz-deposits'))!.activeReleases = 2
  const entry = entryFor(reconcileLineage(obs), 'high-purity-quartz-deposits')
  assert.equal(entry.ready, false)
  assert.ok(entry.failures.includes('multiple-active-prior-releases'), entry.failures.join(','))
})

test('a changed prior revision digest fails closed', () => {
  const obs = clone()
  obs.records.find((r) => r.recordId.endsWith('structure-prediction-filtering'))!.activeRelease!.targetSha256 = `sha256:${'b'.repeat(64)}`
  const entry = entryFor(reconcileLineage(obs), 'structure-prediction-filtering')
  assert.equal(entry.ready, false)
  assert.ok(entry.failures.includes('prior-revision-digest-changed'), entry.failures.join(','))
})

test('a changed prior release id fails closed', () => {
  const obs = clone()
  obs.records.find((r) => r.recordId.endsWith('representation-probing-boundary'))!.activeRelease!.releaseId = 'epirelease_someone_else'
  const entry = entryFor(reconcileLineage(obs), 'representation-probing-boundary')
  assert.equal(entry.ready, false)
  assert.ok(entry.failures.includes('prior-release-appeared'), entry.failures.join(','))
})

test('a canonical path mismatch fails closed', () => {
  const obs = clone()
  obs.records.find((r) => r.recordId.endsWith('tokamak-plasma-equilibrium'))!.activeRelease!.canonicalPath = '/knowledge/elsewhere'
  const entry = entryFor(reconcileLineage(obs), 'tokamak-plasma-equilibrium')
  assert.equal(entry.ready, false)
  assert.ok(entry.failures.includes('canonical-path-mismatch'), entry.failures.join(','))
})

test('every proposed revision digest matches the audit on merged main', () => {
  const m = reconcileLineage(OBSERVATION)
  for (const entry of m.entries) {
    const audit = BATCH_11_REVISION_AUDITS.find((a) => a.recordId === entry.recordId)!
    assert.equal(entry.proposedTargetSha256, audit.revisedRecordRevisionSha256, entry.recordId)
    assert.notEqual(entry.proposedTargetSha256, entry.priorTargetSha256, 'a revision must differ from what it supersedes')
  }
})

test('every record carries four scoped decisions targeting its exact revision', () => {
  for (const entry of reconcileLineage(OBSERVATION).entries) {
    assert.equal(entry.scopedDecisionCount, 4, entry.recordId)
    assert.equal(new Set(entry.scopedDecisionSha256s).size, 4, entry.recordId)
  }
})

// ----------------------------------------------------------- no mutation

test('the manifest states plainly that nothing was released', () => {
  assert.equal(EMITTED.standing.productionMutationPerformed, false)
  assert.equal(EMITTED.standing.releasePerformed, false)
  assert.equal(EMITTED.standing.previewDatabaseCreated, false)
  assert.equal(EMITTED.standing.migrationApplied, false)
})

test('the rehearsal is disabled without explicit authorization', () => {
  const out = execFileSync('node', ['--experimental-strip-types', 'scripts/run-batch-11-preview-lineage-rehearsal.ts'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, MAHA_B11_REHEARSAL_AUTHORIZED: '' },
  })
  const parsed = JSON.parse(out) as Record<string, unknown>
  assert.equal(parsed.mode, 'plan-only')
  assert.equal(parsed.remoteOperationsPerformed, 0)
  assert.equal(parsed.previewDatabaseCreated, false)
  assert.equal(parsed.migrationApplied, false)
  assert.equal(parsed.credentialPresented, false)
})

test('the rehearsal script embeds no secret value', () => {
  const source = readFileSync(resolve(ROOT, 'scripts/run-batch-11-preview-lineage-rehearsal.ts'), 'utf8')
  // Secret NAMES are listed deliberately; values must never appear.
  assert.equal(/eyJ[A-Za-z0-9_-]{20,}/.test(source), false, 'a JWT-shaped value is present')
  assert.equal(/https:\/\/[a-z0-9]{20}\.supabase\.co/.test(source), false, 'a project URL is present')
  assert.match(source, /MAHA_PREVIEW_SUPABASE_URL/)
})

// ---------------------------------------------------------- determinism

test('two generations are byte-identical', () => {
  const path = resolve(ROOT, 'content/frontier-alignment/batch-11-mixed-lineage-manifest.json')
  const before = readFileSync(path, 'utf8')
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-batch-11-mixed-lineage-manifest.ts'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(readFileSync(path, 'utf8'), before)
})

test('the manifest digest is recomputable and moves on any change', () => {
  const { manifestDigest, ...manifest } = EMITTED
  assert.equal(lineageManifestDigest(manifest), manifestDigest)
  const mutated = JSON.parse(JSON.stringify(manifest)) as typeof manifest
  mutated.entries[0].releaseKind = mutated.entries[0].releaseKind === 'initial' ? 'superseding' : 'initial'
  assert.notEqual(`sha256:${createHash('sha256').update(canonicalJson(mutated), 'utf8').digest('hex')}`, manifestDigest)
})

// ------------------------------------------------------- public exposure

test('no public route or index references the mixed-lineage work', () => {
  for (const path of ['app/sitemap.ts', 'app/llms.txt/route.ts']) {
    const source = readFileSync(resolve(ROOT, path), 'utf8')
    for (const token of ['mixed-lineage', 'registry-observation', 'lineage-rehearsal']) {
      assert.equal(source.includes(token), false, `${path} references ${token}`)
    }
  }
  let hits = ''
  try {
    hits = execFileSync('git', ['grep', '-l', '-e', 'batch-11-mixed-lineage', '-e', 'batch-11-registry-observation', '--', 'app/'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(hits, '', `a public route imports the mixed-lineage work: ${hits}`)
})

test('PR 288 source-override files are not touched by this change', () => {
  // Coordination guard: this cohort must not duplicate or edit the
  // source-override work owned by another in-flight branch.
  const owned = [
    'lib/source-override-revision-canary.ts',
    'lib/source-override-revision-ingestion-records.ts',
    'scripts/run-source-override-preview-release-canary.ts',
    '.github/workflows/preview-source-override-release-canary.yml',
  ]
  const changed = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)
  for (const path of owned) {
    assert.equal(changed.includes(path), false, `${path} belongs to another branch and must not change here`)
  }
})
