import { decodeChallenge, decodeReceipt, encodePaymentSignature, type TypedDataSigner } from '../client.ts'
import { usdcNetwork, type UsdcNetwork } from '../networks.ts'
import { MAHA_PAYEE } from '../merchant-identity.ts'
import { demandDigest } from '../demand6/digest.ts'
import { WORKFLOW_IDS, WORKFLOW_PRODUCTS, WORKFLOW_MAX_INPUT_BYTES, WORKFLOW_MAX_RESULT_BYTES, WORKFLOW_RETAIN_SECONDS,
  parseWorkflowInput, workflowResultSchema, workflowPath, type WorkflowId } from './contracts.ts'
import { workflowPurchaseHeaders, workflowTypedData, readWorkflowAuthorization } from './purchase.ts'
export type WorkflowCapsule = { version: 'maha-workflow-buyer/1'; productId: WorkflowId; url: string; input: unknown;
  headers: Record<string, string>; network: UsdcNetwork; payer: string; amount: string; createdAt: number }
const resource = (id: WorkflowId) => 'https://www.mahastrategies.com' + workflowPath(id)
export async function validateWorkflowCapsule(c: WorkflowCapsule) {
  if (!c || c.version !== 'maha-workflow-buyer/1' || !WORKFLOW_IDS.includes(c.productId) || c.url !== resource(c.productId)
    || !Number.isSafeInteger(c.createdAt) || c.createdAt < 0 || c.amount !== WORKFLOW_PRODUCTS[c.productId].amount) throw new Error('invalid_workflow_capsule')
  const input = parseWorkflowInput(c.productId, c.input), headers = new Headers(c.headers)
  if ([...headers.keys()].some(k => !['content-type', 'payment-signature', 'x-maha-input-hash', 'x-maha-recovery-secret'].includes(k))
    || headers.get('content-type') !== 'application/json' || demandDigest(input) !== demandDigest(c.input)
    || Buffer.byteLength(JSON.stringify(input)) > WORKFLOW_MAX_INPUT_BYTES) throw new Error('invalid_capsule_input_or_headers')
  const binding = await readWorkflowAuthorization(c.productId, input, headers)
  if (binding.payer !== c.payer.toLowerCase() || binding.network !== c.network || c.createdAt > binding.validBeforeMs) throw new Error('capsule_identity_mismatch')
  return binding
}
export async function prepareWorkflowPurchase(o: { productId: WorkflowId; input: unknown; network: UsdcNetwork; payer: string;
  maximumAmount: bigint; signTypedData: TypedDataSigner; persist: (capsule: WorkflowCapsule) => Promise<void>;
  fetchImpl?: typeof fetch; now?: number; recoverySecret?: string }) {
  if (!WORKFLOW_IDS.includes(o.productId) || o.maximumAmount < BigInt(WORKFLOW_PRODUCTS[o.productId].amount)) throw new Error('purchase_cap_exceeded')
  const input = parseWorkflowInput(o.productId, o.input), body = JSON.stringify(input)
  if (Buffer.byteLength(body) > WORKFLOW_MAX_INPUT_BYTES) throw new Error('request_too_large')
  const url = resource(o.productId), fetcher = o.fetchImpl ?? fetch
  const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, redirect: 'error', signal: AbortSignal.timeout(20000) })
  const header = response.headers.get('PAYMENT-REQUIRED')
  await response.body?.cancel()
  if (response.status !== 402 || (response.url && response.url !== url) || !header || header.length > 16384) throw new Error('quote_unavailable')
  const challenge = decodeChallenge(header), network = usdcNetwork(o.network), terms = challenge.accepts.filter(t => t.network === o.network), required = terms[0]
  if (challenge.resource.url !== url || terms.length !== 1 || required?.scheme !== 'exact' || required.amount !== WORKFLOW_PRODUCTS[o.productId].amount
    || BigInt(required.amount) > o.maximumAmount || required.asset.toLowerCase() !== network.asset.toLowerCase()
    || required.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase() || required.extra?.name !== network.domain.name
    || required.extra?.version !== network.domain.version || !Number.isInteger(required.maxTimeoutSeconds) || required.maxTimeoutSeconds < 1 || required.maxTimeoutSeconds > 300) throw new Error('quote_terms_mismatch')
  const now = o.now ?? Date.now(), headers = workflowPurchaseHeaders(input, o.recoverySecret)
  const typed = workflowTypedData(o.productId, input, headers, required as never, o.payer, now), signature = await o.signTypedData(typed)
  const capsule: WorkflowCapsule = { version: 'maha-workflow-buyer/1', productId: o.productId, url, input,
    headers: { ...headers, 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': encodePaymentSignature(required, typed.message, signature, challenge) },
    network: o.network, payer: o.payer.toLowerCase(), amount: required.amount, createdAt: now }
  await validateWorkflowCapsule(capsule)
  await o.persist(structuredClone(capsule))
  return capsule
}
export type WorkflowBuyerResult = { settlement: 'provider_reported' | 'unknown'; delivery: 'validated_response' | 'unresolved';
  transaction: string | null; product: unknown | null; status: number | null; replayed: boolean; automaticRepayment: false; reason: string | null }
