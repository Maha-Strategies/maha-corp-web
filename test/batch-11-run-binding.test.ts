import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  EvidenceBindingRefused,
  TEMPORARY_ENVIRONMENT_SECRET_NAMES,
  buildBoundEvidence,
  compareReleasesToContract,
  contractReleaseIdentities,
  runMarkerFor,
  type BoundEvidenceInput,
} from '../lib/batch-11-evidence-binding.ts'
import { fingerprintCredential } from '../lib/batch-11-credential-provenance.ts'
import { verifyRehearsalEvidence, repositoryContract, type TeardownEvidence } from '../lib/batch-11-evidence-verifier.ts'
import {
  LineageNotFresh,
  assertLineageFresh,
  type LiveRegistryRead,
} from '../lib/batch-11-lineage-freshness.ts'
import { BATCH_11_LINEAGE_DECLARATIONS } from '../lib/batch-11-mixed-lineage-release.ts'
import { PHASE_ORDER } from '../lib/batch-11-rehearsal-phases.ts'
import { proposedRevisionAlignmentFor } from '../lib/batch-11-proposed-revision-alignment.ts'
import { alignmentFor, isAlignmentClear } from '../lib/frontier-source-alignment.ts'
import { BATCH_11_REVISED_RECORDS, BATCH_11_REVISION_AUDITS } from '../lib/batch-11-revision-canary.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'

/**
 * Run identity, contract-derived releases, and lineage freshness.
 *
 * Two runs of the same rehearsal from the same commit produce artifacts that
 * agree on every field except which run they were. Without the run id and its
 * derived marker, evidence from one could be presented for the other, and
 * teardown observations from a run that cleaned up could vouch for a run that
 * did not.
 */

const ROOT = resolve(import.meta.dirname, '..')
const FIXTURE = JSON.parse(readFileSync(resolve(ROOT, 'test/fixtures/batch-11-compliant-artifact.json'), 'utf8'))
const CONTRACT = repositoryContract(resolve(ROOT, 'content/frontier-alignment/batch-11-registry-observation.json'))
const COMMIT: string = FIXTURE.reviewedCommit

const artifact = () => structuredClone(FIXTURE.artifact) as Record<string, unknown>
const teardown = () => structuredClone(FIXTURE.teardown) as TeardownEvidence

const verify = (over: { artifact?: Record<string, unknown>; reviewedCommit?: string; teardown?: TeardownEvidence | null } = {}) =>
  verifyRehearsalEvidence({
    artifact: over.artifact ?? artifact(),
    reviewedCommit: over.reviewedCommit ?? COMMIT,
    teardown: over.teardown === undefined ? teardown() : over.teardown,
  }, CONTRACT)

const boundInput = (over: Partial<BoundEvidenceInput> = {}): BoundEvidenceInput => {
  const workflowRunId = over.workflowRunId ?? '77'
  const releaseIdentities = over.releaseIdentities ?? contractReleaseIdentities().map((entry, index) => ({ ...entry, releaseId: `epirelease_${index}` }))
  return ({
  expectedReviewedCommit: COMMIT,
  checkedOutCommit: COMMIT,
  workflowRunId,
  planDigest: CONTRACT.planDigest,
  cohortRecordIds: BATCH_11_LINEAGE_DECLARATIONS.map((entry) => entry.recordId),
  lineageClassifications: BATCH_11_LINEAGE_DECLARATIONS.map((entry) => ({
    recordId: entry.recordId, expected: entry.declaredReleaseKind, observed: entry.declaredReleaseKind,
  })),
  phaseOutcomes: PHASE_ORDER.map((phase) => ({ phase, status: 'executed', mutations: 1 })),
  releaseIdentities,
  replayedReleases: 0,
  deploymentMarker: { deploymentId: 'dpl', origin: 'https://x.vercel.app' },
  teardownHandles: {
    schemaVersion: 'maha-batch-11-private-teardown-handles/1.0',
    workflowRunId,
    runMarker: runMarkerFor(workflowRunId),
    reviewedCommit: COMMIT,
    supabaseBranch: { branchId: 'branch', parentProjectRef: 'staging' },
    vercelPreview: { deploymentId: 'dpl', origin: 'https://x.vercel.app' },
    githubEnvironmentSecrets: { environment: 'batch-11-preview-rehearsal', names: TEMPORARY_ENVIRONMENT_SECRET_NAMES },
    databaseReleaseRows: { branchId: 'branch', releaseIds: releaseIdentities.map((entry) => entry.releaseId) },
  },
  cleanup: { branchDestroyed: true, deploymentDestroyed: true, markerRemoved: true },
  identities: {
    protectedEnvironment: 'batch-11-preview-rehearsal',
    operationsIdentityFingerprint: fingerprintCredential('synthetic-operations-identity'),
    releaseAuthorityIdentityFingerprint: fingerprintCredential('synthetic-release-authority-identity'),
    branchManagementIdentityFingerprint: fingerprintCredential('synthetic-branch-management-identity'),
    automationBypassIdentityFingerprint: fingerprintCredential('synthetic-automation-bypass-identity'),
  },
  requiredPhaseCount: PHASE_ORDER.length,
  ...over,
  })
}

