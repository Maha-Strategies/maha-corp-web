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
  BATCH_7_REINSPECTIONS,
  BATCH_8_COHORT,
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


/* ------------------------------------------------- arithmetic reconciles -- */

/**
 * The batch-6 numbers were reported inconsistently once: the cohort's five
 * inspected records were quoted as if they were the whole batch, while the
 * global inspected count moved by fifteen. Cohort and re-inspection are two
 * disjoint populations and the tests below make every representation of them
 * agree by construction rather than by restatement.
 */

const B6_COHORT = FRONTIER_ALIGNMENT_AUDIT.filter((entry) =>
  ALIGNMENT_BATCH_MEMBERSHIP['batch-6'].includes(entry.recordId),
)
const B6_REINSPECT = FRONTIER_ALIGNMENT_AUDIT.filter((entry) => BATCH_6_REINSPECTIONS.includes(entry.recordId))
function batch6State(entry: (typeof FRONTIER_ALIGNMENT_AUDIT)[number]) {
  if (BATCH_7_REINSPECTIONS.includes(entry.recordId) || BATCH_8_COHORT.includes(entry.recordId)) {
    let prior = entry.priorJudgement
    while (prior && prior.batchId !== 'batch-6') prior = prior.priorJudgement ?? null
    if (!prior) throw new Error(`${entry.recordId}: cannot reconstruct the frozen Batch 6 state.`)
    return {
      verdict: prior.verdict,
      sourceContentInspected: prior.sourceContentInspected ?? false,
      inspectionDepth: prior.inspectionDepth ?? 'not-inspected',
    }
  }
  return {
    verdict: entry.evidence.subjectAligned,
    sourceContentInspected: entry.evidence.sourceContentInspected,
    inspectionDepth: entry.evidence.inspectionDepth,
  }
}

const historicallyInspectedIn = (rows: typeof B6_COHORT) => rows.filter((entry) => batch6State(entry).sourceContentInspected).length
const activeInspectedIn = (rows: typeof B6_COHORT) => rows.filter((entry) => entry.evidence.sourceContentInspected).length

/** A cohort record was unjudged before batch 6, so its prior state is the default. */
function priorVerdict(entry: (typeof FRONTIER_ALIGNMENT_AUDIT)[number]): string {
  if (BATCH_6_REINSPECTIONS.includes(entry.recordId)) return entry.priorJudgement!.verdict
  return entry.sourceContractId === 'source-critical-supply-chains-pp1802'
    ? 'inaccessible-source'
    : 'insufficient-evidence'
}

test('the cohort and the re-inspection set are disjoint and exactly sized', () => {
  assert.equal(B6_COHORT.length, 40)
  assert.equal(B6_REINSPECT.length, 15)
  const cohortIds = new Set(B6_COHORT.map((entry) => entry.recordId))
  for (const entry of B6_REINSPECT) {
    assert.ok(!cohortIds.has(entry.recordId), `${entry.recordId} is in both populations`)
  }
  assert.equal(new Set(B6_COHORT.map((entry) => entry.recordId)).size, 40)
})

test('inspected plus uninspected equals the cohort size', () => {
  const inspected = historicallyInspectedIn(B6_COHORT)
  const uninspected = B6_COHORT.length - inspected
  assert.equal(inspected + uninspected, 40)
  assert.equal(inspected, 5, 'cohort inspected count moved')
  assert.equal(uninspected, 35)
})

test('newly inspected equals cohort inspected plus re-inspected, and matches the global delta', () => {
  const newlyInspected = historicallyInspectedIn(B6_COHORT) + historicallyInspectedIn(B6_REINSPECT)
  assert.equal(newlyInspected, 15, 'newly inspected count moved')
  // 131 records were content-inspected before batch 6.
  assert.equal(131 + newlyInspected, 146, 'Batch 6 historical inspected delta does not reconcile')
})

test('inspection-depth totals equal the newly inspected count', () => {
  const depths = [...B6_COHORT, ...B6_REINSPECT]
    .filter((entry) => batch6State(entry).sourceContentInspected)
    .map((entry) => batch6State(entry).inspectionDepth)
  assert.equal(depths.length, historicallyInspectedIn(B6_COHORT) + historicallyInspectedIn(B6_REINSPECT))
  assert.ok(!depths.includes('not-inspected'), 'an inspected record reports no depth')
  const byDepth: Record<string, number> = {}
  for (const depth of depths) byDepth[depth] = (byDepth[depth] ?? 0) + 1
  assert.deepEqual(byDepth, { 'full-text-search': 10, 'abstract-only': 5 })
})

test('cohort verdicts sum to forty', () => {
  const totals: Record<string, number> = {}
  for (const entry of B6_COHORT) {
    const verdict = batch6State(entry).verdict
    totals[verdict] = (totals[verdict] ?? 0) + 1
  }
  assert.equal(
    Object.values(totals).reduce((a, b) => a + b, 0),
    40,
  )
  assert.deepEqual(totals, {
    supported: 3,
    'partially-supported': 1,
    mismatched: 1,
    'insufficient-evidence': 30,
    'inaccessible-source': 5,
  })
})

