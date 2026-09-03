import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import type { ChainConfirmation } from '../lib/x402/chain.ts'
import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  confirmCanarySettlement,
  settlementEvidence,
  type ConfirmCanarySettlementInput,
} from '../lib/x402/canary-settlement-confirmation.ts'
import { captureResponseBody, writeCaptureRecord } from '../lib/x402/canary-response-capture.ts'

/**
 * The settlement the canary could not see.
 *
 * On 2026-09-02 the paid run got HTTP 200 with a parseable body, read the
 * buyer's balance ~1.6s later, saw no change, and threw `Expected a 15000
 * base-unit debit; observed 0.` Base blocks are ~2s apart and the facilitator
 * settles asynchronously, so the read was simply too early -- a successful
 * settlement rejected as a failure.
 *
 * What matters now is the four-way distinction the old one-shot comparison
 * could not make: the chain agrees, the chain disagrees, it has not happened
 * yet, or nothing could be established. Collapsing the last two is how a second
 * 0.015 USDC charge gets authorized on the strength of a node having a bad
 * minute.
 *
 * Every clock, sleep, chain reader and balance reader here is injected. No
 * network, no wallet, no key, no timers, no real time.
 */

const ROOT = resolve(import.meta.dirname, '..')
const SCRIPT = readFileSync(resolve(ROOT, 'scripts/run-nsgoods-preflight-live-canary.ts'), 'utf8')
const VERIFIER = readFileSync(resolve(ROOT, 'scripts/verify-x402-composite-preflight-live.py'), 'utf8')
const HELPER = readFileSync(resolve(ROOT, 'lib/x402/canary-settlement-confirmation.ts'), 'utf8')

const AMOUNT = '15000'
const TX = `0x${'ab'.repeat(32)}`
const BEFORE = BigInt(653_000)

// Payment authorization material, present only so the tests can prove it never
// reaches an artifact. None of it is real.
const PAYMENT_SIGNATURE = `0x${'cd'.repeat(65)}`
const BUYER_PRIVATE_KEY = `0x${'7c'.repeat(32)}`
const AUTHORIZATION_NONCE = `0x${'f3'.repeat(32)}`

const confirmed = (amount = AMOUNT): ChainConfirmation =>
  ({ status: 'confirmed', blockNumber: 34_000_123, amount, transaction: TX })
const pending = (reason = 'not_yet_mined'): ChainConfirmation => ({ status: 'indeterminate', reason })
const rpcDown = (): ChainConfirmation => ({ status: 'indeterminate', reason: 'rpc_timeouterror' })

/** A fake clock that only moves when the code under test sleeps. */
function fakeTime() {
  let clock = 1_000
  const slept: number[] = []
  return {
    now: () => clock,
    delay: async (ms: number) => { slept.push(ms); clock += ms },
    slept,
    get elapsed() { return clock - 1_000 },
  }
}

type Overrides = Partial<ConfirmCanarySettlementInput>

function run(overrides: Overrides = {}) {
  const time = fakeTime()
  const calls = { confirmTransaction: 0, readBalance: 0 }
  const input: ConfirmCanarySettlementInput = {
    receipt: { success: true, transaction: TX },
    expected: { amountBaseUnits: AMOUNT },
    balanceBefore: BEFORE,
    confirmTransaction: async () => { calls.confirmTransaction += 1; return confirmed() },
    readBalance: async () => { calls.readBalance += 1; return BEFORE - BigInt(AMOUNT) },
    now: time.now,
    delay: time.delay,
    ...overrides,
  }
  // Count calls even when a test supplies its own readers.
  const wrapped: ConfirmCanarySettlementInput = {
    ...input,
    confirmTransaction: async (tx) => { calls.confirmTransaction += 1; return input.confirmTransaction(tx) },
    readBalance: async () => { calls.readBalance += 1; return input.readBalance() },
  }
  return { promise: confirmCanarySettlement(wrapped), time, calls }
}

/** Answers from a scripted sequence, repeating the last entry forever. */
function sequence<T>(items: T[]) {
  let index = 0
  return () => items[Math.min(index++, items.length - 1)]
}

/* ------------------------------------------------------- the happy paths -- */

test('a settlement already on chain confirms on the first look', async () => {
  const { promise, time } = run()
  const result = await promise

  assert.equal(result.state, 'confirmed')
  assert.equal(result.reason, 'settlement_confirmed')
  assert.equal(result.evidence, 'transaction')
  assert.equal(result.passed, true)
  assert.equal(result.transaction, TX)
  assert.equal(result.amountBaseUnits, AMOUNT)
  assert.equal(result.debitedBaseUnits, AMOUNT)
  assert.equal(result.retrySafety, 'settled')
  assert.equal(time.slept.length, 0, 'nothing already settled should have to wait')
})