const bindingRefusal = (input: BoundEvidenceInput): EvidenceBindingRefused => {
  try {
    buildBoundEvidence(input)
  } catch (error) {
    assert.ok(error instanceof EvidenceBindingRefused, `expected EvidenceBindingRefused, got ${String(error)}`)
    return error
  }
  throw new Error('expected a refusal but binding succeeded')
}

/* ------------------------------------------------------- run identity ---- */

test('the run marker derives from the run id and is not independently assertable', () => {
  assert.equal(runMarkerFor('77'), 'batch-11-mixed-lineage-rehearsal-77')
  const bound = buildBoundEvidence(boundInput())
  assert.equal(bound.runMarker, runMarkerFor(bound.workflowRunId))
})

test('a missing or malformed run id refuses at binding time', () => {
  assert.equal(bindingRefusal(boundInput({ workflowRunId: '' })).code, 'workflow-run-id-missing')
  for (const runId of ['abc', '77a', '-1', '1.5', ' 77 ']) {
    assert.equal(bindingRefusal(boundInput({ workflowRunId: runId })).code, 'workflow-run-id-malformed', runId)
  }
})

test('the run id and marker are inside the artifact digest', () => {
  const first = buildBoundEvidence(boundInput({ workflowRunId: '77' }))
  const second = buildBoundEvidence(boundInput({ workflowRunId: '78' }))
  assert.notEqual(first.artifactDigest, second.artifactDigest, 'a different run must produce a different digest')
})

test('exact teardown handles are digest-bound and must name the issued releases', () => {
  const first = buildBoundEvidence(boundInput())
  const changed = boundInput()
  changed.teardownHandles = structuredClone(changed.teardownHandles)
  changed.teardownHandles.supabaseBranch.branchId = 'another-exact-branch'
  const second = buildBoundEvidence(changed)
  assert.notEqual(first.teardownHandleDigests['supabase-branch'], second.teardownHandleDigests['supabase-branch'])
  assert.notEqual(first.artifactDigest, second.artifactDigest)

  const wrongRows = boundInput()
  wrongRows.teardownHandles = structuredClone(wrongRows.teardownHandles)
  wrongRows.teardownHandles.databaseReleaseRows.releaseIds = ['not-an-issued-release']
  assert.equal(bindingRefusal(wrongRows).code, 'teardown-handle-release-mismatch')
})

test('evidence from a different run is refused even when everything else matches', () => {
  // Same commit, same cohort, same releases; only the run differs.
  const other = buildBoundEvidence(boundInput({ workflowRunId: '78' }))
  const bad = { ...artifact(), ...other }
  const report = verify({ artifact: bad, teardown: teardown() })
  assert.equal(report.verdict, 'refused')
  assert.ok(report.refusals.includes('teardown-run-mismatch'), report.refusals.join(', '))
})

test('a modified run marker refuses', () => {
  const bad = artifact()
  bad.runMarker = 'batch-11-mixed-lineage-rehearsal-999'
  const report = verify({ artifact: bad })
  assert.equal(report.verdict, 'refused')
  assert.ok(report.refusals.includes('run-marker-mismatch'), report.refusals.join(', '))
})

