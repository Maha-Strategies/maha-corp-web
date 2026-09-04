import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import cohort from '../content/evidence-workflows/cohort-v1.json' with { type: 'json' }
import scaling from '../content/scaling/strong-domain-expansion-2026-09-04.json' with { type: 'json' }
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { verifyEvidencePreflightResult } from '../lib/evidence-preflight.ts'
import {
  EVIDENCE_WORKFLOW_CATEGORIES,
  EVIDENCE_WORKFLOW_COMMERCIAL_STATES,
  EVIDENCE_WORKFLOW_EXAMPLES,
  EVIDENCE_WORKFLOW_PATH,
  EVIDENCE_WORKFLOW_PUBLIC_REGISTRY,
  EVIDENCE_WORKFLOW_QUALITY,
  EVIDENCE_WORKFLOW_REGISTRY_DIGEST,
  EVIDENCE_WORKFLOW_REGISTRY_PATH,
  evidenceWorkflowPath,
  type EvidenceWorkflowFixture,
} from '../lib/evidence-workflow-examples.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('the frozen cohort is exactly the requested 8/6/6 partition', () => {
  assert.equal(cohort.frozen, true)
  assert.equal(cohort.syntheticOnly, true)
  assert.equal(cohort.publicNow, false)
  assert.equal(cohort.vercelBuildAuthorized, false)
  assert.equal(cohort.purchaseEnabled, false)
  assert.equal(EVIDENCE_WORKFLOW_EXAMPLES.length, 20)
  assert.deepEqual(EVIDENCE_WORKFLOW_EXAMPLES.map((workflow) => workflow.slug), cohort.exampleSlugs)
  assert.deepEqual(
    Object.fromEntries(EVIDENCE_WORKFLOW_CATEGORIES.map((category) => [category, EVIDENCE_WORKFLOW_EXAMPLES.filter((workflow) => workflow.category === category).length])),
    cohort.categories,
  )
})

test('every route is a worked workflow with refusal and verification contracts', () => {
  assert.equal(EVIDENCE_WORKFLOW_QUALITY.every((quality) => quality.eligible && quality.blockers.length === 0 && quality.informationDimensions === 9), true)
  for (const workflow of EVIDENCE_WORKFLOW_EXAMPLES) {
    assert.ok(workflow.startingInputs.length >= 3)
    assert.ok(workflow.orderedSteps.length >= 4)
    assert.ok(workflow.expectedOutputs.length >= 3)
    assert.ok(workflow.refusalConditions.length >= 3)
    assert.ok(workflow.verificationChecks.length >= 3)
    assert.ok(workflow.contractLinks.length >= 2)
    assert.equal(workflow.fixture.synthetic, true)
  }
})

test('the eight preflight examples are outputs of the actual compiler', () => {
  const examples = EVIDENCE_WORKFLOW_EXAMPLES.filter((workflow) => workflow.category === 'evidence-preflight')
  assert.equal(examples.length, 8)
  for (const workflow of examples) {
    assert.ok(workflow.preflightResult)
    assert.deepEqual(verifyEvidencePreflightResult(workflow.preflightResult!), [])
    assert.equal(workflow.preflightResult!.independentSourceInspectionPerformed, false)
    assert.equal(workflow.preflightResult!.contentRetainedByMaha, false)
  }
  assert.deepEqual(
    Object.fromEntries(examples.map((workflow) => [workflow.slug, workflow.preflightResult!.summary])),
    {
      'doi-with-exact-locator': { claimCount: 1, readyForSourceInspection: 1, blockedBeforeSourceInspection: 0, metadataOnly: 0, locatedExcerptCount: 1 },
      'public-url-with-authorized-excerpt': { claimCount: 1, readyForSourceInspection: 1, blockedBeforeSourceInspection: 0, metadataOnly: 0, locatedExcerptCount: 1 },
      'metadata-only-source': { claimCount: 1, readyForSourceInspection: 0, blockedBeforeSourceInspection: 1, metadataOnly: 1, locatedExcerptCount: 0 },
      'unsupported-causal-inference': { claimCount: 1, readyForSourceInspection: 0, blockedBeforeSourceInspection: 1, metadataOnly: 0, locatedExcerptCount: 1 },
      'source-identity-mismatch': { claimCount: 1, readyForSourceInspection: 0, blockedBeforeSourceInspection: 1, metadataOnly: 0, locatedExcerptCount: 1 },
      'incomplete-locator': { claimCount: 1, readyForSourceInspection: 0, blockedBeforeSourceInspection: 1, metadataOnly: 0, locatedExcerptCount: 0 },
      'rights-and-access-uncertain': { claimCount: 1, readyForSourceInspection: 0, blockedBeforeSourceInspection: 1, metadataOnly: 0, locatedExcerptCount: 1 },
      'three-claim-mixed-preflight': { claimCount: 3, readyForSourceInspection: 1, blockedBeforeSourceInspection: 2, metadataOnly: 1, locatedExcerptCount: 2 },
    },
  )
})

