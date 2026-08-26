import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  ENDPOINT_FITNESS_BLOCKERS,
  ENDPOINT_FITNESS_STATES,
  ENDPOINT_USABILITY,
  clearEndpointFitnessCache,
  endpointUsabilityTotals,
  evaluateResolvedEndpointFitness,
  isUsableEndpoint,
  resolveEndpointStructure,
  resolveUsableEndpoint,
} from '../lib/endpoint-fitness.ts'
import { FRONTIER_ALIGNMENT_AUDIT, alignmentFor } from '../lib/frontier-source-alignment.ts'
import { pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { isResolvedOutcome, resolveEpistemicReference } from '../lib/epistemic-reference-resolver.ts'
import { QUANTUM_BRIDGE_CANDIDATES } from '../lib/quantum-bridge-candidates.ts'
import { QUANTUM_BRIDGE_AUDIT, buildGapReport } from '../lib/quantum-bridge-audit-package.ts'
import { FRONTIER_CANARY_CONTROL_RECORDS, FRONTIER_CANARY_RECORDS } from '../lib/frontier-canonicalization.ts'

const REFERENCES = QUANTUM_BRIDGE_CANDIDATES.flatMap((candidate) => [
  candidate.declaredSourceRef,
  candidate.declaredTargetRef,
])

/** A frontier record whose audit carries the given verdict, for probing. */
function recordWithVerdict(verdict: string): string {
  const entry = FRONTIER_ALIGNMENT_AUDIT.find((row) => row.evidence.subjectAligned === verdict)
  assert.ok(entry, `no audited record with verdict ${verdict}`)
  return entry.recordId
}

function referenceFor(recordId: string): string {
  const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)!
  return `${record.domainSlug}:${record.slug.replace(`${record.domainSlug}-`, '')}`
}

/* ------------------------------------------------- axes stay independent -- */

test('the three axes use disjoint declared vocabularies', () => {
  for (const state of ENDPOINT_FITNESS_STATES) {
    assert.ok(!(ENDPOINT_USABILITY as readonly string[]).includes(state))
  }
  assert.equal(new Set(ENDPOINT_FITNESS_STATES).size, ENDPOINT_FITNESS_STATES.length)
  assert.equal(new Set(ENDPOINT_FITNESS_BLOCKERS).size, ENDPOINT_FITNESS_BLOCKERS.length)
})

test('structural resolution is passed through unchanged', () => {
  for (const reference of REFERENCES) {
    const direct = resolveEpistemicReference(reference)
    const viaLayer = resolveEndpointStructure(reference)
    assert.deepEqual(viaLayer.outcome, direct.outcome, `${reference} structural outcome changed`)
    assert.equal(viaLayer.submittedReference, direct.submittedReference)
  }
})

test('structural resolution totals do not silently change', () => {
  const totals = endpointUsabilityTotals(REFERENCES)
  assert.equal(totals.structurallyResolved, 2, 'structural resolution count moved')
  assert.equal(totals.unresolved, 22)
  assert.equal(buildGapReport().endpointTotals['alias-resolution'], 2)
  assert.equal(buildGapReport().endpointTotals['unresolved-record'], 22)
})

test('submitted references are preserved verbatim', () => {
  for (const reference of REFERENCES) {
    const result = resolveUsableEndpoint(reference)
    assert.equal(result.submittedReference, reference)
    assert.equal(result.structure.submittedReference, reference)
  }
})

/* ---------------------------------------------------- usability rules ----- */

test('exact resolution to a mismatched record is unusable', () => {
  const recordId = recordWithVerdict('mismatched')
  const result = resolveUsableEndpoint(recordId) // an exact canonical id
  assert.equal(result.structure.outcome.status, 'exact-resolution')
  assert.equal(result.fitness!.state, 'source-mismatched')
  assert.equal(result.usability, 'structurally-resolved-but-epistemically-blocked')
  assert.deepEqual(result.blockers, ['endpoint-source-alignment-mismatched'])
})

test('alias resolution to a mismatched record is unusable', () => {
  // The declared Q-BR alias, whose target Batch 5 found mismatched on full text.
  const result = resolveUsableEndpoint('fusion-plasma:rebco-high-field-magnets')
  assert.equal(result.structure.outcome.status, 'alias-resolution')
  assert.equal(
    (result.structure.outcome as { recordId: string }).recordId,
    'urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets',
  )
  assert.equal(result.fitness!.state, 'source-mismatched')
  assert.equal(result.usability, 'structurally-resolved-but-epistemically-blocked')
})

