import { createHash } from 'node:crypto'

import { assertPublicUpstreamHost, parsePublicUpstreamUrl } from './mcp-gateway.ts'
import { parseA2AAgentCard } from './a2a/validation.ts'

export const NAVIGATOR_REGISTRIES = ['bazaar', 'payan', 'mcp', 'a2a'] as const
export type NavigatorRegistry = typeof NAVIGATOR_REGISTRIES[number]

export type NavigatorRegistryRecord = {
  registry: NavigatorRegistry
  listingId: string
  evidenceUrl: string
  companyName: string
  companyDomain: string
  description: string
  capabilities: string[]
  sourcePublishedOn: string | null
  observedOn: string
}

export type NavigatorRegistrySource = {
  id: NavigatorRegistry
  read: (fetchImpl: typeof fetch, observedAt?: Date) => Promise<NavigatorRegistryRecord[]>
}

export class NavigatorRegistryConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'NavigatorRegistryConfigError' }
}

const BAZAAR_SEARCH_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/search'
const MCP_REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0.1/servers'
const PAYAN_DISCOVER_URL = 'https://payanagent.com/api/v1/discover'
const MAX_RESPONSE_BYTES = 1_000_000
const MAX_RESULTS_PER_QUERY = 6
const MAX_QUERIES = 4
const DEFAULT_QUERIES = ['agent governance', 'agent payments', 'MCP security']

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function string(value: unknown, maximum = 4_000): string | null {
  if (typeof value !== 'string') return null
  const parsed = value.trim().replace(/\s+/g, ' ')
  return parsed && parsed.length <= maximum ? parsed : parsed.slice(0, maximum).trim() || null
}

function isoDay(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10)
}

function publicUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname.includes('.')) return null
    return parsed
  } catch { return null }
}

function firstPublicUrl(...values: unknown[]): URL | null {
  for (const value of values) {
    const direct = publicUrl(value)
    if (direct) return direct
    if (typeof value !== 'string') continue
    for (const match of value.match(/https:\/\/[^\s<>"']+/g) ?? []) {
      const parsed = publicUrl(match.replace(/[),.;]+$/, ''))
      if (parsed) return parsed
    }
  }
  return null
}

function companyName(value: unknown, domain: string): string {
  const candidate = string(value, 160)
  if (candidate && !candidate.startsWith('http')) return candidate
  return domain.split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function observedOn(at: Date): string { return at.toISOString().slice(0, 10) }

async function boundedJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok || response.status >= 300 && response.status < 400) throw new Error(`${label} returned HTTP ${response.status}.`)
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error(`${label} exceeded the response limit.`)
  const body = await response.text()
  if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) throw new Error(`${label} exceeded the response limit.`)
  try { return JSON.parse(body) } catch { throw new Error(`${label} returned invalid JSON.`) }
}

async function getJson(fetchImpl: typeof fetch, url: string, label: string): Promise<unknown> {
  return boundedJson(await fetchImpl(url, {
    method: 'GET', headers: { Accept: 'application/json' }, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(10_000),
  }), label)
}

function configuredQueries(environment: Record<string, string | undefined> = process.env): string[] {
  if (!environment.NAVIGATOR_REGISTRY_QUERIES) return DEFAULT_QUERIES
  let value: unknown
  try { value = JSON.parse(environment.NAVIGATOR_REGISTRY_QUERIES) } catch { throw new NavigatorRegistryConfigError('NAVIGATOR_REGISTRY_QUERIES must be a JSON array.') }
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_QUERIES || value.some((query) => typeof query !== 'string' || query.trim().length < 3 || query.length > 120)) {
    throw new NavigatorRegistryConfigError(`NAVIGATOR_REGISTRY_QUERIES must contain one to ${MAX_QUERIES} bounded query strings.`)
  }
  return value.map((query) => (query as string).trim())
}

function configuredUrls(name: string, environment: Record<string, string | undefined> = process.env): string[] {
  const raw = environment[name]
  if (!raw) return []
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new NavigatorRegistryConfigError(`${name} must be a JSON array of public HTTPS URLs.`) }
  if (!Array.isArray(value) || value.length > 20 || value.some((url) => !publicUrl(url))) throw new NavigatorRegistryConfigError(`${name} must contain at most 20 public HTTPS URLs.`)
  return [...new Set(value as string[])]
}

