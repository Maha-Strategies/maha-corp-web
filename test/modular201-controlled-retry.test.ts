import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RETRY_CONFIRMATION, assertControlledRetry } from '../scripts/retry-modular201-final.ts'
test('controlled retry needs explicit approval, exact expired-unused proof and sufficient reserved funds', () => {
  const proof = { originalExpiredUnused: true, authorizationUsed: false, id: 'bibliographies-scope-boundary-audit', newPaymentBaseUnits: '0' }
  assert.doesNotThrow(() => assertControlledRetry(proof, RETRY_CONFIRMATION, 38339n))
  for (const patch of [{ originalExpiredUnused: false }, { authorizationUsed: true }, { id: 'other' }, { newPaymentBaseUnits: '38339' }])
    assert.throws(() => assertControlledRetry({ ...proof, ...patch }, RETRY_CONFIRMATION, 38339n))
  assert.throws(() => assertControlledRetry(proof, '', 38339n)); assert.throws(() => assertControlledRetry(proof, RETRY_CONFIRMATION, 38338n))
})
test('controlled purchase has one preparation and one submission, preserves original and encrypts before submitting', () => {
  const source = readFileSync('scripts/retry-modular201-final.ts', 'utf8')
  assert.equal((source.match(/await prepareModularPurchase\(/g) ?? []).length, 1)
  assert.equal((source.match(/await submitModularPurchase\(/g) ?? []).length, 1)
  assert.match(source, /original_now_used_do_not_repay/); assert.match(source, /nonce === prior.nonce/)
  assert.match(source, /\.controlled-retry\.json/); assert.match(source, /maximumAmount: 38339n/)
  assert.match(source, /createCipheriv\('aes-256-gcm'/); assert.match(source, /automaticRepayment: false/)
  assert.match(source, /GITHUB_RUN_NUMBER !== '3'/); assert.match(source, /recoverBatch201RetainedOnly\(contract, saved/)
  assert.match(readFileSync('.github/workflows/modular201-indexing.yml', 'utf8'), /github.run_number == 3/)
  assert.doesNotMatch(source, /store\.put|\.settle\(|while\s*\(|for\s*\(/)
})
