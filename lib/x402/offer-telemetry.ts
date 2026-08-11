import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { offerFor, type X402Offer } from './offers.ts'

// Records that an x402 offer was probed or invoked, and nothing about what was
// in the request. The routes answer sourceTextStored:false and that stays
// true: this sees an offer id, an event kind, a status class, a coarse
// discovery category, and the compiler's own token estimates.
//
// This replaces the Context Compiler-specific meter for the x402 surface. The
// old one had no offer column, so three offers would have summed into one
// series and made the existing numbers wrong retroactively rather than merely
// incomplete.

export type OfferEventKind = 'challenge' | 'invocation'

/**
 * Coarse, allowlisted, and treated as a claim rather than a fact.
 *
 * Attribution here is entirely self-declared: a caller writes its own
 * User-Agent and its own Referer, and either can be set to anything. So the
 * category is stored and the evidence is not -- no raw User-Agent string, no
 * IP address, no unrestricted referrer URL ever reaches the database. Anything
 * unrecognised is `unknown`, which is honest, rather than being retained
 * verbatim in the hope of classifying it later.
 */
export type DiscoverySource = 'bazaar' | 'maha_canary' | 'direct' | 'unknown'

const ALLOWED_SOURCES: readonly DiscoverySource[] = ['bazaar', 'maha_canary', 'direct', 'unknown']

/**
 * Classifies a request into one of four buckets without retaining the evidence.
 *
 * Matching is deliberately narrow. A broad substring match on "bot" or "agent"
 * would classify most of the internet as one thing, and the resulting series
 * would look precise while meaning nothing.
 */
export function discoverySourceFrom(headers: Headers): DiscoverySource {
  const agent = (headers.get('user-agent') ?? '').toLowerCase()
  if (agent.includes('maha-canary')) return 'maha_canary'
  if (agent.includes('x402-bazaar') || agent.includes('bazaar-crawler')) return 'bazaar'

  // Only the referrer's host is inspected, and only to bucket it. The full URL
  // can carry a path and query the caller did not intend to disclose, so it is
  // never read past the origin and never stored in any form.
  const referrer = headers.get('referer') ?? ''
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase()
      if (host.endsWith('bazaar.x402.org') || host.endsWith('x402.org')) return 'bazaar'
      if (host.endsWith('mahastrategies.com')) return 'direct'
    } catch {
      // An unparseable referrer is not evidence of anything.
    }
  }
  return 'unknown'
}

export const statusClassOf = (status: number): '2xx' | '4xx' | '5xx' =>
  status >= 500 ? '5xx' : status >= 400 ? '4xx' : '2xx'

/**
 * Whether the proxy should record a challenge for this request.
 *
 * Challenges are the only proxy outcome recorded, and the reasoning is the
 * same as it was for the single-offer meter. A challenge terminates in the
 * proxy and never reaches a route, so the route's wrapper cannot see it, and
 * it is the denominator of the only question this exists to answer: did agents
 * find the offer and decline, or never find it at all.
 *
 * Refusals are excluded. A replayed payment, a resource at capacity, or an
 * unreadable ledger all occur *after* a payment was presented; counting them
 * in a pre-payment denominator would understate conversion by exactly the
 * number of things that went wrong later.
 *
 * Paid admissions are excluded for the opposite reason: they reach the route,
 * which records them as invocations. Counting them here as well would
 * double-count every settlement -- which is why the two event kinds are
 * written from two places that share no code path.
 */
export function offerChallengeFor(method: string, pathname: string, outcomeKind: string): X402Offer | undefined {
  if (outcomeKind !== 'challenge') return undefined
  return offerFor(method, pathname)
}

type UsageLedger = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> }

export type OfferUsageInput = {
  offerId: string
  eventKind: OfferEventKind
  status: number
  discoverySource?: DiscoverySource
  inputTokens?: number
  outputTokens?: number
  tokensSaved?: number
  requiredEvidenceCount?: number
  retainedEvidenceCount?: number
  ledger?: UsageLedger | null
}

const whole = (value: number | undefined): number => Math.max(0, Math.round(value ?? 0))

/**
 * Never throws and never delays the response.
 *
 * Metering is not worth a failed request: this runs after the response body
 * exists, and a broken meter degrades a dashboard rather than the product.
 */
