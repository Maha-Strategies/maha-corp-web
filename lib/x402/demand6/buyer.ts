import { decodeChallenge, decodeReceipt, encodePaymentSignature, type TypedDataSigner } from '../client.ts'
import { usdcNetwork, type UsdcNetwork } from '../networks.ts'
import { MAHA_PAYEE } from '../discovery-payment-recipe.ts'
import { DEMAND6_IDS, DEMAND6_PRODUCTS, DEMAND6_MAX_REQUEST_BYTES, DEMAND6_MAX_RESPONSE_BYTES, demand6Path, demandResultSchema, parseDemandInput, type Demand6Id } from './contracts.ts'
import { demandDigest } from './products.ts'
import { demandPurchaseHeaders, demandPurchaseTypedData, readDemandAuthorization } from './purchase.ts'
import { claimedDiscoverySource, type ClaimedDiscoverySource } from '../discovery-attribution.ts'

/** Private bearer evidence: never log, publish, or send this capsule to a diagnostic service. */
export type DemandPurchaseCapsule = {
  version: 'maha-demand-buyer/1.0'; productId: Demand6Id; url: string; input: unknown;
  headers: Record<string, string>; network: UsdcNetwork; payer: string; amount: string; createdAt: number
}
const resource = (id: Demand6Id) => 'https://www.mahastrategies.com' + demand6Path(id)
async function boundedJson(response: Response, limit = DEMAND6_MAX_RESPONSE_BYTES): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('body_missing')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break
      size += value.byteLength
      if (size > limit) throw new Error('body_too_large')
      chunks.push(value)
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
  } finally { await reader.cancel().catch(() => {}) }
}

/** Only quotes until persistence succeeds. No automatic retries, RPC, or private-key handling. */
export async function prepareDemandPurchase(options: {
  productId: Demand6Id; input: unknown; network: UsdcNetwork; payer: string; maximumAmount: bigint;
  signTypedData: TypedDataSigner; persist: (capsule: DemandPurchaseCapsule) => Promise<void>;
  fetchImpl?: typeof fetch; now?: number; recoverySecret?: string; discoverySource?: ClaimedDiscoverySource
}): Promise<DemandPurchaseCapsule> {
  const id = options.productId
  if (!DEMAND6_IDS.includes(id) || options.maximumAmount < BigInt(DEMAND6_PRODUCTS[id].amount)) throw new Error('purchase_cap_exceeded')
  const input = parseDemandInput(id, options.input), body = JSON.stringify(input)
  if (Buffer.byteLength(body) > DEMAND6_MAX_REQUEST_BYTES) throw new Error('request_too_large')
  const request = options.fetchImpl ?? fetch, url = resource(id)
  const source = claimedDiscoverySource(options.discoverySource)
  const quote = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maha-Discovery-Source': source }, body,
    redirect: 'error', signal: AbortSignal.timeout(20000) })
  if (quote.status !== 402 || (quote.url && quote.url !== url)) throw new Error('quote_not_available')
  const header = quote.headers.get('PAYMENT-REQUIRED')
  if (!header || header.length > 16384) throw new Error('quote_invalid')
  const challenge = decodeChallenge(header), definition = usdcNetwork(options.network)
  const terms = challenge.accepts.filter(term => term.network === options.network)
  const requirement = terms[0]
  if (challenge.resource.url !== url || terms.length !== 1 || !requirement || requirement.scheme !== 'exact'
    || requirement.amount !== DEMAND6_PRODUCTS[id].amount || BigInt(requirement.amount) > options.maximumAmount
    || requirement.asset.toLowerCase() !== definition.asset.toLowerCase() || requirement.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()
    || requirement.extra?.name !== definition.domain.name || requirement.extra?.version !== definition.domain.version
    || !Number.isInteger(requirement.maxTimeoutSeconds) || requirement.maxTimeoutSeconds < 1 || requirement.maxTimeoutSeconds > 300) throw new Error('quote_terms_mismatch')
  const now = options.now ?? Date.now(), headers = demandPurchaseHeaders(input, options.recoverySecret)
  const typed = demandPurchaseTypedData(id, input, headers, { ...requirement, scheme: 'exact', network: options.network }, options.payer, now)
  const signature = await options.signTypedData(typed)
  const capsule: DemandPurchaseCapsule = { version: 'maha-demand-buyer/1.0', productId: id, url, input,
    headers: { ...headers, 'Content-Type': 'application/json', 'X-Maha-Discovery-Source': source, 'PAYMENT-SIGNATURE': encodePaymentSignature(requirement, typed.message, signature, challenge) },
    network: options.network, payer: options.payer.toLowerCase(), amount: requirement.amount, createdAt: now }
  await validateDemandCapsule(capsule)
  // The caller's durable, private outbox is mandatory before the first paid request.
  await options.persist(structuredClone(capsule))
  return capsule
}

