// Every paid path fails closed: its config function returns null when a
// variable is missing or its flag is off, and the surface quietly stops
// offering checkout. That is correct behaviour for a deliberate shutdown and
// invisible failure for an accidental one — a half-wired path and a path that
// was never meant to be live look identical from outside.
//
// This reports the difference. It reads variable NAMES only; no value, prefix,
// or length is ever included in the output.
//
// It deliberately does NOT feed the four release-health checks. Those gate the
// last-known-good manifest that rollback depends on, and configuration drift
// must never be able to withhold the recovery path.

import type { ReadinessState } from './billing-readiness.ts'

export type RevenuePathState =
  | 'ready'                  // enabled and fully configured
  | 'disabled'               // deliberately off: flag off and nothing wired
  | 'configured_not_enabled' // fully wired but the flag was never turned on
  | 'incomplete'             // partially wired: someone started and stopped
  | 'enabled_incomplete'     // flag on but variables missing: it cannot transact

export type SuspectedTypo = { expected: string; found: string }

export type RevenuePathReadiness = {
  id: string
  label: string
  state: RevenuePathState
  enabled: boolean | null
  missing: string[]
  suspectedTypos: SuspectedTypo[]
}

export type RevenueReadinessReport = {
  generatedAt: string
  readOnly: true
  state: ReadinessState
  paths: RevenuePathReadiness[]
  faults: string[]
}

type Environment = Record<string, string | undefined>

type RevenuePath = {
  id: string
  label: string
  /** Absent when the path has no explicit enable flag and is live once configured. */
  flag?: string
  /** Variables belonging to this path alone. Their presence is what proves intent. */
  specific: string[]
  /** Platform credentials several paths share. Never evidence that this path was being wired. */
  shared: string[]
}

// Mirrors the config gates in books.ts, mps-credits.ts, utility-billing.ts, and
// the preflight and API-credit checkout routes. Keep in step with them.
export const REVENUE_PATHS: readonly RevenuePath[] = [
  {
    id: 'api_credit_packs',
    label: 'Developer Portal API credit packs',
    specific: ['STRIPE_API_KEY_WEBHOOK_SECRET', 'STRIPE_API_CREDITS_STARTER_PRICE_ID', 'STRIPE_API_CREDITS_PRO_PRICE_ID', 'STRIPE_API_CREDITS_ENTERPRISE_PRICE_ID'],
    shared: ['STRIPE_SECRET_KEY'],
  },
  {
    id: 'mps_audit_credits',
    label: 'Prepaid MPS audit credits',
    flag: 'MPS_AUDIT_CREDIT_CHECKOUT_ENABLED',
    specific: ['STRIPE_MPS_AUDIT_CREDIT_PRICE_ID', 'STRIPE_MPS_CREDITS_WEBHOOK_SECRET', 'MPS_AUDIT_CREDIT_PACK_UNITS'],
    shared: ['STRIPE_SECRET_KEY'],
  },
  {
    id: 'books',
    label: 'Book purchases',
    flag: 'BOOK_CHECKOUT_ENABLED',
    specific: ['STRIPE_BOOKS_WEBHOOK_SECRET', 'STRIPE_BOOK_PRICE_MAP'],
    shared: ['STRIPE_SECRET_KEY'],
  },
  {
    id: 'utilities',
    label: 'Paid utilities',
    flag: 'UTILITY_CHECKOUT_ENABLED',
    specific: ['STRIPE_UTILITY_WEBHOOK_SECRET', 'STRIPE_UTILITY_PRICE_MAP'],
    shared: ['STRIPE_SECRET_KEY'],
  },
  {
    id: 'mps_preflight',
    label: 'MPS Preflight',
    specific: ['STRIPE_MPS_PREFLIGHT_PRICE_ID', 'STRIPE_WEBHOOK_SECRET', 'MPS_PREFLIGHT_FROM_EMAIL'],
    shared: ['STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'ANTHROPIC_API_KEY'],
  },
]

/** A path in one of these states cannot be trusted to transact. */
const FAULT_STATES = new Set<RevenuePathState>(['incomplete', 'enabled_incomplete'])

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim().replace(/^["']|["']$/g, ''))
}

/** Bounded edit distance; returns early once the budget is exceeded. */
function withinEditDistance(a: string, b: string, budget: number): boolean {
  if (Math.abs(a.length - b.length) > budget) return false
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let best = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
      best = Math.min(best, current[j])
    }
    if (best > budget) return false
    previous = current
  }
  return previous[b.length] <= budget
}

const KNOWN = new Set(REVENUE_PATHS.flatMap((path) => [...path.specific, ...path.shared, ...(path.flag ? [path.flag] : [])]))

/**
 * A variable set under a near-miss name is indistinguishable from one that was
 * never set: the path fails closed either way. This is the failure that
 * actually occurred here — MPS_PREFLIGHT_FROM_EMAI, missing its final L.
 */
export function findSuspectedTypos(missing: readonly string[], environment: Environment): SuspectedTypo[] {
  const candidates = Object.keys(environment).filter((key) => !KNOWN.has(key) && key.length >= 8 && configured(environment[key]))
  const typos: SuspectedTypo[] = []
  for (const expected of missing) {
    for (const found of candidates) {
      if (found !== expected && withinEditDistance(expected, found, 2)) typos.push({ expected, found })
    }
  }
  return typos
}

export function inspectRevenuePath(path: RevenuePath, environment: Environment): RevenuePathReadiness {
  const missing = [...path.specific, ...path.shared].filter((name) => !configured(environment[name]))
  // Only path-specific variables evidence intent. A shared Stripe key is set
  // for every other path anyway and says nothing about this one.
  const specificPresent = path.specific.filter((name) => configured(environment[name])).length
  const enabled = path.flag ? environment[path.flag]?.trim() === 'true' : null
  const complete = missing.length === 0

  let state: RevenuePathState
  if (complete && enabled !== false) state = 'ready'
  else if (complete) state = 'configured_not_enabled'
  else if (enabled) state = 'enabled_incomplete'
  // Nothing of its own wired and switched off is a clean, deliberate shutdown.
  // Anything partially wired is someone having stopped halfway.
  else if (specificPresent === 0 && enabled === false) state = 'disabled'
  else state = 'incomplete'

  return {
    id: path.id,
    label: path.label,
    state,
    enabled,
    missing,
    suspectedTypos: missing.length ? findSuspectedTypos(missing, environment) : [],
  }
}

export function getRevenueReadiness(environment: Environment = process.env): RevenueReadinessReport {
  const paths = REVENUE_PATHS.map((path) => inspectRevenuePath(path, environment))
  const faults = paths.filter((path) => FAULT_STATES.has(path.state)).map((path) => path.id)
  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    state: faults.length === 0 ? 'ready' : 'degraded',
    paths,
    faults,
  }
}
