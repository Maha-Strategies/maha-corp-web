import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CONTINUATION_BRANCH, CONTINUATION_CONFIRMATION, ORIGINAL_ID, assertContinuationAdmission, originalDisposition, continuationSecret, pinnedOriginal } from '../scripts/continue-modular132-indexing.ts'
import { BATCH132_PRODUCTION_ENDPOINTS, MODULAR_132_ADDITIONS, releaseExample } from '../lib/api-v1/production-release.ts'
import { BATCH132_CAP, ORIGINAL_ATTEMPT_RESERVE } from '../scripts/run-modular132-indexing.ts'
import { modularPaymentNonce } from '../lib/x402/input-bound-payment.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'

const env = { GITHUB_ACTIONS: 'true', GITHUB_REF: CONTINUATION_BRANCH, GITHUB_RUN_ATTEMPT: '1', GITHUB_RUN_NUMBER: '2',
  MODULAR132_CONTINUATION_CONFIRMATION: CONTINUATION_CONFIRMATION, MODULAR132_ORIGINAL_DIRECTORY: '/tmp/original-test', MODULAR132_CONTINUATION_OUTPUT: '/tmp/output-test' }
test('only the exact approved second workflow run can access continuation spending', () => {
  assert.doesNotThrow(() => assertContinuationAdmission(env, MODULAR_132_ADDITIONS.operatorWallet, 7071050n))
  for (const name of Object.keys(env)) assert.throws(() => assertContinuationAdmission({ ...env, [name]: '' }, MODULAR_132_ADDITIONS.operatorWallet, 7071050n))
  for (const patch of [{ GITHUB_REF: 'refs/heads/main' }, { GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_RUN_NUMBER: '3' }])
    assert.throws(() => assertContinuationAdmission({ ...env, ...patch }, MODULAR_132_ADDITIONS.operatorWallet, 7071050n))
  assert.throws(() => assertContinuationAdmission(env, MODULAR_132_ADDITIONS.payee, 7071050n))
  assert.throws(() => assertContinuationAdmission(env, MODULAR_132_ADDITIONS.operatorWallet, BATCH132_CAP + ORIGINAL_ATTEMPT_RESERVE - 1n))
  assert.doesNotThrow(() => assertContinuationAdmission(env, MODULAR_132_ADDITIONS.operatorWallet, BATCH132_CAP + ORIGINAL_ATTEMPT_RESERVE - 38340n, 38340n))
  assert.throws(() => assertContinuationAdmission(env, MODULAR_132_ADDITIONS.operatorWallet, BATCH132_CAP + ORIGINAL_ATTEMPT_RESERVE - 38341n, 38340n))
  assert.throws(() => assertContinuationAdmission(env, MODULAR_132_ADDITIONS.operatorWallet, 7071050n, 38339n))
})
test('a used original authorization permits only recovery, never a replacement purchase', () => {
  for (const finalizedUsed of [true, false]) assert.equal(originalDisposition({ finalizedUsed, latestUsed: true, finalizedTimestamp: 100n, validBefore: 200n }), 'recover_paid_only')
  assert.throws(() => originalDisposition({ finalizedUsed: true, latestUsed: false, finalizedTimestamp: 300n, validBefore: 200n }), /contradictory/)
})
test('controlled replacement requires finalized expiry and unused nonce on both reads', () => {
  assert.equal(originalDisposition({ finalizedUsed: false, latestUsed: false, finalizedTimestamp: 201n, validBefore: 200n }), 'controlled_replacement_permitted')
  for (const finalizedTimestamp of [100n, 200n]) assert.throws(() => originalDisposition({ finalizedUsed: false, latestUsed: false, finalizedTimestamp, validBefore: 200n }), /not_finalized_expired/)
})
test('only the approved first replacement changes its nonce namespace; untouched products preserve original duplicate protection', () => {
  const key = 'synthetic-test-key', first = BATCH132_PRODUCTION_ENDPOINTS[0]
  assert.equal(first.id, ORIGINAL_ID)
  for (const e of BATCH132_PRODUCTION_ENDPOINTS) {
    const inputHash = demandDigest(releaseExample(e.id)!.input), old = continuationSecret(key, e.id, false), fresh = continuationSecret(key, e.id, e.id === ORIGINAL_ID)
    const oldNonce = modularPaymentNonce(e.id, inputHash, old), freshNonce = modularPaymentNonce(e.id, inputHash, fresh)
    if (e.id === ORIGINAL_ID) assert.notEqual(oldNonce, freshNonce)
    else assert.equal(oldNonce, freshNonce)
  }
})
test('immutable artifact contents must match pinned SHA-256 before parsing', () => {
  const bytes = Buffer.from('{"scope":"synthetic"}'), hash = createHash('sha256').update(bytes).digest('hex')
  assert.deepEqual(pinnedOriginal(bytes, hash), { scope: 'synthetic' })
  assert.throws(() => pinnedOriginal(Buffer.from('{"scope":"changed"}'), hash), /artifact_mismatch/)
})
test('protected manual continuation cannot rerun, deploy, replace previous artifacts, or expand the cap', () => {
  const workflow = readFileSync('.github/workflows/modular132-indexing.yml', 'utf8'), source = readFileSync('scripts/continue-modular132-indexing.ts', 'utf8')
  assert.match(workflow, /github.run_number == 2/); assert.match(workflow, /github.run_attempt == 1/)
  assert.match(workflow, /environment: production-x402-canary/); assert.match(workflow, /11975181639/); assert.match(workflow, /38739743218/)
  assert.doesNotMatch(workflow, /schedule:|pull_request:|push:|vercel|--pay/)
  assert.match(source, /retryCount: 0/); assert.match(source, /recovery: 'retained-result'/)
  assert.match(source, /receiptMatchesAuthorization/); assert.match(source, /original_now_used_do_not_repay/)
  assert.match(source, /step.state = 'authorized_outcome_unknown'; await save/)
  assert.equal((source.match(/await prepareModularPurchase\(/g) ?? []).length, 1)
  assert.equal((source.match(/await submitModularPurchase\(contract, fresh/g) ?? []).length, 1)
  assert.doesNotMatch(source, /zizka|supabase|\.settle\(|store\.put/)
  assert.equal(BATCH132_CAP, 6996054n); assert.equal(ORIGINAL_ATTEMPT_RESERVE, 38339n)
})
