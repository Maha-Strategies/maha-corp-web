import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { DISCOVERY_SOURCES, type ClaimedDiscoverySource } from './discovery-attribution.ts'

export type UsageRow = {
  offer_id: string; event_kind: string; status_class: string; discovery_source: string
  event_count: number; first_observed_at: string; last_observed_at: string
}
export type ProductUsage = { successfulCalls: number; unsuccessfulCalls: number; challenges: number; declaredOperatorCalls: number }
export type UsageCoverage = { invocationSource: 'offer_meter' | 'compiler_meter' | 'unavailable'; hasInvocationRecords: boolean; firstInvocationAt: string | null; lastInvocationAt: string | null }
export type UsageSnapshot = { available: true; products: Record<string, ProductUsage>; coverage: Record<string, UsageCoverage>; firstObservedAt: string | null; lastObservedAt: string | null }
  | { available: false; products: Record<string, never>; firstObservedAt: null; lastObservedAt: null }
export const unavailableUsage = (): UsageSnapshot => ({ available: false, products: {}, firstObservedAt: null, lastObservedAt: null })

/** Aggregate only. No addresses, request bodies, secrets or raw referrers reach this public view. */
export function summarizeProductUsage(rows: readonly UsageRow[], offerIds: readonly string[]): UsageSnapshot {
  const products: Record<string, ProductUsage> = Object.fromEntries(offerIds.map(id => [id, {
    successfulCalls: 0, unsuccessfulCalls: 0, challenges: 0, declaredOperatorCalls: 0,
  }]))
  const coverage: Record<string, UsageCoverage> = Object.fromEntries(offerIds.map(id => [id, {
    invocationSource: 'offer_meter', hasInvocationRecords: false, firstInvocationAt: null, lastInvocationAt: null,
  }]))
  let firstObservedAt: string | null = null, lastObservedAt: string | null = null
  for (const row of rows) {
    if (!products[row.offer_id]) continue
    if (!Number.isSafeInteger(row.event_count) || row.event_count < 0
      || !['challenge', 'invocation'].includes(row.event_kind) || !['2xx', '4xx', '5xx'].includes(row.status_class)
      || !DISCOVERY_SOURCES.includes(row.discovery_source as ClaimedDiscoverySource)
      || !Number.isFinite(Date.parse(row.first_observed_at)) || !Number.isFinite(Date.parse(row.last_observed_at))
      || Date.parse(row.first_observed_at) > Date.parse(row.last_observed_at)) throw new Error('invalid_usage_snapshot')
    const p = products[row.offer_id]
    if (row.event_kind === 'invocation') {
      const c = coverage[row.offer_id]
      c.hasInvocationRecords = true
      if (!c.firstInvocationAt || Date.parse(row.first_observed_at) < Date.parse(c.firstInvocationAt)) c.firstInvocationAt = row.first_observed_at
      if (!c.lastInvocationAt || Date.parse(row.last_observed_at) > Date.parse(c.lastInvocationAt)) c.lastInvocationAt = row.last_observed_at
    }
    if (row.event_kind === 'challenge') p.challenges += row.event_count
    else if (row.status_class === '2xx') {
      p.successfulCalls += row.event_count
      if (row.discovery_source === 'maha_canary') p.declaredOperatorCalls += row.event_count
    } else p.unsuccessfulCalls += row.event_count
    if (Object.values(p).some(n => !Number.isSafeInteger(n))) throw new Error('invalid_usage_snapshot')
    if (!firstObservedAt || Date.parse(row.first_observed_at) < Date.parse(firstObservedAt)) firstObservedAt = row.first_observed_at
    if (!lastObservedAt || Date.parse(row.last_observed_at) > Date.parse(lastObservedAt)) lastObservedAt = row.last_observed_at
  }
  return { available: true, products, coverage, firstObservedAt, lastObservedAt }
}

type PageReader = (start: number, end: number, signal: AbortSignal) => Promise<{ data: unknown; error: unknown }>
export type CompilerUsageRow = { access_mode: string; status_class: string; request_count: number; first_observed_at: string; last_observed_at: string }

/** The compiler kept writing this dedicated meter after the general meter was introduced.
 * Use that one history, never sum it with overlapping general-meter records. */
