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

const MAX_QUERIES = 5
const MAX_RESULTS_PER_QUERY = 8

// Default approved discovery queries — themes adjacent to Maha's shippable
// utilities. Override with MARKET_SCOUT_QUERIES (JSON array of strings).
const DEFAULT_SCOUT_QUERIES = [
  'how do I convert receipts to a spreadsheet',
  'tool to extract expenses from receipt photos',
  'is there a tool to turn invoices into CSV',
  'best way to digitize paper receipts for bookkeeping',
]

function approvedQueries(): string[] {
  const raw = process.env.MARKET_SCOUT_QUERIES
  if (!raw) return DEFAULT_SCOUT_QUERIES.slice(0, MAX_QUERIES)
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new ScoutConfigError('MARKET_SCOUT_QUERIES must be a JSON array of strings.') }
  if (!Array.isArray(parsed) || parsed.some((q) => typeof q !== 'string' || q.trim().length < 3)) {
    throw new ScoutConfigError('MARKET_SCOUT_QUERIES must be a JSON array of non-empty query strings.')
  }
  if (parsed.length === 0) throw new ScoutConfigError('MARKET_SCOUT_QUERIES must contain at least one query.')
  return (parsed as string[]).map((q) => q.trim()).slice(0, MAX_QUERIES)
}

type ExaResult = { url?: unknown; title?: unknown; text?: unknown; snippet?: unknown }

// Exa semantic search — a read-only retrieval API. Fails closed without EXA_API_KEY.
function exaSource(): ResearchSource {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) throw new ScoutConfigError('EXA_API_KEY is required for the "exa" research source.')
  const queries = approvedQueries()

  return {
    id: 'exa',
    async search(fetchImpl) {
      const signals: RawSignal[] = []
      for (const query of queries) {
        let response: Awaited<ReturnType<FetchLike>>
        try {
          response = await fetchImpl('https://api.exa.ai/search', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, numResults: MAX_RESULTS_PER_QUERY, type: 'auto', contents: { text: { maxCharacters: 800 } } }),
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
            snippet: typeof item.text === 'string' ? item.text : (typeof item.snippet === 'string' ? item.snippet : ''),
            query,
            retrievedAt,
          })
        }
      }
      return signals
    },
  }
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
