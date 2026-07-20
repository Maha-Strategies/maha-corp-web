import { randomUUID } from 'node:crypto'

import { RECEIPT_UTILITY } from './receipt-utility.ts'

// Known paid utilities and their revenue-ledger offer ids. Extend both maps
// together when a new paid utility launches.
export const UTILITIES = { [RECEIPT_UTILITY]: 'Receipt → CSV' } as const
export type UtilityId = keyof typeof UTILITIES
export const REVENUE_OFFER_FOR_UTILITY: Record<UtilityId, 'utility-receipts-to-csv'> = {
  [RECEIPT_UTILITY]: 'utility-receipts-to-csv',
}

export function isKnownUtility(value: string): value is UtilityId {
  return Object.prototype.hasOwnProperty.call(UTILITIES, value)
}

export function createUtilityCheckoutId(): string {
  return `util_checkout_${randomUUID().replaceAll('-', '')}`
}

export function validUtilityCheckoutId(value: string): boolean {
  return /^util_checkout_[a-f0-9]{32}$/.test(value)
}

export type UtilityCatalogConfig = {
  stripeSecretKey: string
  webhookSecret: string
  utilityByPrice: Record<string, UtilityId>
  priceByUtility: Partial<Record<UtilityId, string>>
}

// Env-gated, mirroring bookCatalogConfig(). STRIPE_UTILITY_PRICE_MAP is JSON
// like {"price_ABC":"receipts-to-csv"} — the server-side binding between what
// was paid and which worker runs. Returns null when not enabled/configured.
export function utilityCatalogConfig(): UtilityCatalogConfig | null {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_UTILITY_WEBHOOK_SECRET
  const rawMap = process.env.STRIPE_UTILITY_PRICE_MAP
  if (!stripeSecretKey || !webhookSecret || !rawMap || process.env.UTILITY_CHECKOUT_ENABLED !== 'true') return null

  let parsed: unknown
  try { parsed = JSON.parse(rawMap) } catch { throw new Error('STRIPE_UTILITY_PRICE_MAP must be valid JSON.') }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('STRIPE_UTILITY_PRICE_MAP must be a JSON object of price id to utility slug.')
  }
  const entries = Object.entries(parsed as Record<string, unknown>)
  if (!entries.length) throw new Error('STRIPE_UTILITY_PRICE_MAP must contain at least one price mapping.')

  const utilityByPrice: Record<string, UtilityId> = {}
  const priceByUtility: Partial<Record<UtilityId, string>> = {}
  for (const [priceId, slug] of entries) {
    if (!/^price_[A-Za-z0-9]+$/.test(priceId)) throw new Error(`STRIPE_UTILITY_PRICE_MAP key "${priceId}" is not a Stripe Price ID.`)
    if (typeof slug !== 'string' || !isKnownUtility(slug)) throw new Error(`STRIPE_UTILITY_PRICE_MAP maps "${priceId}" to an unknown utility.`)
    utilityByPrice[priceId] = slug
    priceByUtility[slug] ??= priceId
  }
  return { stripeSecretKey, webhookSecret, utilityByPrice, priceByUtility }
}