test('fixture and workflow digests fail after mutation', () => {
  const workflow = structuredClone(EVIDENCE_WORKFLOW_EXAMPLES.find((entry) => entry.slug === 'recompute-calculation-receipt')!)
  const { artifactSha256, ...fixtureBody } = workflow.fixture
  assert.equal(provenanceDigest(fixtureBody), artifactSha256)
  const tamperedFixture: EvidenceWorkflowFixture = { ...workflow.fixture, expected: { resultLower: '12', resultUpper: '19', unit: 'nm' } }
  const { artifactSha256: claimedDigest, ...tamperedBody } = tamperedFixture
  assert.notEqual(provenanceDigest(tamperedBody), claimedDigest)
  const { workflowSha256, ...workflowBody } = workflow
  assert.equal(provenanceDigest(workflowBody), workflowSha256)
  workflow.summary = `${workflow.summary} Changed.`
  const { workflowSha256: staleDigest, ...changedBody } = workflow
  assert.notEqual(provenanceDigest(changedBody), staleDigest)
})

test('calculation absence stays empty and the worked interval is independently checkable', () => {
  const absent = EVIDENCE_WORKFLOW_EXAMPLES.find((workflow) => workflow.slug === 'preserve-absent-calculation')!
  assert.deepEqual(absent.fixture.expected.calculationReceipts, [])
  assert.equal(absent.fixture.expected.calculationsApplicable, false)
  const calculation = EVIDENCE_WORKFLOW_EXAMPLES.find((workflow) => workflow.slug === 'recompute-calculation-receipt')!
  const input = calculation.fixture.input as Record<string, string>
  const expected = calculation.fixture.expected as Record<string, string>
  assert.equal(String(BigInt(input.leftLower) + BigInt(input.rightLower)), expected.resultLower)
  assert.equal(String(BigInt(input.leftUpper) + BigInt(input.rightUpper)), expected.resultUpper)
  assert.equal(input.unit, expected.unit)
})

test('commercial states cannot imply a purchase or public licensed runtime', () => {
  assert.deepEqual(EVIDENCE_WORKFLOW_COMMERCIAL_STATES, {
    freePreflight: { state: 'available-free', path: '/tools/evidence-preflight', priceUsd: 0 },
    boundedDossier: { state: 'informational-purchase-disabled', path: '/tools/evidence-preflight#future-offer', proposedPriceUsd: 250, purchaseEnabled: false },
    developerEvidenceRetrieval: { state: 'private-engagement', path: '/contact', monthlyListPriceUsd: 1250, publicRuntimeAvailable: false },
  })
  assert.equal(EVIDENCE_WORKFLOW_PUBLIC_REGISTRY.purchaseEnabled, false)
  assert.equal(EVIDENCE_WORKFLOW_EXAMPLES.some((workflow) => /checkout now|buy now|publicly callable/i.test(workflow.summary)), false)
})

test('the public registry is deterministic, synthetic, and free of operational secrets', () => {
  assert.equal(provenanceDigest(EVIDENCE_WORKFLOW_PUBLIC_REGISTRY), EVIDENCE_WORKFLOW_REGISTRY_DIGEST)
  const publicText = JSON.stringify(EVIDENCE_WORKFLOW_PUBLIC_REGISTRY)
  assert.match(publicText, /synthetic/i)
  assert.doesNotMatch(publicText, /service[_-]role|bearer\s+[a-z0-9._-]+|EPISTEMIC_RELEASE_AUTHORITY_TOKEN|SUPABASE_SERVICE_ROLE_KEY|VERCEL_TOKEN|\/api\/mcp\/evidence/i)
  assert.doesNotMatch(publicText, /customer[_ -]id|reviewerEmail|participant|natal data|payment intent/i)
})

