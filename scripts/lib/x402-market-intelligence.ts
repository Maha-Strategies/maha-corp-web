import { readMerchantResources } from '../../lib/x402/merchant-catalog.ts'
export type MarketService = { u: string; n: string; d: string; t: string[]; p: number | null; w: string; c: number | null; y: number | null }
export type MarketDataset = { generatedAt: string; count: number; services: MarketService[];
  receipt: { snapshotGeneratedAt: string; snapshotHash: string; notCarried: string[] } }
export type MerchantRow = { resource: string; serviceName?: string; quality?: { l30DaysTotalCalls?: number; l30DaysUniquePayers?: number; lastCalledAt?: string } }
const finiteCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0

export function validateDataset(value: unknown): MarketDataset {
  const data = value as MarketDataset
  if (!data || !Array.isArray(data.services) || data.count !== data.services.length || !data.receipt
    || !Number.isFinite(Date.parse(data.receipt.snapshotGeneratedAt)) || typeof data.receipt.snapshotHash !== 'string') throw new Error('Missing immutable source snapshot provenance.')
  const identities = new Set<string>()
  for (const s of data.services) {
    if (!s || typeof s.u !== 'string' || typeof s.w !== 'string' || typeof s.n !== 'string' || typeof s.d !== 'string'
      || !Array.isArray(s.t) || s.t.some(tag => typeof tag !== 'string')
      || (s.p !== null && (typeof s.p !== 'number' || !Number.isFinite(s.p) || s.p < 0))
      || (s.c !== null && !finiteCount(s.c)) || (s.y !== null && !finiteCount(s.y))) throw new Error('Unexpected market row schema.')
    const url = new URL(s.u)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Unexpected resource URL.')
    const key = `${s.w} ${s.u}`
    if (identities.has(key)) throw new Error('Duplicate resource/network would inflate market totals.')
    identities.add(key)
  }
  return data
}

