import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { GENESIS_DIGEST, hashLedgerEntry, ledgerEntrySchema, type LedgerEntry } from '../lib/civic/transparency-ledger.ts'

const entry: Omit<LedgerEntry, 'previousHash'> = {
  sequence: 1,
  timestampIso: '2026-10-04T00:00:00Z',
  category: 'infrastructure',
  amountUsdc: 0.000001,
  counterpartyLabel: 'Synthetic software operator',
  purposeExplanation: 'Synthetic operational cost for ledger tests.',
}

test('Step 2 schema supports each civic spending category and optional transaction references', () => {
  for (const category of ['infrastructure', 'research', 'public-disbursement', 'micro-contribution'] as const) {
    const parsed = ledgerEntrySchema.parse({ ...entry, category, previousHash: GENESIS_DIGEST })
    assert.equal(parsed.category, category)
    assert.equal(parsed.txHashOnChain, undefined)
  }
  const withTransaction = { ...entry, txHashOnChain: '0x' + 'a'.repeat(64), previousHash: GENESIS_DIGEST }
  assert.deepEqual(ledgerEntrySchema.parse(withTransaction), withTransaction)
  assert.equal(ledgerEntrySchema.parse({ ...entry, previousHash: GENESIS_DIGEST }).amountUsdc, 0.000001)
})

test('Step 2 schema rejects invalid values and unexpected keys', () => {
  const valid = { ...entry, previousHash: GENESIS_DIGEST }
  for (const invalid of [
    { sequence: 0 }, { sequence: -1 }, { sequence: 1.5 }, { sequence: Number.MAX_SAFE_INTEGER + 1 },
    { previousHash: 'a'.repeat(63) }, { previousHash: 'A'.repeat(64) },
    { timestampIso: '2026-02-30T00:00:00Z' }, { timestampIso: 'yesterday' },
    { category: 'campaign' }, { amountUsdc: 0 }, { amountUsdc: 0.0000009 }, { amountUsdc: -1 },
    { amountUsdc: NaN }, { amountUsdc: Infinity }, { amountUsdc: '1' },
    { counterpartyLabel: 'x'.repeat(81) }, { purposeExplanation: 'x'.repeat(501) },
    { txHashOnChain: 42 }, { unrecognized: true },
  ]) assert.equal(ledgerEntrySchema.safeParse({ ...valid, ...invalid }).success, false, JSON.stringify(invalid))
})

test('entry hash matches the supplied SHA-256 JSON.stringify contract exactly', () => {
  const expected = createHash('sha256').update(JSON.stringify({ ...entry, previousHash: GENESIS_DIGEST })).digest('hex')
  assert.equal(hashLedgerEntry(entry, GENESIS_DIGEST), expected)
  assert.match(expected, /^[a-f0-9]{64}$/)
  const reordered = Object.fromEntries(Object.entries(entry).reverse()) as Omit<LedgerEntry, 'previousHash'>
  assert.equal(hashLedgerEntry(reordered, GENESIS_DIGEST), createHash('sha256').update(JSON.stringify({ ...reordered, previousHash: GENESIS_DIGEST })).digest('hex'))
  assert.notEqual(hashLedgerEntry(reordered, GENESIS_DIGEST), expected)
})

test('each entry field and predecessor hash is committed to the digest', () => {
  const original = hashLedgerEntry(entry, GENESIS_DIGEST)
  for (const change of [
    { sequence: 2 }, { timestampIso: '2026-10-05T00:00:00Z' }, { category: 'research' as const },
    { amountUsdc: 1.000001 }, { txHashOnChain: '0x' + 'b'.repeat(64) },
    { counterpartyLabel: 'Different counterparty' }, { purposeExplanation: 'Different purpose' },
  ]) assert.notEqual(hashLedgerEntry({ ...entry, ...change }, GENESIS_DIGEST), original)
  assert.notEqual(hashLedgerEntry(entry, 'f'.repeat(64)), original)
})

test('hashing validates before issuing a digest and does not mutate the caller entry', () => {
  const frozen = Object.freeze({ ...entry })
  const snapshot = JSON.stringify(frozen)
  assert.equal(hashLedgerEntry(frozen, GENESIS_DIGEST), hashLedgerEntry(entry, GENESIS_DIGEST))
  assert.equal(JSON.stringify(frozen), snapshot)
  assert.equal(Object.hasOwn(frozen, 'previousHash'), false)
  assert.throws(() => hashLedgerEntry({ ...entry, amountUsdc: Infinity }, GENESIS_DIGEST))
  assert.throws(() => hashLedgerEntry(entry, 'not-a-hash'))
  assert.throws(() => hashLedgerEntry({ ...entry, unexpected: true } as unknown as Omit<LedgerEntry, 'previousHash'>, GENESIS_DIGEST))
})
