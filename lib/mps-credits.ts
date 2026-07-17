import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const MPS_AUDIT_CREDIT_UNIT = 'mps_audit_invocation' as const

export type CreditCheckoutStatus = 'awaiting_payment' | 'paid' | 'failed'

export type CreditCheckout = {
  public_id: string
  client_id: string
  credential_id: string
  request_hash: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_payment_amount: number | null
  stripe_payment_currency: string | null
  stripe_price_id: string
  credit_quantity: number
  status: CreditCheckoutStatus
  failure_code: string | null
  created_at: string
  paid_at: string | null
}

export type CreditLedgerEntry = {
  quantity: number | string
}

export type CreditPackConfig = {
  stripeSecretKey: string
  stripePriceId: string
  creditQuantity: number
}

export function createCreditCheckoutId(): string {
  return `credit_checkout_${randomUUID().replaceAll('-', '')}`
}

export function createCreditLedgerEntryId(): string {
  return `credit_${randomUUID().replaceAll('-', '')}`
}

export function validCreditCheckoutId(value: string): boolean {
  return /^credit_checkout_[a-f0-9]{32}$/.test(value)
}

export function validStripeEventId(value: string): boolean {
  return /^evt_[A-Za-z0-9]+$/.test(value)
}

export function stripeWebhookPayloadHash(raw: string): string {
  return `sha256:${createHash('sha256').update(raw).digest('hex')}`
}

export function requestHash(clientRequestId: string): string {
  return `sha256:${createHash('sha256').update(clientRequestId).digest('hex')}`
}

export function ledgerEventHash(input: {
  entryId: string
  clientId: string
  checkoutId: string
  quantity: number
  sourceId: string
  createdAt: string
}): string {
  return `sha256:${createHash('sha256').update([
    input.entryId,
    input.clientId,
    input.checkoutId,
    input.quantity,
    input.sourceId,
    input.createdAt,
  ].join('|')).digest('hex')}`
}

export function parseCreditCheckoutRequest(value: unknown): { clientRequestId: string; email: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const clientRequestId = (value as Record<string, unknown>).clientRequestId
  if (typeof clientRequestId !== 'string') throw new Error('clientRequestId must be a string.')
  const trimmed = clientRequestId.trim()
  if (trimmed.length < 8 || trimmed.length > 120 || /[\r\n]/.test(trimmed)) {
    throw new Error('clientRequestId must contain between 8 and 120 characters on one line.')
  }
  const email = (value as Record<string, unknown>).email
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error('email must be a valid email address.')
  }
  return { clientRequestId: trimmed, email: email.trim().toLowerCase() }
}

export function creditPackConfig(): CreditPackConfig | null {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const stripePriceId = process.env.STRIPE_MPS_AUDIT_CREDIT_PRICE_ID
  const webhookSecret = process.env.STRIPE_MPS_CREDITS_WEBHOOK_SECRET
  const rawQuantity = process.env.MPS_AUDIT_CREDIT_PACK_UNITS
  if (!stripeSecretKey || !stripePriceId || !webhookSecret || !rawQuantity || process.env.MPS_AUDIT_CREDIT_CHECKOUT_ENABLED !== 'true') return null
  const creditQuantity = Number(rawQuantity)
  if (!/^price_[A-Za-z0-9]+$/.test(stripePriceId)) throw new Error('STRIPE_MPS_AUDIT_CREDIT_PRICE_ID must be a Stripe Price ID.')
  if (!Number.isInteger(creditQuantity) || creditQuantity < 1 || creditQuantity > 1_000_000) {
    throw new Error('MPS_AUDIT_CREDIT_PACK_UNITS must be an integer from 1 to 1000000.')
  }
  return { stripeSecretKey, stripePriceId, creditQuantity }
}

export function creditBalance(entries: CreditLedgerEntry[]): number {
  return entries.reduce((total, entry) => total + Number(entry.quantity), 0)
}

export function validStripeWebhookSignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const timestamp = signature.match(/(?:^|,)t=(\d+)(?:,|$)/)?.[1]
  const candidates = [...signature.matchAll(/(?:^|,)v1=([^,]+)/g)].map((match) => match[1])
  if (!timestamp || !candidates.length || Math.abs(Date.now() / 1_000 - Number(timestamp)) > 300) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')
  return candidates.some((candidate) => {
    const supplied = Buffer.from(candidate)
    const configured = Buffer.from(expected)
    return supplied.length === configured.length && timingSafeEqual(supplied, configured)
  })
}
