import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from './epistemic-publication.ts'
import { candidateRecord, repairPacket } from './substantial-withheld-evidence-repair.ts'
import type { EpistemicRecord } from './epistemic-schema.ts'

export const REVISION_ALIGNMENT_AUDIT_VERSION = 'maha-revision-alignment-audit/1.0' as const

export const REVISION_AUDIT_OUTCOMES = [
  'alignment-clear-ready-for-internal-rereview',
  'alignment-partial-revise-again',
  'source-replacement-insufficient',
  'remain-withheld',
] as const
export type RevisionAuditOutcome = (typeof REVISION_AUDIT_OUTCOMES)[number]

export const AUDIT_DIMENSIONS = [
  'source-identity',
  'exact-locator-fidelity',
  'claim-to-passage-alignment',
  'rights-basis',
  'scope-and-uncertainty',
  'prohibited-inferences',
  'record-classification',
  'title-to-claim-consistency',
] as const
export type AuditDimension = (typeof AUDIT_DIMENSIONS)[number]

export interface DimensionFinding {
  dimension: AuditDimension
  verdict: 'satisfied' | 'corrected' | 'unsatisfied'
  finding: string
}

/** Corrections this audit applies on top of the PR #241 proposal. */
export interface AuditedCorrection {
  title?: string
  slug?: string
  recordKind?: EpistemicRecord['recordKind']
  /** Fields that embed the record's own name or kind and go stale on a rename. */
  description?: string
  boundaries?: readonly string[]
  prohibitedInferences?: readonly string[]
}

