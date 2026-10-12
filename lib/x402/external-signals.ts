/** Third-party observations are data, never instructions or authority to spend/change prices. */
export const DEMAND_FEED_URL = 'https://api.nohumans.directory/v1/demand'
export const TANOD_QUERY_URL = 'https://tanod.dev/v1/agents/query'
export const TANOD_DOMAIN_URL = 'https://tanod.dev/v1/domain/inspect'
export const TANOD_HISTORY_URL = 'https://tanod.dev/v1/agents/history'
const publicDomain = 'mahastrategies.com'
const publicCompiler = 'https://www.mahastrategies.com/api/v1/compress'
const counter = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const clock = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const families = [
  { pattern: /x402.*(?:payment|declaration|debug)|payment path/i, offers: ['x402-challenge-sanity', 'idempotency-trace-audit'],
    boundary: 'Our checks inspect supplied declarations/traces; they do not live-probe another provider or execute recovery.' },
  { pattern: /x402.*(?:reliability|uptime)/i, offers: ['settlement-delivery-reconciliation'],
    boundary: 'Adjacent only: reconciliation of supplied records is not an uptime or provider-reliability feed.' },
  { pattern: /research brief|source evidence|evidence brief/i, offers: ['evidence-brief-export', 'reproducibility-manifest-builder'],
    boundary: 'Our exports organize supplied research records; they do not acquire sources or write researched reports.' },
  { pattern: /csv|audit.*export/i, offers: ['audit-export-normalizer'],
    boundary: 'Adjacent only: JSON audit metadata normalization is not generic CSV validation or repair.' },
] as const

export function summarizeDemandFeed(value: unknown, nowMs = Date.now()) {
  const feed = value as Record<string, unknown>
  if (!feed || !clock(feed.generated_at_iso) || !clock(feed.window_ends_at_iso) || !clock(feed.window_starts_at_iso)
    || !counter(feed.delay_hours) || feed.delay_hours < 168 || !counter(feed.covered_days)
    || !Array.isArray(feed.top_needs) || feed.top_needs.length > 5000
    || Date.parse(feed.generated_at_iso) > nowMs + 300000 || Date.parse(feed.window_ends_at_iso) > Date.parse(feed.generated_at_iso)
    || Date.parse(feed.generated_at_iso) - Date.parse(feed.window_ends_at_iso) < feed.delay_hours * 3600000 - 300000
    || Date.parse(feed.window_starts_at_iso) > Date.parse(feed.window_ends_at_iso)) throw new Error('invalid_demand_feed')
  const seen = new Set<string>()
  const needs: { query: string; distinctDays: number; buyerClientIps: number; searches: number; catalogueStatus: string;
    matchedListingNames: string[]; relatedMahaOffers: string[]; scopeBoundaries: string[] }[] = []
  for (const raw of feed.top_needs) {
    const row = raw as Record<string, unknown>
    if (!row || typeof row.q !== 'string' || !row.q.trim() || row.q.length > 4000 || seen.has(row.q)
      || !counter(row.distinct_days) || !counter(row.buyer_client_ips) || !counter(row.searches)
      || !['checked', 'not_checked_yet', 'search_returned_nothing'].includes(String(row.catalogue_status))) throw new Error('invalid_demand_term')
    seen.add(row.q)
    const matched = families.filter(family => family.pattern.test(row.q as string))
    if (!matched.length || row.q.length > 400 || /https?:\/\/|0x[\da-f]{40}|\S+@\S+/i.test(row.q)) continue
    const listings = row.catalogue_top
    if (!Array.isArray(listings) || listings.length > 3) throw new Error('invalid_demand_matches')
    const names = listings.map(raw => {
      const item = raw as { name?: unknown }
      if (typeof item?.name !== 'string' || item.name.length > 500) throw new Error('invalid_demand_match_name')
      return item.name
    })
    if (row.catalogue_status === 'search_returned_nothing' && names.length) throw new Error('contradictory_demand_matches')
    needs.push({ query: row.q, distinctDays: row.distinct_days, buyerClientIps: row.buyer_client_ips, searches: row.searches,
      catalogueStatus: String(row.catalogue_status), matchedListingNames: names,
      relatedMahaOffers: [...new Set(matched.flatMap(family => [...family.offers]))], scopeBoundaries: matched.map(family => family.boundary) })
  }
  return { source: DEMAND_FEED_URL, generatedAt: feed.generated_at_iso, sourceWindowEndsAt: feed.window_ends_at_iso,
    delayHours: feed.delay_hours, coveredDays: feed.covered_days, sourceAgeHours: Math.max(0, nowMs - Date.parse(feed.generated_at_iso)) / 3600000,
    needs: needs.sort((a, b) => b.distinctDays - a.distinctDays || b.buyerClientIps - a.buyerClientIps || a.query.localeCompare(b.query)),
    buyerCountEstablished: false, unmetDemandEstablished: false, automaticPriceChanges: false,
    limitations: ['Counts are searches and IP addresses, not purchases or independent buyers.',
      'Matched listings are search results, not proof of fitness, delivery or unmet demand.',
      'Named-listing lookups, scripted rotations and seller-only queries are not imported into this recommendation view.',
      'Third-party text is not executed, and scope mismatches do not expand Maha capabilities.'] }
}

