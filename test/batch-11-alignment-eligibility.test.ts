import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { BATCH_11_LINEAGE_DECLARATIONS } from '../lib/batch-11-mixed-lineage-release.ts'
import {
  evaluateProposedRevisionAlignment,
  proposedRevisionAlignmentFor,
  proposedRevisionAlignmentInput,
} from '../lib/batch-11-proposed-revision-alignment.ts'
import {
  KNOWN_RELEASE_STATUSES,
  gateRecord,
  probeLineage,
  proveOrderIndependence,
  simulateLifecycle,
  type RegistryProbeInput,
} from '../lib/batch-11-remote-rehearsal.ts'
import { alignmentFor, isAlignmentClear } from '../lib/frontier-source-alignment.ts'

/**
 * The active record and the proposed replacement are different revisions.
 *
 * PR #310 correctly prevented an uninspected ACTIVE source from releasing, but
 * it then judged the proposed replacement by that displaced source. These tests
 * keep both rules: stale canonical bindings never become evidence, and a
 * replacement clears only when its own packet-to-audit chain recomputes cleanly.
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

const COLOR_CENTERS = 'urn:maha:record:advanced-materials-color-centers-in-diamond'
const TOOL_ALLOWLISTING = 'urn:maha:record:agentic-systems-mcp-tool-allowlisting'

const sha = (value: unknown) =>
  `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`

const gateFor = (recordId: string, kind: 'initial' | 'superseding' = 'initial') => {
  const declaration = BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.recordId === recordId)
  return gateRecord(probeLineage(recordId, PROBE), declaration?.declaredReleaseKind ?? kind)
}

test('all five exact proposed revisions recompute alignment-clear while their displaced bindings stay non-clear', () => {
  for (const declaration of BATCH_11_LINEAGE_DECLARATIONS) {
    assert.equal(isAlignmentClear(declaration.recordId), false, `${declaration.recordId}: stale active binding unexpectedly clear`)
    const proposed = proposedRevisionAlignmentFor(declaration.recordId)
    assert.equal(proposed.ready, true, `${declaration.recordId}: ${proposed.blockers.join(',')}`)
    assert.equal(proposed.alignmentVerdict, 'alignment-clear')
    assert.deepEqual(proposed.blockers, [])
    assert.match(proposed.proposedTargetSha256, /^sha256:[0-9a-f]{64}$/)
    assert.match(proposed.auditSha256, /^sha256:[0-9a-f]{64}$/)
  }
})

test('the real cohort gates cleanly without a fixture that strips failures', () => {
  const gates = BATCH_11_LINEAGE_DECLARATIONS.map((entry) => gateFor(entry.recordId))
  assert.equal(gates.length, 5)
  assert.equal(gates.filter((entry) => entry.ready).length, 5)
  assert.equal(gates.filter((entry) => entry.declaredKind === 'superseding').length, 2)
  assert.equal(gates.filter((entry) => entry.declaredKind === 'initial').length, 3)
  for (const gate of gates) {
    assert.equal(gate.alignmentVerdict, 'alignment-clear')
    assert.deepEqual(gate.alignmentBlockers, [])
    assert.ok(!gate.failures.includes('source-alignment-not-clear'))
  }
  assert.doesNotThrow(() => simulateLifecycle(gates.map((entry) => entry.recordId), gates))
  const ordering = proveOrderIndependence(gates.map((entry) => entry.recordId), gates)
  assert.equal(ordering.independent, true)
  assert.equal(ordering.ordersTested, 120)
})

test('an unread active source is not mistaken for the inspected replacement source', () => {
  const active = alignmentFor(COLOR_CENTERS)!
  assert.equal(active.evidence.sourceContentInspected, false)
  assert.equal(active.evidence.subjectAligned, 'inaccessible-source')

  const input = proposedRevisionAlignmentInput(COLOR_CENTERS)
  assert.equal(input.packet?.inspection?.depth, 'abstract-and-identity')
  assert.equal(input.packet?.verdict, 'supported')
  assert.equal(evaluateProposedRevisionAlignment(input).ready, true)

  const uninspected = {
    ...input,
    packet: { ...input.packet!, inspection: null, source: null, verdict: 'unresolved-fail-closed' as const },
  }
  const refused = evaluateProposedRevisionAlignment(uninspected)
  assert.equal(refused.ready, false)
  assert.ok(refused.blockers.includes('packet-not-supported'))
  assert.ok(refused.blockers.includes('source-content-not-inspected'))
})

test('internal approvals cannot manufacture support when the packet is partial', () => {
  const input = proposedRevisionAlignmentInput(COLOR_CENTERS)
  assert.equal(input.scopedDecisions.length, 4)
  const partial = {
    ...input,
    packet: { ...input.packet!, verdict: 'partially-supported' as const },
  }
  const result = evaluateProposedRevisionAlignment(partial)
  assert.equal(result.ready, false)
  assert.ok(result.blockers.includes('packet-not-supported'))
  assert.ok(result.blockers.includes('packet-digest-mismatch'))
})

test('a decision cannot detach its reviewed identity, locator, rights or authority boundary from the packet', () => {
  const input = proposedRevisionAlignmentInput(COLOR_CENTERS)
  const detached = evaluateProposedRevisionAlignment({
    ...input,
    decision: {
      ...input.decision!,
      inspectedContentLocator: 'A different locator',
      activeBindingChanged: true,
      canonicalReleaseAuthorized: true,
    } as unknown as NonNullable<typeof input.decision>,
  })
  assert.ok(detached.blockers.includes('review-decision-evidence-mismatch'))
  assert.ok(detached.blockers.includes('review-decision-authority-overreach'))
  assert.ok(detached.blockers.includes('audit-target-mismatch'))
})

test('a self-consistent edited audit digest cannot manufacture a supporting finding', () => {
  const input = proposedRevisionAlignmentInput(COLOR_CENTERS)
  const changedAudit = {
    ...input.audit!,
    checks: input.audit!.checks.map((check) =>
      check.dimension === 'claim-scope'
        ? { ...check, finding: 'An unrelated but substantive statement inserted after review.' }
        : check,
    ),
    auditSha256: '',
  }
  changedAudit.auditSha256 = sha(Object.fromEntries(
    Object.entries(changedAudit).filter(([key]) => key !== 'auditSha256'),
  ))

  const result = evaluateProposedRevisionAlignment({ ...input, audit: changedAudit })
  assert.ok(!result.blockers.includes('audit-digest-mismatch'))
  assert.ok(result.blockers.includes('audit-findings-mismatch'))
  assert.equal(result.ready, false)
})

test('locator, source binding, audit and review mutations each fail closed', () => {
  const input = proposedRevisionAlignmentInput(COLOR_CENTERS)

  const vagueLocator = evaluateProposedRevisionAlignment({
    ...input,
    packet: { ...input.packet!, inspection: { ...input.packet!.inspection!, locator: 'whole document' } },
  })
  assert.ok(vagueLocator.blockers.includes('exact-locator-missing'))

  const wrongSource = evaluateProposedRevisionAlignment({
    ...input,
    proposedRecord: {
      ...input.proposedRecord!,
      sources: [{ ...input.proposedRecord!.sources[0], url: 'https://example.invalid/substituted' }],
    },
  })
  assert.ok(wrongSource.blockers.includes('proposed-source-binding-mismatch'))
  assert.ok(wrongSource.blockers.includes('audit-target-mismatch'))

  const incompleteAudit = evaluateProposedRevisionAlignment({
    ...input,
    audit: { ...input.audit!, checks: input.audit!.checks.slice(1) },
  })
  assert.ok(incompleteAudit.blockers.includes('audit-checks-incomplete'))
  assert.ok(incompleteAudit.blockers.includes('audit-digest-mismatch'))

  const missingScope = evaluateProposedRevisionAlignment({
    ...input,
    scopedDecisions: input.scopedDecisions.slice(0, 3),
  })
  assert.ok(missingScope.blockers.includes('scoped-review-incomplete'))
  assert.ok(missingScope.blockers.includes('revision-preflight-failed'))

  const staleScope = evaluateProposedRevisionAlignment({
    ...input,
    scopedDecisions: input.scopedDecisions.map((entry, index) =>
      index === 0 ? { ...entry, targetSha256: `sha256:${'0'.repeat(64)}` } : entry,
    ),
  })
  assert.ok(staleScope.blockers.includes('scoped-review-stale'))
  assert.ok(staleScope.blockers.includes('scoped-review-digest-mismatch'))
})

test('a nearby record cannot inherit a declaration, proposal, audit or clearance', () => {
  const adjacent = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
  assert.equal(BATCH_11_LINEAGE_DECLARATIONS.some((entry) => entry.recordId === adjacent), false)
  const proposed = proposedRevisionAlignmentFor(adjacent)
  assert.equal(proposed.ready, false)
  assert.equal(proposed.proposedTargetSha256, '')
  assert.ok(proposed.blockers.includes('evidence-chain-ambiguous'))
  assert.ok(proposed.blockers.includes('proposal-record-missing'))
  assert.ok(proposed.blockers.includes('packet-missing'))
  assert.ok(proposed.blockers.includes('audit-missing'))
  const gate = gateFor(adjacent)
  assert.equal(gate.ready, false)
  assert.ok(gate.failures.includes('source-alignment-not-clear'))
})

test('duplicate or missing chain members are ambiguous even if one object can be selected', () => {
  const input = proposedRevisionAlignmentInput(COLOR_CENTERS)
  const duplicatePacket = evaluateProposedRevisionAlignment({
    ...input,
    chainCounts: { ...input.chainCounts, packets: 2 },
  })
  assert.ok(duplicatePacket.blockers.includes('evidence-chain-ambiguous'))
  assert.equal(duplicatePacket.ready, false)
})

test('the rejected tool-allowlisting proposal remains blocked', () => {
  const active = alignmentFor(TOOL_ALLOWLISTING)!
  assert.equal(active.evidence.subjectAligned, 'partially-supported')
  assert.equal(active.evidence.claimSupported, false)
  assert.equal(isAlignmentClear(TOOL_ALLOWLISTING), false)
  const proposed = proposedRevisionAlignmentFor(TOOL_ALLOWLISTING)
  assert.equal(proposed.ready, false)
  assert.ok(proposed.blockers.includes('proposal-record-missing'))
  assert.equal(gateFor(TOOL_ALLOWLISTING).ready, false)
})
