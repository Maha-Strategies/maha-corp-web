import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import batchOne from '../content/scaling/epistemic-clearing-batch-1.json' with { type: 'json' }
import batchTwo from '../content/scaling/epistemic-clearing-batch-2.json' with { type: 'json' }
import batchThree from '../content/scaling/epistemic-clearing-batch-3.json' with { type: 'json' }
import batchFour from '../content/scaling/epistemic-clearing-batch-4.json' with { type: 'json' }
import batchFive from '../content/scaling/epistemic-clearing-batch-5.json' with { type: 'json' }
import batchSix from '../content/scaling/epistemic-clearing-batch-6.json' with { type: 'json' }
import boundaryInspection from '../content/scaling/tamil-passage-boundary-inspection-v1.json' with { type: 'json' }
import routeMap from '../content/scaling/epistemic-clearing-route-candidates-v1.json' with { type: 'json' }
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { EPISTEMIC_CLEARING_PAGES } from '../lib/epistemic-clearing-batch-one.ts'

const ROOT = resolve(import.meta.dirname, '..')
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8')
const subsequent = [batchThree, batchFour, batchFive, batchSix]
const allArtifacts = [batchOne, batchTwo, ...subsequent]
const allPages = allArtifacts.flatMap((batch) => batch.pages)

test('the four local tranches freeze exactly the remaining 493 scored candidates', () => {
  assert.deepEqual(subsequent.map((batch) => batch.pages.length), [140, 200, 90, 63])
  assert.equal(subsequent.reduce((sum, batch) => sum + batch.pages.length, 0), 493)
  assert.equal(subsequent.reduce((sum, batch) => sum + batch.counts.boundedQuestions, 0), 2_465)
  assert.deepEqual(batchThree.counts.byLane, { 'evidence-clearing': 140 })
  assert.deepEqual(batchFour.counts.byLane, { 'mathematics-astronomy': 200 })
  assert.deepEqual(batchFive.counts.byLane, { 'tamil-religion': 90 })
  assert.deepEqual(batchSix.counts.byLane, { 'cross-domain-synthesis': 13, 'astrology-infrastructure': 50 })
})

test('the six batches exhaust the 1,000-route map exactly once', () => {
  assert.equal(allPages.length, 1_000)
  assert.equal(EPISTEMIC_CLEARING_PAGES.length, 1_000)
  assert.equal(new Set(allPages.map((page) => page.path)).size, 1_000)
  assert.equal(new Set(allPages.map((page) => page.candidateId)).size, 1_000)
  assert.deepEqual(
    [...allPages.map((page) => `${page.candidateId}:${page.path}`)].sort(),
    [...routeMap.candidates.map((candidate) => `${candidate.candidateId}:${candidate.proposedPath}`)].sort(),
  )
  assert.deepEqual(
    Object.fromEntries(routeMap.allocation.map((row) => [row.lane, allPages.filter((page) => page.lane === row.lane).length])),
    Object.fromEntries(routeMap.allocation.map((row) => [row.lane, row.count])),
  )
})

test('all 90 provisional Tamil candidates require an exact immutable boundary inspection', () => {
  assert.deepEqual(boundaryInspection.counts, {
    total: 90,
    paripatalEditorialSegments: 40,
    tiruvaymoliCompleteUnits: 50,
    sourceNumberingAnomalies: 1,
    interpretationInspected: 0,
  })
  assert.equal(boundaryInspection.entries.length, 90)
  assert.equal(new Set(boundaryInspection.entries.map((entry) => entry.path)).size, 90)
  assert.equal(new Set(boundaryInspection.entries.map((entry) => entry.locator)).size, 90)
  assert.ok(boundaryInspection.entries.every((entry) => entry.inspectionDepth === 'edition-structure-and-unit-boundary'))
  assert.ok(boundaryInspection.entries.every((entry) => entry.interpretationInspected === false))

  const inspectedById = new Map(boundaryInspection.entries.map((entry) => [entry.candidateId, entry]))
  const candidatesById = new Map(routeMap.candidates.map((candidate) => [candidate.candidateId, candidate]))
  for (const page of batchFive.pages) {
    const candidate = candidatesById.get(page.candidateId)
    const inspection = inspectedById.get(page.candidateId)
    assert.ok(candidate)
    assert.equal(candidate.canonicalSlugStatus, 'provisional-until-source-boundary-inspection')
    assert.ok(inspection)
    assert.equal(page.path, inspection.path)
    assert.equal(page.sourceBoundaryInspection.inspectionEntryDigest, inspection.provenanceDigest)
    assert.equal(page.sourceBoundaryInspection.locator, inspection.locator)
    assert.equal(page.sourceBoundaryInspection.interpretationInspected, false)
    assert.equal(page.evidenceFrame, 'edition-boundary-inspected-without-interpretive-finding')
    assert.match(page.methodBoundary, /does not|no unmediated/i)
    assert.equal(page.questions.length, 5)
  }
})

