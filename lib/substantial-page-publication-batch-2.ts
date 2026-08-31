import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicRecordPath } from './epistemic-publication.ts'
import { alignmentBlockers, isAlignmentClear } from './frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from './pilot-source-alignment.ts'
import { compileSubstantialPage, type CompiledSubstantialPage } from './substantial-page-compiler.ts'
import { evaluateSubstantialPageGate, type SearchIntentContract } from './substantial-page.ts'
import {
  SUBSTANTIAL_INFORMATION_DIMENSIONS,
  SUBSTANTIAL_PUBLICATION_RECORD_IDS,
  type SubstantialPublicationQuality,
} from './substantial-page-publication.ts'
import type { EpistemicRecord, MathematicalBridge } from './epistemic-schema.ts'

/**
 * Substantial-page publication, batch two.
 *
 * Batch one is frozen. It compiled against FRONTIER_CANARY_RECORDS, a
 * forty-record canary, which happened to contain all twenty of its records.
 * Only four of the forty-four batch-two candidates are in that set, so related
 * records would not resolve for the rest: the graph was the wrong corpus, and
 * that is a reusable compiler defect rather than a batch-one choice.
 *
 * Widening the graph changes batch one's related-record selection and its
 * digest, which was verified rather than assumed. The correction is therefore
 * version-scoped: batch one keeps publication/1.0 and its canary graph
 * byte-for-byte, and batch two compiles at publication/1.1 against the full
 * canonical corpus. Nothing about batch one is regenerated.
 *
 * Batch two also carries typed mathematical bridges, which batch one omitted.
 * Bridges are copied from the record, never inferred, and the bridge type is
 * preserved so an analogy is not read as an equivalence.
 */

export const SUBSTANTIAL_PUBLICATION_BATCH_2_VERSION = 'maha-substantial-publication/1.1' as const
export const SUBSTANTIAL_PUBLICATION_BATCH_2_DATE = '2026-08-26' as const

/** Frozen before any outcome was evaluated. */
export const SUBSTANTIAL_BATCH_2_RECORD_IDS = [
  'urn:maha:record:advanced-materials-correlated-insulating-states',
  'urn:maha:record:advanced-materials-graphene-monolayers',
  'urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics',
  'urn:maha:record:advanced-materials-magic-angle-superconductivity',
  'urn:maha:record:agentic-systems-mcp-context-window-position-effects',
  'urn:maha:record:agentic-systems-mcp-mcp-prompt-templates',
  'urn:maha:record:agentic-systems-mcp-mcp-resource-discovery',
  'urn:maha:record:agentic-systems-mcp-mcp-tool-result-contracts',
  'urn:maha:record:agentic-systems-mcp-tool-deny-by-default',
  'urn:maha:record:biomolecular-engineering-cell-free-transcription-translation',
  'urn:maha:record:biomolecular-engineering-experimental-fold-validation',
  'urn:maha:record:biomolecular-engineering-sequence-design-with-proteinmpnn',
  'urn:maha:record:circuit-quantum-electrodynamics',
  'urn:maha:record:critical-supply-chains-critical-mineral-import-reliance',
  'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules',
  'urn:maha:record:fusion-plasma-systems-disruption-mitigation',
  'urn:maha:record:fusion-plasma-systems-divertor-heat-exhaust',
  'urn:maha:record:fusion-plasma-systems-plasma-diagnostics',
  'urn:maha:record:fusion-plasma-systems-tritium-fuel-cycle',
  'urn:maha:record:mechanistic-interpretability-attention-pattern-evidence',
  'urn:maha:record:mechanistic-interpretability-causal-scrubbing',
  'urn:maha:record:mechanistic-interpretability-in-context-learning-circuits',
  'urn:maha:record:mechanistic-interpretability-induction-head-circuits',
  'urn:maha:record:mechanistic-interpretability-sae-encoder-decoder',
  'urn:maha:record:mechanistic-interpretability-sparse-autoencoder-dictionaries',
  'urn:maha:record:neurotechnology-bci-spike-sorting-boundaries',
  'urn:maha:record:quantum-error-mitigation',
  'urn:maha:record:stabilizer-syndrome-measurement',
  'urn:maha:record:surface-code-error-correction',
  'urn:maha:record:transmon-qubit',
] as const

/**
 * Batch two adds a ninth dimension. A page only claims it when the record
 * actually declares a typed bridge.
 */
export const SUBSTANTIAL_BATCH_2_DIMENSIONS = [
  ...SUBSTANTIAL_INFORMATION_DIMENSIONS,
  'mathematical-bridges',
] as const

