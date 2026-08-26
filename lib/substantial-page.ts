import type { EpistemicRecord } from './epistemic-schema.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'

export const SUBSTANTIAL_PAGE_SCHEMA_VERSION = 'maha-substantial-page/0.1' as const
export const SUBSTANTIAL_PAGE_RELATIONS = ['prerequisite', 'mechanism', 'measurement', 'comparison', 'application', 'boundary'] as const

export type SubstantialPageRelation = (typeof SUBSTANTIAL_PAGE_RELATIONS)[number]
export type CoverageStatus = 'included' | 'not-applicable'

export interface SearchIntentContract {
  primaryQuery: string
  readerQuestion: string
  audience: string
  readerOutcome: string
  supportingQuestions: string[]
  queryVariants: string[]
  title: string
  description: string
  trafficNonClaim: string
}

export interface SourceBoundExplanation {
  heading: string
  paragraphs: string[]
  claimIds: string[]
  sourceIds: string[]
}

export interface ComparisonAxis {
  axis: string
  left: string
  right: string
  interpretationBoundary: string
  claimIds: string[]
  sourceIds: string[]
}

export interface ComparisonCoverage {
  status: CoverageStatus
  rationale: string
  axes: ComparisonAxis[]
}

export interface CalculationCoverage {
  status: CoverageStatus
  rationale: string
  method: string
  expression: string
  inputs: string[]
  assumptions: string[]
  reproducibility: string
  claimIds: string[]
  sourceIds: string[]
}

export interface LimitationCoverage {
  statement: string
  basis: 'record-boundary' | 'prohibited-inference' | 'editorial'
  basisIndex: number | null
}

export interface RelatedRecordLink {
  recordId: string
  relation: SubstantialPageRelation
  rationale: string
}

export interface SubstantialPageContract {
  schemaVersion: typeof SUBSTANTIAL_PAGE_SCHEMA_VERSION
  recordId: string
  recordRevisionSha256: string
  directAnswer: {
    text: string
    claimIds: string[]
    sourceIds: string[]
  }
  searchIntent: SearchIntentContract
  explanations: SourceBoundExplanation[]
  comparison: ComparisonCoverage
  calculation: CalculationCoverage
  limitations: LimitationCoverage[]
  relatedRecords: RelatedRecordLink[]
  originalContribution: string
}

export interface SubstantialPageDecision {
  recordId: string
  pageEligible: boolean
  evaluatedAgainst: typeof SUBSTANTIAL_PAGE_SCHEMA_VERSION
  reasons: string[]
  measures: {
    explanationSections: number
    explanationParagraphs: number
    comparisonAxes: number
    calculationInputs: number
    limitations: number
    relatedRecords: number
    supportingQuestions: number
  }
}

function meaningful(value: string, minimum: number): boolean {
  return value.trim().length >= minimum
}

function validateReferences(
  reasons: string[],
  label: string,
  claimIds: readonly string[],
  sourceIds: readonly string[],
  knownClaims: ReadonlySet<string>,
  knownSources: ReadonlySet<string>,
  claimSources: ReadonlyMap<string, ReadonlySet<string>>,
): void {
  if (!claimIds.length) reasons.push(`${label}-claims-missing`)
  if (!sourceIds.length) reasons.push(`${label}-sources-missing`)
  for (const claimId of claimIds) {
    if (!knownClaims.has(claimId)) reasons.push(`${label}-claim-unresolved:${claimId}`)
    else if (![...claimSources.get(claimId)!].some((sourceId) => sourceIds.includes(sourceId))) reasons.push(`${label}-claim-source-misaligned:${claimId}`)
  }
  for (const sourceId of sourceIds) if (!knownSources.has(sourceId)) reasons.push(`${label}-source-unresolved:${sourceId}`)
}

