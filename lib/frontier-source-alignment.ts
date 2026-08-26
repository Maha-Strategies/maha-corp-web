import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { FRONTIER_DOMAIN_GRAPH_RECORDS, FRONTIER_EXPLICIT_SOURCE_OVERRIDES } from './frontier-domain-graphs.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

/**
 * Source-alignment audit for the 240 frontier records.
 *
 * The corpus was built by assigning six sources per domain across thirty
 * concepts in positional blocks of five, so a record's source is whichever one
 * its index landed on. Structural resolution — the claim names a source id that
 * exists on the record — says nothing about whether that source is about the
 * record's subject. This module records, per record, what was actually checked.
 *
 * ALL INSPECTION RECORDED HERE IS INTERNAL EDITORIAL WORK. It is not
 * independent external review, peer review, or expert endorsement, and no field
 * in this module should be read as any of those. `externallyReviewed` is false
 * on every entry and there is currently no process that would set it true.
 *
 * Six things are tracked separately and never collapsed into one boolean:
 *
 *   metadataVerified          the identifier resolves in an authoritative registry
 *   sourceContentInspected    an internal editor read the abstract or full text
 *   subjectAligned            the source is about this record's subject
 *   claimSupported            the source supports the record's bounded claim
 *   independentlyReproduced   always false; nothing here reproduces an experiment
 *   externallyReviewed        always false; no external reviewer has seen this
 *
 * `supported` requires internal content inspection. Metadata resolution alone
 * can never produce it, because a DOI resolving proves a document exists, not
 * what it is about.
 *
 * `mismatched` is now equally demanding, and chronology is explicitly not a
 * basis for it. A source predating a modern technique may still support
 * foundational material, so a publication date is recorded as a risk indicator
 * and never as proof. A mismatch requires one of the declared bases below.
 */

export const SOURCE_ALIGNMENT_VERSION = 'maha-frontier-source-alignment/1.0' as const

/** An explicit audit input, not a capture timestamp. Artifacts stay byte-stable. */
export const ALIGNMENT_AUDIT_INPUT_DATE = '2026-08-26' as const

export const ASSIGNMENT_ORIGINS = [
  /** The source was named for this concept. */
  'explicit-override',
  /** The source was inherited from the positional block. Unreviewed by default. */
  'positional-legacy',
  /** Reviewed and confirmed appropriate without needing replacement. */
  'independently-curated',
] as const
export type AssignmentOrigin = (typeof ASSIGNMENT_ORIGINS)[number]

export const ALIGNMENT_VERDICTS = [
  'supported',
  'partially-supported',
  'mismatched',
  'insufficient-evidence',
  'inaccessible-source',
] as const
export type AlignmentVerdict = (typeof ALIGNMENT_VERDICTS)[number]

/**
 * What may establish a `mismatched` verdict. Publication chronology is
 * deliberately absent: it is a risk indicator, recorded separately, and a
 * module-load guard rejects any mismatch that rests on it.
 */
export const MISMATCH_BASES = [
  'inspected-content-different-subject',
  'metadata-identifies-incompatible-subject',
  'title-and-abstract-jointly-nonaligned',
] as const
export type MismatchBasis = (typeof MISMATCH_BASES)[number]

export const METADATA_METHODS = ['crossref-rest', 'publisher-page', 'catalogue-record', 'none'] as const
export type MetadataMethod = (typeof METADATA_METHODS)[number]

/**
 * Which artifact was actually read. A preprint is never silently treated as the
 * version of record, and a government report or a living specification is not
 * a peer-reviewed article. Recorded per judgement so a reviewer sees exactly
 * what was in front of the editor.
 */
export const INSPECTED_ARTIFACT_VERSIONS = [
  'version-of-record',
  'accepted-manuscript',
  'preprint',
  'government-report',
  'living-specification',
  'not-inspected',
] as const
export type InspectedArtifactVersion = (typeof INSPECTED_ARTIFACT_VERSIONS)[number]

export const TRANSCRIPTION_CONFIDENCES = ['high', 'medium', 'low'] as const
export type TranscriptionConfidence = (typeof TRANSCRIPTION_CONFIDENCES)[number]

export interface AlignmentEvidence {
  metadataVerified: boolean
  metadataMethod: MetadataMethod
  metadataNote: string
  /** An internal editor read the source. Never external or peer review. */
  sourceContentInspected: boolean
  /** Exactly where the source was read. Null whenever it was not read. */
  inspectedContentLocation: string | null
  subjectAligned: AlignmentVerdict
  /** Set only when a mismatch is asserted. Chronology is never a basis. */
  mismatchBasis: MismatchBasis | null
  /**
   * The source predates the record's technique or subject vocabulary. A concern
   * worth a reviewer's attention, never evidence of mismatch on its own.
   */
  chronologicalRiskIndicator: boolean
  claimSupported: boolean
  /**
   * Whether this source is independent of the other sources cited by the same
   * record. Null when the record cites a single source, which is every frontier
   * record today, so no independence can be asserted either way.
   */
  sourceIndependentOfOtherCitedSources: boolean | null
  /** Nothing in this repository reproduces an experiment. */
  independentlyReproduced: false
  /** No external reviewer has seen any of this. */
  externallyReviewed: false
  /** Which artifact the editor actually read. */
  inspectedArtifactVersion: InspectedArtifactVersion
}

export interface PriorMapping {
  sourceContractId: string
  sourceTitle: string
  note: string
}

export interface RecordAlignmentAudit {
  recordId: string
  recordTitle: string
  domainSlug: string
  sourceContractId: string
  sourceTitle: string
  sourceAuthors: readonly string[]
  sourceYear: string | null
  sourceIdentifier: string | null
  locator: string | null
  assignmentOrigin: AssignmentOrigin
  evidence: AlignmentEvidence
  reason: string
  transcriptionConfidence: TranscriptionConfidence
  remediation: string
  /** Preserved verbatim when a mapping was corrected. Append-only. */
  priorMapping: PriorMapping | null
  /** A superseded judgement from an earlier batch, preserved verbatim. */
  priorJudgement: InspectedJudgement['priorJudgement'] | null
  /** A proposed replacement source awaiting a human decision. Never applied. */
  proposedSourceOverride: InspectedJudgement['proposedSourceOverride'] | null
}

/* ------------------------------------------------------- cached registry -- */

interface MetadataCacheEntry {
  status: string
  registeredTitle?: string
  containerTitle?: string
  issuedYear?: number | null
  firstAuthorFamily?: string | null
  authorCount?: number
}

const cacheUrl = new URL('../content/frontier-audit/source-metadata-cache.json', import.meta.url)
const metadataCache: Record<string, MetadataCacheEntry> =
  JSON.parse(readFileSync(cacheUrl, 'utf8')).entries ?? {}

/* --------------------------------------------------- inspected judgements -- */

interface InspectedJudgement {
  verdict: AlignmentVerdict
  inspectedContentLocation: string | null
  sourceContentInspected: boolean
  reason: string
  remediation: string
  origin?: AssignmentOrigin
  mismatchBasis?: MismatchBasis
  chronologicalRiskIndicator?: boolean
  artifactVersion?: InspectedArtifactVersion
  /**
   * A superseded judgement, preserved verbatim when a later batch re-inspected
   * the same source with better evidence. Append-only: the earlier finding is
   * never deleted, only nested.
   */
  priorJudgement?: {
    batchId: string
    verdict: AlignmentVerdict
    inspectedContentLocation: string | null
    reason: string
  }
  /**
   * A replacement source proposed but NOT applied. Recording a proposal is not
   * substituting a source: nothing here changes what the record cites.
   */
  proposedSourceOverride?: {
    citation: string
    identifier: string
    rationale: string
    decision: 'pending-human-decision'
  }
}

/**
 * Append-only per-record judgements from the bounded alignment batches.
 * Batch 3 adds exactly five internally inspected records per frontier domain.
 * A shared source is judged independently against every attached record: one
 * document may therefore support one record, partially support another, and
 * mismatch a third. Inspection is never inferred from registry metadata.
 *
 * Every record NOT named here defaults to `insufficient-evidence`. That is the
 * honest state for an unreviewed positional assignment, and it blocks.
 */