export function stableRegistryId(registry: NavigatorRegistry, value: string): string {
  return `${registry}:${createHash('sha256').update(value).digest('hex').slice(0, 24)}`
}

export function parseBazaarRecords(value: unknown, query: string, observedAt = new Date()): NavigatorRegistryRecord[] {
  const root = object(value)
  const resources = Array.isArray(root?.resources) ? root.resources : Array.isArray(root?.items) ? root.items : []
  return resources.slice(0, MAX_RESULTS_PER_QUERY).flatMap((candidate): NavigatorRegistryRecord[] => {
    const item = object(candidate)
    const endpoint = publicUrl(item?.resource)
    if (!item || !endpoint) return []
    const description = string(item.description) ?? `x402 resource discovered for ${query}`
    return [{
      registry: 'bazaar', listingId: stableRegistryId('bazaar', endpoint.toString()), evidenceUrl: endpoint.toString(),
      companyName: companyName(item.title, endpoint.hostname), companyDomain: endpoint.hostname.toLowerCase(), description,
      capabilities: [description], sourcePublishedOn: isoDay(item.lastUpdated), observedOn: observedOn(observedAt),
    }]
  })
}

export function parseMcpRecords(value: unknown, query: string, observedAt = new Date()): NavigatorRegistryRecord[] {
  const rows = Array.isArray(object(value)?.servers) ? object(value)!.servers as unknown[] : []
  return rows.slice(0, MAX_RESULTS_PER_QUERY).flatMap((candidate): NavigatorRegistryRecord[] => {
    const row = object(candidate), server = object(row?.server), meta = object(object(row?._meta)?.['io.modelcontextprotocol.registry/official'])
    const remotes = Array.isArray(server?.remotes) ? server.remotes : []
    const remote = remotes.map(object).find((entry) => entry && publicUrl(entry.url))
    const endpoint = publicUrl(remote?.url)
    if (!server || !endpoint) return []
    const name = string(server.title, 160) ?? string(server.name, 160) ?? companyName(null, endpoint.hostname)
    const description = string(server.description) ?? `MCP server discovered for ${query}`
    const evidence = `${MCP_REGISTRY_URL}?search=${encodeURIComponent(String(server.name ?? name))}&version=latest`
    return [{
      registry: 'mcp', listingId: stableRegistryId('mcp', String(server.name ?? endpoint)), evidenceUrl: evidence,
      companyName: name, companyDomain: endpoint.hostname.toLowerCase(), description,
      capabilities: [description], sourcePublishedOn: isoDay(meta?.updatedAt ?? meta?.publishedAt), observedOn: observedOn(observedAt),
    }]
  })
}

export function parsePayanRecords(value: unknown, query: string, observedAt = new Date()): NavigatorRegistryRecord[] {
  const root = object(value)
  const offers = Array.isArray(root?.offers) ? root.offers : []
  return offers.slice(0, MAX_RESULTS_PER_QUERY).flatMap((candidate): NavigatorRegistryRecord[] => {
    const offer = object(candidate)
    const endpoint = firstPublicUrl(offer?.endpoint, offer?.externalUrl, offer?.description, offer?.title)
    const id = string(offer?._id, 200)
    if (!offer || !endpoint || !id) return []
    const title = string(offer.title, 160)
    const description = string(offer.description) ?? `PayanAgent offer discovered for ${query}`
    return [{
      registry: 'payan', listingId: stableRegistryId('payan', id), evidenceUrl: `https://payanagent.com/api/v1/offers/${encodeURIComponent(id)}`,
      companyName: companyName(title, endpoint.hostname), companyDomain: endpoint.hostname.toLowerCase(), description,
      capabilities: [title ?? description], sourcePublishedOn: isoDay(offer.sourceLastUpdated ?? offer._creationTime), observedOn: observedOn(observedAt),
    }]
  })
}

