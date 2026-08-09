import { MAHA_CONTEXT_RESOURCE, type BazaarResource } from './discovery-payment-recipe.ts'

export const CANARY_STALE_AFTER_DAYS = 21
const DAY_MS = 24 * 60 * 60 * 1_000
const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60 * 1_000

export type BazaarCanaryDecision = {
  shouldPay: boolean
  reason: 'listing_missing' | 'last_call_missing' | 'settlement_stale' | 'settlement_recent' | 'metadata_refresh_requested'
  lastCalledAt: string | null
  ageDays: number | null
}

/**
 * A recent settlement protects the listing from inactivity removal, but it
 * does not prove that Bazaar indexed the current declaration. A reviewed
 * manual workflow dispatch may therefore authorize one refresh settlement.
 * The caller still has to supply the normal payment flag and pass every
 * buyer, resource, price, network, asset, payee, balance, and receipt guard.
 */
export function applyManualMetadataRefresh(
  decision: BazaarCanaryDecision,
  requested: boolean,
): BazaarCanaryDecision {
  if (!requested) return decision
  return { ...decision, shouldPay: true, reason: 'metadata_refresh_requested' }
}

export function findContextCompiler(resources: BazaarResource[]): BazaarResource | null {
  return resources.find((resource) => resource.resource === MAHA_CONTEXT_RESOURCE) ?? null
}

/**
 * The scheduled job checks more often than it pays. Any real customer
 * settlement resets this clock, so the canary never competes with organic use.
 */
export function decideBazaarCanary(
  resource: BazaarResource | null,
  nowMs: number,
  staleAfterDays = CANARY_STALE_AFTER_DAYS,
): BazaarCanaryDecision {
  if (!Number.isFinite(nowMs)) throw new Error('The canary clock must be finite.')
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1 || staleAfterDays >= 30) {
    throw new Error('The canary threshold must be an integer from 1 through 29 days.')
  }
  if (!resource) {
    return { shouldPay: true, reason: 'listing_missing', lastCalledAt: null, ageDays: null }
  }

  const rawLastCalledAt = resource.quality?.lastCalledAt
  if (!rawLastCalledAt) {
    return { shouldPay: true, reason: 'last_call_missing', lastCalledAt: null, ageDays: null }
  }
  const lastCalledMs = Date.parse(rawLastCalledAt)
  if (!Number.isFinite(lastCalledMs)) {
    return { shouldPay: true, reason: 'last_call_missing', lastCalledAt: null, ageDays: null }
  }
  if (lastCalledMs > nowMs + FUTURE_CLOCK_TOLERANCE_MS) {
    throw new Error('Bazaar reported a last-call timestamp in the future; refusing to make a payment.')
  }

  const ageDays = Math.max(0, (nowMs - lastCalledMs) / DAY_MS)
  return {
    shouldPay: ageDays >= staleAfterDays,
    reason: ageDays >= staleAfterDays ? 'settlement_stale' : 'settlement_recent',
    lastCalledAt: new Date(lastCalledMs).toISOString(),
    ageDays: Number(ageDays.toFixed(3)),
  }
}