export async function recordOfferUsage(input: OfferUsageInput): Promise<void> {
  try {
    const ledger = input.ledger !== undefined ? input.ledger : createAgentInquiryLedger()
    if (!ledger) return
    const source = input.discoverySource && ALLOWED_SOURCES.includes(input.discoverySource)
      ? input.discoverySource
      : 'unknown'
    const { error } = await ledger.rpc('record_x402_offer_usage', {
      p_offer_id: input.offerId,
      p_event_kind: input.eventKind,
      p_status_class: statusClassOf(input.status),
      p_discovery_source: source,
      p_input_tokens: whole(input.inputTokens),
      p_output_tokens: whole(input.outputTokens),
      p_tokens_saved: whole(input.tokensSaved),
      p_required_evidence: whole(input.requiredEvidenceCount),
      p_retained_evidence: whole(input.retainedEvidenceCount),
    })
    if (error) console.error('x402 offer usage meter failed for', input.offerId)
  } catch {
    // Deliberately silent beyond the log above: a metering outage must not
    // surface to a paying caller.
  }
}

export type RepeatPayerRow = {
  payer: string
  resource: string
  /** Settlements the chain corroborated. The only number that is a purchase. */
  confirmedPaymentCount: number
  /** Settled but not corroborated: no chain RPC, or the node could not answer. */
  unconfirmedPaymentCount: number
  /** Claimed but never settled, or contradicted by the chain. */
  failedPaymentCount: number
  firstConfirmedAt: string | null
  lastConfirmedAt: string | null
}

export type RepeatPayerReport = {
  /** One row per (payer, resource). */
  rows: RepeatPayerRow[]
  /** Distinct wallets with at least one confirmed purchase. */
  distinctPayers: number
  /** Wallets that confirmed more than one purchase of the same resource. */
  returningPayers: number
  /**
   * Confirmed settlements in the window.
   *
   * The transaction count, and deliberately not the wallet count. A challenge
   * is answered per call, so conversion has to be measured in the same unit on
   * both sides; five settlements from one payer is a very different business
   * from five payers, and reporting the wallet count as the transaction count
   * would flatter the second into looking like the first.
   */
  settlements: number
  /**
   * Attempts that were claimed but not confirmed.
   *
   * Reported rather than folded in. An earlier version counted every row in
   * x402_payments as a purchase, so a claim that failed to settle -- or that
   * the chain contradicted -- inflated the very number a subscription decision
   * would rest on. Surfacing them separately keeps that visible instead of
   * either overstating revenue or silently reporting zero on a deployment with
   * no chain RPC configured.
   */
  unconfirmed: number
  failed: number
}

/**
 * Repeat autonomous purchases, read from confirmed settlements.
 *
 * x402_settlements is the authoritative record here, not x402_payments and not
 * agent_task_spend_daily. That last one is worth naming explicitly because it
 * is the tempting join: it has spend, it has surfaces, and it is already wired
 * into the funnel. It is also keyed by tenant and task, neither of which an
 * anonymous x402 wallet has, so joining through it silently drops the entire
 * population being counted and returns a confident zero.
 *
 * API-key repeat use is a different question with a different source --
 * credential usage in the commercial meters -- and the two must not be summed.
 */
export async function repeatPayers(
  window: { fromDay: string; toDay: string },
  ledger?: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> } | null,
): Promise<RepeatPayerReport | null> {
  const client = ledger !== undefined ? ledger : createAgentInquiryLedger() as unknown as NonNullable<typeof ledger>
  if (!client) return null
  const { data, error } = await client.rpc('x402_repeat_payers', { p_from_day: window.fromDay, p_to_day: window.toDay })
  if (error || !Array.isArray(data)) return null

  const rows: RepeatPayerRow[] = data.map((row) => {
    const record = row as Record<string, unknown>
    return {
      payer: String(record.payer ?? ''),
      resource: String(record.resource ?? ''),
      confirmedPaymentCount: Number(record.confirmed_payment_count ?? 0),
      unconfirmedPaymentCount: Number(record.unconfirmed_payment_count ?? 0),
      failedPaymentCount: Number(record.failed_payment_count ?? 0),
      firstConfirmedAt: record.first_confirmed_at ? String(record.first_confirmed_at) : null,
      lastConfirmedAt: record.last_confirmed_at ? String(record.last_confirmed_at) : null,
    }
  })

  // A payer with zero confirmed purchases is not a buyer, however many
  // attempts it made.
  const buyers = rows.filter((row) => row.confirmedPaymentCount > 0)

  return {
    rows,
    distinctPayers: new Set(buyers.map((row) => row.payer)).size,
    returningPayers: new Set(buyers.filter((row) => row.confirmedPaymentCount > 1).map((row) => row.payer)).size,
    settlements: buyers.reduce((total, row) => total + row.confirmedPaymentCount, 0),
    unconfirmed: rows.reduce((total, row) => total + row.unconfirmedPaymentCount, 0),
    failed: rows.reduce((total, row) => total + row.failedPaymentCount, 0),
  }
}
