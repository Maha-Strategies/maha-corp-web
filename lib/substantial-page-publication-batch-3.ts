import { createHash } from 'node:crypto'

import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from './epistemic-publication.ts'
import { alignmentBlockers } from './frontier-source-alignment.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from './repaired-revision-canary-targets.ts'
import {
  publishBatch2Record,
  SUBSTANTIAL_BATCH_2_PAGES,
  type PublishedBatch2Page,
} from './substantial-page-publication-batch-2.ts'

/**
 * Release-aware substantial-page publication, batch three.
 *
 * Batch two selected on evidence eligibility before checking canonical release
 * state. Batch three reverses that order. A record enters this batch only when
 * a frozen active release names the exact revision and canonical path that the
 * compiler receives. Two selected records replace repaired Batch 2 revisions.
 * Five more active records enter the substantial projection because later
 * source inspection made their exact released revisions alignment-clear.
 */
export const SUBSTANTIAL_PUBLICATION_BATCH_3_VERSION = 'maha-substantial-publication/1.2' as const
export const SUBSTANTIAL_PUBLICATION_BATCH_3_DATE = '2026-08-28' as const
export const SUBSTANTIAL_BATCH_3_RELEASE_REGISTRY_GENERATED_AT = '2026-08-28T04:53:58.023Z' as const

export interface FrozenActiveRelease {
  recordId: string
  releaseId: string
  targetSha256: string
  canonicalPath: string
  assuranceTier: 'internally-reviewed-canonical'
}

/** Sanitized public release facts only; no reviewer identity or natal data. */
export const SUBSTANTIAL_BATCH_3_RELEASES: readonly FrozenActiveRelease[] = [
  {
    recordId: 'urn:maha:record:agentic-systems-mcp-tool-deny-by-default',
    releaseId: 'epirelease_ec742c5ed8924d4b9f8f3bda5570bb19',
    targetSha256: 'sha256:bc3682ef4b4613b4cff9c468953c218fb20ebad8786ab8c6cc4bbcc8dccb1a66',
    canonicalPath: '/knowledge/agentic-systems-mcp/concepts/agentic-systems-mcp-human-denial-control-for-tool-invocations',
    assuranceTier: 'internally-reviewed-canonical',
  },
  {
    recordId: 'urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules',
    releaseId: 'epirelease_125e34f72e9d4296a44eae59f921caed',
    targetSha256: 'sha256:4e6718f1603760cec3f677744f669991415c5466c982f9c0aae3f6b39824636a',
    canonicalPath: '/knowledge/fusion-plasma-systems/concepts/fusion-plasma-systems-breeding-blanket-test-modules',
    assuranceTier: 'internally-reviewed-canonical',
  },
  {
    recordId: 'urn:maha:record:longevity-metabolism-autophagosome-abundance',
    releaseId: 'epirelease_544aa352bd1e4db38bee41a97f03b34a',
    targetSha256: 'sha256:ca4b5b97fcdd716e0e9a9cc9bbb468104e24cce2673595f12ac60a45f8cc7740',
    canonicalPath: '/knowledge/longevity-metabolism/concepts/longevity-metabolism-autophagosome-abundance',
    assuranceTier: 'internally-reviewed-canonical',
  },
  {
    recordId: 'urn:maha:record:longevity-metabolism-autophagic-flux',
    releaseId: 'epirelease_0ec7c21d98e14b4fb8f01fdc65c4064b',
    targetSha256: 'sha256:1db5eca0f68681c48646e0d05ca7a71241751ba1d68c64e36b21fefe08ba75d6',
    canonicalPath: '/knowledge/longevity-metabolism/mechanisms/longevity-metabolism-autophagic-flux',
    assuranceTier: 'internally-reviewed-canonical',
  },
  {
    recordId: 'urn:maha:record:longevity-metabolism-lysosomal-degradation-blockade',
    releaseId: 'epirelease_23339b67f1124139b20cebc1e0dd6703',
    targetSha256: 'sha256:b80c01dc2ee3043a7d76441470570ee28019ee3f73f7ad5707128a38d890c794',
    canonicalPath: '/knowledge/longevity-metabolism/methods/longevity-metabolism-lysosomal-degradation-blockade',
    assuranceTier: 'internally-reviewed-canonical',
  },
  {
    recordId: 'urn:maha:record:longevity-metabolism-lc3-turnover-assays',
    releaseId: 'epirelease_0eb6f5296fba403b8a034b3b79d25956',
    targetSha256: 'sha256:d41e23431b7c29de0a5301bdaa86aef0a388ad6492f39a4ce6a75bb1d90dc62d',
    canonicalPath: '/knowledge/longevity-metabolism/measurements/longevity-metabolism-lc3-turnover-assays',
    assuranceTier: 'internally-reviewed-canonical',
  },
  {
    recordId: 'urn:maha:record:longevity-metabolism-p62-sqstm1-turnover',
    releaseId: 'epirelease_06f942051b6448b7a48e3a4ccd9a0876',
    targetSha256: 'sha256:ed83383369888b5e9940c582d112890a656b507536b84b62911d91265350de1b',
    canonicalPath: '/knowledge/longevity-metabolism/comparisons/longevity-metabolism-p62-sqstm1-turnover',
    assuranceTier: 'internally-reviewed-canonical',
  },
] as const