test('the Tiruvaymoli continuation has fifty exact eleven-item ranges and preserves the source typo', () => {
  const entries = boundaryInspection.entries.filter((entry) => entry.sourceId === 'project-madurai-tiruvaymoli-part-4')
  assert.equal(entries.length, 50)
  for (const [index, entry] of entries.entries()) {
    const start = 3299 + index * 11
    const end = start + 10
    assert.match(entry.locator, new RegExp(`${start}.*${end}`))
    assert.match(entry.boundaryEvidence, new RegExp(`eleven items.*${end}`, 'i'))
  }
  const anomalies = entries.filter((entry) => entry.sourceAnomaly)
  assert.equal(anomalies.length, 1)
  const anomaly = anomalies[0]
  assert.ok(anomaly.sourceAnomaly)
  for (const marker of ['3530', '3540', '3435', '3534', '3536']) assert.match(anomaly.locator, new RegExp(marker))
  assert.match(anomaly.sourceAnomaly, /does not silently relabel/i)
})

test('Paripatal uses forty declared editorial segments rather than inventing forty native poems', () => {
  const entries = boundaryInspection.entries.filter((entry) => entry.sourceId === 'project-madurai-paripatal')
  assert.equal(entries.length, 40)
  assert.equal(entries.filter((entry) => /Main Paripāṭal collection/.test(entry.locator)).length, 27)
  assert.equal(entries.filter((entry) => /Paripāṭal tiraṭṭu/.test(entry.locator)).length, 13)
  assert.ok(entries.every((entry) => entry.sequenceStatus === 'editorial-segment-at-printed-boundary'))
  assert.ok(entries.every((entry) => /editorial segment|bounded by its printed fragment heading/i.test(entry.boundaryEvidence)))
  assert.doesNotMatch(JSON.stringify(entries), /forty (?:printed|native|source) (?:poems|units)/i)
})

test('the new pages are bounded procedures, not fabricated results or releases', () => {
  for (const page of subsequent.flatMap((batch) => batch.pages)) {
    assert.equal(page.publicationState, 'prepared-not-deployed')
    assert.equal(page.canonicalRecordRequired, false)
    assert.equal(page.resultStatus, 'no-subject-specific-result-claimed')
    assert.equal(page.questions.length, 5)
    assert.ok(page.requiredInputs.length >= 4)
    assert.ok(page.orderedSteps.length >= 6)
    assert.ok(page.refusalConditions.length >= 3)
    assert.ok(page.limitations.length >= 3)
    assert.match(page.releaseBoundary, /does not .*canonical evidence record/i)
  }
  assert.ok(batchFour.pages.every((page) => /no new theorem proof.*astronomical observation/i.test(page.methodBoundary)))
  assert.ok(batchSix.pages.filter((page) => page.lane === 'astrology-infrastructure').every((page) => /no computed chart/i.test(page.methodBoundary)))
  assert.ok(batchSix.pages.filter((page) => page.lane === 'cross-domain-synthesis').every((page) => /does not assert.*validity transfer/i.test(page.methodBoundary)))
})

