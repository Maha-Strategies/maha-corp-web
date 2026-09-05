import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import batchOne from '../content/scaling/epistemic-clearing-batch-1.json' with { type: 'json' }
import batch from '../content/scaling/epistemic-clearing-batch-2.json' with { type: 'json' }
import candidates from '../content/scaling/epistemic-clearing-route-candidates-v1.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const ROOT = resolve(import.meta.dirname, '..')
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8')
const pages = batch.pages

test('Batch 2 freezes exactly 407 new method routes and 2,035 bounded questions', () => {
  assert.equal(pages.length, 407)
  assert.equal(batch.counts.total, 407)
  assert.equal(batch.counts.boundedQuestions, 2_035)
  assert.equal(new Set(pages.map((page) => page.path)).size, 407)
  assert.deepEqual(batch.counts.byLane, {
    'machine-integrations': 60,
    'tamil-religion': 80,
    'astrology-infrastructure': 80,
    'evidence-clearing': 100,
    'mathematics-astronomy': 50,
    'cross-domain-synthesis': 37,
  })
  assert.equal(batch.counts.bookConceptPriority, 260)
})

test('every route binds to one stable scored candidate and overlaps neither Batch 1 nor the observed surface', () => {
  const candidateById = new Map(candidates.candidates.map((candidate) => [candidate.candidateId, candidate]))
  const earlier = new Set([...batchOne.pages.map((page) => page.path), ...(observation.sitemapPaths as string[])])
  for (const page of pages) {
    const source = candidateById.get(page.candidateId)
    assert.ok(source, page.candidateId)
    assert.equal(source.canonicalSlugStatus, 'stable-candidate', page.path)
    assert.equal(page.path, source.proposedPath)
    assert.equal(page.candidateRank, source.rank)
    assert.equal(page.lane, source.lane)
    assert.ok(!earlier.has(page.path), `route already existed: ${page.path}`)
    assert.match(page.path, /^\/[a-z0-9/-]+$/)
  }
})

test('method pages cannot be mistaken for completed research, calculations, proofs, or integrations', () => {
  for (const page of pages) {
    assert.equal(page.contentMode, 'bounded-method-guide', page.path)
    assert.equal(page.resultStatus, 'no-subject-specific-result-claimed', page.path)
    assert.match(page.releaseBoundary, /does not .*report a completed subject-specific result/i, page.path)
    assert.match(page.methodBoundary, /does not|contains no|not a finding|not evidence/i, page.path)
    assert.equal(page.decisionRecord.resultStatus, 'No subject-specific result has been produced by this method guide.', page.path)
    assert.equal(page.decisionRecord.question, page.question, page.path)
    assert.ok(page.decisionRecord.minimumEvidence.length > 80, page.path)
    assert.ok(page.decisionRecord.passCondition.length > 80, page.path)
  }

  for (const page of pages.filter((entry) => entry.lane === 'tamil-religion')) {
    assert.match(page.methodBoundary, /does not claim.*passage.*edition.*translation/i, page.path)
    assert.ok(page.sourceLinks.every((link) => link.role !== 'inspected-source-projection'), page.path)
  }
  for (const page of pages.filter((entry) => entry.family === 'deterministic-calculation-receipt')) {
    assert.match(page.methodBoundary, /no computed chart/i, page.path)
    assert.match(page.directAnswer, /no invented number/i, page.path)
  }
  for (const page of pages.filter((entry) => entry.lane === 'mathematics-astronomy')) {
    assert.match(page.methodBoundary, /no new theorem proof.*astronomical observation/i, page.path)
  }
  for (const page of pages.filter((entry) => entry.lane === 'cross-domain-synthesis')) {
    assert.match(page.methodBoundary, /does not assert.*validity transfer/i, page.path)
  }
})

test('every page has a distinct subject-specific decision payload and procedural depth', () => {
  const signatures = new Set<string>()
  for (const page of pages) {
    assert.ok(page.requiredInputs.length >= 4, `${page.path}: inputs`)
    assert.ok(page.orderedSteps.length >= 6, `${page.path}: steps`)
    assert.ok(page.expectedOutputs.length >= 3, `${page.path}: outputs`)
    assert.ok(page.refusalConditions.length >= 3, `${page.path}: refusals`)
    assert.ok(page.limitations.length >= 3, `${page.path}: limitations`)
    assert.equal(page.questions.length, 5, `${page.path}: questions`)
    assert.equal(new Set(page.questions.map((entry) => entry.question.trim().toLowerCase())).size, 5, `${page.path}: duplicate questions`)
    assert.ok(!('wordCount' in page), `${page.path}: word count is not a quality gate`)
    const signature = provenanceDigest({
      question: page.question,
      directAnswer: page.directAnswer,
      decisionRecord: page.decisionRecord,
      requiredInputs: page.requiredInputs,
      orderedSteps: page.orderedSteps,
    })
    assert.ok(!signatures.has(signature), `${page.path}: duplicate decision payload`)
    signatures.add(signature)
  }
  assert.equal(signatures.size, 407)
})

