/** Read-only bounds shared by catalogue monitors. Partial inventories cannot establish absence. */
export const MAX_MERCHANT_RESOURCES = 2000
export type MerchantResource = {
  resource: string; serviceName?: string
  quality?: { l30DaysTotalCalls?: number; l30DaysUniquePayers?: number; lastCalledAt?: string }
  [field: string]: unknown
}
export function validateExpectedInventory(resources: readonly string[]): void {
  if (!resources.length || resources.length > MAX_MERCHANT_RESOURCES || new Set(resources).size !== resources.length) throw new Error('Unexpected watch inventory.')
}
export async function readMerchantResources(url: string, options: {
  fetchImpl?: typeof fetch; expectedPayTo?: string; timeoutMs?: number; includeDeclarations?: boolean
} = {}): Promise<MerchantResource[]> {
  if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 60000)) throw new Error('invalid_merchant_timeout')
  const fetcher = options.fetchImpl ?? fetch, signal = AbortSignal.timeout(options.timeoutMs ?? 30000), snapshot = new Date().toISOString()
  const rows: MerchantResource[] = [], seen = new Set<string>()
  let total: number | undefined
  for (let offset = 0; offset < MAX_MERCHANT_RESOURCES; offset += 100) {
    const pageUrl = new URL(url)
    pageUrl.searchParams.set('limit', '100'); pageUrl.searchParams.set('offset', String(offset))
    pageUrl.searchParams.set('_maha_snapshot', snapshot)
    const response = await fetcher(pageUrl, { redirect: 'error', cache: 'no-store', signal,
      headers: { accept: 'application/json', 'user-agent': 'maha-read-only-catalogue/1.0' } })
    if (!response.ok) throw new Error('merchant_lookup_unavailable')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('merchant_body_missing')
    const chunks: Uint8Array[] = []; let size = 0
    try {
      for (;;) {
        const part = await reader.read(); if (part.done) break
        size += part.value.byteLength
        if (size > 8 * 1024 * 1024) throw new Error('merchant_page_too_large')
        chunks.push(part.value)
      }
    } finally { await reader.cancel().catch(() => {}) }
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) as { payTo?: unknown; resources?: unknown; pagination?: { total?: unknown; offset?: unknown } }
    const count = body.pagination?.total
    const merchantMatches = !options.expectedPayTo || (typeof body.payTo === 'string'
      && (/^0x[a-f0-9]{40}$/i.test(options.expectedPayTo)
        ? body.payTo.toLowerCase() === options.expectedPayTo.toLowerCase() : body.payTo === options.expectedPayTo))
    if (!Array.isArray(body.resources) || !Number.isSafeInteger(count) || Number(count) < 0
      || Number(count) > MAX_MERCHANT_RESOURCES || body.pagination?.offset !== offset
      || body.resources.length !== Math.min(100, Number(count) - offset)
      || !merchantMatches) throw new Error('invalid_merchant_page')
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
      const metadata: Record<string, unknown> = {}
      if (options.includeDeclarations) for (const key of ['description', 'mimeType', 'accepts', 'extensions', 'declarationIntegrity', 'lastUpdated']) {
        if (Object.hasOwn(raw as object, key)) metadata[key] = (raw as Record<string, unknown>)[key]
      }
      rows.push({ ...metadata, resource, ...(typeof row.serviceName === 'string' ? { serviceName: row.serviceName } : {}),
        ...(Object.keys(quality).length ? { quality } : {}) })
    }
    if (rows.length === total) return rows
  }
  throw new Error('merchant_pagination_incomplete')
}

/** One complete snapshot per payee/run. Rejected reads are cached too, never converted into missing rows. */
export function createMerchantCatalogueReader(options: { baseUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number }) {
  const cache = new Map<string, Promise<MerchantResource[]>>()
  return (payTo: string): Promise<MerchantResource[]> => {
    const identity = payTo.startsWith('0x') ? payTo.toLowerCase() : payTo
    let snapshot = cache.get(identity)
    if (!snapshot) {
      const url = new URL(options.baseUrl.replace(/\/+$/, '') + '/merchant')
      url.searchParams.set('payTo', payTo)
      snapshot = readMerchantResources(url.href, { ...options, expectedPayTo: payTo, includeDeclarations: true })
      cache.set(identity, snapshot)
    }
    return snapshot
  }
}
/** Remaining active higher-priced offers deliberately left unindexed; retired experiments are not inventory. */
export const INTENTIONALLY_UNINDEXED_OFFERS = new Set([
  'research-intake-evidence-pack',
  'book-epub-the-maha-principle', 'book-epub-the-orbital-mind',
])
