import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import type {
  AlignmentVerdict,
  AssignmentOrigin,
  InspectedArtifactVersion,
  InspectionDepth,
} from './frontier-source-alignment.ts'

/**
 * Alignment closure batch: five records inspected directly, one disposition each.
 *
 * Every record here was already blocked, and every source named here was
 * already the record's declared source. Nothing is rebound. That constraint is
 * what makes the batch safe to apply: four of these records are reachable from
 * a canonical release, and changing a source would require a new revision and a
 * re-release rather than an alignment judgement.
 *
 * Three of the five were previously judged on less of the document than exists.
 * Two named "the inspected sections" as the limit; one deferred to "a linked
 * page that was not inspected". Reading the rest is not a softer standard, it
 * is the standard the earlier pass could not reach.
 *
 * The fifth is here because a deeper read confirmed the earlier limit rather
 * than removing it, and a batch that only records the promotions would be a
 * misleading account of what inspection found.
 */

export const ALIGNMENT_CLOSURE_BATCH_VERSION = 'maha-alignment-closure-batch/1.0' as const
export const ALIGNMENT_CLOSURE_BATCH_ID = 'alignment-closure-1' as const

/** What kind of thing the inspected content actually is. */
export const EVIDENCE_CHARACTERS = [
  'empirical',
  'modelled',
  'formal',
  'descriptive',
  'metadata-only',
] as const
export type EvidenceCharacter = (typeof EVIDENCE_CHARACTERS)[number]

/** How the inspected artifact relates to the cited work. */
export const VERSION_RELATIONSHIPS = [
  'inspected-artifact-is-version-of-record',
  'inspected-artifact-is-author-manuscript-of-record',
  'inspected-artifact-is-pinned-version-of-living-specification',
] as const
export type VersionRelationship = (typeof VERSION_RELATIONSHIPS)[number]

export const RIGHTS_BASES = [
  'citation-with-paraphrase',
  'public-domain',
  'open-license',
  'licensed',
  'permission',
] as const
export type RightsBasis = (typeof RIGHTS_BASES)[number]

export interface ClosureDisposition {
  recordId: string
  /** The verdict this batch records. Never inherited, always restated. */
  verdict: AlignmentVerdict
  /** The verdict this batch supersedes, preserved rather than overwritten. */
  priorVerdict: AlignmentVerdict
  /** True only when this batch moves the record from blocked to clear. */
  newlyAlignmentClear: boolean
  /** The declared source, unchanged by this batch. */
  sourceIdentifier: string
  sourceTitle: string
  /** Where the source was actually opened. An authoritative host, named. */
  inspectionHost: string
  inspectedContentLocation: string
  artifactVersion: InspectedArtifactVersion
  inspectionDepth: InspectionDepth
  versionRelationship: VersionRelationship
  rightsBasis: RightsBasis
  evidenceCharacter: EvidenceCharacter
  /** Assignment origin this batch records. Absent when the record stays blocked. */
  origin: AssignmentOrigin | null
  /** What the inspected content says, in terms a reader can check against it. */
  reason: string
  /** What this inspection does not establish. */
  boundary: string
  /** Stated where the inspection left a real question open. */
  uncertainty: string | null
}

/**
 * The five dispositions.
 *
 * `sourceIdentifier` repeats each record's existing declared source. A future
 * change that rebinds a source cannot be smuggled in here: a test asserts every
 * identifier still matches the audit's own binding.
 */