test('book concepts remain labelled lenses and are excluded from structured-data citations', () => {
  const bookLinks = pages.flatMap((page) => page.sourceLinks.filter((link) => link.path.startsWith('/books/')))
  assert.ok(bookLinks.length > 0)
  assert.ok(bookLinks.every((link) => link.role === 'conceptual-lens' || link.role === 'related-guide'))
  assert.ok(bookLinks.every((link) => link.role !== 'operational-source' && link.role !== 'inspected-source-projection'))
  assert.ok(pages.flatMap((page) => page.sourceLinks.filter((link) => link.role === 'conceptual-lens')).every((link) => link.path.startsWith('/books/')))
  const component = read('components/EpistemicClearingGuidePage.tsx')
  assert.match(component, /source\.role === 'operational-source' \|\| source\.role === 'inspected-source-projection'/)
  assert.doesNotMatch(component, /citation: guide\.sourceLinks\.map/)
})

test('every source link is an existing route, earlier prepared route, or explicit current public endpoint', () => {
  const currentPublicRoutes = new Set([
    ...(observation.sitemapPaths as string[]),
    ...batchOne.pages.map((page) => page.path),
    ...pages.map((page) => page.path),
    '/api/docs/openapi',
    '/knowledge/evidence-workflows',
    '/knowledge/integrations',
    '/knowledge/astrology/protocols',
    '/knowledge/religion/tamil-source-atlas',
    '/knowledge/religion/mayon',
    '/books/the-cosmic-recursion/read/the-boundary-that-holds',
  ])
  for (const page of pages) {
    for (const link of page.sourceLinks) {
      assert.ok(link.path.startsWith('/'), `${page.path}: external source link`)
      assert.ok(currentPublicRoutes.has(link.path), `${page.path}: unresolved link ${link.path}`)
    }
  }
})

test('all seven finite route modules and the three new parent hubs expose the prepared graph', () => {
  for (const path of [
    'app/developers/epistemic-clearing/[slug]/page.tsx',
    'app/knowledge/religion/clearing/[category]/[slug]/page.tsx',
    'app/knowledge/astrology/workflows/[category]/[slug]/page.tsx',
    'app/knowledge/epistemic-system/clearing/[slug]/page.tsx',
    'app/knowledge/mathematics/clearing/[slug]/page.tsx',
    'app/knowledge/astronomy/clearing/[slug]/page.tsx',
    'app/knowledge/integrations/epistemic-clearing/[slug]/page.tsx',
  ]) {
    assert.match(read(path), /dynamicParams = false/, path)
    assert.match(read(path), /generateStaticParams/, path)
  }
  assert.match(read('app/sitemap.ts'), /EPISTEMIC_CLEARING_PAGES\.map/)
  assert.match(read('lib/llms-manifest.ts'), /EPISTEMIC_CLEARING_PAGES\.map/)
  for (const path of [
    'app/knowledge/mathematics/page.tsx',
    'app/knowledge/astronomy/page.tsx',
    'app/knowledge/integrations/page.tsx',
  ]) assert.match(read(path), /clearingGuidesForLane/, path)
})

test('the preparation threshold is a projection and no build or deployment is authorized', () => {
  assert.equal(batch.deploymentGate.state, 'build-withheld')
  assert.equal(batch.deploymentGate.lastOperatorAuthorizedStaticPageCount, 993)
  assert.equal(batch.deploymentGate.priorPreparedRoutes, 100)
  assert.equal(batch.deploymentGate.thisBatchRoutes, 407)
  assert.equal(batch.deploymentGate.projectedPreparedSitePages, 1_500)
  assert.equal(batch.deploymentGate.exactBuildCountMeasured, false)
  assert.match(batch.deploymentGate.instruction, /do not run a Production or Vercel build/i)
  assert.match(batch.deploymentGate.instruction, /explicit operator approval/i)
  assert.ok(pages.every((page) => page.publicationState === 'prepared-not-deployed'))
  assert.match(batch.publicationBoundary, /not deployed.*indexed.*commercially validated/i)
})

test('all digests recompute and Batch 2 regenerates byte-identically', () => {
  assert.equal(batch.provenanceDigest, provenanceDigest(batch))
  for (const page of pages) assert.equal(page.provenanceDigest, provenanceDigest(page), page.path)

  const directory = mkdtempSync(join(tmpdir(), 'clearing-batch-2-'))
  const output = join(directory, 'batch.json')
  try {
    execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-epistemic-clearing-batch-2.ts', output], { cwd: ROOT, stdio: 'pipe' })
    assert.equal(readFileSync(output, 'utf8'), read('content/scaling/epistemic-clearing-batch-2.json'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the batch contains no credential, submission, private-path, or publishing-subdomain material', () => {
  const text = read('content/scaling/epistemic-clearing-batch-2.json')
  for (const pattern of [
    /\bBearer\s+\S{16,}/i,
    /\bsbp_[A-Za-z0-9]{16,}\b/,
    /\bsb_secret_[A-Za-z0-9]{16,}\b/,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
    /postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i,
    /\/Users\//,
    /"claimText"|"submittedExcerpt"|"reviewerId"|"authorityId"/,
    /publishing\.mahastrategies\.com/i,
    /publish\.mahastrategies\.com/i,
  ]) assert.doesNotMatch(text, pattern)
})