test('static routes expose HowTo metadata and a digest-bound registry', () => {
  const page = read('app/knowledge/evidence-workflows/[slug]/page.tsx')
  const hub = read('app/knowledge/evidence-workflows/page.tsx')
  const registry = read('app/knowledge/evidence-workflows/registry/route.ts')
  assert.match(page, /generateStaticParams/)
  assert.match(page, /dynamicParams = false/)
  assert.match(page, /'@type': 'HowTo'/)
  assert.match(page, /Refusal conditions/)
  assert.match(page, /Verification checks/)
  assert.match(page, /Synthetic worked example/)
  assert.match(hub, /alternates: \{ canonical: EVIDENCE_WORKFLOW_PATH \}/)
  assert.match(hub, /purchase disabled/i)
  assert.match(registry, /dynamic = 'force-static'/)
  assert.match(registry, /X-Content-Digest/)
})

test('sitemap and llms manifest index exactly 22 evidence-workflow surfaces', () => {
  const sitemap = read('app/sitemap.ts')
  const llms = read('lib/llms-manifest.ts')
  assert.match(sitemap, /EVIDENCE_WORKFLOW_EXAMPLES\.map/)
  assert.match(sitemap, /EVIDENCE_WORKFLOW_REGISTRY_PATH/)
  assert.match(llms, /EVIDENCE_WORKFLOW_EXAMPLES\.map/)
  assert.match(llms, /EVIDENCE_WORKFLOW_REGISTRY_PATH/)
  const paths = EVIDENCE_WORKFLOW_EXAMPLES.map(evidenceWorkflowPath)
  assert.equal(new Set(paths).size, 20)
  assert.equal(new Set([...paths, EVIDENCE_WORKFLOW_PATH, EVIDENCE_WORKFLOW_REGISTRY_PATH]).size, 22)
})

test('the existing commercial surfaces link to the worked examples', () => {
  for (const path of ['app/tools/evidence-preflight/page.tsx', 'app/evidence-audit/page.tsx', 'app/enterprise-mcp-gateway/page.tsx', 'app/knowledge/epistemic-system/releases/page.tsx']) {
    assert.match(read(path), /EVIDENCE_WORKFLOW_PATH/, path)
  }
})

test('the route ledger accounts for the KDP withdrawal in its prepared projection', () => {
  assert.deepEqual(scaling.localUnpublishedTranche.evidenceWorkflows, {
    examples: 20, roots: 1, registries: 1, crawlableSurfaces: 22,
    categories: { evidencePreflight: 8, dossierCalculationReceipt: 6, mcpReleaseFlow: 6 }, syntheticOnly: true, purchaseEnabled: false,
  })
  assert.equal(scaling.baseline.derivedCurrentRoutes, 795)
  assert.equal(scaling.localUnpublishedTranche.grossAddedCrawlableSurfaces, 221)
  assert.equal(scaling.localUnpublishedTranche.mahaPrincipleKdpBoundary.withdrawnCanonicalSurfaces, 42)
  assert.equal(scaling.localUnpublishedTranche.totalCrawlableSurfaces, 179)
  assert.equal(scaling.localUnpublishedTranche.projectedRoutesAfterOneDeployment, 974)
  assert.equal(scaling.localUnpublishedTranche.projectedGapToTarget, 26)
  assert.equal(scaling.localUnpublishedTranche.projectedRoutesBeyondTarget, 0)
  assert.equal(scaling.localUnpublishedTranche.publicNow, false)
  assert.equal(scaling.baseline.derivedNotObserved, true)
})

test('the evidence-workflow paths are stable and non-overlapping', () => {
  assert.equal(EVIDENCE_WORKFLOW_PATH, '/knowledge/evidence-workflows')
  assert.equal(EVIDENCE_WORKFLOW_REGISTRY_PATH, '/knowledge/evidence-workflows/registry')
  assert.equal(EVIDENCE_WORKFLOW_EXAMPLES.some((workflow) => workflow.slug === 'registry'), false)
})
