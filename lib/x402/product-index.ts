import { BAZAAR_MERCHANT_URL, MAHA_PAYEE } from './discovery-payment-recipe.ts'

export type ProductListing = { serviceName: string | null; calls30d: number | null; payers30d: number | null; lastCalledAt: string | null }
export type IndexSnapshot = { available: boolean; complete: boolean; checkedAt: string; resources: string[]; listings?: Record<string, ProductListing> }
export function parseProductIndex(value: unknown, checkedAt: string, offset = 0): IndexSnapshot {
  const v = value as { payTo?: unknown; resources?: unknown; pagination?: { total?: unknown; offset?: unknown } }
  if (!v || typeof v.payTo !== 'string' || v.payTo.toLowerCase() !== MAHA_PAYEE || !Array.isArray(v.resources)
    || v.resources.length > 100 || !Number.isInteger(v.pagination?.total) || Number(v.pagination?.total) < offset + v.resources.length
    || v.pagination?.offset !== offset) throw new Error('invalid_index_snapshot')
  const resources: string[] = []
  const listings: Record<string, ProductListing> = {}, seen = new Set<string>()
  const count = (value: unknown): number | null => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null
  for (const raw of v.resources) {
    const row = raw as { resource?: string | { url?: string }; serviceName?: unknown; quality?: { l30DaysTotalCalls?: unknown; l30DaysUniquePayers?: unknown; lastCalledAt?: unknown } }
    const url = typeof row?.resource === 'string' ? row.resource : row?.resource?.url
    if (typeof url !== 'string') throw new Error('invalid_index_resource')
    if (seen.has(url)) throw new Error('duplicate_index_resource')
    seen.add(url)
    // Retain exact public resource URLs only; no payer or payment payload data.
    const parsed = new URL(url)
    if (parsed.origin === 'https://www.mahastrategies.com' && !parsed.search && !parsed.hash) {
      resources.push(url)
      const last = row.quality?.lastCalledAt
      listings[url] = { serviceName: typeof row.serviceName === 'string' && row.serviceName.trim() ? row.serviceName : null,
        calls30d: count(row.quality?.l30DaysTotalCalls), payers30d: count(row.quality?.l30DaysUniquePayers),
        lastCalledAt: typeof last === 'string' && Number.isFinite(Date.parse(last)) && Date.parse(last) <= Date.parse(checkedAt) + 300000 ? last : null }
    }
  }
  return { available: true, complete: offset + v.resources.length === Number(v.pagination?.total), checkedAt, resources, listings }
}
export async function readProductIndex(options: { timeoutMs?: number } = {}): Promise<IndexSnapshot> {
  const timeoutMs = options.timeoutMs ?? 6000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('invalid_index_deadline')
  const checkedAt = new Date().toISOString()
  const resources = new Set<string>()
  const listings: Record<string, ProductListing> = {}
  let total: number | undefined
  try {
    // One shared deadline and at most ten pages: no unbounded catalogue crawl.
    const signal = AbortSignal.timeout(timeoutMs)
    for (let offset = 0; offset < 1000; offset += 100) {
      const url = new URL(BAZAAR_MERCHANT_URL)
      url.searchParams.set('payTo', MAHA_PAYEE); url.searchParams.set('limit', '100'); url.searchParams.set('offset', String(offset))
      const response = await fetch(url, { cache: 'no-store', signal })
      if (!response.ok) throw new Error('index_unavailable')
      const value = await response.json()
      const page = parseProductIndex(value, checkedAt, offset)
      if (total !== undefined && total !== value.pagination.total) throw new Error('index_changed_during_pagination')
      total = value.pagination.total
      for (const resource of page.resources) {
        if (resources.has(resource)) throw new Error('duplicate_index_resource_across_pages')
        resources.add(resource)
      }
      Object.assign(listings, page.listings)
      if (page.complete) return { ...page, resources: [...resources], listings }
      if (value.resources.length !== 100) throw new Error('incomplete_index_page')
    }
    return { available: true, complete: false, checkedAt, resources: [...resources], listings }
  } catch { return { available: resources.size > 0, complete: false, checkedAt, resources: [...resources], listings } }
}
export function productIndexLabel(snapshot: IndexSnapshot, path: string): string {
  if (!snapshot.available) return 'Bazaar status unknown — lookup unavailable'
  if (snapshot.resources.includes('https://www.mahastrategies.com' + path)) return 'Listed in Bazaar merchant record'
  return snapshot.complete ? 'Not observed in Bazaar merchant record' : 'Bazaar status unknown — lookup incomplete'
}
