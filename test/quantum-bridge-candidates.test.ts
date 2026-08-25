import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  BRIDGE_SPECIFICATION_VERSION,
  CANDIDATE_CLASSIFICATIONS,
  QUANTUM_BRIDGE_CANDIDATES as CANDIDATES,
  QUANTUM_BRIDGE_BATCH_DIGEST,
  batchDigest,
  candidateSha256,
  projectCandidateClassification,
} from '../lib/quantum-bridge-candidates.ts'
import { EPISTEMIC_SCHEMA_VERSION } from '../lib/epistemic-schema.ts'
import { FRONTIER_CANARY_RECORDS, FRONTIER_CANARY_CONTROL_RECORDS } from '../lib/frontier-canonicalization.ts'
import { QUANTUM_SYSTEMS_GRAPH_RECORDS } from '../lib/quantum-systems-graph.ts'
import { SYNTHETIC_BIOLOGY_GRAPH_RECORDS } from '../lib/synthetic-biology-graph.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import { PUBLIC_EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'

const CORPUS = [
  ...QUANTUM_SYSTEMS_GRAPH_RECORDS,
  ...SYNTHETIC_BIOLOGY_GRAPH_RECORDS,
  ...FRONTIER_DOMAIN_GRAPH_RECORDS,
  ...PUBLIC_EPISTEMIC_RECORDS,
]
const CORPUS_IDS = new Set(CORPUS.map((record) => record.id))

/* ------------------------------------------------------------- identity -- */

test('the batch is exactly the twelve proposed identifiers, ordered and unique', () => {
  assert.equal(CANDIDATES.length, 12)
  const ids = CANDIDATES.map((candidate) => candidate.id)
  assert.equal(new Set(ids).size, 12, 'duplicate Q-BR identifier')
  assert.deepEqual(
    ids,
    Array.from({ length: 12 }, (_, index) => `Q-BR-${String(index + 1).padStart(3, '0')}`),
  )
})

test('the bridge specification version is additive, not a schema replacement', () => {
  assert.equal(BRIDGE_SPECIFICATION_VERSION, 'mps-bridge/1.0')
  // The proposal asked for the top-level schemaVersion to become mps-bridge/1.0.
  // The epistemic schema version must be untouched.
  assert.equal(EPISTEMIC_SCHEMA_VERSION, 'maha-epistemic/1.0')
})

test('the four proposed classifications are preserved verbatim', () => {
  assert.deepEqual([...CANDIDATE_CLASSIFICATIONS], [
    'EXACT_DEPENDENCY',
    'SHARED_FORMALISM',
    'COMPUTATIONAL_CANDIDATE',
    'STRUCTURAL_ANALOGY',
  ])
  for (const candidate of CANDIDATES) {
    assert.ok(CANDIDATE_CLASSIFICATIONS.includes(candidate.classification))
  }
})

/* --------------------------------------------------------- projection --- */

test('classifications that cannot map without losing meaning fail explicitly', () => {
  assert.deepEqual(projectCandidateClassification('STRUCTURAL_ANALOGY'), {
    mappable: true,
    bridgeType: 'structural-analogy',
  })
  assert.deepEqual(projectCandidateClassification('EXACT_DEPENDENCY'), {
    mappable: true,
    bridgeType: 'mechanistic-dependency',
  })
  for (const classification of ['SHARED_FORMALISM', 'COMPUTATIONAL_CANDIDATE'] as const) {
    const projection = projectCandidateClassification(classification)
    assert.equal(projection.mappable, false, `${classification} must not be silently coerced`)
    assert.ok('reason' in projection && projection.reason.length > 40)
  }
})

test('no candidate is coerced onto mathematical-equivalence', () => {
  for (const classification of CANDIDATE_CLASSIFICATIONS) {
    const projection = projectCandidateClassification(classification)
    if (projection.mappable) assert.notEqual(projection.bridgeType, 'mathematical-equivalence')
  }
})

/* -------------------------------------------------------- reference gate -- */

