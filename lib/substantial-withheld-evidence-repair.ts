import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { remainderReview } from './substantial-internal-review-remainder.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

export const WITHHELD_EVIDENCE_REPAIR_VERSION = 'maha-withheld-evidence-repair/1.0' as const

export const REPAIR_DISPOSITIONS = [
  'evidence-ready-for-internal-rereview',
  'revise-record',
  'replace-source-pending-review',
  'remain-withheld',
] as const
export type RepairDisposition = (typeof REPAIR_DISPOSITIONS)[number]

/**
 * How a statement in a cited artifact binds. Collapsing these is the specific
 * error that withheld `tool-deny-by-default`: a general security principle was
 * being read as something the protocol mandates.
 */
export const EVIDENCE_FORCE = [
  'protocol-requirement',
  'implementation-recommendation',
  'general-security-principle',
  'maha-authored-synthesis',
] as const
export type EvidenceForce = (typeof EVIDENCE_FORCE)[number]

export interface InspectedPassage {
  sourceUrl: string
  sourceTitle: string
  exactLocator: string
  /** Rights-compliant paraphrase or bounded quotation of what was read. */
  reading: string
  force: EvidenceForce
  normativeKeyword: 'MUST' | 'SHOULD' | 'MAY' | 'lowercase-must' | 'none'
  inspectionDepth: 'abstract-only' | 'specified-sections' | 'full-text-search' | 'full-document'
  versionRelationship: string
}

export interface ProposedRevision {
  /** Additive only. The canonical record is never edited by this module. */
  claimStatement: string
  claimScope: string
  claimBoundary: string
  recordKind: EpistemicRecord['recordKind']
  sourceUrl: string
  sourceExactLocator: string
  sourceEstablishes: string
  sourceBoundary: string
  rightsBasis: string
  unsupportedExtensions: readonly string[]
}

export interface RepairPacket {
  schemaVersion: typeof WITHHELD_EVIDENCE_REPAIR_VERSION
  recordId: string
  /** The submitted record and source binding, reproduced unchanged. */
  submitted: {
    revisionSha256: string
    recordKind: EpistemicRecord['recordKind']
    claimStatement: string
    sourceId: string
    sourceUrl: string
    exactLocator: string
    sourceBoundary: string
  }
  auditFindings: readonly string[]
  inspectedPassages: readonly InspectedPassage[]
  proposedRevision: ProposedRevision | null
  revisionDigests: { before: string; after: string | null; changed: boolean }
  disagreements: readonly string[]
  uncertainty: readonly string[]
  prohibitedInferences: readonly string[]
  recommendedDisposition: RepairDisposition
  assuranceStatement: string
  packetDigest: string
}

const ASSURANCE =
  'This is AI-assisted internal editorial source-repair work performed by the publisher. It is not external expert review, peer review, consensus, independent reproduction, scientific validation, or commercial certification. A repair packet is a proposal for a fresh internal review; it is not approval, validation, or publication.'

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function record(recordId: string): EpistemicRecord {
  const found = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)
  if (!found) throw new Error(`${recordId}: no canonical record.`)
  return found
}

/**
 * Builds the candidate record a proposed revision describes, WITHOUT touching
 * the canonical record. The result exists only to compute a revision digest and
 * to run the gate chain; nothing writes it back.
 */
export function candidateRecord(recordId: string, revision: ProposedRevision): EpistemicRecord {
  const base = record(recordId)
  const source = base.sources[0]
  if (!source) throw new Error(`${recordId}: the record declares no source to revise.`)
  return {
    ...base,
    recordKind: revision.recordKind,
    sources: [{ ...source, url: revision.sourceUrl, exactLocator: revision.sourceExactLocator, establishes: revision.sourceEstablishes, boundary: revision.sourceBoundary }],
    claims: base.claims.map((claim, index) =>
      index === 0 ? { ...claim, statement: revision.claimStatement, scope: revision.claimScope, boundary: revision.claimBoundary } : claim,
    ),
  }
}

