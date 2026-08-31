import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { ALIGNMENT_CLOSURE_DISPOSITIONS } from '../lib/alignment-closure-batch.ts'
import { BATCH_11_LINEAGE_DECLARATIONS } from '../lib/batch-11-mixed-lineage-release.ts'
import {
  KNOWN_RELEASE_STATUSES,
  gateRecord,
  probeLineage,
  simulateLifecycle,
  type RegistryProbeInput,
} from '../lib/batch-11-remote-rehearsal.ts'
import { BATCH_11_DECISIONS } from '../lib/frontier-alignment-batch-11-review.ts'
import { alignmentFor, isAlignmentClear } from '../lib/frontier-source-alignment.ts'

/**
 * Release eligibility must rest on evidence, not on approval or on cohort
 * membership.
 *
 * The rehearsal gate reads the lineage probe and the internal review decisions.
 * Neither asks whether a record's declared source was ever shown to support its
 * claim, so before this check every record in the cohort gated ready - one of
 * them an initial-release candidate whose source is still marked inaccessible
 * and has never been read.
 *
 * These tests pin that shut, and pin shut the escape route next to it: swapping
 * a refused record for a different one does not make the replacement eligible.
 */

const ROOT = resolve(import.meta.dirname, '..')
const OBSERVATION = JSON.parse(
  readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-registry-observation.json'), 'utf8'),
)
const PROBE: RegistryProbeInput = {
  observation: OBSERVATION,
  totalRegistryRows: OBSERVATION.totalReleasesInRegistry,
  statusVocabulary: [...KNOWN_RELEASE_STATUSES],
}
const TOOL_ALLOWLISTING = 'urn:maha:record:agentic-systems-mcp-tool-allowlisting'

const gateFor = (recordId: string, kind: 'initial' | 'superseding' = 'initial') => {
  const declaration = BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.recordId === recordId)
  return gateRecord(probeLineage(recordId, PROBE), declaration?.declaredReleaseKind ?? kind)
}

test('no Batch 11 candidate is releasable while its source alignment is unresolved', () => {
  const gates = BATCH_11_LINEAGE_DECLARATIONS.map((entry) => gateFor(entry.recordId))
  assert.equal(gates.length, 5)
  for (const gate of gates) {
    assert.equal(isAlignmentClear(gate.recordId), false, `${gate.recordId} is unexpectedly alignment-clear`)
    assert.equal(gate.ready, false, `${gate.recordId} gated ready without alignment`)
    assert.ok(gate.failures.includes('source-alignment-not-clear'), `${gate.recordId}: ${gate.failures.join(',')}`)
  }
})

test('an initial-release candidate whose source was never read is refused', () => {
  // The sharpest case in the current cohort: a record proposed for a first
  // canonical release whose declared source has never been opened.
  const recordId = 'urn:maha:record:advanced-materials-color-centers-in-diamond'
  const declaration = BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.recordId === recordId)
  assert.ok(declaration, 'the record must still be a declared candidate for this test to mean anything')
  assert.equal(declaration.declaredReleaseKind, 'initial')

  const record = alignmentFor(recordId)!
  assert.equal(record.evidence.sourceContentInspected, false, 'the source is still uninspected')
  assert.equal(record.evidence.subjectAligned, 'inaccessible-source')
  assert.equal(gateFor(recordId).ready, false)
})

// 1
test('a partially-supported record cannot become alignment-clear', () => {
  const record = alignmentFor(TOOL_ALLOWLISTING)!
  assert.equal(record.evidence.subjectAligned, 'partially-supported')
  assert.equal(record.evidence.claimSupported, false)
  assert.equal(isAlignmentClear(TOOL_ALLOWLISTING), false)

  // A property of the verdict, not a fact about one record.
  for (const disposition of ALIGNMENT_CLOSURE_DISPOSITIONS) {
    if (disposition.verdict === 'partially-supported') {
      assert.equal(disposition.newlyAlignmentClear, false, disposition.recordId)
      assert.equal(isAlignmentClear(disposition.recordId), false, disposition.recordId)
    }
  }
})

