import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import batch from '../content/scaling/epistemic-clearing-batch-1.json' with { type: 'json' }
import candidates from '../content/scaling/epistemic-clearing-route-candidates-v1.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'

const ROOT = resolve(import.meta.dirname, '..')
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8')
const pages = batch.pages

test('Batch 1 prepares exactly 100 unique candidate routes and 500 bounded answers', () => {
  assert.deepEqual(batch.counts, {
    total: 100,
    bookConceptMachineApplications: 40,
    tamilReligion: 30,
    astrologyInfrastructure: 20,
    evidenceClearing: 10,
    boundedQuestions: 500,
  })
  assert.equal(pages.length, 100)
  assert.equal(new Set(pages.map((page) => page.path)).size, 100)
  assert.equal(pages.reduce((sum, page) => sum + page.questions.length, 0), 500)
  assert.deepEqual(
    Object.fromEntries(['machine-integrations', 'tamil-religion', 'astrology-infrastructure', 'evidence-clearing'].map((lane) => [lane, pages.filter((page) => page.lane === lane).length])),
    { 'machine-integrations': 40, 'tamil-religion': 30, 'astrology-infrastructure': 20, 'evidence-clearing': 10 },
  )
})

test('every page remains bound to a scored candidate and avoids the observed public surface', () => {
  const candidateById = new Map(candidates.candidates.map((candidate) => [candidate.candidateId, candidate]))
  const observed = new Set(observation.sitemapPaths as string[])
  for (const page of pages) {
    const source = candidateById.get(page.candidateId)
    assert.ok(source, page.candidateId)
    assert.equal(page.path, source.proposedPath)
    assert.equal(page.candidateRank, source.rank)
    assert.equal(page.lane, source.lane)
    assert.ok(!observed.has(page.path), `observed route reused: ${page.path}`)
    assert.match(page.path, /^\/[a-z0-9/-]+$/)
  }
})

test('every guide meets the bounded procedural depth floor without using word count', () => {
  for (const page of pages) {
    assert.ok(page.requiredInputs.length >= 4, `${page.path}: inputs`)
    assert.ok(page.orderedSteps.length >= 5, `${page.path}: steps`)
    assert.ok(page.expectedOutputs.length >= 3, `${page.path}: outputs`)
    assert.ok(page.refusalConditions.length >= 3, `${page.path}: refusals`)
    assert.ok(page.limitations.length >= 3, `${page.path}: limitations`)
    assert.equal(page.questions.length, 5, `${page.path}: questions`)
    assert.equal(new Set(page.questions.map((entry) => entry.question.trim().toLowerCase())).size, 5, `${page.path}: duplicate question`)
    assert.ok(page.sourceLinks.length > 0, `${page.path}: sources`)
    assert.ok(page.sourceLinks.every((link) => link.path.startsWith('/')), `${page.path}: internal source path`)
    assert.ok(!('wordCount' in page), `${page.path}: word count is not a quality gate`)
  }
})

test('book concepts frame machine applications without becoming their technical evidence', () => {
  const machine = pages.filter((page) => page.lane === 'machine-integrations')
  assert.equal(machine.length, 40)
  assert.ok(machine.every((page) => page.sourceLinks.some((link) => link.role === 'operational-source')))
  assert.ok(machine.every((page) => page.sourceLinks.some((link) => link.role === 'conceptual-lens')))
  assert.ok(machine.every((page) => page.limitations.some((limit) => /conceptual lens only/i.test(limit))))
  assert.equal(machine.filter((page) => page.sourceLinks.some((link) => link.path.includes('/books/the-maha-principle/'))).length, 37)
})