test('every source and target resolves, or the candidate is blocked', () => {
  for (const candidate of CANDIDATES) {
    const resolved =
      candidate.sourceResolution.status === 'resolved' && candidate.targetResolution.status === 'resolved'
    if (!resolved) {
      assert.equal(candidate.verdict, 'BLOCK', `${candidate.id} has an unresolved reference but is not blocked`)
    }
  }
})

test('a resolution claiming to be resolved names a record that exists', () => {
  for (const candidate of CANDIDATES) {
    for (const resolution of [candidate.sourceResolution, candidate.targetResolution]) {
      if (resolution.status === 'resolved') {
        assert.ok(CORPUS_IDS.has(resolution.recordId), `${candidate.id} resolves to a non-existent record`)
      }
    }
  }
})

test('nearest-slug suggestions are never substituted for the declared reference', () => {
  for (const candidate of CANDIDATES) {
    assert.match(candidate.declaredSourceRef, /^[a-z-]+:[a-z0-9-]+$/)
    assert.match(candidate.declaredTargetRef, /^[a-z-]+:[a-z0-9-]+$/)
  }
  // Q-BR-006 only resolves after a domain-slug correction, which must be recorded.
  const six = CANDIDATES.find((candidate) => candidate.id === 'Q-BR-006')!
  assert.equal(six.declaredTargetRef, 'fusion-plasma:rebco-high-field-magnets')
  assert.ok(six.wordingCorrections.some((note) => /fusion-plasma-systems/.test(note)))
})

/* ------------------------------------------------------------- sourcing -- */

test('every cited source carries an authoritative identifier and exact locator, or the candidate is blocked', () => {
  for (const candidate of CANDIDATES) {
    const complete = candidate.sources.every((source) => source.identifier && source.locator)
    if (!complete) {
      assert.equal(candidate.verdict, 'BLOCK', `${candidate.id} has an incomplete source but is not blocked`)
    }
  }
})

test('an unverifiable source blocks its candidate and is never replaced', () => {
  for (const candidate of CANDIDATES) {
    if (candidate.sources.some((source) => source.verification === 'unverifiable')) {
      assert.equal(candidate.verdict, 'BLOCK')
    }
  }
  const eleven = CANDIDATES.find((candidate) => candidate.id === 'Q-BR-011')!
  const hou = eleven.sources.find((source) => source.side === 'B')!
  assert.equal(hou.verification, 'unverifiable')
  assert.match(hou.rejectedAssertion ?? '', /DBLP/)
  assert.match(eleven.prohibitedInferences.join(' '), /substitute/i)
})

test('a failed source assertion is preserved rather than overwritten', () => {
  const withRejections = CANDIDATES.filter((candidate) =>
    candidate.sources.some((source) => source.rejectedAssertion),
  )
  assert.ok(withRejections.length >= 6, 'rejected assertions were lost')
  for (const candidate of withRejections) {
    for (const source of candidate.sources) {
      if (source.rejectedAssertion) assert.ok(source.rejectedAssertion.length > 40)
    }
  }
})

test('a corrected citation records what was wrong', () => {
  const corrected = CANDIDATES.flatMap((candidate) => candidate.sources).filter(
    (source) => source.verification === 'verified-with-correction',
  )
  assert.ok(corrected.length >= 2)
  for (const source of corrected) assert.ok((source.correction ?? '').length > 40)
})

/* ------------------------------------------------------- claim strength -- */

test('structural analogies carry an explicit non-equivalence warning', () => {
  for (const candidate of CANDIDATES.filter((c) => c.classification === 'STRUCTURAL_ANALOGY')) {
    assert.match(
      `${candidate.doesNotEstablish} ${candidate.prohibitedInferences.join(' ')}`,
      /no formal|not.*equivalen|any formal mathematical equivalence/i,
      `${candidate.id} lacks a non-equivalence warning`,
    )
  }
})

