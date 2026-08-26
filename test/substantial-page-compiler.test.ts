import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { EPISTEMIC_RECORDS, PUBLIC_EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { compileSubstantialPage } from '../lib/substantial-page-compiler.ts'
import { compilePilots, PILOT_SPECS } from '../lib/substantial-page-pilots.ts'
import { alignmentFor } from '../lib/frontier-source-alignment.ts'
import { evaluateSubstantialPageGate } from '../lib/substantial-page.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import {
  QBR_ENDPOINT_CLOSURE_PLAN,
  classificationTotals,
  countsAsResolution,
  liveOutcome,
} from '../lib/endpoint-closure-plan.ts'
import { QUANTUM_BRIDGE_AUDIT, buildGapReport } from '../lib/quantum-bridge-audit-package.ts'
import { ENDPOINT_CANDIDATES, promotableEndpointCandidates } from '../lib/bridge-endpoint-candidates.ts'
import { isResolvedOutcome, resolveEpistemicReference } from '../lib/epistemic-reference-resolver.ts'

const PILOTS = compilePilots()
const byId = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))

/* ------------------------------------------------- ids cannot be invented -- */

test('the compiler refuses a claim id that is not on the record', () => {
  const record = byId.get(PILOTS[0].contract.recordId)!
  assert.throws(
    () =>
      compileSubstantialPage({
        record,
        graph: EPISTEMIC_RECORDS,
        searchIntent: PILOT_SPECS[0].searchIntent,
        editorial: {
          directAnswer: 'x'.repeat(120),
          directAnswerClaimIds: ['urn:maha:claim:not-a-real-claim'],
          sections: [],
          originalContribution: 'y'.repeat(120),
        },
        comparison: { status: 'not-applicable', rationale: 'z'.repeat(60) },
        calculation: { status: 'not-applicable', rationale: 'z'.repeat(60) },
      }),
    /is not on this record|cites unknown claim/,
  )
})

test('every compiled source id belongs to the record and to the cited claim', () => {
  for (const pilot of PILOTS) {
    const record = byId.get(pilot.contract.recordId)!
    const recordSources = new Set(record.sources.map((source) => source.id))
    const claimSources = new Map(record.claims.map((claim) => [claim.id, new Set(claim.sourceIds)]))
    const groups = [
      pilot.contract.directAnswer,
      ...pilot.contract.explanations,
      ...pilot.contract.comparison.axes,
      pilot.contract.calculation,
    ]
    for (const group of groups) {
      for (const sourceId of group.sourceIds) {
        assert.ok(recordSources.has(sourceId), `${pilot.slug}: source ${sourceId} is not on the record`)
        assert.ok(
          group.claimIds.some((claimId) => claimSources.get(claimId)?.has(sourceId)),
          `${pilot.slug}: source ${sourceId} does not support any cited claim`,
        )
      }
    }
  }
})

test('a real source from another record can never reach a compiled page', () => {
  // The compiler derives sources from claims, so there is no input to smuggle
  // an unrelated-but-real source through. This proves the absence directly.
  for (const pilot of PILOTS) {
    const record = byId.get(pilot.contract.recordId)!
    const foreign = EPISTEMIC_RECORDS.filter((entry) => entry.id !== record.id).flatMap((entry) =>
      entry.sources.map((source) => source.id),
    )
    const own = new Set(record.sources.map((source) => source.id))
    const rendered = new Set([
      ...pilot.contract.directAnswer.sourceIds,
      ...pilot.contract.explanations.flatMap((section) => section.sourceIds),
    ])
    for (const sourceId of rendered) {
      if (own.has(sourceId)) continue
      assert.ok(!foreign.includes(sourceId), `${pilot.slug} rendered a source belonging to another record`)
    }
  }
})

test('the gate rejects a contract that pairs a claim with a real but unsupporting source', () => {
  const pilot = PILOTS[0]
  const record = byId.get(pilot.contract.recordId)!
  const foreign = EPISTEMIC_RECORDS.find((entry) => entry.id !== record.id && entry.sources.length)!
  const tampered = {
    ...pilot.contract,
    directAnswer: { ...pilot.contract.directAnswer, sourceIds: [foreign.sources[0].id] },
  }
  const decision = evaluateSubstantialPageGate(record, tampered, EPISTEMIC_RECORDS)
  assert.equal(decision.pageEligible, false)
  assert.ok(decision.reasons.some((reason) => reason.startsWith('direct-answer-source-unresolved')))
})