test('Tamil and astrology guides preserve their epistemic boundaries', () => {
  for (const page of pages.filter((entry) => entry.lane === 'tamil-religion')) {
    for (const frame of ['primary text', 'translation', 'commentary', 'historical inference', 'theology']) {
      assert.match(page.summary.toLowerCase(), new RegExp(frame), `${page.path}: ${frame}`)
    }
    assert.ok(page.limitations.some((limit) => /does not adjudicate metaphysical truth/i.test(limit)))
  }
  for (const page of pages.filter((entry) => entry.lane === 'astrology-infrastructure')) {
    assert.ok(page.limitations.some((limit) => /does not validate an astrological interpretation or prediction/i.test(limit)))
    assert.ok(page.limitations.some((limit) => /no missing number.*invented/i.test(limit)))
  }
})

test('evidence-clearing guides distinguish preflight structure from verified evidence', () => {
  const evidence = pages.filter((page) => page.lane === 'evidence-clearing')
  assert.equal(evidence.length, 10)
  assert.ok(evidence.every((page) => page.limitations.some((limit) => /not a verified Evidence Dossier/i.test(limit))))
  assert.ok(evidence.every((page) => page.limitations.some((limit) => /metadata or identifier resolves/i.test(limit))))
})

test('deployment remains withheld until the 1,500-page threshold', () => {
  assert.equal(batch.deploymentGate.state, 'build-withheld')
  assert.equal(batch.deploymentGate.minimumPreparedSitePages, 1500)
  assert.match(batch.deploymentGate.instruction, /Do not run a Production or Vercel build/)
  assert.match(batch.deploymentGate.instruction, /1,500 pages/)
  assert.match(batch.deploymentGate.instruction, /explicit operator approval/)
  assert.ok(pages.every((page) => page.publicationState === 'prepared-not-deployed'))
  assert.ok(pages.every((page) => page.canonicalRecordRequired === false))
  assert.match(batch.publicationBoundary, /not deployed/i)
})

test('route modules are finite and discovery surfaces index the complete batch', () => {
  for (const path of [
    'app/developers/epistemic-clearing/[slug]/page.tsx',
    'app/knowledge/religion/clearing/[category]/[slug]/page.tsx',
    'app/knowledge/astrology/workflows/[category]/[slug]/page.tsx',
    'app/knowledge/epistemic-system/clearing/[slug]/page.tsx',
  ]) {
    assert.match(read(path), /dynamicParams = false/, path)
    assert.match(read(path), /generateStaticParams/, path)
  }
  assert.match(read('app/sitemap.ts'), /EPISTEMIC_CLEARING_PAGES\.map/)
  assert.match(read('lib/llms-manifest.ts'), /EPISTEMIC_CLEARING_PAGES\.map/)
  for (const path of [
    'app/developers/page.tsx',
    'app/knowledge/religion/page.tsx',
    'app/knowledge/astrology/page.tsx',
    'app/knowledge/epistemic-system/page.tsx',
  ]) assert.match(read(path), /clearingGuidesForLane/, path)
})

test('all page and batch digests recompute and regeneration is byte-identical', () => {
  assert.equal(batch.provenanceDigest, provenanceDigest(batch))
  for (const page of pages) assert.equal(page.provenanceDigest, provenanceDigest(page), page.path)

  const directory = mkdtempSync(join(tmpdir(), 'clearing-batch-1-'))
  const output = join(directory, 'batch.json')
  try {
    execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-epistemic-clearing-batch-1.ts', output], { cwd: ROOT, stdio: 'pipe' })
    assert.equal(readFileSync(output, 'utf8'), read('content/scaling/epistemic-clearing-batch-1.json'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the batch artifact contains no credential, submission, or local-path material', () => {
  const text = read('content/scaling/epistemic-clearing-batch-1.json')
  for (const pattern of [
    /\bBearer\s+\S{16,}/i,
    /\bsbp_[A-Za-z0-9]{16,}\b/,
    /\bsb_secret_[A-Za-z0-9]{16,}\b/,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
    /postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i,
    /\/Users\//,
    /"claimText"|"submittedExcerpt"|"reviewerId"|"authorityId"/,
  ]) assert.doesNotMatch(text, pattern)
})
