import { canonicalJson } from './canonicalize.ts'
import type { EvidenceDossier } from './schema.ts'
import type { DossierCalculationAttachment } from '../../wasm-kernel/src/dossier.ts'

export const DOSSIER_JSONLD_CONTEXT = 'https://www.mahastrategies.com/ns/evidence-dossier/v1' as const

/**
 * The seven evidence categories are kept as separate top-level collections so a
 * consumer can never mistake one kind of support for another — a source's
 * metadata is not a passage, and a passage is not a calculation.
 *
 * `calculations`, `formalProofs`, and `runtimeReceipts` have no representation
 * in the dossier schema today. They are emitted as empty arrays rather than
 * omitted, so their absence is explicit, and they are never populated by
 * inference: an empty array means the package contains none.
 */
export interface DossierJsonLd {
  '@context': typeof DOSSIER_JSONLD_CONTEXT
  '@type': 'EvidenceDossier'
  '@id': string
  schemaVersion: string
  title: string
  inquiry: string
  intendedUse: string
  prohibitedUses: readonly string[]
  sourceMetadata: readonly Record<string, unknown>[]
  claims: readonly Record<string, unknown>[]
  passages: readonly Record<string, unknown>[]
  calculations: readonly Record<string, unknown>[]
  formalProofs: readonly Record<string, unknown>[]
  runtimeReceipts: readonly Record<string, unknown>[]
  assurance: Record<string, unknown>
  comparisons: readonly Record<string, unknown>[]
  limitations: readonly string[]
  contradictions: readonly string[]
  explicitNonClaims: readonly string[]
  priorRevisions: readonly Record<string, unknown>[]
  provenance: Record<string, unknown>
  disclaimer: string
}

export function renderDossierJsonLd(dossier: EvidenceDossier, attachments: readonly DossierCalculationAttachment[] = []): DossierJsonLd {
  return {
    '@context': DOSSIER_JSONLD_CONTEXT,
    '@type': 'EvidenceDossier',
    '@id': dossier.dossierId,
    schemaVersion: dossier.schemaVersion,
    title: dossier.title,
    inquiry: dossier.inquiry,
    intendedUse: dossier.intendedUse,
    prohibitedUses: dossier.prohibitedUses,

    // Bibliographic identity only. Verification state travels with it so a
    // metadata-verified source is never read as passage-supported.
    sourceMetadata: dossier.sources.map((source) => ({
      '@type': 'SourceMetadata',
      '@id': source.sourceId,
      citation: source.correctedCitation ?? source.submittedCitation,
      identifier: source.identifier,
      publisherUrl: source.publisherUrl,
      publicationType: source.publicationType,
      rightsBasis: source.rightsBasis,
      verificationState: source.verificationState,
      metadataProvenance: source.metadataProvenance,
    })),

    claims: dossier.claims.map((claim) => ({
      '@type': 'Claim',
      '@id': claim.claimId,
      auditedStatement: claim.auditedStatement,
      submittedStatement: claim.submittedStatement,
      claimType: claim.claimType,
      epistemicStatus: claim.epistemicStatus,
      supportedBySources: claim.sourceIds,
      supportedByPassages: claim.passageIds,
      verificationScope: claim.verificationScope,
      uncertainty: claim.uncertainty,
      unsupportedExtensions: claim.unsupportedExtensions,
      provenanceDigest: claim.provenanceDigest,
    })),

    // Inspected content, each bound to one source at one exact locator.
    passages: dossier.passages.map((passage) => ({
      '@type': 'Passage',
      '@id': passage.passageId,
      ofSource: passage.sourceId,
      locator: passage.locator,
      locatorKind: passage.locatorKind,
      isParaphrase: passage.isParaphrase,
      extractionMethod: passage.extractionMethod,
      originalDocumentInspected: passage.originalDocumentInspected,
      passageHash: passage.passageHash,
      sourceRevision: passage.sourceRevision,
    })),

    calculations: attachments.map((attachment) => ({
      '@type': 'Calculation',
      '@id': attachment.receipt.receiptSha256,
      module: attachment.receipt.module,
      operation: attachment.receipt.operation,
      supportsClaims: attachment.claimIds,
      output: attachment.receipt.output,
      uncertainty: attachment.receipt.uncertainty,
      precisionPolicy: attachment.receipt.precisionPolicy,
    })),
    formalProofs: [],
    runtimeReceipts: attachments.map((attachment) => attachment.receipt as unknown as Record<string, unknown>),

    assurance: {
      '@type': 'AssuranceStatement',
      reviewState: dossier.reviewState,
      methodology: dossier.methodology,
      corpusRevision: dossier.corpusRevision,
      externalExpertReview: false,
      independentReproduction: false,
      certification: 'none',
      note: 'Review state describes an internal editorial process. No legal, regulatory, scientific, or commercial certification is claimed.',
    },

    comparisons: dossier.comparisons.map((comparison) => ({
      '@type': 'SourceComparison',
      '@id': comparison.comparisonId,
      relation: comparison.relation,
      question: comparison.question,
      sourceIds: comparison.sourceIds,
      axes: comparison.axes.map((axis) => ({ axis: axis.axis, comparable: axis.comparable, note: axis.note })),
      replicationAssessment: comparison.replicationAssessment,
      provenanceDigest: comparison.provenanceDigest,
    })),

    limitations: dossier.limitations,
    contradictions: dossier.contradictions,
    explicitNonClaims: dossier.unsupportedInferences,

    priorRevisions: dossier.priorRevisions.map((revision) => ({ '@type': 'PriorRevision', ...(revision as unknown as Record<string, unknown>) })),

    provenance: { '@type': 'ProvenanceBundle', ...(dossier.provenanceBundle as unknown as Record<string, unknown>) },
    disclaimer: dossier.disclaimer,
  }
}

/** Deterministic serialization: canonical key order and NFC normalization. */
export function renderDossierJsonLdText(dossier: EvidenceDossier, attachments: readonly DossierCalculationAttachment[] = []): string {
  return `${canonicalJson(renderDossierJsonLd(dossier, attachments))}\n`
}