/**
 * Active, revision-matched records outside Batches 1 and 2 at the frozen
 * registry instant. They are release-aware candidates, but none is evidence
 * eligible. Keeping the list explicit prevents a future report from turning
 * an unreleased record into a candidate by inference.
 */
export const SUBSTANTIAL_BATCH_3_WITHHELD_ACTIVE_RECORD_IDS = [
  'urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium',
  'urn:maha:record:advanced-materials-graphene-hbn-heterostructures',
  'urn:maha:record:advanced-materials-moire-superlattices',
  'urn:maha:record:advanced-materials-twist-angle-control',
  'urn:maha:record:biomolecular-engineering-structure-prediction-filtering',
  'urn:maha:record:mechanistic-interpretability-representation-probing-boundary',
  'urn:maha:record:critical-supply-chains-high-purity-quartz-deposits',
  'urn:maha:record:critical-supply-chains-quartz-crucible-manufacturing',
  'urn:maha:record:critical-supply-chains-semiconductor-grade-polysilicon',
  'urn:maha:record:critical-supply-chains-euv-photoresist-precursors',
  'urn:maha:record:critical-supply-chains-photoacid-generator-supply',
] as const

export interface PublishedBatch3Page extends Omit<PublishedBatch2Page, 'publicationVersion' | 'publicationDate' | 'publicationDigest'> {
  publicationVersion: typeof SUBSTANTIAL_PUBLICATION_BATCH_3_VERSION
  publicationDate: typeof SUBSTANTIAL_PUBLICATION_BATCH_3_DATE
  replacesPublicationVersion: 'maha-substantial-publication/1.1' | null
  releaseEvidence: FrozenActiveRelease
  publicationDigest: string
}

const releaseCandidateById = new Map([
  ...EPISTEMIC_RECORDS.map((record) => [record.id, record] as const),
  ...REPAIRED_REVISION_CANARY_RECORDS.map((record) => [record.id, record] as const),
])

function publishReleaseMatched(release: FrozenActiveRelease): PublishedBatch3Page {
  const record = releaseCandidateById.get(release.recordId)
  if (!record) throw new Error(`${release.recordId}: no release candidate is frozen for Batch 3.`)
  const target = epistemicReviewTargetHash(record)
  if (target !== release.targetSha256) throw new Error(`${release.recordId}: active release does not match the compiled revision.`)
  if (epistemicRecordPath(record) !== release.canonicalPath) throw new Error(`${release.recordId}: active release path does not match the compiled route.`)

  const compiled = publishBatch2Record(record)
  if (!compiled.quality.eligible) throw new Error(`${release.recordId}: release-matched page failed the fresh substantial quality gate.`)
  const replacesPublicationVersion = SUBSTANTIAL_BATCH_2_PAGES.some((page) => page.contract.recordId === release.recordId)
    ? 'maha-substantial-publication/1.1' as const
    : null
  const withoutDigest = {
    ...compiled,
    publicationVersion: SUBSTANTIAL_PUBLICATION_BATCH_3_VERSION,
    publicationDate: SUBSTANTIAL_PUBLICATION_BATCH_3_DATE,
    replacesPublicationVersion,
    qualificationReason: `Active canonical release ${release.releaseId} matches exact revision ${release.targetSha256}; the repaired source is inspected, locator-bound, internally reviewed, and fresh substantial-page quality is eligible.`,
    releaseEvidence: release,
  }
  const { publicationDigest: _priorDigest, ...digestInput } = withoutDigest
  return {
    ...digestInput,
    publicationDigest: `sha256:${createHash('sha256').update(JSON.stringify(digestInput)).digest('hex')}`,
  }
}

export const SUBSTANTIAL_BATCH_3_PAGES: readonly PublishedBatch3Page[] = SUBSTANTIAL_BATCH_3_RELEASES.map(publishReleaseMatched)

export const SUBSTANTIAL_BATCH_3_WITHHELD = SUBSTANTIAL_BATCH_3_WITHHELD_ACTIVE_RECORD_IDS.map((recordId) => {
  const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)
  if (!record) throw new Error(`${recordId}: frozen release-aware candidate is absent from the canonical corpus.`)
  const blockers = alignmentBlockers(recordId)
  if (blockers.length === 0) throw new Error(`${recordId}: an alignment-clear active record was incorrectly withheld.`)
  return {
    recordId,
    domainSlug: record.domainSlug,
    currentRevisionSha256: epistemicReviewTargetHash(record),
    canonicalPath: epistemicRecordPath(record),
    blockers,
  }
})

if (SUBSTANTIAL_BATCH_3_PAGES.length !== 7) throw new Error('Batch 3 must bind exactly seven release-matched substantial contracts.')
if (new Set(SUBSTANTIAL_BATCH_3_PAGES.map((page) => page.contract.recordId)).size !== 7) throw new Error('Batch 3 contains duplicate records.')
if (SUBSTANTIAL_BATCH_3_WITHHELD.length !== 11) throw new Error('Batch 3 release-aware withheld pool drifted.')

export function getBatch3Page(recordId: string): PublishedBatch3Page | undefined {
  return SUBSTANTIAL_BATCH_3_PAGES.find((page) => page.contract.recordId === recordId)
}
