/**
 * Credit pricing for optimization jobs.
 *
 * Kept in its own module, free of Redis and route imports, so the price a
 * customer is quoted can be unit-tested without standing up Upstash. Pricing
 * that is awkward to test is pricing that gets changed without verification.
 */

import type { JobKind } from '@/lib/jobs/contract'

/**
 * Price is quoted at enqueue from the DECLARED problem size and does not move
 * afterwards.
 *
 * Billing on measured device-seconds was the alternative and was rejected: the
 * caller cannot see the price until the work is already done, and a solver that
 * spins becomes a bill nobody authorized. The device-seconds a worker reports
 * are still recorded for metering — they just do not move the charge.
 */
const JOB_PRICING: Record<JobKind, { base: number; perThousandVariables: number }> = {
  'qubo-ising': { base: 500, perThousandVariables: 25 },
}

export function quoteJobCredits(kind: JobKind, problemSize: number): number {
  const pricing = JOB_PRICING[kind]
  return pricing.base + Math.ceil(problemSize / 1000) * pricing.perThousandVariables
}

export function jobPricingTable() {
  return Object.entries(JOB_PRICING).map(([kind, pricing]) => ({ kind, ...pricing }))
}
