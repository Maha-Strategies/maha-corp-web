import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildGovernedTraceReceipt,
  canonicalJson,
  sha256,
  verifyGovernedTraceReceipt,
  type GovernedTraceInput,
  type GovernedTraceReceipt,
  type HawthornTraceExport,
  type ReceiptProof,
} from '../lib/integrations/hawthorn-governed-trace-receipt.ts'

const fixtureUrl = new URL('../fixtures/hawthorn-governed-trace-receipt/synthetic-skillloop-trace.json', import.meta.url)
const governanceUrl = new URL('../fixtures/hawthorn-governed-trace-receipt/synthetic-governance-input.json', import.meta.url)
const receiptUrl = new URL('../fixtures/hawthorn-governed-trace-receipt/synthetic-governed-trace-receipt.json', import.meta.url)
const digest = (value: string) => sha256(value)

async function input(): Promise<GovernedTraceInput> {
  const trace = JSON.parse(await readFile(fixtureUrl, 'utf8')) as HawthornTraceExport
  const governance = JSON.parse(await readFile(governanceUrl, 'utf8')) as Omit<GovernedTraceInput, 'trace'>
  return { trace, ...governance }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

test('builds the same deterministic receipt from the same bounded trace input', async () => {
  const first = await buildGovernedTraceReceipt(await input())
  const second = await buildGovernedTraceReceipt(await input())
  const checkedIn = JSON.parse(await readFile(receiptUrl, 'utf8')) as GovernedTraceReceipt
  assert.deepEqual(first, second)
  assert.deepEqual(first, checkedIn)
  assert.deepEqual(await verifyGovernedTraceReceipt(first), { valid: true, receiptDigest: first.receiptDigest })
  assert.deepEqual(first.layers.evidence.orderedSourceRecords.map(({ recordId }) => recordId), ['source:policy:001', 'source:supplier:002'])
  assert.equal(JSON.stringify(first).includes('synthetic supplier record'), false)
})

test('optional signer receives the exact canonical unsigned receipt and must be verified explicitly', async () => {
  let signedPayload = ''
  const proof: ReceiptProof = { algorithm: 'test-sha256', keyId: 'did:example:offline#key-1', signature: '' }
  const receipt = await buildGovernedTraceReceipt(await input(), async (bytes) => {
    signedPayload = new TextDecoder().decode(bytes)
    return { ...proof, signature: sha256(bytes) }
  })
  assert.equal(receipt.receiptDigest, sha256(signedPayload))
  await assert.rejects(() => verifyGovernedTraceReceipt(receipt), /explicit signature verifier/)
  const verified = await verifyGovernedTraceReceipt(receipt, async (bytes, candidate) => candidate.signature === sha256(bytes))
  assert.equal(verified.valid, true)
})

test('tampering fails closed across evidence, context, authority, outcomes, lineage and digest', async () => {
  const original = await buildGovernedTraceReceipt(await input())
  const cases: Array<[string, (receipt: GovernedTraceReceipt) => void]> = [
    ['source order', (receipt) => { receipt.layers.evidence.orderedSourceRecords.reverse() }],
    ['source digest', (receipt) => { receipt.layers.evidence.orderedSourceRecords[0].digest = digest('tampered') }],
    ['selected context', (receipt) => { receipt.layers.context.selectedContextDigest = digest('tampered') }],
    ['retrieval policy', (receipt) => { receipt.layers.context.retrievalPolicyDigest = digest('tampered') }],
    ['authority', (receipt) => { receipt.layers.authority.role = 'administrator' }],
    ['guardrail', (receipt) => { receipt.layers.receipt.guardrail.outcome = 'blocked' }],
    ['compaction', (receipt) => { receipt.layers.receipt.compaction.outcome = 'failed' }],
    ['escalation', (receipt) => { receipt.layers.receipt.escalation.outcome = 'approved' }],
    ['lineage', (receipt) => { receipt.layers.receipt.lineage.parentTraceId = 'trace_other' }],
    ['receipt digest', (receipt) => { receipt.receiptDigest = digest('wrong') }],
  ]
  for (const [_label, mutate] of cases) {
    const tampered = clone(original)
    mutate(tampered)
    await assert.rejects(() => verifyGovernedTraceReceipt(tampered))
  }
})

test('budget and lineage contradictions are rejected before a receipt exists', async () => {
  const overBudget = await input()
  overBudget.context.budget = { limitTokens: 100, selectedTokens: 101, held: true }
  await assert.rejects(() => buildGovernedTraceReceipt(overBudget), /budget held flag contradicts/)
  const noLineage = await input()
  noLineage.lineage = {}
  await assert.rejects(() => buildGovernedTraceReceipt(noLineage), /lineage is required/)
})

test('a forged upstream trace digest and recomputed invalid governance receipt both fail closed', async () => {
  const forgedTrace = await input()
  forgedTrace.trace.messages = []
  await assert.rejects(() => buildGovernedTraceReceipt(forgedTrace), /trace digest does not match/)

  const invalid = await buildGovernedTraceReceipt(await input())
  ;(invalid.layers.receipt.guardrail.outcome as string) = 'silently_allowed'
  const { receiptDigest: _old, proof: _proof, ...payload } = invalid
  invalid.receiptDigest = sha256(canonicalJson(payload))
  await assert.rejects(() => verifyGovernedTraceReceipt(invalid), /unsupported outcome/)
})

test('canonical JSON is independent of object insertion order', () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, b: 3 } }), canonicalJson({ a: { b: 3, y: 2 }, z: 1 }))
})
