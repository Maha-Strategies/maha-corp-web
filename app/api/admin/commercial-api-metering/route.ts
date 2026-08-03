import { jsonResponse } from '@/lib/agent-inquiries'
import { aggregateAgentDiscovery, type AgentDiscoveryUsageRow } from '@/lib/agent-discovery-metering'
import { aggregateCommercialApiUsage, type CommercialApiUsageRow } from '@/lib/commercial-api-metering'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeRevenueOperations } from '@/lib/revenue-control-plane'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_DAYS = 366

function days(value: string | null) {
  const parsed = Number(value ?? '90')
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_DAYS ? parsed : 90
}

export async function GET(request: Request) {
  const authorization = authorizeRevenueOperations(request)
  if (authorization.kind === 'unconfigured') return jsonResponse({ error: { code: 'operations_unavailable', message: 'The revenue control plane is not configured.' } }, 503)
  if (authorization.kind === 'unauthorized') return jsonResponse({ error: { code: 'unauthorized', message: 'A valid revenue control bearer token is required.' } }, 401)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The commercial API meter is not configured.' } }, 503)

  const lookbackDays = days(new URL(request.url).searchParams.get('days'))
  const since = new Date(Date.now() - (lookbackDays - 1) * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await ledger
    .from('commercial_api_usage_daily')
    .select('usage_day,operation,endpoint,method,status_class,request_count,unit_quantity')
    .gte('usage_day', since)
    .order('usage_day', { ascending: false })
    .limit(20_000)

  if (error) return jsonResponse({ error: { code: 'meter_unavailable', message: 'Apply the commercial API metering migration before using this board.' } }, 503)

  // Discovery metering is reported alongside paid usage but degraded
  // independently: an unapplied discovery migration must not take down a board
  // that was working before it existed.
  const discovery = await ledger
    .from('agent_discovery_usage_daily')
    .select('usage_day,surface,client_class,request_count')
    .gte('usage_day', since)
    .order('usage_day', { ascending: false })
    .limit(20_000)

  return jsonResponse({
    privacy: 'Daily aggregate only. No IP addresses, user agents, tokens, request bodies, response bodies, referrers, emails, or visitor identifiers are collected. Discovery requests are counted against a seven-value client class derived per request and never stored verbatim.',
    lookbackDays,
    since,
    ...aggregateCommercialApiUsage((data ?? []) as CommercialApiUsageRow[]),
    discovery: discovery.error
      ? { available: false, reason: 'Apply the agent discovery metering migration to measure the discovery surfaces.' }
      : { available: true, ...aggregateAgentDiscovery((discovery.data ?? []) as AgentDiscoveryUsageRow[]) },
  }, 200)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