test('a settlement that lands after several polls still confirms', async () => {
  const next = sequence<ChainConfirmation>([pending(), pending(), pending(), confirmed()])
  const { promise, time, calls } = run({ confirmTransaction: async () => next() })
  const result = await promise

  assert.equal(result.state, 'confirmed')
  assert.equal(result.passed, true)
  assert.equal(calls.confirmTransaction, 4)
  assert.deepEqual(time.slept, [DEFAULT_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS])
  assert.equal(result.elapsedMs, 3 * DEFAULT_POLL_INTERVAL_MS)
  assert.equal(
    result.observations.filter((observation) => observation.detail === 'not_yet_mined').length, 3,
    'each unmined look is recorded, so a slow settlement is visible afterwards',
  )
})

test('a node a block behind is waited out rather than treated as a contradiction', async () => {
  const balances = sequence([BEFORE, BEFORE, BEFORE - BigInt(AMOUNT)])
  const { promise, time } = run({ readBalance: async () => balances() })
  const result = await promise

  assert.equal(result.state, 'confirmed')
  assert.equal(result.debitedBaseUnits, AMOUNT)
  assert.equal(time.slept.length, 2)
})

/* ----------------------------------------------------------- the bounds -- */

test('the procedure stops at its timeout instead of looping', async () => {
  const { promise, time, calls } = run({ confirmTransaction: async () => pending() })
  const result = await promise

  assert.equal(result.state, 'unconfirmed')
  assert.equal(result.reason, 'not_observed_before_timeout')
  assert.ok(result.elapsedMs <= DEFAULT_TIMEOUT_MS, `elapsed ${result.elapsedMs} must stay inside the window`)
  assert.ok(time.elapsed <= DEFAULT_TIMEOUT_MS)
  assert.equal(calls.confirmTransaction, Math.floor(DEFAULT_TIMEOUT_MS / DEFAULT_POLL_INTERVAL_MS) + 1)
  assert.ok(time.slept.every((ms) => ms === DEFAULT_POLL_INTERVAL_MS), 'no busy polling')
})

test('a timeout reports unconfirmed, never that the settlement did not happen', async () => {
  const { promise } = run({ confirmTransaction: async () => pending(), timeoutMs: 10_000, pollIntervalMs: 2_000 })
  const result = await promise

  assert.equal(result.state, 'unconfirmed')
  assert.notEqual(result.state as string, 'contradicted')
  assert.equal(result.passed, false)
  assert.equal(result.transaction, TX, 'the transaction to reconcile later stays on the record')
  assert.match(result.interpretation, /not evidence that it never settled/)
  assert.equal(result.retrySafety, 'do_not_retry_blindly')
  assert.match(result.interpretation, /Do not re-run the paid canary/)
  assert.match(result.interpretation, /second 0\.015 USDC/)
})

test('a custom window is honoured exactly', async () => {
  const { promise, time } = run({
    confirmTransaction: async () => pending(), timeoutMs: 9_000, pollIntervalMs: 3_000,
  })
  const result = await promise

  assert.equal(result.window.timeoutMs, 9_000)
  assert.equal(result.window.pollIntervalMs, 3_000)
  assert.deepEqual(time.slept, [3_000, 3_000, 3_000])
  assert.equal(result.elapsedMs, 9_000)
})

/* ------------------------------------------------- the honest non-answer -- */

test('an unreachable node is unknown, not a denial of settlement', async () => {
  const { promise } = run({ confirmTransaction: async () => rpcDown(), timeoutMs: 10_000, pollIntervalMs: 5_000 })
  const result = await promise

  assert.equal(result.state, 'unknown')
  assert.equal(result.reason, 'rpc_unavailable')
  assert.equal(result.passed, false)
  assert.match(result.interpretation, /nothing was established about this settlement either way/)
  assert.equal(result.retrySafety, 'do_not_retry_blindly')
})

test('a node that answered is told apart from a node that never did', async () => {
  const reachable = await run({
    confirmTransaction: async () => pending(), timeoutMs: 5_000, pollIntervalMs: 5_000,
  }).promise
  const unreachable = await run({
    confirmTransaction: async () => rpcDown(), timeoutMs: 5_000, pollIntervalMs: 5_000,
  }).promise

  assert.equal(reachable.state, 'unconfirmed', 'the node said "not yet", which is information')
  assert.equal(unreachable.state, 'unknown', 'the node said nothing, which is not')
})

