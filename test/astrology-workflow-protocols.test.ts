import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import cohort from '../content/astrology/protocols/cohort-v1.json' with { type: 'json' }
import scaling from '../content/scaling/strong-domain-expansion-2026-09-04.json' with { type: 'json' }
import { ASTROLOGY_ANSWERS } from '../lib/astrology-answer-graph.ts'
import {
  ASTROLOGY_WORKFLOW_PATH,
  ASTROLOGY_WORKFLOW_PROTOCOLS,
  ASTROLOGY_WORKFLOW_PUBLIC_REGISTRY,
  ASTROLOGY_WORKFLOW_QUALITY,
  ASTROLOGY_WORKFLOW_REGISTRY_DIGEST,
  ASTROLOGY_WORKFLOW_REGISTRY_PATH,
  astrologyWorkflowPath,
  verifyAstrologyCalculationReceipt,
  type AstrologyCalculationReceipt,
} from '../lib/astrology-workflow-protocols.ts'
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('the frozen cohort implements exactly the requested 12/10/8/6 partition', () => {
  assert.equal(cohort.frozen, true)
  assert.equal(ASTROLOGY_WORKFLOW_PROTOCOLS.length, 36)
  assert.deepEqual(ASTROLOGY_WORKFLOW_PROTOCOLS.map((workflow) => workflow.slug), cohort.workflowSlugs)
  assert.deepEqual(
    Object.fromEntries(['input-reference-frame', 'calculation-uncertainty', 'evaluation-falsifiability', 'tradition-comparison'].map((category) => [category, ASTROLOGY_WORKFLOW_PROTOCOLS.filter((workflow) => workflow.category === category).length])),
    cohort.categories,
  )
})

test('worked protocols are operational contracts rather than duplicate answer pages', () => {
  const answerSlugs = new Set(ASTROLOGY_ANSWERS.map((answer) => answer.slug))
  assert.deepEqual(ASTROLOGY_WORKFLOW_PROTOCOLS.filter((workflow) => answerSlugs.has(workflow.slug)), [])
  assert.equal(ASTROLOGY_WORKFLOW_QUALITY.every((item) => item.eligible && item.informationDimensions === 8 && item.blockers.length === 0), true)
  for (const workflow of ASTROLOGY_WORKFLOW_PROTOCOLS) {
    assert.ok(workflow.requiredInputs.length >= 4)
    assert.ok(workflow.orderedSteps.length >= 4)
    assert.ok(workflow.outputs.length >= 3)
    assert.ok(workflow.refusalConditions.length >= 3)
    assert.ok(workflow.completionCriteria.length >= 3)
    assert.ok(workflow.authority.length >= 2)
    assert.equal(workflow.authority.length, workflow.authorityIds.length)
  }
})

test('ten calculation workflows carry independently recomputable receipts', () => {
  const calculations = ASTROLOGY_WORKFLOW_PROTOCOLS.filter((workflow) => workflow.category === 'calculation-uncertainty')
  assert.equal(calculations.length, 10)
  assert.equal(calculations.every((workflow) => workflow.fixture && verifyAstrologyCalculationReceipt(workflow.fixture)), true)
  assert.equal(ASTROLOGY_WORKFLOW_PROTOCOLS.filter((workflow) => workflow.category !== 'calculation-uncertainty').every((workflow) => workflow.fixture === null), true)
  assert.deepEqual(
    Object.fromEntries(calculations.map((workflow) => [workflow.slug, workflow.fixture!.outputs])),
    {
      'julian-date-receipt': { julianDateUtc: '2451545' },
      'longitude-normalization-receipt': { normalizedDegrees: '345' },
      'sidereal-transform-receipt': { siderealDegrees: '96' },
      'sign-boundary-distance': { lowerBoundaryDistanceDegrees: '29.9', nearestBoundaryDistanceDegrees: '0.1' },
      'interval-stability-sweep': { startSignIndex: '0', endSignIndex: '1', stableSign: 'false' },
      'repeated-ingress-root-scan': { rootSeconds: '1800', method: 'linear-bracket-fixture' },
      'station-bracketing': { bracketed: 'true', direction: 'direct-to-retrograde' },
      'lunation-phase-residual': { phaseResidualDegrees: '0', atTargetWithinTolerance: 'true' },
      'vimshottari-balance-allocation': { remainingYears: '15', elapsedYears: '5' },
      'combined-uncertainty-budget': { combinedStandardUncertainty: '0.037416574' },
    },
  )
})

test('tampered inputs, outputs, assumptions, uncertainty and digests all fail closed', () => {
  const source = structuredClone(ASTROLOGY_WORKFLOW_PROTOCOLS.find((workflow) => workflow.fixture)!.fixture!)
  const mutations: AstrologyCalculationReceipt[] = [
    { ...source, inputs: { ...source.inputs, instantUtc: '2000-01-02T12:00:00.000Z' } },
    { ...source, outputs: { julianDateUtc: '2451546' } },
    { ...source, assumptions: [] },
    { ...source, uncertainty: '' },
    { ...source, receiptSha256: `sha256:${'0'.repeat(64)}` },
    { ...source, operation: 'unknown-operation' as AstrologyCalculationReceipt['operation'] },
  ]
  assert.deepEqual(mutations.map(verifyAstrologyCalculationReceipt), [false, false, false, false, false, false])
})