const JUDGEMENTS: Readonly<Record<string, InspectedJudgement>> = {
  // ---- ITER magnets page, read 2026-08-26 --------------------------------
  'urn:maha:record:fusion-plasma-systems-magnetic-confinement': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Machine / Magnets, toroidal field section',
    reason:
      'The page states that the eighteen D-shaped toroidal field magnets produce a field whose primary function is to confine the plasma particles, which is the record subject.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-toroidal-field-coils': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Machine / Magnets, toroidal field section',
    reason: 'The page describes the toroidal field coil set and its confining function directly.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-poloidal-field-coils': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Machine / Magnets, poloidal field section',
    reason:
      'The page describes six ring-shaped poloidal field coils outside the toroidal structure that shape the plasma and contribute to stability.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-central-solenoid-inductive-drive': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Machine / Magnets, central solenoid section',
    reason:
      'The page describes the central solenoid as inducing and maintaining plasma current during long pulses, which is the inductive drive the record names.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Machine / Magnets, poloidal field and correction coil sections',
    reason:
      'The page covers shaping and stability, which bear on equilibrium, but a machine description does not establish plasma equilibrium as a physics result. The coil hardware is supported; the equilibrium concept is not.',
    remediation:
      'Bind to a plasma-physics source that treats equilibrium directly, or narrow the record to the coil systems that act on it.',
  },

  // ---- MCP tools specification, read 2026-08-26 ---------------------------
  'urn:maha:record:agentic-systems-mcp-mcp-client-server-roles': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Protocol Messages and Message Flow sections',
    reason:
      'The specification defines the client and server roles in the tools/list and tools/call exchange, including the sequence between model, client and server.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-capability-negotiation': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Capabilities section',
    reason:
      'The specification states that servers supporting tools MUST declare the tools capability, and defines listChanged notification behaviour. That is the negotiation the record names.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-tool-discovery': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Protocol Messages, Listing Tools section',
    reason: 'The specification defines the tools/list request and its paginated response, which is tool discovery.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-tool-input-schemas': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Data Types, Tool definition section',
    reason:
      'The specification defines inputSchema as a JSON Schema describing expected parameters, with an optional outputSchema, which is the record subject.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-tool-result-contracts': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Data Types, Tool Result and Structured Content sections',
    reason:
      'The specification defines structured and unstructured result content, the isError convention and output-schema validation, which is the result contract the record names.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },

  // ---- corrected mappings, read 2026-08-26 -------------------------------
  'urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Abstract',
    reason:
      'The abstract reports fabrication and characterisation of graphene devices on single-crystal hexagonal boron nitride substrates, which is the record subject.',
    remediation: 'None. The mapping was corrected in this batch.',
    origin: 'explicit-override',
  },
  'urn:maha:record:neurotechnology-bci-spike-sorting-boundaries': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Quality metrics and Summary matrices sections',
    reason:
      'The paper defines false-positive and false-negative error estimates for sorted units and argues they should be reported, which bounds what spike sorting establishes.',
    remediation: 'None. The mapping was corrected in this batch.',
    origin: 'explicit-override',
  },

  /* ---- alignment batch 2, read 2026-08-26 ------------------------------ */
  'urn:maha:record:fusion-plasma-systems-divertor-heat-exhaust': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER "Making it work" page, divertor and heat-exhaust sections',
    reason:
      'The page describes the divertor as extracting heat and particles from the plasma and protecting the walls, which is the record subject.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-plasma-facing-components': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER "Making it work" page, divertor and heat-exhaust sections',
    reason:
      'The page treats wall and material loading under extreme neutron and particle flux, but does not develop plasma-facing components as a distinct subject.',
    remediation: 'Narrow the record to what the page covers, or bind a source that treats plasma-facing components directly.',
  },
  'urn:maha:record:fusion-plasma-systems-plasma-position-and-shape-control': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER "Making it work" page, divertor and heat-exhaust sections',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The declared locator claims the page describes plasma control. It was read and does not discuss plasma position or shape control systems at all.',
    remediation: 'Replace with a source that treats magnetic control of plasma position and shape.',
  },
  'urn:maha:record:fusion-plasma-systems-edge-localized-modes': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER "Making it work" page, divertor and heat-exhaust sections',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The page was read and does not mention edge-localized modes anywhere.',
    remediation: 'Replace with a source that reports ELM physics or mitigation.',
  },
  'urn:maha:record:fusion-plasma-systems-resonant-magnetic-perturbations': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER "Making it work" page, divertor and heat-exhaust sections',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The page was read and does not mention resonant magnetic perturbations anywhere.',
    remediation: 'Replace with a source that reports RMP coils or ELM suppression by perturbation.',
  },
  'urn:maha:record:advanced-materials-graphene-monolayers': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:cond-mat/0410550 abstract (the Science 2004 preprint of record)',
    reason:
      'The abstract reports a naturally occurring two-dimensional material and an all-metallic field-effect transistor in films down to a few atomic layers, which is the record subject.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:advanced-materials-graphene-hbn-heterostructures': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:cond-mat/0410550 abstract (the Science 2004 preprint of record)',
    chronologicalRiskIndicator: true,
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. It reports field-effect transport in thin graphitic films and involves no boron nitride, so it cannot support a graphene-on-boron-nitride heterostructure record. This replaces an earlier verdict that rested on publication date; the basis is now the inspected content.',
    remediation: 'Bind Dean et al. (2010), already in this corpus, after inspecting it for this record.',
  },
  'urn:maha:record:advanced-materials-moire-superlattices': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:cond-mat/0410550 abstract (the Science 2004 preprint of record)',
    chronologicalRiskIndicator: true,
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. It reports single-film transport and involves no stacked or rotated layers, so no moire superlattice is present. The earlier chronological reasoning has been replaced by inspected content.',
    remediation: 'Bind a source that reports moire superlattice formation or measurement.',
  },
  'urn:maha:record:advanced-materials-twist-angle-control': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:cond-mat/0410550 abstract (the Science 2004 preprint of record)',
    chronologicalRiskIndicator: true,
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. It involves no twisted stack and no angle control. The earlier chronological reasoning has been replaced by inspected content.',
    remediation: 'Bind a source that reports twist-angle control in assembled stacks.',
  },
  'urn:maha:record:advanced-materials-correlated-insulating-states': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1803.02342 abstract and reported phase diagram',
    reason:
      'The abstract reports correlated insulating states at half-filling in twisted bilayer graphene, which is the record subject.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:advanced-materials-magic-angle-superconductivity': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1803.02342 abstract and reported phase diagram',
    reason:
      'The paper reports superconductivity near the first magic angle with a phase diagram and zero-resistance transport, which is the record subject.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:advanced-materials-tmd-monolayers': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1803.02342 abstract and reported phase diagram',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read and concerns twisted bilayer graphene exclusively. It involves no transition metal dichalcogenide.',
    remediation: 'Bind a source that reports TMD monolayers.',
  },
  'urn:maha:record:advanced-materials-direct-gap-mos2': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1803.02342 abstract and reported phase diagram',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read and involves no molybdenum disulfide and no band-gap measurement.',
    remediation: 'Bind a source that reports the direct gap in monolayer MoS2.',
  },
  'urn:maha:record:advanced-materials-valley-polarized-excitons': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1803.02342 abstract and reported phase diagram',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read and reports no excitonic or valley-polarisation measurement.',
    remediation: 'Bind a source that reports valley-polarised excitons.',
  },
  'urn:maha:record:biomolecular-engineering-protein-backbone-diffusion': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract of the same study (10.1101/2022.12.09.519842v2)',
    reason:
      'The abstract describes a generative model of protein backbones obtained by fine-tuning a structure prediction network on denoising tasks, which is the record subject.',
    remediation: 'None, subject to confirming the published Nature version matches the preprint on this point.',
    origin: 'independently-curated',
  },
  'urn:maha:record:biomolecular-engineering-unconditional-protein-generation': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract of the same study (10.1101/2022.12.09.519842v2)',
    reason:
      'The abstract reports unconditional protein monomer design explicitly.',
    remediation: 'None, subject to confirming the published version.',
    origin: 'independently-curated',
  },
  'urn:maha:record:biomolecular-engineering-motif-scaffolding': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract of the same study (10.1101/2022.12.09.519842v2)',
    reason:
      'The abstract reports motif scaffolding, including symmetric motif scaffolding for therapeutic and metal-binding design.',
    remediation: 'None, subject to confirming the published version.',
    origin: 'independently-curated',
  },
  'urn:maha:record:biomolecular-engineering-de-novo-binder-design': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract of the same study (10.1101/2022.12.09.519842v2)',
    reason:
      'The abstract reports protein binder design as one of the demonstrated tasks.',
    remediation: 'None, subject to confirming the published version.',
    origin: 'independently-curated',
  },
  'urn:maha:record:biomolecular-engineering-structure-prediction-filtering': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract of the same study (10.1101/2022.12.09.519842v2)',
    reason:
      'The abstract describes integrating a structure prediction network into the generative model. It does not establish a separate prediction-based filtering stage applied to generated designs, which is what the record names.',
    remediation: 'Inspect the Methods for an explicit filtering step, or narrow the record to network integration.',
  },
  'urn:maha:record:mechanistic-interpretability-neural-feature-superposition': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: '"Toy Models of Superposition" article, motivation, background and geometry sections',
    reason:
      'The article develops superposition, in which more features are represented than there are dimensions, as its central subject.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:mechanistic-interpretability-polysemantic-neurons': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: '"Toy Models of Superposition" article, motivation, background and geometry sections',
    reason:
      'The article treats neurons responding to multiple unrelated features, which is the record subject.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:mechanistic-interpretability-toy-models-of-superposition': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: '"Toy Models of Superposition" article, motivation, background and geometry sections',
    reason:
      'The article is the toy-model study itself.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:mechanistic-interpretability-superposition-geometry': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: '"Toy Models of Superposition" article, motivation, background and geometry sections',
    reason:
      'The article examines how features arrange geometrically in high-dimensional space under superposition.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:mechanistic-interpretability-representation-probing-boundary': {
    verdict: 'insufficient-evidence',
    sourceContentInspected: true,
    inspectedContentLocation: '"Toy Models of Superposition" article, motivation, background and geometry sections',
    reason:
      'The article was inspected and no explicit treatment of linear probing methodology was found, but the inspection was a structured summary rather than a full read, so nonalignment is not established either.',
    remediation: 'Read the full article for probing methodology, or bind a source that treats probing directly.',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-resource-discovery': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'MCP specification index: Features, Security and Trust & Safety sections',
    reason:
      'The specification names Resources as a server feature providing context and data to the user or model.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-prompt-templates': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'MCP specification index: Features, Security and Trust & Safety sections',
    reason:
      'The specification names Prompts as templated messages and workflows offered by servers.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-tool-deny-by-default': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'MCP specification index: Features, Security and Trust & Safety sections',
    reason:
      'The specification states that hosts must obtain explicit user consent before invoking any tool, which is a deny-by-default posture.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-session-lifecycle': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'MCP specification index: Features, Security and Trust & Safety sections',
    reason:
      'The index names stateful connections and capability negotiation but defers lifecycle detail to a linked page that was not inspected.',
    remediation: 'Inspect the lifecycle page and bind it, or narrow the record.',
  },
  'urn:maha:record:agentic-systems-mcp-tool-allowlisting': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'MCP specification index: Features, Security and Trust & Safety sections',
    reason:
      'The index requires explicit per-tool authorization, which is the policy an allowlist implements, but specifies no allowlist mechanism.',
    remediation: 'Bind a source that specifies an allowlist mechanism, or narrow the record to consent-gated invocation.',
  },
  'urn:maha:record:critical-supply-chains-critical-mineral-import-reliance': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'USGS Mineral Supply Chain Analysis page, criticality and disruption sections',
    reason:
      'The page describes net import reliance statistics reported per commodity, which is the record subject.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:critical-supply-chains-single-country-processing-concentration': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'USGS Mineral Supply Chain Analysis page, criticality and disruption sections',
    reason:
      'The page references analysis of global and domestic trends and vulnerability scenarios but does not develop single-country processing concentration as a distinct measure.',
    remediation: 'Bind a source that quantifies processing concentration, or narrow the record.',
  },
  'urn:maha:record:critical-supply-chains-export-control-exposure': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'USGS Mineral Supply Chain Analysis page, criticality and disruption sections',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The page was read and does not treat export controls.',
    remediation: 'Bind a source that analyses export-control exposure.',
  },
  'urn:maha:record:critical-supply-chains-material-substitution-boundaries': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'USGS Mineral Supply Chain Analysis page, criticality and disruption sections',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The page was read and does not treat material substitution.',
    remediation: 'Bind a source that analyses substitution feasibility and its limits.',
  },
  'urn:maha:record:critical-supply-chains-supply-chain-data-uncertainty': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'USGS Mineral Supply Chain Analysis page, criticality and disruption sections',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The page was read and does not treat data uncertainty or its quantification.',
    remediation: 'Bind a source that reports uncertainty in supply-chain data.',
  },

  /* ---- alignment batch 3, read 2026-08-26 ------------------------------ */
  ...Object.fromEntries([
    ['advanced-materials-interlayer-excitons', 'mismatched', 'The abstract and photoluminescence comparison concern the direct-gap transition in monolayer MoS2, not interlayer excitons.'],
    ['advanced-materials-quantum-anomalous-hall-state', 'mismatched', 'The inspected paper concerns the MoS2 layer-dependent band gap and reports no anomalous Hall state.'],
    ['advanced-materials-spin-momentum-locking', 'mismatched', 'The inspected paper reports MoS2 photoluminescence and band structure, not spin-momentum locking.'],
    ['advanced-materials-tmd-heterobilayers', 'partially-supported', 'The source establishes monolayer MoS2 as a direct-gap TMD, but does not study a heterobilayer.'],
    ['advanced-materials-topological-insulator-surface-states', 'mismatched', 'The inspected source concerns monolayer MoS2 and contains no topological-insulator surface-state result.'],
  ].map(([slug, verdict, reason]) => [`urn:maha:record:${slug}`, {
    verdict, sourceContentInspected: true,
    inspectedContentLocation: 'APS abstract and photoluminescence comparison for DOI 10.1103/PhysRevLett.105.136805',
    ...(verdict === 'mismatched' ? { mismatchBasis: 'inspected-content-different-subject' } : {}),
    reason,
    remediation: verdict === 'supported' ? 'None.' : 'Bind a source that directly treats the named subject, or narrow the record to monolayer MoS2 direct-gap evidence.',
    ...(verdict === 'supported' ? { origin: 'independently-curated' } : {}),
  }])),
  ...Object.fromEntries([
    ['agentic-systems-mcp-context-window-position-effects', 'supported', 'The paper directly measures how answer accuracy changes with the position of relevant information in long contexts.'],
    ['agentic-systems-mcp-context-window-token-degradation', 'partially-supported', 'The experiments show long-context performance degradation, but not a general monotonic degradation law per token.'],
    ['agentic-systems-mcp-human-approval-boundaries', 'mismatched', 'The paper studies long-context retrieval and question answering, not human approval controls.'],
    ['agentic-systems-mcp-retrieval-context-selection', 'partially-supported', 'The multi-document retrieval task bears on context selection, but the paper does not specify a retrieval-selection system.'],
    ['agentic-systems-mcp-tool-result-context-injection', 'mismatched', 'The paper studies document position effects and does not examine tool-result injection.'],
  ].map(([slug, verdict, reason]) => [`urn:maha:record:${slug}`, {
    verdict, sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2307.03172 abstract, multi-document QA and key-value retrieval experiments, position-effect results',
    ...(verdict === 'mismatched' ? { mismatchBasis: 'inspected-content-different-subject' } : {}), reason,
    remediation: verdict === 'supported' ? 'None. Record the mapping as curated rather than positional.' : 'Bind a source directly covering the named system boundary, or narrow the record to the inspected long-context result.',
    ...(verdict === 'supported' ? { origin: 'independently-curated' } : {}),
  }])),
  ...Object.fromEntries([
    ['biomolecular-engineering-cell-free-reaction-yield', 'partially-supported', 'The review discusses flexible cell-free production but does not establish a bounded reaction-yield measure.'],
    ['biomolecular-engineering-cell-free-transcription-translation', 'supported', 'The review directly treats cell-free protein synthesis and engineering biological parts outside living cells.'],
    ['biomolecular-engineering-crude-extract-cell-free-systems', 'partially-supported', 'The review covers cell-free systems broadly, but the inspected sections do not isolate crude-extract systems.'],
    ['biomolecular-engineering-energy-regeneration-in-cell-free-systems', 'mismatched', 'The inspected review sections do not treat energy-regeneration chemistry or kinetics.'],
    ['biomolecular-engineering-purified-component-expression-systems', 'partially-supported', 'The review covers cell-free expression but does not distinguish purified-component systems in the inspected sections.'],
  ].map(([slug, verdict, reason]) => [`urn:maha:record:${slug}`, {
    verdict, sourceContentInspected: true,
    inspectedContentLocation: 'Open-access abstract and protein-engineering, metabolic-engineering, and artificial-cell sections for DOI 10.1016/j.synbio.2017.02.003',
    ...(verdict === 'mismatched' ? { mismatchBasis: 'inspected-content-different-subject' } : {}), reason,
    remediation: verdict === 'supported' ? 'None. Record the mapping as curated rather than positional.' : 'Bind a source or exact section directly supporting the named platform property.',
    ...(verdict === 'supported' ? { origin: 'independently-curated' } : {}),
  }])),
  ...Object.fromEntries([
    ['critical-supply-chains-dysprosium-ore-to-oxide', 'partially-supported', 'The rare-earth chapter covers production, compounds and metals, trade and resources, but not a dysprosium-specific ore-to-oxide process.'],
    ['critical-supply-chains-heavy-rare-earth-diffusion', 'mismatched', 'The commodity chapter does not describe grain-boundary diffusion in permanent magnets.'],
    ['critical-supply-chains-nd-fe-b-magnet-alloying', 'partially-supported', 'The chapter identifies permanent magnets as a rare-earth use but does not specify Nd-Fe-B alloying operations.'],
    ['critical-supply-chains-neodymium-praseodymium-separation', 'mismatched', 'The chapter reports commodity supply and trade rather than Nd/Pr separation chemistry.'],
    ['critical-supply-chains-rare-earth-solvent-extraction', 'mismatched', 'The chapter does not establish a solvent-extraction flowsheet or operating conditions.'],
  ].map(([slug, verdict, reason]) => [`urn:maha:record:${slug}`, {
    verdict, sourceContentInspected: true,
    inspectedContentLocation: 'USGS Mineral Commodity Summaries 2026, Rare Earths commodity chapter',
    ...(verdict === 'mismatched' ? { mismatchBasis: 'inspected-content-different-subject' } : {}), reason,
    remediation: 'Bind process-specific evidence for the named transformation; retain MCS 2026 only for commodity-level context.',
  }])),
  ...Object.fromEntries([
    ['fusion-plasma-systems-breeding-blanket-test-modules', 'supported', 'ITER documents test blanket modules and their role in testing tritium breeding and extraction.'],
    ['fusion-plasma-systems-cryogenic-magnet-cooling', 'supported', 'The supporting-systems documentation identifies cryogenics as a system supporting ITER magnet operation.'],
    ['fusion-plasma-systems-plasma-diagnostics', 'supported', 'The diagnostics page directly describes instruments and measured plasma parameters.'],
    ['fusion-plasma-systems-tritium-fuel-cycle', 'supported', 'The fuelling page directly describes the closed fuel cycle, isotope separation, storage, delivery, and detritiation.'],
    ['fusion-plasma-systems-vacuum-vessel-boundary', 'partially-supported', 'The diagnostics documentation identifies port plugs as a primary vacuum boundary, but does not fully specify the vessel boundary.'],
  ].map(([slug, verdict, reason]) => [`urn:maha:record:${slug}`, {
    verdict, sourceContentInspected: true,
    inspectedContentLocation: 'ITER Supporting Systems index and linked Tritium Breeding, Fuelling, Diagnostics, Cryogenics, and Vacuum documentation', reason,
    remediation: verdict === 'supported' ? 'None. Record the mapping as curated rather than positional.' : 'Bind the vacuum-vessel engineering basis for the complete boundary definition.',
    ...(verdict === 'supported' ? { origin: 'independently-curated' } : {}),
  }])),
  ...Object.fromEntries([
    ['longevity-metabolism-nad-consumption-by-parps', 'supported', 'The review directly identifies PARPs as NAD-consuming enzymes and discusses their ageing-related roles.'],
    ['longevity-metabolism-nad-salvage-pathway', 'supported', 'The review describes NAD biosynthesis and salvage pathways directly.'],
    ['longevity-metabolism-nampt-rate-limiting-step', 'supported', 'The full-text review treats NAMPT in the NAD salvage pathway and its regulation.'],
    ['longevity-metabolism-nmn-and-nr-precursors', 'supported', 'The review directly discusses NMN and NR as NAD precursors.'],
    ['longevity-metabolism-nmnat-compartmentalization', 'supported', 'The review identifies NMNAT isoforms and their cellular compartmentalization.'],
  ].map(([slug, verdict, reason]) => [`urn:maha:record:${slug}`, {
    verdict, sourceContentInspected: true,
    inspectedContentLocation: 'PMC7963035, NAD+ biosynthesis, consumption, compartmentalization, and ageing sections', reason,
    remediation: 'None. Record the mapping as curated rather than positional.', origin: 'independently-curated',
  }])),
  ...Object.fromEntries([
    ['mechanistic-interpretability-activation-patching', 'partially-supported', 'Causal scrubbing uses activation-resampling interventions but is not itself a general activation-patching specification.'],
    ['mechanistic-interpretability-causal-scrubbing', 'supported', 'The article defines causal scrubbing as a mechanically derived test of an interpretability hypothesis.'],
    ['mechanistic-interpretability-interchange-interventions', 'partially-supported', 'The method performs correspondence-guided interventions, but the inspected article does not establish the broader interchange-intervention formalism.'],
    ['mechanistic-interpretability-model-component-ablation', 'mismatched', 'The article tests hypotheses through resampling interventions rather than component ablation.'],
    ['mechanistic-interpretability-path-patching', 'mismatched', 'The article does not define the later path-patching technique.'],
  ].map(([slug, verdict, reason]) => [`urn:maha:record:${slug}`, {
    verdict, sourceContentInspected: true,
    inspectedContentLocation: 'Causal Scrubbing article, method definition, correspondence, resampling interventions, examples, and limitations',
    ...(verdict === 'mismatched' ? { mismatchBasis: 'inspected-content-different-subject' } : {}), reason,
    remediation: verdict === 'supported' ? 'None. Record the mapping as curated rather than positional.' : 'Bind the technique-specific source or narrow the record to causal-scrubbing interventions.',
    ...(verdict === 'supported' ? { origin: 'independently-curated' } : {}),
  }])),
  'urn:maha:record:neurotechnology-bci-adaptive-stimulation-policies': {
    verdict: 'partially-supported', sourceContentInspected: true,
    inspectedContentLocation: 'Neuron abstract and closed-loop detection, stimulation-timing, and outcome-comparison sections for DOI 10.1016/j.neuron.2011.08.023',
    reason: 'The study demonstrates adaptive closed-loop stimulation triggered by neural activity, but does not establish a general policy framework.',
    remediation: 'Narrow to the demonstrated stimulation rule or bind a source comparing adaptive policies.',
  },
  'urn:maha:record:longevity-metabolism-autophagosome-abundance': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch through PubMed and Europe PMC; both returned navigation shells rather than the record, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the guidelines through a retrievable route, inspect the named assay-interpretation sections, then confirm or replace.',
  },
  'urn:maha:record:longevity-metabolism-autophagic-flux': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch through PubMed and Europe PMC; both returned navigation shells rather than the record, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the guidelines through a retrievable route, inspect the named assay-interpretation sections, then confirm or replace.',
  },
  'urn:maha:record:longevity-metabolism-lysosomal-degradation-blockade': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch through PubMed and Europe PMC; both returned navigation shells rather than the record, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the guidelines through a retrievable route, inspect the named assay-interpretation sections, then confirm or replace.',
  },
  'urn:maha:record:longevity-metabolism-lc3-turnover-assays': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch through PubMed and Europe PMC; both returned navigation shells rather than the record, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the guidelines through a retrievable route, inspect the named assay-interpretation sections, then confirm or replace.',
  },
  'urn:maha:record:longevity-metabolism-p62-sqstm1-turnover': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch through PubMed and Europe PMC; both returned navigation shells rather than the record, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the guidelines through a retrievable route, inspect the named assay-interpretation sections, then confirm or replace.',
  },
  'urn:maha:record:neurotechnology-bci-neuropixels-cmos-probe': {
    verdict: 'supported', sourceContentInspected: true,
    inspectedContentLocation: 'UCL open-access abstract for DOI 10.1038/nature24636',
    reason:
      'The abstract directly describes a CMOS-compatible, fully integrated silicon probe with on-chip filtering, amplification, multiplexing and digitization.',
    remediation: 'None. Record the mapping as curated rather than positional.', origin: 'independently-curated',
  },
  'urn:maha:record:neurotechnology-bci-neuropixels-recording-sites': {
    verdict: 'supported', sourceContentInspected: true,
    inspectedContentLocation: 'UCL open-access abstract for DOI 10.1038/nature24636',
    reason:
      'The abstract reports 960 low-impedance recording sites tiled along the probe shank.',
    remediation: 'None. Record the mapping as curated rather than positional.', origin: 'independently-curated',
  },
  'urn:maha:record:neurotechnology-bci-neuropixels-channel-selection': {
    verdict: 'supported', sourceContentInspected: true,
    inspectedContentLocation: 'UCL open-access abstract for DOI 10.1038/nature24636',
    reason:
      'The abstract states that 384 recording channels can programmably address 960 sites, directly supporting channel selection.',
    remediation: 'None. Record the mapping as curated rather than positional.', origin: 'independently-curated',
  },
  'urn:maha:record:neurotechnology-bci-extracellular-spike-recording': {
    verdict: 'supported', sourceContentInspected: true,
    inspectedContentLocation: 'UCL open-access abstract for DOI 10.1038/nature24636',
    reason:
      'The abstract directly reports extracellular recordings with sub-millisecond resolution and well-isolated spiking activity.',
    remediation: 'None. Record the mapping as curated rather than positional.', origin: 'independently-curated',
  },
  'urn:maha:record:neurotechnology-bci-micro-ecog-arrays': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-electrocorticography-spatial-resolution': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-flexible-conformal-electrode-arrays': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-electrode-tissue-interface': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-impedance-and-noise': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },

  /* ---- alignment batch 4, read 2026-08-26 ------------------------------
   * Written as explicit object keys, not an Object.fromEntries spread, so a
   * duplicate is a compiler error and every verdict is type-checked. See the
   * batch registry below for machine-checkable membership.
   */
  'urn:maha:record:advanced-materials-two-dimensional-magnetism': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1002.3895 abstract and scope statement for Rev Mod Phys 82, 3045',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. It is a theory colloquium on topological insulators, surface states and spin texture, and it does not treat two-dimensional magnetism. Its subject is electronic band topology, not two-dimensional materials fabrication.',
    remediation: 'Bind a source that treats two-dimensional material assembly and interface quality.',
  },
  'urn:maha:record:advanced-materials-van-der-waals-assembly': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1002.3895 abstract and scope statement for Rev Mod Phys 82, 3045',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. It is a theory colloquium on topological insulators, surface states and spin texture, and it does not treat van der Waals assembly of exfoliated flakes. Its subject is electronic band topology, not two-dimensional materials fabrication.',
    remediation: 'Bind a source that treats two-dimensional material assembly and interface quality.',
  },
  'urn:maha:record:advanced-materials-dry-transfer-contamination': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1002.3895 abstract and scope statement for Rev Mod Phys 82, 3045',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. It is a theory colloquium on topological insulators, surface states and spin texture, and it does not treat dry-transfer contamination. Its subject is electronic band topology, not two-dimensional materials fabrication.',
    remediation: 'Bind a source that treats two-dimensional material assembly and interface quality.',
  },
  'urn:maha:record:advanced-materials-interface-bubbles-and-strain': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1002.3895 abstract and scope statement for Rev Mod Phys 82, 3045',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. It is a theory colloquium on topological insulators, surface states and spin texture, and it does not treat interface bubbles and strain. Its subject is electronic band topology, not two-dimensional materials fabrication.',
    remediation: 'Bind a source that treats two-dimensional material assembly and interface quality.',
  },
  'urn:maha:record:advanced-materials-encapsulation-boundaries': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:1002.3895 abstract and scope statement for Rev Mod Phys 82, 3045',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. It is a theory colloquium on topological insulators, surface states and spin texture, and it does not treat encapsulation of two-dimensional materials. Its subject is electronic band topology, not two-dimensional materials fabrication.',
    remediation: 'Bind a source that treats two-dimensional material assembly and interface quality.',
  },
  'urn:maha:record:biomolecular-engineering-sequence-design-with-proteinmpnn': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract (10.1101/2022.06.03.494563v1) of the ProteinMPNN study',
    reason:
      'The abstract presents ProteinMPNN as a deep-learning protein sequence design method and reports 52.4 percent native sequence recovery against 32.9 percent for Rosetta.',
    remediation: 'None, subject to confirming the published Science version matches the preprint on this point.',
    origin: 'independently-curated',
  },
  'urn:maha:record:biomolecular-engineering-experimental-fold-validation': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract (10.1101/2022.06.03.494563v1) of the ProteinMPNN study',
    reason:
      'The abstract reports experimental validation of designs by X-ray crystallography, cryo-EM and functional studies.',
    remediation: 'None, subject to confirming the published version.',
    origin: 'independently-curated',
  },
  'urn:maha:record:biomolecular-engineering-protein-design-success-rate': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract (10.1101/2022.06.03.494563v1) of the ProteinMPNN study',
    reason:
      'The abstract reports rescuing previously failed designs and gives a sequence-recovery figure, but does not establish a design success rate as a bounded measure.',
    remediation: 'Read the benchmark sections for a success-rate definition, or narrow the record to sequence recovery.',
  },
  'urn:maha:record:biomolecular-engineering-off-target-binding-characterization': {
    verdict: 'insufficient-evidence',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract (10.1101/2022.06.03.494563v1) of the ProteinMPNN study',
    reason:
      'Off-target binding is not addressed at abstract level. Only the abstract was read, so absence there does not establish that the study omits it.',
    remediation: 'Read the supplementary methods, then confirm or replace.',
  },
  'urn:maha:record:biomolecular-engineering-design-to-assay-provenance': {
    verdict: 'insufficient-evidence',
    sourceContentInspected: true,
    inspectedContentLocation: 'bioRxiv preprint abstract (10.1101/2022.06.03.494563v1) of the ProteinMPNN study',
    reason:
      'Provenance tracking from design to assay is not addressed at abstract level, and deeper sections were not read.',
    remediation: 'Read the methods for a provenance chain, or bind a source that treats design-to-assay traceability.',
  },
  'urn:maha:record:longevity-metabolism-senolytic-selectivity': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Aging Cell 14(4) 644-658 article text: survival pathways, compound screening, cell assays and mouse experiments',
    reason:
      'The article reports dasatinib and quercetin preferentially killing senescent rather than proliferating cells, which is the record subject.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:longevity-metabolism-apoptosis-in-senescent-cells': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Aging Cell 14(4) 644-658 article text: survival pathways, compound screening, cell assays and mouse experiments',
    reason:
      'The article establishes pro-survival and anti-apoptotic networks in senescent cells and shows selective death on siRNA knockdown and pharmacological intervention.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:longevity-metabolism-cellular-senescence-markers': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Aging Cell 14(4) 644-658 article text: survival pathways, compound screening, cell assays and mouse experiments',
    reason:
      'The article measures SA-beta-galactosidase activity and p16 expression as senescence markers throughout its assays.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:longevity-metabolism-senescent-cell-clearance': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Aging Cell 14(4) 644-658 article text: survival pathways, compound screening, cell assays and mouse experiments',
    reason:
      'The article documents senescent-cell clearance with functional improvement in aged, radiation-exposed and Ercc1 mutant mice.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:longevity-metabolism-senescence-associated-secretory-phenotype': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'Aging Cell 14(4) 644-658 article text: survival pathways, compound screening, cell assays and mouse experiments',
    reason:
      'The SASP is referenced as a contributor to dysfunction but is not itself measured or characterised in the inspected sections.',
    remediation: 'Bind a source that characterises the SASP directly, or narrow the record.',
  },
  'urn:maha:record:mechanistic-interpretability-sparse-autoencoder-dictionaries': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2309.08600 abstract and method summary',
    reason:
      'The abstract describes using sparse autoencoders to learn sets of sparsely activating features from language-model activations, which is the dictionary the record names.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:mechanistic-interpretability-sae-encoder-decoder': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2309.08600 abstract and method summary',
    reason:
      'The method reconstructs internal activations through an autoencoder, so the encoder and decoder are the mechanism the paper uses.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:mechanistic-interpretability-sae-sparsity-fidelity-tradeoff': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2309.08600 abstract and method summary',
    reason:
      'The training objective balances sparsity against reconstruction of activations, but the abstract does not establish a characterised tradeoff curve.',
    remediation: 'Read the reconstruction and sparsity objective sections for a measured tradeoff before confirming.',
  },
  'urn:maha:record:mechanistic-interpretability-feature-splitting': {
    verdict: 'insufficient-evidence',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2309.08600 abstract and method summary',
    reason:
      'Feature splitting is not addressed at abstract level. Only the abstract and method summary were read, and the paper has feature-analysis sections that were not inspected.',
    remediation: 'Read the feature-analysis sections, then confirm or replace.',
  },
  'urn:maha:record:mechanistic-interpretability-feature-absorption': {
    verdict: 'insufficient-evidence',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2309.08600 abstract and method summary',
    chronologicalRiskIndicator: true,
    reason:
      'Feature absorption is not addressed at abstract level and the feature-analysis sections were not read. The term also postdates this work, which is recorded as a risk indicator and is not itself a basis for mismatch.',
    remediation: 'Read the feature-analysis sections, or bind a source that treats absorption directly.',
  },
  'urn:maha:record:agentic-systems-mcp-agent-plan-execution-separation': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2210.03629 abstract and single-agent trajectory description',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. ReAct is a single-agent method that interleaves reasoning traces with actions, and it does not treat a separation of planning from execution. The paper affirmatively describes one agent, so this is a statement about what it is, not merely an absence.',
    remediation: 'Bind a multi-agent source, or for the plan-execution record note that ReAct argues against separating the two.',
  },
  'urn:maha:record:agentic-systems-mcp-multi-agent-role-assignment': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2210.03629 abstract and single-agent trajectory description',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. ReAct is a single-agent method that interleaves reasoning traces with actions, and it does not treat multi-agent role assignment. The paper affirmatively describes one agent, so this is a statement about what it is, not merely an absence.',
    remediation: 'Bind a multi-agent source, or for the plan-execution record note that ReAct argues against separating the two.',
  },
  'urn:maha:record:agentic-systems-mcp-multi-agent-coordination-protocols': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2210.03629 abstract and single-agent trajectory description',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. ReAct is a single-agent method that interleaves reasoning traces with actions, and it does not treat multi-agent coordination protocols. The paper affirmatively describes one agent, so this is a statement about what it is, not merely an absence.',
    remediation: 'Bind a multi-agent source, or for the plan-execution record note that ReAct argues against separating the two.',
  },
  'urn:maha:record:agentic-systems-mcp-multi-agent-deadlock': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2210.03629 abstract and single-agent trajectory description',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. ReAct is a single-agent method that interleaves reasoning traces with actions, and it does not treat multi-agent deadlock. The paper affirmatively describes one agent, so this is a statement about what it is, not merely an absence.',
    remediation: 'Bind a multi-agent source, or for the plan-execution record note that ReAct argues against separating the two.',
  },
  'urn:maha:record:agentic-systems-mcp-distributed-agent-consensus': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2210.03629 abstract and single-agent trajectory description',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The source was read. ReAct is a single-agent method that interleaves reasoning traces with actions, and it does not treat distributed agent consensus. The paper affirmatively describes one agent, so this is a statement about what it is, not merely an absence.',
    remediation: 'Bind a multi-agent source, or for the plan-execution record note that ReAct argues against separating the two.',
  },
  'urn:maha:record:neurotechnology-bci-optogenetic-channelrhodopsin': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-channelrhodopsin-photocurrent-kinetics': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-opsin-spectral-sensitivity': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-light-delivery-tissue-heating': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-stimulation-artifact-rejection': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-fluorinated-resist-components': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The USGS commodity chapter returned HTTP 403, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the commodity chapter through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-gallium-bauxite-byproduct-flow': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The USGS commodity chapter returned HTTP 403, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the commodity chapter through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-gallium-zinc-processing-byproduct': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The USGS commodity chapter returned HTTP 403, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the commodity chapter through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-germanium-zinc-refining-flow': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The USGS commodity chapter returned HTTP 403, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the commodity chapter through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-germanium-coal-ash-recovery': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The USGS commodity chapter returned HTTP 403, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the commodity chapter through a retrievable route, inspect it, then confirm or replace the mapping.',
  },

  /* ---- alignment batch 5, read 2026-08-26 ------------------------------
   * Remediation-focused. Priority 1 re-inspects the stellarator block on full
   * text; those five are re-inspections, not new cohort members, and each
   * nests its superseded batch-4 finding in priorJudgement.
   */
  'urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2104.04621 full text (preprint of Nuclear Fusion 61 096024), extracted to text and searched in full; sections I-IV and appendices',
    artifactVersion: 'preprint',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'Full text was extracted and searched. The paper contains zero occurrences of "REBCO", "barium copper", "high-temperature superconduct" and even "superconduct" in any form. It cannot support a record about REBCO high-field magnets. Batch 4 recorded insufficient-evidence from the abstract alone; reading the full text settles it.',
    remediation: 'Bind a source that actually reports REBCO conductors. A proposed override is recorded and is NOT applied. This record backs the only resolving Q-BR bridge endpoint, so the override needs an explicit decision.',
    priorJudgement: {
      batchId: 'batch-4',
      verdict: 'insufficient-evidence',
      inspectedContentLocation: 'IOP abstract for Nuclear Fusion 61(9), Boozer "Stellarators as a fast path to fusion"',
      reason:
        'REBCO does not appear at abstract level. Only the abstract was read, so this is not evidence that the cited sections omit high-field magnets.',
    },
    proposedSourceOverride: {
      citation:
        'Whyte, D. G. et al. Smaller & Sooner: Exploiting High Magnetic Fields from New Superconductors for a More Attractive Fusion Energy Development Path. Journal of Fusion Energy 35(1), 41-53 (2016).',
      identifier: 'doi:10.1007/s10894-015-0050-1',
      rationale:
        'Reports high-field REBCO magnets for fusion directly. Metadata is already independently verified in the bridge source ledger, but the content has NOT been inspected for this record, so it is proposed rather than applied.',
      decision: 'pending-human-decision',
    },
  },
  'urn:maha:record:fusion-plasma-systems-cable-in-conduit-conductors': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2104.04621 full text (preprint of Nuclear Fusion 61 096024), extracted to text and searched in full; sections I-IV and appendices',
    artifactVersion: 'preprint',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'Full text was extracted and searched. "cable-in-conduit" and "cable in conduit" appear zero times, and the paper contains no superconductor discussion at all.',
    remediation: 'Bind a source that reports cable-in-conduit conductor design.',
    priorJudgement: {
      batchId: 'batch-4',
      verdict: 'insufficient-evidence',
      inspectedContentLocation: 'IOP abstract',
      reason:
        'Cable-in-conduit conductors do not appear at abstract level.',
    },
  },
  'urn:maha:record:fusion-plasma-systems-superconducting-quench-protection': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2104.04621 full text (preprint of Nuclear Fusion 61 096024), extracted to text and searched in full; sections I-IV and appendices',
    artifactVersion: 'preprint',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'Full text was extracted and searched. "quench" appears zero times and "superconduct" appears zero times, so the paper cannot support a quench-protection record.',
    remediation: 'Bind a source that reports quench detection and protection.',
    priorJudgement: {
      batchId: 'batch-4',
      verdict: 'insufficient-evidence',
      inspectedContentLocation: 'IOP abstract',
      reason:
        'Quench protection does not appear at abstract level.',
    },
  },
  'urn:maha:record:fusion-plasma-systems-stellarator-magnetic-coils': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2104.04621 full text (preprint of Nuclear Fusion 61 096024), extracted to text and searched in full; sections I-IV and appendices',
    artifactVersion: 'preprint',
    reason:
      'Full text was extracted and searched. Coils are discussed substantively across the paper: fields produced by external coils, coil systems allowing open access to the plasma chamber, and error-field control coils and their current matrices.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
    priorJudgement: {
      batchId: 'batch-4',
      verdict: 'partially-supported',
      inspectedContentLocation: 'IOP abstract',
      reason:
        'Coils fall within the paper scope as part of stellarator configuration, but the abstract does not treat coil design in detail.',
    },
  },
  'urn:maha:record:fusion-plasma-systems-stellarator-field-optimization': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'arXiv:2104.04621 full text (preprint of Nuclear Fusion 61 096024), extracted to text and searched in full; sections I-IV and appendices',
    artifactVersion: 'preprint',
    reason:
      'Full text was extracted and searched. Section IV addresses computational design, and optimisation is discussed throughout including expected benefits of the optimisation and the reliability of computational stellarator design.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
    priorJudgement: {
      batchId: 'batch-4',
      verdict: 'partially-supported',
      inspectedContentLocation: 'IOP abstract',
      reason:
        'The abstract makes the demonstrated reliability of computational stellarator design one of its three points, but does not develop an optimisation method.',
    },
  },
  'urn:maha:record:fusion-plasma-systems-disruption-mitigation': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER Disruption mitigation page, system overview and shattered pellet injection sections',
    artifactVersion: 'living-specification',
    reason:
      'The page states that disruptions are instabilities that may develop in the tokamak plasma and lead to degradation or loss of magnetic confinement, and describes the mitigation system.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-shattered-pellet-injection': {
    verdict: 'supported',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER Disruption mitigation page, system overview and shattered pellet injection sections',
    artifactVersion: 'living-specification',
    reason:
      'The page describes cryogenic pellets accelerated to supersonic speeds and shattered against an inclined surface, which is the record subject.',
    remediation: 'None. Record the mapping as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-plasma-heating-and-current-drive': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER Disruption mitigation page, system overview and shattered pellet injection sections',
    artifactVersion: 'living-specification',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The page was read. It covers disruption mitigation and shattered pellet injection and does not treat plasma heating and current drive.',
    remediation: 'Bind the ITER supporting-systems page or another source that treats the named system.',
  },
  'urn:maha:record:fusion-plasma-systems-neutral-beam-injection': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER Disruption mitigation page, system overview and shattered pellet injection sections',
    artifactVersion: 'living-specification',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The page was read. It covers disruption mitigation and shattered pellet injection and does not treat neutral beam injection.',
    remediation: 'Bind the ITER supporting-systems page or another source that treats the named system.',
  },
  'urn:maha:record:fusion-plasma-systems-electron-cyclotron-heating': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'ITER Disruption mitigation page, system overview and shattered pellet injection sections',
    artifactVersion: 'living-specification',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The page was read. It covers disruption mitigation and shattered pellet injection and does not treat electron cyclotron heating.',
    remediation: 'Bind the ITER supporting-systems page or another source that treats the named system.',
  },
  'urn:maha:record:agentic-systems-mcp-least-authority-tokens': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'NIST AI 600-1 full PDF extracted to text (21,021 words) and searched in full',
    artifactVersion: 'government-report',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The full document was extracted to text and searched: "least authority" and "least privilege" each appear zero times. It is a generative-AI risk-management profile and does not specify least-authority tokens.',
    remediation: 'Bind a source that specifies the named control, such as the MCP specification.',
  },
  'urn:maha:record:agentic-systems-mcp-sandboxed-tool-execution': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'NIST AI 600-1 full PDF extracted to text (21,021 words) and searched in full',
    artifactVersion: 'government-report',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The full document was extracted to text and searched: "sandbox" appears zero times. It is a generative-AI risk-management profile and does not specify sandboxed tool execution.',
    remediation: 'Bind a source that specifies the named control, such as the MCP specification.',
  },
  'urn:maha:record:agentic-systems-mcp-idempotent-tool-calls': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'NIST AI 600-1 full PDF extracted to text (21,021 words) and searched in full',
    artifactVersion: 'government-report',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The full document was extracted to text and searched: "idempot" appears zero times. It is a generative-AI risk-management profile and does not specify idempotent tool calls.',
    remediation: 'Bind a source that specifies the named control, such as the MCP specification.',
  },
  'urn:maha:record:agentic-systems-mcp-tool-timeout-budgets': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'NIST AI 600-1 full PDF extracted to text (21,021 words) and searched in full',
    artifactVersion: 'government-report',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The full document was extracted to text and searched: "timeout" appears zero times. It is a generative-AI risk-management profile and does not specify tool timeout budgets.',
    remediation: 'Bind a source that specifies the named control, such as the MCP specification.',
  },
  'urn:maha:record:agentic-systems-mcp-tool-call-traces': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: 'NIST AI 600-1 full PDF extracted to text (21,021 words) and searched in full',
    artifactVersion: 'government-report',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The full text was searched. "trace" appears seven times and "provenance" sixty-seven, but in the sense of content provenance and traceability of AI-generated material, not logging of agent tool invocations. The document does not treat tool-call traces.',
    remediation: 'Bind a source that specifies tool-invocation logging.',
  },
  'urn:maha:record:mechanistic-interpretability-circuit-completeness': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: '"A Mathematical Framework for Transformer Circuits", structured summary of scope',
    artifactVersion: 'living-specification',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The article was inspected. It reverse-engineers the computations of small toy transformers and does not address whether identified circuits account for all model behaviour.',
    remediation: 'Bind a source that treats the named property directly.',
  },
  'urn:maha:record:mechanistic-interpretability-circuit-faithfulness': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: '"A Mathematical Framework for Transformer Circuits", structured summary of scope',
    artifactVersion: 'living-specification',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The article was inspected. It reverse-engineers the computations of small toy transformers and does not address systematic validation that circuit interventions produce predicted changes.',
    remediation: 'Bind a source that treats the named property directly.',
  },
  'urn:maha:record:mechanistic-interpretability-mechanistic-anomaly-detection': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: '"A Mathematical Framework for Transformer Circuits", structured summary of scope',
    artifactVersion: 'living-specification',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The article was inspected. It reverse-engineers the computations of small toy transformers and does not address anomaly detection.',
    remediation: 'Bind a source that treats the named property directly.',
  },
  'urn:maha:record:mechanistic-interpretability-benchmark-task-transfer': {
    verdict: 'mismatched',
    sourceContentInspected: true,
    inspectedContentLocation: '"A Mathematical Framework for Transformer Circuits", structured summary of scope',
    artifactVersion: 'living-specification',
    mismatchBasis: 'inspected-content-different-subject',
    reason:
      'The article was inspected. It reverse-engineers the computations of small toy transformers and does not address transfer across benchmark tasks.',
    remediation: 'Bind a source that treats the named property directly.',
  },
  'urn:maha:record:mechanistic-interpretability-interpretability-claim-boundaries': {
    verdict: 'partially-supported',
    sourceContentInspected: true,
    inspectedContentLocation: '"A Mathematical Framework for Transformer Circuits", structured summary of scope',
    artifactVersion: 'living-specification',
    reason:
      'The authors note that they remain a very long way from fully reverse engineering larger models, which bounds the claim, but the article does not formally delineate interpretability boundaries.',
    remediation: 'Bind a source that states interpretability claim boundaries explicitly, or narrow the record to the stated limitation.',
  },
  'urn:maha:record:advanced-materials-contact-resistance-in-2d-devices': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:advanced-materials-dielectric-screening': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:advanced-materials-wafer-scale-2d-growth': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:advanced-materials-cvd-graphene-grain-boundaries': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:advanced-materials-materials-metrology-transfer': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:longevity-metabolism-mitophagy-flux': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:longevity-metabolism-pink1-parkin-pathway': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:longevity-metabolism-mitochondrial-membrane-potential': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:longevity-metabolism-proton-leak-respiration': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:longevity-metabolism-mitochondrial-uncoupling': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org and the publisher article page. Nature redirects to an authentication wall, which was not followed, so the content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-chronic-signal-stability': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org, which redirects to the Elsevier platform behind a subscription gate. The content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-foreign-body-response': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org, which redirects to the Elsevier platform behind a subscription gate. The content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-wireless-neural-telemetry': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org, which redirects to the Elsevier platform behind a subscription gate. The content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-neural-data-compression': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org, which redirects to the Elsevier platform behind a subscription gate. The content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-clinical-translation-boundaries': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 via doi.org, which redirects to the Elsevier platform behind a subscription gate. The content could not be read.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:biomolecular-engineering-translational-control-circuits': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 through PMC. The retrieved article was a different paper (Green et al., toehold switches) rather than the bound source, so the bound source was never inspected and nothing was judged from the wrong artifact.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:biomolecular-engineering-metabolic-pathway-prototyping': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 through PMC. The retrieved article was a different paper (Green et al., toehold switches) rather than the bound source, so the bound source was never inspected and nothing was judged from the wrong artifact.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:biomolecular-engineering-enzyme-cascade-engineering': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 through PMC. The retrieved article was a different paper (Green et al., toehold switches) rather than the bound source, so the bound source was never inspected and nothing was judged from the wrong artifact.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:biomolecular-engineering-compartmentalized-cell-free-systems': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 through PMC. The retrieved article was a different paper (Green et al., toehold switches) rather than the bound source, so the bound source was never inspected and nothing was judged from the wrong artifact.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:biomolecular-engineering-droplet-microfluidic-screening': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 through PMC. The retrieved article was a different paper (Green et al., toehold switches) rather than the bound source, so the bound source was never inspected and nothing was judged from the wrong artifact.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-magnet-recycling': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 against the full Mineral Commodity Summaries PDF and the commodity chapter, both returning HTTP 403, after earlier batches failed on the same host. Every critical-supply-chains source is a USGS document on this host.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-graphite-anode-processing': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 against the full Mineral Commodity Summaries PDF and the commodity chapter, both returning HTTP 403, after earlier batches failed on the same host. Every critical-supply-chains source is a USGS document on this host.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-cobalt-refining-concentration': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 against the full Mineral Commodity Summaries PDF and the commodity chapter, both returning HTTP 403, after earlier batches failed on the same host. Every critical-supply-chains source is a USGS document on this host.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-tungsten-concentrate-processing': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 against the full Mineral Commodity Summaries PDF and the commodity chapter, both returning HTTP 403, after earlier batches failed on the same host. Every critical-supply-chains source is a USGS document on this host.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:critical-supply-chains-indium-zinc-byproduct-flow': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    artifactVersion: 'not-inspected',
    reason:
      'Retrieval was attempted for batch 5 against the full Mineral Commodity Summaries PDF and the commodity chapter, both returning HTTP 403, after earlier batches failed on the same host. Every critical-supply-chains source is a USGS document on this host.',
    remediation: 'Obtain the artifact through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
}

