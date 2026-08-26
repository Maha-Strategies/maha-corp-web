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
}

/**
 * Per-record judgements from this sprint's bounded batch.
 *
 * Four sources were read: the ITER magnets page, the MCP tools specification,
 * the Dean et al. abstract and the Hill et al. quality-metrics sections. Those
 * cover twelve records. Three further records take a `mismatched` verdict from
 * registry metadata alone, which is the one direction that is safe without
 * inspection. Five take `inaccessible-source` after a retrieval attempt failed.
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
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-neuropixels-recording-sites': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-neuropixels-channel-selection': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
  },
  'urn:maha:record:neurotechnology-bci-extracellular-spike-recording': {
    verdict: 'inaccessible-source',
    sourceContentInspected: false,
    inspectedContentLocation: null,
    reason:
      'Retrieval was attempted for this batch. The publisher redirects to an authentication wall, which was not followed, so the content could not be read. An inaccessible source is never treated as content-confirmed.',
    remediation: 'Obtain the article through a retrievable route, inspect it, then confirm or replace the mapping.',
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
}

/**
 * Source contracts with no DOI whose publisher page was fetched during this
 * audit and whose declared title matched the served document. A publisher page
 * is an authoritative resolution for a living specification or machine
 * documentation; it is recorded as a distinct method, not as a Crossref record.
 * This is internal editorial verification, not external review.
 */
const PUBLISHER_VERIFIED: Readonly<Record<string, string>> = {
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
}

/** Records whose source URL was requested and could not be retrieved. */
const INACCESSIBLE_CONTRACTS: ReadonlySet<string> = new Set(['source-critical-supply-chains-pp1802'])

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
    },
    reason,
    transcriptionConfidence: metadata.verified ? 'high' : identifier ? 'medium' : 'low',
    remediation,
    priorMapping: PRIOR_MAPPINGS[record.id] ?? null,
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
