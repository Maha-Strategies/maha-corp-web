import { canonicalJson } from './digest.ts'
import { evidentiaryProjection, type DossierPackage } from './package.ts'

/**
 * Deterministic reviewer-ready packet.
 *
 * Everything a reviewer needs to check the work without opening the codebase,
 * and nothing that would let the packet be mistaken for a published finding.
 */

export const REVIEW_CHECKLIST: readonly string[] = [
  'Open each cited source and confirm the locator points where the passage says it does.',
  'Confirm each audited statement is not stronger than its passage.',
  'Confirm every submitted statement is preserved beside its correction.',
  'Confirm no claim is presented as replicated unless two independent empirical sources support it.',
  'Confirm the comparison axes marked comparable really are comparable.',
  'Confirm the prohibited-use and limitation statements match what the evidence supports.',
  'Recompute the payload digest and compare it to the one printed here.',
]

export const PACKET_NONCLAIMS: readonly string[] = [
  'This packet is not an approval, certification, attestation or expert opinion.',
  'It does not assert that any claim is true, only where each statement was found and how far checking went.',
  'It has not been reviewed by anyone outside Maha Strategies.',
  'It confers no regulatory, patent or compliance status.',
]

export interface ReviewerPacket {
  packetVersion: 'maha-reviewer-packet/0.1'
  generatedFrom: { packageId: string; revisionId: string; payloadDigest: string; reviewState: string }
  inquiry: string
  methodology: string
  claims: readonly {
    claimId: string
    submitted: string
    audited: string
    status: string
    locators: readonly string[]
    uncertainty: string
    unsupportedExtensions: readonly string[]
    digest: string
  }[]
  sources: readonly {
    sourceId: string
    citation: string
    correctedCitation: string | null
    identifier: string | null
    verificationState: string
    rightsBasis: string
  }[]
  comparisonMatrix: readonly {
    comparisonId: string
    relation: string
    axes: readonly { axis: string; comparable: boolean; note: string }[]
    replicationAssessment: string
  }[]
  contradictions: readonly string[]
  unsupportedInferences: readonly string[]
  limitations: readonly string[]
  reviewChecklist: readonly string[]
  revisionLineage: readonly { version: string; digest: string }[]
  nonClaims: readonly string[]
}

export function buildReviewerPacket(pkg: DossierPackage): ReviewerPacket {
  const { dossier } = pkg
  const passageById = new Map(dossier.passages.map((passage) => [passage.passageId, passage]))

  return {
    packetVersion: 'maha-reviewer-packet/0.1',
    generatedFrom: {
      packageId: pkg.packageId,
      revisionId: pkg.revisionId,
      payloadDigest: pkg.canonicalPayloadDigest,
      reviewState: pkg.reviewState,
    },
    inquiry: dossier.inquiry,
    methodology: dossier.methodology,
    claims: dossier.claims.map((claim) => ({
      claimId: claim.claimId,
      submitted: claim.submittedStatement,
      audited: claim.auditedStatement,
      status: claim.epistemicStatus,
      locators: claim.passageIds
        .map((id) => passageById.get(id))
        .filter((passage): passage is NonNullable<typeof passage> => Boolean(passage))
        .map((passage) => `${passage.sourceId} — ${passage.locator ?? 'MISSING LOCATOR'}`),
      uncertainty: claim.uncertainty,
      unsupportedExtensions: claim.unsupportedExtensions,
      digest: claim.provenanceDigest,
    })),
    sources: dossier.sources.map((source) => ({
      sourceId: source.sourceId,
      citation: source.submittedCitation,
      correctedCitation: source.correctedCitation,
      identifier: source.identifier,
      verificationState: source.verificationState,
      rightsBasis: source.rightsBasis,
    })),
    comparisonMatrix: dossier.comparisons.map((comparison) => ({
      comparisonId: comparison.comparisonId,
      relation: comparison.relation,
      axes: comparison.axes.map((axis) => ({ axis: axis.axis, comparable: axis.comparable, note: axis.note })),
      replicationAssessment: comparison.replicationAssessment,
    })),
    contradictions: dossier.contradictions,
    unsupportedInferences: dossier.unsupportedInferences,
    limitations: dossier.limitations,
    reviewChecklist: REVIEW_CHECKLIST,
    revisionLineage: [
      ...dossier.priorRevisions.map((revision) => ({ version: revision.version, digest: revision.dossierDigest })),
      { version: `${pkg.revisionId} (current)`, digest: pkg.canonicalPayloadDigest },
    ],
    nonClaims: PACKET_NONCLAIMS,
  }
}

/** Byte-stable packet, for comparing two runs. */
export function serializePacket(packet: ReviewerPacket): string {
  return canonicalJson(packet)
}

/** Digest of the evidentiary projection only; presentation changes do not move it. */
export function packetEvidenceDigestInput(pkg: DossierPackage): string {
  return canonicalJson(evidentiaryProjection(pkg))
}