/**
 * Source contracts with no DOI whose publisher page was fetched during this
 * audit and whose declared title matched the served document. A publisher page
 * is an authoritative resolution for a living specification or machine
 * documentation; it is recorded as a distinct method, not as a Crossref record.
 * This is internal editorial verification, not external review.
 */
const PUBLISHER_VERIFIED: Readonly<Record<string, string>> = {
  'source-fusion-plasma-systems-iter-support':
    'Fetched the ITER Supporting Systems index and its linked official pages for tritium breeding, fuelling, diagnostics, cryogenics, and vacuum systems.',
  'source-mechanistic-interpretability-causal-scrubbing':
    'Fetched the author publication page and the linked Causal Scrubbing article, which serves the declared method, correspondence, intervention, example, and limitation material.',
  'source-fusion-plasma-systems-iter-magnets':
    'Fetched https://www.iter.org/machine/magnets, which serves the declared ITER magnets documentation covering the toroidal field, poloidal field, central solenoid and correction coil systems.',
  'source-agentic-systems-mcp-mcp-tools':
    'Fetched the Model Context Protocol tools specification, which serves the declared sections on capabilities, tool listing, calls, data types, error handling and security considerations.',
  'source-fusion-plasma-systems-iter-divertor':
    'Fetched https://www.iter.org/fusion-energy/making-it-work, which serves the declared ITER page covering heat and particle exhaust and the divertor.',
  'source-agentic-systems-mcp-mcp-core':
    'Fetched the Model Context Protocol specification index, which serves the declared architecture, features and security sections.',
  'source-mechanistic-interpretability-superposition':
    'Fetched https://transformer-circuits.pub/2022/toy_model/index.html, which serves the declared Toy Models of Superposition article.',
  'source-critical-supply-chains-supply-analysis':
    'Fetched the USGS Mineral Supply Chain Analysis page, which serves the declared criticality and supply-analysis material.',
  'source-mechanistic-interpretability-sae':
    'Fetched arXiv:2309.08600, which serves the declared "Sparse Autoencoders Find Highly Interpretable Features in Language Models" record.',
  'source-agentic-systems-mcp-react':
    'Fetched arXiv:2210.03629, which serves the declared "ReAct: Synergizing Reasoning and Acting in Language Models" record.',
  'source-fusion-plasma-systems-iter-disruption':
    'Fetched the ITER disruption-mitigation page, which serves the declared system overview and shattered-pellet-injection sections.',
  'source-mechanistic-interpretability-circuits':
    'Fetched https://transformer-circuits.pub/2021/framework/index.html, which serves the declared "A Mathematical Framework for Transformer Circuits" article.',
}

