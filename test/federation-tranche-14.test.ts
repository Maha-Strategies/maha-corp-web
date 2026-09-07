import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const F = 'content/federation'
const read = (n: string) => JSON.parse(readFileSync(`${F}/federation-tranche-14-${n}-v1.json`, 'utf8'))
const cohort = read('cohort')
const decisions = read('decisions')
const deps = read('dependency-validation')
const specs = read('page-specifications')
const sources = read('source-inspections')
const semantic = read('semantic-validation')
const readiness = read('readiness')
const remediation = read('dependency-remediation')
const report = readFileSync('docs/operations/federation-tranche-14-readiness.md', 'utf8')

const lineage = JSON.parse(readFileSync(`${F}/federation-candidate-lineage-v2.json`, 'utf8'))
const superseded = new Set((lineage.supersededCandidates as { candidateId: string }[]).map((s) => s.candidateId))

const priorCohorts = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology', '13']
const covered = new Set<string>()
for (const t of priorCohorts) {
  try {
    const j = JSON.parse(readFileSync(`${F}/federation-tranche-${t}-cohort-v1.json`, 'utf8'))
    for (const e of (j.entries ?? j.candidates ?? []) as { candidateId: string }[]) covered.add(e.candidateId)
  } catch { /* absent tranche contributes nothing */ }
}

/* -- cohort integrity ------------------------------------------------------ */

test('the cohort is exactly 100 unique candidates', () => {
  const ids = (cohort.entries as { candidateId: string }[]).map((c) => c.candidateId)
  assert.equal(ids.length, 100)
  assert.equal(new Set(ids).size, 100)
})

test('zero overlap with Tranches 1-13', () => {
  const overlap = (cohort.entries as { candidateId: string }[]).filter((c) => covered.has(c.candidateId))
  assert.deepEqual(overlap.map((c) => c.candidateId), [])
  assert.equal(cohort.counts.overlapWithPriorTranches, 0)
})

test('no superseded candidate was selected', () => {
  const bad = (cohort.entries as { candidateId: string }[]).filter((c) => superseded.has(c.candidateId))
  assert.deepEqual(bad.map((c) => c.candidateId), [])
})

test('legacy rank is not used for selection', () => {
  // The mythology migration left rank and tranche non-contiguous, so a rank
  // window would select an arbitrary set.
  assert.match(cohort.selectionRule, /Legacy rank is not used/)
})

/* -- dependency-first selection -------------------------------------------- */

test('every available prerequisite was selected', () => {
  const available = (remediation.prerequisites as { availability: string; supplierCandidateId: string | null }[])
    .filter((p) => p.availability === 'available-in-pool')
  const selectedIds = new Set((cohort.entries as { candidateId: string }[]).map((c) => c.candidateId))
  for (const p of available) {
    assert.ok(p.supplierCandidateId && selectedIds.has(p.supplierCandidateId),
      `${p.supplierCandidateId} unlocks a blocked candidate and was not selected`)
  }
  assert.equal(cohort.dependencyFirst.prerequisitesSelected.length, available.length)
})

test('projected unlocks equal the fan-out of the prerequisites selected', () => {
  const selected = cohort.dependencyFirst.prerequisitesSelected as { unlocks: number }[]
  assert.equal(cohort.dependencyFirst.projectedTranche13Unlocks,
    selected.reduce((n, p) => n + p.unlocks, 0))
})

test('absent prerequisites are proposals, never inserted', () => {
  // The whole point of the remediation analysis. A missing definition is
  // recorded so it can be repaired deliberately, not conjured to raise a count.
  const absent = (remediation.prerequisites as { availability: string; conceptId: string }[])
    .filter((p) => p.availability === 'absent-from-frozen-map')
  const proposals = remediation.repairProposals as { conceptId: string; status: string }[]
  assert.equal(proposals.length, absent.length)
  for (const p of proposals) assert.equal(p.status, 'proposed-inactive')
  const selectedConcepts = new Set((cohort.entries as { conceptId: string }[]).map((c) => c.conceptId))
  for (const p of absent) {
    assert.ok(!selectedConcepts.has(p.conceptId) ||
      (cohort.entries as { conceptId: string; routeRole: string }[])
        .every((c) => !(c.conceptId === p.conceptId && c.routeRole === 'definition')),
      `${p.conceptId} is absent from the map but a definition appears in the cohort`)
  }
})