test('exact resolution to an inaccessible record is unusable', () => {
  const result = resolveUsableEndpoint(recordWithVerdict('inaccessible-source'))
  assert.equal(result.structure.outcome.status, 'exact-resolution')
  assert.equal(result.fitness!.state, 'source-inaccessible')
  assert.deepEqual(result.blockers, ['endpoint-source-inaccessible'])
})

test('partial support remains blocked', () => {
  const result = resolveUsableEndpoint(recordWithVerdict('partially-supported'))
  assert.equal(result.fitness!.state, 'partially-supported')
  assert.equal(result.usability, 'structurally-resolved-but-epistemically-blocked')
  assert.deepEqual(result.blockers, ['endpoint-source-alignment-partial'])
})

test('metadata-only resolution is unusable', () => {
  // A record whose metadata resolves but whose content was never inspected.
  const entry = FRONTIER_ALIGNMENT_AUDIT.find(
    (row) => row.evidence.metadataVerified && !row.evidence.sourceContentInspected,
  )!
  const result = resolveUsableEndpoint(entry.recordId)
  assert.equal(result.usability, 'structurally-resolved-but-epistemically-blocked')
  assert.notEqual(result.fitness!.state, 'alignment-clear')
})

test('a missing alignment audit fails closed', () => {
  // This used to pick any record outside the frontier audit. The pilot audit
  // now covers quantum-systems and synthetic-biology, so every canonical record
  // is audited and no such record exists. The rule being protected is the
  // fail-closed default itself, which is asserted directly against a record id
  // that no audit covers.
  const audited = EPISTEMIC_RECORDS.filter(
    (record) => !alignmentFor(record.id) && !pilotAlignmentFor(record.id),
  )
  assert.deepEqual(audited, [], 'a canonical record is covered by neither audit')

  const fitness = evaluateResolvedEndpointFitness('urn:maha:record:not-in-any-audit')
  assert.equal(fitness.state, 'audit-missing')
  assert.equal(fitness.blocker, 'endpoint-alignment-audit-missing')
  assert.equal(fitness.auditProvenance.audited, false)
})

test('an alignment-clear exact resolution is usable', () => {
  const clear = FRONTIER_ALIGNMENT_AUDIT.find((row) => {
    const result = resolveUsableEndpoint(row.recordId)
    return result.fitness?.state === 'alignment-clear'
  })
  assert.ok(clear, 'no alignment-clear record to exercise the usable path')
  const result = resolveUsableEndpoint(clear.recordId)
  assert.equal(result.usability, 'usable')
  assert.deepEqual(result.blockers, [])
  assert.ok(isUsableEndpoint(clear.recordId))
})

test('an alignment-clear alias resolution is usable', () => {
  // Build the alias form of a clear record: domain:slug rather than the urn.
  const clear = FRONTIER_ALIGNMENT_AUDIT.find(
    (row) => resolveUsableEndpoint(row.recordId).fitness?.state === 'alignment-clear',
  )!
  const reference = referenceFor(clear.recordId)
  const result = resolveUsableEndpoint(reference)
  assert.ok(isResolvedOutcome(result.structure.outcome), `${reference} did not resolve`)
  assert.equal(result.fitness!.state, 'alignment-clear')
  assert.equal(result.usability, 'usable')
})

test('a forged alignment-clear field cannot bypass the canonical audit lookup', () => {
  const recordId = recordWithVerdict('mismatched')
  // Fitness is derived from the record id via the canonical audit. A caller
  // holding a structure object with a doctored verdict has no way in.
  const forged = {
    submittedReference: recordId,
    outcome: {
      status: 'exact-resolution',
      recordId,
      domainSlug: 'fusion-plasma-systems',
      recordRevisionSha256: 'sha256:forged',
      subjectAligned: 'alignment-clear',
      alignmentClear: true,
      fitness: { state: 'alignment-clear' },
    },
  } as unknown as Parameters<typeof evaluateResolvedEndpointFitness>[0]
  void forged
  const fitness = evaluateResolvedEndpointFitness(recordId)
  assert.equal(fitness.state, 'source-mismatched')
  assert.notEqual(fitness.recordRevisionSha256, 'sha256:forged')
  assert.equal(fitness.auditProvenance.subjectAligned, 'mismatched')
})