/** Records whose source URL was requested and could not be retrieved. */
const INACCESSIBLE_CONTRACTS: ReadonlySet<string> = new Set(['source-critical-supply-chains-pp1802'])


/* ------------------------------------------------------ batch registry ---- */

/**
 * Batch membership, first-class and machine-checkable.
 *
 * Batch 3 recorded its judgements as `...Object.fromEntries([...].map(...))`
 * spreads. Two things follow from that shape, both verified rather than
 * assumed. A duplicate key inside a spread is not a compiler error, so a record
 * could be silently re-judged by a later batch and would keep the wrong
 * `inspectedContentLocation`; only pinned count snapshots would notice, and a
 * count-preserving duplicate would not be noticed at all. And the verdict
 * strings inside those arrays are not type-checked: injecting a nonsense
 * verdict passes `tsc` and reaches `verdictTotals` as an undeclared key with a
 * NaN count. The existing vocabulary test does catch that, but nothing catches
 * it at the type or module-load layer.
 *
 * Membership is therefore declared explicitly here and enforced below, and
 * batch 4 is written as plain object keys so both problems are compiler errors
 * for anything added from now on.
 */

export const ALIGNMENT_BATCHES = ['batch-1', 'batch-2', 'batch-3', 'batch-4', 'batch-5'] as const
export type AlignmentBatchId = (typeof ALIGNMENT_BATCHES)[number]