test('global verdict totals reconcile record by record from the pre-batch state', () => {
  const before: Record<string, number> = {
    supported: 55,
    'partially-supported': 22,
    mismatched: 49,
    'insufficient-evidence': 64,
    'inaccessible-source': 50,
  }
  const delta: Record<string, number> = {}
  for (const entry of [...B6_COHORT, ...B6_REINSPECT]) {
    const from = priorVerdict(entry)
    const to = batch6State(entry).verdict
    if (from === to) continue
    delta[from] = (delta[from] ?? 0) - 1
    delta[to] = (delta[to] ?? 0) + 1
  }
  const predicted: Record<string, number> = {}
  for (const [verdict, count] of Object.entries(before)) predicted[verdict] = count + (delta[verdict] ?? 0)
  assert.deepEqual(predicted, {
    supported: 59,
    'partially-supported': 26,
    mismatched: 55,
    'insufficient-evidence': 60,
    'inaccessible-source': 40,
  }, 'Batch 6 historical totals do not reconcile from the record-level moves')
  // Every record still lands somewhere: the deltas must cancel.
  assert.equal(
    Object.values(delta).reduce((a, b) => a + b, 0),
    0,
  )
})

test('the inaccessible reduction is explainable record by record', () => {
  const left = [...B6_COHORT, ...B6_REINSPECT].filter(
    (entry) => priorVerdict(entry) === 'inaccessible-source' && batch6State(entry).verdict !== 'inaccessible-source',
  )
  const entered = [...B6_COHORT, ...B6_REINSPECT].filter(
    (entry) => priorVerdict(entry) !== 'inaccessible-source' && batch6State(entry).verdict === 'inaccessible-source',
  )
  assert.equal(entered.length, 0, 'a record entered inaccessible without explanation')
  assert.equal(left.length, 10, 'the inaccessible reduction is not ten records')
  // Each one left because its source was actually opened.
  for (const entry of left) {
    assert.ok(batch6State(entry).sourceContentInspected, `${entry.recordId} left inaccessible without inspection`)
  }
  assert.equal(50 - left.length, 40)
})

test('PP1802 moves only after the official complete book is inspected', () => {
  // Batch 8 found an official USGS route after the historical HTTP 403s. The
  // active state can move only because each record now carries a content
  // location and a bounded per-record judgement.
  const pp = FRONTIER_ALIGNMENT_AUDIT.filter(
    (entry) => entry.sourceContractId === 'source-critical-supply-chains-pp1802',
  )
  assert.equal(pp.length, 5)
  for (const entry of pp) {
    assert.notEqual(entry.evidence.subjectAligned, 'inaccessible-source', `${entry.recordId} remained inaccessible`)
    assert.equal(entry.evidence.sourceContentInspected, true)
    assert.ok(entry.evidence.inspectedContentLocation)
  }
})

test('the generated report states the same counts as the audit', () => {
  const root = new URL('..', import.meta.url).pathname
  const report = readFileSync(join(root, 'docs/frontier-audit/source-alignment-report.md'), 'utf8')
  const cohortRow = report.match(/\| cohort \| (\d+) \| (\d+) \| (\d+) \|/)
  assert.ok(cohortRow, 'the report has no cohort row')
  assert.equal(Number(cohortRow[1]), B6_COHORT.length)
  assert.equal(Number(cohortRow[2]), activeInspectedIn(B6_COHORT))
  assert.equal(Number(cohortRow[3]), B6_COHORT.length - activeInspectedIn(B6_COHORT))
  const reinRow = report.match(/\| re-inspections \| (\d+) \| (\d+) \| (\d+) \|/)
  assert.ok(reinRow, 'the report has no re-inspection row')
  assert.equal(Number(reinRow[1]), B6_REINSPECT.length)
  assert.equal(Number(reinRow[2]), activeInspectedIn(B6_REINSPECT))
  const newly = report.match(/\*\*newly inspected\*\* \| — \| \*\*(\d+)\*\*/)
  assert.ok(newly, 'the report does not state a newly-inspected total')
  assert.equal(Number(newly[1]), activeInspectedIn(B6_COHORT) + activeInspectedIn(B6_REINSPECT))
})

test('the report lists every cohort and re-inspection record exactly once', () => {
  const root = new URL('..', import.meta.url).pathname
  const report = readFileSync(join(root, 'docs/frontier-audit/source-alignment-report.md'), 'utf8')
  const cohortSection = report.slice(report.indexOf('### Cohort, all forty records'), report.indexOf('### Re-inspections'))
  // Count only the record column. A slug can also name its own source
  // contract - intracortical-bci does - so a bare substring count would match
  // the contract column of every row in that block.
  const recordCells = cohortSection
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.slice(3, line.indexOf('`', 3)))
  assert.equal(recordCells.length, 40, 'the cohort table does not have forty rows')
  for (const entry of B6_COHORT) {
    const slug = entry.recordId.replace('urn:maha:record:', '')
    const hits = recordCells.filter((cell) => cell === slug).length
    assert.equal(hits, 1, `${slug} appears ${hits} times in the cohort record column`)
  }
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
    contentInspected: 36,
    inaccessible: 4,
    supported: 13,
    partiallySupported: 10,
    mismatched: 13,
    insufficientEvidence: 0,
    alignmentClear: 13,
  })
})
