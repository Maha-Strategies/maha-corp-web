import assert from 'node:assert/strict'
import test from 'node:test'
import { ASSET, fixture, localWorkflow, ORIGIN, paidWorkflow, PATHS, PAYEE, paymentGuard, validateResults } from '../examples/context-growth/workflow.ts'
import { measure, type Observation } from '../examples/context-growth/measurement.ts'
import type { PaymentRequirement } from '../lib/x402/client.ts'
import { compileContextPack, parseContextPackRequest } from '../lib/context-compiler.ts'
import { buildDeepContextEvaluation, parseDeepContextRequest } from '../lib/deep-context-evaluation.ts'

const terms = (amount = '1000'): PaymentRequirement => ({ scheme: 'exact', network: 'eip155:8453', amount, payTo: PAYEE, asset: ASSET, maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2' } })
const challenge = { x402Version: 2, resource: { url: ORIGIN + PATHS[0] }, accepts: [terms()] }

test('synthetic handoff retains prespecified evidence; small budget stops', () => {
  const normal = localWorkflow()
  assert.equal(normal.summary.retained, 4)
  assert.equal(normal.summary.gate, 'LABELLED_SPANS_PRESENT')
  assert.ok(normal.summary.estimatedReductionPercent > 0)
  assert.equal(localWorkflow(64).summary.gate, 'STOP_REQUIRED_EVIDENCE_OMITTED')
  assert.equal(normal.summary.accuracyAssessed, false)
})

test('mismatched pack and fabricated retention are rejected', () => {
  const { input, pack, evaluation } = localWorkflow()
  assert.throws(() => validateResults(input, { ...pack, context: pack.context + 'changed' }, evaluation))
  assert.throws(() => validateResults(input, pack, { ...evaluation, evidence: [] }))
  assert.throws(() => validateResults(fixture(64), pack, evaluation))
})

test('payment guard rejects changed terms, wrong destination and repeat signing', () => {
  for (const override of [{ amount: '1001' }, { amount: '999' }, { network: 'eip155:84532' }, { asset: PAYEE }, { payTo: ASSET }, { maxTimeoutSeconds: 301 }]) {
    assert.throws(() => paymentGuard()(PATHS[0], { ...terms(), ...override }, challenge))
  }
  assert.throws(() => paymentGuard()(PATHS[0], terms(), { ...challenge, resource: { url: 'https://example.com' } }))
  const guard = paymentGuard()
  guard(PATHS[0], terms(), challenge)
  assert.throws(() => guard(PATHS[0], terms(), challenge))
  guard(PATHS[1], terms('10000'), { ...challenge, resource: { url: ORIGIN + PATHS[1] } })
})

test('paid adapter refuses expensive quotes before signing', async () => {
  let signed = 0
  const fetcher = async () => new Response(null, { status: 402, headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify({ ...challenge, accepts: [terms('2000')] })).toString('base64') } })
  await assert.rejects(paidWorkflow(PAYEE, async () => { signed++; return '0x00' }, fetcher))
  assert.equal(signed, 0)
})

test('mock paid transport validates both results without claiming chain confirmation', async () => {
  let signatures = 0
  const fetcher: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname
    const index = PATHS.indexOf(path as typeof PATHS[number])
    assert.notEqual(index, -1)
    assert.equal(init?.redirect, 'error')
    if (!new Headers(init?.headers).has('PAYMENT-SIGNATURE')) {
      return new Response(null, { status: 402, headers: {
        'PAYMENT-REQUIRED': Buffer.from(JSON.stringify({ ...challenge, resource: { url: String(url) }, accepts: [terms(index === 0 ? '1000' : '10000')] })).toString('base64'),
      } })
    }
    const input = JSON.parse(String(init?.body))
    const body = index === 0 ? compileContextPack(parseContextPackRequest(input)) : buildDeepContextEvaluation(parseDeepContextRequest(input))
    return Response.json(body, { status: 201, headers: {
      'PAYMENT-RESPONSE': Buffer.from(JSON.stringify({ success: true, network: 'eip155:8453', transaction: '0x' + String(index + 1).repeat(64) })).toString('base64'),
    } })
  }
  const result = await paidWorkflow(PAYEE, async () => { signatures++; return '0x00' }, fetcher)
  assert.equal(signatures, 2)
  assert.equal(result.summary.retained, 4)
  assert.equal(result.receipts.length, 2)
})

test('missing paid receipt stops before evaluation with no further signature', async () => {
  let calls = 0, signatures = 0
  const fetcher = async () => {
    calls++
    return calls === 1 ? new Response(null, { status: 402, headers: {
      'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge)).toString('base64'),
    } }) : Response.json({})
  }
  await assert.rejects(paidWorkflow(PAYEE, async () => { signatures++; return '0x00' }, fetcher), /Settlement receipt unavailable/)
  assert.equal(calls, 2)
  assert.equal(signatures, 1)
})

const row = (n: number, overrides: Partial<Observation> = {}): Observation => ({
  runId: `run-${n}`, participant: 'tester-a', completedAt: `2026-09-${String(13 + n).padStart(2, '0')}T12:00:00Z`,
  purpose: 'real_work', funding: 'self_funded', independentlyOperated: true, assisted: false,
  resultValidated: true, settlement: 'confirmed', evidenceRef: `private:reconciliation-${n}`,
  payments: [{ endpoint: PATHS[0], transaction: '0x' + String(n).padStart(64, '0'), amountUnits: 1000 }], ...overrides,
})
const report = (observations: Observation[], observedThrough = '2026-09-25T00:00:00Z') => measure({ startedAt: '2026-09-13T00:00:00Z', observedThrough, observations })

test('repeat measurement separates sponsor conversion, organic repeat and immature cohorts', () => {
  const result = report([row(1, { funding: 'sponsored', purpose: 'test' }), row(2), row(3)])
  assert.equal(result.sponsoredToOrganicParticipants, 1)
  assert.equal(result.sevenDayRepeat?.repeatParticipants, 1)
  assert.equal(result.organicRealWorkRuns, 2)
  assert.equal(report([row(1), row(2)], '2026-09-16T00:00:00Z').sevenDayRepeat?.rate, null)
})

test('same-day, sponsored, assisted, failed, unconfirmed and requested tests do not manufacture repeats', () => {
  for (const override of [{ completedAt: row(1).completedAt }, { funding: 'sponsored' as const }, { assisted: true }, { settlement: 'failed' as const }, { settlement: 'unconfirmed' as const }, { purpose: 'test' as const }, { funding: 'unknown' as const }, { resultValidated: false }]) {
    assert.equal(report([row(1), row(2, override)]).sevenDayRepeat?.repeatParticipants, 0)
  }
  assert.throws(() => report([row(1), row(2, { payments: row(1).payments })]))
  assert.throws(() => report([row(1), row(1)]))
  assert.equal(measure({ startedAt: null, observedThrough: '2026-09-13T00:00:00Z', observations: [] }).status, 'not_started')
})
