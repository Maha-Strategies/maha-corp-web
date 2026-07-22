import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { parseSomEvaluation, somEvaluationId, somHash } from '@/lib/som-evaluator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The SOM evaluation failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'Demand cluster not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'Only a validated demand cluster can be evaluated.' } }, 409)
  return jsonResponse({ error: { code: 'som_evaluator_unavailable', message: 'The SOM evaluator is temporarily unavailable.' } }, 503)
}
function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized && result.actorFingerprint ? result : null }

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const [{ data: evaluations, error: evaluationError }, { data: clusters, error: clusterError }] = await Promise.all([
    ledger.from('som_evaluations').select('public_id,demand_cluster_id,decision,score,price_cents,variable_cost_cents,monthly_operating_cost_cents,one_time_build_cost_cents,expected_monthly_qualified_demand,expected_conversion_rate_bps,expected_monthly_orders,expected_monthly_revenue_cents,expected_monthly_contribution_cents,gross_margin_percent,payback_months,competitor_pressure,willingness_to_pay_evidence,policy_risk,assumption_note,created_at').order('created_at', { ascending: false }).limit(100),
    ledger.from('demand_validation_clusters').select('public_id,title,buyer,job_to_be_done,offer,score').eq('status', 'validated').order('score', { ascending: false }).limit(100),
  ])
  if (evaluationError) return unavailable(evaluationError.code)
  if (clusterError) return unavailable(clusterError.code)
  return jsonResponse({ evaluations: evaluations ?? [], validatedDemandClusters: clusters ?? [], autonomousBuildSupported: false, autonomousPublishingSupported: false, autonomousSpendSupported: false }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request); if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown; try { body = await request.json() } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  let input: ReturnType<typeof parseSomEvaluation>; try { input = parseSomEvaluation(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid SOM evaluation.' } }, 400) }
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const { data, error } = await ledger.rpc('create_som_evaluation', {
    p_evaluation_id: somEvaluationId(), p_demand_cluster_id: input.demandClusterId, p_price_cents: input.priceCents, p_variable_cost_cents: input.variableCostCents, p_monthly_operating_cost_cents: input.monthlyOperatingCostCents, p_one_time_build_cost_cents: input.oneTimeBuildCostCents,
    p_expected_monthly_qualified_demand: input.expectedMonthlyQualifiedDemand, p_expected_conversion_rate_bps: input.expectedConversionRateBps, p_competitor_pressure: input.competitorPressure, p_willingness_to_pay_evidence: input.willingnessToPayEvidence, p_policy_risk: input.policyRisk, p_assumption_note: input.assumptionNote,
    p_idempotency_hash: somHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString(),
  })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ evaluation: data, autonomousBuildSupported: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