export async function validateDemandCapsule(capsule: DemandPurchaseCapsule) {
  if (!capsule || capsule.version !== 'maha-demand-buyer/1.0' || !DEMAND6_IDS.includes(capsule.productId)
    || capsule.url !== resource(capsule.productId) || !Number.isFinite(capsule.createdAt)
    || capsule.amount !== DEMAND6_PRODUCTS[capsule.productId].amount) throw new Error('invalid_purchase_capsule')
  const input = parseDemandInput(capsule.productId, capsule.input)
  const headers = new Headers(capsule.headers)
  if ([...headers.keys()].some(name => !['content-type', 'payment-signature', 'x-maha-input-hash', 'x-maha-recovery-secret', 'x-maha-discovery-source'].includes(name))
    || headers.get('content-type') !== 'application/json') throw new Error('invalid_capsule_headers')
  if (demandDigest(input) !== demandDigest(capsule.input) || Buffer.byteLength(JSON.stringify(input)) > DEMAND6_MAX_REQUEST_BYTES) throw new Error('invalid_capsule_input')
  const binding = await readDemandAuthorization(capsule.productId, input, headers)
  if (binding.network !== capsule.network || binding.payer !== capsule.payer.toLowerCase()) throw new Error('capsule_identity_mismatch')
  return binding
}
export type DemandBuyerResult = {
  settlement: 'provider_reported' | 'unknown'; delivery: 'validated_response' | 'unresolved';
  transaction: string | null; product: unknown | null; status: number | null; reason: string | null;
  replayed: boolean; automaticRepayment: false
}
/** Submission and explicit recovery use exactly the same capsule; this function cannot sign. */
export async function submitDemandPurchase(capsule: DemandPurchaseCapsule, fetchImpl: typeof fetch = fetch): Promise<DemandBuyerResult> {
  await validateDemandCapsule(capsule)
  const unresolved: DemandBuyerResult = { settlement: 'unknown', delivery: 'unresolved', transaction: null, product: null,
    status: null, reason: 'response_unavailable_check_original_payment', replayed: false, automaticRepayment: false }
  let response: Response
  try { response = await fetchImpl(capsule.url, { method: 'POST', body: JSON.stringify(capsule.input), headers: capsule.headers,
    redirect: 'error', signal: AbortSignal.timeout(20000) }) } catch { return unresolved }
  unresolved.status = response.status
  if ((response.url && response.url !== capsule.url) || !response.ok) return { ...unresolved, reason: 'response_refused_do_not_repay' }
  const receiptHeader = response.headers.get('PAYMENT-RESPONSE')
  const receipt = receiptHeader && receiptHeader.length <= 8192 ? decodeReceipt(receiptHeader) : null
  if (!receipt?.success || receipt.network !== capsule.network || receipt.payer?.toLowerCase() !== capsule.payer
    || !/^0x[\da-f]{64}$/i.test(receipt.transaction ?? '')) return { ...unresolved, reason: 'receipt_invalid_do_not_repay' }
  unresolved.settlement = 'provider_reported'; unresolved.transaction = receipt.transaction!
  try {
    const product = demandResultSchema(capsule.productId).parse(await boundedJson(response))
    if (product.inputHash !== capsule.headers['X-Maha-Input-Hash'] || product.resultHash !== demandDigest(product.result)
      || product.receiptDigest !== demandDigest({ version: product.version, productId: capsule.productId, inputHash: product.inputHash, resultHash: product.resultHash })) throw new Error()
    return { ...unresolved, delivery: 'validated_response', product, reason: null, replayed: response.headers.get('X-Maha-Payment-Replayed') === 'true' }
  } catch { return { ...unresolved, reason: 'output_missing_or_invalid_do_not_repay' } }
}
