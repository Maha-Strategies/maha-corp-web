import { compileEvidencePreflight, parseEvidencePreflightInput } from './evidence-preflight.ts'
import {
  EVIDENCE_PREFLIGHT_DAILY_LIMIT,
  type EvidencePreflightApiResponse,
} from './evidence-preflight-contract.ts'
import { EvidencePreflightConfigurationError, evidencePreflightTelemetry } from './evidence-preflight-server.ts'
import { PublicMpsAuditConfigurationError } from './public-mps-audit.ts'

const MAX_BODY_BYTES = 24_576

type LedgerOutcome = 'created' | 'idempotent' | 'conflict' | 'rate_limited'

export type EvidencePreflightLedger = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error?: { code?: string } | null }>
}

export type EvidencePreflightDependencies = {
  ledger: () => EvidencePreflightLedger | null
  visitorHash: (request: Request) => string
  requestHash: (visitorHash: string, requestId: string) => string
  payloadHmac: (visitorHash: string, input: ReturnType<typeof parseEvidencePreflightInput>) => string
}

function headers(extra: Record<string, string> = {}) {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extra,
  }
}

function json(body: object, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, { status, headers: headers(extraHeaders) })
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const expectedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
  try { return new URL(origin).host.toLowerCase() === expectedHost.toLowerCase() }
  catch { return false }
}

export function createEvidencePreflightHandlers(dependencies: EvidencePreflightDependencies) {
  return {
    async post(request: Request): Promise<Response> {
      if (!sameOrigin(request)) return json({ error: { code: 'origin_not_permitted', message: 'Request origin is not permitted.' } }, 403)
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
      }
      const contentLength = Number(request.headers.get('content-length') ?? '0')
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        return json({ error: { code: 'payload_too_large', message: 'Evidence preflight requests are limited to 24 KB.' } }, 413)
      }
      let raw: string
      try { raw = await request.text() }
      catch { return json({ error: { code: 'invalid_request', message: 'Request body could not be read.' } }, 400) }
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        return json({ error: { code: 'payload_too_large', message: 'Evidence preflight requests are limited to 24 KB.' } }, 413)
      }

      let input: ReturnType<typeof parseEvidencePreflightInput>
      try { input = parseEvidencePreflightInput(JSON.parse(raw)) }
      catch (error) {
        return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid evidence preflight request.' } }, 400)
      }

      let visitorHash: string
      let requestHash: string
      let payloadHmac: string
      try {
        visitorHash = dependencies.visitorHash(request)
        requestHash = dependencies.requestHash(visitorHash, input.requestId)
        payloadHmac = dependencies.payloadHmac(visitorHash, input)
      } catch (error) {
        if (error instanceof PublicMpsAuditConfigurationError || error instanceof EvidencePreflightConfigurationError) {
          console.error('Evidence preflight privacy ledger is not configured.')
        }
        return json({ error: { code: 'preflight_unavailable', message: 'The evidence preflight is temporarily unavailable.' } }, 503)
      }

      const result = compileEvidencePreflight(input)
      const telemetry = evidencePreflightTelemetry(result)
      const ledger = dependencies.ledger()
      if (!ledger) return json({ error: { code: 'preflight_unavailable', message: 'The evidence preflight is temporarily unavailable.' } }, 503)
      const { data, error } = await ledger.rpc('record_evidence_preflight_request', {
        p_request_hash: requestHash,
        p_visitor_hash: visitorHash,
        p_payload_hmac: payloadHmac,
        p_claim_count: telemetry.claimCount,
        p_input_char_count: telemetry.inputCharCount,
        p_doi_count: telemetry.doiCount,
        p_url_count: telemetry.urlCount,
        p_ready_count: telemetry.readyCount,
        p_blocked_count: telemetry.blockedCount,
        p_daily_limit: EVIDENCE_PREFLIGHT_DAILY_LIMIT,
      })
      if (error || !['created', 'idempotent', 'conflict', 'rate_limited'].includes(String(data))) {
        console.error('Evidence preflight request ledger failed:', error?.code ?? 'invalid_result')
        return json({ error: { code: 'preflight_unavailable', message: 'The evidence preflight is temporarily unavailable.' } }, 503)
      }
      const outcome = data as LedgerOutcome
      if (outcome === 'conflict') {
        return json({ error: { code: 'idempotency_conflict', message: 'This request ID was already used with different content.' } }, 409)
      }
      if (outcome === 'rate_limited') {
        return json({ error: { code: 'rate_limited', message: 'Free evidence preflight limit reached. Retry tomorrow.' } }, 429, { 'Retry-After': '86400' })
      }
      const response: EvidencePreflightApiResponse = { status: outcome, result }
      return json(response, outcome === 'created' ? 201 : 200)
    },
  }
}

export function evidencePreflightOptionsResponse() {
  return new Response(null, { status: 204, headers: { ...headers(), Allow: 'POST, OPTIONS' } })
}