export interface RevisionAudit {
  schemaVersion: typeof REVISION_ALIGNMENT_AUDIT_VERSION
  recordId: string
  /** Digest of the superseded record, carried for comparison only. */
  supersededRevision: string
  /** Digest of the PR #241 proposal, before this audit's corrections. */
  proposedRevision: string
  /** Digest of the revision as this audit would have it. */
  auditedRevision: string
  auditedCanonicalPath: string
  correction: AuditedCorrection
  dimensions: readonly DimensionFinding[]
  evidence: {
    metadataVerified: boolean
    sourceContentInspected: boolean
    inspectedContentLocation: string
    subjectAligned: 'supported' | 'partially-supported' | 'mismatched'
    claimSupported: boolean
    inspectionDepth: 'specified-sections' | 'full-document'
    versionRelationshipVerified: boolean
    archivalSnapshotPinned: boolean
    independentlyReproduced: false
    externallyReviewed: false
  }
  /** Text that must never reappear, checked against the audited revision. */
  forbiddenLanguage: readonly string[]
  outcome: RevisionAuditOutcome
  auditDigest: string
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

const TOOL_DENY = 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default'
const BLANKET = 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules'

/**
 * The audited revision applies this audit's corrections on top of the PR #241
 * proposal. It is constructed, never written back: the canonical record and the
 * #241 packet both remain exactly as they are.
 */
export function auditedRecord(recordId: string): EpistemicRecord {
  const packet = repairPacket(recordId)
  if (!packet?.proposedRevision) throw new Error(`${recordId}: no proposed revision to audit.`)
  const base = candidateRecord(recordId, packet.proposedRevision)
  const correction = CORRECTIONS[recordId] ?? {}
  return {
    ...base,
    ...(correction.title ? { title: correction.title } : {}),
    ...(correction.slug ? { slug: correction.slug } : {}),
    ...(correction.recordKind ? { recordKind: correction.recordKind } : {}),
    ...(correction.description ? { description: correction.description } : {}),
    ...(correction.boundaries ? { boundaries: [...correction.boundaries] } : {}),
    ...(correction.prohibitedInferences ? { prohibitedInferences: [...correction.prohibitedInferences] } : {}),
  }
}

const CORRECTIONS: Readonly<Record<string, AuditedCorrection>> = {
  // The submitted title names a posture the source never describes. The phrases
  // "deny by default", "default-deny", "denied by default" and "allowlist" do
  // not appear anywhere on the inspected page; what the page supports is a
  // human's ability to deny an invocation, which is a control, not a default.
  [TOOL_DENY]: {
    title: 'Human denial control for tool invocations',
    slug: 'agentic-systems-mcp-human-denial-control-for-tool-invocations',
    // A rename is not finished until the fields that embed the old name and the
    // old record kind are rewritten too. Leaving them would keep the overclaim
    // in the record's own prose while the title said otherwise.
    description: 'A source-bounded concept record for the human denial control the Model Context Protocol recommends for tool invocations, within agentic systems and MCP.',
    boundaries: [
      'A recommended human denial control does not by itself establish system-level performance, safety, manufacturability, scalability, economic advantage, clinical benefit, or deployment readiness.',
      'A source-bounded concept record does not establish manufacturing yield, economic advantage, safety, clinical benefit, or commercial readiness unless those outcomes are measured in a separately scoped record.',
    ],
    prohibitedInferences: [
      'Do not use this human denial control record to claim that the surrounding technology is proven, safe, scalable, commercially available, or strategically superior.',
      'Do not transfer a reported result across hardware, organisms, protocols, datasets, operating conditions, or outcome definitions without a declared comparison contract.',
      'Do not read a recommended human ability to deny an invocation as a requirement that tools be denied unless explicitly permitted.',
    ],
  },
  // The TBM record's kind was already corrected to `concept` by PR #241 and this
  // audit confirms it. The description still described a measurement record, so
  // the kind correction is completed here rather than left half-applied.
  [BLANKET]: {
    description: 'A source-bounded concept record for the ITER Test Blanket Module programme within fusion and plasma systems.',
    boundaries: [
      'A documented test programme does not by itself establish system-level performance, safety, manufacturability, scalability, economic advantage, clinical benefit, or deployment readiness.',
      'A source-bounded concept record does not establish manufacturing yield, economic advantage, safety, clinical benefit, or commercial readiness unless those outcomes are measured in a separately scoped record.',
    ],
    prohibitedInferences: [
      'Do not use this test blanket module programme record to claim that the surrounding technology is proven, safe, scalable, commercially available, or strategically superior.',
      'Do not transfer a reported result across hardware, organisms, protocols, datasets, operating conditions, or outcome definitions without a declared comparison contract.',
      'Do not read a planned test programme as demonstrated tritium breeding, measured performance, completed materials qualification, or commercial blanket readiness.',
    ],
  },
}

/**
 * Language that must not reappear in a revision. These are checked against the
 * audited record's own text, so a later edit that reintroduces the overclaim
 * fails rather than passing silently.
 */
const FORBIDDEN: Readonly<Record<string, readonly string[]>> = {
  [TOOL_DENY]: ['deny by default', 'default-deny', 'default deny', 'denied by default', 'allowlist', 'MUST always be a human', 'protocol requires', 'MCP requires', 'protocol mandates'],
  [BLANKET]: ['demonstrated breeding', 'commercially ready', 'commercial readiness', 'breeding ratio of', 'qualification complete', 'proven blanket', 'measured breeding'],
}

/**
 * Only the fields that ASSERT something are scanned for forbidden language.
 *
 * A record's boundaries, prohibited inferences, claim scope and source boundary
 * exist precisely to name what the evidence does not support — "does not
 * establish commercial readiness", "does not prescribe an allowlist". Scanning
 * those would flag the honest disclaimer and reward deleting it, which is the
 * opposite of what this gate is for.
 */
export function revisionText(record: EpistemicRecord): string {
  return [
    record.title,
    record.slug,
    record.description ?? '',
    ...record.claims.map((claim) => claim.statement),
    ...record.sources.map((source) => source.establishes),
  ].join('\n')
}

/** The denying fields, exposed so a test can prove they are deliberately excluded. */
export function revisionDenialText(record: EpistemicRecord): string {
  return [
    ...record.claims.flatMap((claim) => [claim.scope, claim.boundary]),
    ...record.sources.map((source) => source.boundary),
    ...record.boundaries,
    ...record.prohibitedInferences,
  ].join('\n')
}

/**
 * Forbidden language is matched case-insensitively, except where the phrase is
 * a normative keyword whose capitalisation is the point.
 */
export function forbiddenLanguageHits(recordId: string, record: EpistemicRecord): readonly string[] {
  const text = revisionText(record)
  return (FORBIDDEN[recordId] ?? []).filter((phrase) =>
    /^[A-Z]{3,}/.test(phrase) ? text.includes(phrase) : text.toLowerCase().includes(phrase.toLowerCase()),
  )
}

const DIMENSIONS: Readonly<Record<string, readonly DimensionFinding[]>> = {
  [TOOL_DENY]: [
    { dimension: 'source-identity', verdict: 'satisfied', finding: 'The proposal binds the Tools page of the Model Context Protocol specification, version 2024-11-05. That is the same specification and the same version the superseded record bound, so this is a locator correction within one artifact rather than a change of source identity. The page was re-fetched for this audit and served the same content.' },
    { dimension: 'exact-locator-fidelity', verdict: 'satisfied', finding: 'The locator names the "User Interaction Model" warning block and the "Security Considerations" list. Both headings exist verbatim on the inspected page, and both contain the language the claim relies on.' },
    { dimension: 'claim-to-passage-alignment', verdict: 'satisfied', finding: 'The claim asserts a normative SHOULD addressed to implementors and an express non-mandate. The page states "there SHOULD always be a human in the loop with the ability to deny tool invocations" with SHOULD capitalised, and "the protocol itself does not mandate any specific user interaction model". The claim asserts neither more nor less.' },
    { dimension: 'rights-basis', verdict: 'satisfied', finding: 'citation-with-paraphrase against a publicly served specification page. The record retains original paraphrase and reproduces no block of specification text, schema, or diagram.' },
    { dimension: 'scope-and-uncertainty', verdict: 'satisfied', finding: 'Scope is bound to two named sections of one specification version. The uncertainty that matters is recorded: later specification versions add an authorization specification that was deliberately not consulted, because citing it would change the artifact version without a declared version relationship.' },
    { dimension: 'prohibited-inferences', verdict: 'satisfied', finding: 'The prohibitions close the three readings the evidence cannot carry: a general least-privilege principle presented as an MCP mandate, an implementor recommendation read as a protocol requirement, and an inference that any deployed runtime denies tools by default.' },
    { dimension: 'record-classification', verdict: 'corrected', finding: 'PR #241 moved the record from comparison to concept. This audit confirms concept: the artifact defines a recommended control and reports no comparison between exposure postures, so neither comparison nor measurement is available.' },
    { dimension: 'title-to-claim-consistency', verdict: 'corrected', finding: 'The submitted title "Tool deny by default" overstates the source. The phrases "deny by default", "default-deny", "denied by default" and "allowlist" appear nowhere on the inspected page. What the page supports is a human ability to deny an invocation — a control that must be available, not a posture that must be the default. The audited title is "Human denial control for tool invocations" with a matching slug, so the record name no longer asserts more than the locator carries.' },
  ],
  [BLANKET]: [
    { dimension: 'source-identity', verdict: 'corrected', finding: 'The proposal replaces the ITER Supporting Systems index with the ITER Tritium Breeding page. This is a genuine change of source identity, not a locator correction, and it is why the PR #241 disposition was replace-source-pending-review. The replacement page was re-fetched for this audit and named the subject directly.' },
    { dimension: 'exact-locator-fidelity', verdict: 'satisfied', finding: 'The locator names the "ITER Test Blanket Module (TBM) Program" section. That heading exists verbatim on the inspected page, and the section names test blanket modules and four member concepts. The superseded locator named neither blankets nor test modules, which was the original defect.' },
    { dimension: 'claim-to-passage-alignment', verdict: 'satisfied', finding: 'The claim asserts a documented programme under which modules will be used to test breeding, plus the stated need for further research. The page states "ITER will experiment with tritium production within the vacuum vessel by way of test blanket modules (TBMs)" and "Further research will be necessary to demonstrate the feasibility of large-scale tritium production and recycling". The claim tracks both sentences and adds nothing.' },
    { dimension: 'rights-basis', verdict: 'satisfied', finding: 'citation-with-paraphrase against an authoritative publisher page. No figure, diagram, or block of ITER text is reproduced.' },
    { dimension: 'scope-and-uncertainty', verdict: 'corrected', finding: 'Scope is bound to the single named TBM Program section. The audit re-checked the version position and confirmed the page carries no publication date, no version number and no last-updated stamp, and no archival snapshot was pinned. That limitation is recorded on the audit rather than left implicit, so a future reader is told the wording may have moved.' },
    { dimension: 'prohibited-inferences', verdict: 'satisfied', finding: 'The prohibitions separate the claims the task requires kept apart: tritium breeding, heat extraction, neutron exposure, materials qualification, module geometry, programme scope and commercial readiness. Demonstrated breeding, any breeding ratio, qualification and commercial readiness are each explicitly closed, and transfer between TBM concepts is forbidden because they differ in coolant and breeder.' },
    { dimension: 'record-classification', verdict: 'corrected', finding: 'PR #241 moved the record from measurement to concept, and this audit confirms concept is correct. A measurement would require a measured quantity and the page reports none. A method would imply a procedure the record instructs someone to follow; the page describes a programme that will be run, not a method to apply. Concept records the bounded existence and scope of the TBM programme, which is exactly what the section supports.' },
    { dimension: 'title-to-claim-consistency', verdict: 'satisfied', finding: 'The title "Breeding blanket test modules" names precisely what the inspected section names. It asserts no performance, no completion and no readiness, so unlike the MCP record the title needs no correction.' },
  ],
}

function buildAudit(recordId: string): RevisionAudit {
  const base = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)
  const packet = repairPacket(recordId)
  if (!base || !packet?.proposedRevision) throw new Error(`${recordId}: cannot audit without a record and a proposal.`)
  const proposed = candidateRecord(recordId, packet.proposedRevision)
  const audited = auditedRecord(recordId)
  const dimensions = DIMENSIONS[recordId] ?? []

