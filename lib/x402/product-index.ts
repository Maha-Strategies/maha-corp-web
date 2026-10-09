import { BAZAAR_MERCHANT_URL, MAHA_PAYEE } from './discovery-payment-recipe.ts'

export type IndexSnapshot = { available: boolean; complete: boolean; checkedAt: string; resources: string[] }
export function parseProductIndex(value: unknown, checkedAt: string): IndexSnapshot {
  const v = value as { payTo?: unknown; resources?: unknown; pagination?: { total?: unknown; offset?: unknown } }
  if (!v || typeof v.payTo !== 'string' || v.payTo.toLowerCase() !== MAHA_PAYEE || !Array.isArray(v.resources)
    || v.resources.length > 100 || !Number.isInteger(v.pagination?.total) || Number(v.pagination?.total) < v.resources.length
    || v.pagination?.offset !== 0) throw new Error('invalid_index_snapshot')
  const resources: string[] = []
  for (const raw of v.resources) {
    const row = raw as { resource?: string | { url?: string } }
    const url = typeof row?.resource === 'string' ? row.resource : row?.resource?.url
    if (typeof url !== 'string') throw new Error('invalid_index_resource')
    // Retain exact public resource URLs only; no payer or payment payload data.
    const parsed = new URL(url)
    if (parsed.origin === 'https://www.mahastrategies.com' && !parsed.search && !parsed.hash) resources.push(url)
  }
  return { available: true, complete: v.resources.length === Number(v.pagination?.total), checkedAt, resources: [...new Set(resources)] }
}
export async function readProductIndex(): Promise<IndexSnapshot> {
  const checkedAt = new Date().toISOString()
  try {
    const url = new URL(BAZAAR_MERCHANT_URL)
    url.searchParams.set('payTo', MAHA_PAYEE); url.searchParams.set('limit', '100')
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!response.ok) throw new Error('index_unavailable')
    return parseProductIndex(await response.json(), checkedAt)
  } catch { return { available: false, complete: false, checkedAt, resources: [] } }
}
export function productIndexLabel(snapshot: IndexSnapshot, path: string): string {
  if (!snapshot.available) return 'Bazaar status unknown — lookup unavailable'
  if (snapshot.resources.includes('https://www.mahastrategies.com' + path)) return 'Listed in Bazaar merchant record'
  return snapshot.complete ? 'Not observed in Bazaar merchant record' : 'Bazaar status unknown — lookup incomplete'
}
