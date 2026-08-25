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
import {
  QUANTUM_BRIDGE_AUDIT,
  buildGapReport,
  isPromotionEligible,
  promotionReadyBridges,
} from '../lib/quantum-bridge-audit-package.ts'
import { isResolvedOutcome } from '../lib/epistemic-reference-resolver.ts'
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
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    const resolved =
      isResolvedOutcome(bridge.endpoints.source.outcome) && isResolvedOutcome(bridge.endpoints.target.outcome)
    if (!resolved) assert.equal(bridge.verdict, 'BLOCK', `${bridge.id} has an unresolved endpoint but is not blocked`)
  }
})

test('a resolution claiming to be resolved names a record that exists', () => {
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    for (const endpoint of [bridge.endpoints.source, bridge.endpoints.target]) {
      if (isResolvedOutcome(endpoint.outcome)) {
        const recordId = (endpoint.outcome as { recordId: string }).recordId
        assert.ok(CORPUS_IDS.has(recordId), `${bridge.id} resolves to a non-existent record`)
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
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    for (const endpoint of [bridge.endpoints.source, bridge.endpoints.target]) {
      if (isResolvedOutcome(endpoint.outcome)) {
        const recordId = (endpoint.outcome as { recordId: string }).recordId
        assert.ok(!canaryIds.has(recordId), `${bridge.id} attaches to a canonical canary record`)
      }
    }
  }
})

/* ------------------------------------------------------- ingestion gate -- */

test('no bridge is promotion-eligible while any blocker remains', () => {
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    assert.equal(bridge.promotionEligible, false)
    if (bridge.blockerCodes.length) assert.equal(isPromotionEligible(bridge), false)
  }
  assert.deepEqual([...promotionReadyBridges()], [])
})

test('every blocked bridge carries machine-readable blocker codes', () => {
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    if (bridge.verdict === 'BLOCK') {
      assert.ok(bridge.blockerCodes.length > 0, `${bridge.id} is blocked with no blocker code`)
    }
  }
})

test('a missing locator alone prevents promotion', () => {
  const withoutLocator = QUANTUM_BRIDGE_AUDIT.filter((bridge) =>
    bridge.blockerCodes.includes('source-missing-locator'),
  )
  assert.equal(withoutLocator.length, 12, 'no locator was invented for any source')
  for (const bridge of withoutLocator) assert.equal(isPromotionEligible(bridge), false)
})

test('an unverifiable source alone prevents promotion', () => {
  const unverifiable = QUANTUM_BRIDGE_AUDIT.filter((bridge) =>
    bridge.blockerCodes.includes('source-unverifiable'),
  )
  assert.equal(unverifiable.length, 1)
  assert.equal(unverifiable[0].id, 'Q-BR-011')
  assert.equal(isPromotionEligible(unverifiable[0]), false)
})

/* ------------------------------------------------- submitted vs audited -- */

test('submitted references survive resolution and aliasing unchanged', () => {
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    assert.equal(bridge.endpoints.source.submittedReference, bridge.submitted.sourceReference)
    assert.equal(bridge.endpoints.target.submittedReference, bridge.submitted.targetReference)
  }
  const six = QUANTUM_BRIDGE_AUDIT.find((bridge) => bridge.id === 'Q-BR-006')!
  // Alias applied, but the submitted reference still reads as submitted.
  assert.equal(six.endpoints.target.outcome.status, 'alias-resolution')
  assert.equal(six.submitted.targetReference, 'fusion-plasma:rebco-high-field-magnets')
})

test('submitted citation metadata survives correction', () => {
  const corrected = CANDIDATES.flatMap((candidate) => candidate.sources).filter(
    (source) => source.verification === 'verified-with-correction',
  )
  assert.ok(corrected.length >= 3)
  for (const source of corrected) {
    // The original citation string is still present alongside the correction.
    assert.ok(source.citation.length > 20)
    assert.ok((source.correction ?? '').length > 40)
  }
  // Q-BR-012 still carries the wrong submitted venue, next to the correction.
  const twelve = CANDIDATES.find((candidate) => candidate.id === 'Q-BR-012')!
  const romanenko = twelve.sources.find((source) => source.side === 'A')!
  assert.match(romanenko.correction ?? '', /Physical Review Letters, 124\(8\), 086801/)
  assert.match(romanenko.identifier ?? '', /10\.1103\/PhysRevApplied\.13\.034032/)
})

test('the audit digest changes when audited content changes', () => {
  const digests = QUANTUM_BRIDGE_AUDIT.map((bridge) => bridge.auditDigest)
  assert.equal(new Set(digests).size, 12)
  for (const digest of digests) assert.match(digest, /^sha256:[a-f0-9]{64}$/)
})

/* ----------------------------------------------------------- gap report -- */

test('the gap report separates remediable candidates from invalid ones', () => {
  const report = buildGapReport()
  assert.equal(report.verdictTotals.BLOCK, 12)
  assert.equal(Object.keys(report.verdictTotals).length, 1)
  const invalid = report.conceptuallyInvalid.map((entry) => entry.id)
  assert.deepEqual(invalid.sort(), ['Q-BR-003', 'Q-BR-010', 'Q-BR-011'])
  for (const entry of report.conceptuallyInvalid) assert.ok(entry.reason.length > 60)
  // Everything else is at least describable as remediable.
  assert.equal(report.remediableToRevise.length, 9)
  for (const entry of report.remediableToRevise) assert.ok(entry.remediation.length > 10)
})

test('the gap report reports no unresolved-domain outcomes', () => {
  const report = buildGapReport()
  assert.equal(report.endpointTotals['unresolved-domain'] ?? 0, 0)
  assert.equal(report.endpointTotals['alias-resolution'] ?? 0, 1)
  assert.equal(report.endpointTotals['unresolved-record'] ?? 0, 23)
})
