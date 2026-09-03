import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import {
  EVIDENCE_LEVELS, gradeEvidence,
  type EvidenceLevel, type EvidenceProfile, type InspectionAttestation, type InspectionDepth,
} from './legacy-evidence-levels.ts'

/**
 * Uplift for the legacy /knowledge corpus.
 *
 * The legacy families already hold structured evidence: definitions,
 * mechanisms, measurements, limitations, typed bridges and sources with
 * boundaries. What they lack is the shape the newer substantial pages use, so
 * a reader cannot see the answer, the mechanism, what is not established and
 * what backs each part.
 *
 * This composes that shape out of fields that already exist. It writes no
 * prose of its own, and a dimension with nothing behind it stays absent rather
 * than being filled with something that reads like content. That is the whole
 * design: a page gets longer only when there was already more to say.
 */

export const UPLIFT_VERSION = 'maha-legacy-uplift/1.0' as const

/** The dimensions a substantial page is expected to carry. */
export const UPLIFT_DIMENSIONS = [
  'direct-answer',
  'mechanism-or-method',
  'bounded-comparison',
  'deterministic-calculation',
  'limitations',
  'not-established',
  'related-records',
  'typed-bridges',
  'claim-level-citation',
  'exact-locator',
  'source-boundary',
  'provenance-and-review-state',
] as const
export type UpliftDimension = (typeof UPLIFT_DIMENSIONS)[number]

/** Dimensions without which a page cannot honestly be called upgraded. */
const REQUIRED: readonly UpliftDimension[] = [
  'direct-answer', 'mechanism-or-method', 'limitations',
  'not-established', 'claim-level-citation', 'source-boundary',
]

export type UpliftRefusal =
  | 'no-direct-answer' | 'no-mechanism' | 'no-limitations' | 'no-negative-space'
  | 'no-cited-source' | 'source-without-boundary' | 'unsupported-comparison'
  | 'calculation-without-inputs' | 'metadata-only-source' | 'source-inaccessible'
  | 'source-subject-mismatch' | 'stale-revision' | 'unreleased-evidence'
  | 'below-dimension-floor'

export interface LegacySource {
  id: string
  title: string
  publisher?: string
  url?: string
  /** What this source can support. A source without one cannot be cited as fact. */
  establishes?: string
  /** What it cannot support. Its absence is itself a refusal. */
  boundary?: string
  accessed?: string
  authorityTier?: string
}

export interface LegacyBridge {
  id: string
  title: string
  application?: string
  inputs?: readonly string[] | string
  outputs?: readonly string[] | string
  limitations?: readonly string[] | string
  targetPath?: string
}

export interface LegacyComparison {
  id: string
  title: string
  /** Both sides must be present and supported, or the comparison is dropped. */
  sides?: readonly unknown[]
  perspectives?: readonly unknown[]
  nonEquivalences?: readonly string[]
  prohibitedInference?: string
  sourceIds?: readonly string[]
}

export interface LegacyPageInput {
  family: string
  slug: string
  route: string
  title: string
  /** The one-sentence answer. Existing `definition` where a family has one. */
  definition?: string
  description?: string
  /** How it works: mechanism, method, procedure or process steps. */
  mechanism?: readonly string[]
  measurements?: readonly string[]
  limitations?: readonly string[]
  /** Explicit negative space: what this does not establish. */
  doesNotEstablish?: readonly string[]
  assumptions?: readonly string[]
  sources: readonly LegacySource[]
  bridges: readonly LegacyBridge[]
  comparisons: readonly LegacyComparison[]
  relatedRoutes: readonly string[]
  /** Deterministic calculation inputs, only where the family records them. */
  calculationInputs?: readonly string[]
  calculationOutputs?: readonly string[]
  /** Release state, supplied by the caller. Never inferred from page shape. */
  canonicalRelease?: { released: boolean; revisionMatches: boolean } | null
  /** Independent inspection records, keyed by source id. Absent means uninspected. */
  attestations?: Readonly<Record<string, InspectionAttestation>>
}

export interface UpliftBaseline {
  route: string
  family: string
  dimensionsPresent: readonly UpliftDimension[]
  dimensionCount: number
  sourceCount: number
  sourcesWithBoundary: number
  referenceOnlySources: number
  /** A URL exists. Says nothing about whether anyone opened it. */
  declaredLocators: number
  /** An independent attestation records the passage that was actually read. */
  contentInspectedLocators: number
  explanatorySources: number
  bridgeCount: number
  relatedRouteCount: number
  /**
   * The routes themselves, not only how many.
   *
   * The shape recorded a count alone, so sixteen supplier pages linked to
   * routes that did not exist and nothing could notice. A count cannot be
   * checked against the corpus; a list can.
   */
  relatedRoutes: readonly string[]
  renderedSections: number
}

export interface UpliftSection {
  dimension: UpliftDimension
  heading: string
  items: readonly string[]
  sourceIds: readonly string[]
}

