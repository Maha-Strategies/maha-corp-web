import assert from 'node:assert/strict'
import test from 'node:test'

import { PlaceSearchError, normalizePlaceSearchResponse, searchPlaces } from '../lib/place-search.ts'

test('normalizes valid geocoding results into explicit place choices', () => {
  const results = normalizePlaceSearchResponse({
    results: [{
      id: 1224085,
      name: 'Colombo',
      latitude: 6.93548,
      longitude: 79.84868,
      elevation: 7,
      timezone: 'Asia/Colombo',
      country: 'Sri Lanka',
      admin1: 'Western Province',
    }],
  })

  assert.deepEqual(results, [{
    id: 'openmeteo-1224085',
    label: 'Colombo, Western Province, Sri Lanka',
    latitude: 6.93548,
    longitude: 79.84868,
    elevationMeters: 7,
    timeZone: 'Asia/Colombo',
    provider: 'open-meteo-geonames',
  }])
})

test('drops malformed, out-of-range, and unknown-time-zone results', () => {
  const results = normalizePlaceSearchResponse({ results: [
    { name: 'Too far north', latitude: 91, longitude: 0, timezone: 'UTC' },
    { name: 'Unknown zone', latitude: 1, longitude: 2, timezone: 'Mars/Olympus' },
    { name: '', latitude: 1, longitude: 2, timezone: 'UTC' },
  ] })
  assert.deepEqual(results, [])
})

test('search encodes the query and returns normalized results', async () => {
  let requestedUrl = ''
  const mockFetch: typeof fetch = async (input) => {
    requestedUrl = String(input)
    return Response.json({ results: [{ id: 1, name: 'Reykjavik', country: 'Iceland', latitude: 64.1355, longitude: -21.8954, timezone: 'Atlantic/Reykjavik' }] })
  }

  const results = await searchPlaces(' Reykjavík, Iceland ', mockFetch)
  const url = new URL(requestedUrl)
  assert.equal(url.searchParams.get('name'), 'Reykjavík, Iceland')
  assert.equal(url.searchParams.get('count'), '5')
  assert.equal(results[0]?.timeZone, 'Atlantic/Reykjavik')
})

test('retries the settlement name when a region qualifier prevents a match', async () => {
  const requestedNames: string[] = []
  const mockFetch: typeof fetch = async (input) => {
    const name = new URL(String(input)).searchParams.get('name') ?? ''
    requestedNames.push(name)
    if (name.includes(',')) return Response.json({ results: [] })
    return Response.json({ results: [{
      id: 5031404,
      name: 'International Falls',
      admin1: 'Minnesota',
      country: 'United States',
      latitude: 48.60105,
      longitude: -93.41098,
      timezone: 'America/Chicago',
    }] })
  }

  const results = await searchPlaces('International Falls, MN', mockFetch)
  assert.deepEqual(requestedNames, ['International Falls, MN', 'International Falls'])
  assert.equal(results[0]?.label, 'International Falls, Minnesota, United States')
  assert.equal(results[0]?.timeZone, 'America/Chicago')
})

test('rejects invalid queries before contacting the provider', async () => {
  let called = false
  const mockFetch: typeof fetch = async () => { called = true; return Response.json({}) }
  await assert.rejects(() => searchPlaces('x', mockFetch), PlaceSearchError)
  assert.equal(called, false)
})

test('turns provider failures into a safe search error', async () => {
  const mockFetch: typeof fetch = async () => new Response(null, { status: 503 })
  await assert.rejects(() => searchPlaces('Colombo', mockFetch), /temporarily unavailable/)
})