  const evidence = recordId === TOOL_DENY
    ? {
      metadataVerified: true,
      sourceContentInspected: true,
      inspectedContentLocation: 'Model Context Protocol specification 2024-11-05, Tools page: "User Interaction Model" and "Security Considerations".',
      subjectAligned: 'supported' as const,
      claimSupported: true,
      inspectionDepth: 'specified-sections' as const,
      versionRelationshipVerified: true,
      archivalSnapshotPinned: false,
      independentlyReproduced: false as const,
      externallyReviewed: false as const,
    }
    : {
      metadataVerified: true,
      sourceContentInspected: true,
      inspectedContentLocation: 'ITER Tritium Breeding page: "ITER Test Blanket Module (TBM) Program" section.',
      subjectAligned: 'supported' as const,
      claimSupported: true,
      inspectionDepth: 'specified-sections' as const,
      versionRelationshipVerified: false,
      archivalSnapshotPinned: false,
      independentlyReproduced: false as const,
      externallyReviewed: false as const,
    }

  const hits = forbiddenLanguageHits(recordId, audited)
  const unsatisfied = dimensions.filter((entry) => entry.verdict === 'unsatisfied')

  // An audit may only reach readiness when every dimension holds, the content
  // was inspected at section depth or better, and no forbidden language returned.
  const outcome: RevisionAuditOutcome =
    unsatisfied.length > 0 ? 'alignment-partial-revise-again'
      : hits.length > 0 ? 'alignment-partial-revise-again'
        : !evidence.sourceContentInspected || evidence.subjectAligned !== 'supported' || !evidence.claimSupported ? 'source-replacement-insufficient'
          : 'alignment-clear-ready-for-internal-rereview'

