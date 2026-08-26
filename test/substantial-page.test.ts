import assert from 'node:assert/strict'
import test from 'node:test'

import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import {
  SUBSTANTIAL_PAGE_SCHEMA_VERSION,
  evaluateSubstantialPageGate,
  type SubstantialPageContract,
} from '../lib/substantial-page.ts'

const record = EPISTEMIC_RECORDS[0]
const related = EPISTEMIC_RECORDS.filter((entry) => entry.id !== record.id).slice(0, 3)
const claim = record.claims[0]
const source = record.sources[0]

function paragraph(label: string): string {
  return `${label} explains the bounded record in enough detail for a reader to distinguish the cited result, its operating scope, and the questions that remain unresolved.`
}

function fixture(): SubstantialPageContract {
  return {
    schemaVersion: SUBSTANTIAL_PAGE_SCHEMA_VERSION,
    recordId: record.id,
    recordRevisionSha256: epistemicReviewTargetHash(record),
    directAnswer: {
      text: `This page explains ${record.title} from the record's cited claim, while keeping the source scope, uncertainty, and prohibited inferences visible to the reader.`,
      claimIds: [claim.id],
      sourceIds: [source.id],
    },
    searchIntent: {
      primaryQuery: `${record.title} explained`,
      readerQuestion: `What does ${record.title} mean, how is it evaluated, and what does the evidence not establish?`,
      audience: 'Technical readers evaluating the underlying method and evidence boundaries.',
      readerOutcome: 'The reader can explain the mechanism, inspect the evidence chain, and identify what cannot be inferred.',
      supportingQuestions: ['What is the mechanism?', 'How is it measured?', 'What are its limitations?'],
      queryVariants: [`${record.title} mechanism`, `${record.title} evidence`, `${record.title} limitations`],
      title: `${record.title}: mechanism, evidence, and limits`,
      description: `A source-bound explanation of ${record.title}, including the mechanism, evidentiary scope, uncertainty, related concepts, and explicit limits on interpretation.`,
      trafficNonClaim: 'Meeting this contract does not guarantee rankings, impressions, traffic, or commercial outcomes.',
    },
    explanations: ['What it is', 'How the evidence works', 'What remains unresolved'].map((heading) => ({
      heading,
      paragraphs: [paragraph(heading), paragraph(`${heading} continued`)],
      claimIds: [claim.id],
      sourceIds: [source.id],
    })),
    comparison: {
      status: 'included',
      rationale: 'A bounded comparison clarifies how the cited configuration differs from a neighboring record without transferring results.',
      axes: [{
        axis: 'Scope represented by each record',
        left: `The present record covers ${record.title} under its declared source conditions.`,
        right: `The related record covers ${related[0].title} under a separate evidence contract.`,
        interpretationBoundary: 'The comparison organizes scope and does not establish superiority or interchangeable performance.',
        claimIds: [claim.id],
        sourceIds: [source.id],
      }],
    },
    calculation: {
      status: 'not-applicable',
      rationale: 'The source-bound record does not expose a reproducible numerical calculation, so adding one would create unsupported precision.',
      method: '', expression: '', inputs: [], assumptions: [], reproducibility: '', claimIds: [], sourceIds: [],
    },
    limitations: [
      ...record.boundaries.map((statement, basisIndex) => ({ statement, basis: 'record-boundary' as const, basisIndex })),
      ...record.prohibitedInferences.map((statement, basisIndex) => ({ statement, basis: 'prohibited-inference' as const, basisIndex })),
    ],
    relatedRecords: related.map((entry, index) => ({
      recordId: entry.id,
      relation: index === 0 ? 'comparison' : index === 1 ? 'measurement' : 'boundary',
      rationale: `This record gives the reader a distinct ${index === 0 ? 'comparison' : index === 1 ? 'measurement' : 'boundary'} context without merging claims.`,
    })),
    originalContribution: 'Maha contributes the explicit alignment of reader intent, claim-level provenance, comparison boundaries, limitations, and graph navigation in one reproducible page contract.',
  }
}

test('a substantial page passes only when all coverage resolves to the frozen record graph', () => {
  const decision = evaluateSubstantialPageGate(record, fixture(), EPISTEMIC_RECORDS)
  assert.equal(decision.pageEligible, true, decision.reasons.join(', '))
  assert.deepEqual(decision.measures, {
    explanationSections: 3,
    explanationParagraphs: 6,
    comparisonAxes: 1,
    calculationInputs: 0,
    limitations: record.boundaries.length + record.prohibitedInferences.length,
    relatedRecords: 3,
    supportingQuestions: 3,
  })
})

test('thin content, unresolved references, and missing limits fail with explicit blockers', () => {
  const page = fixture()
  page.directAnswer.text = 'Thin answer.'
  page.explanations = page.explanations.slice(0, 1)
  page.explanations[0].claimIds = ['urn:maha:claim:not-real']
  page.limitations = []
  page.relatedRecords[0].recordId = 'urn:maha:record:not-real'
  const reasons = evaluateSubstantialPageGate(record, page, EPISTEMIC_RECORDS).reasons
  assert.ok(reasons.includes('direct-answer-too-thin'))
  assert.ok(reasons.includes('explanation-coverage-insufficient'))
  assert.ok(reasons.includes('explanation-1-claim-unresolved:urn:maha:claim:not-real'))
  assert.ok(reasons.includes('limitation-coverage-insufficient'))
  assert.ok(reasons.includes('record-boundary-not-rendered:0'))
  assert.ok(reasons.includes('prohibited-inference-not-rendered:0'))
  assert.ok(reasons.includes('related-record-unresolved:urn:maha:record:not-real'))
})

test('a real source cannot be attached to a claim it does not support', () => {
  const page = fixture()
  const unrelatedSource = EPISTEMIC_RECORDS.find((entry) => entry.id !== record.id)!.sources[0]
  const recordWithUnrelatedSource = { ...record, sources: [...record.sources, unrelatedSource] }
  page.recordRevisionSha256 = epistemicReviewTargetHash(recordWithUnrelatedSource)
  page.explanations[0].sourceIds = [unrelatedSource.id]
  const reasons = evaluateSubstantialPageGate(recordWithUnrelatedSource, page, EPISTEMIC_RECORDS).reasons
  assert.ok(reasons.includes(`explanation-1-claim-source-misaligned:${claim.id}`))
})

test('record changes stale the page and not-applicable coverage cannot hide populated content', () => {
  const page = fixture()
  page.recordRevisionSha256 = 'sha256:stale'
  page.comparison.status = 'not-applicable'
  page.calculation.method = 'A method that should not exist when calculation is declared inapplicable.'
  const reasons = evaluateSubstantialPageGate(record, page, EPISTEMIC_RECORDS).reasons
  assert.ok(reasons.includes('page-record-revision-stale'))
  assert.ok(reasons.includes('comparison-not-applicable-conflict'))
  assert.ok(reasons.includes('calculation-not-applicable-conflict'))
})

test('search framing records intent but must refuse traffic guarantees', () => {
  const page = fixture()
  page.searchIntent.trafficNonClaim = 'This page will rank first and generate traffic.'
  const decision = evaluateSubstantialPageGate(record, page, EPISTEMIC_RECORDS)
  assert.equal(decision.pageEligible, false)
  assert.ok(decision.reasons.includes('traffic-nonclaim-missing'))
})
