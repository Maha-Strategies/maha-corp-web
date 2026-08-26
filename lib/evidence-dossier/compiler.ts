import {
  DOSSIER_SCHEMA_VERSION,
  DOSSIER_EPISTEMIC_BASE,
  type DossierClaim,
  type DossierPassage,
  type EvidenceDossier,
  type SourceComparison,
} from './schema.ts'
import { CANONICALIZATION_VERSION, passageDigest, provenanceDigest } from './digest.ts'
import { assertValidDossier } from './validator.ts'

export type DossierPassageDraft = Omit<DossierPassage, 'passageHash'>
export type DossierClaimDraft = Omit<DossierClaim, 'provenanceDigest'>
export type SourceComparisonDraft = Omit<SourceComparison, 'provenanceDigest'>

export type EvidenceDossierDraft = Omit<
  EvidenceDossier,
  'schemaVersion' | 'epistemicBaseVersion' | 'passages' | 'claims' | 'comparisons' | 'provenanceBundle'
> & {
  passages: readonly DossierPassageDraft[]
  claims: readonly DossierClaimDraft[]
  comparisons: readonly SourceComparisonDraft[]
}

function byId<T>(items: readonly T[], id: (item: T) => string): T[] {
  return [...items].sort((left, right) => id(left).localeCompare(id(right)))
}

/**
 * Compile only supplied evidence. This function computes provenance and stable
 * ordering; it never discovers locators, rewrites claims, or invents sources.
 */
export function compileEvidenceDossier(draft: EvidenceDossierDraft): EvidenceDossier {
  const sources = byId(draft.sources, (source) => source.sourceId)
  const passages: DossierPassage[] = byId(draft.passages, (passage) => passage.passageId).map((passage) => ({
    ...passage,
    passageHash: passageDigest(passage),
  }))
  const claims: DossierClaim[] = byId(draft.claims, (claim) => claim.claimId).map((claim) => {
    const normalized = {
      ...claim,
      sourceIds: [...claim.sourceIds].sort(),
      passageIds: [...claim.passageIds].sort(),
      disagreements: [...claim.disagreements],
      unsupportedExtensions: [...claim.unsupportedExtensions],
      reviewerDecisions: [...claim.reviewerDecisions],
    }
    return { ...normalized, provenanceDigest: provenanceDigest(normalized) }
  })
  const comparisons: SourceComparison[] = byId(draft.comparisons, (comparison) => comparison.comparisonId).map((comparison) => {
    const normalized = { ...comparison, sourceIds: [...comparison.sourceIds].sort() }
    return { ...normalized, provenanceDigest: provenanceDigest(normalized) }
  })

  const base = {
    ...draft,
    schemaVersion: DOSSIER_SCHEMA_VERSION,
    epistemicBaseVersion: DOSSIER_EPISTEMIC_BASE,
    sources,
    passages,
    claims,
    comparisons,
  }
  const bundleBase = {
    corpusRevision: draft.corpusRevision,
    digestAlgorithm: 'sha256' as const,
    canonicalizationVersion: CANONICALIZATION_VERSION,
    sourceCount: sources.length,
    passageCount: passages.length,
    claimCount: claims.length,
    comparisonCount: comparisons.length,
  }
  const dossier: EvidenceDossier = {
    ...base,
    provenanceBundle: {
      ...bundleBase,
      dossierDigest: provenanceDigest({ ...base, provenanceBundle: bundleBase }),
    },
  }
  assertValidDossier(dossier)
  return dossier
}
