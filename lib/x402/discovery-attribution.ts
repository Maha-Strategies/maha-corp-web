import { createHash } from 'node:crypto'
import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { OPERATOR_WALLETS, MAHA_PAYEE } from './discovery-payment-recipe.ts'
import { USDC_NETWORKS } from './networks.ts'

export const DISCOVERY_SOURCES = ['bazaar', 'maha_canary', 'direct', 'reddit', 'alsp', 'nohumans', 'tanod', 'nsgoods', 'unknown'] as const
export type ClaimedDiscoverySource = typeof DISCOVERY_SOURCES[number]
export const ATTRIBUTION_RETENTION_DAYS = 90
export const claimedDiscoverySource = (value: string | null | undefined): ClaimedDiscoverySource =>
  DISCOVERY_SOURCES.includes(value as ClaimedDiscoverySource) ? value as ClaimedDiscoverySource : 'unknown'
/** Caller-controlled label only. Never a customer identity, security signal, or commission entitlement. */
export function explicitDiscoverySource(headers: Headers): ClaimedDiscoverySource | undefined {
  if (!headers.has('X-Maha-Discovery-Source')) return undefined
  return claimedDiscoverySource(headers.get('X-Maha-Discovery-Source'))
}
export type PurchaseAttribution = {
  offerId: string; paymentId: string; payer: string; network: string; amount: string;
  transaction: string | null; source: ClaimedDiscoverySource;
  settlement: 'unknown' | 'confirmed'; responsePrepared: boolean; replayed: boolean
}
type Ledger = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ error: unknown }> }
/** Private receipt-linked accounting; no input, signature, recovery secret, IP or referrer. */
export async function recordPurchaseAttribution(input: PurchaseAttribution, injected?: Ledger | null) {
  try {
    if (!/^[a-z0-9-]{1,80}$/.test(input.offerId) || !/^[\da-f]{64}$/.test(input.paymentId)
      || !/^0x[\da-f]{40}$/i.test(input.payer) || !Object.hasOwn(USDC_NETWORKS, input.network)
      || !/^[1-9]\d{0,8}$/.test(input.amount) || !['unknown', 'confirmed'].includes(input.settlement)
      || (input.settlement === 'confirmed' && !/^0x[\da-f]{64}$/i.test(input.transaction ?? ''))
      || (input.settlement === 'unknown' && (input.transaction !== null || input.responsePrepared))) return
    const ledger = injected !== undefined ? injected : createAgentInquiryLedger()
    if (!ledger) return
    const payer = input.payer.toLowerCase()
    // Deterministic pseudonym, not anonymity: a known public address can be matched.
    const payerKey = createHash('sha256').update('maha-discovery-payer/1\n' + input.network + '\n' + payer).digest('hex')
    await ledger.rpc('record_x402_purchase_attribution', { p_offer_id: input.offerId, p_payment_id: input.paymentId,
      p_network: input.network, p_payer_key: payerKey, p_amount: input.amount,
      p_transaction: input.transaction?.toLowerCase() ?? null, p_source: claimedDiscoverySource(input.source),
      p_settlement: input.settlement, p_response_prepared: input.responsePrepared, p_replayed: input.replayed,
      p_operator: [...OPERATOR_WALLETS, MAHA_PAYEE].some(address => address.toLowerCase() === payer) })
  } catch { /* Accounting cannot withhold a paid response; unavailable is not zero. */ }
}

export type AttributionRow = { offer_id: string; payment_id: string; network: string; payer_key: string;
  discovery_source: string; settlement_state: string; response_prepared: boolean; operator_activity: boolean }
/** Unique authorizations, not requests. A recovery response never becomes another purchase. */
export function summarizePurchaseAttribution(rows: readonly AttributionRow[]) {
  const seen = new Set<string>(), buyers = new Map<string, number>()
  const sources: Record<string, { purchases: number; responsesPrepared: number; unresolved: number; operatorPurchases: number }> = {}
  for (const row of rows) {
    const key = row.network + ':' + row.payment_id
    if (seen.has(key) || !/^[a-z0-9-]{1,80}$/.test(row.offer_id) || !/^[\da-f]{64}$/.test(row.payment_id) || !/^[\da-f]{64}$/.test(row.payer_key)
      || !Object.hasOwn(USDC_NETWORKS, row.network) || !['confirmed', 'unknown'].includes(row.settlement_state)
      || typeof row.response_prepared !== 'boolean' || typeof row.operator_activity !== 'boolean'
      || (row.settlement_state === 'unknown' && row.response_prepared)) throw new Error('invalid_attribution_snapshot')
    seen.add(key)
    const source = claimedDiscoverySource(row.discovery_source), bucket = sources[source] ??= { purchases: 0, responsesPrepared: 0, unresolved: 0, operatorPurchases: 0 }
    if (row.settlement_state !== 'confirmed') { bucket.unresolved++; continue }
    if (row.operator_activity) { bucket.operatorPurchases++; continue }
    bucket.purchases++
    if (row.response_prepared) bucket.responsesPrepared++
    const buyerKey = row.offer_id + ':' + row.payer_key
    buyers.set(buyerKey, (buyers.get(buyerKey) ?? 0) + 1)
  }
  return { sources, distinctChainWalletOfferPairs: buyers.size, returningChainWalletOfferPairs: [...buyers.values()].filter(count => count > 1).length,
    sourceEvidence: 'self_reported' as const, buyerReceiptEstablished: false, customerIdentityEstablished: false }
}