test('a balance that cannot be read after a confirmed transfer is unknown, not a pass', async () => {
  const { promise } = run({
    readBalance: async () => { throw new Error('ECONNREFUSED') },
    timeoutMs: 5_000, pollIntervalMs: 5_000,
  })
  const result = await promise

  assert.equal(result.state, 'unknown')
  assert.equal(result.reason, 'rpc_unavailable')
  assert.equal(result.passed, false)
  assert.equal(result.transaction, TX)
})

/* ------------------------------------------------------- failing closed -- */

test('an absent receipt fails closed', async () => {
  const result = await run({ receipt: null }).promise
  assert.equal(result.state, 'contradicted')
  assert.equal(result.reason, 'receipt_absent')
  assert.equal(result.passed, false)
})

test('an unsuccessful receipt fails closed and never reaches the chain', async () => {
  const { promise, calls } = run({ receipt: { success: false, transaction: TX } })
  const result = await promise

  assert.equal(result.state, 'contradicted')
  assert.equal(result.reason, 'receipt_unsuccessful')
  assert.equal(calls.confirmTransaction, 0, 'a failed receipt is not worth confirming')
})

test('a receipt claiming success is not enough on its own', async () => {
  // The receipt says the payment settled. The chain has not said so yet, and
  // that is the whole gap this closes: `success: true` over HTTPS is the
  // facilitator's word, not confirmation.
  const { promise } = run({ confirmTransaction: async () => pending(), timeoutMs: 5_000, pollIntervalMs: 5_000 })
  const result = await promise

  assert.equal(result.passed, false, 'receipt.success === true must never carry a pass by itself')
  assert.equal(result.evidence, 'none', 'nothing was established, so nothing may be claimed as evidence')
  assert.equal(settlementEvidence(result).confirmedOnChain, false)
})

test('a reverted or mismatched transaction is a contradiction, not a retry', async () => {
  for (const reason of ['transaction_reverted', 'no_matching_transfer', 'rpc_wrong_chain:1']) {
    const { promise, calls } = run({
      confirmTransaction: async () => ({ status: 'contradicted', reason }) as ChainConfirmation,
    })
    const result = await promise
    assert.equal(result.state, 'contradicted', reason)
    assert.equal(result.reason, 'chain_contradicted', reason)
    assert.equal(calls.confirmTransaction, 1, 'a contradiction is terminal; it must not be polled through')
  }
})

test('a confirmed transfer of the wrong amount is refused', async () => {
  const result = await run({ confirmTransaction: async () => confirmed('20000') }).promise

  assert.equal(result.state, 'contradicted')
  assert.equal(result.reason, 'amount_not_exact')
  assert.equal(result.amountBaseUnits, '20000')
  assert.equal(result.passed, false)
})

test('a wallet delta that disagrees with a confirmed transfer is refused', async () => {
  for (const after of [BEFORE - BigInt(30_000), BEFORE - BigInt(1), BEFORE + BigInt(5_000)]) {
    const result = await run({ readBalance: async () => after }).promise
    assert.equal(result.state, 'contradicted', `after=${after}`)
    assert.equal(result.reason, 'balance_delta_not_exact', `after=${after}`)
    assert.equal(result.passed, false)
  }
})

/* ------------------------------------------- the limited balance fallback -- */

test('a malformed transaction hash falls back to balance only, and cannot pass', async () => {
  for (const transaction of [undefined, '', '0xnothex', `0x${'ab'.repeat(16)}`]) {
    const { promise, calls } = run({ receipt: { success: true, transaction } })
    const result = await promise

    assert.equal(calls.confirmTransaction, 0, 'there is no hash to confirm')
    assert.equal(result.state, 'unconfirmed', String(transaction))
    assert.equal(result.reason, 'balance_only_attribution_unsafe')
    assert.equal(result.evidence, 'balance_only')
    assert.equal(result.passed, false, 'a balance can never bind a debit to this settlement')
    assert.equal(result.debitedBaseUnits, AMOUNT)
    assert.match(result.interpretation, /Concurrent wallet activity produces an identical delta/)
  }
})

test('an unrelated balance change is never accepted as proof', async () => {
  const result = await run({
    receipt: { success: true, transaction: undefined },
    readBalance: async () => BEFORE - BigInt(500_000),
  }).promise

  assert.equal(result.state, 'contradicted')
  assert.equal(result.reason, 'balance_delta_not_exact')
  assert.equal(result.passed, false)
})