export function applyCompilerUsage(snapshot: UsageSnapshot, rows: readonly CompilerUsageRow[] | null): UsageSnapshot {
  if (!snapshot.available || !snapshot.products['context-compression']) return snapshot
  const id = 'context-compression'
  const products = { ...snapshot.products, [id]: { ...snapshot.products[id] } }
  const coverage = { ...snapshot.coverage }
  if (rows === null) {
    if (!coverage[id].hasInvocationRecords) coverage[id] = { ...coverage[id], invocationSource: 'unavailable' }
    return { ...snapshot, products, coverage }
  }
  let successfulCalls = 0, unsuccessfulCalls = 0, firstInvocationAt: string | null = null, lastInvocationAt: string | null = null
  for (const row of rows) {
    if (!['x402', 'api_key', 'anonymous'].includes(row.access_mode)) throw new Error('invalid_compiler_usage_snapshot')
    if (row.access_mode !== 'x402') continue
    if (!Number.isSafeInteger(row.request_count) || row.request_count < 0 || !['2xx', '4xx', '5xx'].includes(row.status_class)
      || !Number.isFinite(Date.parse(row.first_observed_at)) || !Number.isFinite(Date.parse(row.last_observed_at))
      || Date.parse(row.first_observed_at) > Date.parse(row.last_observed_at)) throw new Error('invalid_compiler_usage_snapshot')
    if (row.status_class === '2xx') successfulCalls += row.request_count
    else unsuccessfulCalls += row.request_count
    if (!Number.isSafeInteger(successfulCalls) || !Number.isSafeInteger(unsuccessfulCalls)) throw new Error('invalid_compiler_usage_snapshot')
    if (!firstInvocationAt || Date.parse(row.first_observed_at) < Date.parse(firstInvocationAt)) firstInvocationAt = row.first_observed_at
    if (!lastInvocationAt || Date.parse(row.last_observed_at) > Date.parse(lastInvocationAt)) lastInvocationAt = row.last_observed_at
  }
  products[id] = { ...products[id], successfulCalls, unsuccessfulCalls }
  coverage[id] = { invocationSource: 'compiler_meter', hasInvocationRecords: firstInvocationAt !== null, firstInvocationAt, lastInvocationAt }
  return { ...snapshot, products, coverage,
    firstObservedAt: firstInvocationAt && (!snapshot.firstObservedAt || Date.parse(firstInvocationAt) < Date.parse(snapshot.firstObservedAt)) ? firstInvocationAt : snapshot.firstObservedAt,
    lastObservedAt: lastInvocationAt && (!snapshot.lastObservedAt || Date.parse(lastInvocationAt) > Date.parse(snapshot.lastObservedAt)) ? lastInvocationAt : snapshot.lastObservedAt }
}

export function productUsageDisplay(snapshot: UsageSnapshot, id: string) {
  if (!snapshot.available || !snapshot.products[id]) return { successful: 'Unknown', unsuccessful: 'Unknown', operator: 'Unknown' }
  const c = snapshot.coverage[id], p = snapshot.products[id]
  const missing = c.invocationSource === 'unavailable' ? 'Unknown' : 'Not recorded'
  return { successful: c.hasInvocationRecords ? String(p.successfulCalls) : missing,
    unsuccessful: c.hasInvocationRecords ? String(p.unsuccessfulCalls) : missing,
    operator: c.invocationSource === 'compiler_meter' ? 'Not classified' : c.hasInvocationRecords ? String(p.declaredOperatorCalls) : missing }
}

async function aggregatePages(readPage: PageReader, signal: AbortSignal): Promise<unknown[] | null> {
  const rows: unknown[] = []
  for (let start = 0; start < 50000; start += 1000) {
    const page = await readPage(start, start + 999, signal)
    if (page.error || !Array.isArray(page.data)) return null
    rows.push(...page.data)
    if (page.data.length < 1000) return rows
  }
  return null // Never publish bounded partial totals.
}

export async function readProductUsage(offerIds: readonly string[], readPage?: PageReader, readCompilerPage?: PageReader): Promise<UsageSnapshot> {
  try {
    if (!readPage) {
      const db = createAgentInquiryLedger()
      if (!db) return unavailableUsage()
      readPage = async (start, end, signal) => db.from('x402_offer_usage_daily')
        .select('offer_id,event_kind,status_class,discovery_source,event_count,first_observed_at,last_observed_at')
        .order('usage_day').order('offer_id').order('event_kind').order('status_class').order('discovery_source')
        .range(start, end).abortSignal(signal)
      if (offerIds.includes('context-compression')) readCompilerPage = async (start, end, signal) => db.from('context_compiler_usage_daily')
        .select('access_mode,status_class,request_count,first_observed_at,last_observed_at').eq('access_mode', 'x402')
        .order('usage_day').order('access_mode').order('credential_id').order('status_class').range(start, end).abortSignal(signal)
    }
    const signal = AbortSignal.timeout(6000)
    const [rows, compilerRows] = await Promise.all([aggregatePages(readPage, signal),
      readCompilerPage ? aggregatePages(readCompilerPage, signal).catch(() => null) : Promise.resolve(undefined)])
    const snapshot = rows === null ? unavailableUsage() : summarizeProductUsage(rows as UsageRow[], offerIds)
    if (compilerRows === undefined) return snapshot
    try { return applyCompilerUsage(snapshot, compilerRows as CompilerUsageRow[] | null) }
    catch { return applyCompilerUsage(snapshot, null) }
  } catch { return unavailableUsage() }
}