  const unsigned = {
    schemaVersion: REVISION_ALIGNMENT_AUDIT_VERSION,
    recordId,
    supersededRevision: epistemicReviewTargetHash(base),
    proposedRevision: epistemicReviewTargetHash(proposed),
    auditedRevision: epistemicReviewTargetHash(audited),
    auditedCanonicalPath: epistemicRecordPath(audited),
    correction: CORRECTIONS[recordId] ?? {},
    dimensions,
    evidence,
    forbiddenLanguage: FORBIDDEN[recordId] ?? [],
    outcome,
  }
  return { ...unsigned, auditDigest: digest(unsigned) }
}

export const REVISION_ALIGNMENT_AUDITS: readonly RevisionAudit[] = [TOOL_DENY, BLANKET].map(buildAudit)

// Module-load integrity.
{
  for (const audit of REVISION_ALIGNMENT_AUDITS) {
    if (audit.dimensions.length !== AUDIT_DIMENSIONS.length) throw new Error(`${audit.recordId}: every audit dimension must be judged.`)
    const seen = new Set(audit.dimensions.map((entry) => entry.dimension))
    for (const dimension of AUDIT_DIMENSIONS) if (!seen.has(dimension)) throw new Error(`${audit.recordId}: ${dimension} is unjudged.`)
    if (audit.auditedRevision === audit.supersededRevision) throw new Error(`${audit.recordId}: an audited revision must differ from the superseded one.`)
    if (audit.evidence.inspectionDepth === 'specified-sections' && !audit.evidence.sourceContentInspected) {
      throw new Error(`${audit.recordId}: a depth claim requires an inspection.`)
    }
  }
}

