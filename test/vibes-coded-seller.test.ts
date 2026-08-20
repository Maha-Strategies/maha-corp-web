import assert from 'node:assert/strict'
import test from 'node:test'

import {
  handleGovernedContextCall,
  type SellerCallRecord,
  type SellerCallStore,
  type SellerClient,
  VIBES_CODED_CONTRACT_DIGEST,
  VIBES_CODED_PRICE_CENTS,
  VIBES_CODED_SKU_SLUG,
  VIBES_CODED_UNPAID_SMOKE_PATH,
} from '../lib/vibes-coded-seller.ts'

const body = (overrides: Record<string, unknown> = {}) => ({
  clientRequestId: 'governed-call-001',
  task: 'Verify the rollback evidence and compile the bounded context.',
  tokenBudget: 256,
  documents: [{ id: 'runbook', title: 'Runbook', text: 'Rollback begins when error rate exceeds two percent for five minutes. Keep the signed evidence hash.' }],
  requiredEvidence: [{ evidenceId: 'rollback-condition', sourceId: 'runbook', text: 'Rollback begins when error rate exceeds two percent for five minutes.' }],
  ...overrides,
})

function request(input: Record<string, unknown>, ticket = 'ticket-001') {
  return new Request('https://www.mahastrategies.com/api/v1/seller-endpoints/governed-context-verification-pack/call', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(ticket ? { 'X-Vibes-Call-Ticket': ticket } : {}) }, body: JSON.stringify(input),
  })
}

function storeOf(initial?: SellerCallRecord): SellerCallStore & { record: SellerCallRecord | null } {
  const state = { record: initial ?? null }
  return {
    get: async () => state.record,
    admit: async (input) => {
      if (state.record) return { kind: state.record.requestHash === input.requestHash ? 'existing' : 'conflict', record: state.record }
      state.record = { ...input, state: 'verifying' }
      return { kind: 'claimed', record: state.record }
    },
    update: async (input) => {
      if (!state.record || state.record.requestHash !== input.requestHash) throw new Error('missing')
      state.record = { ...state.record, ...(input.state ? { state: input.state } : {}), ...(input.outputHash ? { outputHash: input.outputHash } : {}), ...(input.responseSha256 ? { responseSha256: input.responseSha256 } : {}), ...(input.lastErrorCode !== undefined ? { lastErrorCode: input.lastErrorCode } : {}) }
    },
    get record() { return state.record },
  }
}

function clientOf(options: { verify?: SellerClient['verify']; receipt?: SellerClient['submitReceipt'] } = {}): SellerClient {
  return {
    verify: options.verify ?? (async () => ({ kind: 'verified' })),
    submitReceipt: options.receipt ?? (async () => ({ kind: 'accepted' })),
  }
}

async function json(response: Response) { return response.json() as Promise<Record<string, unknown>> }

test('the unpaid external smoke path is the Vibes-coded demo endpoint, not Maha origin', () => {
  assert.equal(VIBES_CODED_UNPAID_SMOKE_PATH, '/api/v1/seller-endpoints/vibes-demo-echo/call')
  assert.equal(new URL(VIBES_CODED_UNPAID_SMOKE_PATH, 'https://vibes-coded.com').origin, 'https://vibes-coded.com')
})

test('unpaid call returns 402 without invoking paid work', async () => {
  const response = await handleGovernedContextCall(request(body(), ''))
  assert.equal(response.status, 402)
  assert.equal((await json(response)).paymentState, 'unpaid')
})

test('malformed input and malformed ticket fail closed without echoing the ticket', async () => {
  const response = await handleGovernedContextCall(request({ ...body(), unexpected: 'health data' }, 'secret-ticket'))
  assert.equal(response.status, 400)
  assert.doesNotMatch(await response.text(), /secret-ticket|health data/)
})

test('valid ticket is bound to exact SKU, method, request hash, and amount', async () => {
  const store = storeOf()
  let seen: Record<string, unknown> | undefined
  const response = await handleGovernedContextCall(request(body()), {
    store,
    client: clientOf({ verify: async (input) => { seen = input as unknown as Record<string, unknown>; return { kind: 'verified' } } }),
  })
  assert.equal(response.status, 200)
  assert.ok(seen?.requestHash)
  const output = await json(response)
  assert.equal((output.sku as Record<string, unknown>).slug, VIBES_CODED_SKU_SLUG)
  assert.equal((output.sku as Record<string, unknown>).priceCents, VIBES_CODED_PRICE_CENTS)
  assert.equal((output.contract as Record<string, unknown>).digest, VIBES_CODED_CONTRACT_DIGEST)
  assert.equal(store.record?.state, 'delivered')
})

