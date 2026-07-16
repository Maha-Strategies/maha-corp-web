import { randomBytes, randomUUID } from 'node:crypto'

import { type OfferId, OFFERS, tokenFingerprint } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

const RATE_WINDOW_MS = 60 * 60 * 1000

const credentialRateWindows = new Map<string, { startedAt: number; count: number }>()

export type CredentialAuthorization =
  | { kind: 'authorized'; clientId: string; credentialId: string; credentialLabel: string; tokenFingerprint: string }
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

function acceptRateLimitedRequest(credentialId: string, limit: number): boolean {
  const now = Date.now()
  const current = credentialRateWindows.get(credentialId)
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    credentialRateWindows.set(credentialId, { startedAt: now, count: 1 })
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}

export async function authorizeClientCredential(token: string, offerId: OfferId): Promise<CredentialAuthorization> {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return { kind: 'unavailable' }

  const fingerprint = tokenFingerprint(token)
  const { data: credential, error: credentialError } = await ledger
    .from('agent_client_credentials')
    .select('public_id, client_id, label, allowed_offer_ids, rate_limit_per_hour, expires_at, status')
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

  if (!credential.allowed_offer_ids.includes(offerId)) return { kind: 'forbidden' }
  if (!acceptRateLimitedRequest(credential.public_id, credential.rate_limit_per_hour)) return { kind: 'rate_limited' }

  return {
    kind: 'authorized',
    clientId: credential.client_id,
    credentialId: credential.public_id,
    credentialLabel: credential.label,
    tokenFingerprint: fingerprint,
  }
}
