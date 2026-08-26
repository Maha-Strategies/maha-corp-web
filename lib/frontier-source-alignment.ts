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
 * Five things are tracked separately and never collapsed into one boolean:
 *
 *   metadataVerified      the identifier resolves in an authoritative registry
 *   sourceInspected       a human read the abstract or full text
 *   subjectAligned        the source is about this record's subject
 *   claimSupported        the source supports the record's bounded claim
 *   independentlyReproduced  always false; nothing here reproduces an experiment
 *
 * `supported` requires inspection. Metadata resolution alone can never produce
 * it, because a DOI resolving proves a document exists, not what it is about.
 *
 * The reverse direction is deliberately asymmetric. A `mismatched` verdict may
 * rest on registry metadata alone — a paper published years before a topic
 * existed cannot be about it — because that verdict can only block a page,
 * never pass one. Every such case records `sourceInspected: false`.
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

export const METADATA_METHODS = ['crossref-rest', 'publisher-page', 'catalogue-record', 'none'] as const
export type MetadataMethod = (typeof METADATA_METHODS)[number]

export const TRANSCRIPTION_CONFIDENCES = ['high', 'medium', 'low'] as const
export type TranscriptionConfidence = (typeof TRANSCRIPTION_CONFIDENCES)[number]

export interface AlignmentEvidence {
  metadataVerified: boolean
  metadataMethod: MetadataMethod
  metadataNote: string
  sourceInspected: boolean
  /** Exactly where the source was read. Null whenever it was not read. */
  inspectedLocation: string | null
  subjectAligned: AlignmentVerdict
  claimSupported: boolean
  /** Nothing in this repository reproduces an experiment. */
  independentlyReproduced: false
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
  inspectedLocation: string | null
  sourceInspected: boolean
  reason: string
  remediation: string
  origin?: AssignmentOrigin
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
    sourceInspected: true,
    inspectedLocation: 'Machine / Magnets, toroidal field section',
    reason:
      'The page states that the eighteen D-shaped toroidal field magnets produce a field whose primary function is to confine the plasma particles, which is the record subject.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-toroidal-field-coils': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Machine / Magnets, toroidal field section',
    reason: 'The page describes the toroidal field coil set and its confining function directly.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-poloidal-field-coils': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Machine / Magnets, poloidal field section',
    reason:
      'The page describes six ring-shaped poloidal field coils outside the toroidal structure that shape the plasma and contribute to stability.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-central-solenoid-inductive-drive': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Machine / Magnets, central solenoid section',
    reason:
      'The page describes the central solenoid as inducing and maintaining plasma current during long pulses, which is the inductive drive the record names.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium': {
    verdict: 'partially-supported',
    sourceInspected: true,
    inspectedLocation: 'Machine / Magnets, poloidal field and correction coil sections',
    reason:
      'The page covers shaping and stability, which bear on equilibrium, but a machine description does not establish plasma equilibrium as a physics result. The coil hardware is supported; the equilibrium concept is not.',
    remediation:
      'Bind to a plasma-physics source that treats equilibrium directly, or narrow the record to the coil systems that act on it.',
  },