export interface UpliftResult {
  route: string
  family: string
  slug: string
  eligible: boolean
  refusals: readonly UpliftRefusal[]
  before: UpliftBaseline
  after: UpliftBaseline | null
  /** Sections the page may render, each already backed by existing evidence. */
  sections: readonly UpliftSection[]
  requiresGovernedRevision: boolean
  upliftDigest: string
}

const list = (value: readonly string[] | string | undefined): string[] => {
  if (value === undefined) return []
  return Array.isArray(value) ? [...value] : [value as string]
}

const meaningful = (value: string | undefined, min: number) =>
  typeof value === 'string' && value.trim().length >= min

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

/** A source may only be cited as fact if it says what it establishes and what it does not. */
export function citableSources(sources: readonly LegacySource[]): readonly LegacySource[] {
  return sources.filter((source) => meaningful(source.establishes, 12) && meaningful(source.boundary, 12))
}

export function gradeAll(input: LegacyPageInput): readonly EvidenceProfile[] {
  return input.sources.map((source) => gradeEvidence({
    sourceId: source.id,
    declaredUrl: source.url,
    establishes: source.establishes,
    boundary: source.boundary,
    attestation: input.attestations?.[source.id] ?? null,
    releaseMatched: input.canonicalRelease ? input.canonicalRelease.revisionMatches : true,
  }))
}

/**
 * Negative space taken from the boundaries the page's own sources declare.
 *
 * A source `boundary` says what that source cannot support. Collecting them is
 * not a substitution: it uses the field for exactly what it means, and every
 * sentence is attributed to the source that wrote it. This is why it is
 * allowed where `assumptions` and `failureModes` are not.
 */
export function boundaryDerivedNegativeSpace(input: LegacyPageInput): readonly string[] {
  return citableSources(input.sources)
    .map((source) => `${source.boundary!.trim()} (boundary declared by ${source.title})`)
}

export function measure(input: LegacyPageInput, sections: readonly UpliftSection[]): UpliftBaseline {
  const present = new Set<UpliftDimension>()
  const citable = citableSources(input.sources)
  const graded = gradeAll(input)
  if (meaningful(input.definition, 40)) present.add('direct-answer')
  if (list(input.mechanism).length > 0) present.add('mechanism-or-method')
  if (input.comparisons.length > 0) present.add('bounded-comparison')
  if (list(input.calculationInputs).length > 0 && list(input.calculationOutputs).length > 0) {
    present.add('deterministic-calculation')
  }
  if (list(input.limitations).length > 0) present.add('limitations')
  // Either the page's own statement, or the boundaries its sources declare.
  if (list(input.doesNotEstablish).length > 0 || boundaryDerivedNegativeSpace(input).length > 0) {
    present.add('not-established')
  }
  if (input.relatedRoutes.length > 0) present.add('related-records')
  if (input.bridges.length > 0) present.add('typed-bridges')
  if (citable.length > 0) present.add('claim-level-citation')
  if (citable.some((s) => meaningful(s.url, 8))) present.add('exact-locator')
  // Satisfied when every source used as fact declares its boundary, which is
  // what citableSources selects for. Sources that cannot be used are excluded
  // from the evidence sections entirely, so they neither help nor block.
  if (citable.length > 0) present.add('source-boundary')
  if (input.canonicalRelease) present.add('provenance-and-review-state')

  return {
    route: input.route,
    family: input.family,
    dimensionsPresent: [...present].sort(),
    dimensionCount: present.size,
    sourceCount: input.sources.length,
    sourcesWithBoundary: citable.length,
    referenceOnlySources: input.sources.length - citable.length,
    declaredLocators: citable.filter((s) => meaningful(s.url, 8)).length,
    contentInspectedLocators: graded.filter((g) => g.levels['content-inspected-locator']).length,
    explanatorySources: graded.filter((g) => g.explanatory).length,
    bridgeCount: input.bridges.length,
    relatedRouteCount: input.relatedRoutes.length,
    relatedRoutes: input.relatedRoutes,
    renderedSections: sections.length,
  }
}

/**
 * Compiles the uplift for one legacy page.
 *
 * Every section is assembled from fields the family already stores. A
 * comparison whose sides are not both present is dropped rather than narrowed;
 * a calculation without both inputs and outputs is dropped rather than
 * estimated. Nothing here writes a sentence that was not already written.
 */