test('computational candidates make no speedup or necessity claim', () => {
  const speedup = /\b(speedup|faster than|outperforms|advantage over|exponentially faster)\b/i
  const necessity = /\b(is required|must be used|only way|cannot be done without)\b/i
  for (const candidate of CANDIDATES.filter((c) => c.classification === 'COMPUTATIONAL_CANDIDATE')) {
    assert.doesNotMatch(candidate.establishes, speedup, `${candidate.id} claims a speedup`)
    assert.doesNotMatch(candidate.establishes, necessity, `${candidate.id} claims necessity`)
    assert.match(
      candidate.doesNotEstablish,
      /speedup|outperforms|advantage/i,
      `${candidate.id} must explicitly disclaim advantage`,
    )
  }
})

test('shared-formalism records cannot claim equivalence without a formal mapping', () => {
  const equivalence = /\b(isomorphic|isomorphically|identical formalism|identical linear algebra|equivalent to)\b/i
  for (const candidate of CANDIDATES.filter((c) => c.classification === 'SHARED_FORMALISM')) {
    assert.doesNotMatch(candidate.establishes, equivalence, `${candidate.id} asserts equivalence`)
  }
})

test('exact dependencies cannot use unscoped universal wording', () => {
  const universal = /\bcannot operate without\b|\bnon-substitutable\b/i
  for (const candidate of CANDIDATES.filter((c) => c.classification === 'EXACT_DEPENDENCY')) {
    assert.doesNotMatch(
      candidate.establishes,
      universal,
      `${candidate.id} uses universal dependency wording in its establishes statement`,
    )
  }
})

/* ------------------------------------------------------------ isolation -- */

test('no candidate is publication-ready or enqueueable', () => {
  for (const candidate of CANDIDATES) {
    assert.equal(candidate.requestedPublicPromotion, false)
    assert.equal(candidate.reviewState, 'draft')
    assert.equal(candidate.noindex, true)
    assert.equal(candidate.canonical, false)
  }
})

test('blocked records cannot enter a publication-ready queue', () => {
  const publicationReady = CANDIDATES.filter(
    (candidate) => candidate.verdict !== 'BLOCK' && candidate.requestedPublicPromotion,
  )
  assert.deepEqual(publicationReady, [])
})

test('no candidate reaches a public route, sitemap, or llms.txt', () => {
  const appRoot = new URL('../app', import.meta.url).pathname
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    })
  const routeSources = walk(appRoot)
    .filter((path) => /\.(tsx|ts)$/.test(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n')
  for (const candidate of CANDIDATES) {
    assert.ok(
      !routeSources.includes(candidate.id),
      `${candidate.id} is referenced from a route and could become crawlable`,
    )
  }
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /quantum-bridge-candidates|Q-BR-/)
  }
})

/* -------------------------------------------------------------- digests -- */

test('candidate and batch digests are stable and distinct', () => {
  const digests = CANDIDATES.map(candidateSha256)
  assert.equal(new Set(digests).size, 12, 'two candidates share a digest')
  for (const digest of digests) assert.match(digest, /^sha256:[a-f0-9]{64}$/)
  assert.equal(batchDigest(CANDIDATES), QUANTUM_BRIDGE_BATCH_DIGEST)
  // The digest must actually depend on audited content.
  const mutated = [{ ...CANDIDATES[0], establishes: `${CANDIDATES[0].establishes} extra` }, ...CANDIDATES.slice(1)]
  assert.notEqual(batchDigest(mutated), QUANTUM_BRIDGE_BATCH_DIGEST)
})

/* --------------------------------------------------- canary untouched --- */

test('the frontier canary cohort is unchanged by this batch', () => {
  assert.equal(FRONTIER_CANARY_RECORDS.length, 40)
  assert.equal(FRONTIER_CANARY_CONTROL_RECORDS.length, 200)
  const canaryIds = new Set(FRONTIER_CANARY_RECORDS.map((record) => record.id))
  for (const candidate of CANDIDATES) {
    for (const resolution of [candidate.sourceResolution, candidate.targetResolution]) {
      if (resolution.status === 'resolved') {
        assert.ok(
          !canaryIds.has(resolution.recordId),
          `${candidate.id} attaches to a canonical canary record`,
        )
      }
    }
  }
})
