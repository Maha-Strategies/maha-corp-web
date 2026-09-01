import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import {
  ELIGIBILITY_REQUIREMENTS,
  REQUIRED_COHORT_SHAPE,
  RegistryUnusable,
  assertRegistryUsable,
  cohortFeasibility,
  eligiblePool,
  evaluateCandidate,
  type RegistryRow,
} from '../lib/batch-11-cohort-eligibility.ts'
import { BATCH_11_LINEAGE_DECLARATIONS } from '../lib/batch-11-mixed-lineage-release.ts'
import { isAlignmentClear } from '../lib/frontier-source-alignment.ts'

/**
 * What may enter a release cohort, and what may not.
 *
 * The cohort that exists is refused by the alignment gate. The tempting repair
 * is to find five other records, so these tests pin the requirements a
 * replacement would have to meet - including the ones that make the current
 * shortfall unavoidable rather than inconvenient.
 */

const ROOT = resolve(import.meta.dirname, '..')
const SNAPSHOT = JSON.parse(readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-registry-snapshot.json'), 'utf8'))
const REGISTRY: RegistryRow[] = SNAPSHOT.rows
const AUDIT = JSON.parse(readFileSync(resolve(ROOT, 'content/frontier-audit/batch-11-cohort-eligibility.json'), 'utf8'))

/** A record that is genuinely eligible as an initial release. */
const eligibleInitial = () => eligiblePool(REGISTRY).initial[0]

test('the frozen snapshot is a credential-free read of the public registry', () => {
  assert.match(SNAPSHOT.source, /^https:\/\/www\.mahastrategies\.com\//)
  assert.match(SNAPSHOT.method, /no credential/i)
  assert.ok(REGISTRY.length > 0)
})

// --- absent registry evidence is not initial-release eligibility -----------

test('a failed or empty registry cannot be read as absent lineage', () => {
  assert.throws(() => assertRegistryUsable(null, SNAPSHOT.statusVocabularyEnumerated), RegistryUnusable)
  assert.throws(() => assertRegistryUsable([], SNAPSHOT.statusVocabularyEnumerated), RegistryUnusable)
  // The live snapshot is usable, so the guard is not vacuously passing.
  assert.doesNotThrow(() => assertRegistryUsable(REGISTRY, SNAPSHOT.statusVocabularyEnumerated))
})

test('a registry that cannot represent every status cannot license an initial release', () => {
  for (const vocabulary of [['active'], ['active', 'superseded'], []]) {
    assert.throws(() => assertRegistryUsable(REGISTRY, vocabulary), RegistryUnusable)
  }
  // The real registry enumerates withdrawn even though it holds none, which is
  // what makes a zero-row answer positive evidence rather than silence.
  assert.ok(SNAPSHOT.statusVocabularyEnumerated.includes('withdrawn'))
  assert.equal(SNAPSHOT.counts.withdrawn, 0)
})

test('an empty registry would otherwise have made the whole corpus look initial-eligible', () => {
  // Stated as a test because it is the failure this guard exists to prevent.
  const withEmpty = eligiblePool([])
  assert.ok(withEmpty.initial.length > eligiblePool(REGISTRY).initial.length,
    'an empty registry inflates the initial pool, which is why it must be refused before use')
})

// --- per-requirement refusals ----------------------------------------------

test('a record with a stale revision cannot supersede', () => {
  // Superseding a release with the digest it already carries releases nothing.
  const active = REGISTRY.find((row) => row.status === 'active')!
  const evaluation = evaluateCandidate(active.recordId, 'superseding', REGISTRY)
  if (evaluation.currentTargetSha256 === evaluation.releasedTargetSha256) {
    assert.ok(evaluation.failures.includes('revision-distinct-from-released-target'), evaluation.failures.join(','))
    assert.equal(evaluation.eligible, false)
  }
  // And this is the constraint that caps the cohort, not an edge case.
  assert.equal(AUDIT.supersedingCeiling.recordsWithOneActiveRelease > AUDIT.supersedingCeiling.ofWhichRevisionDiffersFromReleasedTarget, true)
})

test('an uninspected or non-clear source cannot enter a cohort', () => {
  for (const declaration of BATCH_11_LINEAGE_DECLARATIONS) {
    if (isAlignmentClear(declaration.recordId)) continue
    const evaluation = evaluateCandidate(declaration.recordId, declaration.declaredReleaseKind, REGISTRY)
    assert.equal(evaluation.eligible, false, declaration.recordId)
    assert.ok(evaluation.failures.includes('subject-alignment-clear'), evaluation.failures.join(','))
  }
})

test('an unaudited record fails every requirement rather than passing on absent data', () => {
  const evaluation = evaluateCandidate('urn:maha:record:does-not-exist-anywhere', 'initial', REGISTRY)
  assert.equal(evaluation.eligible, false)
  assert.equal(evaluation.failures.length, ELIGIBILITY_REQUIREMENTS.length)
})

test('a superseding declaration requires exactly one active predecessor', () => {
  const initial = eligibleInitial()
  assert.ok(initial, 'the pool must contain an initial candidate for this test to bite')
  // The same record declared superseding has no predecessor to bind.
  const asSuperseding = evaluateCandidate(initial.recordId, 'superseding', REGISTRY)
  assert.equal(asSuperseding.registryRows, 0)
  assert.equal(asSuperseding.eligible, false)
  assert.ok(asSuperseding.failures.includes('lineage-state-supports-declared-kind'))
})

test('an initial declaration requires zero rows under every status', () => {
  const withRows = REGISTRY.find((row) => row.status === 'active')!
  const evaluation = evaluateCandidate(withRows.recordId, 'initial', REGISTRY)
  assert.ok(evaluation.registryRows > 0)
  assert.equal(evaluation.eligible, false)
  assert.ok(evaluation.failures.includes('lineage-state-supports-declared-kind'))
})

// --- the shortfall is real, not a selection artefact ------------------------

test('the required cohort shape cannot be assembled', () => {
  const feasibility = cohortFeasibility(REGISTRY)
  assert.equal(feasibility.requiredSuperseding, REQUIRED_COHORT_SHAPE.superseding)
  assert.equal(feasibility.requiredInitial, REQUIRED_COHORT_SHAPE.initial)
  assert.equal(feasibility.feasible, false)
  assert.ok(feasibility.availableInitial >= REQUIRED_COHORT_SHAPE.initial, 'the initial half is not the constraint')
  assert.ok(feasibility.availableSuperseding < REQUIRED_COHORT_SHAPE.superseding, 'the superseding half is the constraint')
})

test('the superseding ceiling is measured, not asserted', () => {
  const ceiling = AUDIT.supersedingCeiling
  // Each step narrows the one above it; the chain is what makes the cap real.
  assert.ok(ceiling.recordsWithOneActiveRelease >= ceiling.ofWhichRevisionDiffersFromReleasedTarget)
  assert.ok(ceiling.ofWhichRevisionDiffersFromReleasedTarget >= ceiling.ofWhichAlignmentClear)
  assert.ok(ceiling.ofWhichAlignmentClear >= ceiling.ofWhichVersionRelationshipVerified)
  assert.ok(ceiling.ofWhichVersionRelationshipVerified < REQUIRED_COHORT_SHAPE.superseding)
})

// --- refused records mutate nothing -----------------------------------------

test('evaluating a cohort performs no mutation of any kind', () => {
  // The evaluator is pure: it takes a frozen snapshot and returns verdicts.
  // Nothing here opens a connection, applies a migration or issues a release.
  const source = readFileSync(resolve(ROOT, 'lib/batch-11-cohort-eligibility.ts'), 'utf8')
  for (const forbidden of ['fetch(', 'execFileSync', 'writeFileSync', 'psql', 'supabase', 'INSERT', 'insert into']) {
    assert.ok(!source.includes(forbidden), `the evaluator must not contain ${forbidden}`)
  }
})

// --- determinism and privacy ------------------------------------------------

test('regeneration is byte-identical', () => {
  const paths = [
    'content/frontier-audit/batch-11-cohort-eligibility.json',
    'docs/frontier-audit/batch-11-cohort-eligibility.md',
  ]
  const before = paths.map((path) => readFileSync(resolve(ROOT, path), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-batch-11-cohort-eligibility.ts'], { cwd: ROOT, encoding: 'utf8' })
  paths.forEach((path, index) => {
    assert.equal(readFileSync(resolve(ROOT, path), 'utf8'), before[index], `${path} is not deterministic`)
  })
})

test('the artifacts carry no timestamp, run id or absolute path', () => {
  for (const path of ['content/frontier-audit/batch-11-cohort-eligibility.json', 'docs/frontier-audit/batch-11-cohort-eligibility.md']) {
    const text = readFileSync(resolve(ROOT, path), 'utf8')
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text), `${path} contains a timestamp`)
    assert.ok(!/\/(Users|home|private\/tmp)\//.test(text), `${path} contains an absolute path`)
  }
})

test('no eligibility artifact reaches a client bundle, route, sitemap or llms.txt', () => {
  const markers = ['batch-11-cohort-eligibility', 'batch-11-registry-snapshot']
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