test('every claim on the record is rendered by some section and resolves to its source', () => {
  for (const pilot of PILOTS) {
    const record = byId.get(pilot.contract.recordId)!
    const explained = new Set(pilot.contract.explanations.flatMap((section) => section.claimIds))
    for (const claim of record.claims) {
      assert.ok(explained.has(claim.id), `${pilot.slug}: claim ${claim.id} is never explained`)
    }
    for (const section of pilot.contract.explanations) {
      assert.ok(section.sourceIds.length > 0, `${pilot.slug}: a section cites claims but no source`)
    }
  }
})

/* ----------------------------------------------------------- limitations -- */

test('every record boundary and prohibited inference is rendered exactly once', () => {
  for (const pilot of PILOTS) {
    const record = byId.get(pilot.contract.recordId)!
    const boundaries = pilot.contract.limitations.filter((item) => item.basis === 'record-boundary')
    const prohibitions = pilot.contract.limitations.filter((item) => item.basis === 'prohibited-inference')
    assert.deepEqual(
      boundaries.map((item) => item.basisIndex).sort((a, b) => (a as number) - (b as number)),
      record.boundaries.map((_, index) => index),
      `${pilot.slug}: boundaries are not rendered exactly once`,
    )
    assert.deepEqual(
      prohibitions.map((item) => item.basisIndex).sort((a, b) => (a as number) - (b as number)),
      record.prohibitedInferences.map((_, index) => index),
      `${pilot.slug}: prohibited inferences are not rendered exactly once`,
    )
    for (const item of boundaries) assert.equal(item.statement, record.boundaries[item.basisIndex as number])
    for (const item of prohibitions) {
      assert.equal(item.statement, record.prohibitedInferences[item.basisIndex as number])
    }
  }
})

test('an editorial limitation is additive and never replaces a record limitation', () => {
  for (const pilot of PILOTS) {
    const record = byId.get(pilot.contract.recordId)!
    const editorial = pilot.contract.limitations.filter((item) => item.basis === 'editorial')
    for (const item of editorial) assert.equal(item.basisIndex, null)
    assert.ok(
      pilot.contract.limitations.length >= record.boundaries.length + record.prohibitedInferences.length,
      `${pilot.slug}: editorial limitations displaced record limitations`,
    )
  }
})

/* -------------------------------------------------------- related records -- */

test('related records are canonical, resolved, unique and never self-links', () => {
  const canonical = new Set(EPISTEMIC_RECORDS.map((record) => record.id))
  for (const pilot of PILOTS) {
    const ids = pilot.contract.relatedRecords.map((related) => related.recordId)
    assert.equal(new Set(ids).size, ids.length, `${pilot.slug}: duplicate related record`)
    assert.ok(ids.length >= 3, `${pilot.slug}: fewer than three related records`)
    for (const id of ids) {
      assert.ok(canonical.has(id), `${pilot.slug}: related record ${id} is not canonical`)
      assert.notEqual(id, pilot.contract.recordId, `${pilot.slug}: related record self-link`)
    }
  }
})

test('every related record was selected by a declared tier, never by keyword similarity', () => {
  for (const pilot of PILOTS) {
    const record = byId.get(pilot.contract.recordId)!
    for (const selection of pilot.selectionTrace) {
      const target = byId.get(selection.recordId)!
      if (selection.tier === 'bridge-edge') {
        const linked =
          record.bridges.some((bridge) => bridge.targetConceptId === target.id)
          || target.bridges.some((bridge) => bridge.targetConceptId === record.id)
        assert.ok(linked, `${pilot.slug}: ${target.id} claims a bridge edge that does not exist`)
      } else if (selection.tier === 'shared-source') {
        const keys = new Set(record.sources.map((s) => s.identifiers?.[0]?.value ?? s.url ?? s.title))
        assert.ok(
          target.sources.some((s) => keys.has(s.identifiers?.[0]?.value ?? s.url ?? s.title)),
          `${pilot.slug}: ${target.id} claims a shared source it does not have`,
        )
      } else {
        assert.equal(target.domainSlug, record.domainSlug)
      }
    }
  }
})

/* ------------------------------------------------------------- coverage --- */