export interface PublishedBridge {
  bridgeId: string
  targetRecordId: string
  bridgeType: MathematicalBridge['bridgeType']
  statement: string
  /** Spelled out so an analogy or candidate is never read as equivalence. */
  interpretation: string
}

export interface PublishedBatch2Page extends CompiledSubstantialPage {
  publicationVersion: typeof SUBSTANTIAL_PUBLICATION_BATCH_2_VERSION
  publicationDate: typeof SUBSTANTIAL_PUBLICATION_BATCH_2_DATE
  path: string
  domainSlug: string
  qualificationReason: string
  mathematicalBridges: readonly PublishedBridge[]
  quality: SubstantialPublicationQuality
  depth: {
    before: { sections: number; paragraphs: number; informationCharacters: number }
    after: { sections: number; paragraphs: number; informationCharacters: number; dimensions: number }
    characterDelta: number
  }
  publicationDigest: string
}

const BRIDGE_INTERPRETATION: Readonly<Record<MathematicalBridge['bridgeType'], string>> = {
  'mathematical-equivalence': 'Recorded as a mathematical equivalence between the two records.',
  'shared-instrumentation': 'Recorded as shared instrumentation. The two records use overlapping apparatus; this is not a claim that their results transfer.',
  'mechanistic-dependency': 'Recorded as a mechanistic dependency, navigational within the cited source scope. It asserts neither equivalence nor causation beyond that scope.',
  'statistical-association': 'Recorded as a statistical association only. No causal claim is implied.',
  'structural-analogy': 'Recorded as a structural analogy. The two records share a form, not a demonstrated identity, and must not be treated as equivalent.',
  'strategic-dependency': 'Recorded as a strategic dependency so source, measurement and readiness boundaries can be traversed without collapsing them.',
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
      `Which related records and typed bridges should be examined next?`,
    ],
    queryVariants: [`${topic} explained`, `${topic} mechanism`, `${topic} evidence`, `${topic} limitations`],
    title: title.length <= 70 ? title : `${record.title}: evidence and limits`,
    description:
      'A source-bound technical reference covering the record’s definition, mechanism, evidence scope, limitations, related records, typed bridges, and complete claim provenance.',
    trafficNonClaim: 'Search visibility does not guarantee correctness, importance, adoption, or performance.',
  }
}

/**
 * Every explanatory sentence is assembled from the record's own canonical
 * fields. Nothing is written from model knowledge, and the compiler adds no
 * uncited mechanism.
 */
function editorial(record: EpistemicRecord) {
  const claim = record.claims[0]
  if (!claim) throw new Error(`${record.id}: batch-two record lacks a claim`)
  const source = record.sources.find((entry) => claim.sourceIds.includes(entry.id))
  if (!source) throw new Error(`${record.id}: batch-two record lacks a source-bound claim`)
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
      {
        heading: 'What the source supports and what remains unknown',
        paragraphs: [
          `The inspected source supports exactly this: ${sentence(source.establishes)} It was read at ${sentence(source.exactLocator)}`,
          `What remains unknown is everything outside that locator. ${sentence(claim.boundary)} No quantity, comparison, or downstream outcome is established here unless a separately scoped record measures it.`,
        ],
        claimIds,
      },
    ],
    additionalLimitations: [
      'This compilation reorganizes an existing inspected claim and its declared source; it does not add a new experiment, measurement, or independent replication.',
      'Internal editorial inspection is not external peer review, and no result on this page has been independently reproduced.',
    ],
    originalContribution:
      'Maha’s contribution is the explicit assembly of definition, mechanism, evidence state, limitations, typed bridges, related records, and provenance into one auditable reading path. It is an editorial structure, not a new factual claim.',
  }
}

/**
 * Applicability is decided from the record, never from adjacency. Every
 * batch-two record carries exactly one claim, so no second supported side
 * exists and no reproducible inputs are declared.
 */
function comparisonDecision(record: EpistemicRecord) {
  if (record.claims.length >= 2) {
    return {
      status: 'included' as const,
      rationale: 'The record carries more than one supported claim, so a bounded comparison axis exists.',
    }
  }
  return {
    status: 'not-applicable' as const,
    rationale: `This record carries ${record.claims.length} source-bound proposition and therefore has no second supported side. A comparison would have to be manufactured from an adjacent title rather than from a second inspected claim, which the gate forbids.`,
  }
}

/**
 * A calculation needs reproducible inputs, a convention or formula, and stated
 * uncertainty. This looks for them in the record rather than assuming their
 * absence, so a future record that does declare them is not silently refused.
 */