export const ALIGNMENT_CLOSURE_DISPOSITIONS: readonly ClosureDisposition[] = [
  {
    recordId: 'urn:maha:record:advanced-materials-diamond-thermal-conductivity',
    verdict: 'supported',
    priorVerdict: 'inaccessible-source',
    newlyAlignmentClear: true,
    sourceIdentifier: '10.1109/TPEL.2003.810840',
    sourceTitle: 'An assessment of wide bandgap semiconductors for power devices',
    inspectionHost: 'IEEE Xplore (publisher), document 1198071',
    inspectedContentLocation: 'Publisher-served abstract, IEEE Transactions on Power Electronics 18(3):907-914',
    artifactVersion: 'version-of-record',
    inspectionDepth: 'abstract-only',
    versionRelationship: 'inspected-artifact-is-version-of-record',
    rightsBasis: 'citation-with-paraphrase',
    evidenceCharacter: 'descriptive',
    origin: 'independently-curated',
    reason:
      'The publisher-served abstract states that the future optimal choice for bipolar devices is diamond "owing to the large bandgap, high thermal conductivity, and large electron and hole mobilities". Diamond thermal conductivity is named as a material property of the record subject, by the source this record already declares.',
    boundary:
      'The abstract asserts high thermal conductivity as a known property used in a device assessment. It reports no thermal-conductivity measurement, and it establishes nothing about fabrication, cost or deployment.',
    uncertainty:
      'The full text is behind a publisher paywall, so the inspection is abstract-depth. The record subject is named in the abstract, so the depth is sufficient for this verdict but not for any quantitative claim.',
  },
  {
    recordId: 'urn:maha:record:agentic-systems-mcp-mcp-session-lifecycle',
    verdict: 'supported',
    priorVerdict: 'partially-supported',
    newlyAlignmentClear: true,
    sourceIdentifier: 'url:https://modelcontextprotocol.io/specification',
    sourceTitle: 'Model Context Protocol specification',
    inspectionHost: 'modelcontextprotocol.io (publisher of the specification)',
    inspectedContentLocation: 'Specification 2024-11-05, Base Protocol > Lifecycle: "Lifecycle Phases", "Version Negotiation", "Capability Negotiation"',
    artifactVersion: 'living-specification',
    inspectionDepth: 'specified-sections',
    versionRelationship: 'inspected-artifact-is-pinned-version-of-living-specification',
    rightsBasis: 'citation-with-paraphrase',
    evidenceCharacter: 'descriptive',
    origin: 'independently-curated',
    reason:
      'The earlier judgement was reached from the specification index, which defers lifecycle detail to a linked page it did not inspect. That page was inspected here. It defines three lifecycle phases - initialization, operation and shutdown - and states that initialization MUST be the first interaction, carried by an initialize request, an initialize response and an initialized notification, with normative version and capability negotiation. That is the session lifecycle this record names.',
    boundary:
      'A specification states what conforming implementations must do. It is not evidence that any implementation does it, and it establishes no performance, security or deployment property.',
    uncertainty:
      'The inspected page is the pinned 2024-11-05 version and labels 2026-07-28 as the current specification. The lifecycle may differ in later versions; this disposition is bounded to the version inspected.',
  },
  {
    recordId: 'urn:maha:record:agentic-systems-mcp-tool-allowlisting',
    verdict: 'partially-supported',
    priorVerdict: 'partially-supported',
    newlyAlignmentClear: false,
    sourceIdentifier: 'url:https://modelcontextprotocol.io/specification',
    sourceTitle: 'Model Context Protocol specification',
    inspectionHost: 'modelcontextprotocol.io (publisher of the specification)',
    inspectedContentLocation: 'Specification 2024-11-05, Server Features > Tools: "User Interaction Model", "Capabilities", "Protocol Messages"',
    artifactVersion: 'living-specification',
    inspectionDepth: 'specified-sections',
    versionRelationship: 'inspected-artifact-is-pinned-version-of-living-specification',
    rightsBasis: 'citation-with-paraphrase',
    evidenceCharacter: 'descriptive',
    origin: null,
    reason:
      'The linked tools page was inspected rather than the index, and it confirms the earlier limit instead of removing it. The page requires that there SHOULD always be a human in the loop able to deny tool invocations, and that applications disclose which tools are exposed. It also states that the protocol "does not mandate any specific user interaction model", and defines only tools/list and tools/call. Per-invocation human denial is not an allowlist: no persistent permitted-tool set is specified anywhere on the page.',
    boundary:
      'Deeper inspection resolved the depth question and left the subject question unchanged. The record stays blocked, and this batch records that outcome rather than omitting it.',
    uncertainty: null,
  },
  {
    recordId: 'urn:maha:record:biomolecular-engineering-crude-extract-cell-free-systems',
    verdict: 'supported',
    priorVerdict: 'partially-supported',
    newlyAlignmentClear: true,
    sourceIdentifier: '10.1016/j.synbio.2017.02.003',
    sourceTitle: 'Cell-free synthetic biology: Engineering in an open world',
    inspectionHost: 'Europe PMC full-text XML, PMC5625795',
    inspectedContentLocation: 'Full text, introduction: the three developed cell-free system types',
    artifactVersion: 'version-of-record',
    inspectionDepth: 'full-document',
    versionRelationship: 'inspected-artifact-is-version-of-record',
    rightsBasis: 'open-license',
    evidenceCharacter: 'descriptive',
    origin: 'independently-curated',
    reason:
      'The earlier judgement said the inspected sections did not isolate crude-extract systems. The full text does: it names three developed cell-free system types and defines the first as the extract-based system, "composed of crude extract with basic transcription and translation functions, DNA templates, energy regeneration substrates, amino acids, nucleotides, cofactors, and salts", listing E. coli, S. cerevisiae, rabbit reticulocyte, wheat germ and insect cell as the common extract sources.',
    boundary:
      'A review describes an established taxonomy. It reports no yield, cost or performance measurement, and this disposition establishes none.',
    uncertainty: null,
  },
  {
    recordId: 'urn:maha:record:biomolecular-engineering-purified-component-expression-systems',
    verdict: 'supported',
    priorVerdict: 'partially-supported',
    newlyAlignmentClear: true,
    sourceIdentifier: '10.1016/j.synbio.2017.02.003',
    sourceTitle: 'Cell-free synthetic biology: Engineering in an open world',
    inspectionHost: 'Europe PMC full-text XML, PMC5625795',
    inspectedContentLocation: 'Full text, introduction: the three developed cell-free system types',
    artifactVersion: 'version-of-record',
    inspectionDepth: 'full-document',
    versionRelationship: 'inspected-artifact-is-version-of-record',
    rightsBasis: 'open-license',
    evidenceCharacter: 'descriptive',
    origin: 'independently-curated',
    reason:
      'The earlier judgement said the inspected sections did not distinguish purified-component systems. The full text distinguishes them explicitly, as the second of three developed types: "The other one is purified system, such as the PURE system which consists of a toolbox of purified E. coli translational components", set against the extract-based system in the preceding sentence.',
    boundary:
      'The review establishes the distinction as an accepted category, not the relative performance of the two platforms.',
    uncertainty: null,
  },
]