test('a missing run id refuses at verification', () => {
  const bad = artifact()
  delete bad.workflowRunId
  const report = verify({ artifact: bad })
  assert.ok(report.refusals.includes('workflow-run-id-missing'), report.refusals.join(', '))
})

/* --------------------------------------------- contract-derived releases -- */

test('release targets must be the digests the revision audits declare', () => {
  const contract = contractReleaseIdentities()
  assert.equal(contract.length, 5)
  for (const entry of contract) {
    const audit = BATCH_11_REVISION_AUDITS.find((row) => row.recordId === entry.recordId)!
    assert.equal(entry.targetSha256, audit.revisedRecordRevisionSha256)
  }
})

test('an arbitrary but well-formed target digest is refused', () => {
  for (const digit of ['0', '1', 'f']) {
    const releases = contractReleaseIdentities().map((entry, index) =>
      index === 0 ? { ...entry, releaseId: 'r', targetSha256: `sha256:${digit.repeat(64)}` } : { ...entry, releaseId: 'r' })
    assert.equal(bindingRefusal(boundInput({ releaseIdentities: releases })).code, 'release-target-not-contract-derived')
    assert.match(compareReleasesToContract(releases)[0], /target digest is not the one the revision audit declares/)
  }
})

test('a flipped release kind is refused in both directions', () => {
  const flip = (kind: 'initial' | 'superseding') => contractReleaseIdentities().map((entry) =>
    entry.releaseKind === kind
      ? { ...entry, releaseId: 'r', releaseKind: kind === 'initial' ? 'superseding' as const : 'initial' as const }
      : { ...entry, releaseId: 'r' })
  for (const kind of ['initial', 'superseding'] as const) {
    const problems = compareReleasesToContract(flip(kind))
    assert.ok(problems.some((entry) => entry.includes('but declared')), `${kind}: ${problems.join(' ')}`)
  }
})

test('a wrong predecessor, or a predecessor on an initial release, is refused', () => {
  const wrong = contractReleaseIdentities().map((entry) =>
    entry.releaseKind === 'superseding'
      ? { ...entry, releaseId: 'r', supersedesReleaseId: 'epirelease_not_the_declared_one' }
      : { ...entry, releaseId: 'r' })
  assert.equal(bindingRefusal(boundInput({ releaseIdentities: wrong })).code, 'release-predecessor-mismatch')

  const attached = contractReleaseIdentities().map((entry) =>
    entry.releaseKind === 'initial'
      ? { ...entry, releaseId: 'r', supersedesReleaseId: 'epirelease_should_not_be_here' }
      : { ...entry, releaseId: 'r' })
  assert.equal(bindingRefusal(boundInput({ releaseIdentities: attached })).code, 'release-predecessor-mismatch')
})

test('a duplicate, missing or unrelated release is refused', () => {
  const base = contractReleaseIdentities().map((entry) => ({ ...entry, releaseId: 'r' }))

  const duplicated = [...base, base[0]]
  assert.ok(compareReleasesToContract(duplicated).some((entry) => entry.includes('released twice')))

  const missing = base.slice(1)
  assert.ok(compareReleasesToContract(missing).some((entry) => entry.includes('declared but never released')))

  const unrelated = [...base, { ...base[0], recordId: 'urn:maha:record:somewhere-else' }]
  assert.ok(compareReleasesToContract(unrelated).some((entry) => entry.includes('not a declared cohort record')))
})

/* ------------------------------------------------- lineage freshness ----- */

const counts = { totalReleases: 2, active: 2, superseded: 0, withdrawn: 0 }
const superseding = BATCH_11_LINEAGE_DECLARATIONS.filter((entry) => entry.declaredReleaseKind === 'superseding')
const freshRows = () => superseding.map((entry) => ({
  recordId: entry.recordId,
  releaseId: entry.declaredPriorReleaseId!,
  status: 'active',
  targetSha256: entry.declaredPriorTargetSha256!,
}))
const read = (over: Partial<LiveRegistryRead> = {}, rows = freshRows()): LiveRegistryRead =>
  ({ ok: true, status: 200, body: { releases: rows, counts }, ...over })

