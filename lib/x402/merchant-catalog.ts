/** Read-only bounds shared by catalogue monitors. Partial inventories cannot establish absence. */
export const MAX_MERCHANT_RESOURCES = 1000
export type MerchantResource = {
  resource: string; serviceName?: string
  quality?: { l30DaysTotalCalls?: number; l30DaysUniquePayers?: number; lastCalledAt?: string }
}
export function validateExpectedInventory(resources: readonly string[]): void {
  if (!resources.length || resources.length > MAX_MERCHANT_RESOURCES || new Set(resources).size !== resources.length) throw new Error('Unexpected watch inventory.')
}
export async function readMerchantResources(url: string, options: {
  fetchImpl?: typeof fetch; expectedPayTo?: string; timeoutMs?: number
} = {}): Promise<MerchantResource[]> {
  const fetcher = options.fetchImpl ?? fetch, signal = AbortSignal.timeout(options.timeoutMs ?? 30000)
  const rows: MerchantResource[] = [], seen = new Set<string>()
  let total: number | undefined
  for (let offset = 0; offset < MAX_MERCHANT_RESOURCES; offset += 100) {
    const pageUrl = new URL(url)
    pageUrl.searchParams.set('limit', '100'); pageUrl.searchParams.set('offset', String(offset))
    const response = await fetcher(pageUrl, { redirect: 'error', cache: 'no-store', signal,
      headers: { accept: 'application/json', 'user-agent': 'maha-read-only-catalogue/1.0' } })
    if (!response.ok) throw new Error('merchant_lookup_unavailable')
    const body = await response.json() as { payTo?: unknown; resources?: unknown; pagination?: { total?: unknown; offset?: unknown } }
    const count = body.pagination?.total
    if (!Array.isArray(body.resources) || !Number.isSafeInteger(count) || Number(count) < 0
      || Number(count) > MAX_MERCHANT_RESOURCES || body.pagination?.offset !== offset
      || body.resources.length !== Math.min(100, Number(count) - offset)
      || (options.expectedPayTo && (typeof body.payTo !== 'string' || body.payTo.toLowerCase() !== options.expectedPayTo.toLowerCase()))) throw new Error('invalid_merchant_page')
    if (total !== undefined && total !== count) throw new Error('merchant_inventory_changed')
    total = Number(count)
    for (const raw of body.resources) {
      const row = raw as { resource?: string | { url?: unknown }; serviceName?: unknown; quality?: MerchantResource['quality'] }
      const resource = typeof row?.resource === 'string' ? row.resource : row?.resource?.url
      if (typeof resource !== 'string' || seen.has(resource)) throw new Error('invalid_or_duplicate_merchant_resource')
      const parsed = new URL(resource)
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('invalid_merchant_resource_url')
      seen.add(resource)
      const quality: NonNullable<MerchantResource['quality']> = {}
      if (row.quality && typeof row.quality === 'object') {
        for (const key of ['l30DaysTotalCalls', 'l30DaysUniquePayers'] as const) {
          const value = row.quality[key]
          if (Number.isSafeInteger(value) && Number(value) >= 0) quality[key] = value
        }
        if (typeof row.quality.lastCalledAt === 'string' && Number.isFinite(Date.parse(row.quality.lastCalledAt))) {
          quality.lastCalledAt = row.quality.lastCalledAt
        }
      }
      rows.push({ resource, ...(typeof row.serviceName === 'string' ? { serviceName: row.serviceName } : {}),
        ...(Object.keys(quality).length ? { quality } : {}) })
    }
    if (rows.length === total) return rows
  }
  throw new Error('merchant_pagination_incomplete')
}
/** Owner deliberately left these five higher-priced offers unindexed on 11 October. */
export const INTENTIONALLY_UNINDEXED_OFFERS = new Set([
  'research-intake-evidence-pack', 'book-edition-the-imagined-life', 'book-edition-the-volcanic-engine',
  'book-epub-the-maha-principle', 'book-epub-the-orbital-mind',
])