export function closureBatchDigest(): string {
  return `sha256:${createHash('sha256').update(canonicalJson(ALIGNMENT_CLOSURE_DISPOSITIONS), 'utf8').digest('hex')}`
}

/** Records this batch promotes from blocked to alignment-clear. */
export const NEWLY_ALIGNMENT_CLEAR: readonly string[] = ALIGNMENT_CLOSURE_DISPOSITIONS
  .filter((entry) => entry.newlyAlignmentClear)
  .map((entry) => entry.recordId)

/**
 * Refuses a disposition that would clear a record without inspected content.
 *
 * Metadata resolution says a document exists. It never says the document
 * supports a subject, so it can never carry a record from blocked to clear.
 */
export function assertClearanceIsEarned(): void {
  for (const entry of ALIGNMENT_CLOSURE_DISPOSITIONS) {
    if (!entry.newlyAlignmentClear) continue
    if (entry.verdict !== 'supported') {
      throw new Error(`${entry.recordId}: only a supported verdict can clear a record.`)
    }
    if (entry.evidenceCharacter === 'metadata-only') {
      throw new Error(`${entry.recordId}: metadata-level evidence cannot clear a record.`)
    }
    if (entry.inspectionDepth === 'not-inspected') {
      throw new Error(`${entry.recordId}: a record cannot be cleared without inspecting the source.`)
    }
    if (!entry.inspectedContentLocation.trim()) {
      throw new Error(`${entry.recordId}: a cleared record must record where the source was read.`)
    }
    if (entry.origin === null) {
      throw new Error(`${entry.recordId}: a cleared record must record a reviewed assignment origin.`)
    }
  }
  const ids = ALIGNMENT_CLOSURE_DISPOSITIONS.map((entry) => entry.recordId)
  if (new Set(ids).size !== ids.length) {
    throw new Error('A record may carry only one disposition in a closure batch.')
  }
}

assertClearanceIsEarned()