const BATCH_1_RECORDS: readonly string[] = [
    'urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics',
    'urn:maha:record:agentic-systems-mcp-mcp-capability-negotiation',
    'urn:maha:record:agentic-systems-mcp-mcp-client-server-roles',
    'urn:maha:record:agentic-systems-mcp-mcp-tool-discovery',
    'urn:maha:record:agentic-systems-mcp-mcp-tool-input-schemas',
    'urn:maha:record:agentic-systems-mcp-mcp-tool-result-contracts',
    'urn:maha:record:fusion-plasma-systems-central-solenoid-inductive-drive',
    'urn:maha:record:fusion-plasma-systems-magnetic-confinement',
    'urn:maha:record:fusion-plasma-systems-poloidal-field-coils',
    'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium',
    'urn:maha:record:fusion-plasma-systems-toroidal-field-coils',
    'urn:maha:record:neurotechnology-bci-spike-sorting-boundaries',
]

const BATCH_2_RECORDS: readonly string[] = [
    'urn:maha:record:advanced-materials-correlated-insulating-states',
    'urn:maha:record:advanced-materials-direct-gap-mos2',
    'urn:maha:record:advanced-materials-graphene-hbn-heterostructures',
    'urn:maha:record:advanced-materials-graphene-monolayers',
    'urn:maha:record:advanced-materials-magic-angle-superconductivity',
    'urn:maha:record:advanced-materials-moire-superlattices',
    'urn:maha:record:advanced-materials-tmd-monolayers',
    'urn:maha:record:advanced-materials-twist-angle-control',
    'urn:maha:record:advanced-materials-valley-polarized-excitons',
    'urn:maha:record:agentic-systems-mcp-mcp-prompt-templates',
    'urn:maha:record:agentic-systems-mcp-mcp-resource-discovery',
    'urn:maha:record:agentic-systems-mcp-mcp-session-lifecycle',
    'urn:maha:record:agentic-systems-mcp-tool-allowlisting',
    'urn:maha:record:agentic-systems-mcp-tool-deny-by-default',
    'urn:maha:record:biomolecular-engineering-de-novo-binder-design',
    'urn:maha:record:biomolecular-engineering-motif-scaffolding',
    'urn:maha:record:biomolecular-engineering-protein-backbone-diffusion',
    'urn:maha:record:biomolecular-engineering-structure-prediction-filtering',
    'urn:maha:record:biomolecular-engineering-unconditional-protein-generation',
    'urn:maha:record:critical-supply-chains-critical-mineral-import-reliance',
    'urn:maha:record:critical-supply-chains-export-control-exposure',
    'urn:maha:record:critical-supply-chains-material-substitution-boundaries',
    'urn:maha:record:critical-supply-chains-single-country-processing-concentration',
    'urn:maha:record:critical-supply-chains-supply-chain-data-uncertainty',
    'urn:maha:record:fusion-plasma-systems-divertor-heat-exhaust',
    'urn:maha:record:fusion-plasma-systems-edge-localized-modes',
    'urn:maha:record:fusion-plasma-systems-plasma-facing-components',
    'urn:maha:record:fusion-plasma-systems-plasma-position-and-shape-control',
    'urn:maha:record:fusion-plasma-systems-resonant-magnetic-perturbations',
    'urn:maha:record:mechanistic-interpretability-neural-feature-superposition',
    'urn:maha:record:mechanistic-interpretability-polysemantic-neurons',
    'urn:maha:record:mechanistic-interpretability-representation-probing-boundary',
    'urn:maha:record:mechanistic-interpretability-superposition-geometry',
    'urn:maha:record:mechanistic-interpretability-toy-models-of-superposition',
]

