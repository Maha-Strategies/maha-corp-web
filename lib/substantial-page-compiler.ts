import { createHash } from 'node:crypto'

import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { alignmentBlockers } from './frontier-source-alignment.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'
import {
  SUBSTANTIAL_PAGE_SCHEMA_VERSION,
  evaluateSubstantialPageGate,
  type CalculationCoverage,
  type ComparisonAxis,
  type CoverageStatus,
  type LimitationCoverage,
  type SearchIntentContract,
  type SubstantialPageContract,
  type SubstantialPageDecision,
  type SubstantialPageRelation,
} from './substantial-page.ts'

/**
 * Deterministic compiler from a canonical record to a substantial-page contract.
 *
 * The compiler writes no facts. Every factual sentence on a compiled page comes
 * from one of four places, all of which already exist and are already reviewed:
 * the record's claims, its sources, its boundaries and its prohibited
 * inferences. Editorial prose is supplied by a caller and is bound to claim ids
 * before it is allowed onto the page.
 *
 * The load-bearing rule is that source ids are DERIVED, never supplied. A
 * caller names the claims a passage rests on; the compiler looks up which
 * sources those claims actually cite. There is therefore no input through which
 * a real but unrelated source can be attached to a claim, which is the specific
 * failure that makes a citation look supported when it is not.
 *
 * Nothing here promotes, publishes or routes anything. A compiled contract is
 * an internal artifact evaluated by `evaluateSubstantialPageGate`.
 */

export const SUBSTANTIAL_PAGE_COMPILER_VERSION = 'maha-substantial-page-compiler/0.1' as const

/** Why a related record was linked. Recorded so a reviewer can audit the pick. */
export const SELECTION_TIERS = ['bridge-edge', 'shared-source', 'domain-adjacency'] as const
export type SelectionTier = (typeof SELECTION_TIERS)[number]

export interface EditorialSection {
  heading: string
  paragraphs: readonly string[]
  /** Which of the record's claims this passage rests on. Sources are derived. */
  claimIds: readonly string[]
}

export interface EditorialSynthesis {
  directAnswer: string
  directAnswerClaimIds: readonly string[]
  sections: readonly EditorialSection[]
  originalContribution: string
  /** Added beside record limitations. Never a replacement for one. */
  additionalLimitations?: readonly string[]
}

export interface ComparisonApplicability {
  status: CoverageStatus
  rationale: string
  axes?: readonly {
    axis: string
    left: string
    right: string
    interpretationBoundary: string
    claimIds: readonly string[]
  }[]
}

export interface CalculationApplicability {
  status: CoverageStatus
  rationale: string
  method?: string
  expression?: string
  inputs?: readonly string[]
  assumptions?: readonly string[]
  reproducibility?: string
  claimIds?: readonly string[]
}

export interface CompileInput {
  record: EpistemicRecord
  graph: readonly EpistemicRecord[]
  searchIntent: SearchIntentContract
  editorial: EditorialSynthesis
  comparison: ComparisonApplicability
  calculation: CalculationApplicability
}

export interface RelatedSelection {
  recordId: string
  relation: SubstantialPageRelation
  tier: SelectionTier
  rationale: string
}

export interface CompiledSubstantialPage {
  compilerVersion: typeof SUBSTANTIAL_PAGE_COMPILER_VERSION
  contract: SubstantialPageContract
  decision: SubstantialPageDecision
  /** How each related record was chosen, for review. Not part of the contract. */
  selectionTrace: readonly RelatedSelection[]
  contractDigest: string
}

