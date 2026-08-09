import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import { inboundOperationHash, inboundOperationsAuthorized } from '@/lib/inbound-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS = ['start_review', 'mark_pilot_candidate', 'mark_introduced', 'close'] as const
type Action = typeof ACTIONS[number]

function line(value: unknown, name: string, min: number, max: number, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return ''
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${name} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The Navigator operation failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'Navigator assessment not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'That action is not allowed for the current state or consent record.' } }, 409)
  return jsonResponse({ error: { code: 'navigator_unavailable', message: 'Navigator operations are temporarily unavailable.' } }, 503)
}

export async function GET(request: Request) {
  if (!inboundOperationsAuthorized(request).authorized) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid inbound operations bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const { data, error } = await ledger.from('navigator_assessments').select('public_id,requester_name,requester_email,requester_organization,requester_role,deployment_stage,protocols,priority,primary_goal,controls,assessment,readiness_score,readiness_band,pilot_candidate,consent_to_follow_up,status,reviewer_note,reviewed_at,created_at').order('pilot_candidate', { ascending: false }).order('created_at', { ascending: true }).limit(100)
  if (error) return unavailable(error.code)
  return jsonResponse({ assessments: data ?? [], autonomousOutreachSupported: false }, 200)
}

export async function POST(request: Request) {
  const auth = inboundOperationsAuthorized(request)
  if (!auth.authorized || !auth.actorFingerprint) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid inbound operations bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let assessmentId: string, action: Action, note: string, idempotencyKey: string
  try {
    const body = await request.json() as Record<string, unknown>
    assessmentId = line(body.assessmentId, 'assessmentId', 36, 36)
    if (!/^nav_[a-f0-9]{32}$/.test(assessmentId)) throw new Error('assessmentId is invalid.')
    if (typeof body.action !== 'string' || !ACTIONS.includes(body.action as Action)) throw new Error('action is not supported.')
    action = body.action as Action
    note = line(body.note, 'note', 1, 2_000, true)
    idempotencyKey = line(body.idempotencyKey, 'idempotencyKey', 8, 120)
  } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid operation.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const { data, error } = await ledger.rpc('operate_navigator_assessment', { p_assessment_id: assessmentId, p_action: action, p_note: note || null, p_idempotency_hash: inboundOperationHash(idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ operation: data, autonomousOutreachSupported: false }, 200)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
