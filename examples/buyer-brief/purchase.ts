import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { open } from 'node:fs/promises'
import { fixture, validateResults, PAYEE, ASSET } from '../context-growth/workflow.ts'
import { createPaidFetch, decodeChallenge, selectRequirement, type PaymentChallenge, type PaymentRequirement, type TypedDataSigner } from '../../lib/x402/client.ts'

export const RESOURCE = 'https://www.mahastrategies.com/api/v1/compress/evaluate'
export const hash = (value: string) => 'sha256:' + createHash('sha256').update(value).digest('hex')
export function requestBody() { return fixture() }
export function checkQuote(requirement: PaymentRequirement, challenge: PaymentChallenge) {
  assert.equal(challenge.x402Version, 2)
  assert.equal(challenge.resource.url, RESOURCE)
  assert.equal(requirement.scheme, 'exact')
  assert.equal(requirement.network, 'eip155:8453')
  assert.equal(requirement.amount, '10000', 'Changed price: fresh approval required')
  assert.equal(requirement.payTo.toLowerCase(), PAYEE)
  assert.equal(requirement.asset.toLowerCase(), ASSET)
  assert.equal(requirement.extra?.name, 'USD Coin')
  assert.equal(requirement.extra?.version, '2')
  assert.ok(Number.isInteger(requirement.maxTimeoutSeconds) && requirement.maxTimeoutSeconds > 0 && requirement.maxTimeoutSeconds <= 300)
}
export async function quote(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(RESOURCE, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody()) })
  assert.equal(response.status, 402, 'Expected unpaid 402')
  const challenge = decodeChallenge(response.headers.get('PAYMENT-REQUIRED'))
  const requirement = selectRequirement(challenge, 8453)
  assert.ok(requirement)
  checkQuote(requirement, challenge)
  return { checkedAt: new Date().toISOString(), mode: 'unsigned_no_payment', challenge }
}

// Only a buyer-controlled application may call this. No CLI calls it.
export async function purchaseEvaluation(options: {
  address: string; signTypedData: TypedDataSigner; lockPath: string;
  approval: { approved: true; reference: string; requestHash: string; expiresAt: string; amountBaseUnits: '10000'; resource: typeof RESOURCE };
  fetchImpl?: typeof fetch;
}) {
  const raw = JSON.stringify(requestBody())
  const approval = options.approval
  assert.equal(approval.approved, true)
  assert.ok(approval.reference?.trim())
  assert.equal(approval.requestHash, hash(raw))
  assert.equal(approval.resource, RESOURCE)
  assert.equal(approval.amountBaseUnits, '10000')
  assert.ok(Date.parse(approval.expiresAt) > Date.now(), 'Approval expired')
  let reserved = false
  const paid = createPaidFetch({ address: options.address, chainId: 8453, signTypedData: options.signTypedData,
    fetchImpl: (url, init) => (options.fetchImpl ?? fetch)(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30000) }),
    onPaymentRequired: async (requirement, { challenge }) => {
      checkQuote(requirement, challenge)
      assert.ok(Date.parse(approval.expiresAt) > Date.now(), 'Approval expired')
      assert.equal(reserved, false)
      // Atomic, persistent reservation; never automatically release after failure.
      const file = await open(options.lockPath, 'wx', 0o600)
      try { await file.writeFile(JSON.stringify({ requestHash: hash(raw), approvalRef: approval.reference, reservedAt: new Date().toISOString(), status: 'reserved_reconcile_before_retry' })); await file.sync() }
      finally { await file.close() }
      reserved = true
    },
  })
  const response = await paid(RESOURCE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw })
  assert.ok(reserved && response.ok, 'No attributable authorized purchase')
  const receipt = response.x402?.receipt
  assert.equal(receipt?.success, true)
  assert.equal(receipt?.network, 'eip155:8453')
  assert.match(receipt?.transaction ?? '', /^0x[0-9a-fA-F]{64}$/)
  const result = await response.json()
  const summary = validateResults(requestBody(), result.contextPack, result)
  return { receipt, summary, settlement: 'seller_reported_not_independently_confirmed', requestHash: hash(raw), responseHash: hash(JSON.stringify(result)), acceptance: 'buyer_review_required' }
}