// 2
test('internal review cannot override missing evidentiary support', () => {
  const reviewed = BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => {
    const gate = gateFor(entry.recordId)
    return gate.scopedDecisionCount === 4
  })
  assert.ok(reviewed.length > 0, 'at least one candidate must be fully reviewed for this test to bite')

  for (const entry of reviewed) {
    const decisions = BATCH_11_DECISIONS.filter((decision) => decision.recordId === entry.recordId)
    assert.ok(
      decisions.every((decision) => decision.disposition !== 'reject-or-hold'),
      `${entry.recordId}: a held decision would confound this test`,
    )
    const gate = gateFor(entry.recordId)
    assert.equal(gate.scopedDecisionCount, 4, `${entry.recordId} is fully reviewed`)
    assert.equal(gate.ready, false, `${entry.recordId} is still refused`)
    assert.ok(
      gate.failures.includes('source-alignment-not-clear'),
      `${entry.recordId}: approval must not substitute for evidence`,
    )
    assert.throws(() => simulateLifecycle([entry.recordId], [gate]), /gate is not ready/)
  }
})

// 3
test('per-invocation denial is never reinterpreted as a persistent allowlist', () => {
  const disposition = ALIGNMENT_CLOSURE_DISPOSITIONS.find((entry) => entry.recordId === TOOL_ALLOWLISTING)!
  assert.equal(disposition.verdict, 'partially-supported')
  assert.equal(disposition.newlyAlignmentClear, false)
  assert.match(disposition.reason, /does not mandate any specific user interaction model/)
  assert.match(disposition.reason, /not an allowlist/)
  // Deeper reading resolved the depth question and left the subject question
  // where it was: the prior verdict and the new one agree.
  assert.equal(disposition.priorVerdict, 'partially-supported')
  assert.notEqual(disposition.inspectionDepth, 'not-inspected')

  // Whether or not it is in the cohort on any given day, it is not releasable.
  assert.equal(gateFor(TOOL_ALLOWLISTING).ready, false)
  assert.equal(isAlignmentClear(TOOL_ALLOWLISTING), false)
})

// 4
test('substituting a refused candidate does not confer eligibility', () => {
  // tool-allowlisting was a Batch 11 candidate and is no longer one. Removing a
  // record that could not clear is legitimate; what must not follow is that its
  // replacements inherit eligibility from the swap. Each replacement is gated
  // on its own evidence, exactly as the record it replaced was.
  const inCohort = BATCH_11_LINEAGE_DECLARATIONS.some((entry) => entry.recordId === TOOL_ALLOWLISTING)
  if (inCohort) {
    assert.equal(gateFor(TOOL_ALLOWLISTING).ready, false, 'a refused candidate must stay refused')
  }
  for (const entry of BATCH_11_LINEAGE_DECLARATIONS) {
    assert.equal(
      gateFor(entry.recordId).ready,
      isAlignmentClear(entry.recordId) && gateFor(entry.recordId).failures.length === 0,
      `${entry.recordId}: readiness must follow from its own evidence`,
    )
  }
})

test('a nearby record cannot stand in without its own declaration and digest', () => {
  const adjacent = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
  assert.equal(
    BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.recordId === adjacent),
    undefined,
    'the adjacent record must carry no Batch 11 declaration',
  )
  const gate = gateFor(adjacent)
  assert.equal(gate.ready, false)
  assert.equal(gate.proposedTargetSha256, '', 'an undeclared record has no revision digest to bind')
  assert.throws(
    () => simulateLifecycle([adjacent], [gateFor(BATCH_11_LINEAGE_DECLARATIONS[0].recordId)]),
    /no gate; refusing to simulate a record that was never gated/,
  )
})

test('the run refuses before any mutation while the cohort is blocked', () => {
  const gates = BATCH_11_LINEAGE_DECLARATIONS.map((entry) => gateFor(entry.recordId))
  assert.equal(gates.filter((gate) => gate.ready).length, 0)
  // Order independence must not be asserted over refused records.
  assert.throws(() => simulateLifecycle(gates.map((gate) => gate.recordId), gates), /gate is not ready/)
})