export function parseA2ACardRecord(value: unknown, cardUrl: string, observedAt = new Date(), lastModified?: string | null): NavigatorRegistryRecord {
  const card = parseA2AAgentCard(value)
  const endpoint = new URL(card.rpcUrl)
  return {
    registry: 'a2a', listingId: stableRegistryId('a2a', cardUrl), evidenceUrl: cardUrl,
    companyName: card.name, companyDomain: endpoint.hostname.toLowerCase(), description: card.description,
    capabilities: card.skills.map((skill) => `${skill.name}${skill.description ? `: ${skill.description}` : ''}`),
    sourcePublishedOn: isoDay(lastModified), observedOn: observedOn(observedAt),
  }
}

export function createBazaarSource(queries = configuredQueries()): NavigatorRegistrySource {
  return { id: 'bazaar', async read(fetchImpl, at = new Date()) {
    const records: NavigatorRegistryRecord[] = []
    for (const query of queries) records.push(...parseBazaarRecords(await getJson(fetchImpl, `${BAZAAR_SEARCH_URL}?query=${encodeURIComponent(query)}&limit=${MAX_RESULTS_PER_QUERY}`, 'Bazaar'), query, at))
    return records
  } }
}

export function createMcpRegistrySource(queries = configuredQueries()): NavigatorRegistrySource {
  return { id: 'mcp', async read(fetchImpl, at = new Date()) {
    const records: NavigatorRegistryRecord[] = []
    for (const query of queries) records.push(...parseMcpRecords(await getJson(fetchImpl, `${MCP_REGISTRY_URL}?search=${encodeURIComponent(query)}&version=latest&limit=${MAX_RESULTS_PER_QUERY}`, 'MCP Registry'), query, at))
    return records
  } }
}

export function createPayanSource(queries = configuredQueries()): NavigatorRegistrySource {
  return { id: 'payan', async read(fetchImpl, at = new Date()) {
    const records: NavigatorRegistryRecord[] = []
    for (const query of queries) records.push(...parsePayanRecords(await getJson(fetchImpl, `${PAYAN_DISCOVER_URL}?q=${encodeURIComponent(query)}`, 'PayanAgent'), query, at))
    return records
  } }
}

export function createA2ASource(urls = configuredUrls('NAVIGATOR_A2A_CARD_URLS')): NavigatorRegistrySource {
  return { id: 'a2a', async read(fetchImpl, at = new Date()) {
    const records: NavigatorRegistryRecord[] = []
    for (const candidate of urls) {
      const cardUrl = parsePublicUpstreamUrl(candidate)
      await assertPublicUpstreamHost(cardUrl)
      const response = await fetchImpl(cardUrl, { method: 'GET', headers: { Accept: 'application/json' }, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(10_000) })
      records.push(parseA2ACardRecord(await boundedJson(response, 'A2A Agent Card'), cardUrl, at, response.headers.get('last-modified')))
    }
    return records
  } }
}

const SOURCE_FACTORIES: Record<NavigatorRegistry, () => NavigatorRegistrySource> = {
  bazaar: () => createBazaarSource(), payan: () => createPayanSource(), mcp: () => createMcpRegistrySource(), a2a: () => createA2ASource(),
}

export function configuredNavigatorRegistrySources(environment: Record<string, string | undefined> = process.env): NavigatorRegistrySource[] {
  const raw = environment.NAVIGATOR_REGISTRY_SOURCES ?? NAVIGATOR_REGISTRIES.join(',')
  const ids = [...new Set(raw.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean))]
  if (ids.length < 1 || ids.some((id) => !NAVIGATOR_REGISTRIES.includes(id as NavigatorRegistry))) throw new NavigatorRegistryConfigError('NAVIGATOR_REGISTRY_SOURCES contains an unsupported registry.')
  const queries = configuredQueries(environment)
  return ids.map((id) => {
    if (id === 'a2a') return createA2ASource(configuredUrls('NAVIGATOR_A2A_CARD_URLS', environment))
    if (id === 'bazaar') return createBazaarSource(queries)
    if (id === 'mcp') return createMcpRegistrySource(queries)
    if (id === 'payan') return createPayanSource(queries)
    return SOURCE_FACTORIES[id as NavigatorRegistry]()
  })
}
