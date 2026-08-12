import { CANARY_STALE_AFTER_DAYS } from './bazaar-canary.ts'
import type { BazaarResource } from './discovery-payment-recipe.ts'

/**
 * Bazaar removes a listing after 30 days without a settlement. The canary
 * exists to stay ahead of that for Context Compression; see
 * docs/production-x402-canary.md.
 */
export const BAZAAR_REMOVAL_AFTER_DAYS = 30

/**
 * Lead times, expressed as days of margin left rather than days elapsed.
 *
 * `warn` is a fortnight of margin: enough for a human to notice, get an
 * authorization, and dispatch a refresh without the request becoming urgent.
 * `urgent` is a working week, which is the point at which waiting for the next
 * scheduled check is no longer safe.
 *
 * Both are margins, not deadlines. An offer the canary covers should never
 * reach `urgent` on its own -- the canary settles at
 * CANARY_STALE_AFTER_DAYS, leaving more margin than `urgent` allows -- so an
 * automated offer in that band means the automation is broken, which is a
 * different and more serious report than the same band on a manual offer.
 */
export const INACTIVITY_WARN_DAYS_REMAINING = 14
export const INACTIVITY_URGENT_DAYS_REMAINING = 7

const DAY_MS = 24 * 60 * 60 * 1_000
const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60 * 1_000

export type InactivityLevel = 'ok' | 'warn' | 'urgent' | 'unknown'

export type OfferInactivity = {
  offerId: string
  resource: string
  level: InactivityLevel
  /** Why the level was assigned, for an alert a human reads once and acts on. */
  reason:
    | 'listing_missing'
    | 'last_call_missing'
    | 'within_margin'
    | 'margin_low'
    | 'margin_critical'
    | 'automation_should_have_fired'
  lastCalledAt: string | null
  ageDays: number | null
  daysRemaining: number | null
  totalCallsL30Days: number | null
  uniquePayersL30Days: number | null
  /** True when the scheduled canary settles this offer without a human. */
  coveredByCanary: boolean
}

export type InactivityWatchInput = {
  offerId: string
  resource: string
  coveredByCanary: boolean
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Read-only. Deliberately returns a report rather than a decision: nothing
 * here may settle, and an offer with no automatic coverage must escalate to a
 * human instead of quietly buying its own listing back.
 */
export function assessOfferInactivity(
  offer: InactivityWatchInput,
  resource: BazaarResource | null,
  nowMs: number,
  removalAfterDays = BAZAAR_REMOVAL_AFTER_DAYS,
): OfferInactivity {
  if (!Number.isFinite(nowMs)) throw new Error('The inactivity clock must be finite.')
  if (!Number.isInteger(removalAfterDays) || removalAfterDays < 1) {
    throw new Error('The removal threshold must be a positive whole number of days.')
  }

  const base = {
    offerId: offer.offerId,
    resource: offer.resource,
    coveredByCanary: offer.coveredByCanary,
    lastCalledAt: null,
    ageDays: null,
    daysRemaining: null,
    totalCallsL30Days: null,
    uniquePayersL30Days: null,
  } as const

  // A listing that is absent is not a listing that is fresh. Reporting `ok`
  // because there is no timestamp to be old is how a delisted offer stays
  // green until someone happens to search for it.
  if (!resource) return { ...base, level: 'unknown', reason: 'listing_missing' }

  const totalCallsL30Days = numberOrNull(resource.quality?.l30DaysTotalCalls)
  const uniquePayersL30Days = numberOrNull(resource.quality?.l30DaysUniquePayers)
  const counts = { totalCallsL30Days, uniquePayersL30Days }

  const raw = resource.quality?.lastCalledAt
  const lastCalledMs = raw ? Date.parse(raw) : Number.NaN
  if (!Number.isFinite(lastCalledMs)) {
    return { ...base, ...counts, level: 'unknown', reason: 'last_call_missing' }
  }
  if (lastCalledMs > nowMs + FUTURE_CLOCK_TOLERANCE_MS) {
    return { ...base, ...counts, level: 'unknown', reason: 'last_call_missing' }
  }

  const ageDays = Math.max(0, (nowMs - lastCalledMs) / DAY_MS)
  const daysRemaining = removalAfterDays - ageDays
  const observed = {
    ...base,
    ...counts,
    lastCalledAt: new Date(lastCalledMs).toISOString(),
    ageDays: Number(ageDays.toFixed(3)),
    daysRemaining: Number(daysRemaining.toFixed(3)),
  }

  if (daysRemaining <= INACTIVITY_URGENT_DAYS_REMAINING) {
    return {
      ...observed,
      level: 'urgent',
      // An offer the canary covers cannot legitimately get this old, so the
      // finding is about the canary rather than about the listing.
      reason: offer.coveredByCanary && ageDays >= CANARY_STALE_AFTER_DAYS
        ? 'automation_should_have_fired'
        : 'margin_critical',
    }
  }
  if (daysRemaining <= INACTIVITY_WARN_DAYS_REMAINING) {
    return { ...observed, level: 'warn', reason: 'margin_low' }
  }
  return { ...observed, level: 'ok', reason: 'within_margin' }
}

export function findBazaarResource(
  resources: BazaarResource[],
  resource: string,
): BazaarResource | null {
  return resources.find((candidate) => candidate.resource === resource) ?? null
}

const RANK: Record<InactivityLevel, number> = { ok: 0, unknown: 1, warn: 2, urgent: 3 }

/** The worst level present, so one exit code can speak for every offer. */
export function worstLevel(reports: readonly OfferInactivity[]): InactivityLevel {
  return reports.reduce<InactivityLevel>(
    (worst, report) => (RANK[report.level] > RANK[worst] ? report.level : worst),
    'ok',
  )
}