function calculationDecision(record: EpistemicRecord) {
  const quantitative = record.claims.filter((claim) => claim.uncertainty.kind === 'quantitative')
  const hasInterval = quantitative.some((claim) => /\d/.test(claim.uncertainty.statement))
  if (quantitative.length > 0 && hasInterval) {
    return {
      status: 'included' as const,
      rationale: 'The record declares a quantitative uncertainty with numeric content, so a bounded reproduction is possible.',
    }
  }
  const kinds = [...new Set(record.claims.map((claim) => claim.uncertainty.kind))].join(', ') || 'none'
  return {
    status: 'not-applicable' as const,
    rationale: `The canonical claim declares no reproducible numerical inputs, equation, units, or uncertainty propagation; recorded uncertainty kind is ${kinds}. Supplying sample values would invent an unsupported quantitative result.`,
  }
}

function bridges(record: EpistemicRecord, known: ReadonlySet<string>): readonly PublishedBridge[] {
  return record.bridges
    .filter((bridge) => known.has(bridge.targetConceptId))
    .map((bridge) => ({
      bridgeId: bridge.id,
      targetRecordId: bridge.targetConceptId,
      bridgeType: bridge.bridgeType,
      statement: bridge.statement,
      interpretation: BRIDGE_INTERPRETATION[bridge.bridgeType],
    }))
    .sort((left, right) => left.bridgeId.localeCompare(right.bridgeId))
}

function characters(values: readonly string[]): number {
  return values.reduce((total, value) => total + value.trim().length, 0)
}

function alignmentClearAnywhere(recordId: string): boolean {
  return pilotAlignmentFor(recordId) ? isPilotAlignmentClear(recordId) : isAlignmentClear(recordId)
}

function blockersFor(recordId: string): readonly string[] {
  // A pilot-domain record is audited by the pilot audit; a frontier record by
  // the frontier audit. Using the wrong one would silently pass a record.
  return pilotAlignmentFor(recordId) ? (isPilotAlignmentClear(recordId) ? [] : ['alignment-not-clear']) : alignmentBlockers(recordId)
}

/**
 * Eligibility is recomputed here from live canonical data. A persisted
 * `eligible` field is never read, and the gate is re-run against the current
 * record revision.
 */
export function evaluateBatch2Quality(record: EpistemicRecord, compiled: CompiledSubstantialPage): SubstantialPublicationQuality {
  const fresh = evaluateSubstantialPageGate(record, compiled.contract, EPISTEMIC_RECORDS, blockersFor(record.id))
  const reasons = [...fresh.reasons]
  const explainedClaims = new Set(compiled.contract.explanations.flatMap((section) => section.claimIds))
  const boundSources = new Set(compiled.contract.explanations.flatMap((section) => section.sourceIds))
  const claimSources = new Set(record.claims.flatMap((claim) => claim.sourceIds))
  const unsupportedExplanationParagraphs = compiled.contract.explanations
    .filter((section) => section.claimIds.length === 0 || section.sourceIds.length === 0)
    .reduce((total, section) => total + section.paragraphs.length, 0)

  if (!alignmentClearAnywhere(record.id)) reasons.push('alignment-not-clear')
  if (explainedClaims.size !== record.claims.length) reasons.push('claim-coverage-incomplete')
  if ([...claimSources].some((sourceId) => !boundSources.has(sourceId))) reasons.push('source-coverage-incomplete')
  if (unsupportedExplanationParagraphs > 0) reasons.push('unsupported-explanatory-prose')
  if (compiled.contract.explanations.length < 3) reasons.push('information-dimensions-incomplete')
  if (compiled.contract.relatedRecords.length < 3) reasons.push('related-record-context-incomplete')
  if (!compiled.contract.comparison.rationale || !compiled.contract.calculation.rationale) reasons.push('applicability-decision-missing')
  if (record.sources.some((source) => !source.exactLocator || !source.rights?.basis)) reasons.push('locator-or-rights-basis-missing')

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)].sort(),
    dimensions: [...SUBSTANTIAL_BATCH_2_DIMENSIONS],
    evidenceCoverage: {
      claimsExplained: explainedClaims.size,
      claimsTotal: record.claims.length,
      sourcesBound: boundSources.size,
      sourcesTotal: claimSources.size,
      unsupportedExplanationParagraphs,
    },
    informationValue: {
      dimensionsCovered: SUBSTANTIAL_BATCH_2_DIMENSIONS.length,
      sourceBoundSections: compiled.contract.explanations.length,
      limitations: compiled.contract.limitations.length,
      relatedRecords: compiled.contract.relatedRecords.length,
      comparisonDecisionRecorded: Boolean(compiled.contract.comparison.rationale),
      calculationDecisionRecorded: Boolean(compiled.contract.calculation.rationale),
    },
  }
}

