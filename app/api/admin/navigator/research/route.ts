import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import { inboundOperationHash, inboundOperationsAuthorized } from '@/lib/inbound-operations'
import {
  buildNavigatorQualityGate,
  createNavigatorCandidateId,
  NAVIGATOR_DISPOSITIONS,
  parseNavigatorCandidate,
  type NavigatorDisposition,
} from '@/lib/maha-navigator-research'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CandidateRow = {
  public_id: string
  company_name: string
  company_domain: string
  rubric_key: string
  rubric_version: number
  disposition: NavigatorDisposition
  latest_review_rationale: string | null
  benchmark_position: number | null
  reviewed_at: string | null
  created_at: string
}

function line(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${name} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}

function text(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max) throw new Error(`${name} must contain between ${min} and ${max} characters.`)
  return parsed
}

function candidateId(value: unknown): string {
  const parsed = line(value, 'candidateId', 40, 40)
  if (!/^navacct_[a-f0-9]{32}$/.test(parsed)) throw new Error('candidateId is invalid.')
  return parsed
}

function claimId(value: unknown): string {
  const parsed = line(value, 'claimId', 39, 39)
  if (!/^navclm_[a-f0-9]{32}$/.test(parsed)) throw new Error('claimId is invalid.')
  return parsed
}

function unavailable(code?: string) {
  if (code === '22023' || code === '22007') return jsonResponse({ error: { code: 'invalid_request', message: 'The Navigator research operation failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'The requested Navigator research record was not found.' } }, 404)
  return jsonResponse({ error: { code: 'navigator_research_unavailable', message: 'Navigator research operations are temporarily unavailable.' } }, 503)
}

export async function GET(request: Request) {
  if (!inboundOperationsAuthorized(request).authorized) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid inbound operations bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const [rubricResult, candidateResult, claimResult, eventResult] = await Promise.all([
    ledger.from('navigator_research_rubrics').select('rubric_key,version,name,definition,status,created_at').eq('status', 'active').order('version', { ascending: false }).limit(1).maybeSingle(),
    ledger.from('navigator_research_candidates').select('public_id,company_name,company_domain,rubric_key,rubric_version,disposition,latest_review_rationale,benchmark_position,reviewed_at,created_at').order('benchmark_position', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }).limit(100),
    ledger.from('navigator_research_claims').select('public_id,candidate_id,claim_type,statement,source_url,source_published_on,observed_on,source_quality,evidence_freshness,confidence,supersedes_claim_id,created_at').order('created_at', { ascending: true }).limit(1_000),
    ledger.from('navigator_research_events').select('id,candidate_id,action,previous_disposition,new_disposition,challenged_claim_id,rationale,rubric_key,rubric_version,evidence_snapshot,actor_fingerprint,created_at').order('created_at', { ascending: true }).limit(2_000),
  ])
  const error = rubricResult.error ?? candidateResult.error ?? claimResult.error ?? eventResult.error
  if (error) return unavailable(error.code)
  const candidates = (candidateResult.data ?? []) as CandidateRow[]
  return jsonResponse({
    rubric: rubricResult.data,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      claims: (claimResult.data ?? []).filter((claim) => claim.candidate_id === candidate.public_id),
      events: (eventResult.data ?? []).filter((event) => event.candidate_id === candidate.public_id),
    })),
    qualityGate: buildNavigatorQualityGate(candidates.map((candidate) => ({ benchmarkPosition: candidate.benchmark_position, disposition: candidate.disposition }))),
    automationSupported: false,
  }, 200)
}

export async function POST(request: Request) {
  const auth = inboundOperationsAuthorized(request)
  if (!auth.authorized || !auth.actorFingerprint) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid inbound operations bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > 100_000) return jsonResponse({ error: { code: 'payload_too_large', message: 'Navigator research operations are limited to 100 KB.' } }, 413)
  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Request body must be an object.')
    body = parsed as Record<string, unknown>
  } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid operation.' } }, 400) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return unavailable()
  const now = new Date().toISOString()

  if (body.action === 'create_candidate') {
    try {
      const input = parseNavigatorCandidate(body)
      const { data, error } = await ledger.rpc('create_navigator_research_candidate', {
        p_candidate_id: createNavigatorCandidateId(),
        p_company_name: input.companyName,
        p_company_domain: input.companyDomain,
        p_rubric_key: input.rubricKey,
        p_rubric_version: input.rubricVersion,
        p_claims: input.claims,
        p_idempotency_hash: inboundOperationHash(input.idempotencyKey),
        p_actor_fingerprint: auth.actorFingerprint,
        p_at: now,
      })
      if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
      return jsonResponse({ operation: data, automationSupported: false }, 201)
    } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid candidate.' } }, 400) }
  }

  if (body.action === 'review_candidate' || body.action === 'challenge_claim') {
    try {
      const id = candidateId(body.candidateId)
      const rationale = text(body.rationale, 'rationale', 3, 3_000)
      const idempotencyKey = line(body.idempotencyKey, 'idempotencyKey', 8, 120)
      let disposition: NavigatorDisposition | null = null
      let challengedClaimId: string | null = null
      if (body.action === 'review_candidate') {
        if (typeof body.disposition !== 'string' || body.disposition === 'unreviewed' || !NAVIGATOR_DISPOSITIONS.includes(body.disposition as NavigatorDisposition)) throw new Error('disposition is not supported.')
        disposition = body.disposition as NavigatorDisposition
      } else challengedClaimId = claimId(body.claimId)
      const { data, error } = await ledger.rpc('operate_navigator_research_candidate', {
        p_candidate_id: id,
        p_action: body.action === 'review_candidate' ? 'review' : 'challenge',
        p_disposition: disposition,
        p_rationale: rationale,
        p_challenged_claim_id: challengedClaimId,
        p_idempotency_hash: inboundOperationHash(idempotencyKey),
        p_actor_fingerprint: auth.actorFingerprint,
        p_at: now,
      })
      if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
      return jsonResponse({ operation: data, automationSupported: false }, 200)
    } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid operation.' } }, 400) }
  }

  return jsonResponse({ error: { code: 'invalid_request', message: 'action is not supported.' } }, 400)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
