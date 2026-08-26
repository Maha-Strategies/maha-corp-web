import { createHash } from 'node:crypto'

import { FRONTIER_CANARY_RECORDS } from './frontier-canonicalization.ts'
import { alignmentBlockers, isAlignmentClear } from './frontier-source-alignment.ts'
import { epistemicRecordPath } from './epistemic-publication.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'
import {
  compileSubstantialPage,
  type CompiledSubstantialPage,
  type EditorialSynthesis,
} from './substantial-page-compiler.ts'
import { evaluateSubstantialPageGate, type SearchIntentContract } from './substantial-page.ts'

export const SUBSTANTIAL_PUBLICATION_VERSION = 'maha-substantial-publication/1.0' as const
export const SUBSTANTIAL_PUBLICATION_DATE = '2026-08-26' as const

/**
 * Frozen before compilation. These are alignment-clear members of the exact
 * 40-record production canary, not previously-uninspected records available to
 * Alignment Batch 6. The two cohorts are therefore disjoint by construction.
 */
export const SUBSTANTIAL_PUBLICATION_RECORD_IDS = [
  'urn:maha:record:fusion-plasma-systems-magnetic-confinement',
  'urn:maha:record:fusion-plasma-systems-toroidal-field-coils',
  'urn:maha:record:fusion-plasma-systems-poloidal-field-coils',
  'urn:maha:record:fusion-plasma-systems-central-solenoid-inductive-drive',
  'urn:maha:record:biomolecular-engineering-protein-backbone-diffusion',
  'urn:maha:record:biomolecular-engineering-unconditional-protein-generation',
  'urn:maha:record:biomolecular-engineering-motif-scaffolding',
  'urn:maha:record:biomolecular-engineering-de-novo-binder-design',
  'urn:maha:record:neurotechnology-bci-neuropixels-cmos-probe',
  'urn:maha:record:neurotechnology-bci-neuropixels-recording-sites',
  'urn:maha:record:neurotechnology-bci-neuropixels-channel-selection',
  'urn:maha:record:neurotechnology-bci-extracellular-spike-recording',
  'urn:maha:record:mechanistic-interpretability-neural-feature-superposition',
  'urn:maha:record:mechanistic-interpretability-polysemantic-neurons',
  'urn:maha:record:mechanistic-interpretability-toy-models-of-superposition',
  'urn:maha:record:mechanistic-interpretability-superposition-geometry',
  'urn:maha:record:agentic-systems-mcp-mcp-client-server-roles',
  'urn:maha:record:agentic-systems-mcp-mcp-capability-negotiation',
  'urn:maha:record:agentic-systems-mcp-mcp-tool-discovery',
  'urn:maha:record:agentic-systems-mcp-mcp-tool-input-schemas',
] as const

export const SUBSTANTIAL_INFORMATION_DIMENSIONS = [
  'direct-definition',
  'mechanism-and-context',
  'evidence-interpretation',
  'comparison-boundary',
  'calculation-boundary',
  'limitations',
  'related-records',
  'claim-provenance',
] as const

export interface SubstantialPublicationQuality {
  eligible: boolean
  reasons: readonly string[]
  dimensions: readonly string[]
  evidenceCoverage: {
    claimsExplained: number
    claimsTotal: number
    sourcesBound: number
    sourcesTotal: number
    unsupportedExplanationParagraphs: number
  }
  informationValue: {
    dimensionsCovered: number
    sourceBoundSections: number
    limitations: number
    relatedRecords: number
    comparisonDecisionRecorded: boolean
    calculationDecisionRecorded: boolean
  }
}

export interface PublishedSubstantialPage extends CompiledSubstantialPage {
  publicationVersion: typeof SUBSTANTIAL_PUBLICATION_VERSION
  publicationDate: typeof SUBSTANTIAL_PUBLICATION_DATE
  path: string
  quality: SubstantialPublicationQuality
  depth: {
    before: { sections: number; paragraphs: number; informationCharacters: number }
    after: { sections: number; paragraphs: number; informationCharacters: number; dimensions: number }
    characterDelta: number
  }
  publicationDigest: string
}

