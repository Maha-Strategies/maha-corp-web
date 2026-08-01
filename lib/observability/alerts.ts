import { createHash, randomUUID } from 'node:crypto'
import { Redis } from '@upstash/redis'

import { assertPublicUpstreamHost } from '../mcp-gateway'
import { scopedRedisKey } from '../redis-namespace'
import { captureOperationalError, traceRedisQuery } from './telemetry'
import { lowCreditAlertRequired, opsAlertConfig, signOpsAlert } from './contracts'

const redis = Redis.fromEnv()

type OpsAlertEvent = 'tenant.low_credit' | 'mcp.upstream_connectivity_failure'

function digest(value: string) { return createHash('sha256').update(value).digest('hex') }

async function deliverAlert(input: { event: OpsAlertEvent; tenantId: string; dedupe: string; ttlSeconds: number; data: Record<string, string | number | boolean> }) {
  let config
  try { config = opsAlertConfig() } catch (error) { captureOperationalError(error, 'ops-webhook', 'configuration'); return { kind: 'misconfigured' as const } }
  if (!config) return { kind: 'not_configured' as const }
  const dedupeKey = scopedRedisKey(`ops:alert:${digest(input.dedupe)}`)
  try {
    const claimed = await traceRedisQuery('SET', () => redis.set(dedupeKey, 'pending', { nx: true, ex: input.ttlSeconds }))
    if (claimed !== 'OK') return { kind: 'duplicate' as const }
    const payload = {
      schema: 'maha.ops-alert.v1', event: input.event,
      eventId: `alert_${randomUUID().replaceAll('-', '')}`,
      occurredAt: new Date().toISOString(), tenantId: input.tenantId, data: input.data,
    }
    const body = JSON.stringify(payload)
    await assertPublicUpstreamHost(config.url)
    const response = await fetch(config.url, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(5_000), body,
      headers: {
        'Content-Type': 'application/json',
        'X-Maha-Alert-Event': input.event,
        'X-Maha-Alert-ID': payload.eventId,
        'X-Maha-Alert-Signature': signOpsAlert(body, config.secret),
      },
    })
    if (!response.ok) throw new Error(`Operations webhook returned HTTP ${response.status}.`)
    await traceRedisQuery('SET', () => redis.set(dedupeKey, 'delivered', { ex: input.ttlSeconds }))
    return { kind: 'delivered' as const }
  } catch (error) {
    captureOperationalError(error, 'ops-webhook', input.event)
    try { await traceRedisQuery('SET', () => redis.set(dedupeKey, 'retry', { ex: 300 })) } catch { /* best-effort retry marker */ }
    return { kind: 'failed' as const }
  }
}

export async function maybeSendLowCreditAlert(input: { tenantId: string; remainingCredits: number }) {
  let config
  try { config = opsAlertConfig() } catch (error) { captureOperationalError(error, 'ops-webhook', 'configuration'); return { kind: 'misconfigured' as const } }
  if (!config) return { kind: 'not_configured' as const }
  if (!lowCreditAlertRequired(input.remainingCredits, config.lowCreditThreshold)) return { kind: 'not_needed' as const }
  return deliverAlert({
    event: 'tenant.low_credit', tenantId: input.tenantId,
    dedupe: `low-credit:${input.tenantId}:${Math.floor(Date.now() / 86_400_000)}`, ttlSeconds: 86_400,
    data: { remainingCredits: input.remainingCredits, thresholdCredits: config.lowCreditThreshold },
  })
}

export async function sendMcpConnectivityAlert(input: { tenantId: string; serverId: string; hostname: string; failure: string; status?: number }) {
  return deliverAlert({
    event: 'mcp.upstream_connectivity_failure', tenantId: input.tenantId,
    dedupe: `mcp-connectivity:${input.tenantId}:${input.serverId}:${Math.floor(Date.now() / 300_000)}`, ttlSeconds: 300,
    data: { serverId: input.serverId, upstreamHost: input.hostname, failure: input.failure, ...(input.status ? { httpStatus: input.status } : {}) },
  })
}
