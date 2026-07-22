import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { aggregateConversionMeasurements } from '@/lib/conversion-measurement'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { microUtilityHash, microUtilityValidationId, parseMicroUtilityAction, parseMicroUtilityValidation } from '@/lib/micro-utility-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized && result.actorFingerprint ? result : null }
function unavailable(code?: string) { if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The micro-utility validation failed validation.' } }, 400); if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'The linked evaluation or experiment was not found.' } }, 404); if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'That validation transition is not allowed.' } }, 409); return jsonResponse({ error: { code: 'micro_utility_validation_unavailable', message: 'The micro-utility validation ledger is temporarily unavailable.' } }, 503) }

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const [{ data: validations, error: validationError }, { data: evaluations, error: evaluationError }, { data: experiments, error: experimentError }, { data: measurements, error: measurementError }] = await Promise.all([
    ledger.from('micro_utility_validations').select('public_id,som_evaluation_id,experiment_id,utility,target_price_cents,target_paid_orders,measure_after_on,status,created_at,updated_at').order('created_at', { ascending: false }).limit(100),
    ledger.from('som_evaluations').select('public_id,decision,score').in('decision', ['build_candidate','validate_first']).order('created_at', { ascending: false }).limit(100),
    ledger.from('growth_experiments').select('public_id,hypothesis,status').eq('source_kind', 'demand_cluster').order('created_at', { ascending: false }).limit(100),
    ledger.from('conversion_measurements').select('experiment_id,event_type,source_kind').order('recorded_at', { ascending: false }).limit(5000),
  ])
  if (validationError) return unavailable(validationError.code); if (evaluationError || experimentError) return unavailable(evaluationError?.code ?? experimentError?.code)
  return jsonResponse({ validations: validations ?? [], somEvaluations: evaluations ?? [], experiments: experiments ?? [], conversionAttribution: measurementError ? null : aggregateConversionMeasurements(measurements ?? []), conversionMeasurementUnavailable: Boolean(measurementError), autonomousBuildSupported: false, autonomousPublishingSupported: false, autonomousSpendSupported: false }, 200)
}
export async function POST(request: Request) {
  const auth = authorized(request); if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown; try { body = await request.json() } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  if (typeof body === 'object' && body !== null && !Array.isArray(body) && 'action' in body) { let action: ReturnType<typeof parseMicroUtilityAction>; try { action = parseMicroUtilityAction(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid action.' } }, 400) }; const { data, error } = await ledger.rpc('operate_micro_utility_validation', { p_validation_id: action.validationId, p_action: action.action, p_idempotency_hash: microUtilityHash(action.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() }); if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code); return jsonResponse({ operation: data, autonomousPublishingSupported: false }, 200) }
  let input: ReturnType<typeof parseMicroUtilityValidation>; try { input = parseMicroUtilityValidation(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid micro-utility validation.' } }, 400) }
  const { data, error } = await ledger.rpc('create_micro_utility_validation', { p_validation_id: microUtilityValidationId(), p_som_evaluation_id: input.somEvaluationId, p_experiment_id: input.experimentId, p_utility: input.utility, p_target_price_cents: input.targetPriceCents, p_target_paid_orders: input.targetPaidOrders, p_measure_days: input.measureDays, p_idempotency_hash: microUtilityHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ validation: data, autonomousPublishingSupported: false }, 201)
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
