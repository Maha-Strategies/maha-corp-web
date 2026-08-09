import { authorizeObservatoryCron } from '@/lib/x402/observatory-cron'
import { PUBLIC_X402_OBSERVATORY_RESOURCES } from '@/lib/x402/observatory-registry'
import { runObservatorySweep } from '@/lib/x402/observatory-runner'
import { appendObservatoryObservations } from '@/lib/x402/observatory-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!authorizeObservatoryCron(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const observations = await runObservatorySweep({ resources: PUBLIC_X402_OBSERVATORY_RESOURCES })
    await appendObservatoryObservations(observations)
    return Response.json({
      schemaVersion: '1.0.0',
      observed: observations.length,
      resources: observations.map((observation) => ({
        resourceId: observation.resourceId,
        observedAt: observation.observedAt,
        challengeReachable: observation.challengeReachable,
        v2Compliant: observation.v2Compliant,
        schemaValid: observation.schemaValid,
        crawlerReceives402: observation.crawlerReceives402,
        bazaarState: observation.bazaarState,
        settlementState: observation.settlementState,
      })),
    })
  } catch (error) {
    console.error('x402 observatory sweep failed:', error instanceof Error ? error.message : 'unknown_error')
    return Response.json({ error: 'Observatory sweep failed.' }, { status: 503 })
  }
}
