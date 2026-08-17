import { isKnownTimeZone } from './time-zones.ts'

const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'
const MAX_QUERY_LENGTH = 120
const MAX_RESULTS = 5

export interface PlaceSearchResult {
  id: string
  label: string
  latitude: number
  longitude: number
  elevationMeters: number | null
  timeZone: string
  provider: 'open-meteo-geonames'
}

export class PlaceSearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlaceSearchError'
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedString(value: unknown, maxLength = 160): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Convert the external provider's untrusted payload into the small shape used by the form. */
export function normalizePlaceSearchResponse(payload: unknown): PlaceSearchResult[] {
  const root = record(payload)
  if (!root || !Array.isArray(root.results)) return []

  const normalized: PlaceSearchResult[] = []
  for (const value of root.results) {
    const item = record(value)
    if (!item) continue

    const name = boundedString(item.name)
    const admin1 = boundedString(item.admin1)
    const country = boundedString(item.country)
    const latitude = finiteNumber(item.latitude)
    const longitude = finiteNumber(item.longitude)
    const timeZone = boundedString(item.timezone, 80)
    if (
      !name || latitude === null || latitude < -90 || latitude > 90
      || longitude === null || longitude < -180 || longitude > 180
      || !timeZone || !isKnownTimeZone(timeZone)
    ) continue

    const parts = [name]
    if (admin1 && admin1.toLocaleLowerCase() !== name.toLocaleLowerCase()) parts.push(admin1)
    if (country && !parts.some((part) => part.toLocaleLowerCase() === country.toLocaleLowerCase())) parts.push(country)
    const providerId = typeof item.id === 'number' || typeof item.id === 'string'
      ? String(item.id).slice(0, 80)
      : `${latitude},${longitude}`

    normalized.push({
      id: `openmeteo-${providerId}`,
      label: parts.join(', '),
      latitude,
      longitude,
      elevationMeters: finiteNumber(item.elevation),
      timeZone,
      provider: 'open-meteo-geonames',
    })
    if (normalized.length === MAX_RESULTS) break
  }
  return normalized
}

export async function searchPlaces(query: string, fetchImpl: typeof fetch = fetch): Promise<PlaceSearchResult[]> {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2 || normalizedQuery.length > MAX_QUERY_LENGTH) {
    throw new PlaceSearchError('Enter a place name between 2 and 120 characters.')
  }

  // The provider's `name` parameter searches a settlement name, so a useful
  // qualifier such as "MN" can accidentally become part of the name and yield
  // nothing. Try the full text first, then retry only the text before the first
  // comma. Results still display their region and country for explicit choice.
  const primaryName = normalizedQuery.split(',')[0]?.trim() ?? ''
  const candidates = [...new Set([normalizedQuery, primaryName])].filter((candidate) => candidate.length >= 2)
  for (const candidate of candidates) {
    const results = await requestPlaces(candidate, fetchImpl)
    if (results.length) return results
  }
  return []
}

async function requestPlaces(query: string, fetchImpl: typeof fetch): Promise<PlaceSearchResult[]> {
  const url = new URL(GEOCODING_ENDPOINT)
  url.searchParams.set('name', query)
  url.searchParams.set('count', String(MAX_RESULTS))
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  let response: Response
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
  } catch {
    throw new PlaceSearchError('Place search is temporarily unavailable.')
  }
  if (!response.ok) throw new PlaceSearchError('Place search is temporarily unavailable.')

  try {
    return normalizePlaceSearchResponse(await response.json())
  } catch {
    throw new PlaceSearchError('Place search returned an invalid response.')
  }
}