test('evaluation protocols define possible failure without claiming a passed evaluation', () => {
  const evaluations = ASTROLOGY_WORKFLOW_PROTOCOLS.filter((workflow) => workflow.category === 'evaluation-falsifiability')
  assert.equal(evaluations.length, 8)
  assert.ok(evaluations.every((workflow) => workflow.refusalConditions.length >= 3 && /cannot|without|separate/i.test(workflow.boundary)))
  assert.equal(ASTROLOGY_WORKFLOW_PUBLIC_REGISTRY.predictiveValidityClaimed, false)
  assert.doesNotMatch(JSON.stringify(ASTROLOGY_WORKFLOW_PUBLIC_REGISTRY), /predictive skill (?:was|has been) demonstrated|scientifically validated|proven accurate/i)
})

test('the public registry is deterministic, digest-bound and privacy-safe', () => {
  assert.equal(provenanceDigest(ASTROLOGY_WORKFLOW_PUBLIC_REGISTRY), ASTROLOGY_WORKFLOW_REGISTRY_DIGEST)
  assert.equal(ASTROLOGY_WORKFLOW_PUBLIC_REGISTRY.counts.workflows, 36)
  assert.equal(ASTROLOGY_WORKFLOW_PUBLIC_REGISTRY.counts.calculationReceipts, 10)
  const publicJson = JSON.stringify(ASTROLOGY_WORKFLOW_PUBLIC_REGISTRY)
  assert.doesNotMatch(publicJson, /fixtureSpec|service_role|release.authority|access.token|reviewerEmail|participant natal|customer/i)
})

test('static pages expose HowTo metadata, receipts, refusals and completion tests', () => {
  const page = read('app/knowledge/astrology/protocols/[slug]/page.tsx')
  const hub = read('app/knowledge/astrology/protocols/page.tsx')
  const registry = read('app/knowledge/astrology/protocols/registry/route.ts')
  assert.match(page, /generateStaticParams/)
  assert.match(page, /dynamicParams = false/)
  assert.match(page, /'@type': 'HowTo'/)
  assert.match(page, /Refusal conditions/)
  assert.match(page, /Done only when/)
  assert.match(page, /Calculation receipt/)
  assert.match(hub, /alternates: \{ canonical: ASTROLOGY_WORKFLOW_PATH \}/)
  assert.match(registry, /dynamic = 'force-static'/)
  assert.match(registry, /X-Content-Digest/)
})

test('sitemap and llms manifest index exactly 38 workflow surfaces', () => {
  const sitemap = read('app/sitemap.ts')
  const llms = read('lib/llms-manifest.ts')
  assert.match(sitemap, /ASTROLOGY_WORKFLOW_PROTOCOLS\.map/)
  assert.match(sitemap, /ASTROLOGY_WORKFLOW_REGISTRY_PATH/)
  assert.match(llms, /ASTROLOGY_WORKFLOW_PROTOCOLS\.map/)
  assert.match(llms, /ASTROLOGY_WORKFLOW_REGISTRY_PATH/)
  assert.equal(new Set(ASTROLOGY_WORKFLOW_PROTOCOLS.map(astrologyWorkflowPath)).size + 2, 38)
})

test('existing astrology discovery surfaces link into the operational layer', () => {
  for (const path of ['app/knowledge/astrology/page.tsx', 'app/knowledge/astrology/questions/page.tsx', 'app/knowledge/astrology/calculations/page.tsx']) {
    assert.match(read(path), /ASTROLOGY_WORKFLOW_PATH/, path)
  }
})

test('the scaling ledger counts 38 prepared routes without calling them public', () => {
  assert.deepEqual(scaling.localUnpublishedTranche.astrologyWorkflowProtocols, {
    workflows: 36, roots: 1, registries: 1, crawlableSurfaces: 38, calculationReceipts: 10,
    categories: { inputReferenceFrame: 12, calculationUncertainty: 10, evaluationFalsifiability: 8, traditionComparison: 6 },
  })
  assert.ok(scaling.localUnpublishedTranche.totalCrawlableSurfaces >= scaling.localUnpublishedTranche.astrologyWorkflowProtocols.crawlableSurfaces)
  assert.equal(scaling.localUnpublishedTranche.projectedRoutesAfterOneDeployment, scaling.baseline.derivedCurrentRoutes + scaling.localUnpublishedTranche.totalCrawlableSurfaces)
  assert.equal(scaling.localUnpublishedTranche.projectedGapToTarget, scaling.target - scaling.localUnpublishedTranche.projectedRoutesAfterOneDeployment)
  assert.equal(scaling.localUnpublishedTranche.publicNow, false)
  assert.equal(cohort.publicNow, false)
  assert.equal(cohort.vercelBuildAuthorized, false)
  assert.equal(ASTROLOGY_WORKFLOW_PATH, '/knowledge/astrology/protocols')
  assert.equal(ASTROLOGY_WORKFLOW_REGISTRY_PATH, '/knowledge/astrology/protocols/registry')
})