const BATCH_3_RECORDS: readonly string[] = [
    'urn:maha:record:advanced-materials-interlayer-excitons',
    'urn:maha:record:advanced-materials-quantum-anomalous-hall-state',
    'urn:maha:record:advanced-materials-spin-momentum-locking',
    'urn:maha:record:advanced-materials-tmd-heterobilayers',
    'urn:maha:record:advanced-materials-topological-insulator-surface-states',
    'urn:maha:record:agentic-systems-mcp-context-window-position-effects',
    'urn:maha:record:agentic-systems-mcp-context-window-token-degradation',
    'urn:maha:record:agentic-systems-mcp-human-approval-boundaries',
    'urn:maha:record:agentic-systems-mcp-retrieval-context-selection',
    'urn:maha:record:agentic-systems-mcp-tool-result-context-injection',
    'urn:maha:record:biomolecular-engineering-cell-free-reaction-yield',
    'urn:maha:record:biomolecular-engineering-cell-free-transcription-translation',
    'urn:maha:record:biomolecular-engineering-crude-extract-cell-free-systems',
    'urn:maha:record:biomolecular-engineering-energy-regeneration-in-cell-free-systems',
    'urn:maha:record:biomolecular-engineering-purified-component-expression-systems',
    'urn:maha:record:critical-supply-chains-dysprosium-ore-to-oxide',
    'urn:maha:record:critical-supply-chains-heavy-rare-earth-diffusion',
    'urn:maha:record:critical-supply-chains-nd-fe-b-magnet-alloying',
    'urn:maha:record:critical-supply-chains-neodymium-praseodymium-separation',
    'urn:maha:record:critical-supply-chains-rare-earth-solvent-extraction',
    'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules',
    'urn:maha:record:fusion-plasma-systems-cryogenic-magnet-cooling',
    'urn:maha:record:fusion-plasma-systems-plasma-diagnostics',
    'urn:maha:record:fusion-plasma-systems-tritium-fuel-cycle',
    'urn:maha:record:fusion-plasma-systems-vacuum-vessel-boundary',
    'urn:maha:record:longevity-metabolism-autophagic-flux',
    'urn:maha:record:longevity-metabolism-autophagosome-abundance',
    'urn:maha:record:longevity-metabolism-lc3-turnover-assays',
    'urn:maha:record:longevity-metabolism-lysosomal-degradation-blockade',
    'urn:maha:record:longevity-metabolism-nad-consumption-by-parps',
    'urn:maha:record:longevity-metabolism-nad-salvage-pathway',
    'urn:maha:record:longevity-metabolism-nampt-rate-limiting-step',
    'urn:maha:record:longevity-metabolism-nmn-and-nr-precursors',
    'urn:maha:record:longevity-metabolism-nmnat-compartmentalization',
    'urn:maha:record:longevity-metabolism-p62-sqstm1-turnover',
    'urn:maha:record:mechanistic-interpretability-activation-patching',
    'urn:maha:record:mechanistic-interpretability-causal-scrubbing',
    'urn:maha:record:mechanistic-interpretability-interchange-interventions',
    'urn:maha:record:mechanistic-interpretability-model-component-ablation',
    'urn:maha:record:mechanistic-interpretability-path-patching',
    'urn:maha:record:neurotechnology-bci-adaptive-stimulation-policies',
    'urn:maha:record:neurotechnology-bci-electrocorticography-spatial-resolution',
    'urn:maha:record:neurotechnology-bci-electrode-tissue-interface',
    'urn:maha:record:neurotechnology-bci-extracellular-spike-recording',
    'urn:maha:record:neurotechnology-bci-flexible-conformal-electrode-arrays',
    'urn:maha:record:neurotechnology-bci-impedance-and-noise',
    'urn:maha:record:neurotechnology-bci-micro-ecog-arrays',
    'urn:maha:record:neurotechnology-bci-neuropixels-channel-selection',
    'urn:maha:record:neurotechnology-bci-neuropixels-cmos-probe',
    'urn:maha:record:neurotechnology-bci-neuropixels-recording-sites',
]