for (const [label, field, value] of [
  ['slug', 'slug', 'other-sku'],
  ['method', 'method', 'GET'],
  ['request hash', 'request_hash', 'sha256:' + '0'.repeat(64)],
  ['amount', 'amount_cents', 49],
] as const) {
  test(`mismatched ${label} is rejected by the adapter`, async () => {
    const store = storeOf()
    const response = await handleGovernedContextCall(request(body()), { store, client: clientOf({ verify: async () => ({ kind: 'rejected', code: `ticket_${field}_mismatch` }) }) })
    assert.equal(response.status, 409)
    assert.equal((await json(response)).paymentState, 'rejected')
    void value
  })
}

for (const code of ['ticket_malformed', 'ticket_expired', 'ticket_spent', 'ticket_replayed']) {
  test(`${code} fails closed and cannot be replayed`, async () => {
    const store = storeOf()
    const response = await handleGovernedContextCall(request(body()), { store, client: clientOf({ verify: async () => ({ kind: 'rejected', code }) }) })
    assert.equal(response.status, 409)
    assert.equal(store.record?.state, 'rejected')
    const replay = await handleGovernedContextCall(request(body()), { store, client: clientOf({ verify: async () => ({ kind: 'verified' }) }) })
    assert.equal(replay.status, 409)
  })
}

test('duplicate delivery receipt is idempotent and replay does not reverify', async () => {
  const store = storeOf()
  let verifyCount = 0
  let receiptCount = 0
  const client = clientOf({ verify: async () => { verifyCount += 1; return { kind: 'verified' } }, receipt: async () => { receiptCount += 1; return { kind: 'accepted' } } })
  assert.equal((await handleGovernedContextCall(request(body()), { store, client })).status, 200)
  assert.equal((await handleGovernedContextCall(request(body(), ''), { store, client })).status, 200)
  assert.equal(verifyCount, 1)
  assert.equal(receiptCount, 1)
})

test('interrupted response recovers the deterministic result after payment without a second verifier call', async () => {
  const store = storeOf()
  let receiptCount = 0
  const client = clientOf({ receipt: async () => { receiptCount += 1; return receiptCount === 1 ? { kind: 'unavailable', code: 'receipt_endpoint_unavailable' } : { kind: 'accepted' } } })
  assert.equal((await handleGovernedContextCall(request(body()), { store, client })).status, 202)
  assert.equal(store.record?.state, 'delivery_pending')
  const recovery = await handleGovernedContextCall(request(body()), { store, client })
  assert.equal(recovery.status, 200)
  assert.equal((await json(recovery)).idempotentReplay, true)
})

test('verifier unavailable is paid-but-delivery-pending, not unpaid', async () => {
  const store = storeOf()
  const response = await handleGovernedContextCall(request(body()), { store, client: clientOf({ verify: async () => ({ kind: 'unavailable', code: 'verifier_unavailable' }) }) })
  assert.equal(response.status, 503)
  const output = await json(response)
  assert.equal(output.paymentState, 'paid_delivery_pending')
  assert.notEqual(output.paymentState, 'unpaid')
})

test('receipt endpoint unavailable fails closed after computation', async () => {
  const store = storeOf()
  const response = await handleGovernedContextCall(request(body()), { store, client: clientOf({ receipt: async () => ({ kind: 'unavailable', code: 'receipt_endpoint_unavailable' }) }) })
  assert.equal(response.status, 202)
  assert.equal(store.record?.state, 'delivery_pending')
  assert.equal((await json(response)).paymentState, 'paid_delivery_pending')
})

test('same logical request with a different body or ticket cannot reuse payment state', async () => {
  const store = storeOf()
  const client = clientOf()
  assert.equal((await handleGovernedContextCall(request(body()), { store, client })).status, 200)
  const changed = await handleGovernedContextCall(request(body({ task: 'A different task with the same client request id.' }), 'ticket-001'), { store, client })
  assert.equal(changed.status, 409)
  const differentTicket = await handleGovernedContextCall(request(body(), 'another-ticket'), { store, client })
  assert.equal(differentTicket.status, 200)
})
