import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { experimentHash, experimentId, parseExperiment, parseExperimentAction } from '@/lib/experiment-control'
import { aggregateConversionMeasurements } from '@/lib/conversion-measurement'
import { authorizeMarketMapping } from '@/lib/market-mapping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The experiment failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'Experiment not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'That transition is not allowed for this experiment.' } }, 409)
  return jsonResponse({ error: { code: 'experiments_unavailable', message: 'The experiment ledger is temporarily unavailable.' } }, 503)
}

function authorized(request: Request) {
  const result = authorizeMarketMapping(request)
  return result.authorized && result.actorFingerprint ? result : null
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const [{ data, error }, { data: measurements, error: measurementError }] = await Promise.all([
    ledger.from('growth_experiments').select('public_id,source_kind,source_reference,hypothesis,target_url,intended_change,call_to_action,primary_kpi,baseline_value,baseline_observed_on,measure_after_on,status,outcome_value,outcome_note,approved_at,prepared_at,published_at,measured_at,created_at,updated_at').order('created_at', { ascending: false }).limit(100),
    ledger.from('conversion_measurements').select('experiment_id,event_type,source_kind').order('recorded_at', { ascending: false }).limit(5000),
  ])
  if (error) return unavailable(error.code)
  return jsonResponse({
    experiments: data ?? [],
    conversionAttribution: measurementError ? null : aggregateConversionMeasurements(measurements ?? []),
    conversionMeasurementUnavailable: Boolean(measurementError),
    autonomousPublishingSupported: false, autonomousSpendSupported: false, autonomousOutreachSupported: false,
  }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown
  try { body = await request.json() } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  if (typeof body === 'object' && body !== null && !Array.isArray(body) && 'action' in body) {
    let action: ReturnType<typeof parseExperimentAction>
    try { action = parseExperimentAction(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid experiment operation.' } }, 400) }
    const { data, error } = await ledger.rpc('operate_growth_experiment', { p_experiment_id: action.experimentId, p_action: action.action, p_note: action.note || null, p_outcome_value: action.outcomeValue, p_idempotency_hash: experimentHash(action.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ operation: data, autonomousPublishingSupported: false }, 200)
  }
  let input: ReturnType<typeof parseExperiment>
  try { input = parseExperiment(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid experiment.' } }, 400) }
  const { data, error } = await ledger.rpc('create_growth_experiment', { p_experiment_id: experimentId(), p_source_kind: input.sourceKind, p_source_reference: input.sourceReference, p_hypothesis: input.hypothesis, p_target_url: input.targetUrl, p_intended_change: input.intendedChange, p_call_to_action: input.callToAction, p_primary_kpi: input.primaryKpi, p_baseline_value: input.baselineValue, p_baseline_observed_on: input.baselineObservedOn, p_measure_after_on: input.measureAfterOn, p_idempotency_hash: experimentHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ experiment: data, autonomousPublishingSupported: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
