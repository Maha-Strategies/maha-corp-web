import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  finalizeRecoveryObservation,
  sameSourceIdentity,
  validateObservation,
  type RecoveryObservation,
} from '../lib/source-recovery.ts'
import { executeRecoveryRequest } from '../lib/source-recovery-live.ts'
import {
  ALIGNMENT_BATCH_MEMBERSHIP,
  BATCH_6_REINSPECTIONS,
  FRONTIER_ALIGNMENT_AUDIT,
  alignmentFor,
  batchStats,
  isBatch6Reinspection,
} from '../lib/frontier-source-alignment.ts'

/**
 * Regression tests for failure modes actually observed while operating the
 * recovery canary, not hypothetical ones. Every case below either happened or
 * was one accepted candidate away from happening.
 */

function observation(overrides: Partial<RecoveryObservation> = {}): RecoveryObservation {
  return {
    channel: 'crossref',
    requestUrl: 'https://api.crossref.org/works/10.1038%2Fnature12385',
    status: 'open-copy-located',
    candidateUrl: 'https://arxiv.org/pdf/1307.6718',
    artifactVersion: 'preprint',
    observedTitle: 'Van der Waals heterostructures',
    observedIdentifier: 'https://doi.org/10.1038/nature12385',
    identityVerified: true,
    versionRelationshipVerified: true,
    contentInspected: false,
    exactLocator: null,
    note: 'test fixture',
    ...overrides,
  } as RecoveryObservation
}

/* ------------------------------------------------------------- identity -- */

test('a matching title with a conflicting DOI fails identity', () => {
  assert.equal(
    sameSourceIdentity('Van der Waals heterostructures', '10.1038/nature12385', {
      observedTitle: 'Van der Waals heterostructures',
      observedIdentifier: 'https://doi.org/10.1038/nature99999',
    }),
    false,
  )
})

test('a matching DOI settles identity even when the title is rendered differently', () => {
  assert.equal(
    sameSourceIdentity('Van der Waals heterostructures', '10.1038/nature12385', {
      observedTitle: 'VAN DER WAALS HETEROSTRUCTURES',
      observedIdentifier: 'https://doi.org/10.1038/nature12385',
    }),
    true,
  )
})

test('USGS 2024 does not satisfy a 2026 source contract', () => {
  // Different edition of the same annual publication: the titles differ by year
  // and neither side carries a DOI, so the exact-title rule must reject it.
  assert.equal(
    sameSourceIdentity('Mineral Commodity Summaries 2026', null, {
      observedTitle: 'Mineral Commodity Summaries 2024',
      observedIdentifier: null,
    }),
    false,
  )
  const finalized = finalizeRecoveryObservation(
    'Mineral Commodity Summaries 2026',
    null,
    observation({ observedTitle: 'Mineral Commodity Summaries 2024', observedIdentifier: null }),
  )
  assert.equal(finalized.identityVerified, false)
  assert.equal(finalized.status, 'wrong-document')
})

test('a supplementary-information artifact does not satisfy the main-paper contract', () => {
  // Observed while auditing Arute et al.: arXiv:1910.11333 is the supplementary
  // information, not the paper the contract declares.
  assert.equal(
    sameSourceIdentity('Quantum supremacy using a programmable superconducting processor', null, {
      observedTitle: 'Supplementary information for "Quantum supremacy using a programmable superconducting processor"',
      observedIdentifier: null,
    }),
    false,
  )
})

test('a wrong document can never advance to inspection-ready', () => {
  const finalized = finalizeRecoveryObservation(
    'Van der Waals heterostructures',
    '10.1038/nature12385',
    observation({ observedIdentifier: 'https://doi.org/10.1038/nature99999' }),
  )
  assert.equal(finalized.status, 'wrong-document')
  assert.notEqual(finalized.status, 'manual-inspection-ready')
  assert.equal(finalized.contentInspected, false)
})

test('a matching DOI with a different accessible artifact still needs a version relationship', () => {
  const issues = validateObservation(
    { title: 'Van der Waals heterostructures', identifier: '10.1038/nature12385' },
    observation({ status: 'manual-inspection-ready', versionRelationshipVerified: false }),
  )
  assert.ok(issues.length > 0, 'inspection readiness was granted without a version relationship')
})

test('a repository URL without content inspection stays recovery-only', () => {
  for (const entry of FRONTIER_ALIGNMENT_AUDIT) {
    if (entry.evidence.recoveryDisposition !== 'recovery-ready-retrieval-failed') continue
    assert.equal(entry.evidence.sourceContentInspected, false, `${entry.recordId} claims inspection`)
    assert.equal(entry.evidence.subjectAligned, 'inaccessible-source')
  }
})

/* ---------------------------------------------------------- live executor -- */

test('the live executor refuses an unapproved host before any network access', async () => {
  await assert.rejects(
    () => executeRecoveryRequest({ channel: 'crossref', url: 'https://evil.example.com/x', purpose: 'metadata' }),
    /not allowlisted/,
  )
})

test('a plain-HTTP recovery URL is refused', async () => {
  await assert.rejects(
    () => executeRecoveryRequest({ channel: 'crossref', url: 'http://api.crossref.org/works/10.1', purpose: 'metadata' }),
    /not allowlisted/,
  )
})