async function resultJson(response: Response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error('body_missing')
  const parts: Uint8Array[] = []; let bytes = 0
  try { for (;;) { const r = await reader.read(); if (r.done) break; bytes += r.value.length
    if (bytes > WORKFLOW_MAX_RESULT_BYTES) throw new Error('result_too_large'); parts.push(r.value) } }
  finally { await reader.cancel().catch(() => {}) }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts)))
}
export async function submitWorkflowPurchase(c: WorkflowCapsule, options: { fetchImpl?: typeof fetch; recovery?: boolean; now?: number } = {}): Promise<WorkflowBuyerResult> {
  await validateWorkflowCapsule(c)
  const now = options.now ?? Date.now()
  if (!Number.isSafeInteger(now) || now < c.createdAt || now - c.createdAt >= WORKFLOW_RETAIN_SECONDS * 1000) throw new Error('recovery_window_expired_do_not_repay')
  let response: Response
  const result: WorkflowBuyerResult = { settlement: 'unknown', delivery: 'unresolved', transaction: null, product: null, status: null,
    replayed: false, automaticRepayment: false, reason: 'response_unavailable_check_original_payment' }
  try { response = await (options.fetchImpl ?? fetch)(c.url, { method: 'POST', body: JSON.stringify(c.input),
    headers: { ...c.headers, ...(options.recovery ? { 'X-Maha-Recovery-Mode': 'retained-result' } : {}) }, redirect: 'error', signal: AbortSignal.timeout(20000) }) }
  catch { return result }
  result.status = response.status
  if (!response.ok || (response.url && response.url !== c.url)) { await response.body?.cancel(); return { ...result, reason: 'response_refused_do_not_repay' } }
  const h = response.headers.get('PAYMENT-RESPONSE'), receipt = h && h.length <= 8192 ? decodeReceipt(h) : null
  if (!receipt?.success || receipt.network !== c.network || receipt.payer?.toLowerCase() !== c.payer || !/^0x[\da-f]{64}$/i.test(receipt.transaction ?? '')) {
    await response.body?.cancel(); return { ...result, reason: 'invalid_receipt_do_not_repay' }
  }
  result.settlement = 'provider_reported'; result.transaction = receipt.transaction!
  try {
    const envelope = await resultJson(response)
    if (envelope.success !== true || envelope.proof?.settlement_id !== receipt.transaction
      || Object.keys(envelope).sort().join(',') !== 'data,proof,success') throw new Error('invalid_execution_envelope')
    const product = workflowResultSchema(c.productId).parse(envelope.data)
    if (product.inputHash !== c.headers['X-Maha-Input-Hash'] || product.resultHash !== demandDigest(product.result)
      || product.receiptDigest !== demandDigest({ version: product.version, productId: c.productId, inputHash: product.inputHash, resultHash: product.resultHash })) throw new Error('result_digest_mismatch')
    return { ...result, delivery: 'validated_response', product, replayed: response.headers.get('X-Maha-Payment-Replayed') === 'true', reason: null }
  } catch { return { ...result, reason: 'output_missing_or_invalid_do_not_repay' } }
}
export const recoverWorkflowPurchase = (c: WorkflowCapsule, options: { fetchImpl?: typeof fetch; now?: number } = {}) => submitWorkflowPurchase(c, { ...options, recovery: true })