export function compileUplift(input: LegacyPageInput, baselineSections = 0): UpliftResult {
  const refusals: UpliftRefusal[] = []
  const citable = citableSources(input.sources)
  const sections: UpliftSection[] = []
  const sourceIds = citable.map((s) => s.id)

  if (!meaningful(input.definition, 40)) refusals.push('no-direct-answer')
  else sections.push({ dimension: 'direct-answer', heading: 'Direct answer', items: [input.definition!], sourceIds })

  const mechanism = list(input.mechanism)
  if (mechanism.length === 0) refusals.push('no-mechanism')
  else sections.push({ dimension: 'mechanism-or-method', heading: 'Mechanism and method', items: mechanism, sourceIds })

  const measurements = list(input.measurements)
  if (measurements.length > 0) {
    sections.push({ dimension: 'mechanism-or-method', heading: 'What is measured', items: measurements, sourceIds })
  }

  // A comparison survives only if both sides exist and it declares what it
  // must not be read as. Otherwise it is dropped, never trimmed into a claim.
  for (const comparison of input.comparisons) {
    const sides = comparison.sides ?? comparison.perspectives ?? []
    if (sides.length < 2 || !meaningful(comparison.prohibitedInference, 12)) {
      refusals.push('unsupported-comparison')
      continue
    }
    sections.push({
      dimension: 'bounded-comparison',
      heading: `Comparison: ${comparison.title}`,
      items: [...(comparison.nonEquivalences ?? []), `Must not be read as: ${String(comparison.prohibitedInference)}`],
      sourceIds: [...(comparison.sourceIds ?? [])],
    })
  }

  const inputs = list(input.calculationInputs)
  const outputs = list(input.calculationOutputs)
  if (inputs.length > 0 && outputs.length === 0) refusals.push('calculation-without-inputs')
  else if (inputs.length > 0 && outputs.length > 0) {
    sections.push({
      dimension: 'deterministic-calculation',
      heading: 'Deterministic calculation',
      items: [`Inputs: ${inputs.join('; ')}`, `Outputs: ${outputs.join('; ')}`],
      sourceIds,
    })
  }

  const limitations = list(input.limitations)
  if (limitations.length === 0) refusals.push('no-limitations')
  else sections.push({ dimension: 'limitations', heading: 'Limitations', items: limitations, sourceIds })

  const declared = list(input.doesNotEstablish)
  // A page's own statement is preferred. Where it has none, the boundaries its
  // sources declare are used instead, each attributed to the source that wrote
  // it, so the reader can see whose limit it is.
  const derived = declared.length > 0 ? [] : boundaryDerivedNegativeSpace(input)
  const negative = declared.length > 0 ? declared : derived
  if (negative.length === 0) refusals.push('no-negative-space')
  else {
    sections.push({
      dimension: 'not-established',
      heading: declared.length > 0 ? 'What this does not establish' : 'Boundaries declared by the cited sources',
      items: negative,
      sourceIds,
    })
  }

  for (const bridge of input.bridges) {
    const items = [
      ...(bridge.application ? [bridge.application] : []),
      ...list(bridge.inputs).map((i) => `Input: ${i}`),
      ...list(bridge.outputs).map((o) => `Output: ${o}`),
      ...list(bridge.limitations).map((l) => `Limit: ${l}`),
    ]
    if (items.length > 0) {
      sections.push({ dimension: 'typed-bridges', heading: `Bridge: ${bridge.title}`, items, sourceIds })
    }
  }

  // Related records counted towards the dimension total without rendering
  // anything, so a page could gain a dimension the reader never saw. The
  // routes are listed here, and carry no sourceIds: a link to a related record
  // is navigation, not a claim, and nothing supports it but the corpus itself.
  if (input.relatedRoutes.length > 0) {
    sections.push({
      dimension: 'related-records',
      heading: 'Related records',
      items: [...input.relatedRoutes],
      sourceIds: [],
    })
  }

  // At least one usable source is required. Sources that cannot be used are
  // not a blocker: they are excluded from every evidence section and listed as
  // reference only, which is what "non-explanatory" has to mean in practice.
  if (citable.length === 0) refusals.push('no-cited-source')

  const after = measure(input, sections)
  // Evidence coverage, not length. A short page with every required dimension
  // passes; a long one missing them does not.
  const missingRequired = REQUIRED.filter((d) => !after.dimensionsPresent.includes(d))
  if (missingRequired.length > 0) refusals.push('below-dimension-floor')

  const stale = input.canonicalRelease ? !input.canonicalRelease.revisionMatches : false
  if (stale) refusals.push('stale-revision')

  const before: UpliftBaseline = {
    ...measure(input, []),
    renderedSections: baselineSections,
    // The baseline counts only what the legacy page actually rendered.
    dimensionsPresent: measure(input, []).dimensionsPresent.filter((d) =>
      d !== 'bounded-comparison' && d !== 'deterministic-calculation' && d !== 'typed-bridges'),
  }
  before.dimensionCount = before.dimensionsPresent.length

  const eligible = refusals.length === 0
  const body = {
    route: input.route, family: input.family, slug: input.slug, eligible,
    refusals: [...new Set(refusals)].sort(), before, after: eligible ? after : null,
    sections: eligible ? sections : [],
    // A released record whose revision no longer matches needs a governed
    // revision, not a quiet edit.
    requiresGovernedRevision: Boolean(input.canonicalRelease?.released) && stale,
  }
  return { ...body, upliftDigest: sha(body) }
}