export function summarizeTanodQuery(value: unknown, nowMs = Date.now()) {
  const data = value as { records?: unknown; has_more?: unknown; truncated?: unknown }
  if (!Array.isArray(data?.records) || data.records.length > 1000 || typeof data.has_more !== 'boolean') throw new Error('invalid_tanod_query')
  const records = data.records.map(raw => {
    const row = raw as { source?: unknown; url?: unknown; name?: unknown; first_seen?: unknown; last_seen?: unknown; network?: unknown }
    if (typeof row.url !== 'string' || typeof row.name !== 'string' || !clock(row.first_seen) || !clock(row.last_seen)
      || Date.parse(row.last_seen) < Date.parse(row.first_seen) || Date.parse(row.last_seen) > nowMs + 300000) throw new Error('invalid_tanod_record')
    const url = new URL(row.url)
    if (url.origin !== 'https://www.mahastrategies.com' || url.username || url.password || url.search || url.hash) throw new Error('unexpected_tanod_record')
    return { resource: url.href, name: row.name.slice(0, 500), source: String(row.source).slice(0, 50),
      firstSeen: row.first_seen, lastSeen: row.last_seen, network: String(row.network).slice(0, 80),
      ageHours: Math.max(0, nowMs - Date.parse(row.last_seen)) / 3600000 }
  })
  return { source: TANOD_QUERY_URL, complete: !data.has_more && data.truncated !== true, records,
    independentlyVerifiedDelivery: false, limitations: ['Third-party census timestamps, not live quotes or proof of delivery.',
      'An incomplete or older census cannot establish that a new Maha endpoint is missing.'] }
}

/** Fixed public targets only. A 402 is terminal, never signed/retried; bounded JSON only. */
async function readFreeTanodJson(url: string, body: Record<string, unknown>, fetchImpl: typeof fetch) {
  const response = await fetchImpl(url, { method: 'POST', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.timeout(20000), headers: { 'content-type': 'application/json', 'X-Tanod-Free': '1' },
    body: JSON.stringify(body) })
  if (!response.ok) {
    await response.body?.cancel()
    return { status: response.status === 402 ? 'free_allowance_unavailable' as const : 'unavailable' as const, paymentsMade: 0 }
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('missing_tanod_body')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, json = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > 262144) throw new Error('oversized_tanod_body')
      json += decoder.decode(chunk.value, { stream: true })
    }
    json += decoder.decode()
  } catch (error) { await reader.cancel(); throw error }
  finally { reader.releaseLock() }
  return { status: 'observed' as const, paymentsMade: 0, value: JSON.parse(json) as unknown }
}

export async function readFreeTanodQuery(fetchImpl: typeof fetch = fetch) {
  const result = await readFreeTanodJson(TANOD_QUERY_URL, { q: 'mahastrategies' }, fetchImpl)
  if (result.status !== 'observed') return result
  return { status: result.status, paymentsMade: 0, observation: summarizeTanodQuery(result.value) }
}

