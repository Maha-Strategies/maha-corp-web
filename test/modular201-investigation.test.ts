import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { assertRecoveryAdmission, RECOVERY_BRANCH, RECOVERY_CONFIRMATION, pinnedJson, unusedExpiredProof } from '../scripts/investigate-modular201.ts'
test('recovery investigation only admits exact first approved branch invocation', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REF: RECOVERY_BRANCH, GITHUB_RUN_ATTEMPT: '1', MODULAR201_RECOVERY_CONFIRMATION: RECOVERY_CONFIRMATION,
    MODULAR201_ORIGINAL_DIRECTORY: '/tmp/original', MODULAR201_RECOVERY_OUTPUT: '/tmp/redacted.json' }
  assert.doesNotThrow(() => assertRecoveryAdmission(env))
  for (const field of Object.keys(env)) assert.throws(() => assertRecoveryAdmission({ ...env, [field]: '' }))
  assert.throws(() => assertRecoveryAdmission({ ...env, GITHUB_REF: 'refs/heads/main' }))
  assert.throws(() => assertRecoveryAdmission({ ...env, GITHUB_RUN_ATTEMPT: '2' }))
})
test('artifact bytes are pinned before parsing and expiration uses chain time with unused nonce', () => {
  const bytes = Buffer.from('{"scope":"frozen"}'), digest = createHash('sha256').update(bytes).digest('hex')
  assert.deepEqual(pinnedJson(bytes, digest), { scope: 'frozen' })
  assert.throws(() => pinnedJson(Buffer.from('{"scope":"other"}'), digest))
  assert.equal(unusedExpiredProof(false, 101n, 100n), true)
  assert.equal(unusedExpiredProof(true, 101n, 100n), false)
  assert.equal(unusedExpiredProof(false, 100n, 100n), false)
  assert.equal(unusedExpiredProof(false, 99n, 100n), false)
})
test('investigator cannot sign or submit an original payment and uses artifact-scoped retained reads', () => {
  const source = readFileSync('scripts/investigate-modular201.ts', 'utf8'), workflow = readFileSync('.github/workflows/modular201-indexing.yml', 'utf8')
  assert.doesNotMatch(source, /prepareModularPurchase|signTypedData|sendTransaction|\.settle\(|store\.put|redis/i)
  assert.match(source, /recovery: 'retained-result'/); assert.match(source, /blockTag: 'finalized'/)
  assert.match(source, /newPaymentBaseUnits: '0'/); assert.match(source, /retryCount: 0/)
  assert.match(workflow, /artifact-ids: '11967279124'/); assert.match(workflow, /run-id: '38722500745'/)
  assert.match(workflow, /environment: production-x402-canary/); assert.doesNotMatch(workflow, /--pay|schedule:|push:|pull_request:/)
})