type PageReader = (start: number, end: number, signal: AbortSignal) => PromiseLike<{ data: unknown[] | null; error: unknown }>
/** Missing schema/configuration or incomplete pagination stays unavailable, never zero. */
export async function readDiscoveryAttribution(purchases?: PageReader, challenges?: PageReader) {
  try {
    const observedAt = new Date().toISOString()
    if (!purchases || !challenges) {
      const db = createAgentInquiryLedger()
      if (!db) return { available: false as const, reason: 'attribution_store_unavailable' }
      purchases = (start, end, signal) => db.from('x402_purchase_attributions')
        .select('offer_id,payment_id,network,payer_key,discovery_source,settlement_state,response_prepared,operator_activity')
        .gte('first_observed_at', new Date(Date.parse(observedAt)-ATTRIBUTION_RETENTION_DAYS*86400000).toISOString())
        .lte('first_observed_at', observedAt).order('network').order('payment_id').range(start,end).abortSignal(signal)
      challenges = (start, end, signal) => db.from('x402_offer_usage_daily')
        .select('discovery_source,event_count').eq('event_kind','challenge')
        .lte('last_observed_at', observedAt).order('usage_day').order('offer_id').order('status_class').order('discovery_source')
        .range(start,end).abortSignal(signal)
    }
    const read = async (reader: PageReader) => {
      const rows: unknown[] = [], signal = AbortSignal.timeout(6000)
      for (let start=0;start<50000;start+=1000) {
        const page = await reader(start,start+999,signal)
        if (page.error || !Array.isArray(page.data)) throw Error('incomplete_attribution')
        rows.push(...page.data)
        if (page.data.length<1000) return rows
      }
      throw Error('incomplete_attribution')
    }
    const [purchaseRows, challengeRows] = await Promise.all([read(purchases),read(challenges)])
    const quotesByClaimedSource: Record<string, number> = {}
    for (const raw of challengeRows) {
      const row = raw as { discovery_source: string; event_count: number }
      if (!row || !Number.isSafeInteger(row.event_count) || row.event_count<0) throw Error('invalid_quote_aggregate')
      const source = claimedDiscoverySource(row.discovery_source)
      quotesByClaimedSource[source]=(quotesByClaimedSource[source]??0)+row.event_count
      if (!Number.isSafeInteger(quotesByClaimedSource[source])) throw Error('aggregate_overflow')
    }
    return { available: true as const, observedAt, purchases: summarizePurchaseAttribution(purchaseRows as AttributionRow[]), quotesByClaimedSource,
      retentionDays: ATTRIBUTION_RETENTION_DAYS,
      coverage: 'Receipt attribution covers the last 90 days from activation; historical quote coverage may start earlier. No historical backfill or causal conversion rate.' }
  } catch { return { available: false as const, reason: 'attribution_read_incomplete_or_schema_unavailable' } }
}

/** Scheduled, bounded cleanup of new attribution rows only. Never touches financial/recovery ledgers. */
export async function pruneDiscoveryAttribution(injected?: { rpc(name: string): PromiseLike<{ data: unknown; error: unknown }> } | null) {
  try {
    const db = injected !== undefined ? injected : createAgentInquiryLedger()
    if (!db) return { available: false as const, reason: 'attribution_store_unavailable' }
    const operation = db.rpc('prune_x402_purchase_attributions')
    const bounded = operation as typeof operation & { abortSignal?: (signal: AbortSignal) => typeof operation }
    const { data,error } = await (bounded.abortSignal ? bounded.abortSignal(AbortSignal.timeout(6000)) : operation)
    const result = data as { deleted: number; expiredRemaining: boolean; retentionDays: number } | null
    if (error || !result || !Number.isInteger(result.deleted) || result.deleted<0 || result.deleted>1000
      || typeof result.expiredRemaining!=='boolean' || result.retentionDays!==ATTRIBUTION_RETENTION_DAYS) throw Error('retention_failed')
    return { available: true as const, ...result }
  } catch { return { available: false as const, reason: 'attribution_retention_unavailable' } }
}
