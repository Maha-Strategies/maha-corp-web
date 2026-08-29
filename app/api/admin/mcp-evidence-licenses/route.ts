import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import {
  buildMcpEvidenceGrantSnapshot,
  mcpEvidenceIdempotencySha256,
  mcpEvidencePlan,
  type McpEvidencePlanId,
} from '@/lib/mcp-evidence-licensing'
import {
  recordMcpEvidenceLicenseGrant,
  revokeMcpEvidenceLicenseGrant,
} from '@/lib/mcp-evidence-store'
import { authorizeRevenueOperations } from '@/lib/revenue-control-plane'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 16_384

function unauthorized(kind: 'unconfigured' | 'unauthorized') {
  return kind === 'unconfigured'
    ? jsonResponse({ error: { code: 'operations_unavailable', message: 'The revenue control plane is not configured.' } }, 503)
    : jsonResponse({ error: { code: 'unauthorized', message: 'A valid revenue control bearer token is required.' } }, 401)
}

function line(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum || /[\r\n]/.test(normalized)) throw new Error(`${field} must contain ${minimum}-${maximum} characters on one line.`)
  return normalized
}

function nonNegativeInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${field} must be a non-negative integer.`)
  return value as number
}

export async function GET(request: Request) {
  const authorization = authorizeRevenueOperations(request)
  if (authorization.kind !== 'authorized') return unauthorized(authorization.kind)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The MCP evidence license registry is unavailable.' } }, 503)
  const [grants, licenseEvents, executions, executionEvents] = await Promise.all([
    ledger.from('mcp_evidence_license_grants').select('grant_id,client_id,credential_id,plan_id,plan_version,monthly_quota_units,valid_from,valid_until,consideration_state,contracted_amount_usd_cents,received_amount_usd_cents,commercial_reference,terms_sha256,grant_sha256,issued_at').order('issued_at', { ascending: false }).limit(200),
    ledger.from('mcp_evidence_license_events').select('grant_id,event_type,reason,event_sha256,occurred_at').order('occurred_at', { ascending: false }).limit(500),
    ledger.from('mcp_evidence_executions').select('execution_id,grant_id,credential_id,plan_id,client_request_id,request_sha256,tool_name,release_id,release_sha256,quota_period_started_at,unit_quantity,reserved_at').order('reserved_at', { ascending: false }).limit(500),
    ledger.from('mcp_evidence_execution_events').select('execution_id,event_type,output_sha256,failure_code,event_sha256,occurred_at').order('occurred_at', { ascending: false }).limit(1000),
  ])
  if (grants.error || licenseEvents.error || executions.error || executionEvents.error) {
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Apply the MCP evidence licensing migration before using this route.' } }, 503)
  }
  return jsonResponse({
    grants: grants.data ?? [],
    licenseEvents: licenseEvents.data ?? [],
    executions: executions.data ?? [],
    executionEvents: executionEvents.data ?? [],
    limits: { grants: 200, licenseEvents: 500, executions: 500, executionEvents: 1000 },
    secretsIncluded: false,
    boundary: 'License state controls machine access only. It does not change canonical release state, review assurance, or empirical support.',
  }, 200)
}

export async function POST(request: Request) {
  const authorization = authorizeRevenueOperations(request)
  if (authorization.kind !== 'authorized') return unauthorized(authorization.kind)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'License operation exceeds 16 KB.' } }, 413)
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'License operation exceeds 16 KB.' } }, 413)

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Request must be an object.')
  } catch (cause) {
    return jsonResponse({ error: { code: 'invalid_request', message: cause instanceof Error ? cause.message : 'Invalid JSON.' } }, 400)
  }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The MCP evidence license registry is unavailable.' } }, 503)

  try {
    const operation = line(body.operation, 'operation', 5, 6)
    const idempotencyKey = line(body.idempotencyKey, 'idempotencyKey', 8, 160)
    if (operation === 'revoke') {
      const grantId = line(body.grantId, 'grantId', 41, 41)
      if (!/^mcpgrant_[a-f0-9]{32}$/.test(grantId)) throw new Error('grantId is invalid.')
      const reason = line(body.reason, 'reason', 20, 1000)
      const result = await revokeMcpEvidenceLicenseGrant(ledger, {
        grantId,
        reason,
        revokedAt: new Date().toISOString(),
        idempotencySha256: mcpEvidenceIdempotencySha256('license-revocation', idempotencyKey),
        actorFingerprint: authorization.actorFingerprint,
      })
      return jsonResponse({ operation, ...result }, 200)
    }
    if (operation !== 'grant') throw new Error('operation must be grant or revoke.')
    const credentialId = line(body.credentialId, 'credentialId', 37, 37)
    if (!/^cred_[a-f0-9]{32}$/.test(credentialId)) throw new Error('credentialId is invalid.')
    const plan = mcpEvidencePlan(body.planId)
    const { data: credential, error } = await ledger.from('agent_client_credentials').select('public_id,client_id,status,allowed_capabilities,expires_at').eq('public_id', credentialId).maybeSingle()
    if (error) throw new Error('Credential lookup failed.')
    if (!credential || credential.status !== 'active' || !(credential.allowed_capabilities as string[]).includes('mcp_evidence_retrieval')) throw new Error('Credential is not active and evidence-retrieval capable.')
    const issuedAt = new Date().toISOString()
    const validFrom = body.validFrom === undefined ? issuedAt : line(body.validFrom, 'validFrom', 20, 40)
    const validUntil = line(body.validUntil, 'validUntil', 20, 40)
    if (Date.parse(validUntil) > Date.parse(credential.expires_at)) throw new Error('License validity cannot exceed credential expiry.')
    if (body.considerationState !== undefined && body.considerationState !== 'internal-evaluation' && body.considerationState !== 'externally-contracted') throw new Error('considerationState is invalid.')
    const considerationState = body.considerationState === 'externally-contracted' ? 'externally-contracted' : 'internal-evaluation'
    const grant = buildMcpEvidenceGrantSnapshot({
      clientId: credential.client_id,
      credentialId,
      planId: plan.planId as McpEvidencePlanId,
      validFrom,
      validUntil,
      considerationState,
      contractedAmountUsdCents: nonNegativeInteger(body.contractedAmountUsdCents ?? 0, 'contractedAmountUsdCents'),
      receivedAmountUsdCents: nonNegativeInteger(body.receivedAmountUsdCents ?? 0, 'receivedAmountUsdCents'),
      commercialReference: body.commercialReference === undefined || body.commercialReference === null ? null : line(body.commercialReference, 'commercialReference', 3, 160),
      issuedAt,
    })
    const result = await recordMcpEvidenceLicenseGrant(
      ledger,
      grant,
      mcpEvidenceIdempotencySha256('license-grant', idempotencyKey),
      authorization.actorFingerprint,
    )
    return jsonResponse({ operation, ...result, grant: { ...grant, commercialReference: grant.commercialReference ? 'recorded-private' : null } }, 201)
  } catch (cause) {
    return jsonResponse({ error: { code: 'invalid_license_operation', message: cause instanceof Error ? cause.message : 'License operation failed.' } }, 400)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
