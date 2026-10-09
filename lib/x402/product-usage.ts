import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'

export type UsageRow = {
  offer_id: string; event_kind: string; status_class: string; discovery_source: string
  event_count: number; first_observed_at: string; last_observed_at: string
}
export type ProductUsage = { successfulCalls: number; unsuccessfulCalls: number; challenges: number; declaredOperatorCalls: number }
export type UsageSnapshot = { available: true; products: Record<string, ProductUsage>; firstObservedAt: string | null; lastObservedAt: string | null }
  | { available: false; products: Record<string, never>; firstObservedAt: null; lastObservedAt: null }
export const unavailableUsage = (): UsageSnapshot => ({ available: false, products: {}, firstObservedAt: null, lastObservedAt: null })

/** Aggregate only. No addresses, request bodies, secrets or raw referrers reach this public view. */
export function summarizeProductUsage(rows: readonly UsageRow[], offerIds: readonly string[]): UsageSnapshot {
  const products: Record<string, ProductUsage> = Object.fromEntries(offerIds.map(id => [id, {
    successfulCalls: 0, unsuccessfulCalls: 0, challenges: 0, declaredOperatorCalls: 0,
  }]))
  let firstObservedAt: string | null = null, lastObservedAt: string | null = null
  for (const row of rows) {
    if (!products[row.offer_id]) continue
    if (!Number.isSafeInteger(row.event_count) || row.event_count < 0
      || !['challenge', 'invocation'].includes(row.event_kind) || !['2xx', '4xx', '5xx'].includes(row.status_class)
      || !['bazaar', 'maha_canary', 'direct', 'unknown'].includes(row.discovery_source)
      || !Number.isFinite(Date.parse(row.first_observed_at)) || !Number.isFinite(Date.parse(row.last_observed_at))
      || Date.parse(row.first_observed_at) > Date.parse(row.last_observed_at)) throw new Error('invalid_usage_snapshot')
    const p = products[row.offer_id]
    if (row.event_kind === 'challenge') p.challenges += row.event_count
    else if (row.status_class === '2xx') {
      p.successfulCalls += row.event_count
      if (row.discovery_source === 'maha_canary') p.declaredOperatorCalls += row.event_count
    } else p.unsuccessfulCalls += row.event_count
    if (Object.values(p).some(n => !Number.isSafeInteger(n))) throw new Error('invalid_usage_snapshot')
    if (!firstObservedAt || Date.parse(row.first_observed_at) < Date.parse(firstObservedAt)) firstObservedAt = row.first_observed_at
    if (!lastObservedAt || Date.parse(row.last_observed_at) > Date.parse(lastObservedAt)) lastObservedAt = row.last_observed_at
  }
  return { available: true, products, firstObservedAt, lastObservedAt }
}

type PageReader = (start: number, end: number, signal: AbortSignal) => Promise<{ data: unknown; error: unknown }>
export async function readProductUsage(offerIds: readonly string[], readPage?: PageReader): Promise<UsageSnapshot> {
  try {
    if (!readPage) {
      const db = createAgentInquiryLedger()
      if (!db) return unavailableUsage()
      readPage = async (start, end, signal) => db.from('x402_offer_usage_daily')
        .select('offer_id,event_kind,status_class,discovery_source,event_count,first_observed_at,last_observed_at')
        .order('usage_day').order('offer_id').order('event_kind').order('status_class').order('discovery_source')
        .range(start, end).abortSignal(signal)
    }
    const signal = AbortSignal.timeout(6000), rows: UsageRow[] = []
    for (let start = 0; start < 50000; start += 1000) {
      const page = await readPage(start, start + 999, signal)
      if (page.error || !Array.isArray(page.data)) return unavailableUsage()
      rows.push(...page.data as UsageRow[])
      if (page.data.length < 1000) return summarizeProductUsage(rows, offerIds)
    }
    // A bounded partial read is not a complete count; never display it as one.
    return unavailableUsage()
  } catch { return unavailableUsage() }
}
