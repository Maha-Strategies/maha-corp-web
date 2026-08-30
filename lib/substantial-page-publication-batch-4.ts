import { PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS } from './frontier-source-override-activation.ts'

export const SUBSTANTIAL_PUBLICATION_BATCH_4_VERSION = 'maha-substantial-publication/1.3-readiness' as const

interface FrozenPriorRelease {
  recordId: string
  releaseId: string
  targetSha256: string
  canonicalPath: string
  assuranceTier: 'internally-reviewed-canonical'
}

/** Sanitized facts from the public release registry; no reviewer identity or secret material. */
export const SUBSTANTIAL_BATCH_4_PRIOR_RELEASES: readonly FrozenPriorRelease[] = [
  {
    recordId: 'urn:maha:record:advanced-materials-graphene-hbn-heterostructures',
    releaseId: 'epirelease_cf7d30fd107544bb8cf80ef1d184e5b6',
    targetSha256: 'sha256:089357ea824544d5dae02a72384bb9eefea284e439771650d6e60b768ca3c144',
    canonicalPath: '/knowledge/advanced-materials/methods/advanced-materials-graphene-hbn-heterostructures',
    assuranceTier: 'internally-reviewed-canonical',
  },
  {
    recordId: 'urn:maha:record:critical-supply-chains-quartz-crucible-manufacturing',
    releaseId: 'epirelease_ddb8847cfa1748a19c374b2b71bc913e',
    targetSha256: 'sha256:4ea4058077b38e83ffe793f62499517702af9b8c0f9c129ab932833fa897e78e',
    canonicalPath: '/knowledge/critical-supply-chains/mechanisms/critical-supply-chains-quartz-crucible-manufacturing',
    assuranceTier: 'internally-reviewed-canonical',
  },
] as const

export interface SubstantialBatch4ReadinessEntry {
  recordId: string
  candidateRevisionSha256: string
  candidateProvenanceSha256: string
  releaseState: 'prior-release-will-be-stale' | 'no-canonical-release'
  priorRelease: FrozenPriorRelease | null
  pageEligible: false
  blockerCodes: readonly string[]
}

const releaseByRecordId = new Map(SUBSTANTIAL_BATCH_4_PRIOR_RELEASES.map((release) => [release.recordId, release]))

export const SUBSTANTIAL_BATCH_4_READINESS: readonly SubstantialBatch4ReadinessEntry[] =
  PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.map((activation) => {
    const priorRelease = releaseByRecordId.get(activation.recordId) ?? null
    return {
      recordId: activation.recordId,
      candidateRevisionSha256: activation.candidateRevisionSha256,
      candidateProvenanceSha256: activation.candidateProvenanceSha256,
      releaseState: priorRelease ? 'prior-release-will-be-stale' as const : 'no-canonical-release' as const,
      priorRelease,
      pageEligible: false as const,
      blockerCodes: priorRelease
        ? [
            'full-record-revision-missing',
            'revision-alignment-audit-missing',
            'revision-scoped-review-missing',
            'canonical-rerelease-missing',
          ]
        : [
            'full-record-revision-missing',
            'revision-alignment-audit-missing',
            'revision-scoped-review-missing',
            'canonical-release-missing',
          ],
    }
  })

/**
 * Batch 4 intentionally publishes zero pages. The current release-aware
 * intersection is exhausted: all released, alignment-clear records already
 * appear in Batches 1–3. Candidate source corrections must not be projected
 * until the exact revised records are audited and canonically released.
 */
export const SUBSTANTIAL_BATCH_4_PAGES = [] as const

if (SUBSTANTIAL_BATCH_4_READINESS.length !== 26
  || SUBSTANTIAL_BATCH_4_READINESS.filter((entry) => entry.releaseState === 'prior-release-will-be-stale').length !== 2
  || SUBSTANTIAL_BATCH_4_READINESS.some((entry) => entry.pageEligible)) {
  throw new Error('Substantial Batch 4 readiness inventory drifted or bypassed release awareness.')
}