/* -- ownership and dependency ---------------------------------------------- */

test('an application route never redefines its canonical concept', () => {
  for (const v of semantic.validations as { routeRole: string; prohibitedInference: string }[]) {
    if (v.routeRole !== 'definition') {
      assert.match(v.prohibitedInference, /Must not redefine/)
    }
  }
})

test('a missing prerequisite blocks its dependent', () => {
  const missing = new Set((deps.dependencies as { candidateId: string; state: string }[])
    .filter((d) => d.state === 'missing').map((d) => d.candidateId))
  for (const d of decisions.decisions as { candidateId: string; finalState: string }[]) {
    if (missing.has(d.candidateId)) assert.equal(d.finalState, 'blocked')
  }
})

test('a definition supplied inside this cohort resolves its dependents', () => {
  // The bug this catches: keying the lookup on the conceptAuthority object
  // rather than its canonicalOwner string matched nothing, and twelve
  // candidates were reported missing when the cohort supplied them.
  const present = (deps.dependencies as { state: string }[]).filter((d) => d.state === 'present-in-tranche-14')
  assert.ok(present.length > 0, 'the cohort contains definitions; some dependent must resolve to them')
  for (const d of deps.dependencies as { declaredOwner: unknown }[]) {
    assert.equal(typeof d.declaredOwner, 'string', 'declaredOwner must be the canonical owner, not an object')
  }
})

/* -- decisions and specifications ------------------------------------------ */

test('every candidate has exactly one decision', () => {
  const ids = (decisions.decisions as { candidateId: string }[]).map((d) => d.candidateId)
  assert.equal(ids.length, 100)
  assert.equal(new Set(ids).size, 100)
  assert.deepEqual([...ids].sort(),
    (cohort.entries as { candidateId: string }[]).map((c) => c.candidateId).sort())
})

test('every decision carries the exact candidate digest', () => {
  for (const d of decisions.decisions as { candidateDigest: string }[]) {
    assert.match(d.candidateDigest, /^sha256:[0-9a-f]{64}$/)
  }
})

test('specifications exist only for evidence-ready candidates', () => {
  const ready = new Set((decisions.decisions as { candidateId: string; finalState: string }[])
    .filter((d) => d.finalState === 'evidence-ready').map((d) => d.candidateId))
  const specIds = (specs.specifications as { candidateId: string }[]).map((s) => s.candidateId)
  assert.equal(specIds.length, ready.size)
  for (const id of specIds) assert.ok(ready.has(id), `${id} has a specification without being evidence-ready`)
})

test('a blocked, revised or duplicative candidate cannot become a specification', () => {
  const notReady = new Set((decisions.decisions as { candidateId: string; finalState: string }[])
    .filter((d) => d.finalState !== 'evidence-ready').map((d) => d.candidateId))
  for (const s of specs.specifications as { candidateId: string }[]) {
    assert.ok(!notReady.has(s.candidateId))
  }
})

test('every specification has five bounded questions and a citation with a locator', () => {
  for (const s of specs.specifications as { boundedQuestions: string[]; citations: { locator: string }[] }[]) {
    assert.equal(s.boundedQuestions.length, 5)
    assert.ok(s.citations.length > 0)
    for (const c of s.citations) assert.ok(c.locator.trim().length > 0)
  }
})

test('demand stays unknown; no route-specific evidence exists', () => {
  for (const s of specs.specifications as { evidenceMetadata: { demand: string } }[]) {
    assert.equal(s.evidenceMetadata.demand, 'unknown')
  }
})

/* -- evidence gate --------------------------------------------------------- */

