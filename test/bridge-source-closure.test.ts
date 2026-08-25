import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { BRIDGE_SOURCE_LEDGER, ledgerEntry } from '../lib/bridge-source-ledger.ts'
import {
  ENDPOINT_DISPOSITIONS,
  DISPOSITIONS,
  dispositionTotals,
} from '../lib/bridge-endpoint-dispositions.ts'
import {
  ENDPOINT_CANDIDATES,
  candidateBlockers,
  promotableEndpointCandidates,
} from '../lib/bridge-endpoint-candidates.ts'
import { QUANTUM_BRIDGE_AUDIT, buildGapReport, promotionReadyBridges } from '../lib/quantum-bridge-audit-package.ts'
import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { resolveEpistemicReference, isResolvedOutcome } from '../lib/epistemic-reference-resolver.ts'
import { FRONTIER_CANARY_RECORDS, FRONTIER_CANARY_CONTROL_RECORDS } from '../lib/frontier-canonicalization.ts'

/* ---------------------------------------------------------------- ledger -- */

test('the ledger covers all 24 submitted citations exactly once', () => {
  assert.equal(BRIDGE_SOURCE_LEDGER.length, 24)
  assert.equal(new Set(BRIDGE_SOURCE_LEDGER.map((entry) => entry.key)).size, 24)
  for (const candidate of QUANTUM_BRIDGE_CANDIDATES) {
    for (const side of ['A', 'B'] as const) assert.ok(ledgerEntry(candidate.id, side))
  }
})

test('a verified entry carries a stable identifier, a source and a timestamp', () => {
  for (const entry of BRIDGE_SOURCE_LEDGER) {
    if (entry.verification === 'verified-correct' || entry.verification === 'verified-with-correction') {
      assert.ok(entry.identifier, `${entry.key} is verified without an identifier`)
      assert.ok(entry.verifiedAt, `${entry.key} is verified without a timestamp`)
      assert.ok(entry.verificationSource.length > 5, `${entry.key} has no verification source`)
      assert.ok(entry.rightsBasis.length > 3)
    }
  }
})

test('no locator was invented', () => {
  // Full text was not obtained in this sprint, so every locator must still be null.
  for (const entry of BRIDGE_SOURCE_LEDGER) {
    assert.equal(entry.locator, null, `${entry.key} carries a locator that was never verified`)
  }
})

test('an unverifiable citation is preserved and never silently replaced', () => {
  const unverifiable = BRIDGE_SOURCE_LEDGER.filter((entry) => entry.verification === 'unverifiable')
  assert.ok(unverifiable.length >= 3)
  for (const entry of unverifiable) {
    assert.equal(entry.identifier, null, `${entry.key} cannot be unverifiable and carry an identifier`)
    assert.ok((entry.correction ?? '').length > 60, `${entry.key} must record what was searched`)
    if (entry.suggestedRevision) {
      assert.equal(entry.suggestedRevision.decision, 'pending-human-decision')
      assert.ok(entry.suggestedRevision.rationale.length > 40)
    }
  }
})

test('the Q-BR-011 citation is never given a substitute', () => {
  const entry = ledgerEntry('Q-BR-011', 'B')
  assert.equal(entry.verification, 'unverifiable')
  assert.equal(entry.suggestedRevision, undefined, 'Q-BR-011 must not carry a proposed replacement')
})

test('a correction records the submitted metadata alongside the finding', () => {
  const corrected = BRIDGE_SOURCE_LEDGER.filter((entry) => entry.verification === 'verified-with-correction')
  assert.ok(corrected.length >= 4)
  for (const entry of corrected) {
    assert.match(entry.correction ?? '', /[Ss]ubmitted/, `${entry.key} does not quote the submitted metadata`)
  }
})

/* ---------------------------------------------------------- dispositions -- */

test('all 23 unresolved endpoints carry exactly one disposition', () => {
  assert.equal(ENDPOINT_DISPOSITIONS.length, 23)
  for (const entry of ENDPOINT_DISPOSITIONS) {
    assert.ok(DISPOSITIONS.includes(entry.disposition))
    assert.ok(entry.rationale.length > 60, `${entry.key} has no substantive rationale`)
  }
  const totals = dispositionTotals()
  assert.equal(Object.values(totals).reduce((sum, count) => sum + count, 0), 23)
})

test('an alias is only used for semantic equivalence, never for a similar topic', () => {
  // No endpoint met the equivalence bar in this sprint; near-misses are REVISE.
  assert.equal(dispositionTotals().MAP_TO_EXISTING_RECORD_WITH_EXPLICIT_ALIAS, 0)
  for (const entry of ENDPOINT_DISPOSITIONS) {
    if (entry.disposition === 'REVISE_REFERENCE') {
      assert.ok(entry.suggestedExistingRecords?.length, `${entry.key} revises to nothing`)
    }
  }
})