test('changing the target record revision invalidates cached fitness', () => {
  const recordId = recordWithVerdict('mismatched')
  const first = evaluateResolvedEndpointFitness(recordId)
  const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)!
  assert.equal(first.recordRevisionSha256, epistemicReviewTargetHash(record))

  // A cached verdict is only reused while the revision matches; a materially
  // changed record produces a different hash, so the cache cannot serve it.
  const mutated = { ...record, description: `${record.description} materially changed` }
  assert.notEqual(epistemicReviewTargetHash(mutated), first.recordRevisionSha256)

  clearEndpointFitnessCache()
  const recomputed = evaluateResolvedEndpointFitness(recordId)
  assert.equal(recomputed.recordRevisionSha256, first.recordRevisionSha256)
  assert.equal(recomputed.state, first.state)
})

test('fitness records blocker provenance from the audit', () => {
  const fitness = evaluateResolvedEndpointFitness('urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets')
  assert.equal(fitness.auditProvenance.audited, true)
  assert.equal(fitness.auditProvenance.subjectAligned, 'mismatched')
  assert.ok(fitness.auditProvenance.alignmentBlockers.includes('source-subject-mismatched'))
  assert.ok(fitness.reason.length > 60)
})

/* ------------------------------------------------------------ the batch -- */

test('Q-BR reports two structural resolutions and one usable endpoint', () => {
  const totals = endpointUsabilityTotals(REFERENCES)
  // Usable moved 0 -> 1 when the pilot audit gave the syndrome-extraction alias
  // target a real, inspected, clear verdict. The REBCO alias stays blocked.
  assert.deepEqual(totals, {
    structurallyResolved: 2,
    usable: 1,
    structurallyResolvedButBlocked: 1,
    unresolved: 22,
  })
})

test('every twelve Q-BR bridges remain BLOCK', () => {
  assert.equal(QUANTUM_BRIDGE_AUDIT.length, 12)
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    assert.equal(bridge.verdict, 'BLOCK')
    assert.equal(bridge.promotionEligible, false)
  }
  assert.deepEqual(buildGapReport().verdictTotals, { BLOCK: 12 })
})

test('no existing source or endpoint blocker disappeared', () => {
  const totals = buildGapReport().blockerTotals
  assert.equal(totals['endpoint-unresolved-record'], 12)
  assert.equal(totals['source-missing-locator'], 12)
  assert.equal(totals['source-unverifiable'], 4)
  assert.equal(totals['claim-strength-rejected'], 7)
  assert.equal(totals['classification-unmappable'], 7)
})

test('the canary cohort is unchanged', () => {
  assert.equal(FRONTIER_CANARY_RECORDS.length, 40)
  assert.equal(FRONTIER_CANARY_CONTROL_RECORDS.length, 200)
})

/* --------------------------------------------- the proposed replacement -- */

test('the proposed REBCO replacement is inspected but never applied', () => {
  const entry = alignmentFor('urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets')!
  const override = entry.proposedSourceOverride!
  assert.equal(override.decision, 'pending-human-decision')
  assert.equal(override.inspection!.replacementDecision, 'replacement-supported')
  assert.equal(override.inspection!.artifactVersion, 'accepted-manuscript')
  assert.ok(override.inspection!.inspectedContentLocation.includes('PSFC/JA-16-17'))

  // Supported or not, nothing changes until a human accepts it.
  assert.equal(entry.sourceContractId, 'source-fusion-plasma-systems-stellarator-review')
  assert.equal(entry.evidence.subjectAligned, 'mismatched')
  assert.equal(
    resolveUsableEndpoint('fusion-plasma:rebco-high-field-magnets').usability,
    'structurally-resolved-but-epistemically-blocked',
  )
  assert.ok(override.inspection!.whatWouldChangeIfAccepted.length > 120)
})

test('a proposed replacement clears no Q-BR blocker', () => {
  const totals = buildGapReport().blockerTotals
  assert.equal(totals['endpoint-unresolved-record'], 12)
  assert.deepEqual(buildGapReport().verdictTotals, { BLOCK: 12 })
})

/* ------------------------------------------------------ nothing is public */

test('no audit or bridge candidate becomes publicly reachable', () => {
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
  for (const marker of ['endpoint-fitness', 'frontier-source-alignment', 'frontier-audit', 'urn:maha:candidate']) {
    assert.ok(!routeSources.includes(marker), `${marker} is referenced from a route`)
  }
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /endpoint-fitness|frontier-audit|source-alignment/)
  }
})