function sentence(value: string): string {
  const trimmed = value.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function searchIntent(record: EpistemicRecord): SearchIntentContract {
  const topic = record.title.toLowerCase()
  const title = `${record.title}: evidence, mechanism, and limits`
  return {
    primaryQuery: `what is ${topic}`,
    readerQuestion: `What does the cited evidence establish about ${topic}, and what remains outside its scope?`,
    audience: 'Technical readers evaluating a source-bounded concept before using it in research or strategy.',
    readerOutcome: `Understand the bounded definition of ${topic}, its technical context, the evidence attached to it, and the inferences the record does not support.`,
    supportingQuestions: [
      `How is ${topic} defined in this knowledge graph?`,
      `What mechanism or technical context does the cited source establish?`,
      `Which evidence limitations matter when interpreting ${topic}?`,
      `Which related records should be examined next?`,
    ],
    queryVariants: [`${topic} explained`, `${topic} mechanism`, `${topic} evidence`, `${topic} limitations`],
    title: title.length <= 70 ? title : `${record.title}: evidence and limits`,
    description: 'A source-bound technical reference covering the record’s definition, mechanism, evidence scope, limitations, related records, and complete claim provenance.',
    trafficNonClaim: 'Search visibility does not guarantee correctness, importance, adoption, or performance.',
  }
}

function editorial(record: EpistemicRecord): EditorialSynthesis {
  const claim = record.claims[0]
  if (!claim) throw new Error(`${record.id}: publication cohort record lacks a claim`)
  const source = record.sources.find((entry) => claim.sourceIds.includes(entry.id))
  if (!source) throw new Error(`${record.id}: publication cohort record lacks a source-bound claim`)
  const claimIds = [claim.id]
  return {
    directAnswer: `${sentence(claim.statement)} Within this page, that proposition is limited to ${sentence(claim.scope)}`,
    directAnswerClaimIds: claimIds,
    sections: [
      {
        heading: 'Definition and evidence boundary',
        paragraphs: [
          `${sentence(record.description)} The bounded proposition retained by the canonical record is: ${sentence(claim.statement)}`,
          `The applicable scope is ${sentence(claim.scope)} This definition must not be generalized beyond the cited source and exact record boundary.`,
        ],
        claimIds,
      },
      {
        heading: 'Mechanism and technical context',
        paragraphs: [
          `${sentence(source.establishes)} This is the source-bound technical context for the record; no uncited mechanism is added by the compiler.`,
          `${sentence(claim.boundary)} The mechanism or method is therefore presented as one component of a larger system, not as evidence for every downstream outcome.`,
        ],
        claimIds,
      },
      {
        heading: 'How to interpret the evidence',
        paragraphs: [
          `${sentence(claim.uncertainty.statement)} The evidence maturity recorded here is ${claim.evidenceMaturity.replaceAll('-', ' ')}, and the claim kind is ${claim.claimKind.replaceAll('-', ' ')}.`,
          `${sentence(claim.replication.assessment)} ${sentence(source.boundary)} These qualifications travel with the claim whenever it is reused.`,
        ],
        claimIds,
      },
    ],
    additionalLimitations: [
      'This compilation reorganizes an existing inspected claim and its declared source; it does not add a new experiment, measurement, or independent replication.',
    ],
    originalContribution: 'Maha’s contribution is the explicit assembly of definition, mechanism, evidence state, limitations, related records, and provenance into one auditable reading path. It is an editorial structure, not a new factual claim.',
  }
}

function compile(record: EpistemicRecord): CompiledSubstantialPage {
  return compileSubstantialPage({
    record,
    graph: FRONTIER_CANARY_RECORDS,
    searchIntent: searchIntent(record),
    editorial: editorial(record),
    comparison: {
      status: 'not-applicable',
      rationale: 'This record contains one source-bound proposition and no second supported side or shared comparison axis. A comparison would require another inspected claim rather than a keyword-adjacent topic.',
    },
    calculation: {
      status: 'not-applicable',
      rationale: 'The canonical claim declares no reproducible numerical inputs, equation, units, or uncertainty propagation. Adding a calculation would invent an unsupported quantitative result.',
    },
  })
}

export function evaluateSubstantialPublicationQuality(record: EpistemicRecord, compiled: CompiledSubstantialPage): SubstantialPublicationQuality {
  // Re-evaluate the supplied contract instead of trusting a potentially stale
  // or caller-forged decision embedded beside it.
  const freshDecision = evaluateSubstantialPageGate(record, compiled.contract, FRONTIER_CANARY_RECORDS, alignmentBlockers(record.id))
  const reasons = [...freshDecision.reasons]
  const explainedClaims = new Set(compiled.contract.explanations.flatMap((section) => section.claimIds))
  const boundSources = new Set(compiled.contract.explanations.flatMap((section) => section.sourceIds))
  const claimSources = new Set(record.claims.flatMap((claim) => claim.sourceIds))
  const unsupportedExplanationParagraphs = compiled.contract.explanations
    .filter((section) => section.claimIds.length === 0 || section.sourceIds.length === 0)
    .reduce((total, section) => total + section.paragraphs.length, 0)

  if (!isAlignmentClear(record.id)) reasons.push('alignment-not-clear')
  if (explainedClaims.size !== record.claims.length) reasons.push('claim-coverage-incomplete')
  if ([...claimSources].some((sourceId) => !boundSources.has(sourceId))) reasons.push('source-coverage-incomplete')
  if (unsupportedExplanationParagraphs > 0) reasons.push('unsupported-explanatory-prose')
  if (compiled.contract.explanations.length < 3) reasons.push('information-dimensions-incomplete')
  if (compiled.contract.relatedRecords.length < 3) reasons.push('related-record-context-incomplete')
  if (!compiled.contract.comparison.rationale || !compiled.contract.calculation.rationale) reasons.push('applicability-decision-missing')

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)].sort(),
    dimensions: [...SUBSTANTIAL_INFORMATION_DIMENSIONS],
    evidenceCoverage: {
      claimsExplained: explainedClaims.size,
      claimsTotal: record.claims.length,
      sourcesBound: boundSources.size,
      sourcesTotal: claimSources.size,
      unsupportedExplanationParagraphs,
    },
    informationValue: {
      dimensionsCovered: SUBSTANTIAL_INFORMATION_DIMENSIONS.length,
      sourceBoundSections: compiled.contract.explanations.length,
      limitations: compiled.contract.limitations.length,
      relatedRecords: compiled.contract.relatedRecords.length,
      comparisonDecisionRecorded: Boolean(compiled.contract.comparison.rationale),
      calculationDecisionRecorded: Boolean(compiled.contract.calculation.rationale),
    },
  }
}