const TOOL_DENY = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
const BLANKET = 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules'

const REVISIONS: Readonly<Record<string, ProposedRevision>> = {
  [TOOL_DENY]: {
    recordKind: 'concept',
    claimStatement:
      'The Model Context Protocol specification recommends, as a normative SHOULD for implementors rather than a protocol mandate, that a human remain in the loop with the ability to deny tool invocations, and states that the protocol itself does not mandate any specific user interaction model.',
    claimScope:
      'Limited to the User Interaction Model warning and the Security Considerations list on the Tools page of the Model Context Protocol specification, version 2024-11-05. It records what the specification recommends to implementors and does not describe any organisation’s allowlist, identity, retention, or approval policy.',
    claimBoundary:
      'A recommendation addressed to implementors is not a protocol requirement, is not evidence that any deployed system denies tools by default, and establishes no system-level performance, safety, scalability, economic advantage, or deployment readiness.',
    sourceUrl: 'https://modelcontextprotocol.io/specification/2024-11-05/server/tools',
    sourceExactLocator: 'Tools page, version 2024-11-05: the "User Interaction Model" warning block and the "Security Considerations" list.',
    sourceEstablishes:
      'The Tools page states that for trust, safety and security there SHOULD always be a human in the loop with the ability to deny tool invocations, that the protocol itself does not mandate any specific user interaction model, that servers MUST implement proper access controls and validate tool inputs, and that clients SHOULD prompt for user confirmation on sensitive operations.',
    sourceBoundary:
      'The specification recommends implementor behaviour and mandates server-side input validation and access control. It does not prescribe an organisation’s allowlist, identity, retention, or approval policy, and it expressly does not mandate a user interaction model.',
    rightsBasis: 'citation-with-paraphrase',
    unsupportedExtensions: [
      'That MCP requires tools to be denied by default.',
      'That any named runtime, client, or host implements a default-deny posture.',
      'That a deny-by-default posture measurably reduces incidents.',
    ],
  },
  [BLANKET]: {
    recordKind: 'concept',
    claimStatement:
      'ITER documents a Test Blanket Module programme under which in-vessel modules will be used to test tritium breeding concepts, and states that further research is necessary to demonstrate the feasibility of large-scale tritium production and recycling.',
    claimScope:
      'Limited to the "ITER Test Blanket Module (TBM) Program" section of the ITER Tritium Breeding page. It records a planned test programme and its stated objective, and pools no results from other devices, studies, or blanket concepts.',
    claimBoundary:
      'A planned test programme is not a measurement. This record establishes no breeding ratio, no extraction rate, no neutron or heat-load performance, no materials qualification outcome, and no commercial blanket readiness.',
    sourceUrl: 'https://www.iter.org/machine/supporting-systems/tritium-breeding',
    sourceExactLocator: 'ITER "Tritium Breeding" page: the "ITER Test Blanket Module (TBM) Program" section naming the test blanket modules and the four member concepts.',
    sourceEstablishes:
      'The page names test blanket modules, states that ITER will experiment with tritium production within the vacuum vessel by way of TBMs, identifies four member TBM concepts, and states that further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling.',
    sourceBoundary:
      'An authoritative description of a planned test programme is not evidence of demonstrated tritium breeding, of measured performance, or of commercial blanket readiness.',
    rightsBasis: 'citation-with-paraphrase',
    unsupportedExtensions: [
      'That tritium self-sufficiency has been demonstrated.',
      'That any breeding ratio or extraction rate has been measured.',
      'That blanket materials are qualified for a power reactor.',
      'That a commercial breeding blanket is ready.',
    ],
  },
}