test('the fallback is bounded too, and times out without claiming anything', async () => {
  const { promise, time } = run({
    receipt: { success: true, transaction: undefined },
    readBalance: async () => BEFORE,
    timeoutMs: 12_000, pollIntervalMs: 4_000,
  })
  const result = await promise

  assert.equal(result.state, 'unconfirmed')
  assert.equal(result.reason, 'transaction_missing_or_malformed')
  assert.equal(result.evidence, 'none')
  assert.ok(time.elapsed <= 12_000)
  assert.match(result.interpretation, /Nothing here establishes that the settlement did or did not happen/)
})

/* ------------------------------------------------ no second call, no leak -- */

test('confirmation cannot make another paid request or another signature', async () => {
  const next = sequence<ChainConfirmation>([pending(), pending(), confirmed()])
  const { promise, calls } = run({ confirmTransaction: async () => next() })
  await promise

  // The helper is handed exactly two readers and no way to reach anything else.
  assert.ok(calls.confirmTransaction > 0 && calls.readBalance > 0)
  for (const forbidden of ['fetch(', 'paidFetch', 'signTypedData', 'privateKeyToAccount', 'process.env', 'ENDPOINT']) {
    assert.ok(!HELPER.includes(forbidden), `the confirmation helper must not reference ${forbidden}`)
  }
})

test('a node\'s own words never reach the evidence', async () => {
  const leaky = `rpc_error:auth failed for key ${BUYER_PRIVATE_KEY}`
  const result = await run({
    confirmTransaction: async () => ({ status: 'indeterminate', reason: leaky }) as ChainConfirmation,
    timeoutMs: 5_000, pollIntervalMs: 5_000,
  }).promise

  const serialized = JSON.stringify(settlementEvidence(result))
  assert.ok(!serialized.includes(BUYER_PRIVATE_KEY), 'a raw RPC reason must never be persisted')
  assert.ok(!serialized.includes('auth failed'))
  for (const observation of result.observations) {
    assert.equal(observation.detail, 'rpc_unavailable', 'reasons are normalized to a fixed vocabulary')
  }
})

/* -------------------------------------------- the response still survives -- */

const PROVIDER_BODY = '{\n "schema_version": "preflight_v3",\n "request": {"subject": {"role": "payee"}}\n}'

function evidenceDirectory() {
  const dir = mkdtempSync(join(tmpdir(), 'nsgoods-settle-'))
  return { dir, responsePath: join(dir, 'live-response.json'), capturePath: join(dir, 'response-capture.json') }
}

function paidResponse() {
  return new Response(new TextEncoder().encode(PROVIDER_BODY), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'PAYMENT-SIGNATURE': Buffer.from(JSON.stringify({
        signature: PAYMENT_SIGNATURE, authorization: { nonce: AUTHORIZATION_NONCE },
      })).toString('base64'),
    },
  })
}

/** The canary's own order: capture, then confirm, then record, then judge. */
async function replayCanary(confirmationOverrides: Overrides) {
  const { dir, responsePath, capturePath } = evidenceDirectory()
  const captured = await captureResponseBody(paidResponse(), responsePath)
  await writeCaptureRecord(captured, capturePath, 'https://x402.nsgoods.org/preflight')
  const confirmation = await run(confirmationOverrides).promise
  await writeCaptureRecord(captured, capturePath, 'https://x402.nsgoods.org/preflight', confirmation)
  return { dir, responsePath, capturePath, confirmation }
}

test('the captured response survives a timeout, an RPC failure and a contradiction', async () => {
  const cases: Array<[string, Overrides]> = [
    ['timeout', { confirmTransaction: async () => pending(), timeoutMs: 5_000, pollIntervalMs: 5_000 }],
    ['rpc failure', { confirmTransaction: async () => rpcDown(), timeoutMs: 5_000, pollIntervalMs: 5_000 }],
    ['contradiction', { confirmTransaction: async () => confirmed('20000') }],
    ['bad delta', { readBalance: async () => BEFORE - BigInt(9) }],
  ]

  for (const [label, overrides] of cases) {
    const { responsePath, capturePath, confirmation } = await replayCanary(overrides)

    assert.equal(confirmation.passed, false, label)
    assert.deepEqual(readFileSync(responsePath), Buffer.from(PROVIDER_BODY, 'utf8'), `${label}: bytes intact`)
    assert.ok(existsSync(capturePath), `${label}: sanitized attempt evidence intact`)
    const record = JSON.parse(readFileSync(capturePath, 'utf8')) as { settlement: { state: string; retrySafety: string } }
    assert.equal(record.settlement.state, confirmation.state, label)
    assert.equal(record.settlement.retrySafety, 'do_not_retry_blindly', label)
    assert.notEqual(record.settlement.state, 'false' as string)
  }
})

