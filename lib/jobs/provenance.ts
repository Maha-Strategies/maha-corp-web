/** Credential-safe public job response helpers. */

import type { JobRecord } from '@/lib/jobs/queue'
import type { BinaryOptimizationSolution } from '@/lib/jobs/contract'

export function jobResponseHeaders(input: { zeroDataRetention: boolean; creditsRemaining?: number | null }) {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'X-Maha-API-Mode': 'live',
    'x-maha-zero-data-retention': String(input.zeroDataRetention),
  }
  if (typeof input.creditsRemaining === 'number') headers['x-maha-credits-remaining'] = String(input.creditsRemaining)
  return headers
}

export function publicJobView(job: JobRecord) {
  const binary = job.kind !== 'geometric-registration' && job.solution ? job.solution as BinaryOptimizationSolution : null
  return {
    jobId: job.jobId,
    kind: job.kind,
    status: job.status,
    clientRequestId: job.clientRequestId,
    inputHash: job.inputHash,
    acceptedConfiguration: { formulation: job.formulation, problemSize: job.problemSize, target: job.target },
    credits: {
      reserved: job.reservedCredits,
      charged: job.creditsCharged,
      refunded: job.status === 'failed' || job.status === 'cancelled' ? job.reservedCredits : 0,
    },
    result: binary ? { objectiveValue: binary.objectiveValue, assignment: binary.assignment, bestBound: binary.bestBound, provenOptimal: binary.provenOptimal } : job.solution,
    diagnostics: job.diagnostics,
    error: job.error,
    timestamps: { createdAt: job.createdAt, updatedAt: job.updatedAt, expiresAt: job.expiresAt },
    problemStored: false,
    methodBoundary: job.kind === 'geometric-registration'
      ? 'The Kabsch result is the weighted least-squares rigid transform for paired points; correspondence search and non-rigid deformation are outside this contract.'
      : 'Results above the exact threshold are heuristic: no optimality or certified-bound claim is made.',
  }
}