export function snapshotAge(snapshotAt: string, nowMs: number) {
  const time = Date.parse(snapshotAt)
  if (!Number.isFinite(time) || !Number.isFinite(nowMs) || time > nowMs + 300000) throw new Error('Invalid source clock.')
  const ageHours = Math.max(0, nowMs - time) / 3600000
  return { ageHours: Number(ageHours.toFixed(2)), freshness: ageHours <= 24 ? 'fresh' : ageHours <= 48 ? 'aging' : 'stale',
    automaticPriceChangesAllowed: false, currentRankClaimAllowed: false }
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function sellerCohort(services: MarketService[]) {
  const sellers = new Map<string, { host: string; resources: number; calls30dKnown: number; resourcesWithCalls: number; payerLowerBound: number; payerUpperBound: number; resourcesWithPayers: number }>()
  for (const s of services) {
    const host = new URL(s.u).hostname
    const row = sellers.get(host) ?? { host, resources: 0, calls30dKnown: 0, resourcesWithCalls: 0, payerLowerBound: 0, payerUpperBound: 0, resourcesWithPayers: 0 }
    row.resources++
    if (finiteCount(s.c)) { row.calls30dKnown += s.c; row.resourcesWithCalls++ }
    if (finiteCount(s.y)) { row.payerLowerBound = Math.max(row.payerLowerBound, s.y); row.payerUpperBound += s.y; row.resourcesWithPayers++ }
    sellers.set(host, row)
  }
  return [...sellers.values()].sort((a, b) => b.calls30dKnown - a.calls30dKnown || a.host.localeCompare(b.host))
}

export function rankInFrozenCohort(services: MarketService[], host: string, hypotheticalCalls?: number) {
  const cohort = sellerCohort(services)
  if (cohort.some(s => s.resources !== s.resourcesWithCalls)) return { rank: null, reason: 'incomplete_call_coverage', sellerHosts: cohort.length }
  const seller = cohort.find(s => s.host === host)
  if (!seller && hypotheticalCalls === undefined) return { rank: null, reason: 'seller_absent', sellerHosts: cohort.length }
  const calls = hypotheticalCalls ?? seller!.calls30dKnown
  if (!finiteCount(calls)) throw new Error('Invalid scenario calls.')
  const competitors = cohort.filter(s => s.host !== host)
  return { rank: 1 + competitors.filter(s => s.calls30dKnown > calls).length,
    rankConvention: 'competition-rank: ties share the same rank', tiedOtherSellers: competitors.filter(s => s.calls30dKnown === calls).length,
    calls30d: calls, sellerHosts: cohort.length, scenarioOnly: hypotheticalCalls !== undefined,
    currentRankClaimAllowed: false, organicDemandClaimAllowed: false }
}

/** A category's route count is not its number of competing businesses. */
export function categoryProfile(services: MarketService[], tag: string, excludedHost?: string) {
  const selected = services.filter(s => s.t.includes(tag) && new URL(s.u).hostname !== excludedHost)
  const hosts = sellerCohort(selected)
  const priced = selected.filter((s): s is MarketService & { p: number } => typeof s.p === 'number')
  const hostPrices = new Map<string, number[]>()
  for (const s of priced) {
    const host = new URL(s.u).hostname
    const prices = hostPrices.get(host) ?? []; prices.push(s.p); hostPrices.set(host, prices)
  }
  const totalCalls = hosts.reduce((sum, s) => sum + s.calls30dKnown, 0)
  const leader = hosts[0]
  return { tag, resources: selected.length, sellerHosts: hosts.length, knownCalls30d: totalCalls,
    resourcesWithKnownCalls: selected.filter(s => s.c !== null).length,
    medianListedPriceUsdPerRoute: median(priced.map(s => s.p)),
    medianOfSellerMedianPricesUsd: median([...hostPrices.values()].map(prices => median(prices)!)),
    leadingHost: leader?.host ?? null, leadingHostCallShare: totalCalls ? (leader?.calls30dKnown ?? 0) / totalCalls : null,
    leadingHostResourceShare: selected.length && leader ? leader.resources / selected.length : null,
    priceComparability: 'Listed per-call prices; output scope, quality, self-funded traffic and variable billing are not normalized.' }
}

/** Unknown does not become zero and resource-level payer counts do not become unique buyers. */
export function merchantSignals(rows: MerchantRow[], expectedResources: string[], nowMs: number) {
  const byResource = new Map(rows.map(row => [row.resource, row]))
  if (byResource.size !== rows.length) throw new Error('Duplicate merchant resources.')
  const observations = expectedResources.map(resource => {
    const row = byResource.get(resource)
    const calls = finiteCount(row?.quality?.l30DaysTotalCalls) ? row!.quality!.l30DaysTotalCalls! : null
    const payers = finiteCount(row?.quality?.l30DaysUniquePayers) ? row!.quality!.l30DaysUniquePayers! : null
    const last = Date.parse(row?.quality?.lastCalledAt ?? '')
    const ageDays = Number.isFinite(last) && last <= nowMs + 300000 ? Math.max(0, nowMs - last) / 86400000 : null
    return { resource, indexed: !!row, indexedServiceName: row?.serviceName ?? null,
      nameMissing: !!row && !row.serviceName?.trim(), calls30d: calls, payers30d: payers, ageDays,
      inactivity: !row ? 'listing_missing' : ageDays === null ? 'unknown' : ageDays >= 23 ? 'urgent' : ageDays >= 16 ? 'warn' : 'ok' }
  })
  const knownPayers = observations.flatMap(row => row.payers30d === null ? [] : [row.payers30d])
  return { expected: expectedResources.length, indexed: observations.filter(row => row.indexed).length,
    resourcesWithCallMetrics: observations.filter(row => row.calls30d !== null).length,
    knownCalls30d: observations.reduce((sum, row) => sum + (row.calls30d ?? 0), 0),
    qualityMetricsComplete: observations.every(row => row.calls30d !== null),
    payerLowerBound: knownPayers.length ? Math.max(...knownPayers) : null,
    payerUpperBound: knownPayers.length ? knownPayers.reduce((sum, count) => sum + count, 0) : null,
    payerBoundsComplete: observations.every(row => row.payers30d !== null),
    organicDemandClaimAllowed: false, automaticRefreshPayments: false, observations }
}

export async function fetchMerchantPages(url: string, fetcher: typeof fetch = fetch): Promise<MerchantRow[]> {
  return readMerchantResources(url, { fetchImpl: fetcher, expectedPayTo: new URL(url).searchParams.get('payTo') ?? undefined })
}
