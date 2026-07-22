// Approved research sources for the Outbound Scout. Every source here is
// READ-ONLY: it issues search/retrieval requests and returns raw signals. There
// is no capability to message, post, or transact. Sources fail CLOSED — a source
// listed in MARKET_SCOUT_SOURCES whose credential is missing raises an error and
// the whole run aborts rather than degrading silently.

import type { RawSignal } from './market-scout.ts'

export class ScoutConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'ScoutConfigError' }
}

// A minimal fetch shape so the network dependency can be injected in tests.
export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

export type ResearchSource = { id: string; search: (fetchImpl: FetchLike) => Promise<RawSignal[]> }

export const MAX_QUERIES_PER_RUN = 5
const MAX_RESULTS_PER_QUERY = 8
const MAX_LANES = 8
const MAX_QUERIES_PER_LANE = 12

export type DiscoveryLane = { id: string; label: string; queries: string[] }
export type DiscoveryQuery = { laneId: string; query: string }

// The default matrix represents Maha's current shippable capability lanes.
// It deliberately contains buyer-language queries, not generic category SEO.
export const DEFAULT_DISCOVERY_MATRIX: DiscoveryLane[] = [
  { id: 'community-requests', label: 'Community tool requests', queries: [
    'site:reddit.com "looking for" receipt photo to CSV tool',
    'site:reddit.com "need a tool" extract data from PDF spreadsheet',
    'site:reddit.com "can anyone recommend" citation verification tool',
    'site:news.ycombinator.com "looking for" document extraction API',
    'site:reddit.com "happy to pay" automate data entry receipts',
  ] },
  { id: 'marketplace-requests', label: 'Marketplace requests', queries: [
    'site:upwork.com receipt data extraction CSV job',
    'site:upwork.com PDF table extraction spreadsheet job',
    'site:upwork.com fact checking citations AI content job',
    'site:contra.com document data extraction project',
    'site:freelancer.com OCR invoice extraction project',
  ] },
  { id: 'mps-claim-verification', label: 'MPS claim verification', queries: [
    '"I need" citation verification tool before publishing AI content',
    '"looking for" citation audit tool for research reports',
    '"need source provenance" audit for generated content',
    '"hire" fact checking service publication workflow',
    '"citation verification software" editorial team pricing',
  ] },
  { id: 'research-briefs', label: 'Research briefs', queries: [
    '"hire" competitive intelligence research brief market entry',
    '"need" competitor landscape research before product launch',
    '"market research consultant" quote new market entry',
    '"due diligence research brief" vendor decision',
    '"competitive analysis service" pricing startup',
  ] },
  { id: 'document-data-extraction', label: 'Document data extraction', queries: [
    '"need" extract tables PDF CSV API',
    '"hire" document data extraction scanned reports',
    '"invoice line item extraction" tool pricing',
    '"convert PDF reports" spreadsheet without manual entry tool',
    '"need" parse scanned forms CSV',
  ] },
  { id: 'receipt-operations', label: 'Receipt operations', queries: [
    '"need" convert receipt photos spreadsheet without manual entry',
    '"receipt OCR API" pricing bookkeeping',
    '"hire" receipt data extraction service',
    '"expense receipt to CSV" tool accountants',
    '"invoice receipt conversion" software quote',
    '"need" automate receipt reconciliation images',
  ] },
]

function modulo(value: number, divisor: number) { return ((value % divisor) + divisor) % divisor }

function utcDay(value: Date): number {
  return Math.floor(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / 86_400_000)
}

function parseLegacyQueries(raw: string): DiscoveryLane[] {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new ScoutConfigError('MARKET_SCOUT_QUERIES must be a JSON array of strings.') }
  if (!Array.isArray(parsed) || parsed.some((q) => typeof q !== 'string' || q.trim().length < 3)) {
    throw new ScoutConfigError('MARKET_SCOUT_QUERIES must be a JSON array of non-empty query strings.')
  }
  if (parsed.length === 0) throw new ScoutConfigError('MARKET_SCOUT_QUERIES must contain at least one query.')
  return [{ id: 'custom', label: 'Custom', queries: (parsed as string[]).map((q) => q.trim()).slice(0, MAX_QUERIES_PER_LANE) }]
}

function parseMatrix(raw: string): DiscoveryLane[] {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new ScoutConfigError('MARKET_SCOUT_QUERY_MATRIX must be valid JSON.') }
  const lanes = (parsed as { lanes?: unknown })?.lanes
  if (!Array.isArray(lanes) || lanes.length === 0 || lanes.length > MAX_LANES) throw new ScoutConfigError(`MARKET_SCOUT_QUERY_MATRIX must contain 1–${MAX_LANES} lanes.`)
  const ids = new Set<string>()
  return lanes.map((value, index) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ScoutConfigError(`Discovery lane ${index + 1} is invalid.`)
    const lane = value as Record<string, unknown>
    const id = typeof lane.id === 'string' ? lane.id.trim().toLowerCase() : ''
    const label = typeof lane.label === 'string' ? lane.label.trim() : id
    const queries = Array.isArray(lane.queries) ? lane.queries : []
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id) || ids.has(id)) throw new ScoutConfigError(`Discovery lane ${index + 1} needs a unique lowercase id.`)
    if (!label || label.length > 80 || queries.length === 0 || queries.length > MAX_QUERIES_PER_LANE || queries.some((query) => typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 300)) throw new ScoutConfigError(`Discovery lane "${id}" needs 1–${MAX_QUERIES_PER_LANE} valid queries.`)
    ids.add(id)
    return { id, label, queries: queries.map((query) => (query as string).trim()) }
  })
}