test('a not-applicable comparison or calculation leaves every content field empty', () => {
  for (const pilot of PILOTS) {
    if (pilot.contract.comparison.status === 'not-applicable') {
      assert.deepEqual(pilot.contract.comparison.axes, [], `${pilot.slug}: not-applicable comparison has axes`)
      assert.ok(pilot.contract.comparison.rationale.length >= 40)
    }
    if (pilot.contract.calculation.status === 'not-applicable') {
      const calculation = pilot.contract.calculation
      assert.equal(calculation.method, '')
      assert.equal(calculation.expression, '')
      assert.deepEqual(calculation.inputs, [])
      assert.deepEqual(calculation.assumptions, [])
      assert.equal(calculation.reproducibility, '')
      assert.deepEqual(calculation.claimIds, [])
      assert.deepEqual(calculation.sourceIds, [])
      assert.ok(calculation.rationale.length >= 40)
    }
  }
})

test('a not-applicable calculation stays empty even when the caller supplies content', () => {
  const record = byId.get(PILOTS[0].contract.recordId)!
  const compiled = compileSubstantialPage({
    record,
    graph: EPISTEMIC_RECORDS,
    searchIntent: PILOT_SPECS[0].searchIntent,
    editorial: {
      directAnswer: PILOT_SPECS[0].editorial.directAnswer,
      directAnswerClaimIds: [record.claims[0].id],
      sections: PILOT_SPECS[0].editorial.sections.map((section) => ({ ...section, claimIds: [record.claims[0].id] })),
      originalContribution: PILOT_SPECS[0].editorial.originalContribution,
    },
    comparison: { status: 'not-applicable', rationale: 'r'.repeat(60) },
    calculation: {
      status: 'not-applicable',
      rationale: 'r'.repeat(60),
      method: 'should be dropped',
      expression: 'E = mc^2',
      inputs: ['dropped'],
      assumptions: ['dropped'],
      reproducibility: 'dropped',
      claimIds: [record.claims[0].id],
    },
  })
  assert.equal(compiled.contract.calculation.expression, '')
  assert.deepEqual(compiled.contract.calculation.inputs, [])
  assert.deepEqual(compiled.contract.calculation.sourceIds, [])
  assert.ok(!compiled.decision.reasons.includes('calculation-not-applicable-conflict'))
})

/* ------------------------------------------------------------ provenance -- */

test('a compiled page binds to the record revision hash', () => {
  for (const pilot of PILOTS) {
    const record = byId.get(pilot.contract.recordId)!
    assert.equal(pilot.contract.recordRevisionSha256, epistemicReviewTargetHash(record))
  }
})

test('a material record change stales the page contract', () => {
  const pilot = PILOTS[0]
  const record = byId.get(pilot.contract.recordId)!
  const mutated = { ...record, description: `${record.description} materially changed` }
  assert.notEqual(epistemicReviewTargetHash(mutated), pilot.contract.recordRevisionSha256)
  const decision = evaluateSubstantialPageGate(mutated, pilot.contract, EPISTEMIC_RECORDS)
  assert.equal(decision.pageEligible, false)
  assert.ok(decision.reasons.includes('page-record-revision-stale'))
})

test('compilation is byte-for-byte deterministic', () => {
  const first = compilePilots()
  const second = compilePilots()
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  for (const [index, pilot] of first.entries()) {
    assert.equal(pilot.contractDigest, second[index].contractDigest)
    assert.match(pilot.contractDigest, /^sha256:[a-f0-9]{64}$/)
  }
  assert.equal(new Set(first.map((pilot) => pilot.contractDigest)).size, first.length)
})

test('blocker ordering is sorted, so it cannot depend on evaluation order', () => {
  for (const pilot of PILOTS) {
    assert.deepEqual(pilot.decision.reasons, [...pilot.decision.reasons].sort())
  }
})

/* ---------------------------------------------------------- search intent -- */

