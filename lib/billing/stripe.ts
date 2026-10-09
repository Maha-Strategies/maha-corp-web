import Stripe from 'stripe'
export const ASTROLOGY_PRICES = { dossier: 7900, executive_monthly: 3900, executive_annual: 29900 } as const
export type AstrologyProduct = keyof typeof ASTROLOGY_PRICES
export function astrologyBillingConfig() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim(), webhook = process.env.ASTROLOGY_STRIPE_WEBHOOK_SECRET?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim()
  const launch = process.env.ASTROLOGY_LAUNCH_PRICING === 'true'
  const prices = { dossier: (launch ? process.env.STRIPE_PRICE_ID_DOSSIER_LAUNCH?.trim() : undefined) || process.env.STRIPE_PRICE_ID_DOSSIER?.trim(), executive_monthly: (launch ? process.env.STRIPE_PRICE_ID_SUB_MONTHLY_LAUNCH?.trim() : undefined) || process.env.STRIPE_PRICE_ID_SUB_MONTHLY?.trim(), executive_annual: (launch ? process.env.STRIPE_PRICE_ID_SUB_ANNUAL_LAUNCH?.trim() : undefined) || process.env.STRIPE_PRICE_ID_SUB_ANNUAL?.trim() }
  const vaultKey = process.env.ASTROLOGY_VAULT_ENCRYPTION_KEY?.trim()
  if (!secret || !webhook || !vaultKey || !/^[a-f0-9]{64}$/i.test(vaultKey) || Object.values(prices).some(p => !/^price_[A-Za-z0-9]+$/.test(p ?? ''))) return null
  return { secret, webhook, vaultKey, prices: prices as Record<AstrologyProduct, string>, launch }
}
export function astrologyPriceAmount(product: AstrologyProduct, launch = false) { return launch ? ({ dossier: 4900, executive_monthly: 2900, executive_annual: 19900 } as const)[product] : ASTROLOGY_PRICES[product] }
export function astrologyStripe() { const config = astrologyBillingConfig(); if (!config) throw new Error('billing_not_configured'); return new Stripe(config.secret, { apiVersion: '2026-06-24.dahlia', maxNetworkRetries: 1, timeout: 10000 }) }
export async function verifyAstrologyPrice(product: AstrologyProduct) {
  const config = astrologyBillingConfig(); if (!config) throw new Error('billing_not_configured')
  const price = await astrologyStripe().prices.retrieve(config.prices[product])
  const interval = product === 'executive_monthly' ? 'month' : 'year'
  if (!price.active || price.currency !== 'usd' || price.unit_amount !== astrologyPriceAmount(product, config.launch) || (product === 'dossier' ? price.type !== 'one_time' : price.type !== 'recurring' || price.recurring?.interval !== interval || price.recurring.interval_count !== 1)) throw new Error('price_configuration_mismatch')
  return price
}