const PACKET_INPUTS: readonly {
  recordId: string
  auditFindings: readonly string[]
  inspectedPassages: readonly InspectedPassage[]
  disagreements: readonly string[]
  uncertainty: readonly string[]
  prohibitedInferences: readonly string[]
  recommendedDisposition: RepairDisposition
}[] = [
  {
    recordId: TOOL_DENY,
    auditFindings: [
      'The submitted claim treats "tool deny by default" as a comparison supported by the specification index, whose own source boundary states that a protocol primitive does not prescribe an organisation’s allowlist, identity, retention, or approval policy.',
      'The frontier alignment audit recorded this record as supported at inspection depth "abstract-only", reasoning that hosts must obtain explicit user consent before invoking any tool. That reading is partly right and materially incomplete: on the specification index the word "must" appears in lowercase, and the index states in the same section that MCP cannot enforce these security principles at the protocol level.',
      'The specification declares BCP 14 keywords normative only when they appear in all capitals, so the lowercase "must" on the index is not a protocol requirement.',
      'Direct inspection of the Tools page for the same version does find normative, capitalised language that names the subject: a human SHOULD always be in the loop with the ability to deny tool invocations.',
      'The specification also states on that page that the protocol itself does not mandate any specific user interaction model, which forecloses reading deny-by-default as an MCP requirement.',
      'No comparative evidence between default-deny and default-allow exposure exists in the cited artifact, so the record cannot stand as a comparison.',
    ],
    inspectedPassages: [
      {
        sourceUrl: 'https://modelcontextprotocol.io/specification/2024-11-05/server/tools',
        sourceTitle: 'Model Context Protocol specification — Tools (version 2024-11-05)',
        exactLocator: 'Tools page, "User Interaction Model" warning block.',
        reading: 'For trust, safety and security the page states there SHOULD always be a human in the loop with the ability to deny tool invocations, and that applications SHOULD make clear which tools are exposed, indicate invocations, and present confirmation prompts.',
        force: 'implementation-recommendation',
        normativeKeyword: 'SHOULD',
        inspectionDepth: 'specified-sections',
        versionRelationship: 'Version of record for specification version 2024-11-05, the same version already bound by the submitted record.',
      },
      {
        sourceUrl: 'https://modelcontextprotocol.io/specification/2024-11-05/server/tools',
        sourceTitle: 'Model Context Protocol specification — Tools (version 2024-11-05)',
        exactLocator: 'Tools page, "User Interaction Model" opening paragraphs.',
        reading: 'The page states that implementations are free to expose tools through any interface pattern and that the protocol itself does not mandate any specific user interaction model.',
        force: 'protocol-requirement',
        normativeKeyword: 'none',
        inspectionDepth: 'specified-sections',
        versionRelationship: 'Version of record for specification version 2024-11-05.',
      },
      {
        sourceUrl: 'https://modelcontextprotocol.io/specification/2024-11-05/server/tools',
        sourceTitle: 'Model Context Protocol specification — Tools (version 2024-11-05)',
        exactLocator: 'Tools page, "Security Considerations" list.',
        reading: 'Servers MUST validate all tool inputs, implement proper access controls, rate limit tool invocations, and sanitize tool outputs. Clients SHOULD prompt for user confirmation on sensitive operations.',
        force: 'protocol-requirement',
        normativeKeyword: 'MUST',
        inspectionDepth: 'specified-sections',
        versionRelationship: 'Version of record for specification version 2024-11-05.',
      },
      {
        sourceUrl: 'https://modelcontextprotocol.io/specification/2024-11-05/index',
        sourceTitle: 'Model Context Protocol specification — index (version 2024-11-05)',
        exactLocator: 'Specification index, "Security and Trust & Safety" section, Key Principles and Implementation Guidelines.',
        reading: 'The index lists tool safety principles in lowercase prose, including that hosts must obtain explicit user consent before invoking any tool, and then states that MCP itself cannot enforce these security principles at the protocol level, with implementor obligations expressed as SHOULD.',
        force: 'general-security-principle',
        normativeKeyword: 'lowercase-must',
        inspectionDepth: 'specified-sections',
        versionRelationship: 'Version of record for specification version 2024-11-05; the artifact currently bound by the submitted record.',
      },
    ],
    disagreements: [
      'The frontier alignment audit judged this record supported. This repair disagrees in part: the underlying observation is real, but the audit read a lowercase "must" as a requirement and did not record the specification’s own statement that it cannot enforce these principles at the protocol level. Both entries are retained; neither is edited.',
      'The internal review blocked the record. This repair agrees with that outcome for the submitted claim and proposes a narrower one rather than defending the original.',
    ],
    uncertainty: [
      'Only the 2024-11-05 version was inspected, because that is the version the record binds. Later specification versions add an authorization specification that was deliberately not consulted, since citing it would change the artifact version without a declared version relationship.',
      'Whether a reader treats "a human in the loop with the ability to deny" as equivalent to "deny by default" is an editorial judgement. The proposed claim therefore states the recommendation rather than the label.',
    ],
    prohibitedInferences: [
      'Do not present a general least-privilege or zero-trust principle as something the Model Context Protocol mandates.',
      'Do not read an implementor recommendation as a protocol requirement.',
      'Do not infer that any deployed host, client, or runtime denies tools by default.',
      'Do not use this record as evidence that a deny-by-default posture is safer, since the cited artifact reports no comparison.',
    ],
    recommendedDisposition: 'revise-record',
  },
  {
    recordId: BLANKET,
    auditFindings: [
      'The submitted record binds the ITER Supporting Systems index, whose declared locator names heating and current drive, fuel cycle, vacuum, cryogenic, diagnostics and tritium breeding system summaries. It names neither breeding blankets nor test blanket modules.',
      'The frontier alignment audit recorded this record as supported at inspection depth "abstract-only", reasoning that ITER documents test blanket modules. Direct inspection confirms ITER does document them — but on a different page from the one the record binds.',
      'The submitted record is typed as a measurement while the bound page is a systems inventory whose own boundary states that a system inventory is not evidence of integrated commercial operation. An inventory supplies no measured quantity.',
      'The ITER Tritium Breeding page does name test blanket modules directly, in a section headed "ITER Test Blanket Module (TBM) Program", and identifies four member concepts.',
      'That page states ITER will experiment with tritium production by way of TBMs and that further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling, which forecloses any demonstrated-performance reading.',
    ],
    inspectedPassages: [
      {
        sourceUrl: 'https://www.iter.org/machine/supporting-systems/tritium-breeding',
        sourceTitle: 'Tritium Breeding | ITER is First Fusion Device to Test',
        exactLocator: '"ITER Test Blanket Module (TBM) Program" section.',
        reading: 'The section names test blanket modules and states that ITER will experiment with tritium production within the vacuum vessel by way of TBMs. Four member concepts are identified: water-cooled lithium-lead, water-cooled ceramics breeder, helium-cooled ceramics breeder, and helium-cooled ceramic pebbles.',
        force: 'protocol-requirement',
        normativeKeyword: 'none',
        inspectionDepth: 'specified-sections',
        versionRelationship: 'Authoritative publisher living page; the version inspected is the one served at the time of this repair. No archival snapshot was pinned.',
      },
      {
        sourceUrl: 'https://www.iter.org/machine/supporting-systems/tritium-breeding',
        sourceTitle: 'Tritium Breeding | ITER is First Fusion Device to Test',
        exactLocator: '"Tritium breeding" section, closing statement on feasibility.',
        reading: 'The page states that ITER will be the first fusion device to test tritium self-sustainment, and that further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling.',
        force: 'protocol-requirement',
        normativeKeyword: 'none',
        inspectionDepth: 'specified-sections',
        versionRelationship: 'Authoritative publisher living page, inspected directly.',
      },
    ],
    disagreements: [
      'The frontier alignment audit judged this record supported because ITER documents TBMs. This repair does not dispute that ITER documents them; it disputes that the page the record binds does. Both entries are retained; neither is edited.',
      'The proposed source is a different ITER page from the submitted one. It is a proposal for review, not a substitution: the submitted binding is reproduced unchanged in this packet.',
    ],
    uncertainty: [
      'The ITER page is a living publisher page with no version identifier or archival snapshot pinned, so a future reader may find different wording. The version relationship is recorded as such rather than claimed to be stable.',
      'Whether the record is better typed as a concept or a method for the TBM programme is an editorial judgement. Concept is proposed because the programme is described, not performed.',
      'IAEA and EUROfusion technical literature on breeding blankets was not inspected for this repair. The single ITER page was sufficient to support the narrowed claim, and adding uninspected sources would widen the binding without widening the evidence.',
    ],
    prohibitedInferences: [
      'Do not infer demonstrated tritium breeding or self-sufficiency from a planned test programme.',
      'Do not infer any breeding ratio, extraction rate, neutron exposure result, or heat-extraction performance.',
      'Do not infer materials qualification for a power reactor.',
      'Do not infer commercial blanket readiness or a delivery timeline.',
      'Do not transfer results between TBM concepts, which differ in coolant and breeder.',
    ],
    recommendedDisposition: 'replace-source-pending-review',
  },
]

