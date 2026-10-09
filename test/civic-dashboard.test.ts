import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { calculatePolicyVariables } from '../lib/civic/policy-simulation.ts'
import { INITIAL_POLICY_REGISTRY, simulatePolicy } from '../lib/civic/policy-graph.ts'
import { CIVIC_SOURCE_ARCHIVES } from '../lib/civic/source-archives.ts'
import { createLedgerReceipt, GENESIS_DIGEST, verifyLedger, type CivicEvent } from '../lib/civic/transparency-ledger.ts'
import { feedTail, ledgerFeedBundle, mergeLedgerPage, type PublicLedgerPage } from '../lib/civic/ledger-feed.ts'

const policy = INITIAL_POLICY_REGISTRY[0], name = policy.economicVariables[0].name
const genesis = { ledgerId: 'maha-civic', sequence: 0, digest: GENESIS_DIGEST }
const event = (id: string): CivicEvent => ({ id, kind: 'decision', occurredAt: '2026-10-04T00:00:00Z', description: 'Synthetic research decision', rationale: 'Review illustrative evidence only.', evidence: [{ citation: 'Synthetic fixture', url: 'https://example.test/fixture' }] })
const one = createLedgerReceipt(event('one'), genesis)
const two = createLedgerReceipt(event('two'), { ledgerId: one.ledgerId, sequence: 1, digest: one.digest })
const page = (receipts = [one], head = { ledgerId: one.ledgerId, sequence: 1, digest: one.digest }, preceding = genesis, hasMore = false): PublicLedgerPage => ({ status: 'stored-unanchored', receipts, head, preceding, hasMore, limitation: 'Synthetic fixture: server hash validation only.' })

test('interactive baseline, impact and adoption use identical server arithmetic and bind assumptions', () => {
  const scenario = { policyId: policy.id, adoptionRate: .5, baselineOverrides: { [name]: 120 }, impactOverrides: { [name]: -30 } }
  const receipt = simulatePolicy(scenario)
  assert.deepEqual(calculatePolicyVariables(policy, scenario), receipt.variables)
  assert.equal(receipt.variables[0].projectedValue, 105)
  assert.deepEqual(receipt.variables[0].scenarioBounds, [97.5, 105])
  assert.notEqual(receipt.digest, simulatePolicy({ ...scenario, impactOverrides: { [name]: -45 } }).digest)
  for (const delta of [-45.01, -29.99, NaN, Infinity]) assert.throws(() => simulatePolicy({ ...scenario, impactOverrides: { [name]: delta } }))
  assert.throws(() => simulatePolicy({ ...scenario, impactOverrides: { unknown: -30 } }))
  assert.throws(() => calculatePolicyVariables(policy, { ...scenario, baselineOverrides: { [name]: Infinity } }))
})

test('historical legislative archive digest hashes actual served PDF bytes', () => {
  const source = CIVIC_SOURCE_ARCHIVES[0]
  const bytes = readFileSync(new URL('../public' + source.archivePath, import.meta.url))
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.digest)
  assert.equal(policy.primaryLegislativeSources[0].digest, source.digest)
})

test('live ledger merges paginated appends and repeated empty polls without duplicates', () => {
  const first = mergeLedgerPage(null, page([one], { ledgerId: 'maha-civic', sequence: 2, digest: two.digest }, genesis, true))
  assert.equal(first.hasMore, true)
  const second = mergeLedgerPage(first, page([two], { ledgerId: 'maha-civic', sequence: 2, digest: two.digest }, feedTail(first)))
  const unchanged = mergeLedgerPage(second, page([], second.head, feedTail(second)))
  assert.deepEqual(unchanged.receipts, [one, two])
  assert.equal(unchanged.pendingHeads.length, 0)
  const bundle = ledgerFeedBundle(unchanged)
  assert.deepEqual(verifyLedger(bundle.receipts, bundle.preceding, bundle.expectedHead), second.head)
})

test('live ledger rejects cursor resets, changed heads, broken pages and rewritten observed checkpoints', () => {
  const first = mergeLedgerPage(null, page())
  assert.throws(() => mergeLedgerPage(first, page()), /continue/)
  assert.throws(() => mergeLedgerPage(first, page([], { ...first.head, digest: 'f'.repeat(64) }, feedTail(first))), /inconsistent/)
  assert.throws(() => mergeLedgerPage(first, page([{ ...two, previousDigest: 'f'.repeat(64) }], { ledgerId: two.ledgerId, sequence: 2, digest: two.digest }, feedTail(first))), /broken/)
  assert.throws(() => mergeLedgerPage(null, page([], genesis, genesis, true)), /inconsistent/)
  const observed = mergeLedgerPage(null, page([one], { ledgerId: 'maha-civic', sequence: 2, digest: two.digest }, genesis, true))
  assert.throws(() => mergeLedgerPage(observed, page([{ ...two, digest: 'e'.repeat(64) }], { ledgerId: 'maha-civic', sequence: 3, digest: 'f'.repeat(64) }, feedTail(observed), true)), /rewrites/)
})

test('downloaded live suffix stays within the verifier limit and commits exact M2M labels/amounts', () => {
  const monetary: CivicEvent = { id: 'settlement', occurredAt: '2026-10-04T00:00:00Z', description: 'Synthetic machine settlement', evidence: [{ citation: 'Synthetic fixture', url: 'https://example.test/fixture' }], kind: 'expense', amountBaseUnits: '1234567', category: 'infrastructure', counterpartyLabel: 'Synthetic agent', settlementChannel: 'machine-to-machine', transfer: { network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', from: '0x' + '1'.repeat(40), to: '0x' + '2'.repeat(40), transactionHash: '0x' + 'a'.repeat(64), logIndex: 0 } }
  const money = createLedgerReceipt(monetary, genesis)
  assert.equal(money.event.settlementChannel, 'machine-to-machine')
  const receipts = [money]
  for (let i = 1; i < 105; i++) receipts.push(createLedgerReceipt(event(`fixture-${i}`), { ledgerId: 'maha-civic', sequence: i, digest: receipts[i - 1].digest }))
  let feed = mergeLedgerPage(null, page(receipts.slice(0, 100), { ledgerId: 'maha-civic', sequence: 105, digest: receipts[104].digest }, genesis, true))
  feed = mergeLedgerPage(feed, page(receipts.slice(100), feed.head, feedTail(feed)))
  const bundle = ledgerFeedBundle(feed)
  assert.equal(bundle.receipts.length, 100); assert.equal(bundle.preceding.sequence, 5)
  assert.deepEqual(verifyLedger(bundle.receipts, bundle.preceding, bundle.expectedHead), feed.head)
})