const canonicalIds = new Set(EPISTEMIC_RECORDS.map((record) => record.id))

export function publishBatch2Record(record: EpistemicRecord): PublishedBatch2Page {
  const compiled = compileSubstantialPage({
    record,
    graph: EPISTEMIC_RECORDS,
    searchIntent: searchIntent(record),
    editorial: editorial(record),
    comparison: comparisonDecision(record),
    calculation: calculationDecision(record),
  })
  const quality = evaluateBatch2Quality(record, compiled)
  const recordBridges = bridges(record, canonicalIds)
  const beforeValues = [record.summary, record.description, ...record.sections.flatMap((section) => section.paragraphs)]
  const afterValues = [
    compiled.contract.directAnswer.text,
    ...compiled.contract.explanations.flatMap((section) => section.paragraphs),
    ...compiled.contract.limitations.map((entry) => entry.statement),
    ...compiled.contract.relatedRecords.map((entry) => entry.rationale),
    ...recordBridges.map((bridge) => `${bridge.statement} ${bridge.interpretation}`),
    compiled.contract.comparison.rationale,
    compiled.contract.calculation.rationale,
    compiled.contract.originalContribution,
  ]
  const beforeCharacters = characters(beforeValues)
  const afterCharacters = characters(afterValues)
  const withoutDigest = {
    ...compiled,
    publicationVersion: SUBSTANTIAL_PUBLICATION_BATCH_2_VERSION,
    publicationDate: SUBSTANTIAL_PUBLICATION_BATCH_2_DATE,
    path: epistemicRecordPath(record),
    domainSlug: record.domainSlug,
    qualificationReason: `Alignment-clear under the current audit with an inspected source and exact locator; carries ${record.claims.length} source-bound claim, ${recordBridges.length} typed bridge(s), and ${compiled.contract.relatedRecords.length} canonical related records.`,
    mathematicalBridges: recordBridges,
    quality,
    depth: {
      before: {
        sections: record.sections.length,
        paragraphs: record.sections.reduce((sum, section) => sum + section.paragraphs.length, 0),
        informationCharacters: beforeCharacters,
      },
      after: {
        sections: compiled.contract.explanations.length,
        paragraphs: compiled.contract.explanations.reduce((sum, section) => sum + section.paragraphs.length, 0),
        informationCharacters: afterCharacters,
        dimensions: quality.informationValue.dimensionsCovered,
      },
      characterDelta: afterCharacters - beforeCharacters,
    },
  }
  return {
    ...withoutDigest,
    publicationDigest: `sha256:${createHash('sha256').update(JSON.stringify(withoutDigest)).digest('hex')}`,
  }
}

const recordById = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))

export const SUBSTANTIAL_BATCH_2_PAGES: readonly PublishedBatch2Page[] = SUBSTANTIAL_BATCH_2_RECORD_IDS.map((recordId) => {
  const record = recordById.get(recordId)
  if (!record) throw new Error(`${recordId} is not a canonical record.`)
  return publishBatch2Record(record)
})

/* ------------------------------------------------------------- guards ----- */

{
  const ids = SUBSTANTIAL_BATCH_2_RECORD_IDS
  if (ids.length !== 30) throw new Error(`Batch two must contain exactly 30 records; found ${ids.length}.`)
  if (new Set(ids).size !== ids.length) throw new Error('Batch two membership is not unique.')
  const batch1 = new Set(SUBSTANTIAL_PUBLICATION_RECORD_IDS as readonly string[])
  const domains = new Map<string, number>()
  for (const recordId of ids) {
    if (batch1.has(recordId)) throw new Error(`${recordId} is already published in batch one.`)
    const record = recordById.get(recordId)!
    domains.set(record.domainSlug, (domains.get(record.domainSlug) ?? 0) + 1)
  }
  if (domains.size < 5) throw new Error(`Batch two must span at least five domains; found ${domains.size}.`)
  for (const [domain, count] of domains) {
    if (count > 8) throw new Error(`Batch two allows at most eight records per domain; ${domain} has ${count}.`)
  }
  const paths = SUBSTANTIAL_BATCH_2_PAGES.map((page) => page.path)
  if (new Set(paths).size !== paths.length) throw new Error('Batch two produces a duplicate public route.')
}

export function getBatch2Page(recordId: string): PublishedBatch2Page | undefined {
  return SUBSTANTIAL_BATCH_2_PAGES.find((page) => page.contract.recordId === recordId)
}

/** Only currently eligible pages may reach a public projection. */
export const SUBSTANTIAL_BATCH_2_ELIGIBLE_PAGES = SUBSTANTIAL_BATCH_2_PAGES.filter((page) => page.quality.eligible)
