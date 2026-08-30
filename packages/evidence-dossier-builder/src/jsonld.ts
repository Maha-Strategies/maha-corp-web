import { canonicalJson } from './canonicalize.ts'
import type { EvidenceDossier } from './schema.ts'
import type { DossierCalculationAttachment } from '../../wasm-kernel/src/dossier.ts'
import type { DossierRuntimeWitnessAttachment } from '../../../lib/evidence-dossier/runtime-witness.ts'
import type { FormalProofAttachment } from '../../maha-lean-bridge/src/schema.ts'

/** Signature provenance for the authorization, rendered separately from proofs. */
export interface FormalProofAuthorityNode {
  signatureAlgorithm: string
  canonicalization: string
  keyId: string
  authorityEpoch: number
  signatureAuthentic: boolean
  bindingManifestSha256: string
  bindingManifestRevision: number
  syntheticTestKey: boolean
}

export const DOSSIER_JSONLD_CONTEXT = 'https://www.mahastrategies.com/ns/evidence-dossier/v1' as const

/**
 * The seven evidence categories are kept as separate top-level collections so a
 * consumer can never mistake one kind of support for another — a source's
 * metadata is not a passage, and a passage is not a calculation.
 *
 * `calculations` and `runtimeReceipts` have no representation in the dossier
 * schema today. They are emitted as empty arrays rather than omitted, so their
 * absence is explicit, and they are never populated by inference: an empty
 * array means the package contains none.
 *
 * `formalProofs` carries machine-checked Lean attachments. Only attachments a
 * real Lean run verified may appear — a failed or unrun proof is absent rather
 * than represented as a weaker proof, so a reader never has to distinguish
 * grades of "proved". A formal proof establishes a conditional deduction from
 * stated assumptions and creates no passage support and no empirical status.
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
  /**
   * Who attested to the authorization, and under which key.
   *
   * Deliberately its own field rather than a flag inside each proof: a
   * signature speaks to who authorized the binding, not to whether the theorem
   * holds or whether the claim is true.
   */
  formalProofAuthority: Record<string, unknown>
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

export function renderDossierJsonLd(dossier: EvidenceDossier, attachments: readonly DossierCalculationAttachment[] = [], witnesses: readonly DossierRuntimeWitnessAttachment[] = [], formalProofs: readonly FormalProofAttachment[] = [], authority?: FormalProofAuthorityNode): DossierJsonLd {
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
      calculationForClaims: attachment.claimIds,
      output: attachment.receipt.output,
      uncertainty: attachment.receipt.uncertainty,
      precisionPolicy: attachment.receipt.precisionPolicy,
    })),
    // Sorted by theorem id, so package bytes do not depend on attachment order.
    formalProofs: [...formalProofs]
      .filter((proof) => proof.proofStatus === 'verified' && proof.assurance.machineChecked === true)
      .sort((a, b) => (a.theoremId < b.theoremId ? -1 : a.theoremId > b.theoremId ? 1 : 0))
      .map((proof) => ({
        '@type': 'MachineCheckedFormalStatement',
        '@id': proof.theoremId,
        theoremName: proof.theoremName,
        theoremNamespace: proof.theoremNamespace,
        formalStatement: proof.formalStatement,
        assumptions: proof.assumptions,
        informalBoundary: proof.informalBoundary,
        claimIds: proof.claimIds,
        calculationOperationIds: proof.calculationOperationIds,
        bindingId: proof.bindingId,
        bindingRevision: proof.bindingRevision,
        bindingManifestSha256: proof.bindingManifestSha256,
        sourceFile: proof.sourceFile,
        sourceSha256: proof.sourceSha256,
        proofManifestSha256: proof.proofManifestSha256,
        toolchain: proof.toolchain,
        leanVersion: proof.leanVersion,
        verificationStatus: proof.proofStatus,
        verificationCommand: proof.verificationCommand,
        // Restated per proof rather than only once in the assurance block, so a
        // consumer extracting a single node cannot lose the boundary.
        assurance: {
          '@type': 'FormalProofAssurance',
          machineChecked: proof.assurance.machineChecked,
          empiricallyValidated: false,
          independentlyReproduced: false,
          compilerEquivalenceProven: false,
          scientificModelCertified: false,
          note: 'Establishes only that the stated conclusion follows from the stated assumptions. Not an experiment, not source-passage verification, not independent reproduction, not expert review, not regulatory approval.',
        },
      })),
    runtimeReceipts: witnesses.map((attachment) => attachment.receipt as unknown as Record<string, unknown>),

    formalProofAuthority: authority
      ? {
          '@type': 'FormalProofAuthority',
          signatureAlgorithm: authority.signatureAlgorithm,
          canonicalization: authority.canonicalization,
          keyId: authority.keyId,
          authorityEpoch: authority.authorityEpoch,
          signatureAuthentic: authority.signatureAuthentic,
          bindingManifestSha256: authority.bindingManifestSha256,
          bindingManifestRevision: authority.bindingManifestRevision,
          syntheticTestKey: authority.syntheticTestKey,
          note: 'A valid signature establishes that a holder of the named key attested to this set of authorized bindings. It does not establish that any theorem holds, that any claim is true, or that any model describes reality.',
        }
      : {
          '@type': 'FormalProofAuthority',
          signatureAuthentic: false,
          note: 'No signed authorization accompanies this package.',
        },

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
export function renderDossierJsonLdText(dossier: EvidenceDossier, attachments: readonly DossierCalculationAttachment[] = [], witnesses: readonly DossierRuntimeWitnessAttachment[] = [], formalProofs: readonly FormalProofAttachment[] = [], authority?: FormalProofAuthorityNode): string {
  return `${canonicalJson(renderDossierJsonLd(dossier, attachments, witnesses, formalProofs, authority))}\n`
}