test('the preparation arithmetic stays projected and every build remains withheld', () => {
  assert.deepEqual(subsequent.map((batch) => batch.deploymentGate.cumulativePreparedRoutes), [647, 847, 937, 1_000])
  assert.deepEqual(subsequent.map((batch) => batch.deploymentGate.projectedPreparedSitePages), [1_640, 1_840, 1_930, 1_993])
  for (const batch of subsequent) {
    assert.equal(batch.deploymentGate.state, 'build-withheld')
    assert.equal(batch.deploymentGate.exactBuildCountMeasured, false)
    assert.match(batch.deploymentGate.instruction, /do not run a Next\.js, Vercel, Preview, or Production build/i)
    assert.match(batch.publicationBoundary, /not built.*deployed.*indexed.*commercially validated/i)
  }
})

test('every artifact and page digest recomputes and regeneration is byte-identical', () => {
  assert.equal(boundaryInspection.provenanceDigest, provenanceDigest(boundaryInspection))
  for (const entry of boundaryInspection.entries) assert.equal(entry.provenanceDigest, provenanceDigest(entry), entry.path)
  for (const batch of subsequent) {
    assert.equal(batch.provenanceDigest, provenanceDigest(batch))
    for (const page of batch.pages) assert.equal(page.provenanceDigest, provenanceDigest(page), page.path)
  }

  const directory = mkdtempSync(join(tmpdir(), 'clearing-batches-3-6-'))
  try {
    execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-epistemic-clearing-batches-3-6.ts', directory], { cwd: ROOT, stdio: 'pipe' })
    for (const file of [
      'tamil-passage-boundary-inspection-v1.json',
      'epistemic-clearing-batch-3.json',
      'epistemic-clearing-batch-4.json',
      'epistemic-clearing-batch-5.json',
      'epistemic-clearing-batch-6.json',
    ]) assert.equal(readFileSync(resolve(directory, 'content/scaling', file), 'utf8'), read(`content/scaling/${file}`), file)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the finite route registry, sitemap, llms manifest and source-boundary UI share one page set', () => {
  for (const path of [
    'app/developers/epistemic-clearing/[slug]/page.tsx',
    'app/knowledge/religion/clearing/[category]/[slug]/page.tsx',
    'app/knowledge/astrology/workflows/[category]/[slug]/page.tsx',
    'app/knowledge/epistemic-system/clearing/[slug]/page.tsx',
    'app/knowledge/mathematics/clearing/[slug]/page.tsx',
    'app/knowledge/astronomy/clearing/[slug]/page.tsx',
    'app/knowledge/integrations/epistemic-clearing/[slug]/page.tsx',
  ]) {
    assert.match(read(path), /dynamicParams = false/)
    assert.match(read(path), /generateStaticParams/)
    assert.match(read(path), /getClearingGuide/)
  }
  assert.match(read('app/sitemap.ts'), /EPISTEMIC_CLEARING_PAGES\.map/)
  assert.match(read('lib/llms-manifest.ts'), /EPISTEMIC_CLEARING_PAGES\.map/)
  const component = read('components/EpistemicClearingGuidePage.tsx')
  assert.match(component, /sourceBoundaryInspection\.locator/)
  assert.match(component, /sourceBoundaryInspection\.sourceUrl/)
  assert.match(component, /Boundary inspection does not imply translation/)
  assert.match(read('app/knowledge/religion/page.tsx'), /200 guides · 1,000 answers/)
})

test('no source passage, credential, private path or submitted content enters the artifacts', () => {
  const text = [
    read('content/scaling/tamil-passage-boundary-inspection-v1.json'),
    ...[3, 4, 5, 6].map((number) => read(`content/scaling/epistemic-clearing-batch-${number}.json`)),
  ].join('\n')
  for (const pattern of [
    /"passageText"|"observedContent"|"claimText"|"submittedExcerpt"/,
    /However much tapas I may have done|O my sweet nectar|மா அயோயே/,
    /\bBearer\s+\S{16,}/i,
    /\bsbp_[A-Za-z0-9]{16,}\b/,
    /\bsb_secret_[A-Za-z0-9]{16,}\b/,
    /postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i,
    /\/Users\//,
    /"reviewerId"|"authorityId"|"customerId"|"paymentIntent"/,
  ]) assert.doesNotMatch(text, pattern)
})
