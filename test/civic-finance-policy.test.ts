import assert from 'node:assert/strict'
import test from 'node:test'
import { CIVIC_FINANCE_POLICY } from '../lib/civic/finance-policy.ts'
import { GET, POST } from '../app/api/civic/finance/route.ts'
import { appendLedger, GENESIS_DIGEST, verifyLedger, type CivicEvent } from '../lib/civic/transparency-ledger.ts'

test('preview finance policy is immutable and never certifies legal compliance', async () => {
  assert.ok(Object.isFrozen(CIVIC_FINANCE_POLICY))
  assert.equal(CIVIC_FINANCE_POLICY.acceptsPoliticalContributions, false)
  assert.equal(CIVIC_FINANCE_POLICY.executesCampaignPayments, false)
  assert.equal(CIVIC_FINANCE_POLICY.signsWalletTransactions, false)
  assert.equal(Reflect.defineProperty(CIVIC_FINANCE_POLICY, 'acceptsPoliticalContributions', { value: true }), false)
  const response = await GET(), body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(body.complianceStatus, 'jurisdiction-and-entity-review-required')
  assert.match(body.limitation, /not legal compliance/)
})

test('financial POST refuses claimed approvals and does not read private donor data', async () => {
  const request = new Request('https://example.test/api/civic/finance', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-operator' },
    body: JSON.stringify({ action: 'contribute', approved: true, company: 'Synthetic LLC', amountUsdc: 1 }),
  })
  const response = await POST(request)
  assert.equal(response.status, 403)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(request.bodyUsed, false)
  assert.equal((await response.json()).status, 'disabled')
})

test('payment and malformed requests remain disabled without a parsing side effect', async () => {
  for (const body of [JSON.stringify({ action: 'pay', override: true }), 'not JSON']) {
    const request = new Request('https://example.test/api/civic/finance', { method: 'POST', body })
    assert.equal((await POST(request)).status, 403)
    assert.equal(request.bodyUsed, false)
  }
})

test('financial restrictions preserve historical monetary records for auditing', () => {
  const event: CivicEvent = { id: 'historical-fixture', kind: 'contribution', occurredAt: '2026-10-04T00:00:00Z',
    description: 'Synthetic historical declaration, not a new payment', amountBaseUnits: '1000000',
    evidence: [{ citation: 'Synthetic audit fixture', url: 'https://example.test/fixture' }],
    transfer: { network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      from: '0x' + '1'.repeat(40), to: '0x' + '2'.repeat(40), transactionHash: '0x' + 'a'.repeat(64), logIndex: 0 } }
  const receipts = appendLedger([], event)
  assert.equal(verifyLedger(receipts, { ledgerId: 'maha-civic', sequence: 0, digest: GENESIS_DIGEST }).sequence, 1)
  assert.equal(receipts[0].event.kind, 'contribution')
})