test('every evidence-ready candidate rests on an inspected topic', () => {
  const inspected = new Set((sources.inspections as { topic: string }[]).map((i) => i.topic))
  for (const d of decisions.decisions as { topic: string; finalState: string }[]) {
    if (d.finalState === 'evidence-ready') assert.ok(inspected.has(d.topic), `${d.topic} was never inspected`)
  }
})

test('carried-forward inspections say where they came from', () => {
  const carried = (sources.inspections as { inspectionId: string; relationshipToEarlier: string }[])
    .filter((i) => /Carried forward/.test(i.relationshipToEarlier))
  assert.equal(carried.length, sources.carriedForward)
  for (const i of carried) assert.match(i.relationshipToEarlier, /Tranche 13 inspection tr13-src-\d+/)
})

test('a source that could not be read is recorded, not omitted', () => {
  const sought = sources.soughtButNotInspected as { source: string; outcome: string }[]
  assert.ok(sought.length > 0)
  for (const s of sought) assert.ok(s.outcome.trim().length > 0)
})

/* -- counts and report ----------------------------------------------------- */

test('readiness counts are derived from the artifacts', () => {
  const c = readiness.counts
  assert.equal(c.cohort, cohort.entries.length)
  assert.equal(c.specifications, specs.specifications.length)
  assert.equal(c.topicsInspected, new Set((sources.inspections as { topic: string }[]).map((i) => i.topic)).size)
  assert.equal(c.boundedQuestions,
    (specs.specifications as { boundedQuestions: unknown[] }[]).reduce((n, s) => n + s.boundedQuestions.length, 0))
  assert.equal(c.dependenciesMissing,
    (deps.dependencies as { state: string }[]).filter((d) => d.state === 'missing').length)
})

test('the Markdown report agrees with the artifacts on every count', () => {
  const c = readiness.counts
  for (const [label, value] of [
    ['Cohort', c.cohort], ['Topics in cohort', c.topicsInCohort], ['Topics inspected', c.topicsInspected],
    ['Distinct sources', c.distinctSources], ['Specifications', c.specifications],
    ['Bounded questions', c.boundedQuestions], ['Dependencies missing', c.dependenciesMissing],
    ['Prerequisites selected', c.prerequisitesSelected],
    ['Projected Tranche 13 unlocks', c.projectedTranche13Unlocks],
  ] as [string, number][]) {
    assert.ok(report.includes(`| ${label} | ${value} |`), `report disagrees on ${label}: expected ${value}`)
  }
})

test('property shortfalls are recorded rather than absorbed', () => {
  const shortfalls = cohort.shortfalls as { siteId: string; available: number; selected: number }[]
  assert.ok(shortfalls.length > 0)
  for (const s of shortfalls) {
    assert.equal(s.selected, 0)
    assert.equal(s.available, 0, `${s.siteId} shows a shortfall but had inventory remaining`)
  }
})

/* -- determinism and privacy ----------------------------------------------- */

test('artifacts and report regenerate byte-identically', () => {
  const paths = [
    'cohort', 'decisions', 'dependency-validation', 'dependency-remediation',
    'page-specifications', 'readiness', 'semantic-validation', 'source-inspections',
  ].map((n) => `${F}/federation-tranche-14-${n}-v1.json`)
  const before = [...paths.map((p) => readFileSync(p, 'utf8')), report]
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-federation-tranche-14.ts'], { stdio: 'ignore' })
  const after = [...paths.map((p) => readFileSync(p, 'utf8')),
    readFileSync('docs/operations/federation-tranche-14-readiness.md', 'utf8')]
  assert.deepEqual(after, before)
})

test('no credential, private passage or review rationale enters the artifacts', () => {
  const all = [cohort, decisions, deps, specs, sources, semantic, readiness, remediation].map((a) => JSON.stringify(a)).join(' ')
  for (const forbidden of [/sk-[A-Za-z0-9]{16,}/, /Bearer\s+[A-Za-z0-9._-]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /"password"/i, /"apiKey"/i, /eyJ[A-Za-z0-9_-]{20,}\./]) {
    assert.ok(!forbidden.test(all), `artifact contains ${forbidden}`)
  }
})