function buildPacket(input: (typeof PACKET_INPUTS)[number]): RepairPacket {
  const base = record(input.recordId)
  const source = base.sources[0]!
  const claim = base.claims[0]!
  const review = remainderReview(input.recordId)
  if (!review || review.disposition === 'approved') throw new Error(`${input.recordId}: only a withheld record may be repaired.`)

  const revision = REVISIONS[input.recordId] ?? null
  const before = epistemicReviewTargetHash(base)
  const after = revision ? epistemicReviewTargetHash(candidateRecord(input.recordId, revision)) : null

  const unsigned = {
    schemaVersion: WITHHELD_EVIDENCE_REPAIR_VERSION,
    recordId: input.recordId,
    submitted: {
      revisionSha256: before,
      recordKind: base.recordKind,
      claimStatement: claim.statement,
      sourceId: source.id,
      sourceUrl: source.url,
      exactLocator: source.exactLocator,
      sourceBoundary: source.boundary,
    },
    auditFindings: input.auditFindings,
    inspectedPassages: input.inspectedPassages,
    proposedRevision: revision,
    revisionDigests: { before, after, changed: after !== null && after !== before },
    disagreements: input.disagreements,
    uncertainty: input.uncertainty,
    prohibitedInferences: input.prohibitedInferences,
    recommendedDisposition: input.recommendedDisposition,
    assuranceStatement: ASSURANCE,
  }
  return { ...unsigned, packetDigest: digest(unsigned) }
}