export function substantialPageContractDigest(contract: SubstantialPageContract): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(contract)).digest('hex')}`
}

/* ------------------------------------------------------------ derivation -- */

/**
 * Sources for a set of claims, taken from the claims themselves.
 *
 * Callers cannot pass source ids. This is the whole defence against a citation
 * that looks supported but is not: the only sources that can reach a passage
 * are the ones the cited claims already declare.
 */
function derivedSourceIds(record: EpistemicRecord, claimIds: readonly string[]): string[] {
  const byId = new Map(record.claims.map((claim) => [claim.id, claim]))
  const sources = new Set<string>()
  for (const claimId of claimIds) {
    const claim = byId.get(claimId)
    if (!claim) throw new Error(`${record.id}: claim ${claimId} is not on this record.`)
    for (const sourceId of claim.sourceIds) sources.add(sourceId)
  }
  return [...sources].sort()
}

function assertClaimsExist(record: EpistemicRecord, claimIds: readonly string[], label: string): void {
  const known = new Set(record.claims.map((claim) => claim.id))
  for (const claimId of claimIds) {
    if (!known.has(claimId)) throw new Error(`${record.id}: ${label} cites unknown claim ${claimId}.`)
  }
}

/**
 * Record limitations first, each rendered exactly once and typed to its index,
 * then any editorial additions. Editorial entries carry a null basis index so
 * the gate can tell an addition from a record boundary.
 */
function compileLimitations(record: EpistemicRecord, additional: readonly string[]): LimitationCoverage[] {
  const limitations: LimitationCoverage[] = []
  record.boundaries.forEach((statement, basisIndex) => {
    limitations.push({ statement, basis: 'record-boundary', basisIndex })
  })
  record.prohibitedInferences.forEach((statement, basisIndex) => {
    limitations.push({ statement, basis: 'prohibited-inference', basisIndex })
  })
  for (const statement of additional) {
    limitations.push({ statement, basis: 'editorial', basisIndex: null })
  }
  return limitations
}

const KIND_RELATION: Record<string, SubstantialPageRelation> = {
  concept: 'prerequisite',
  mechanism: 'mechanism',
  method: 'application',
  measurement: 'measurement',
  comparison: 'comparison',
  conflict: 'boundary',
  bridge: 'boundary',
  hypothesis: 'boundary',
}

/**
 * Deterministic, graph-based related-record selection in three tiers.
 *
 * Tier 1 is a declared bridge edge, which is a real assertion in the graph.
 * Tier 2 is co-citation: two records citing the same source are related through
 * the evidence, not through wording. Tier 3 is domain adjacency, a genuine
 * partition of the graph, used only to reach the gate's minimum of three.
 *
 * No tier compares titles or slugs, so a merely keyword-similar record can
 * never be linked. Every tier sorts by record id, so the output is stable.
 */
function selectRelatedRecords(record: EpistemicRecord, graph: readonly EpistemicRecord[], minimum: number): RelatedSelection[] {
  const byId = new Map(graph.map((entry) => [entry.id, entry]))
  const chosen = new Map<string, RelatedSelection>()

  const add = (targetId: string, relation: SubstantialPageRelation, tier: SelectionTier, rationale: string) => {
    if (targetId === record.id || chosen.has(targetId) || !byId.has(targetId)) return
    chosen.set(targetId, { recordId: targetId, relation, tier, rationale })
  }

  // Tier 1 - declared bridge edges, both directions.
  const edges: { targetId: string; relation: SubstantialPageRelation; rationale: string }[] = []
  for (const bridge of record.bridges) {
    edges.push({
      targetId: bridge.targetConceptId,
      relation: bridge.bridgeType === 'strategic-dependency' ? 'application' : 'mechanism',
      rationale: `Declared ${bridge.bridgeType} edge from this record. The edge is navigational and asserts no equivalence or causation beyond the cited source scope.`,
    })
  }
  for (const entry of graph) {
    for (const bridge of entry.bridges) {
      if (bridge.targetConceptId !== record.id) continue
      edges.push({
        targetId: bridge.sourceConceptId,
        relation: bridge.bridgeType === 'strategic-dependency' ? 'boundary' : 'prerequisite',
        rationale: `Declared ${bridge.bridgeType} edge into this record, so it is positioned earlier in the same bounded sequence.`,
      })
    }
  }
  for (const edge of [...edges].sort((a, b) => a.targetId.localeCompare(b.targetId))) {
    add(edge.targetId, edge.relation, 'bridge-edge', edge.rationale)
  }

  // Tier 2 - co-citation of the same source.
  if (chosen.size < minimum) {
    const keys = new Set(record.sources.map((source) => source.identifiers?.[0]?.value ?? source.url ?? source.title))
    const shared = graph
      .filter((entry) =>
        entry.id !== record.id
        && entry.sources.some((source) => keys.has(source.identifiers?.[0]?.value ?? source.url ?? source.title)),
      )
      .sort((a, b) => a.id.localeCompare(b.id))
    for (const entry of shared) {
      if (chosen.size >= minimum) break
      add(
        entry.id,
        KIND_RELATION[entry.recordKind] ?? 'boundary',
        'shared-source',
        'Cites the same source as this record, so the two are related through the evidence rather than through wording.',
      )
    }
  }

  // Tier 3 - domain adjacency, only to reach the minimum.
  if (chosen.size < minimum) {
    const siblings = graph
      .filter((entry) => entry.id !== record.id && entry.domainSlug === record.domainSlug)
      .sort((a, b) => a.id.localeCompare(b.id))
    for (const entry of siblings) {
      if (chosen.size >= minimum) break
      add(
        entry.id,
        KIND_RELATION[entry.recordKind] ?? 'boundary',
        'domain-adjacency',
        `Same canonical domain (${record.domainSlug}). Domain membership only: no shared source or declared edge links these two records.`,
      )
    }
  }

  return [...chosen.values()].sort((a, b) => a.recordId.localeCompare(b.recordId))
}

/* -------------------------------------------------------------- compile --- */

export function compileSubstantialPage(input: CompileInput): CompiledSubstantialPage {
  const { record, graph, searchIntent, editorial, comparison, calculation } = input

  assertClaimsExist(record, editorial.directAnswerClaimIds, 'direct answer')
  for (const section of editorial.sections) assertClaimsExist(record, section.claimIds, `section "${section.heading}"`)
  for (const axis of comparison.axes ?? []) assertClaimsExist(record, axis.claimIds, `comparison axis "${axis.axis}"`)
  if (calculation.status === 'included') assertClaimsExist(record, calculation.claimIds ?? [], 'calculation')

  const explanations = editorial.sections.map((section) => ({
    heading: section.heading,
    paragraphs: [...section.paragraphs],
    claimIds: [...section.claimIds],
    sourceIds: derivedSourceIds(record, section.claimIds),
  }))

  const axes: ComparisonAxis[] =
    comparison.status === 'included'
      ? (comparison.axes ?? []).map((axis) => ({
          axis: axis.axis,
          left: axis.left,
          right: axis.right,
          interpretationBoundary: axis.interpretationBoundary,
          claimIds: [...axis.claimIds],
          sourceIds: derivedSourceIds(record, axis.claimIds),
        }))
      : []

  // A not-applicable calculation must leave every content field empty. The
  // compiler enforces that rather than trusting the caller to pass blanks.
  const compiledCalculation: CalculationCoverage =
    calculation.status === 'included'
      ? {
          status: 'included',
          rationale: calculation.rationale,
          method: calculation.method ?? '',
          expression: calculation.expression ?? '',
          inputs: [...(calculation.inputs ?? [])],
          assumptions: [...(calculation.assumptions ?? [])],
          reproducibility: calculation.reproducibility ?? '',
          claimIds: [...(calculation.claimIds ?? [])],
          sourceIds: derivedSourceIds(record, calculation.claimIds ?? []),
        }
      : {
          status: 'not-applicable',
          rationale: calculation.rationale,
          method: '',
          expression: '',
          inputs: [],
          assumptions: [],
          reproducibility: '',
          claimIds: [],
          sourceIds: [],
        }

  const selectionTrace = selectRelatedRecords(record, graph, 3)

  const contract: SubstantialPageContract = {
    schemaVersion: SUBSTANTIAL_PAGE_SCHEMA_VERSION,
    recordId: record.id,
    recordRevisionSha256: epistemicReviewTargetHash(record),
    directAnswer: {
      text: editorial.directAnswer,
      claimIds: [...editorial.directAnswerClaimIds],
      sourceIds: derivedSourceIds(record, editorial.directAnswerClaimIds),
    },
    searchIntent,
    explanations,
    comparison: { status: comparison.status, rationale: comparison.rationale, axes },
    calculation: compiledCalculation,
    limitations: compileLimitations(record, editorial.additionalLimitations ?? []),
    relatedRecords: selectionTrace.map((selection) => ({
      recordId: selection.recordId,
      relation: selection.relation,
      rationale: selection.rationale,
    })),
    originalContribution: editorial.originalContribution,
  }

  // Alignment is computed here, never passed in, so a page cannot be compiled
  // without it. An unaudited record yields `alignment-audit-missing` and blocks.
  const decision = evaluateSubstantialPageGate(record, contract, graph, alignmentBlockers(record.id))

  return {
    compilerVersion: SUBSTANTIAL_PAGE_COMPILER_VERSION,
    contract,
    // Blocker order must not depend on evaluation order.
    decision: { ...decision, reasons: [...decision.reasons].sort() },
    selectionTrace,
    contractDigest: substantialPageContractDigest(contract),
  }
}