test('the persisted settlement evidence carries no secrets and keeps 0600', async () => {
  const { dir, responsePath, capturePath } = await replayCanary({})

  for (const path of [responsePath, capturePath]) {
    assert.equal(statSync(path).mode & 0o777, 0o600, `${path} must stay owner-only`)
  }
  assert.deepEqual(readdirSync(dir).sort(), ['live-response.json', 'response-capture.json'])
  for (const name of readdirSync(dir)) {
    const text = readFileSync(join(dir, name), 'utf8')
    for (const secret of [PAYMENT_SIGNATURE, BUYER_PRIVATE_KEY, AUTHORIZATION_NONCE]) {
      assert.ok(!text.includes(secret), `${name} must not carry payment authorization material`)
    }
    assert.ok(!/payment-signature/i.test(text), `${name} must not carry a payment header`)
  }
})

test('the sanitized evidence exposes only the fixed field set', async () => {
  const confirmation = await run().promise
  const evidence = settlementEvidence(confirmation) as Record<string, unknown>

  assert.deepEqual(Object.keys(evidence).sort(), [
    'amountBaseUnits', 'blockNumber', 'confirmedOnChain', 'debitedBaseUnits', 'elapsedMs',
    'evidence', 'interpretation', 'observations', 'reason', 'retrySafety', 'state', 'transaction', 'window',
  ])
  assert.equal(evidence.confirmedOnChain, true)
})

/* ------------------------------------------- the canary and the verifier -- */

test('the canary confirms the settlement instead of racing it', () => {
  assert.ok(!SCRIPT.includes('Expected a 15000 base-unit debit'), 'the racing one-shot check must be gone')
  assert.ok(SCRIPT.includes('confirmCanarySettlement('), 'the bounded confirmation must be used')
  assert.ok(SCRIPT.includes("from '../lib/x402/chain.ts'"), 'the shared chain abstraction must be reused')
  assert.ok(SCRIPT.includes('attempts: 1'), 'the outer window owns the waiting')

  const at = (needle: string) => {
    const index = SCRIPT.indexOf(needle)
    assert.notEqual(index, -1, `the canary no longer contains ${needle}`)
    return index
  }
  // Capture still comes first, and the attempt record is written before the throw.
  assert.ok(at('await captureResponseBody(response, responsePath)') < at('await confirmCanarySettlement('))
  assert.ok(at('await confirmCanarySettlement(') < at('ENDPOINT, confirmation)'))
  assert.ok(at('ENDPOINT, confirmation)') < at('if (!confirmation.passed)'))
  assert.ok(at('if (!confirmation.passed)') < at('await writeFile(evidencePath'))
})

test('the frozen payment boundary is untouched', () => {
  assert.ok(SCRIPT.includes("EXPECTED_AMOUNT = '15000'"), 'the price is fixed')
  assert.ok(SCRIPT.includes("EXPECTED_NETWORK = 'eip155:8453'"), 'the network is fixed')
  assert.ok(SCRIPT.includes("EXPECTED_PAYEE = '0xc87a06DEE4c0E85912296002617120BBfd5EF990'"), 'the payee is fixed')
  assert.ok(SCRIPT.includes("ENDPOINT = `https://x402.nsgoods.org/preflight?address=${SUBJECT}"), 'the endpoint is fixed')
  assert.ok(SCRIPT.includes('Refused more than one payment challenge'), 'one challenge only')
  assert.ok(SCRIPT.includes('Refused more than one payment signature'), 'one signature only')
  assert.equal(SCRIPT.match(/await paidFetch\(/g)?.length, 1, 'exactly one paid request')
})

test('the verifier refuses anything short of a transaction-bound confirmation', () => {
  assert.ok(VERIFIER.includes('maha-nsgoods-preflight-live-canary/1.1'), 'the evidence schema is versioned')
  for (const check of [
    'settlement["state"] == "confirmed"',
    'settlement["evidence"] == "transaction"',
    'settlement["confirmedOnChain"] is True',
    'settlement["amountBaseUnits"] == "15000"',
    'settlement["debitedBaseUnits"] == "15000"',
    'settlement["transaction"] == paid["transaction"]',
  ]) {
    assert.ok(VERIFIER.includes(check), `the verifier must assert ${check}`)
  }
  // The pre-existing strict checks stay exactly as they were.
  assert.ok(VERIFIER.includes('payment["execution"] == {"challengeCount": 1, "signatureCount": 1, "paidHttpStatus": 200}'))
  assert.ok(VERIFIER.includes('paid["amountBaseUnits"] == "15000" and paid["debitedBaseUnits"] == "15000"'))
})