export const WITHHELD_REPAIR_PACKETS: readonly RepairPacket[] = PACKET_INPUTS.map(buildPacket)

// Module-load integrity. A repair may never present itself as an approval.
{
  for (const packet of WITHHELD_REPAIR_PACKETS) {
    if (packet.recommendedDisposition === 'evidence-ready-for-internal-rereview' && !packet.proposedRevision) {
      throw new Error(`${packet.recordId}: cannot be ready for rereview without a proposed revision.`)
    }
    if (packet.proposedRevision) {
      if (!packet.revisionDigests.changed) throw new Error(`${packet.recordId}: a proposed revision must produce a new revision digest.`)
      if (!packet.proposedRevision.sourceExactLocator.trim()) throw new Error(`${packet.recordId}: a proposed source must carry an exact locator.`)
      if (packet.proposedRevision.unsupportedExtensions.length === 0) throw new Error(`${packet.recordId}: a proposed revision must declare its unsupported extensions.`)
    }
    if (packet.inspectedPassages.length === 0) throw new Error(`${packet.recordId}: a repair requires at least one inspected passage.`)
    for (const passage of packet.inspectedPassages) {
      if (!passage.exactLocator.trim()) throw new Error(`${packet.recordId}: an inspected passage requires an exact locator.`)
    }
  }
}

export function repairPacket(recordId: string): RepairPacket | undefined {
  return WITHHELD_REPAIR_PACKETS.find((packet) => packet.recordId === recordId)
}

export const WITHHELD_REPAIR_BOUNDARY = ASSURANCE
