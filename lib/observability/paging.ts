import type { ReceivedOpsAlert } from './receiver.ts'

// Alerts terminated in a single mailbox, and that failed silently once: the
// receiver returned 503 and a Production health failure went unannounced for
// over an hour. Email cannot be the primary channel, because nothing about it
// requires a human to acknowledge anything.
//
// This translates a verified maha.ops-alert.v1 into PagerDuty's Events API v2,
// which gives acknowledgement, escalation when nobody acks, and automatic
// resolution when the paired recovery alert arrives. Email stays as the
// fallback recipient in the receiver.

export const PAGERDUTY_EVENTS_URL = 'https://events.pagerduty.com/v2/enqueue'

export type PagingEvent = {
  routing_key: string
  event_action: 'trigger' | 'resolve'
  dedup_key: string
  payload?: {
    summary: string
    severity: 'critical' | 'error' | 'warning'
    source: string
    component: string
    group: string
    class: string
    timestamp: string
    custom_details: Record<string, string | number | boolean>
  }
}

const SUMMARIES: Record<ReceivedOpsAlert['event'], string> = {
  'tenant.low_credit': 'Low tenant credit balance',
  'mcp.upstream_connectivity_failure': 'MCP upstream connectivity failure',
  'release.health_failure': 'Production release health failure',
  'release.health_recovered': 'Production release health recovered',
  'release.recovery_drill_failure': 'Production recovery drill failure',
  'release.recovery_drill_recovered': 'Production recovery drill recovered',
}

const SEVERITIES: Record<ReceivedOpsAlert['event'], 'critical' | 'error' | 'warning'> = {
  'tenant.low_credit': 'warning',
  'mcp.upstream_connectivity_failure': 'error',
  'release.health_failure': 'critical',
  'release.health_recovered': 'critical',
  'release.recovery_drill_failure': 'error',
  'release.recovery_drill_recovered': 'error',
}

/**
 * A trigger and its paired recovery must share a deduplication key, or the
 * recovery opens a second incident instead of resolving the first. The event
 * ID cannot serve: it is anchored to the last successful run and so differs
 * between the two.
 *
 * Tenant-scoped events key per tenant, so one noisy tenant cannot suppress an
 * incident for another.
 */
export function dedupKey(alert: ReceivedOpsAlert): string {
  switch (alert.event) {
    case 'release.health_failure':
    case 'release.health_recovered':
      return 'maha:release.health'
    case 'release.recovery_drill_failure':
    case 'release.recovery_drill_recovered':
      return 'maha:release.recovery_drill'
    case 'tenant.low_credit':
      return `maha:tenant.low_credit:${alert.tenantId}`
    case 'mcp.upstream_connectivity_failure':
      return `maha:mcp.upstream:${alert.tenantId}`
  }
}

export function isRecovery(alert: ReceivedOpsAlert): boolean {
  return alert.event.endsWith('_recovered')
}

export function pagingEvent(alert: ReceivedOpsAlert, routingKey: string): PagingEvent {
  const key = dedupKey(alert)
  // A resolve carries no payload; PagerDuty matches it to the open incident by
  // deduplication key alone.
  if (isRecovery(alert)) {
    return { routing_key: routingKey, event_action: 'resolve', dedup_key: key }
  }
  return {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: key,
    payload: {
      summary: `${SUMMARIES[alert.event]} (${alert.eventId})`,
      severity: SEVERITIES[alert.event],
      source: 'maha-corp-web',
      component: alert.event,
      group: 'maha-production',
      class: 'ops-alert',
      timestamp: alert.occurredAt,
      // Already bounded and scrubbed upstream: at most 32 fields, no bodies,
      // headers, tokens, or request contents.
      custom_details: alert.data,
    },
  }
}

export type PagingOutcome = 'delivered' | 'not_configured' | 'failed'

/**
 * Best-effort and bounded. The caller falls back to email on anything other
 * than a delivered result, so a paging outage cannot produce silence.
 */
export async function deliverPagingEvent(
  alert: ReceivedOpsAlert,
  routingKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<PagingOutcome> {
  const key = routingKey?.trim()
  if (!key) return 'not_configured'
  try {
    const response = await fetchImpl(PAGERDUTY_EVENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pagingEvent(alert, key)),
      signal: AbortSignal.timeout(5_000),
    })
    return response.ok ? 'delivered' : 'failed'
  } catch {
    return 'failed'
  }
}