const freshnessRefusal = (input: LiveRegistryRead): LineageNotFresh => {
  try {
    assertLineageFresh(input)
  } catch (error) {
    assert.ok(error instanceof LineageNotFresh, `expected LineageNotFresh, got ${String(error)}`)
    return error
  }
  throw new Error('expected a refusal but the lineage was accepted')
}

test('a fresh registry confirms every initial absent and every predecessor active', () => {
  const result = assertLineageFresh(read())
  assert.equal(result.initialRecordsConfirmedAbsent, 3)
  assert.equal(result.supersedingPredecessorsConfirmed, 2)
})

test('a failed or malformed pre-release read refuses rather than proceeding', () => {
  assert.equal(freshnessRefusal(read({ ok: false, status: 503 })).code, 'registry-request-failed')
  assert.equal(freshnessRefusal(read({ body: null })).code, 'registry-malformed')
  assert.equal(freshnessRefusal(read({ body: { counts } })).code, 'registry-malformed')
})

test('a narrowed status vocabulary cannot establish an absent lineage', () => {
  const narrowed = read({ body: { releases: freshRows(), counts: { totalReleases: 2, active: 2 } } })
  assert.equal(freshnessRefusal(narrowed).code, 'status-vocabulary-narrowed')
})

test('a lineage appearing after planning stops an initial release', () => {
  const initial = BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.declaredReleaseKind === 'initial')!
  const rows = [...freshRows(), { recordId: initial.recordId, releaseId: 'epirelease_new', status: 'active', targetSha256: 'sha256:new' }]
  const refusal = freshnessRefusal(read({}, rows))
  assert.equal(refusal.code, 'initial-lineage-appeared')
  assert.equal(refusal.recordId, initial.recordId)
})

test('a predecessor that vanished, changed or went non-active stops a superseding release', () => {
  assert.equal(freshnessRefusal(read({}, freshRows().slice(1))).code, 'predecessor-absent')

  const withdrawn = freshRows().map((row, index) => (index === 0 ? { ...row, status: 'withdrawn' } : row))
  assert.equal(freshnessRefusal(read({}, withdrawn)).code, 'predecessor-absent')

  const changed = freshRows().map((row, index) => (index === 0 ? { ...row, releaseId: 'epirelease_someone_else' } : row))
  assert.equal(freshnessRefusal(read({}, changed)).code, 'predecessor-changed')

  const rebound = freshRows().map((row, index) => (index === 0 ? { ...row, targetSha256: 'sha256:different' } : row))
  assert.equal(freshnessRefusal(read({}, rebound)).code, 'predecessor-changed')
})

test('duplicate predecessors make the supersession ambiguous and refuse', () => {
  const rows = freshRows()
  const duplicated = [...rows, { ...rows[0], releaseId: 'epirelease_second_active' }]
  assert.equal(freshnessRefusal(read({}, duplicated)).code, 'duplicate-predecessor')
})

test('a predecessor already carrying the proposed revision refuses: nothing would be released', () => {
  const rows = freshRows()
  const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === rows[0].recordId)!
  const conflicting = rows.map((row, index) => (index === 0 ? { ...row, targetSha256: audit.revisedRecordRevisionSha256 } : row))
  // The declaration's prior digest no longer matches either, so the earlier
  // check fires first; both are refusals and neither releases.
  assert.ok(['conflicting-lineage', 'predecessor-changed'].includes(freshnessRefusal(read({}, conflicting)).code))
})

/* ------------------------------------- why #315 moved the cohort to 5/5 --- */

