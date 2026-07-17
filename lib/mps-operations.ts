import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

export type MpsOperationsLookup =
  | { kind: 'client'; value: string }
  | { kind: 'credential'; value: string }
  | { kind: 'credential_prefix'; value: string }
  | { kind: 'checkout'; value: string }
  | { kind: 'stripe_session'; value: string }
  | { kind: 'stripe_payment_intent'; value: string }
  | { kind: 'stripe_refund'; value: string }
  | { kind: 'stripe_event'; value: string }
  | { kind: 'receipt_email'; value: string }

type CommonOperatorAction = {
  idempotencyKey: string
  reason: string
  referenceId: string
}

export type MpsOperatorAction =
  | (CommonOperatorAction & { action: 'credit_adjustment'; clientId: string; quantity: number })
  | (CommonOperatorAction & { action: 'credential_revocation'; credentialId: string })
  | (CommonOperatorAction & { action: 'credential_replacement'; credentialId: string })

export type MpsOperationsAuthorization =
  | { kind: 'authorized'; actorFingerprint: string }
  | { kind: 'unauthorized' }
  | { kind: 'unconfigured' }

function singleLine(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const trimmed = value.trim()
  if (trimmed.length < minimum || trimmed.length > maximum || /[\r\n]/.test(trimmed)) {
    throw new Error(`${field} must contain between ${minimum} and ${maximum} characters on one line.`)
  }
  return trimmed
}

function validClientId(value: string): boolean {
  return /^client_[a-f0-9]{32}$/.test(value)
}

function validCredentialId(value: string): boolean {
  return /^cred_[a-f0-9]{32}$/.test(value)
}

function validCreditCheckoutId(value: string): boolean {
  return /^credit_checkout_[a-f0-9]{32}$/.test(value)
}

function validStripeEventId(value: string): boolean {
  return /^evt_[A-Za-z0-9]+$/.test(value)
}

export function authorizeMpsOperations(request: Request): MpsOperationsAuthorization {
  const token = process.env.MPS_OPERATIONS_TOKEN
  if (!token) return { kind: 'unconfigured' }
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return { kind: 'unauthorized' }
  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const configured = Buffer.from(token)
  if (supplied.length !== configured.length || !timingSafeEqual(supplied, configured)) return { kind: 'unauthorized' }
  return { kind: 'authorized', actorFingerprint: `sha256:${createHash('sha256').update(token).digest('hex')}` }
}

export function createMpsOperatorActionId(): string {
  return `mpsop_${randomUUID().replaceAll('-', '')}`
}

export function operatorIdempotencyHash(idempotencyKey: string): string {
  return `sha256:${createHash('sha256').update(idempotencyKey).digest('hex')}`
}

export function operatorActionRequestHash(action: MpsOperatorAction): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(action)).digest('hex')}`
}

export function parseMpsOperationsLookup(raw: string | null): MpsOperationsLookup {
  const value = raw?.trim() ?? ''
  if (!value || value.length > 254 || /[\r\n]/.test(value)) {
    throw new Error('query must contain a supported identifier or receipt email.')
  }
  if (validClientId(value)) return { kind: 'client', value }
  if (validCredentialId(value)) return { kind: 'credential', value }
  if (validCreditCheckoutId(value)) return { kind: 'checkout', value }
  if (/^cs_[A-Za-z0-9_]+$/.test(value)) return { kind: 'stripe_session', value }
  if (/^pi_[A-Za-z0-9]+$/.test(value)) return { kind: 'stripe_payment_intent', value }
  if (/^re_[A-Za-z0-9]+$/.test(value)) return { kind: 'stripe_refund', value }
  if (validStripeEventId(value)) return { kind: 'stripe_event', value }
  if (/^mhaic_[A-Za-z0-9_-]{8}$/.test(value)) return { kind: 'credential_prefix', value }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { kind: 'receipt_email', value: value.toLowerCase() }
  throw new Error('query must be a client, credential, checkout, Stripe identifier, credential prefix, or receipt email.')
}

export function parseMpsOperatorAction(value: unknown): MpsOperatorAction {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Request body must be a JSON object.')
  }
  const body = value as Record<string, unknown>
  const common = {
    idempotencyKey: singleLine(body.idempotencyKey, 'idempotencyKey', 8, 120),
    reason: singleLine(body.reason, 'reason', 3, 500),
    referenceId: singleLine(body.referenceId, 'referenceId', 3, 200),
  }

  if (body.action === 'credit_adjustment') {
    if (typeof body.clientId !== 'string' || !validClientId(body.clientId)) throw new Error('clientId is not valid.')
    if (typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity === 0 || Math.abs(body.quantity) > 1_000_000) {
      throw new Error('quantity must be a non-zero integer between -1000000 and 1000000.')
    }
    return { action: body.action, clientId: body.clientId, quantity: body.quantity, ...common }
  }

  if (body.action === 'credential_revocation' || body.action === 'credential_replacement') {
    if (typeof body.credentialId !== 'string' || !validCredentialId(body.credentialId)) throw new Error('credentialId is not valid.')
    return { action: body.action, credentialId: body.credentialId, ...common }
  }

  throw new Error('action must be credit_adjustment, credential_revocation, or credential_replacement.')
}
