import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { demandClusterId, demandGateHash, parseDemandCluster } from '@/lib/demand-gate'
import { authorizeMarketMapping } from '@/lib/market-mapping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The demand cluster failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'An approved market signal was not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'Only approved market signals can enter a demand cluster.' } }, 409)
  return jsonResponse({ error: { code: 'demand_validation_unavailable', message: 'The demand-validation ledger is temporarily unavailable.' } }, 503)
}

function authorized(request: Request) {
  const result = authorizeMarketMapping(request)
  return result.authorized && result.actorFingerprint ? result : null
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const [{ data: clusters, error: clusterError }, { data: signals, error: signalError }] = await Promise.all([
    ledger.from('demand_validation_clusters').select('public_id,title,buyer,job_to_be_done,offer,status,score,signal_count,direct_demand_signals,source_channels,average_commercial_intent,created_at,updated_at').order('created_at', { ascending: false }).limit(100),
    ledger.from('market_opportunities').select('public_id,source,signal_class,title,buyer,problem,proposed_solution,commercial_intent,score,status').eq('status', 'approved_for_experiment').order('score', { ascending: false }).limit(100),
  ])
  if (clusterError) return unavailable(clusterError.code)
  if (signalError) return unavailable(signalError.code)
  return jsonResponse({ clusters: clusters ?? [], approvedSignals: signals ?? [], autonomousPublishingSupported: false, autonomousSpendSupported: false, autonomousOutreachSupported: false }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown
  try { body = await request.json() } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  let input: ReturnType<typeof parseDemandCluster>
  try { input = parseDemandCluster(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid demand cluster.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const { data, error } = await ledger.rpc('create_demand_validation_cluster', {
    p_cluster_id: demandClusterId(), p_title: input.title, p_buyer: input.buyer, p_job_to_be_done: input.jobToBeDone, p_offer: input.offer,
    p_opportunity_ids: input.opportunityIds, p_idempotency_hash: demandGateHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString(),
  })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ cluster: data, autonomousPublishingSupported: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