  // ---- MCP tools specification, read 2026-08-26 ---------------------------
  'urn:maha:record:agentic-systems-mcp-mcp-client-server-roles': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Protocol Messages and Message Flow sections',
    reason:
      'The specification defines the client and server roles in the tools/list and tools/call exchange, including the sequence between model, client and server.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-capability-negotiation': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Capabilities section',
    reason:
      'The specification states that servers supporting tools MUST declare the tools capability, and defines listChanged notification behaviour. That is the negotiation the record names.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-tool-discovery': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Protocol Messages, Listing Tools section',
    reason: 'The specification defines the tools/list request and its paginated response, which is tool discovery.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-tool-input-schemas': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Data Types, Tool definition section',
    reason:
      'The specification defines inputSchema as a JSON Schema describing expected parameters, with an optional outputSchema, which is the record subject.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },
  'urn:maha:record:agentic-systems-mcp-mcp-tool-result-contracts': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Data Types, Tool Result and Structured Content sections',
    reason:
      'The specification defines structured and unstructured result content, the isError convention and output-schema validation, which is the result contract the record names.',
    remediation: 'None. Keep the mapping and record it as curated rather than positional.',
    origin: 'independently-curated',
  },

  // ---- corrected mappings, read 2026-08-26 -------------------------------
  'urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Abstract',
    reason:
      'The abstract reports fabrication and characterisation of graphene devices on single-crystal hexagonal boron nitride substrates, which is the record subject.',
    remediation: 'None. The mapping was corrected in this batch.',
    origin: 'explicit-override',
  },
  'urn:maha:record:neurotechnology-bci-spike-sorting-boundaries': {
    verdict: 'supported',
    sourceInspected: true,
    inspectedLocation: 'Quality metrics and Summary matrices sections',
    reason:
      'The paper defines false-positive and false-negative error estimates for sorted units and argues they should be reported, which bounds what spike sorting establishes.',
    remediation: 'None. The mapping was corrected in this batch.',
    origin: 'explicit-override',
  },

  // ---- mismatch established from registry metadata alone -------------------
  // Safe direction only: these verdicts block a page and can never pass one.
  'urn:maha:record:advanced-materials-graphene-hbn-heterostructures': {
    verdict: 'mismatched',
    sourceInspected: false,
    inspectedLocation: null,
    reason:
      'The bound source is registered as "Electric Field Effect in Atomically Thin Carbon Films", Science 2004. It concerns transport in atomically thin carbon and does not involve boron nitride, so it cannot be about graphene-hBN heterostructures.',
    remediation:
      'Bind to a source that reports graphene on hexagonal boron nitride. Dean et al. (2010) is already in this corpus and is a candidate, but was not read for this record.',
  },
  'urn:maha:record:advanced-materials-moire-superlattices': {
    verdict: 'mismatched',
    sourceInspected: false,
    inspectedLocation: null,
    reason:
      'The bound source is the 2004 atomically thin carbon paper. Moire superlattice physics in these systems is later work, so a 2004 transport paper cannot establish the record subject.',
    remediation: 'Bind to a source that reports moire superlattice formation or measurement.',
  },
  'urn:maha:record:advanced-materials-twist-angle-control': {
    verdict: 'mismatched',
    sourceInspected: false,
    inspectedLocation: null,
    reason:
      'The bound source is the 2004 atomically thin carbon paper, which involves no twisted stack and no angle control. The subject postdates it.',
    remediation: 'Bind to a source that reports twist-angle control in assembled stacks.',
  },
}

/**
 * Source contracts with no DOI whose publisher page was fetched during this
 * audit and whose declared title matched the served document. A publisher page
 * is an authoritative resolution for a living specification or machine
 * documentation; it is recorded as a distinct method, not as a Crossref record.
 */
const PUBLISHER_VERIFIED: Readonly<Record<string, string>> = {
  'source-fusion-plasma-systems-iter-magnets':
    'Fetched https://www.iter.org/machine/magnets, which serves the declared ITER magnets documentation covering the toroidal field, poloidal field, central solenoid and correction coil systems.',
  'source-agentic-systems-mcp-mcp-tools':
    'Fetched the Model Context Protocol tools specification, which serves the declared sections on capabilities, tool listing, calls, data types, error handling and security considerations.',
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
      sourceInspected: judgement?.sourceInspected ?? false,
      inspectedLocation: judgement?.inspectedLocation ?? null,
      subjectAligned: verdict,
      // A claim is only supported when the source was read AND is about the subject.
      claimSupported: (judgement?.sourceInspected ?? false) && verdict === 'supported',
      independentlyReproduced: false,
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
  if (entry.evidence.subjectAligned === 'supported' && !entry.evidence.sourceInspected) {
    throw new Error(`${entry.recordId}: a supported verdict requires an inspected source.`)
  }
  if (entry.evidence.sourceInspected && !entry.evidence.inspectedLocation) {
    throw new Error(`${entry.recordId}: an inspected source must record where it was read.`)
  }
  if (!entry.evidence.sourceInspected && entry.evidence.inspectedLocation) {
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
  if (!audit.evidence.sourceInspected) blockers.push('source-not-inspected')
  if (!audit.evidence.metadataVerified) blockers.push('source-metadata-unverified')
  if (!audit.locator) blockers.push('source-locator-missing')
  return [...new Set(blockers)].sort()
}

export function isAlignmentClear(recordId: string): boolean {
  return alignmentBlockers(recordId).length === 0
}