const BATCH_4_RECORDS: readonly string[] = [
    'urn:maha:record:advanced-materials-dry-transfer-contamination',
    'urn:maha:record:advanced-materials-encapsulation-boundaries',
    'urn:maha:record:advanced-materials-interface-bubbles-and-strain',
    'urn:maha:record:advanced-materials-two-dimensional-magnetism',
    'urn:maha:record:advanced-materials-van-der-waals-assembly',
    'urn:maha:record:agentic-systems-mcp-agent-plan-execution-separation',
    'urn:maha:record:agentic-systems-mcp-distributed-agent-consensus',
    'urn:maha:record:agentic-systems-mcp-multi-agent-coordination-protocols',
    'urn:maha:record:agentic-systems-mcp-multi-agent-deadlock',
    'urn:maha:record:agentic-systems-mcp-multi-agent-role-assignment',
    'urn:maha:record:biomolecular-engineering-design-to-assay-provenance',
    'urn:maha:record:biomolecular-engineering-experimental-fold-validation',
    'urn:maha:record:biomolecular-engineering-off-target-binding-characterization',
    'urn:maha:record:biomolecular-engineering-protein-design-success-rate',
    'urn:maha:record:biomolecular-engineering-sequence-design-with-proteinmpnn',
    'urn:maha:record:critical-supply-chains-fluorinated-resist-components',
    'urn:maha:record:critical-supply-chains-gallium-bauxite-byproduct-flow',
    'urn:maha:record:critical-supply-chains-gallium-zinc-processing-byproduct',
    'urn:maha:record:critical-supply-chains-germanium-coal-ash-recovery',
    'urn:maha:record:critical-supply-chains-germanium-zinc-refining-flow',
    'urn:maha:record:fusion-plasma-systems-cable-in-conduit-conductors',
    'urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets',
    'urn:maha:record:fusion-plasma-systems-stellarator-field-optimization',
    'urn:maha:record:fusion-plasma-systems-stellarator-magnetic-coils',
    'urn:maha:record:fusion-plasma-systems-superconducting-quench-protection',
    'urn:maha:record:longevity-metabolism-apoptosis-in-senescent-cells',
    'urn:maha:record:longevity-metabolism-cellular-senescence-markers',
    'urn:maha:record:longevity-metabolism-senescence-associated-secretory-phenotype',
    'urn:maha:record:longevity-metabolism-senescent-cell-clearance',
    'urn:maha:record:longevity-metabolism-senolytic-selectivity',
    'urn:maha:record:mechanistic-interpretability-feature-absorption',
    'urn:maha:record:mechanistic-interpretability-feature-splitting',
    'urn:maha:record:mechanistic-interpretability-sae-encoder-decoder',
    'urn:maha:record:mechanistic-interpretability-sae-sparsity-fidelity-tradeoff',
    'urn:maha:record:mechanistic-interpretability-sparse-autoencoder-dictionaries',
    'urn:maha:record:neurotechnology-bci-channelrhodopsin-photocurrent-kinetics',
    'urn:maha:record:neurotechnology-bci-light-delivery-tissue-heating',
    'urn:maha:record:neurotechnology-bci-opsin-spectral-sensitivity',
    'urn:maha:record:neurotechnology-bci-optogenetic-channelrhodopsin',
    'urn:maha:record:neurotechnology-bci-stimulation-artifact-rejection',
]

const BATCH_5_RECORDS: readonly string[] = [
    'urn:maha:record:advanced-materials-contact-resistance-in-2d-devices',
    'urn:maha:record:advanced-materials-cvd-graphene-grain-boundaries',
    'urn:maha:record:advanced-materials-dielectric-screening',
    'urn:maha:record:advanced-materials-materials-metrology-transfer',
    'urn:maha:record:advanced-materials-wafer-scale-2d-growth',
    'urn:maha:record:agentic-systems-mcp-idempotent-tool-calls',
    'urn:maha:record:agentic-systems-mcp-least-authority-tokens',
    'urn:maha:record:agentic-systems-mcp-sandboxed-tool-execution',
    'urn:maha:record:agentic-systems-mcp-tool-call-traces',
    'urn:maha:record:agentic-systems-mcp-tool-timeout-budgets',
    'urn:maha:record:biomolecular-engineering-compartmentalized-cell-free-systems',
    'urn:maha:record:biomolecular-engineering-droplet-microfluidic-screening',
    'urn:maha:record:biomolecular-engineering-enzyme-cascade-engineering',
    'urn:maha:record:biomolecular-engineering-metabolic-pathway-prototyping',
    'urn:maha:record:biomolecular-engineering-translational-control-circuits',
    'urn:maha:record:critical-supply-chains-cobalt-refining-concentration',
    'urn:maha:record:critical-supply-chains-graphite-anode-processing',
    'urn:maha:record:critical-supply-chains-indium-zinc-byproduct-flow',
    'urn:maha:record:critical-supply-chains-magnet-recycling',
    'urn:maha:record:critical-supply-chains-tungsten-concentrate-processing',
    'urn:maha:record:fusion-plasma-systems-disruption-mitigation',
    'urn:maha:record:fusion-plasma-systems-electron-cyclotron-heating',
    'urn:maha:record:fusion-plasma-systems-neutral-beam-injection',
    'urn:maha:record:fusion-plasma-systems-plasma-heating-and-current-drive',
    'urn:maha:record:fusion-plasma-systems-shattered-pellet-injection',
    'urn:maha:record:longevity-metabolism-mitochondrial-membrane-potential',
    'urn:maha:record:longevity-metabolism-mitochondrial-uncoupling',
    'urn:maha:record:longevity-metabolism-mitophagy-flux',
    'urn:maha:record:longevity-metabolism-pink1-parkin-pathway',
    'urn:maha:record:longevity-metabolism-proton-leak-respiration',
    'urn:maha:record:mechanistic-interpretability-benchmark-task-transfer',
    'urn:maha:record:mechanistic-interpretability-circuit-completeness',
    'urn:maha:record:mechanistic-interpretability-circuit-faithfulness',
    'urn:maha:record:mechanistic-interpretability-interpretability-claim-boundaries',
    'urn:maha:record:mechanistic-interpretability-mechanistic-anomaly-detection',
    'urn:maha:record:neurotechnology-bci-chronic-signal-stability',
    'urn:maha:record:neurotechnology-bci-clinical-translation-boundaries',
    'urn:maha:record:neurotechnology-bci-foreign-body-response',
    'urn:maha:record:neurotechnology-bci-neural-data-compression',
    'urn:maha:record:neurotechnology-bci-wireless-neural-telemetry',
]

/**
 * Records an earlier batch already attempted and that batch 5 re-examined with
 * better evidence. These are NOT cohort members: they were previously judged,
 * so counting them as new inspections would overstate the batch. Their earlier
 * finding is preserved in `priorJudgement` rather than discarded.
 */
export const BATCH_5_REINSPECTIONS: readonly string[] = [
    'urn:maha:record:fusion-plasma-systems-cable-in-conduit-conductors',
    'urn:maha:record:fusion-plasma-systems-rebco-high-field-magnets',
    'urn:maha:record:fusion-plasma-systems-stellarator-field-optimization',
    'urn:maha:record:fusion-plasma-systems-stellarator-magnetic-coils',
    'urn:maha:record:fusion-plasma-systems-superconducting-quench-protection',
]

export const ALIGNMENT_BATCH_MEMBERSHIP: Readonly<Record<AlignmentBatchId, readonly string[]>> = {
  'batch-1': BATCH_1_RECORDS,
  'batch-2': BATCH_2_RECORDS,
  'batch-3': BATCH_3_RECORDS,
  'batch-4': BATCH_4_RECORDS,
  'batch-5': BATCH_5_RECORDS,
}

/** Which batch judged a record, or null when it carries only default state. */
export function batchOf(recordId: string): AlignmentBatchId | null {
  for (const batchId of ALIGNMENT_BATCHES) {
    if (ALIGNMENT_BATCH_MEMBERSHIP[batchId].includes(recordId)) return batchId
  }
  return null
}

/** True when batch 5 re-examined a record an earlier batch had already judged. */
export function isBatch5Reinspection(recordId: string): boolean {
  return BATCH_5_REINSPECTIONS.includes(recordId)
}

/* -- guards: membership is disjoint, complete, and batch 4 is well formed -- */

{
  const batch4 = ALIGNMENT_BATCH_MEMBERSHIP['batch-4']
  if (batch4.length !== 40) throw new Error(`Batch 4 must contain exactly 40 records; found ${batch4.length}.`)

  const batch5 = ALIGNMENT_BATCH_MEMBERSHIP['batch-5']
  if (batch5.length !== 40) throw new Error(`Batch 5 must contain exactly 40 records; found ${batch5.length}.`)
  if (new Set(batch5).size !== batch5.length) throw new Error('Batch 5 membership is not unique.')

  const seen = new Map<string, AlignmentBatchId>()
  for (const batchId of ALIGNMENT_BATCHES) {
    for (const recordId of ALIGNMENT_BATCH_MEMBERSHIP[batchId]) {
      const prior = seen.get(recordId)
      if (prior) {
        throw new Error(`${recordId} is claimed by both ${prior} and ${batchId}; batches must be disjoint.`)
      }
      seen.set(recordId, batchId)
      if (!(recordId in JUDGEMENTS)) throw new Error(`${recordId} is in ${batchId} but has no judgement.`)
    }
  }
  for (const recordId of Object.keys(JUDGEMENTS)) {
    if (!seen.has(recordId)) throw new Error(`${recordId} is judged but belongs to no batch.`)
  }

  const earlier = new Set([...BATCH_1_RECORDS, ...BATCH_2_RECORDS, ...BATCH_3_RECORDS])
  const perDomain = new Map<string, number>()
  for (const recordId of batch4) {
    if (earlier.has(recordId)) {
      throw new Error(`${recordId} was already judged before batch 4; batch 4 must be previously uninspected.`)
    }
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
    if (!record) throw new Error(`${recordId} is in batch 4 but is not a frontier record.`)
    perDomain.set(record.domainSlug, (perDomain.get(record.domainSlug) ?? 0) + 1)
  }
  if (perDomain.size !== 8) throw new Error(`Batch 4 must cover eight domains; found ${perDomain.size}.`)
  for (const [domainSlug, count] of perDomain) {
    if (count !== 5) throw new Error(`Batch 4 must contain five records per domain; ${domainSlug} has ${count}.`)
  }

  // Batch 5 is remediation-focused, so its cohort is bounded rather than even:
  // between three and eight per domain, all eight domains represented.
  const priorBatches = new Set([...BATCH_1_RECORDS, ...BATCH_2_RECORDS, ...BATCH_3_RECORDS, ...BATCH_4_RECORDS])
  const batch5Domains = new Map<string, number>()
  for (const recordId of batch5) {
    if (priorBatches.has(recordId)) {
      throw new Error(`${recordId} was claimed by an earlier batch and cannot be a new batch 5 inspection.`)
    }
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
    if (!record) throw new Error(`${recordId} is in batch 5 but is not a frontier record.`)
    batch5Domains.set(record.domainSlug, (batch5Domains.get(record.domainSlug) ?? 0) + 1)
  }
  if (batch5Domains.size !== 8) throw new Error(`Batch 5 must cover eight domains; found ${batch5Domains.size}.`)
  for (const [domainSlug, count] of batch5Domains) {
    if (count < 3 || count > 8) {
      throw new Error(`Batch 5 requires three to eight records per domain; ${domainSlug} has ${count}.`)
    }
  }

  // A re-inspection must belong to an earlier batch and must carry the
  // superseded finding, so provenance is append-only rather than overwritten.
  for (const recordId of BATCH_5_REINSPECTIONS) {
    if (!priorBatches.has(recordId)) {
      throw new Error(`${recordId} is listed as a batch 5 re-inspection but no earlier batch claimed it.`)
    }
    if (batch5.includes(recordId)) {
      throw new Error(`${recordId} cannot be both a batch 5 cohort member and a re-inspection.`)
    }
    const judgement = JUDGEMENTS[recordId]
    if (!judgement?.priorJudgement) {
      throw new Error(`${recordId} is a re-inspection but does not preserve its prior judgement.`)
    }
  }

  // Verdict vocabulary is validated at runtime, not merely inferred by
  // TypeScript, because a spread-built judgement bypasses the type entirely.
  for (const [recordId, judgement] of Object.entries(JUDGEMENTS)) {
    if (!(ALIGNMENT_VERDICTS as readonly string[]).includes(judgement.verdict)) {
      throw new Error(`${recordId} declares an undeclared verdict: ${judgement.verdict}.`)
    }
    if ((judgement.verdict === 'supported' || judgement.verdict === 'mismatched') && !judgement.sourceContentInspected) {
      throw new Error(`${recordId} declares ${judgement.verdict} without content inspection.`)
    }
    if (judgement.sourceContentInspected && !judgement.inspectedContentLocation) {
      throw new Error(`${recordId} was inspected but records no exact location.`)
    }
    if (judgement.proposedSourceOverride && judgement.proposedSourceOverride.decision !== 'pending-human-decision') {
      throw new Error(`${recordId} carries a source override that is not a pending decision.`)
    }
  }
}

