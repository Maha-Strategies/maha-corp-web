import { timingSafeEqual } from 'node:crypto'

import { createComputationalWitnessRegistryClient, purgeExpiredComputationalWitnessPayloads } from '@/lib/computational-witness-registry-store'
import { WITNESS_RESPONSE_HEADERS } from '@/lib/computational-witness-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!expected || !supplied) return false
  const expectedBytes = Buffer.from(expected), suppliedBytes = Buffer.from(supplied)
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: WITNESS_RESPONSE_HEADERS })
  const client = createComputationalWitnessRegistryClient()
  if (!client) return Response.json({ error: 'Witness registry unavailable.' }, { status: 503, headers: WITNESS_RESPONSE_HEADERS })
  try {
    const purged = await purgeExpiredComputationalWitnessPayloads(client, new Date().toISOString(), 500)
    return Response.json({ purged, immutableIdentityRetained: true }, { headers: WITNESS_RESPONSE_HEADERS })
  } catch (error) {
    console.error('[WITNESS_RETENTION_PURGE_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return Response.json({ error: 'Witness retention purge failed.' }, { status: 503, headers: WITNESS_RESPONSE_HEADERS })
  }
}