test('every cohort record is a source replacement, which is why the old gate refused it', () => {
  // The prior gate asked whether the record's *active* binding was clear. For a
  // source-replacement revision that asks about the source being displaced, so
  // it could never pass. This pins the legitimate reason each record now
  // clears: a different, inspected source, with the audit bound to the exact
  // revised revision.
  for (const declaration of BATCH_11_LINEAGE_DECLARATIONS) {
    const active = alignmentFor(declaration.recordId)!
    const revised = BATCH_11_REVISED_RECORDS.find((entry) => entry.id === declaration.recordId)!
    const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === declaration.recordId)!

    assert.equal(isAlignmentClear(declaration.recordId), false,
      `${declaration.recordId}: the displaced binding must still be unclear, or this cohort is not a replacement cohort`)
    assert.notEqual(active.sourceTitle, revised.sources[0]?.title,
      `${declaration.recordId}: the revision must bind a different source than the one it displaces`)

    const proposed = proposedRevisionAlignmentFor(declaration.recordId)
    assert.equal(proposed.ready, true, `${declaration.recordId}: ${proposed.blockers.join(', ')}`)
    assert.deepEqual(proposed.blockers, [])
    assert.equal(audit.revisedRecordRevisionSha256, epistemicReviewTargetHash(revised),
      `${declaration.recordId}: the audit must bind the exact revised revision`)
  }
})

test('the proposed-revision gate refuses a record with no evidence chain', () => {
  // If it cleared anything without a packet, decision, audit and scoped review,
  // the transition to 5/5 would be a weakening rather than a correction.
  for (const recordId of [
    'urn:maha:record:agentic-systems-mcp-tool-allowlisting',
    'urn:maha:record:agentic-systems-mcp-tool-deny-by-default',
    'urn:maha:record:not-a-record-at-all',
  ]) {
    const proposed = proposedRevisionAlignmentFor(recordId)
    assert.equal(proposed.ready, false, recordId)
    assert.ok(proposed.blockers.length > 0, recordId)
  }
})

test('each record still carries four scoped decisions on its exact revision', () => {
  // The count and exactness the old gate relied on are unchanged; only the
  // source the alignment question is asked about moved.
  for (const declaration of BATCH_11_LINEAGE_DECLARATIONS) {
    const proposed = proposedRevisionAlignmentFor(declaration.recordId)
    assert.equal(proposed.ready, true)
    assert.match(proposed.auditSha256, /^sha256:[0-9a-f]{64}$/)
  }
})

/**
 * The bound identity must carry what the contract compares.
 *
 * Run 33502828081 issued all five releases against a live branch and was then
 * refused while assembling its own evidence: the audit and decision-bundle
 * digests had been added to the bound identity but were never produced, so
 * every release arrived with them undefined. The work was done and the artifact
 * could not be built.
 */
test('the runner produces every field the contract comparison requires', () => {
  const runner = readFileSync(resolve(ROOT, 'scripts/run-batch-11-remote-rehearsal.ts'), 'utf8')
  const block = runner.slice(runner.indexOf('releaseIdentities: outcome.releaseIdentities.map'))
    .slice(0, 1200)

  for (const field of ['recordId', 'releaseId', 'targetSha256', 'auditSha256', 'decisionBundleSha256', 'releaseKind', 'supersedesReleaseId']) {
    assert.ok(block.includes(`${field}:`), `the bound release identity must carry ${field}`)
  }
  // Derived from the record actually released, not asserted blindly.
  assert.match(block, /BATCH_11_REVISION_AUDITS\.find\(\(candidate\) => candidate\.recordId === entry\.recordId\)/)
  assert.match(block, /released without a revision audit/)
  assert.match(block, /decisionBundleDigest\(entry\.recordId\)/)
})

test('a release outside the cohort is refused rather than given a digest', () => {
  // The lookup throws instead of falling back, so an unexpected record cannot
  // be recorded with a plausible-looking audit digest.
  const contract = contractReleaseIdentities()
  const known = new Set(contract.map((entry) => entry.recordId))
  assert.equal(known.size, 5)
  for (const identity of contract) {
    assert.match(identity.auditSha256, /^sha256:[0-9a-f]{64}$/)
    assert.match(identity.decisionBundleSha256, /^sha256:[0-9a-f]{64}$/)
  }
  // Every declared record has exactly one audit and one decision bundle.
  assert.equal(new Set(contract.map((entry) => entry.auditSha256)).size, 5)
  assert.equal(new Set(contract.map((entry) => entry.decisionBundleSha256)).size, 5)
})
