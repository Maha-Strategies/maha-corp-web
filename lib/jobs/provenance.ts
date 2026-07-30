/**
 * Response envelope for job endpoints: headers, citations, and claim records.
 *
 * The v1 mock returned citations alongside a fabricated result. Now that the
 * results are real the citations matter more, not less — a measured objective
 * value invites exactly the extrapolation ("tensor networks beat annealers")
 * that tn-014 records as unestablished. The boundary travels with the payload
 * for the same reason the atlas keeps limitations attached to claims.
 */

import { TENSOR_NETWORKS_ATLAS_URL, tensorNetworkClaims } from '@/lib/atlas/tensor-networks'
import type { JobRecord } from '@/lib/jobs/queue'

/** Claims cited by every tensor-opt job response. */
const TENSOR_OPT_CITED_CLAIMS = ['tn-004', 'tn-007', 'tn-008', 'tn-014'] as const

export type JobCitation = {
  claimId: string
  url: string
  role: 'method-basis' | 'result-boundary'
  statement: string
  boundary: string
  verificationBoundary: 'research-node'
}

export function tensorOptCitations(): JobCitation[] {
  return TENSOR_OPT_CITED_CLAIMS.map((claimId) => {
    const claim = tensorNetworkClaims.find((candidate) => candidate.id === claimId)
    if (!claim) throw new Error(`Cited claim ${claimId} is missing from the tensor-network atlas module.`)
    return {
      claimId: claim.id,
      url: `${TENSOR_NETWORKS_ATLAS_URL}/claims/${claim.id}`,
      role: claim.status === 'boundary-record' ? 'result-boundary' : 'method-basis',
      statement: claim.statement,
      boundary: claim.boundary,
      verificationBoundary: 'research-node',
    }
  })
}

/**
 * Response headers for every job route.
 *
 * `x-maha-zero-data-retention` reports what actually happened to this job's
 * data, read from the job record rather than re-derived from the request — the
 * retention decision was made at enqueue, and a header that recomputed it could
 * disagree with the storage that already occurred.
 */
export function jobResponseHeaders(input: { zeroDataRetention: boolean; creditsRemaining?: number | null }) {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'X-Maha-API-Mode': 'live',
    'x-maha-zero-data-retention': String(input.zeroDataRetention),
    'X-Maha-Atlas-Ledger': TENSOR_NETWORKS_ATLAS_URL,
  }
  if (typeof input.creditsRemaining === 'number') headers['x-maha-credits-remaining'] = String(input.creditsRemaining)
  return headers
}

/**
 * Public view of a job.
 *
 * Deliberately omits `keyId` and the problem terms. The terms are never stored
 * for a zero-data-retention key and are not echoed for any key: a polling
 * endpoint that replayed the problem back would turn every job record into a
 * second copy of customer data with a different retention lifetime.
 */
export function publicJobView(job: JobRecord) {
  return {
    jobId: job.jobId,
    kind: job.kind,
    status: job.status,
    clientRequestId: job.clientRequestId,
    inputHash: job.inputHash,
    acceptedConfiguration: {
      formulation: job.formulation,
      problemSize: job.problemSize,
      target: job.target,
    },
    credits: {
      reserved: job.reservedCredits,
      charged: job.creditsCharged,
      // Stated explicitly so a caller reading a `failed` job is not left to
      // infer whether they paid for it.
      refunded: job.status === 'failed' || job.status === 'cancelled' ? job.reservedCredits : 0,
    },
    result: job.solution
      ? {
          objectiveValue: job.solution.objectiveValue,
          assignment: job.solution.assignment,
          bestBound: job.solution.bestBound,
          provenOptimal: job.solution.provenOptimal,
        }
      : null,
    diagnostics: job.diagnostics,
    error: job.error,
    timestamps: { createdAt: job.createdAt, updatedAt: job.updatedAt, expiresAt: job.expiresAt },
    sourceTextStored: !job.zeroDataRetention,
    citations: tensorOptCitations(),
  }
}
