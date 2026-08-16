/**
 * Outcome records: append-only observations against a locked registration.
 *
 * Two rules carry the integrity of this stage. An outcome cannot be recorded
 * against anything that is not already registered, and once recorded it cannot
 * be changed — there is no update or delete path anywhere in this module, in
 * the store, or in the API surface, and the table revokes both from the service
 * role so a future handler cannot quietly acquire one.
 *
 * The raw payload from the system of record is deliberately not retained. A
 * digest proves the recorded value came from that payload without the registry
 * accumulating third-party telemetry it has no need to hold.
 */

import { digestOf, isExplicitUtcInstant, sha256Hex } from './canonical.ts'
import type { ExperimentRegistration, OutcomeMetric, OutcomeRecord } from './types.ts'

export class OutcomeRejected extends Error {
  readonly issues: string[]
  constructor(issues: string[]) {
    super(`Outcome rejected: ${issues.length} issue(s).`)
    this.name = 'OutcomeRejected'
    this.issues = issues
  }
}

export interface BuildOutcomeOptions {
  /** Route handlers pass server time so future-dated retrievals fail closed. */
  now?: () => Date
}

export interface OutcomeSubmission {
  idempotencyKey: string
  /** Value in the metric's declared unit. */
  value: number
  observedAtUtc: string
  retrievedAtUtc: string
  dataSourceId: string
  /**
   * The payload as retrieved. Hashed and discarded — never stored, never
   * echoed back, and not retained on this object beyond the call.
   */
  rawPayload: unknown
}

function validateAgainstMetric(submission: OutcomeSubmission, metric: OutcomeMetric, issues: string[]): void {
  if (!Number.isFinite(submission.value)) {
    issues.push('value must be a finite number.')
    return
  }
  if (metric.kind === 'binary' && submission.value !== 0 && submission.value !== 1) {
    issues.push('A binary metric accepts only 0 or 1.')
  }
  if (metric.kind === 'count' && (!Number.isInteger(submission.value) || submission.value < 0)) {
    issues.push('A count metric accepts only non-negative integers.')
  }
  if (metric.kind === 'duration-seconds' && submission.value < 0) issues.push('A duration cannot be negative.')
  if (metric.kind === 'ratio' && (submission.value < 0 || submission.value > 1)) issues.push('A ratio must lie in [0, 1].')
  if (metric.kind === 'currency-minor-units' && !Number.isInteger(submission.value)) {
    issues.push('A currency amount must be an integer number of minor units.')
  }
  if (submission.dataSourceId !== metric.dataSourceId) {
    issues.push(`Outcome dataSourceId "${submission.dataSourceId}" does not match the registered system of record "${metric.dataSourceId}".`)
  }
}

/**
 * Builds an outcome record for a registered experiment.
 *
 * Throws when the experiment is not registered — the lifecycle gate lives here
 * as well as in the database, so a caller that bypasses the API still cannot
 * attach an observation to a draft.
 */
export function buildOutcomeRecord(
  registration: ExperimentRegistration,
  submission: OutcomeSubmission,
  options: BuildOutcomeOptions = {},
): OutcomeRecord {
  const issues: string[] = []

  if (registration.status === undefined) issues.push('An outcome requires a registered experiment.')
  if (!submission.idempotencyKey || submission.idempotencyKey.trim().length < 8 || submission.idempotencyKey.length > 200) {
    issues.push('idempotencyKey must be between 8 and 200 characters.')
  }
  if (!isExplicitUtcInstant(submission.observedAtUtc)) issues.push('observedAtUtc must be an explicit UTC instant ending in Z.')
  if (!isExplicitUtcInstant(submission.retrievedAtUtc)) issues.push('retrievedAtUtc must be an explicit UTC instant ending in Z.')
  if (!submission.dataSourceId?.trim()) issues.push('dataSourceId is required.')
  if (submission.rawPayload === undefined) issues.push('rawPayload is required so its digest can be recorded.')

  validateAgainstMetric(submission, registration.draft.metric, issues)

  if (isExplicitUtcInstant(submission.observedAtUtc)) {
    // An observation predating the registration would mean the outcome was
    // knowable when the plan was locked, which is the failure a
    // pre-registration exists to prevent.
    if (new Date(submission.observedAtUtc) < new Date(registration.registeredAtUtc)) {
      issues.push('observedAtUtc precedes the registration; a pre-registered test cannot measure an outcome that already existed.')
    }
    if (new Date(submission.observedAtUtc) < new Date(registration.draft.actionWindowStartUtc)) {
      issues.push('observedAtUtc precedes the declared action window; the measured outcome must follow the action under test.')
    }
  }

  if (isExplicitUtcInstant(submission.observedAtUtc) && isExplicitUtcInstant(submission.retrievedAtUtc)) {
    if (new Date(submission.retrievedAtUtc) < new Date(submission.observedAtUtc)) {
      issues.push('retrievedAtUtc must be at or after observedAtUtc.')
    }
    const now = options.now?.()
    if (now && new Date(submission.retrievedAtUtc).getTime() > now.getTime() + 5 * 60_000) {
      issues.push('retrievedAtUtc cannot be in the future relative to registry server time.')
    }
  }

  if (issues.length > 0) throw new OutcomeRejected(issues)

  const rawValueSha256 = sha256Hex(JSON.stringify(submission.rawPayload))
  const core = {
    experimentId: registration.experimentId,
    idempotencyKey: submission.idempotencyKey,
    value: submission.value,
    observedAtUtc: submission.observedAtUtc,
    retrievedAtUtc: submission.retrievedAtUtc,
    dataSourceId: submission.dataSourceId,
    rawValueSha256,
    registrationSha256: registration.registrationSha256,
  }

  return { ...core, outcomeSha256: digestOf(core) }
}

/** True when the horizon declared on the metric has fully elapsed. */
export function horizonComplete(registration: ExperimentRegistration, now: Date): boolean {
  const windowEnd = new Date(registration.draft.actionWindowEndUtc).getTime()
  const horizonMs = registration.draft.metric.horizonHours * 3_600_000
  return now.getTime() >= windowEnd + horizonMs
}