export function revisionAudit(recordId: string): RevisionAudit | undefined {
  return REVISION_ALIGNMENT_AUDITS.find((audit) => audit.recordId === recordId)
}

export const REVISION_AUDIT_BOUNDARY =
  'This is an independent internal editorial alignment audit of a proposed revision. It is not the internal review decision and it is not a release: an audit that reaches alignment-clear produces a reviewer packet for a separate review pass, performed by a separate operation.'

/**
 * A reviewer packet for an audited revision that reached alignment-clear.
 *
 * Every criterion is pending. This module performs no review: generating a
 * packet and deciding it are deliberately separate operations, so that an audit
 * can never be mistaken for — or quietly become — an approval.
 */
export interface RereviewPacket {
  schemaVersion: typeof REVISION_ALIGNMENT_AUDIT_VERSION
  recordId: string
  auditedRevision: string
  auditedCanonicalPath: string
  auditDigest: string
  title: string
  slug: string
  recordKind: EpistemicRecord['recordKind']
  claimStatement: string
  sourceUrl: string
  exactLocator: string
  rightsBasis: string
  checklist: Readonly<Record<string, readonly { criterionId: string; question: string; status: 'pending-record-specific-review' }[]>>
  decisionStatus: 'pending'
  boundary: string
  packetDigest: string
}

export async function buildRereviewPackets(): Promise<readonly RereviewPacket[]> {
  const { EXPERT_REVIEW_CRITERIA } = await import('./epistemic-review.ts')
  return REVISION_ALIGNMENT_AUDITS.filter((audit) => audit.outcome === 'alignment-clear-ready-for-internal-rereview').map((audit) => {
    const record = auditedRecord(audit.recordId)
    const source = record.sources[0]!
    const unsigned = {
      schemaVersion: REVISION_ALIGNMENT_AUDIT_VERSION,
      recordId: audit.recordId,
      auditedRevision: audit.auditedRevision,
      auditedCanonicalPath: audit.auditedCanonicalPath,
      auditDigest: audit.auditDigest,
      title: record.title,
      slug: record.slug,
      recordKind: record.recordKind,
      claimStatement: record.claims[0]!.statement,
      sourceUrl: source.url,
      exactLocator: source.exactLocator,
      rightsBasis: source.rights.basis,
      checklist: Object.fromEntries(
        Object.entries(EXPERT_REVIEW_CRITERIA).map(([scope, criteria]) => [
          scope,
          criteria.map((criterion) => ({ criterionId: criterion.id, question: criterion.question, status: 'pending-record-specific-review' as const })),
        ]),
      ),
      decisionStatus: 'pending' as const,
      boundary: REVISION_AUDIT_BOUNDARY,
    }
    return { ...unsigned, packetDigest: digest(unsigned) }
  })
}
