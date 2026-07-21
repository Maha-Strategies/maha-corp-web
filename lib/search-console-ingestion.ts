// Google Search Console export ingestion. This is deliberately a read-only,
// manual CSV import: it never writes to Google, never stores the raw export,
// and only emits high-intent, Maha-capability-matched proposals for review.

import { createHash } from 'node:crypto'

import { candidateFromSignal, candidateToSubmission, type RawSignal } from './market-scout.ts'
import { marketOpportunityScore, parseMarketOpportunity, type MarketOpportunityInput } from './market-mapping.ts'

const MAX_CSV_BYTES = 256_000
const MAX_ROWS = 2_000
const MIN_SEARCH_CONSOLE_SCORE = 50

export type SearchConsoleQuery = { query: string; clicks: number; impressions: number; ctr: number; position: number }
export type SearchConsoleImport = { observedAt: string; rows: SearchConsoleQuery[] }

function csvRows(value: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quoted && char === '"' && value[index + 1] === '"') { cell += '"'; index += 1; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (!quoted && char === ',') { row.push(cell); cell = ''; continue }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && value[index + 1] === '\n') index += 1
      row.push(cell); if (row.some((entry) => entry.trim() !== '')) rows.push(row); row = []; cell = ''; continue
    }
    cell += char
  }
  if (quoted) throw new Error('The Search Console CSV has an unclosed quoted value.')
  row.push(cell); if (row.some((entry) => entry.trim() !== '')) rows.push(row)
  return rows
}

function whole(value: string, field: string): number {
  if (!/^\d+$/.test(value.trim())) throw new Error(`${field} must be a whole number.`)
  return Number(value.trim())
}

function decimal(value: string, field: string): number {
  const parsed = Number(value.replace('%', '').trim())
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${field} must be a non-negative number.`)
  return parsed
}

export function parseSearchConsoleQueriesCsv(csv: unknown): SearchConsoleQuery[] {
  if (typeof csv !== 'string' || Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) throw new Error('The Search Console CSV must be a text file up to 256 KB.')
  const rows = csvRows(csv)
  const [header, ...data] = rows
  if (!header || header.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim()).join('|') !== 'Top queries|Clicks|Impressions|CTR|Position') throw new Error('Upload the Google Search Console “Queries.csv” export.')
  if (data.length === 0 || data.length > MAX_ROWS) throw new Error(`The export must contain between 1 and ${MAX_ROWS} query rows.`)
  return data.map((row, index) => {
    if (row.length !== 5) throw new Error(`Query row ${index + 2} has an unexpected number of columns.`)
    const query = row[0].trim().replace(/\s+/g, ' ')
    if (query.length < 2 || query.length > 500) throw new Error(`Query row ${index + 2} is invalid.`)
    return { query, clicks: whole(row[1], 'Clicks'), impressions: whole(row[2], 'Impressions'), ctr: decimal(row[3], 'CTR'), position: decimal(row[4], 'Position') }
  })
}

export function parseSearchConsoleImport(value: unknown): SearchConsoleImport {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  if (typeof body.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.observedAt) || Number.isNaN(Date.parse(`${body.observedAt}T00:00:00.000Z`))) throw new Error('observedAt must be an ISO date (YYYY-MM-DD).')
  return { observedAt: body.observedAt, rows: parseSearchConsoleQueriesCsv(body.csv) }
}

function searchUrl(query: string) { return `https://search.google.com/search-console/performance?q=${encodeURIComponent(query)}` }
function reference(observedAt: string, query: string) { return `gsc:${observedAt}:${createHash('sha256').update(query.toLowerCase()).digest('hex').slice(0, 24)}` }

export function searchConsoleSubmission(row: SearchConsoleQuery, observedAt: string): (MarketOpportunityInput & { idempotencyKey: string }) | null {
  const signal: RawSignal = {
    sourceId: 'search_console', url: searchUrl(row.query), title: `Search Console query: ${row.query}`,
    snippet: `First-party Google Search Console query observed ${observedAt}: ${row.clicks} clicks, ${row.impressions} impressions, ${row.ctr}% CTR, average position ${row.position}.`,
    query: row.query, retrievedAt: `${observedAt}T00:00:00.000Z`,
  }
  const candidate = candidateFromSignal(signal)
  if (!candidate) return null
  const body = { ...candidateToSubmission(candidate, `gsc:${observedAt}`), source: 'search_console' as const, sourceReference: reference(observedAt, row.query) }
  parseMarketOpportunity(body)
  return marketOpportunityScore(body) >= MIN_SEARCH_CONSOLE_SCORE ? body : null
}

export function searchConsoleImportCandidates(input: SearchConsoleImport) {
  const eligible = input.rows.map((row) => searchConsoleSubmission(row, input.observedAt)).filter((row): row is NonNullable<typeof row> => row !== null)
  return { eligible, skipped: input.rows.length - eligible.length }
}