/* ------------------------------------------------------------- compiler --- */

function metadataFor(
  identifier: string | null,
  contractId: string,
): { verified: boolean; method: MetadataMethod; note: string } {
  if (!identifier) {
    const publisher = PUBLISHER_VERIFIED[contractId]
    if (publisher) return { verified: true, method: 'publisher-page', note: publisher }
    return {
      verified: false,
      method: 'none',
      note: 'No DOI or other registry identifier is declared, and the publisher page was not fetched during this audit.',
    }
  }
  const entry = metadataCache[identifier]
  if (!entry || entry.status !== 'resolved') {
    return { verified: false, method: 'crossref-rest', note: 'Identifier did not resolve in the cached registry lookup.' }
  }
  return {
    verified: true,
    method: 'crossref-rest',
    note: `Crossref resolves this identifier to "${entry.registeredTitle}" in ${entry.containerTitle ?? 'an unnamed container'} (${entry.issuedYear ?? 'year unknown'}). Registry resolution confirms the document exists; it does not establish subject alignment.`,
  }
}

const PRIOR_MAPPINGS: Readonly<Record<string, PriorMapping>> = {
  'urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics': {
    sourceContractId: 'source-advanced-materials-graphene',
    sourceTitle: 'Electric Field Effect in Atomically Thin Carbon Films',
    note: 'Positional block source. Studied atomically thin carbon and never mentioned boron nitride. Replaced after inspection.',
  },
  'urn:maha:record:neurotechnology-bci-spike-sorting-boundaries': {
    sourceContractId: 'source-neurotechnology-bci-neuropixels',
    sourceTitle: 'Fully integrated silicon probes for high-density recording of neural activity',
    note: 'Positional block source. Reported instrumentation rather than the sorting step. Replaced after inspection.',
  },
}

function auditRecord(record: EpistemicRecord): RecordAlignmentAudit {
  const source = record.sources[0]
  const identifier = source.identifiers.find((entry) => entry.scheme === 'doi')?.value ?? null
  const metadata = metadataFor(identifier, source.id)
  const judgement = JUDGEMENTS[record.id]
  const inaccessible = INACCESSIBLE_CONTRACTS.has(source.id)

  const origin: AssignmentOrigin =
    judgement?.origin
    ?? (FRONTIER_EXPLICIT_SOURCE_OVERRIDES.has(record.id) ? 'explicit-override' : 'positional-legacy')

  const verdict: AlignmentVerdict = judgement?.verdict ?? (inaccessible ? 'inaccessible-source' : 'insufficient-evidence')

  const reason =
    judgement?.reason
    ?? (inaccessible
      ? 'The declared source URL was requested during this audit and returned HTTP 403, so the content could not be inspected. An inaccessible source is never treated as content-confirmed.'
      : 'The source was inherited from the positional block assignment and has not been read for this record. Registry metadata alone cannot establish that a source is about a subject.')

  const remediation =
    judgement?.remediation
    ?? (inaccessible
      ? 'Obtain the document through a retrievable route, then inspect it and record the exact location.'
      : 'Inspect the bound source against this record subject, then either confirm the mapping as curated or replace it with an explicit override.')

  return {
    recordId: record.id,
    recordTitle: record.title,
    domainSlug: record.domainSlug,
    sourceContractId: source.id,
    sourceTitle: source.title,
    sourceAuthors: source.authors,
    sourceYear: source.publishedAt ? source.publishedAt.slice(0, 4) : null,
    sourceIdentifier: identifier,
    locator: source.exactLocator || null,
    assignmentOrigin: origin,
    evidence: {
      metadataVerified: metadata.verified,
      metadataMethod: metadata.method,
      metadataNote: metadata.note,
      sourceContentInspected: judgement?.sourceContentInspected ?? false,
      inspectedContentLocation: judgement?.inspectedContentLocation ?? null,
      subjectAligned: verdict,
      mismatchBasis: verdict === 'mismatched' ? (judgement?.mismatchBasis ?? null) : null,
      chronologicalRiskIndicator: judgement?.chronologicalRiskIndicator ?? false,
      // A claim is only supported when the source was read AND is about the subject.
      claimSupported: (judgement?.sourceContentInspected ?? false) && verdict === 'supported',
      // Every frontier record cites exactly one source, so independence from
      // other cited sources is not assertable either way.
      sourceIndependentOfOtherCitedSources: record.sources.length > 1 ? false : null,
      independentlyReproduced: false,
      externallyReviewed: false,
      inspectedArtifactVersion:
        judgement?.artifactVersion ?? (judgement?.sourceContentInspected ? 'version-of-record' : 'not-inspected'),
    },
    reason,
    transcriptionConfidence: metadata.verified ? 'high' : identifier ? 'medium' : 'low',
    remediation,
    priorMapping: PRIOR_MAPPINGS[record.id] ?? null,
    priorJudgement: judgement?.priorJudgement ?? null,
    proposedSourceOverride: judgement?.proposedSourceOverride ?? null,
  }
}

export const FRONTIER_ALIGNMENT_AUDIT: readonly RecordAlignmentAudit[] = FRONTIER_DOMAIN_GRAPH_RECORDS
  .map(auditRecord)
  .sort((left, right) => left.recordId.localeCompare(right.recordId))

/* ------------------------------------------------------------ validation -- */

if (FRONTIER_ALIGNMENT_AUDIT.length !== FRONTIER_DOMAIN_GRAPH_RECORDS.length) {
  throw new Error('The alignment audit must cover every frontier record exactly once.')
}
if (new Set(FRONTIER_ALIGNMENT_AUDIT.map((entry) => entry.recordId)).size !== FRONTIER_ALIGNMENT_AUDIT.length) {
  throw new Error('Duplicate record in the alignment audit.')
}
for (const entry of FRONTIER_ALIGNMENT_AUDIT) {
  if (entry.evidence.subjectAligned === 'supported' && !entry.evidence.sourceContentInspected) {
    throw new Error(`${entry.recordId}: a supported verdict requires internal content inspection.`)
  }
  // Chronology is a risk indicator. It may never be the thing that establishes
  // a mismatch, so a mismatch must name one of the declared bases.
  if (entry.evidence.subjectAligned === 'mismatched' && !entry.evidence.mismatchBasis) {
    throw new Error(`${entry.recordId}: a mismatched verdict requires a declared mismatch basis.`)
  }
  if (entry.evidence.mismatchBasis && entry.evidence.subjectAligned !== 'mismatched') {
    throw new Error(`${entry.recordId}: a mismatch basis was recorded without a mismatch verdict.`)
  }
  if (entry.evidence.mismatchBasis === 'inspected-content-different-subject' && !entry.evidence.sourceContentInspected) {
    throw new Error(`${entry.recordId}: an inspected-content mismatch basis requires inspection.`)
  }
  if (entry.evidence.externallyReviewed !== false || entry.evidence.independentlyReproduced !== false) {
    throw new Error(`${entry.recordId}: external review and reproduction are not established by this process.`)
  }
  if (entry.evidence.sourceContentInspected && !entry.evidence.inspectedContentLocation) {
    throw new Error(`${entry.recordId}: an inspected source must record where it was read.`)
  }
  if (!entry.evidence.sourceContentInspected && entry.evidence.inspectedContentLocation) {
    throw new Error(`${entry.recordId}: an inspected location was recorded without inspection.`)
  }
  if (entry.evidence.claimSupported && entry.evidence.subjectAligned !== 'supported') {
    throw new Error(`${entry.recordId}: a claim cannot be supported by a source that is not subject-aligned.`)
  }
}
const judgedIds = Object.keys(JUDGEMENTS)
if (new Set(judgedIds).size !== judgedIds.length) throw new Error('Duplicate judgement in the alignment registry.')
const auditIds = new Set(FRONTIER_ALIGNMENT_AUDIT.map((entry) => entry.recordId))
for (const id of judgedIds) {
  if (!auditIds.has(id)) throw new Error(`Judgement ${id} does not correspond to a frontier record.`)
}

/* ------------------------------------------------------------- lookup ----- */

export function alignmentFor(recordId: string): RecordAlignmentAudit | null {
  return FRONTIER_ALIGNMENT_AUDIT.find((entry) => entry.recordId === recordId) ?? null
}

export function verdictTotals(): Record<AlignmentVerdict, number> {
  const totals = Object.fromEntries(ALIGNMENT_VERDICTS.map((verdict) => [verdict, 0])) as Record<AlignmentVerdict, number>
  for (const entry of FRONTIER_ALIGNMENT_AUDIT) totals[entry.evidence.subjectAligned] += 1
  return totals
}

export function originTotals(): Record<AssignmentOrigin, number> {
  const totals = Object.fromEntries(ASSIGNMENT_ORIGINS.map((origin) => [origin, 0])) as Record<AssignmentOrigin, number>
  for (const entry of FRONTIER_ALIGNMENT_AUDIT) totals[entry.assignmentOrigin] += 1
  return totals
}

export interface BatchStats {
  batchId: AlignmentBatchId
  attempted: number
  contentInspected: number
  inaccessible: number
  supported: number
  partiallySupported: number
  mismatched: number
  insufficientEvidence: number
  alignmentClear: number
}

/**
 * Per-batch outcome. `alignmentClear` is this batch's contribution to the
 * cleared set, not a running total: every record belongs to exactly one batch,
 * so the per-batch figures sum to the whole.
 */
export function batchStats(): readonly BatchStats[] {
  return ALIGNMENT_BATCHES.map((batchId) => {
    const rows = FRONTIER_ALIGNMENT_AUDIT.filter((entry) => batchOf(entry.recordId) === batchId)
    const count = (verdict: AlignmentVerdict) => rows.filter((entry) => entry.evidence.subjectAligned === verdict).length
    return {
      batchId,
      attempted: rows.length,
      contentInspected: rows.filter((entry) => entry.evidence.sourceContentInspected).length,
      inaccessible: count('inaccessible-source'),
      supported: count('supported'),
      partiallySupported: count('partially-supported'),
      mismatched: count('mismatched'),
      insufficientEvidence: count('insufficient-evidence'),
      alignmentClear: rows.filter((entry) => alignmentBlockers(entry.recordId).length === 0).length,
    }
  })
}

export function auditDigest(): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(FRONTIER_ALIGNMENT_AUDIT)).digest('hex')}`
}

/* ---------------------------------------------------------------- gate ---- */

/**
 * Reasons a record may not back a substantial page on alignment grounds.
 *
 * Fails closed: an unknown record, an unreviewed positional assignment, an
 * uninspected source and an inaccessible source all block.
 */
export function alignmentBlockers(recordId: string): readonly string[] {
  const audit = alignmentFor(recordId)
  if (!audit) return ['alignment-audit-missing']
  const blockers: string[] = []
  if (audit.assignmentOrigin === 'positional-legacy') blockers.push('source-assignment-positional-legacy')
  switch (audit.evidence.subjectAligned) {
    case 'mismatched':
      blockers.push('source-subject-mismatched')
      break
    case 'insufficient-evidence':
      blockers.push('source-alignment-insufficient-evidence')
      break
    case 'inaccessible-source':
      blockers.push('source-inaccessible')
      break
    case 'partially-supported':
      blockers.push('source-subject-partially-supported')
      break
    default:
      break
  }
  if (!audit.evidence.sourceContentInspected) blockers.push('source-not-inspected')
  if (!audit.evidence.metadataVerified) blockers.push('source-metadata-unverified')
  if (!audit.locator) blockers.push('source-locator-missing')
  return [...new Set(blockers)].sort()
}

export function isAlignmentClear(recordId: string): boolean {
  return alignmentBlockers(recordId).length === 0
}
