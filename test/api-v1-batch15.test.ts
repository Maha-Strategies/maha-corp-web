import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import canonicalize from 'canonicalize'
import ts from 'typescript'
import { privateKeyToAccount } from 'viem/accounts'
import { ENDPOINTS, REGISTRY_SUMMARY } from '../lib/api-v1/endpoints.registry.ts'
import { FIFTEENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { FIFTEENTH_BATCH_AUDITS } from '../lib/api-v1/batch15-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-14-contract-snapshot.json' with { type: 'json' }
import { decodeChallenge, decodeReceipt, buildTypedData, encodePaymentSignature } from '../lib/x402/client.ts'
import { prepareModularPurchase, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
import { MAHA_PAYEE } from '../lib/x402/merchant-identity.ts'
import { validate } from './helpers/json-schema.ts'
const CLOCK = Date.parse('2026-10-14T06:00:00Z'), TX = '0x' + '9a'.repeat(32)
const env = { NODE_ENV: 'test' as const, BASE_PAYEE_ADDRESS: MAHA_PAYEE }
// Unfunded test key. Neither a chain provider nor a real facilitator is used.
const account = privateKeyToAccount(('0x' + '39'.repeat(32)) as `0x${string}`)
const hash = (v: unknown) => 'sha256:' + createHash('sha256').update(canonicalize(v)!).digest('hex')
let networkAttempts = 0
const savedFetch = globalThis.fetch
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch15_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => FIFTEENTH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(FIFTEENTH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof FIFTEENTH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof FIFTEENTH_BATCH[number], now: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch15-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('700 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 700); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.path, r.path); assert.equal(e.method, r.method); assert.equal(hash(e.schema.input), r.inputDigest); assert.equal(hash(e.schema.output), r.outputDigest); assert.equal(hash(e), r.contractDigest) }
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch15 is the next 50 unimplemented recipes, without recounting earlier cohorts', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => /^(thermal-measurements|robotics-telemetry|neural-interface-records|sky-observations)-/.test(e.id) && !done.has(e.id)).slice(0, 50)
  assert.deepEqual(FIFTEENTH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(FIFTEENTH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of FIFTEENTH_BATCH) {
    assert.equal(e.productionApproved, false); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost.liveModelSpendApproved, false)
    assert.equal(e.execution_cost.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.equal(e.sourceReview, 'not-applicable')
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, 958)
})
for (const spec of FIFTEENTH_BATCH_AUDITS) {
  const e = FIFTEENTH_BATCH.find(e => e.id === spec.id)!
  test('batch15 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
    const h = handlerFor(e.id, e.amount)!, clean = await h.execute(spec.sample) as Report, bad = await h.execute(spec.adverse) as Report
    assert.deepEqual(clean.result.findings, []); assert.deepEqual(bad.result.findings.map(f => f.code).sort(), [...spec.expectedCodes].sort())
    for (const [i, out] of [[spec.sample, clean], [spec.adverse, bad]] as const) {
      assert.deepEqual(validate(i, e.schema.input), []); assert.deepEqual(validate({ success: true, data: out, proof: { settlement_id: TX } }, e.schema.output), [])
      assert.equal(out.inputHash, hash(i)); assert.equal(out.resultHash, hash(out.result)); assert.equal(out.chargedAmount, e.amount)
      assert.ok(Buffer.byteLength(JSON.stringify(out)) < 65000)
      assert.equal(out.result.domainValidationEstablished, false); assert.equal(out.result.authoritativeSourcesConsulted, false)
    }
    const forged = { ...clean, result: { ...clean.result, domainValidationEstablished: true } }
    assert.throws(() => h.output.parse({ ...forged, resultHash: hash(forged.result) }))
    assert.throws(() => h.output.parse({ ...clean, resultHash: 'sha256:' + '0'.repeat(64) }))
    for (const i of [{ ...spec.sample, nonpersonalMetadata: false }, { ...spec.sample, dataClass: 'private' }, { ...spec.sample, secret: 'forbidden' }]) assert.throws(() => h.input.parse(i))
    const collection = Object.entries(spec.sample).find(([, v]) => Array.isArray(v) && v[0] && typeof v[0] === 'object')!
    const [key, values] = collection, rows = values as object[]
    assert.throws(() => h.input.parse({ ...spec.sample, [key]: [{ ...rows[0], participantName: 'forbidden' }] }))
    assert.throws(() => h.input.parse({ ...spec.sample, [key]: Array(33).fill(rows[0]) }))
  })
  test('batch15 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
    let now = CLOCK; const f = fixture(e, () => now)
    try {
      let route = f.route()
      const request = f.request(spec.sample), quoteResponse = await route(request)
      assert.equal(quoteResponse.status, 402); const quote = decodeChallenge(quoteResponse.headers.get('PAYMENT-REQUIRED')!)
      assert.equal(quote.accepts[0].amount, e.amount); assert.equal(quote.accepts[0].network, 'eip155:8453')
      for (const bad of [{}, { ...spec.sample, dataClass: 'private' }]) assert.equal((await route(f.request(bad, await headers(e, bad, quote)))).status, 400)
      assert.deepEqual(f.counts(), { settlements: 0, executions: 0 })
      const authorization = await headers(e, spec.sample, quote), paid = await route(f.request(spec.sample, authorization))
      assert.equal(paid.status, 200); const output = await paid.json(); assert.equal(decodeReceipt(paid.headers.get('PAYMENT-RESPONSE')!)!.transaction, TX)
      assert.deepEqual(validate(output, e.schema.output), [])
      f.restart(); now += 120000; route = f.route()
      const recovered = await route(f.request(spec.sample, { ...authorization, 'X-Maha-Recovery-Mode': 'retained-result' }))
      assert.equal(recovered.status, 200); assert.deepEqual(await recovered.json(), output); assert.deepEqual(f.counts(), { settlements: 1, executions: 1 })
      now = CLOCK + 86400000; assert.equal((await route(f.request(spec.sample, { ...authorization, 'X-Maha-Recovery-Mode': 'retained-result' }))).status, 410)
      assert.equal(f.counts().settlements, 1)
      assert.equal((await with402Payment(e, f.h, { environment: { NODE_ENV: 'production' } })(f.request(spec.sample))).status, 503)
    } finally { f.close() }
  })
  test('batch15 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
    const f = fixture(e, () => CLOCK)
    try {
      const route = f.route(); let persisted = false, signatures = 0
      const transport: typeof fetch = async (url, init) => { if (new Headers(init?.headers).has('PAYMENT-SIGNATURE')) assert.ok(persisted); return route(new Request(url, init)) }
      const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (i: unknown) => f.h.input.parse(i), validateOutput: (o: unknown) => f.h.output.parse(o) }
      const capsule = await prepareModularPurchase(contract, { input: spec.adverse, payer: account.address, maximumAmount: BigInt(e.amount), now: CLOCK,
        fetchImpl: transport, signTypedData: async typed => { signatures++; return account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]) }, persist: async () => { persisted = true } })
      const lost: typeof fetch = async (url, init) => { const response = await transport(url, init); assert.equal(response.status, 200); await response.body?.cancel(); throw Error('response_lost') }
      assert.equal((await submitModularPurchase(contract, capsule, { fetchImpl: lost, now: CLOCK })).delivery, 'unresolved')
      const recovered = await submitModularPurchase(contract, capsule, { fetchImpl: transport, now: CLOCK + 120000, recovery: 'retained-result' })
      assert.equal(recovered.delivery, 'validated_response'); assert.equal(recovered.replayed, true)
      const altered = structuredClone(capsule); altered.headers['X-Maha-Input-Hash'] = 'sha256:' + 'b'.repeat(64)
      await assert.rejects(submitModularPurchase(contract, altered, { fetchImpl: transport, now: CLOCK }))
      assert.equal(signatures, 1); assert.deepEqual(f.counts(), { settlements: 1, executions: 1 })
    } finally { f.close() }
  })
  test('batch15 registry router honors the reviewed production projection: ' + e.id, async () => {
    const f = fixture(e, () => CLOCK)
    try {
      let settlements = 0
      const local = createEndpointRouter({ environment: env, now: () => CLOCK, store: memoryPaymentStore(() => CLOCK),
        facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
      const quote = await local(f.request(spec.sample)); assert.equal(quote.status, 402)
      const delivered = await local(f.request(spec.sample, await headers(e, spec.sample, decodeChallenge(quote.headers.get('PAYMENT-REQUIRED')!))))
      assert.equal(delivered.status, 200); assert.equal(settlements, 1); assert.deepEqual(validate(await delivered.json(), e.schema.output), [])
      const production = createEndpointRouter({ environment: { NODE_ENV: 'production', VERCEL: '1' } })
      assert.equal((await production(f.request(spec.sample))).status, PRODUCTION_ENDPOINTS.some(p => p.id === e.id) ? 503 : 404)
    } finally { f.close() }
  })
}
test('batch15 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
  const visited = new Set<string>(), packages = new Set(['zod', 'canonicalize', 'node:crypto'])
  const visit = (path: string) => {
    if (visited.has(path)) return; visited.add(path)
    assert.ok(path.startsWith(resolve('lib') + '/')); const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /zizka(?:db)?|supabase|\.env/i)
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    const walk = (n: ts.Node) => {
      if ((ts.isImportDeclaration(n) && !n.importClause?.isTypeOnly) || (ts.isExportDeclaration(n) && !n.isTypeOnly && n.moduleSpecifier)) {
        const moduleRef = (n as ts.ImportDeclaration | ts.ExportDeclaration).moduleSpecifier
        if (moduleRef && ts.isStringLiteral(moduleRef)) { const name = moduleRef.text; if (name.startsWith('.')) visit(resolve(dirname(path), name)); else assert.ok(packages.has(name), name) }
      }
      if (ts.isCallExpression(n)) { assert.notEqual(n.expression.kind, ts.SyntaxKind.ImportKeyword); if (ts.isIdentifier(n.expression)) assert.ok(!['fetch', 'eval', 'Function', 'require'].includes(n.expression.text)) }
      ts.forEachChild(n, walk)
    }; walk(ast)
  }; visit(resolve('lib/api-v1/batch15-audits.ts')); assert.ok(visited.size >= 6)
})