test('every disposition key matches a genuinely unresolved endpoint', () => {
  for (const entry of ENDPOINT_DISPOSITIONS) {
    const result = resolveEpistemicReference(entry.submittedReference)
    assert.equal(
      isResolvedOutcome(result.outcome),
      false,
      `${entry.key} is dispositioned but already resolves`,
    )
  }
})

/* ------------------------------------------------------------ candidates -- */

test('the sprint creates at most eight endpoint candidates', () => {
  assert.ok(ENDPOINT_CANDIDATES.length <= 8)
  assert.equal(new Set(ENDPOINT_CANDIDATES.map((candidate) => candidate.id)).size, ENDPOINT_CANDIDATES.length)
})

test('every candidate is noncanonical, draft, internally reviewed and noindex', () => {
  for (const candidate of ENDPOINT_CANDIDATES) {
    assert.equal(candidate.canonical, false)
    assert.equal(candidate.noindex, true)
    assert.equal(candidate.reviewState, 'draft')
    assert.equal(candidate.reviewerKind, 'internal-editorial')
    assert.equal(candidate.requestedPublicPromotion, false)
  }
})

test('no candidate enters the canonical resolver pool', () => {
  const canonicalIds = new Set(EPISTEMIC_RECORDS.map((record) => record.id))
  for (const candidate of ENDPOINT_CANDIDATES) {
    assert.ok(!canonicalIds.has(candidate.id), `${candidate.id} leaked into the canonical corpus`)
    // And the resolver must still not resolve its slug.
    const result = resolveEpistemicReference(`${candidate.domainSlug}:${candidate.slug}`)
    assert.equal(isResolvedOutcome(result.outcome), false, `${candidate.id} became resolvable`)
  }
})

test('a candidate without an exact locator cannot be promoted', () => {
  for (const candidate of ENDPOINT_CANDIDATES) {
    assert.ok(candidateBlockers(candidate).includes('source-missing-locator'))
  }
  assert.deepEqual([...promotableEndpointCandidates()], [])
})

test('every candidate carries scope, uncertainty, prohibited inferences and a digest', () => {
  for (const candidate of ENDPOINT_CANDIDATES) {
    assert.ok(candidate.definition.length > 80, `${candidate.id} has no bounded definition`)
    assert.ok(candidate.scope.length > 40)
    assert.ok(candidate.uncertainty.length > 40)
    assert.ok(candidate.prohibitedInferences.length >= 2)
    assert.ok(candidate.independentJustification.length > 60)
    assert.match(candidate.provenanceDigest, /^sha256:[a-f0-9]{64}$/)
    for (const source of candidate.sources) assert.ok(source.identifier, 'candidate source lacks an identifier')
  }
  assert.equal(
    new Set(ENDPOINT_CANDIDATES.map((candidate) => candidate.provenanceDigest)).size,
    ENDPOINT_CANDIDATES.length,
  )
})

/* ------------------------------------------------------- regenerated gate -- */

test('no bridge moved off BLOCK in this sprint', () => {
  const report = buildGapReport()
  assert.equal(report.verdictTotals.BLOCK, 12)
  assert.equal(Object.keys(report.verdictTotals).length, 1)
  assert.deepEqual([...promotionReadyBridges()], [])
})

test('every bridge still carries a locator blocker, so none can reach REVISE', () => {
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    assert.ok(
      bridge.blockerCodes.includes('source-missing-locator'),
      `${bridge.id} lost its locator blocker without a verified locator`,
    )
  }
})

test('closing citations reduced identifier and rights blockers but not locator blockers', () => {
  const report = buildGapReport()
  assert.ok((report.blockerTotals['source-missing-identifier'] ?? 0) <= 5)
  assert.ok((report.blockerTotals['rights-basis-unverified'] ?? 0) <= 4)
  assert.equal(report.blockerTotals['source-missing-locator'], 12)
  assert.ok((report.blockerTotals['source-unverifiable'] ?? 0) >= 4)
})

/* --------------------------------------------------------------- safety -- */

test('nothing from this sprint is publicly reachable', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /bridge-endpoint-candidates|bridge-source-ledger|Q-BR-/)
  }
  for (const candidate of ENDPOINT_CANDIDATES) {
    for (const source of [sitemap, llms]) assert.ok(!source.includes(candidate.slug))
  }
})

test('the frontier canary cohort is untouched', () => {
  assert.equal(FRONTIER_CANARY_RECORDS.length, 40)
  assert.equal(FRONTIER_CANARY_CONTROL_RECORDS.length, 200)
})