export function evaluateSubstantialPageGate(
  record: EpistemicRecord,
  page: SubstantialPageContract,
  graph: readonly EpistemicRecord[],
): SubstantialPageDecision {
  const reasons: string[] = []
  const knownClaims = new Set(record.claims.map((claim) => claim.id))
  const knownSources = new Set(record.sources.map((source) => source.id))
  const claimSources = new Map(record.claims.map((claim) => [claim.id, new Set(claim.sourceIds)]))
  const knownRecords = new Set(graph.map((entry) => entry.id))

  if (page.schemaVersion !== SUBSTANTIAL_PAGE_SCHEMA_VERSION) reasons.push('page-schema-version-mismatch')
  if (page.recordId !== record.id) reasons.push('page-record-mismatch')
  if (page.recordRevisionSha256 !== epistemicReviewTargetHash(record)) reasons.push('page-record-revision-stale')

  if (!meaningful(page.directAnswer.text, 80)) reasons.push('direct-answer-too-thin')
  validateReferences(reasons, 'direct-answer', page.directAnswer.claimIds, page.directAnswer.sourceIds, knownClaims, knownSources, claimSources)

  const intent = page.searchIntent
  if (!meaningful(intent.primaryQuery, 8)) reasons.push('primary-query-missing')
  if (!meaningful(intent.readerQuestion, 20)) reasons.push('reader-question-missing')
  if (!meaningful(intent.audience, 10)) reasons.push('audience-missing')
  if (!meaningful(intent.readerOutcome, 40)) reasons.push('reader-outcome-missing')
  if (intent.supportingQuestions.length < 3 || intent.supportingQuestions.length > 8) reasons.push('supporting-question-coverage-invalid')
  if (intent.queryVariants.length < 3 || intent.queryVariants.length > 8) reasons.push('query-variant-coverage-invalid')
  if (!meaningful(intent.title, 30) || intent.title.length > 70) reasons.push('search-title-invalid')
  if (!meaningful(intent.description, 100) || intent.description.length > 180) reasons.push('search-description-invalid')
  if (!/does not guarantee|no guarantee/i.test(intent.trafficNonClaim)) reasons.push('traffic-nonclaim-missing')

  if (page.explanations.length < 3) reasons.push('explanation-coverage-insufficient')
  const explainedClaims = new Set<string>()
  page.explanations.forEach((section, index) => {
    const label = `explanation-${index + 1}`
    if (!meaningful(section.heading, 5)) reasons.push(`${label}-heading-missing`)
    if (section.paragraphs.length < 2 || section.paragraphs.some((paragraph) => !meaningful(paragraph, 80))) reasons.push(`${label}-content-too-thin`)
    validateReferences(reasons, label, section.claimIds, section.sourceIds, knownClaims, knownSources, claimSources)
    section.claimIds.forEach((claimId) => explainedClaims.add(claimId))
  })
  for (const claimId of knownClaims) if (!explainedClaims.has(claimId)) reasons.push(`claim-not-explained:${claimId}`)

  if (!meaningful(page.comparison.rationale, 40)) reasons.push('comparison-rationale-missing')
  if (page.comparison.status === 'included') {
    if (!page.comparison.axes.length) reasons.push('comparison-axis-missing')
    page.comparison.axes.forEach((axis, index) => {
      const label = `comparison-${index + 1}`
      if (![axis.axis, axis.left, axis.right, axis.interpretationBoundary].every((value) => meaningful(value, 20))) reasons.push(`${label}-content-incomplete`)
      validateReferences(reasons, label, axis.claimIds, axis.sourceIds, knownClaims, knownSources, claimSources)
    })
  } else if (page.comparison.axes.length) reasons.push('comparison-not-applicable-conflict')

  if (!meaningful(page.calculation.rationale, 40)) reasons.push('calculation-rationale-missing')
  if (page.calculation.status === 'included') {
    if (!meaningful(page.calculation.method, 30)) reasons.push('calculation-method-missing')
    if (!meaningful(page.calculation.expression, 3)) reasons.push('calculation-expression-missing')
    if (!page.calculation.inputs.length) reasons.push('calculation-inputs-missing')
    if (!page.calculation.assumptions.length) reasons.push('calculation-assumptions-missing')
    if (!meaningful(page.calculation.reproducibility, 40)) reasons.push('calculation-reproducibility-missing')
    validateReferences(reasons, 'calculation', page.calculation.claimIds, page.calculation.sourceIds, knownClaims, knownSources, claimSources)
  } else if (
    page.calculation.method || page.calculation.expression || page.calculation.inputs.length
    || page.calculation.assumptions.length || page.calculation.reproducibility
    || page.calculation.claimIds.length || page.calculation.sourceIds.length
  ) reasons.push('calculation-not-applicable-conflict')

  if (page.limitations.length < 3) reasons.push('limitation-coverage-insufficient')
  const coveredBoundaries = new Set<number>()
  const coveredProhibited = new Set<number>()
  page.limitations.forEach((limitation, index) => {
    if (!meaningful(limitation.statement, 40)) reasons.push(`limitation-${index + 1}-too-thin`)
    if (limitation.basis === 'record-boundary') {
      if (limitation.basisIndex === null || !record.boundaries[limitation.basisIndex]) reasons.push(`limitation-${index + 1}-boundary-unresolved`)
      else coveredBoundaries.add(limitation.basisIndex)
    }
    if (limitation.basis === 'prohibited-inference') {
      if (limitation.basisIndex === null || !record.prohibitedInferences[limitation.basisIndex]) reasons.push(`limitation-${index + 1}-prohibition-unresolved`)
      else coveredProhibited.add(limitation.basisIndex)
    }
    if (limitation.basis === 'editorial' && limitation.basisIndex !== null) reasons.push(`limitation-${index + 1}-editorial-index-conflict`)
  })
  record.boundaries.forEach((_, index) => { if (!coveredBoundaries.has(index)) reasons.push(`record-boundary-not-rendered:${index}`) })
  record.prohibitedInferences.forEach((_, index) => { if (!coveredProhibited.has(index)) reasons.push(`prohibited-inference-not-rendered:${index}`) })

  if (page.relatedRecords.length < 3) reasons.push('related-record-coverage-insufficient')
  if (new Set(page.relatedRecords.map((related) => related.recordId)).size !== page.relatedRecords.length) reasons.push('duplicate-related-record')
  page.relatedRecords.forEach((related, index) => {
    if (related.recordId === record.id) reasons.push(`related-record-self-reference:${index + 1}`)
    if (!knownRecords.has(related.recordId)) reasons.push(`related-record-unresolved:${related.recordId}`)
    if (!SUBSTANTIAL_PAGE_RELATIONS.includes(related.relation)) reasons.push(`related-record-relation-invalid:${index + 1}`)
    if (!meaningful(related.rationale, 30)) reasons.push(`related-record-rationale-missing:${index + 1}`)
  })

  if (!meaningful(page.originalContribution, 80)) reasons.push('original-contribution-missing')

  return {
    recordId: record.id,
    pageEligible: reasons.length === 0,
    evaluatedAgainst: SUBSTANTIAL_PAGE_SCHEMA_VERSION,
    reasons: [...new Set(reasons)],
    measures: {
      explanationSections: page.explanations.length,
      explanationParagraphs: page.explanations.reduce((total, section) => total + section.paragraphs.length, 0),
      comparisonAxes: page.comparison.axes.length,
      calculationInputs: page.calculation.inputs.length,
      limitations: page.limitations.length,
      relatedRecords: page.relatedRecords.length,
      supportingQuestions: page.searchIntent.supportingQuestions.length,
    },
  }
}
