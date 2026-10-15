import test from 'node:test'
import assert from 'node:assert/strict'
import { assertFrozenDelivery, POSITION_COMPARISON_TOLERANCE_DEGREES } from '../lib/api-v1/frozen-delivery.ts'
import { releaseExample } from '../lib/api-v1/production-release.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { calculationDigest } from '../lib/x402/celestial-products.ts'

const id = 'celestial-position-snapshot'
type Wire = { productId: string; resultHash: string; result: { receiptDigest: string; result: { positions: { body: string; tropicalLongitude: number }[] }; conventions: Record<string, unknown> } }
const sample = () => structuredClone(releaseExample(id)!.output) as Wire
function rehash(value: Wire) {
  const { receiptDigest: _digest, ...payload } = value.result
  value.result.receiptDigest = calculationDigest(payload)
  value.resultHash = demandDigest(value.result)
  return value
}
test('observed Linux Jupiter last-bit difference validates without rewriting delivered bytes', () => {
  const expected = sample(), linux = sample()
  linux.result.result.positions[5].tropicalLongitude = 25.254199844874247
  rehash(linux)
  assert.equal(linux.result.receiptDigest, 'sha256:9b121934fd7356c688e958c3f59c296867b781cef9c04ec3958095d43d143d25')
  const original = JSON.stringify(linux)
  assert.doesNotThrow(() => assertFrozenDelivery(id, linux, expected))
  assert.equal(JSON.stringify(linux), original)
})
test('only bounded celestial numerical variation is permitted; hashes and all other metadata remain binding', () => {
  const expected = sample(), changed = sample()
  changed.result.result.positions[5].tropicalLongitude += POSITION_COMPARISON_TOLERANCE_DEGREES * 2
  assert.throws(() => assertFrozenDelivery(id, rehash(changed), expected), /numeric_mismatch/)
  const wrongHash = sample(); wrongHash.result.result.positions[5].tropicalLongitude += 1e-12
  assert.throws(() => assertFrozenDelivery(id, wrongHash, expected), /integrity_mismatch/)
  const wrongReceipt = sample(); wrongReceipt.result.receiptDigest = 'sha256:' + '00'.repeat(32); wrongReceipt.resultHash = demandDigest(wrongReceipt.result)
  assert.throws(() => assertFrozenDelivery(id, wrongReceipt, expected), /integrity_mismatch/)
  for (const mutate of [(v: Wire) => { v.result.result.positions[5].body = 'Other' }, (v: Wire) => { v.result.conventions.origin = 'other' }, (v: Wire) => { v.productId = 'other' }]) {
    const v = sample(); mutate(v); assert.throws(() => assertFrozenDelivery(id, rehash(v), expected), /metadata_mismatch/)
  }
  assert.throws(() => assertFrozenDelivery('different-product', rehash(changed), expected), /deterministic_delivery_mismatch/)
})
