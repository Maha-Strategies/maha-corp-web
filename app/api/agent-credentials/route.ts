import { createHash } from 'node:crypto'

import { type OfferId, bearerMatches, jsonResponse } from '@/lib/agent-inquiries'
import {
  createClientId,
  createCredentialId,
  createCredentialSecret,
  parseAllowedOfferIds,
  validClientId,
} from '@/lib/agent-client-credentials'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_RATE_LIMIT_PER_HOUR = 12
const DEFAULT_EXPIRY_DAYS = 90

function reviewerAuthorized(request: Request): boolean {
  const token = process.env.AGENT_REVIEW_TOKEN
  return Boolean(token && bearerMatches(request, token))
}

function singleLine(value: unknown, field: string, maximum: number, minimum = 1): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const trimmed = value.trim()
  if (trimmed.length < minimum || trimmed.length > maximum || /[\r\n]/.test(trimmed)) {
    throw new Error(`${field} must contain between ${minimum} and ${maximum} characters on one line.`)
  }
  return trimmed
}

function parseRateLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_RATE_LIMIT_PER_HOUR
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 1 || value > 100) {
    throw new Error('rateLimitPerHour must be an integer from 1 to 100.')
  }
  return value
}

function parseExpiry(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  }
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || Date.parse(value) <= Date.now()) {
    throw new Error('expiresAt must be a future ISO-8601 date or date-time.')
  }
  return new Date(value).toISOString()
}

type CredentialRequest = {
  clientId?: string
  clientName?: string
  credentialLabel: string
  allowedOfferIds: OfferId[]
  rateLimitPerHour: number
  expiresAt: string
}

function parseCredentialRequest(value: unknown): CredentialRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const hasClientId = body.clientId !== undefined
  const hasClientName = body.clientName !== undefined
  if (hasClientId === hasClientName) throw new Error('Provide exactly one of clientId or clientName.')

  const clientId = hasClientId ? singleLine(body.clientId, 'clientId', 80) : undefined
  if (clientId && !validClientId(clientId)) throw new Error('clientId is not valid.')
  return {
    clientId,
    clientName: hasClientName ? singleLine(body.clientName, 'clientName', 160, 2) : undefined,
    credentialLabel: singleLine(body.credentialLabel, 'credentialLabel', 160, 2),
    allowedOfferIds: parseAllowedOfferIds(body.allowedOfferIds),
    rateLimitPerHour: parseRateLimit(body.rateLimitPerHour),
    expiresAt: parseExpiry(body.expiresAt),
  }
}

export async function GET(request: Request) {
  if (!reviewerAuthorized(request)) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid reviewer bearer token is required.' } }, 401)
  }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credential registry is not configured.' } }, 503)

  const [{ data: clients, error: clientsError }, { data: credentials, error: credentialsError }] = await Promise.all([
    ledger.from('agent_clients').select('public_id, display_name, status, created_at, revoked_at').order('created_at', { ascending: false }),
    ledger.from('agent_client_credentials').select('public_id, client_id, label, secret_prefix, allowed_offer_ids, rate_limit_per_hour, expires_at, status, issued_at, revoked_at, revocation_reason').order('issued_at', { ascending: false }),
  ])
  if (clientsError || credentialsError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credential registry could not be read.' } }, 503)

  return jsonResponse({ clients, credentials, secretsIncluded: false }, 200)
}

export async function POST(request: Request) {
  if (!reviewerAuthorized(request)) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid reviewer bearer token is required.' } }, 401)
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }

  let input: CredentialRequest
  try {
    input = parseCredentialRequest(await request.json())
  } catch (error) {
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request body.' } }, 400)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credential registry is not configured.' } }, 503)

  let clientId = input.clientId
  if (clientId) {
    const { data: client, error } = await ledger.from('agent_clients').select('public_id, status').eq('public_id', clientId).maybeSingle()
    if (error) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The client registry could not be read.' } }, 503)
    if (!client) return jsonResponse({ error: { code: 'not_found', message: 'Client not found.' } }, 404)
    if (client.status !== 'active') return jsonResponse({ error: { code: 'client_inactive', message: 'Credentials cannot be issued to an inactive client.' } }, 409)
  } else {
    clientId = createClientId()
    const { error } = await ledger.from('agent_clients').insert({ public_id: clientId, display_name: input.clientName, status: 'active' })
    if (error) {
      console.error('Agent client creation failed:', error.code)
      return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The client could not be created.' } }, 503)
    }
  }

  const credentialId = createCredentialId()
  const secret = createCredentialSecret()
  const { error: credentialError } = await ledger.from('agent_client_credentials').insert({
    public_id: credentialId,
    client_id: clientId,
    label: input.credentialLabel,
    secret_hash: createHash('sha256').update(secret).digest('hex'),
    secret_prefix: secret.slice(0, 14),
    allowed_offer_ids: input.allowedOfferIds,
    rate_limit_per_hour: input.rateLimitPerHour,
    expires_at: input.expiresAt,
    status: 'active',
  })
  if (credentialError) {
    console.error('Agent credential creation failed:', credentialError.code)
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credential could not be issued.' } }, 503)
  }

  return jsonResponse({
    clientId,
    credentialId,
    credential: secret,
    credentialPrefix: secret.slice(0, 14),
    allowedOfferIds: input.allowedOfferIds,
    rateLimitPerHour: input.rateLimitPerHour,
    expiresAt: input.expiresAt,
    secretDisclosure: 'This credential is shown once. Store it in the client’s secret manager, not in source control or chat.',
  }, 201)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
