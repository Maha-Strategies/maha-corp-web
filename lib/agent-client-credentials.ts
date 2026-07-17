import { randomBytes, randomUUID } from 'node:crypto'

import { type OfferId, OFFERS, tokenFingerprint } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { consumeCredentialRateLimit } from '@/lib/credential-rate-limit'

export const AGENT_CAPABILITIES = ['mps_audit'] as const
export type AgentCapability = typeof AGENT_CAPABILITIES[number]

export type CredentialAuthorization =
  | { kind: 'authorized'; clientId: string; credentialId: string; credentialLabel: string; tokenFingerprint: string; billingMode: 'internal_meter' | 'prepaid' }
  | { kind: 'unavailable' }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'rate_limited' }

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  return token || null
}

export function createClientId(): string {
  return `client_${randomUUID().replaceAll('-', '')}`
}

export function createCredentialId(): string {
  return `cred_${randomUUID().replaceAll('-', '')}`
}

export function createCredentialSecret(): string {
  return `mhaic_${randomBytes(32).toString('base64url')}`
}

export function validClientId(value: string): boolean {
  return /^client_[a-f0-9]{32}$/.test(value)
}

export function validCredentialId(value: string): boolean {
  return /^cred_[a-f0-9]{32}$/.test(value)
}

export function parseAllowedOfferIds(value: unknown): OfferId[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > Object.keys(OFFERS).length) {
    throw new Error('allowedOfferIds must contain one or more available offers.')
  }
  const offerIds = value.map((item) => {
    if (typeof item !== 'string' || !(item in OFFERS)) throw new Error('allowedOfferIds contains an unavailable offer.')
    return item as OfferId
  })
  if (new Set(offerIds).size !== offerIds.length) throw new Error('allowedOfferIds must not contain duplicates.')
  return offerIds
}

export function parseAllowedCapabilities(value: unknown): AgentCapability[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > AGENT_CAPABILITIES.length) {
    throw new Error('allowedCapabilities must be an array of available capabilities.')
  }
  const capabilities = value.map((item) => {
    if (typeof item !== 'string' || !AGENT_CAPABILITIES.includes(item as AgentCapability)) {
      throw new Error('allowedCapabilities contains an unavailable capability.')
    }
    return item as AgentCapability
  })
  if (new Set(capabilities).size !== capabilities.length) throw new Error('allowedCapabilities must not contain duplicates.')
  return capabilities
}

export async function authorizeClientCredential(token: string, offerId: OfferId): Promise<CredentialAuthorization> {
  return authorizeClientAccess(token, (credential) => credential.allowed_offer_ids.includes(offerId))
}

export async function authorizeClientCapability(token: string, capability: AgentCapability): Promise<CredentialAuthorization> {
  return authorizeClientAccess(token, (credential) => credential.allowed_capabilities.includes(capability))
}

export async function authorizeClientCapabilityForBilling(token: string, capability: AgentCapability): Promise<CredentialAuthorization> {
  return authorizeClientAccess(token, (credential) => credential.allowed_capabilities.includes(capability), false)
}

type CredentialRecord = {
  public_id: string
  client_id: string
  label: string
  allowed_offer_ids: OfferId[]
  allowed_capabilities: AgentCapability[]
  rate_limit_per_hour: number
  expires_at: string
  status: string
  billing_mode: 'internal_meter' | 'prepaid'
}

async function authorizeClientAccess(token: string, isAllowed: (credential: CredentialRecord) => boolean, applyRateLimit = true): Promise<CredentialAuthorization> {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return { kind: 'unavailable' }

  const fingerprint = tokenFingerprint(token)
  const { data: credential, error: credentialError } = await ledger
    .from('agent_client_credentials')
    .select('public_id, client_id, label, allowed_offer_ids, allowed_capabilities, rate_limit_per_hour, expires_at, status, billing_mode')
    .eq('secret_hash', fingerprint)
    .maybeSingle()
  if (credentialError) {
    console.error('Agent credential lookup failed:', credentialError.code)
    return { kind: 'unavailable' }
  }
  if (!credential || credential.status !== 'active') return { kind: 'unauthorized' }
  if (credential.expires_at && Date.parse(credential.expires_at) <= Date.now()) return { kind: 'unauthorized' }

  const { data: client, error: clientError } = await ledger
    .from('agent_clients')
    .select('status')
    .eq('public_id', credential.client_id)
    .maybeSingle()
  if (clientError) {
    console.error('Agent client lookup failed:', clientError.code)
    return { kind: 'unavailable' }
  }
  if (!client || client.status !== 'active') return { kind: 'unauthorized' }

  if (!isAllowed(credential as CredentialRecord)) return { kind: 'forbidden' }
  if (applyRateLimit) {
    const rateLimit = await consumeCredentialRateLimit(
      credential.public_id,
      credential.rate_limit_per_hour,
      (parameters) => ledger.rpc('consume_agent_credential_rate_limit', parameters),
    )
    if (rateLimit.kind === 'unavailable') {
      console.error('Agent credential rate limiter failed:', rateLimit.errorCode)
      return { kind: 'unavailable' }
    }
    if (rateLimit.kind === 'rate_limited') return { kind: 'rate_limited' }
  }

  return {
    kind: 'authorized',
    clientId: credential.client_id,
    credentialId: credential.public_id,
    credentialLabel: credential.label,
    tokenFingerprint: fingerprint,
    billingMode: credential.billing_mode,
  }
}