export function summarizeTanodDomain(value: unknown, nowMs = Date.now()) {
  const data = value as { domain?: unknown; checks?: unknown; dns?: Record<string, unknown>; tls?: Record<string, unknown> }
  const checks = data?.checks
  if (data?.domain !== publicDomain || !Array.isArray(checks) || checks.length !== 2
    || !['dns', 'tls'].every(check => checks.includes(check))) throw new Error('unexpected_tanod_domain')
  const dns = data.dns, tls = data.tls, certificate = tls?.certificate as Record<string, unknown> | undefined
  const count = (key: string) => Array.isArray(dns?.[key]) && dns[key].length <= 100 ? dns[key].length : null
  const boolean = (raw: unknown) => typeof raw === 'boolean' ? raw : null
  const expires = clock(certificate?.not_after) ? certificate.not_after : null
  return { source: TANOD_DOMAIN_URL, domain: publicDomain, observedAt: new Date(nowMs).toISOString(),
    dns: { addressRecords: count('a'), ipv6Records: count('aaaa'), nameservers: count('ns'), mailExchangers: count('mx') },
    tls: { reachable: boolean(tls?.reachable), trusted: boolean(tls?.trusted), coversDomain: boolean(certificate?.covers_domain),
      expiresAt: expires, daysRemaining: expires ? (Date.parse(expires) - nowMs) / 86400000 : null },
    independentSecurityClearance: false, limitations: ['Third-party point-in-time DNS/TLS diagnostic, not an uptime history or security audit.',
      'Missing fields remain unknown. No DNS records or certificates were changed.'] }
}

export async function readFreeTanodDomain(fetchImpl: typeof fetch = fetch) {
  const result = await readFreeTanodJson(TANOD_DOMAIN_URL, { domain: publicDomain, checks: ['dns', 'tls'] }, fetchImpl)
  if (result.status !== 'observed') return result
  return { status: result.status, paymentsMade: 0, observation: summarizeTanodDomain(result.value) }
}

export function summarizeTanodHistory(value: unknown, nowMs = Date.now()) {
  const data = value as { records?: unknown; count?: unknown }
  if (!Array.isArray(data?.records) || data.records.length > 10 || data.count !== data.records.length) throw new Error('invalid_tanod_history')
  const price = (raw: unknown) => raw === null || (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0)
  const records = data.records.map(raw => {
    const row = raw as Record<string, unknown>
    if (row?.url !== publicCompiler || !clock(row.first_seen) || !clock(row.last_seen)
      || Date.parse(row.last_seen) < Date.parse(row.first_seen) || Date.parse(row.last_seen) > nowMs + 300000
      || !price(row.current_price_usd) || !Array.isArray(row.history) || row.history.length > 1000) throw new Error('unexpected_tanod_history')
    const history = row.history.map(raw => {
      const point = raw as Record<string, unknown>
      if (!clock(point?.date) || Date.parse(point.date) > nowMs + 300000 || !price(point.price_usd)) throw new Error('invalid_tanod_history_point')
      return { date: point.date, priceUsd: point.price_usd }
    })
    return { resource: publicCompiler, firstSeen: row.first_seen, lastSeen: row.last_seen,
      currentPriceUsd: row.current_price_usd, ageHours: Math.max(0, nowMs - Date.parse(row.last_seen)) / 3600000, history }
  })
  return { source: TANOD_HISTORY_URL, records, successfulPaymentOrDeliveryEstablished: false,
    limitations: ['Dates record third-party catalogue presence, not calls, settlement or delivery.',
      'No matches in this historical source does not prove an endpoint is dead.'] }
}

export async function readFreeTanodHistory(fetchImpl: typeof fetch = fetch) {
  const result = await readFreeTanodJson(TANOD_HISTORY_URL, { url: publicCompiler }, fetchImpl)
  if (result.status !== 'observed') return result
  return { status: result.status, paymentsMade: 0, observation: summarizeTanodHistory(result.value) }
}