test('an aborted request produces a bounded state rather than a crash', async () => {
  const controller = new AbortController()
  controller.abort()
  const result = await executeRecoveryRequest(
    { channel: 'crossref', url: 'https://api.crossref.org/works/10.1038%2Fnature12385', purpose: 'metadata' },
    controller.signal,
  )
  assert.ok(['not-found', 'metadata-only', 'not-attempted'].includes(result.status), `unbounded status ${result.status}`)
  assert.equal(result.contentInspected, false)
  assert.equal(result.exactLocator, null)
})

test('live output cannot overwrite the deterministic committed plan', () => {
  const root = new URL('..', import.meta.url).pathname
  const script = readFileSync(join(root, 'scripts/generate-source-recovery-packets.ts'), 'utf8')
  // The live path must print; only the explicit --write path may touch disk.
  const writeIndex = script.indexOf('writeFileSync')
  const liveGuard = /--live|isLive|live\b/.test(script)
  assert.ok(liveGuard, 'the generator does not distinguish a live run')
  assert.ok(writeIndex === -1 || /--write|shouldWrite|writeRequested/.test(script), 'writes are not gated behind --write')
})

/* ------------------------------------------------------------- batch 6 ---- */

test('batch 6 is forty frozen records, five per domain, none judged earlier', () => {
  const batch6 = ALIGNMENT_BATCH_MEMBERSHIP['batch-6']
  assert.equal(batch6.length, 40)
  assert.equal(new Set(batch6).size, 40)
  const earlier = new Set(
    (['batch-1', 'batch-2', 'batch-3', 'batch-4', 'batch-5'] as const).flatMap(
      (id) => ALIGNMENT_BATCH_MEMBERSHIP[id],
    ),
  )
  const perDomain = new Map<string, number>()
  for (const recordId of batch6) {
    assert.ok(!earlier.has(recordId), `${recordId} was judged before batch 6`)
    const entry = alignmentFor(recordId)!
    perDomain.set(entry.domainSlug, (perDomain.get(entry.domainSlug) ?? 0) + 1)
  }
  assert.equal(perDomain.size, 8)
  for (const [domain, count] of perDomain) assert.equal(count, 5, `${domain} has ${count}`)
})

test('recovery-ready is not equivalent to inspected', () => {
  const ready = FRONTIER_ALIGNMENT_AUDIT.filter(
    (entry) => entry.evidence.recoveryDisposition === 'manual-inspection-ready',
  )
  assert.ok(ready.length > 0)
  // Some were opened and some were not; readiness alone never implies inspection.
  const notInspected = ready.filter((entry) => !entry.evidence.sourceContentInspected)
  for (const entry of notInspected) {
    assert.notEqual(entry.evidence.subjectAligned, 'supported')
    assert.equal(entry.evidence.inspectionDepth, 'not-inspected')
  }
})

test('an inspected source without an exact location fails closed', () => {
  for (const entry of FRONTIER_ALIGNMENT_AUDIT) {
    if (!entry.evidence.sourceContentInspected) continue
    assert.ok(entry.evidence.inspectedContentLocation, `${entry.recordId} inspected with no location`)
    assert.notEqual(entry.evidence.inspectionDepth, 'not-inspected')
  }
})

test('one source does not confer the same verdict across its positional block', () => {
  // The van der Waals review backs five records and all five failed; the
  // induction article backs five and they split three ways. Neither block was
  // decided in one stroke.
  const vdw = FRONTIER_ALIGNMENT_AUDIT.filter(
    (entry) => entry.sourceContractId === 'source-advanced-materials-vdw',
  )
  assert.equal(vdw.length, 5)
  for (const entry of vdw) assert.equal(entry.evidence.subjectAligned, 'mismatched')

  const induction = FRONTIER_ALIGNMENT_AUDIT.filter(
    (entry) => entry.sourceContractId === 'source-mechanistic-interpretability-induction',
  )
  assert.equal(induction.length, 5)
  assert.ok(
    new Set(induction.map((entry) => entry.evidence.subjectAligned)).size > 1,
    'a five-record block received one verdict wholesale',
  )
})

test('a batch 6 re-inspection preserves its prior judgement', () => {
  assert.equal(BATCH_6_REINSPECTIONS.length, 15)
  const cohort = new Set(ALIGNMENT_BATCH_MEMBERSHIP['batch-6'])
  for (const recordId of BATCH_6_REINSPECTIONS) {
    assert.ok(isBatch6Reinspection(recordId))
    assert.ok(!cohort.has(recordId), `${recordId} is both cohort and re-inspection`)
    const entry = alignmentFor(recordId)!
    assert.ok(entry.priorJudgement, `${recordId} discarded its prior judgement`)
    assert.equal(entry.priorJudgement.verdict, 'inaccessible-source')
  }
})

test('batch statistics are pinned', () => {
  const b6 = batchStats().find((row) => row.batchId === 'batch-6')!
  assert.deepEqual(b6, {
    batchId: 'batch-6',
    attempted: 40,
    contentInspected: 5,
    inaccessible: 0,
    supported: 3,
    partiallySupported: 1,
    mismatched: 1,
    insufficientEvidence: 35,
    alignmentClear: 3,
  })
})
