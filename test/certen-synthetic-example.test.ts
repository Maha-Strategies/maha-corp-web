import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildCertenSyntheticExample, certenExampleDigest, CERTEN_EXAMPLE_TIME, evaluateCertenSyntheticExample } from '../lib/certen-synthetic-example.ts'
import { bytesDigest } from '../lib/x402/buyer-delivery-check.ts'

const example = buildCertenSyntheticExample()
const trust = { authorizationSha256: certenExampleDigest(example.authorization),
  captureSha256: bytesDigest(example.delivery.captureJson), now: CERTEN_EXAMPLE_TIME, usedNonces: [] as string[] }

test('synthetic approval and payload evidence are deterministic, offline and unsigned', () => {
  assert.deepEqual(buildCertenSyntheticExample(), example)
  const result = evaluateCertenSyntheticExample(example, trust)
  assert.equal(result.preSignDecision, 'eligible_for_signer_review')
  assert.equal(result.delivery?.state, 'payload_verified')
  assert.equal(result.actualSignatureIssued, false)
  assert.equal(result.transactionSubmitted, false)
  assert.deepEqual(evaluateCertenSyntheticExample(example, trust), result)
  const { receiptDigest, ...preimage } = result
  assert.equal(receiptDigest, certenExampleDigest(preimage))
})

test('each approved intent field is bound, including endpoint, recipient, chain, amount and nonce', () => {
  for (const key of Object.keys(example.intent)) {
    const value = structuredClone(example)
    ;(value.intent as Record<string, string>)[key] = 'changed'
    assert.equal(evaluateCertenSyntheticExample(value, trust).preSignDecision, 'withhold', key)
  }
})

test('rehashed unauthorized policy and context changes still fail against the independently pinned authorization', () => {
  const value = structuredClone(example)
  value.authorization.policy.requiredText = ''
  value.authorization.approvedIntent.selectedContextSha256 = bytesDigest('')
  value.intent.selectedContextSha256 = bytesDigest('')
  value.selectedContext = ''
  assert.equal(evaluateCertenSyntheticExample(value, trust).preSignDecision, 'withhold')
})

test('missing evidence, altered source bytes, future/expired authority and replayed nonce withhold', () => {
  for (const mutate of [
    (v: typeof example) => { v.evidence = [] },
    (v: typeof example) => { v.evidence[0]!.text += ' changed' },
    (v: typeof example) => { v.selectedContext = '' },
  ]) {
    const value = structuredClone(example); mutate(value)
    assert.equal(evaluateCertenSyntheticExample(value, trust).preSignDecision, 'withhold')
  }
  for (const now of ['invalid', '2026-09-08T10:00:00Z', '2026-09-08T13:00:00Z']) {
    assert.equal(evaluateCertenSyntheticExample(example, { ...trust, now }).preSignDecision, 'withhold')
  }
  assert.equal(evaluateCertenSyntheticExample(example, { ...trust, usedNonces: [example.intent.nonce] }).preSignDecision, 'withhold')
})

test('post-delivery corruption rejects delivery without retroactively changing pre-sign evidence', () => {
  const value = structuredClone(example)
  value.delivery.responseJson += '\n'
  const result = evaluateCertenSyntheticExample(value, trust)
  assert.equal(result.preSignDecision, 'eligible_for_signer_review')
  assert.equal(result.delivery?.state, 'rejected')
})

test('malformed bundles fail closed and canonical hashing binds digest-named fields too', () => {
  for (const value of [null, {}, [], 'wrong', { ...example, syntheticOnly: false }]) {
    assert.equal(evaluateCertenSyntheticExample(value, trust).preSignDecision, 'withhold')
  }
  assert.notEqual(certenExampleDigest({ dossierDigest: 'a' }), certenExampleDigest({ dossierDigest: 'b' }))
  assert.equal(certenExampleDigest({ a: 1, b: 2 }), certenExampleDigest({ b: 2, a: 1 }))
})

test('developer CLI exports a complete replayable example, and refuses to overwrite it', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'maha-certen-check-'))
  const output = join(parent, 'example')
  try {
    const command = ['--experimental-strip-types', 'scripts/run-certen-synthetic-example.ts', '--output-dir', output]
    const generated = spawnSync(process.execPath, command, { encoding: 'utf8' })
    assert.equal(generated.status, 0, generated.stderr)
    const savedTrust = JSON.parse(await readFile(join(output, 'trust.json'), 'utf8'))
    const replayed = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/check-x402-buyer-delivery.ts',
      '--capture', join(output, 'capture.json'), '--request', join(output, 'request.json'), '--response', join(output, 'response.json'),
      '--expected-capture-sha256', savedTrust.captureSha256], { encoding: 'utf8' })
    assert.equal(replayed.status, 0, replayed.stderr)
    assert.equal(JSON.parse(replayed.stdout).state, 'payload_verified')
    assert.equal(spawnSync(process.execPath, command, { encoding: 'utf8' }).status, 1)
  } finally { await rm(parent, { recursive: true, force: true }) }
})