const rows = (i: Record<string, unknown>, k: string) => i[k] as Record<string, unknown>[]
const values = (id: string, i: unknown) => Object.fromEntries(inspect(id, i).metrics.map(m => [m.key, m.value]))
const codes = (id: string, i: unknown) => inspect(id, i).findings.map(f => f.code)
const thermal = 'thermal-measurements-condition-coverage-map', robotTime = 'robotics-telemetry-timestamp-order-audit'
const neural = 'neural-interface-records-condition-coverage-map', sky = 'sky-observations-condition-coverage-map'

test('thermal conductance is exact supplied mW/mK arithmetic, not thermal conductivity', () => {
  const i = sample(thermal), r = rows(i, 'rows')[0]
  assert.equal(values(thermal, i)['thermal-measurements-apparent-conductance-W-per-K'], '2')
  for (const [q, dt, expected] of [[0, 1, '0'], [1, 3, '1/3'], [1e9, 1, '1000000000'], [1e9, 1e9, '1']]) {
    const result = inspect(thermal, { ...i, rows: [{ ...r, heatFlowMilliwatts: q, temperatureDifferenceMillikelvin: dt }] })
    assert.deepEqual(result.findings, []); assert.equal(result.metrics[1].value, expected)
    assert.ok(result.metrics.every(m => !m.key.includes('conductivity')))
  }
})
test('thermal applicability failures never derive a physical ratio from unknown or incompatible readings', () => {
  const i = sample(thermal), r = rows(i, 'rows')[0]
  for (const [delta, suffix] of [[{ regime: 'transient' }, 'steady-state-not-declared'], [{ regime: 'unknown' }, 'steady-state-not-declared'], [{ fixtureRef: 'fixture2' }, 'fixture-frame-mismatch'], [{ heatFlowMilliwatts: null }, 'reading-not-exact'], [{ temperatureDifferenceMillikelvin: null }, 'reading-not-exact'], [{ qualifier: 'unknown' }, 'reading-not-exact'], [{ temperatureDifferenceMillikelvin: 0 }, 'temperature-difference-zero']] as const) {
    const result = inspect(thermal, { ...i, rows: [{ ...r, ...delta }] }); assert.deepEqual(result.findings.map(f => f.code), ['thermal-measurements-' + suffix]); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('thermal fixed dimensions reject absolute-temperature fields, alternate units and invalid integers', () => {
  const i = sample(thermal), r = rows(i, 'rows')[0]
  for (const delta of [{ heatFlowMilliwatts: -1 }, { heatFlowMilliwatts: 1.5 }, { heatFlowMilliwatts: 1e9 + 1 }, { temperatureDifferenceMillikelvin: -1 }, { unit: 'watts' }, { hotKelvin: 100 }]) assert.throws(() => inspect(thermal, { ...i, rows: [{ ...r, ...delta }] }))
})
test('thermal material-lot and measurement-source bindings preserve separate exact pins', () => {
  const id = 'thermal-measurements-reference-integrity-map', i = sample(id), r = rows(i, 'rows')[0]
  assert.deepEqual(codes(id, { ...i, rows: [{ ...r, methodDigest: 'sha256:' + 'b'.repeat(64) }] }), [])
  assert.deepEqual(codes(id, { ...i, rows: [{ ...r, materialLotRef: 'other' }] }), ['thermal-measurements-material-lot-pin-mismatch'])
  const p = 'thermal-measurements-provenance-edge-audit', x = sample(p), s = rows(x, 'sources')[0]
  assert.deepEqual(codes(p, { ...x, sources: [{ ...s, methodDigest: 'sha256:' + 'b'.repeat(64) }] }), ['thermal-measurements-measurement-source-pin-mismatch'])
})
test('robot time policy is inclusive at its tick gap and never sorts away regressions', () => {
  const i = sample(robotTime), [a, b] = rows(i, 'rows')
  assert.deepEqual(codes(robotTime, i), []); assert.deepEqual(Object.values(values(robotTime, i)), ['1', '1'])
  assert.deepEqual(codes(robotTime, { ...i, maximumGapTicks: 9 }), ['robotics-telemetry-clock-gap-exceeded'])
  assert.deepEqual(codes(robotTime, { ...i, rows: [b, a] }), ['robotics-telemetry-sequence-not-increasing', 'robotics-telemetry-ticks-not-increasing'])
})
test('robot clock and coordinate mismatches break adjacency instead of producing cross-frame gaps', () => {
  const i = sample(robotTime), [a, b] = rows(i, 'rows')
  for (const delta of [{ clockRef: 'clock2' }, { frameRef: 'frame2' }, { qualifier: 'unknown' }, { timeTicks: null }]) {
    const result = inspect(robotTime, { ...i, rows: [a, { ...b, ...delta }, { ...b, id: 's3', sequence: 2, timeTicks: 100000 }] })
    assert.equal(result.findings.length, 1); assert.ok(!result.findings.some(f => f.code.includes('gap-exceeded')))
    assert.deepEqual(result.metrics.map(m => m.value), ['0', '0'])
  }
})
test('robot duplicate/equal sequence counters and equal ticks are explicit negative evidence', () => {
  const i = sample(robotTime), [a, b] = rows(i, 'rows')
  assert.deepEqual(codes(robotTime, { ...i, rows: [a, { ...b, sequence: 0 }] }), ['robotics-telemetry-sequence-not-increasing'])
  assert.deepEqual(codes(robotTime, { ...i, rows: [a, { ...b, timeTicks: 0 }] }), ['robotics-telemetry-ticks-not-increasing'])
  assert.deepEqual(Object.values(values(robotTime, { ...i, rows: [a] })), ['0', '0'])
  assert.throws(() => inspect(robotTime, { ...i, rows: [a, a] }), /duplicate_ids/)
})
test('robot observation conditions require exactly one satisfied pinned declaration', () => {
  const id = 'robotics-telemetry-condition-coverage-map', i = sample(id), r = rows(i, 'checks')[0]
  assert.deepEqual(codes(id, { ...i, checks: [] }), ['robotics-telemetry-condition-not-established'])
  assert.deepEqual(codes(id, { ...i, checks: [r, { ...r, id: 'c2' }] }), ['robotics-telemetry-condition-not-established'])
  for (const delta of [{ frameRef: 'frame2' }, { clockRef: 'clock2' }, { calibrationDigest: 'sha256:' + 'b'.repeat(64) }]) {
    assert.deepEqual(codes(id, { ...i, checks: [{ ...r, ...delta }] }), ['robotics-telemetry-condition-not-established', 'robotics-telemetry-condition-frame-mismatch'])
  }
  assert.deepEqual(codes(id, { ...i, checks: [r, { ...r, id: 'c2', checkRef: 'undeclared' }] }), ['robotics-telemetry-condition-undeclared'])
})
test('robot frame-pinned unit checking does not equate degrees/radians or metres/millimetres', () => {
  const id = 'robotics-telemetry-unit-label-consistency', i = sample(id), r = rows(i, 'measurements')[0]
  assert.deepEqual(codes(id, { ...i, measurements: [r, { ...r, id: 'm2', unit: 'millimetres', value: 1000 }] }), ['robotics-telemetry-unit-label-conflict'])
  assert.deepEqual(codes(id, { ...i, measurements: [{ ...r, quantity: 'orientation-angle', unit: 'radians' }, { ...r, id: 'm2', quantity: 'orientation-angle', unit: 'degrees' }] }), ['robotics-telemetry-unit-label-conflict'])
  assert.deepEqual(codes(id, { ...i, measurements: [{ ...r, quantity: 'angular-velocity', unit: 'radians' }] }), ['robotics-telemetry-quantity-unit-mismatch'])
})
for (const [category, framePins] of [
  ['robotics-telemetry', ['frameRef', 'clockRef', 'calibrationDigest', 'recordRevision']],
  ['neural-interface-records', ['simulationRef', 'modelDigest', 'calibrationDigest', 'pipelineRevision', 'featureSchemaDigest']],
  ['sky-observations', ['coordinateFrameRef', 'epochRef', 'observerConfigDigest', 'methodDigest']],
] as const) {
  test(category + ' unit checks isolate every declared physical/model frame pin', () => {
    const id = category + '-unit-label-consistency', i = sample(id), r = rows(i, 'measurements')[0]
    const alternate = category === 'robotics-telemetry' ? 'millimetres' : category === 'neural-interface-records' ? 'kilohertz' : 'hours-angle'
    assert.deepEqual(codes(id, { ...i, measurements: [r, { ...r, id: 'm2', unit: alternate }] }), [category + '-unit-label-conflict'])
    for (const pin of framePins) {
      const changed = { ...r, id: 'm2', unit: alternate, [pin]: pin.endsWith('Digest') || pin.endsWith('Revision') ? 'sha256:' + 'b'.repeat(64) : 'frame2' }
      assert.deepEqual(codes(id, { ...i, measurements: [r, changed] }), [])
    }
  })
  test(category + ' bounds require exact frame/unit, one bound and known uncensored values', () => {
    const id = category + '-declared-bound-audit', i = sample(id), b = rows(i, 'bounds')[0], r = rows(i, 'measurements')[0]
    for (const value of [0, 1]) assert.deepEqual(codes(id, { ...i, measurements: [{ ...r, value }] }), [])
    assert.deepEqual(codes(id, { ...i, measurements: [{ ...r, value: -1 }] }), [category + '-value-outside-declared-bound'])
    for (const pin of framePins) {
      const changed = { ...b, [pin]: pin.endsWith('Digest') || pin.endsWith('Revision') ? 'sha256:' + 'b'.repeat(64) : 'frame2' }
      assert.deepEqual(codes(id, { ...i, bounds: [changed] }), [category + '-bound-not-unique'])
    }
    assert.deepEqual(codes(id, { ...i, bounds: [b, { ...b, id: 'b2' }] }), [category + '-bound-not-unique'])
    for (const delta of [{ value: null }, { qualifier: 'below-limit' }, { qualifier: 'above-limit' }, { qualifier: 'unknown' }]) assert.deepEqual(codes(id, { ...i, measurements: [{ ...r, ...delta }] }), [category + '-value-not-exact'])
    const alternate = category === 'robotics-telemetry' ? 'millimetres' : category === 'neural-interface-records' ? 'kilohertz' : 'hours-angle'
    assert.deepEqual(codes(id, { ...i, bounds: [{ ...b, unit: alternate }] }), [category + '-bound-frame-or-unit-mismatch'])
    assert.throws(() => inspect(id, { ...i, bounds: [{ ...b, minimum: 2 }] }), /reversed_framed_bounds/)
  })
}
test('neural synthetic confusion accounting produces exact window fractions, not hourly event rates', () => {
  const i = sample(neural), out = values(neural, i)
  assert.equal(out['neural-interface-records-rest-false-window-fraction'], '1/100'); assert.equal(out['neural-interface-records-intention-missed-window-fraction'], '1/5')
  assert.ok(!Object.keys(out).some(k => /hour|event-rate|clinical/.test(k)))
  const r = rows(i, 'rows')[0], zero = values(neural, { ...i, rows: [{ ...r, restFalseCommandWindows: 0, detectedIntentionWindows: 10, missedIntentionWindows: 0 }] })
  assert.equal(zero['neural-interface-records-rest-false-window-fraction'], '0'); assert.equal(zero['neural-interface-records-intention-missed-window-fraction'], '0')
})
test('neural unknown counts, zero denominators and inconsistent binary totals never yield rates', () => {
  const i = sample(neural), r = rows(i, 'rows')[0]
  for (const delta of [{ restWindows: null }, { restFalseCommandWindows: null }, { intentionWindows: null }, { detectedIntentionWindows: null }, { missedIntentionWindows: null }, { restWindows: 0 }, { intentionWindows: 0 }, { restFalseCommandWindows: 101 }, { missedIntentionWindows: 3 }, { detectedIntentionWindows: 11 }]) {
    const result = inspect(neural, { ...i, rows: [{ ...r, ...delta }] }); assert.equal(result.findings.length, 1); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('neural model/calibration/pipeline mismatches block cross-configuration aggregation', () => {
  const i = sample(neural), r = rows(i, 'rows')[0]
  for (const pin of ['modelDigest', 'calibrationDigest', 'pipelineRevision']) {
    const result = inspect(neural, { ...i, rows: [{ ...r, [pin]: 'sha256:' + 'b'.repeat(64) }] }); assert.deepEqual(result.findings.map(f => f.code), ['neural-interface-records-evaluation-frame-mismatch']); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('neural evaluation refuses public/participant data and does not certify declared frozen labels', async () => {
  const i = sample(neural), r = rows(i, 'rows')[0], e = FIFTEENTH_BATCH.find(e => e.id === neural)!, h = handlerFor(e.id, e.amount)!
  assert.throws(() => h.input.parse({ ...i, dataClass: 'public' })); assert.throws(() => h.input.parse({ ...i, rows: [{ ...r, participantId: 'p1' }] }))
  assert.deepEqual(codes(neural, { ...i, rows: [{ ...r, labelsFrozenBeforeEvaluation: false }] }), ['neural-interface-records-labels-not-frozen-declared'])
  const out = await h.execute(i) as Report; assert.equal(out.result.domainValidationEstablished, false); assert.equal(out.result.authoritativeSourcesConsulted, false)
})
test('neural binary count limits reject negatives/fractions and retain exact bounded ratios', () => {
  const i = sample(neural), r = rows(i, 'rows')[0]
  for (const count of [-1, 0.5, 1000001]) assert.throws(() => inspect(neural, { ...i, rows: [{ ...r, restFalseCommandWindows: count }] }))
  const out = values(neural, { ...i, rows: [{ ...r, restWindows: 1000000, restFalseCommandWindows: 999999, intentionWindows: 1000000, detectedIntentionWindows: 1, missedIntentionWindows: 999999 }] })
  assert.equal(out['neural-interface-records-rest-false-window-fraction'], '999999/1000000'); assert.equal(out['neural-interface-records-intention-missed-window-fraction'], '999999/1000000')
})
test('sky interval union deduplicates overlaps and reports uncovered/redundant duration exactly', () => {
  const i = sample(sky), r = rows(i, 'exposures')[0]
  const value = { ...i, minimumCoveragePpm: 750000, exposures: [{ ...r, endsMs: 500 }, { ...r, id: 'e2', startsMs: 250, endsMs: 750 }] }
  const out = values(sky, value); assert.deepEqual(codes(sky, value), [])
  assert.equal(out['sky-observations-union-milliseconds'], '750'); assert.equal(out['sky-observations-uncovered-milliseconds'], '250'); assert.equal(out['sky-observations-redundant-milliseconds'], '250'); assert.equal(out['sky-observations-declared-coverage-fraction'], '3/4')
  assert.deepEqual(codes(sky, { ...value, minimumCoveragePpm: 750001 }), ['sky-observations-declared-coverage-below-target'])
})
test('sky half-open adjacency, nesting and reordering preserve union rather than summed exposure', () => {
  const i = sample(sky), r = rows(i, 'exposures')[0]
  const adjacent = { ...i, exposures: [{ ...r, endsMs: 500 }, { ...r, id: 'e2', startsMs: 500 }] }
  assert.equal(values(sky, adjacent)['sky-observations-union-milliseconds'], '1000'); assert.equal(values(sky, adjacent)['sky-observations-redundant-milliseconds'], '0')
  const nested = { ...i, exposures: [r, { ...r, id: 'e2', startsMs: 100, endsMs: 200 }] }
  assert.equal(values(sky, nested)['sky-observations-union-milliseconds'], '1000'); assert.equal(values(sky, nested)['sky-observations-redundant-milliseconds'], '100')
  assert.deepEqual(values(sky, { ...nested, exposures: [...nested.exposures].reverse() }), values(sky, nested))
})
test('sky empty declaration is zero known coverage, not a fabricated observation', () => {
  const i = sample(sky), value = { ...i, exposures: [] }
  assert.deepEqual(codes(sky, value), ['sky-observations-declared-coverage-below-target'])
  assert.equal(values(sky, value)['sky-observations-declared-coverage-fraction'], '0')
  assert.deepEqual(codes(sky, { ...value, minimumCoveragePpm: 0 }), [])
})
test('sky unknown intervals and frame/epoch/observer/clock mismatches block every coverage total', () => {
  const i = sample(sky), r = rows(i, 'exposures')[0]
  for (const delta of [{ coordinateFrameRef: 'frame2' }, { epochRef: 'epoch2' }, { observerConfigDigest: 'sha256:' + 'b'.repeat(64) }, { clockRef: 'clock2' }, { startsMs: null }, { endsMs: null }, { qualifier: 'unknown' }]) {
    const result = inspect(sky, { ...i, exposures: [{ ...r, ...delta }] }); assert.equal(result.findings.length, 1); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('sky invalid requested windows and ambiguous exposure IDs cannot be interpreted', () => {
  const i = sample(sky), r = rows(i, 'exposures')[0]
  for (const value of [{ ...i, windowEndMs: 0 }, { ...i, windowStartMs: 1001 }, { ...i, exposures: [r, r] }]) assert.throws(() => inspect(sky, value))
  for (const delta of [{ startsMs: 10, endsMs: 10 }, { startsMs: 11, endsMs: 10 }, { endsMs: 1001 }]) assert.deepEqual(codes(sky, { ...i, exposures: [{ ...r, ...delta }] }), ['sky-observations-exposure-window-invalid'])
  assert.throws(() => inspect(sky, { ...i, exposures: [{ ...r, startsMs: -1 }] })); assert.throws(() => inspect(sky, { ...i, windowEndMs: 86400001 }))
})
test('sky maximum overlap duration stays exact with bounded 32-record inputs', () => {
  const i = sample(sky), r = rows(i, 'exposures')[0]
  const out = values(sky, { ...i, windowEndMs: 86400000, exposures: Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'e' + n, endsMs: 86400000 })) })
  assert.equal(out['sky-observations-union-milliseconds'], '86400000'); assert.equal(out['sky-observations-redundant-milliseconds'], '2678400000'); assert.equal(out['sky-observations-declared-coverage-fraction'], '1')
})
test('sky coordinate labels never infer frame, time-scale, angular wrap or numeric conversion', () => {
  const id = 'sky-observations-unit-label-consistency', i = sample(id), r = rows(i, 'measurements')[0]
  assert.deepEqual(codes(id, { ...i, measurements: [{ ...r, quantity: 'declination', unit: 'hours-angle' }] }), ['sky-observations-quantity-unit-mismatch'])
  assert.throws(() => inspect(id, { ...i, convertTo: 'icrs' })); assert.throws(() => inspect(id, { ...i, measurements: [{ ...r, autoWrap: true }] }))
})
test('robot and neural duplicate metadata identities compare all scientific frame pins', () => {
  for (const [category, pins] of [['robotics-telemetry', ['frameRef', 'clockRef', 'calibrationDigest']], ['neural-interface-records', ['modelDigest', 'calibrationDigest', 'featureSchemaDigest']]] as const) {
    const id = category + '-duplicate-record-identities', i = sample(id), r = rows(i, 'rows')[0]
    for (const pin of pins) assert.deepEqual(codes(id, { ...i, rows: [r, { ...r, id: 'r2', [pin]: pin.endsWith('Digest') ? 'sha256:' + 'b'.repeat(64) : 'other' }] }), [category + '-conflicting-frame-content'])
  }
})
test('oversized dual robot exports stop before execution or settlement', async () => {
  const id = 'robotics-telemetry-export-semantic-parity', e = FIFTEENTH_BATCH.find(e => e.id === id)!, i = sample(id), r = rows(i, 'before')[0]
  const before = Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'r' + 'x'.repeat(76) + String(n).padStart(3, '0'), datasetRef: 'd'.repeat(80), robotRef: 'r'.repeat(80), frameRef: 'f'.repeat(80), clockRef: 'c'.repeat(80), scopeRef: 's'.repeat(80) }))
  const value = { ...i, before, after: structuredClone(before) }; assert.ok(Buffer.byteLength(JSON.stringify(value)) > 32768)
  FIFTEENTH_BATCH_AUDITS.find(s => s.id === id)!.input.parse(value)
  const f = fixture(e, () => CLOCK)
  try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.equal((await route(f.request(value, await headers(e, value, quote)))).status, 400); assert.deepEqual(f.counts(), { settlements: 0, executions: 0 }) } finally { f.close() }
})
test('execution-level ambiguity fails before any payment settlement', async () => {
  const b = sample(robotTime), t = sample(thermal), n = sample(neural), s = sample(sky)
  const cases: [string, Record<string, unknown>][] = [[robotTime, { ...b, rows: Array(2).fill(rows(b, 'rows')[0]) }], [thermal, { ...t, rows: Array(2).fill(rows(t, 'rows')[0]) }], [neural, { ...n, rows: Array(2).fill(rows(n, 'rows')[0]) }], [sky, { ...s, windowEndMs: 0 }]]
  for (const [id, value] of cases) { const e = FIFTEENTH_BATCH.find(e => e.id === id)!, f = fixture(e, () => CLOCK)
    try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.notEqual((await route(f.request(value, await headers(e, value, quote)))).status, 200); assert.equal(f.counts().settlements, 0) } finally { f.close() }
  }
})
test('maximum synthetic neural rows stay inside closed schema and response bounds', async () => {
  const i = sample(neural), r = rows(i, 'rows')[0], e = FIFTEENTH_BATCH.find(e => e.id === neural)!, h = handlerFor(e.id, e.amount)!
  const value = { ...i, rows: Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'e' + n })) }, out = await h.execute(value) as Report
  assert.equal(out.result.metrics.length, 65); assert.ok(out.result.metrics.every(m => m.value.length <= 80)); assert.ok(Buffer.byteLength(JSON.stringify(out)) < 65000)
  assert.deepEqual(validate({ success: true, data: out, proof: { settlement_id: TX } }, e.schema.output), [])
})
test('raw signals, participant identifiers, commands and secrets do not fit any Batch 15 contract', () => {
  for (const e of FIFTEENTH_BATCH) { const h = handlerFor(e.id, e.amount)!, i = sample(e.id)
    for (const field of ['rawEEG', 'participantId', 'sessionId', 'robotCommand', 'heaterCommand', 'telescopeCommand', 'privateKey']) assert.throws(() => h.input.parse({ ...i, [field]: 'not-accepted' }))
  }
})
