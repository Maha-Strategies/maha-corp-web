/** Credential-safe public job response helpers. */

import type { JobRecord } from '@/lib/jobs/queue'

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
    result: job.solution ? {
      objectiveValue: job.solution.objectiveValue,
      assignment: job.solution.assignment,
      bestBound: job.solution.bestBound,
      provenOptimal: job.solution.provenOptimal,
    } : null,
    diagnostics: job.diagnostics,
    error: job.error,
    timestamps: { createdAt: job.createdAt, updatedAt: job.updatedAt, expiresAt: job.expiresAt },
    problemStored: false,
    methodBoundary: 'Results above the exact threshold are heuristic: no optimality or certified-bound claim is made.',
  }
}