test('search intent cannot promise traffic, rankings or commercial outcomes', () => {
  for (const pilot of PILOTS) {
    const intent = pilot.contract.searchIntent
    assert.match(intent.trafficNonClaim, /does not guarantee|no guarantee/i)
    const promissory = /\b(guaranteed traffic|rank(?:s|ing)? (?:first|#1|number one)|top of google|drive traffic|boost traffic|increase (?:traffic|revenue|sales))\b/i
    for (const field of [intent.primaryQuery, intent.readerQuestion, intent.audience, intent.readerOutcome, intent.title, intent.description]) {
      assert.doesNotMatch(field, promissory, `${pilot.slug}: search intent promises an outcome`)
    }
    // Query variants must be distinct phrasings, not one phrase repeated.
    assert.equal(new Set(intent.queryVariants).size, intent.queryVariants.length)
    assert.equal(new Set(intent.supportingQuestions).size, intent.supportingQuestions.length)
  }
})

/* ------------------------------------------------- pilots stay unpublished - */

test('no pilot record is publicly projected', () => {
  const publicIds = new Set(PUBLIC_EPISTEMIC_RECORDS.map((record) => record.id))
  for (const pilot of PILOTS) {
    assert.ok(!publicIds.has(pilot.contract.recordId), `${pilot.slug} is publicly projected`)
    const record = byId.get(pilot.contract.recordId)!
    assert.equal(record.publication.requestedPublicPromotion, false)
    assert.notEqual(record.publication.reviewState, 'published-canonical')
  }
})

test('pilot artifacts are unlinked from routes, sitemap and llms.txt', () => {
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
  for (const marker of ['substantial-page-pilots', 'substantial-page-compiler', 'content/substantial-pages', 'docs/substantial-pages']) {
    assert.ok(!routeSources.includes(marker), `${marker} is referenced from a route`)
  }
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const source of [sitemap, llms]) {
    assert.doesNotMatch(source, /substantial-page|substantial-pages/)
  }
})

test('the pilot artifacts regenerate byte for byte', () => {
  const root = new URL('..', import.meta.url).pathname
  const generated = [
    'docs/substantial-pages/pilot-batch-assessment.md',
    'content/substantial-pages/pilot-contracts.json',
    ...PILOT_SPECS.map((spec) => `docs/substantial-pages/${spec.slug}.md`),
  ]
  const before = generated.map((path) => readFileSync(join(root, path), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-substantial-page-pilots.ts')], { cwd: root })
  generated.forEach((path, index) => {
    assert.equal(readFileSync(join(root, path), 'utf8'), before[index], `${path} is not deterministic`)
  })
})

/* ------------------------------------------------------ source alignment -- */

test('the two corrected records cite a source about their own subject', () => {
  // Regression guard. Both records previously inherited a positional block
  // source that studied something else: hBN dielectrics cited a paper on
  // atomically thin carbon, and spike-sorting boundaries cited a probe paper.
  const expected: Record<string, string> = {
    'advanced-materials-hexagonal-boron-nitride-dielectrics': '10.1038/nnano.2010.172',
    'neurotechnology-bci-spike-sorting-boundaries': '10.1523/JNEUROSCI.0971-11.2011',
  }
  for (const [slug, doi] of Object.entries(expected)) {
    const record = EPISTEMIC_RECORDS.find((entry) => entry.slug === slug)
    assert.ok(record, `${slug} is missing`)
    assert.equal(record.sources.length, 1)
    assert.equal(record.sources[0].identifiers?.[0]?.value, doi, `${slug} lost its corrected source`)
    assert.ok(record.sources[0].exactLocator.length > 20, `${slug} has no exact locator`)
    assert.ok(record.sources[0].rights.basis, `${slug} has no rights basis`)
    for (const claim of record.claims) {
      assert.deepEqual(claim.sourceIds, [record.sources[0].id], `${slug} claim still points at the old source`)
    }
  }
})

test('no record cites the superseded block source for a subject it does not study', () => {
  const hbn = EPISTEMIC_RECORDS.find((r) => r.slug === 'advanced-materials-hexagonal-boron-nitride-dielectrics')!
  assert.doesNotMatch(hbn.sources[0].title, /Atomically Thin Carbon/i)
  const spike = EPISTEMIC_RECORDS.find((r) => r.slug === 'neurotechnology-bci-spike-sorting-boundaries')!
  assert.doesNotMatch(spike.sources[0].title, /silicon probes/i)
})

test('a pilot reports the audit verdict rather than asserting its own alignment', () => {
  // This previously asserted that all eight pilots were subject-supported,
  // which was a claim the pilot made about itself. Alignment is now read from
  // the audit, which requires an inspected source, so most pilots correctly
  // report that their mapping has not been established.
  for (const pilot of PILOTS) {
    const audit = alignmentFor(pilot.contract.recordId)
    assert.ok(audit, `${pilot.slug} has no audit entry`)
    assert.equal(pilot.sourceAlignment, audit.evidence.subjectAligned)
    if (pilot.sourceAlignment === 'supported') assert.ok(audit.evidence.sourceInspected)
  }
  assert.equal(PILOTS.filter((pilot) => pilot.sourceAlignment === 'supported').length, 4)
})

/* ------------------------------------------------- revise-reference & bridges */

test('revise-reference never counts as a resolution', () => {
  const revise = QBR_ENDPOINT_CLOSURE_PLAN.entries.filter((entry) => entry.classification === 'revise-reference')
  assert.equal(revise.length, 3)
  for (const entry of revise) {
    assert.equal(countsAsResolution(entry), false)
    assert.equal(liveOutcome(entry), 'unresolved-record')
    assert.ok(!isResolvedOutcome(resolveEpistemicReference(entry.submittedReference).outcome))
    assert.equal(entry.proposedCanonicalId, null)
    assert.ok(entry.proposedReplacementRecordIds?.length, `${entry.key} has no proposed replacement`)
    assert.ok(entry.reasoning.length > 80)
    assert.ok(['high', 'medium', 'low'].includes(entry.confidence))
  }
})

test('a revise-reference replacement is canonical and is not the submitted reference', () => {
  const canonical = new Set(EPISTEMIC_RECORDS.map((record) => record.id))
  for (const entry of QBR_ENDPOINT_CLOSURE_PLAN.entries) {
    for (const replacement of entry.proposedReplacementRecordIds ?? []) {
      assert.ok(canonical.has(replacement), `${entry.key} proposes noncanonical ${replacement}`)
      assert.notEqual(replacement, entry.submittedReference)
    }
  }
})

test('revise-reference clears no endpoint or source blocker', () => {
  const totals = buildGapReport().blockerTotals
  assert.equal(totals['endpoint-unresolved-record'], 12)
  assert.equal(totals['source-missing-locator'], 12)
  assert.equal(totals['source-unverifiable'], 4)
  assert.equal(totals['claim-strength-rejected'], 7)
  assert.equal(totals['classification-unmappable'], 7)
  // The two endpoints reclassified out of blocked-pending-evidence keep theirs.
  for (const key of ['Q-BR-010B', 'Q-BR-011B']) {
    const entry = QBR_ENDPOINT_CLOSURE_PLAN.entries.find((item) => item.key === key)!
    assert.ok(entry.blockers.includes('source-unverifiable'), `${key} lost its source blocker`)
  }
})

test('the endpoint classification counts are pinned', () => {
  assert.deepEqual(classificationTotals(QBR_ENDPOINT_CLOSURE_PLAN), {
    'existing-record-alias': 1,
    'new-record-candidate': 9,
    'compound-endpoint': 4,
    'invalid-endpoint': 1,
    'incompatible-record-class': 4,
    'blocked-pending-evidence': 1,
    'revise-reference': 3,
  })
  assert.equal(QBR_ENDPOINT_CLOSURE_PLAN.entries.length, 23)
})

test('canonical resolution stays at 2 of 24', () => {
  const totals = buildGapReport().endpointTotals
  assert.equal(totals['alias-resolution'], 2)
  assert.equal(totals['unresolved-record'], 22)
  assert.equal(totals['exact-resolution'] ?? 0, 0)
})

test('all twelve Q-BR bridges remain BLOCK and none is promoted', () => {
  assert.equal(QUANTUM_BRIDGE_AUDIT.length, 12)
  for (const bridge of QUANTUM_BRIDGE_AUDIT) {
    assert.equal(bridge.verdict, 'BLOCK', `${bridge.id} changed verdict`)
    assert.equal(bridge.promotionEligible, false)
  }
  assert.deepEqual(buildGapReport().verdictTotals, { BLOCK: 12 })
})

test('bridge candidates remain noncanonical and non-promotable', () => {
  const canonical = new Set(EPISTEMIC_RECORDS.map((record) => record.id))
  assert.deepEqual([...promotableEndpointCandidates()], [])
  for (const candidate of ENDPOINT_CANDIDATES) {
    assert.ok(!canonical.has(candidate.id))
    assert.ok(!canonical.has(candidate.proposedCanonicalId))
    assert.equal(candidate.canonical, false)
    assert.equal(candidate.isPromotedToPublicPage, false)
  }
})

test('no pilot is a bridge endpoint candidate', () => {
  const candidateIds = new Set(ENDPOINT_CANDIDATES.map((candidate) => candidate.proposedCanonicalId))
  for (const pilot of PILOTS) {
    assert.ok(!candidateIds.has(pilot.contract.recordId), `${pilot.slug} is a bridge endpoint candidate`)
  }
})
