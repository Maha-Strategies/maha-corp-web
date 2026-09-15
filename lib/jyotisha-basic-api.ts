import { buildBirthReport, type BirthInput } from './birth-report.ts'
import { zonedWallTimeToUtc } from './zoned-time.ts'
import { consumeReadingCapacity, type ReadingCapacity } from './jyotisha-capacity.ts'

export const BASIC_READING_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
}

export function parseBasicReading(value: unknown): BirthInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_input')
  const record = value as Record<string, unknown>
  const keys = ['date', 'time', 'timeZone', 'latitudeDegrees', 'longitudeDegrees', 'timingInstantUtc', 'birthTimeUncertaintyMinutes']
  if (Object.keys(record).some(key => !keys.includes(key))) throw new Error('unsupported_field')
  for (const key of ['date', 'time', 'timeZone', 'timingInstantUtc']) {
    if (typeof record[key] !== 'string' || record[key].length > 100) throw new Error('invalid_field')
  }
  for (const key of ['latitudeDegrees', 'longitudeDegrees', 'birthTimeUncertaintyMinutes']) {
    if (typeof record[key] !== 'number' || !Number.isFinite(record[key])) throw new Error('invalid_field')
  }
  const input = record as unknown as BirthInput
  const date = new Date(`${input.date}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date
    || Number(input.date.slice(0, 4)) < 1800 || Number(input.date.slice(0, 4)) > 2100) throw new Error('invalid_date')
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(input.timingInstantUtc!)) throw new Error('utc_required')
  const resolved = zonedWallTimeToUtc(input.date, input.time, input.timeZone)
  if (resolved.nonexistent || resolved.fold !== 'unambiguous') throw new Error('ambiguous_or_nonexistent_civil_time')
  return input
}

/** Anonymous basic adapter. No token, persistence, telemetry, cookies or external calls. */
export async function handleBasicJyotisha(request: Request, capacity: () => Promise<ReadingCapacity> = consumeReadingCapacity): Promise<Response> {
  const respond = (body: unknown, status: number) => Response.json(body, { status, headers: BASIC_READING_HEADERS })
  if (request.method !== 'POST') return respond({ error: 'post_required' }, 405)
  if (new URL(request.url).search) return respond({ error: 'query_parameters_not_supported' }, 400)
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return respond({ error: 'json_required' }, 415)
  const available = await capacity().catch(() => 'unavailable')
  if (available !== 'accepted') return Response.json({ error: available === 'limited' ? 'reading_capacity_reached' : 'reading_temporarily_unavailable' },
    { status: available === 'limited' ? 429 : 503, headers: { ...BASIC_READING_HEADERS, 'Retry-After': available === 'limited' ? '60' : '30' } })
  const reader = request.body?.getReader()
  if (!reader) return respond({ error: 'invalid_request' }, 400)
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 2048) { await reader.cancel(); return respond({ error: 'request_too_large' }, 413) }
      chunks.push(value)
    }
    const input = parseBasicReading(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    const report = buildBirthReport(input)
    return respond({ schemaVersion: 'jyotisha-basic/0.2', foundation: report.foundation, reading: report.reading }, 200)
  } catch {
    return respond({ error: 'invalid_or_unsupported_request',
      guidance: 'Check date, time zone, coordinates, UTC reference time and uncertainty (0–120 minutes). Ambiguous or nonexistent daylight-saving times require resolution before using this basic endpoint.' }, 400)
  } finally { reader.releaseLock() }
}
