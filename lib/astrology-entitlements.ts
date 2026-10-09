import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import type Stripe from 'stripe'
import { astrologyEmailSession } from './astrology-auth.ts'
import { bearerApiKey, getApiKeyRecordForRawKey } from './api-key.ts'
import { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'
import { astrologyBillingConfig, astrologyStripe, verifyAstrologyPrice, type AstrologyProduct } from './billing/stripe.ts'
import type { AstrologyChartInput } from './astrology-input.ts'
export interface UserAstrologyEntitlement {
  userId: string; isSubscriber: boolean; advancedTools?: boolean; subscriptionTier: 'free' | 'executive_monthly' | 'executive_annual'; subscriptionRenewsAt?: string; aiQueryCredits: number;
  purchasedDossiers: { chartDigest: string; purchasedAt: string; pdfDownloadUrl: string }[]; passExpiresAt?: string; dossierCredits: number; checkoutConfigured: boolean
}
export type VaultEntry = { chartDigest: string; label: string; purchasedAt: string; kind: 'saved' | 'dossier'; origin: string; encryptedChart: string; encryptedPdf?: string; origins?: string[] }
export class AstrologyAccessError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }
const key = (user: string, suffix: string) => scopedRedisKey(`astrology:account:${user}:${suffix}`)
export function chartDigest(input: AstrologyChartInput) { return createHash('sha256').update(JSON.stringify([input.instantUtc, input.latitudeDegrees, input.longitudeDegrees, input.uncertaintyMinutes, input.referenceInstantUtc])).digest('hex') }
export function encryptVault(value: string, userId: string, keyHex = process.env.ASTROLOGY_VAULT_ENCRYPTION_KEY?.trim()) {
  if (!keyHex || !/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error('vault_not_configured')
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv); cipher.setAAD(Buffer.from(`maha-astrology-v1:${userId}`))
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}
export function decryptVault(value: string, userId: string, keyHex = process.env.ASTROLOGY_VAULT_ENCRYPTION_KEY?.trim()) {
  if (!keyHex || !/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error('vault_not_configured')
  const [version, iv, tag, encrypted] = value.split('.'); if (version !== 'v1') throw new Error('unsupported_vault_version')
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(iv, 'base64url')); cipher.setAAD(Buffer.from(`maha-astrology-v1:${userId}`)); cipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([cipher.update(Buffer.from(encrypted, 'base64url')), cipher.final()]).toString('utf8')
}
export function canAccessAdvancedTools(e: Pick<UserAstrologyEntitlement, 'isSubscriber' | 'passExpiresAt'>, now = Date.now()) { return e.isSubscriber || Boolean(e.passExpiresAt && Date.parse(e.passExpiresAt) > now) }
export async function astrologyAccount(request: Request) {
  const raw = bearerApiKey(request); if (!raw) { const session = await astrologyEmailSession(request); if (session) return session.userId; throw new AstrologyAccessError(401, 'Sign in with your email to use your consultation or Executive tools.') }
  const record = await getApiKeyRecordForRawKey(raw); if (!record) throw new AstrologyAccessError(401, 'The account key is invalid or inactive.')
  return record.tenant_id
}
function monthKey(now = new Date()) { return now.toISOString().slice(0, 7) }
function paidSession(session: Stripe.Checkout.Session, user: string, product: AstrologyProduct, expectedPrice: string) {
  return session.client_reference_id === user && session.metadata?.billing_kind === 'maha_astrology' && session.metadata?.product === product && session.status === 'complete' && session.payment_status === 'paid' && session.line_items?.data.length === 1 && session.line_items.data[0].quantity === 1 && session.line_items.data[0].price?.id === expectedPrice
}
export { paidSession as verifyAstrologyPaidSession }
export async function verifiedPaidInvoice(invoiceId: string, userId: string) {
  const invoice = await astrologyStripe().invoices.retrieve(invoiceId)
  const reference = invoice.parent?.subscription_details?.subscription
  if (!reference || invoice.status !== 'paid' || invoice.amount_paid <= 0) return false
  const sub = typeof reference === 'string' ? await astrologyStripe().subscriptions.retrieve(reference) : reference
  if (sub.metadata.billing_kind !== 'maha_astrology' || sub.metadata.user_id !== userId) return false
  const payments = await astrologyStripe().invoicePayments.list({ invoice: invoiceId, limit: 100, expand: ['data.payment.payment_intent.latest_charge', 'data.payment.charge'] })
  if (payments.has_more) return false
  let verifiedAmount = 0
  for (const payment of payments.data) {
    if (payment.status !== 'paid') continue
    const intent = typeof payment.payment.payment_intent === 'object' ? payment.payment.payment_intent : null
    const charge = payment.payment.type === 'charge' && typeof payment.payment.charge === 'object' ? payment.payment.charge : intent && typeof intent.latest_charge === 'object' ? intent.latest_charge : null
    if (!charge || charge.disputed || charge.amount_refunded > 0 || charge.refunded) return false
    verifiedAmount += payment.amount_paid ?? 0
  }
  return verifiedAmount >= invoice.amount_paid
}
export async function verifiedCheckout(sessionId: string, userId: string) {
  const config = astrologyBillingConfig(); if (!config) throw new AstrologyAccessError(503, 'Billing and the private vault are not configured yet.')
  const order = await getRedis().get<{ userId: string; product: AstrologyProduct; priceId: string }>(scopedRedisKey(`astrology:checkout:${sessionId}`))
  if (!order || order.userId !== userId || !(order.product in config.prices) || !/^price_[A-Za-z0-9]+$/.test(order.priceId ?? '')) return null
  const session = await astrologyStripe().checkout.sessions.retrieve(sessionId, { expand: ['line_items', 'subscription.latest_invoice', 'payment_intent.latest_charge'] })
  const product = session.metadata?.product as AstrologyProduct
  if (product !== order.product || !paidSession(session, userId, product, order.priceId)) return null
  if (product === 'dossier') {
    const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null, charge = intent && typeof intent.latest_charge === 'object' ? intent.latest_charge : null
    if (!charge || charge.refunded || charge.amount_refunded > 0 || charge.disputed) return null
    return { session, product, purchasedAt: new Date(charge.created * 1000).toISOString(), passExpiresAt: new Date(charge.created * 1000 + 30 * 86400000).toISOString() }
  }
  const sub = typeof session.subscription === 'object' ? session.subscription : null
  if (!sub || sub.status !== 'active' || sub.pause_collection || sub.items.data[0]?.price.id !== order.priceId) return null
  const invoice = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null
  if (!invoice || !(await verifiedPaidInvoice(invoice.id, userId))) return null
  const end = sub.items.data[0]?.current_period_end
  if (!end || end * 1000 <= Date.now()) return null
  return { session, product, invoiceId: invoice.id, subscriptionRenewsAt: new Date(end * 1000).toISOString() }
}
export async function recoverAstrologyCheckout(userId: string, sessionId: string) {
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) throw new AstrologyAccessError(400, 'Invalid checkout reference.')
  const verified = await verifiedCheckout(sessionId, userId); if (!verified) throw new AstrologyAccessError(402, 'Payment is not complete or does not belong to this account.')
  const pending = await getRedis().get<{ userId: string; entry?: VaultEntry }>(scopedRedisKey(`astrology:checkout:${sessionId}`))
  if (!pending || pending.userId !== userId) throw new AstrologyAccessError(403, 'This checkout has no matching account-bound order.')
  await getRedis().sadd(key(userId, 'checkouts'), sessionId)
  if (verified.product === 'dossier' && pending.entry) { await saveVaultEntry(userId, { ...pending.entry, origin: sessionId, purchasedAt: verified.purchasedAt! }) }
}
export async function getAstrologyEntitlement(userId: string): Promise<UserAstrologyEntitlement> {
  const checkoutIds = await getRedis().smembers<string[]>(key(userId, 'checkouts'))
  let subscriptionTier: UserAstrologyEntitlement['subscriptionTier'] = 'free', subscriptionRenewsAt: string | undefined, passExpiresAt: string | undefined
  const paidIds = new Set<string>(), validPassIds: string[] = []
  for (const id of checkoutIds) {
    const verified = await verifiedCheckout(id, userId)
    if (!verified) continue
    paidIds.add(id)
    if (verified.product === 'dossier' && verified.passExpiresAt) { if (!passExpiresAt || verified.passExpiresAt > passExpiresAt) passExpiresAt = verified.passExpiresAt; if (Date.parse(verified.passExpiresAt) > Date.now()) validPassIds.push(id) }
    else if (verified.product !== 'dossier') { subscriptionTier = verified.product; subscriptionRenewsAt = verified.subscriptionRenewsAt }
  }
  const vault = Object.values(await getRedis().hgetall<Record<string, VaultEntry>>(key(userId, 'vault')) ?? {})
  const invoiceOwnership = new Map<string, boolean>()
  for (const entry of vault) for (const origin of entry.origins ?? [entry.origin]) {
    if (!origin.startsWith('subscription:')) continue
    const invoiceId = origin.split(':')[1]
    if (/^in_[A-Za-z0-9]+$/.test(invoiceId) && !invoiceOwnership.has(invoiceId)) invoiceOwnership.set(invoiceId, await verifiedPaidInvoice(invoiceId, userId))
  }
  const purchasedDossiers = vault.filter(e => e.kind === 'dossier' && (e.origins ?? [e.origin]).some(origin => paidIds.has(origin) || (origin.startsWith('subscription:') && invoiceOwnership.get(origin.split(':')[1])))).map(e => ({ chartDigest: e.chartDigest, purchasedAt: e.purchasedAt, pdfDownloadUrl: '/api/astrology/platform' }))
  const isSubscriber = subscriptionTier !== 'free'
  let credits = isSubscriber ? Math.max(0, 100 - Number(await getRedis().get(key(userId, `ai:month:${monthKey()}`)) ?? 0)) : Math.max(0, 1 - Number(await getRedis().get(key(userId, 'ai:free')) ?? 0))
  if (!isSubscriber) for (const id of validPassIds) credits += Math.max(0, 20 - Number(await getRedis().get(key(userId, `ai:pass:${id}`)) ?? 0))
  return { userId, isSubscriber, advancedTools: canAccessAdvancedTools({isSubscriber,passExpiresAt}), subscriptionTier, subscriptionRenewsAt, passExpiresAt, aiQueryCredits: credits, purchasedDossiers, dossierCredits: isSubscriber ? Math.max(0, 1 - Number(await getRedis().get(key(userId, `dossier:month:${monthKey()}`)) ?? 0)) : 0, checkoutConfigured: Boolean(astrologyBillingConfig()) }
}
const RESERVE = `local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[1]) then return 0 end; redis.call('INCR',KEYS[1]); return 1`
const REFUND = `local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>0 then redis.call('DECR',KEYS[1]); end; return 1`
export async function reserveAstrologyConsultation(request: Request) {
  const userId = await astrologyAccount(request), entitlement = await getAstrologyEntitlement(userId)
  const candidates: { key: string; limit: number }[] = []
  if (entitlement.isSubscriber) candidates.push({ key: key(userId, `ai:month:${monthKey()}`), limit: 100 })
  else {
    if (canAccessAdvancedTools(entitlement)) for (const id of await getRedis().smembers<string[]>(key(userId, 'checkouts'))) { const v = await verifiedCheckout(id, userId); if (v?.product === 'dossier' && v.passExpiresAt && Date.parse(v.passExpiresAt) > Date.now()) candidates.push({ key: key(userId, `ai:pass:${id}`), limit: 20 }) }
    candidates.push({ key: key(userId, 'ai:free'), limit: 1 })
  }
  for (const c of candidates) if (await getRedis().eval(RESERVE, [c.key], [c.limit]) === 1) { let finished = false; return { entitlement, finish: async (success: boolean) => { if (finished) return; finished = true; if (!success) await getRedis().eval(REFUND, [c.key], []) } } }
  throw new AstrologyAccessError(402, 'Your consultation credits are used. Subscribe or purchase a dossier to continue.')
}
export async function createAstrologyCheckout(request: Request, userId: string, product: AstrologyProduct, requestId: string, entry?: VaultEntry) {
  const config = astrologyBillingConfig(); if (!config) throw new AstrologyAccessError(503, 'Checkout is disabled until real Stripe prices and vault encryption are configured.')
  await verifyAstrologyPrice(product)
  if (product === 'dossier' && !entry) throw new AstrologyAccessError(400, 'A chart snapshot is required for this dossier.')
  const origin = new URL(request.url).origin, success = new URL('/astrology', origin); success.searchParams.set('checkout_session', '{CHECKOUT_SESSION_ID}')
  const emailSession = await astrologyEmailSession(request)
  const session = await astrologyStripe().checkout.sessions.create({ ...(emailSession?.userId === userId ? { customer_email: emailSession.email } : {}), mode: product === 'dossier' ? 'payment' : 'subscription', client_reference_id: userId, line_items: [{ price: config.prices[product], quantity: 1 }], metadata: { billing_kind: 'maha_astrology', product, chart_digest: entry?.chartDigest ?? '' }, success_url: success.toString().replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}'), cancel_url: new URL('/astrology', origin).toString(), ...(product === 'dossier' ? {} : { subscription_data: { metadata: { billing_kind: 'maha_astrology', user_id: userId, product } } }) }, { idempotencyKey: `astrology:${userId}:${product}:${entry?.chartDigest ?? ''}:${requestId}` })
  await getRedis().set(scopedRedisKey(`astrology:checkout:${session.id}`), { userId, entry, product, priceId: config.prices[product] })
  if (!session.url) throw new AstrologyAccessError(502, 'Checkout could not be opened.')
  return session.url
}
export async function vaultEntries(userId: string, entitlement: UserAstrologyEntitlement) {
  const owned = new Set(entitlement.purchasedDossiers.map(d => d.chartDigest))
  return Object.values(await getRedis().hgetall<Record<string, VaultEntry>>(key(userId, 'vault')) ?? {}).filter(e => e.kind === 'saved' ? entitlement.isSubscriber : owned.has(e.chartDigest))
}
const MERGE_VAULT = `local old=redis.call('HGET',KEYS[1],ARGV[1]); local n=cjson.decode(ARGV[2]); if old then local o=cjson.decode(old); if o.kind=='dossier' and n.kind=='saved' then return 1 end; n.origins=o.origins or {o.origin}; local exists=false; for _,v in ipairs(n.origins) do if v==n.origin then exists=true end end; if not exists then table.insert(n.origins,n.origin) end; if o.encryptedPdf then n.encryptedPdf=o.encryptedPdf end; else n.origins={n.origin}; end; redis.call('HSET',KEYS[1],ARGV[1],cjson.encode(n)); return 1`
export async function saveVaultEntry(userId: string, entry: VaultEntry) { await getRedis().eval(MERGE_VAULT, [key(userId, 'vault')], [entry.chartDigest, JSON.stringify(entry)]) }
export async function reserveMonthlyDossier(userId: string) {
  let invoiceId: string | undefined
  for (const id of await getRedis().smembers<string[]>(key(userId, 'checkouts'))) { const verified = await verifiedCheckout(id, userId); if (verified?.invoiceId) { invoiceId = verified.invoiceId; break } }
  if (!invoiceId) throw new AstrologyAccessError(402, 'A paid active subscription is required.')
  const quotaKey = key(userId, `dossier:month:${monthKey()}`)
  if (await getRedis().eval(RESERVE, [quotaKey], [1]) !== 1) throw new AstrologyAccessError(402, 'Your included dossier for this calendar month has already been used.')
  return { origin: `subscription:${invoiceId}:${monthKey()}:${randomUUID()}`, refund: () => getRedis().eval(REFUND, [quotaKey], []) }
}