function characters(values: readonly string[]): number {
  return values.reduce((total, value) => total + value.trim().length, 0)
}

function publish(record: EpistemicRecord): PublishedSubstantialPage {
  const compiled = compile(record)
  const quality = evaluateSubstantialPublicationQuality(record, compiled)
  const beforeValues = [record.summary, record.description, ...record.sections.flatMap((section) => section.paragraphs)]
  const afterValues = [
    compiled.contract.directAnswer.text,
    ...compiled.contract.explanations.flatMap((section) => section.paragraphs),
    ...compiled.contract.limitations.map((entry) => entry.statement),
    ...compiled.contract.relatedRecords.map((entry) => entry.rationale),
    compiled.contract.comparison.rationale,
    compiled.contract.calculation.rationale,
    compiled.contract.originalContribution,
  ]
  const beforeCharacters = characters(beforeValues)
  const afterCharacters = characters(afterValues)
  const withoutDigest = {
    ...compiled,
    publicationVersion: SUBSTANTIAL_PUBLICATION_VERSION,
    publicationDate: SUBSTANTIAL_PUBLICATION_DATE,
    path: epistemicRecordPath(record),
    quality,
    depth: {
      before: { sections: record.sections.length, paragraphs: record.sections.reduce((sum, section) => sum + section.paragraphs.length, 0), informationCharacters: beforeCharacters },
      after: { sections: compiled.contract.explanations.length, paragraphs: compiled.contract.explanations.reduce((sum, section) => sum + section.paragraphs.length, 0), informationCharacters: afterCharacters, dimensions: quality.informationValue.dimensionsCovered },
      characterDelta: afterCharacters - beforeCharacters,
    },
  }
  return {
    ...withoutDigest,
    publicationDigest: `sha256:${createHash('sha256').update(JSON.stringify(withoutDigest)).digest('hex')}`,
  }
}

const canaryById = new Map(FRONTIER_CANARY_RECORDS.map((record) => [record.id, record]))
export const SUBSTANTIAL_PUBLICATION_PAGES = SUBSTANTIAL_PUBLICATION_RECORD_IDS.map((recordId) => {
  const record = canaryById.get(recordId)
  if (!record) throw new Error(`${recordId}: substantial publication target is not a canonical canary`)
  if (!isAlignmentClear(record.id)) throw new Error(`${recordId}: substantial publication target is not alignment-clear`)
  return publish(record)
})

if (SUBSTANTIAL_PUBLICATION_RECORD_IDS.length !== 20 || new Set(SUBSTANTIAL_PUBLICATION_RECORD_IDS).size !== 20) {
  throw new Error('Substantial publication Batch 1 must contain exactly twenty unique records.')
}
if (SUBSTANTIAL_PUBLICATION_PAGES.some((page) => !page.quality.eligible)) {
  const failures = SUBSTANTIAL_PUBLICATION_PAGES.filter((page) => !page.quality.eligible).map((page) => `${page.contract.recordId}: ${page.quality.reasons.join(', ')}`)
  throw new Error(`Every published substantial page must pass the evidence and information-value gate. ${failures.join('; ')}`)
}

const pageByRecordId = new Map(SUBSTANTIAL_PUBLICATION_PAGES.map((page) => [page.contract.recordId, page]))
export function getPublishedSubstantialPage(recordId: string): PublishedSubstantialPage | undefined {
  return pageByRecordId.get(recordId)
}

export const SUBSTANTIAL_PUBLIC_PATHS = SUBSTANTIAL_PUBLICATION_PAGES.map((page) => page.path).sort()