export function configuredDiscoveryMatrix(environment: Record<string, string | undefined> = process.env): DiscoveryLane[] {
  const matrix = environment.MARKET_SCOUT_QUERY_MATRIX
  if (matrix) return parseMatrix(matrix)
  const legacy = environment.MARKET_SCOUT_QUERIES
  if (legacy) return parseLegacyQueries(legacy)
  return DEFAULT_DISCOVERY_MATRIX.map((lane) => ({ ...lane, queries: [...lane.queries] }))
}

// Deterministically select a small, cross-lane slice for a UTC day. Every run
// on that day gets the same coverage; tomorrow advances each lane's query.
export function rotatingDiscoveryQueries(matrix: DiscoveryLane[], date = new Date()): DiscoveryQuery[] {
  if (matrix.length === 0) return []
  const day = utcDay(date)
  return Array.from({ length: MAX_QUERIES_PER_RUN }, (_, slot) => {
    const lane = matrix[modulo(day + slot, matrix.length)]
    const visit = Math.floor(slot / matrix.length)
    return { laneId: lane.id, query: lane.queries[modulo(day + visit, lane.queries.length)] }
  })
}

type ExaResult = { url?: unknown; title?: unknown; highlights?: unknown; text?: unknown; snippet?: unknown }

// Exa semantic search — a read-only retrieval API. The constructor keeps the
// network integration independently testable; environment access stays below.
export function createExaResearchSource(apiKey: string, queries: DiscoveryQuery[]): ResearchSource {
  return {
    id: 'exa',
    async search(fetchImpl) {
      const signals: RawSignal[] = []
      for (const { laneId, query } of queries) {
        let response: Awaited<ReturnType<FetchLike>>
        try {
          response = await fetchImpl('https://api.exa.ai/search', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            // The Scout needs attributable excerpts, not a generated answer.
            // Highlights are the current Exa raw-retrieval format selected for
            // this integration and keep the source URL alongside its evidence.
            body: JSON.stringify({ query, numResults: MAX_RESULTS_PER_QUERY, type: 'auto', contents: { highlights: true } }),
          })
        } catch {
          console.error('Exa search request failed for a query.')
          continue
        }
        if (!response.ok) { console.error('Exa search returned a non-OK status:', response.status); continue }
        const retrievedAt = new Date().toISOString()
        let body: unknown
        try { body = await response.json() } catch { continue }
        const results = (body as { results?: unknown }).results
        if (!Array.isArray(results)) continue
        for (const item of results.slice(0, MAX_RESULTS_PER_QUERY) as ExaResult[]) {
          if (typeof item.url !== 'string') continue
          signals.push({
            sourceId: 'exa',
            url: item.url,
            title: typeof item.title === 'string' ? item.title : '',
            snippet: Array.isArray(item.highlights)
              ? item.highlights.filter((highlight): highlight is string => typeof highlight === 'string').join(' ')
              : (typeof item.text === 'string' ? item.text : (typeof item.snippet === 'string' ? item.snippet : '')),
            query: `[${laneId}] ${query}`,
            retrievedAt,
          })
        }
      }
      return signals
    },
  }
}

// Fails closed without EXA_API_KEY.
function exaSource(): ResearchSource {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) throw new ScoutConfigError('EXA_API_KEY is required for the "exa" research source.')
  return createExaResearchSource(apiKey, rotatingDiscoveryQueries(configuredDiscoveryMatrix()))
}

const SOURCE_FACTORIES: Record<string, () => ResearchSource> = {
  exa: exaSource,
}

// Resolve the approved, credential-backed sources from MARKET_SCOUT_SOURCES.
// Throws (fail closed) if the list is empty, names an unknown source, or a listed
// source is missing its credential.
export function configuredScoutSources(): ResearchSource[] {
  const raw = process.env.MARKET_SCOUT_SOURCES ?? ''
  const ids = raw.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean)
  if (ids.length === 0) throw new ScoutConfigError('No approved research sources are configured (set MARKET_SCOUT_SOURCES).')
  const sources: ResearchSource[] = []
  for (const id of ids) {
    const factory = SOURCE_FACTORIES[id]
    if (!factory) throw new ScoutConfigError(`Unknown research source "${id}".`)
    sources.push(factory()) // factory throws ScoutConfigError if its credential is missing
  }
  return sources
}
