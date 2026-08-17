import { PlaceSearchError, searchPlaces } from '@/lib/place-search'

export async function POST(request: Request) {
  let query = ''
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
      const candidate = (body as Record<string, unknown>).query
      if (typeof candidate === 'string') query = candidate
    }
  } catch {
    return Response.json({ error: 'Enter a valid place name.' }, { status: 400 })
  }

  try {
    const results = await searchPlaces(query)
    return Response.json(
      {
        results,
        provider: {
          name: 'Open-Meteo Geocoding',
          dataSource: 'GeoNames',
          attributionUrl: 'https://open-meteo.com/en/docs/geocoding-api',
        },
      },
      { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    )
  } catch (error) {
    const status = error instanceof PlaceSearchError && error.message.startsWith('Enter ') ? 400 : 502
    const message = status === 400 && error instanceof Error ? error.message : 'Place search is temporarily unavailable.'
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
