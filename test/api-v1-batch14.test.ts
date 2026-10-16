import { assertEarlierLocalContract } from './helpers/historical-local-contract.ts'
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
import { FOURTEENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { FOURTEENTH_BATCH_AUDITS } from '../lib/api-v1/batch14-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-13-contract-snapshot.json' with { type: 'json' }
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
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch14_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => FOURTEENTH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(FOURTEENTH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof FOURTEENTH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof FOURTEENTH_BATCH[number], now: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch14-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('650 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 650); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) assertEarlierLocalContract(ENDPOINTS.find(e => e.id === r.id)!, r)
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch14 is the next 50 unimplemented recipes, without recounting earlier cohorts', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => /^(ceramic-measurements|battery-measurements|optical-measurements|thermal-measurements)-/.test(e.id) && !done.has(e.id)).slice(0, 50)
  assert.deepEqual(FOURTEENTH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(FOURTEENTH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of FOURTEENTH_BATCH) {
    assert.equal(e.productionApproved, false); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost.liveModelSpendApproved, false)
    assert.equal(e.execution_cost.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.equal(e.sourceReview, 'not-applicable')
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, PRODUCTION_ENDPOINTS.length)
})
for (const spec of FOURTEENTH_BATCH_AUDITS) {
  const e = FOURTEENTH_BATCH.find(e => e.id === spec.id)!
  test('batch14 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
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
  test('batch14 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
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
  test('batch14 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
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
  test('batch14 registry router honors the reviewed production projection: ' + e.id, async () => {
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
test('batch14 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
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
  }; visit(resolve('lib/api-v1/batch14-audits.ts')); assert.ok(visited.size >= 6)
})

const rowRecords = (i: Record<string, unknown>, key: string) => i[key] as Record<string, unknown>[]
const values = (id: string, i: unknown) => Object.fromEntries(inspect(id, i).metrics.map(m => [m.key, m.value]))
const codes = (id: string, i: unknown) => inspect(id, i).findings.map(f => f.code)
const ceramic = 'ceramic-measurements-condition-coverage-map'
const battery = 'battery-measurements-condition-coverage-map'
const optical = 'optical-measurements-condition-coverage-map'
test('ceramic density deficit is exact, including zero deficit and maximum integers', () => {
  const i = sample(ceramic), r = rowRecords(i, 'rows')[0]
  assert.equal(values(ceramic, i)['ceramic-measurements-density-deficit-fraction'], '1/4')
  for (const [bulk, solid, ppm, expected] of [[2000, 2000, 0, '0'], [500000000, 1000000000, 500000, '1/2']]) {
    const result = inspect(ceramic, { ...i, rows: [{ ...r, bulkDensity: bulk, solidDensity: solid, declaredDeficitPpm: ppm }] })
    assert.deepEqual(result.findings, []); assert.equal(result.metrics[1].value, expected)
  }
})
test('ceramic ppm tolerance is inclusive and exact on either side', () => {
  const i = sample(ceramic), r = rowRecords(i, 'rows')[0]
  for (const ppm of [249999, 250001]) {
    const value = { ...i, tolerancePpm: 1, rows: [{ ...r, declaredDeficitPpm: ppm }] }
    assert.deepEqual(codes(ceramic, value), []); assert.deepEqual(codes(ceramic, { ...value, tolerancePpm: 0 }), ['ceramic-measurements-density-deficit-outside-tolerance'])
  }
})
test('ceramic unlike units and unsupported pore-free assumptions never yield a ratio', () => {
  const i = sample(ceramic), r = rowRecords(i, 'rows')[0]
  for (const [delta, expected] of [[{ solidUnit: 'g-per-cm3' }, 'density-unit-mismatch'], [{ poreFreeSolidDeclared: false }, 'density-assumption-not-established'], [{ declaredDeficitPpm: null }, 'density-assumption-not-established'], [{ qualifier: 'unknown' }, 'density-assumption-not-established'], [{ bulkDensity: 2001 }, 'bulk-density-exceeds-solid-density']] as const) {
    const result = inspect(ceramic, { ...i, rows: [{ ...r, ...delta }] })
    assert.deepEqual(result.findings.map(f => f.code), ['ceramic-measurements-' + expected]); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('ceramic density input bounds reject zero, fractional, negative and overflowing values', () => {
  const i = sample(ceramic), r = rowRecords(i, 'rows')[0]
  for (const delta of [{ bulkDensity: 0 }, { solidDensity: -1 }, { bulkDensity: 1.5 }, { solidDensity: 1e9 + 1 }, { declaredDeficitPpm: 1e6 + 1 }]) assert.throws(() => inspect(ceramic, { ...i, rows: [{ ...r, ...delta }] }))
  assert.throws(() => inspect(ceramic, { ...i, tolerancePpm: 10001 }))
})
test('battery integrals use independent literal mA-ms and mA-mV-ms dimensional conversions', () => {
  const i = sample(battery), out = values(battery, i)
  assert.equal(out['battery-measurements-discharge-mAh'], '1000'); assert.equal(out['battery-measurements-discharge-mWh'], '4000')
  assert.equal(out['battery-measurements-charge-mAh'], '0'); assert.equal(out['battery-measurements-charge-mWh'], '0')
  const r = rowRecords(i, 'segments')[0], partial = values(battery, { ...i, windowEndMs: 1, segments: [{ ...r, endsMs: 1, currentMilliAmps: 1, voltageMilliVolts: 1 }] })
  assert.equal(partial['battery-measurements-discharge-mAh'], '1/3600000'); assert.equal(partial['battery-measurements-discharge-mWh'], '1/3600000000')
})
test('battery exact charge/discharge/rest totals respect explicit current polarity', () => {
  const i = sample(battery), r = rowRecords(i, 'segments')[0], segments = [
    { ...r, id: 'charge', endsMs: 1200000, currentMilliAmps: -3000, mode: 'charge' },
    { ...r, id: 'rest', startsMs: 1200000, endsMs: 2400000, currentMilliAmps: 0, mode: 'rest' },
    { ...r, id: 'discharge', startsMs: 2400000, currentMilliAmps: 1500 },
  ]
  const value = { ...i, segments }, original = values(battery, value)
  assert.deepEqual(codes(battery, value), []); assert.equal(original['battery-measurements-charge-mAh'], '1000'); assert.equal(original['battery-measurements-discharge-mAh'], '500')
  assert.equal(original['battery-measurements-charge-mWh'], '4000'); assert.equal(original['battery-measurements-discharge-mWh'], '2000')
  const reversed = { ...i, currentSignConvention: 'positive-charge', segments: segments.map(r => ({ ...r, currentMilliAmps: -r.currentMilliAmps })).reverse() }
  assert.deepEqual(values(battery, reversed), original); assert.deepEqual(codes(battery, reversed), [])
})
test('battery incomplete coverage and overlap block all charge/energy totals', () => {
  const i = sample(battery), r = rowRecords(i, 'segments')[0]
  for (const segments of [[{ ...r, startsMs: 1 }], [{ ...r, endsMs: 3599999 }], [r, { ...r, id: 's2' }], [{ ...r, endsMs: 1 }, { ...r, id: 's2', startsMs: 2 }]]) {
    const result = inspect(battery, { ...i, segments }); assert.ok(result.findings.length); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('battery unknown current/voltage and mode-sign conflicts are not coerced into zero', () => {
  const i = sample(battery), r = rowRecords(i, 'segments')[0]
  for (const delta of [{ currentMilliAmps: null }, { voltageMilliVolts: null }, { qualifier: 'unknown' }, { currentMilliAmps: -1000 }, { mode: 'charge' }, { mode: 'rest' }]) {
    const result = inspect(battery, { ...i, segments: [{ ...r, ...delta }] }); assert.ok(result.findings.length); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('battery endpoints reject invalid or ambiguous windows and duplicate segment IDs', () => {
  const i = sample(battery), r = rowRecords(i, 'segments')[0]
  for (const value of [{ ...i, windowEndMs: 0 }, { ...i, windowStartMs: 3600000, windowEndMs: 1 }, { ...i, segments: [r, r] }]) assert.throws(() => inspect(battery, value))
  for (const delta of [{ startsMs: 1, endsMs: 1 }, { endsMs: 3600001 }]) assert.ok(codes(battery, { ...i, segments: [{ ...r, ...delta }] }).includes('battery-measurements-segment-window-invalid'))
})
test('battery maximum bounded integral stays exact beyond safe floating multiplication', () => {
  const i = sample(battery), r = rowRecords(i, 'segments')[0]
  const result = values(battery, { ...i, windowEndMs: 86400000, segments: [{ ...r, endsMs: 86400000, currentMilliAmps: 1000000, voltageMilliVolts: 1000000 }] })
  assert.equal(result['battery-measurements-discharge-mAh'], '24000000'); assert.equal(result['battery-measurements-discharge-mWh'], '24000000000')
  assert.equal(result['battery-measurements-covered-milliseconds'], '86400000')
  for (const delta of [{ currentMilliAmps: 1000001 }, { voltageMilliVolts: -1 }, { endsMs: 86400001 }, { currentMilliAmps: 0.5 }]) assert.throws(() => inspect(battery, { ...i, segments: [{ ...r, ...delta }] }))
})
test('battery segmentation and starting-offset invariance preserve totals without inventing samples', () => {
  const i = sample(battery), r = rowRecords(i, 'segments')[0]
  const split = { ...i, segments: [{ ...r, endsMs: 1800000 }, { ...r, id: 's2', startsMs: 1800000 }] }
  assert.deepEqual(values(battery, split), values(battery, i))
  const offset = { ...i, windowStartMs: 1000, windowEndMs: 3601000, segments: [{ ...r, startsMs: 1000, endsMs: 3601000 }] }
  assert.deepEqual(values(battery, offset), values(battery, i))
})
test('optical fractions are exact accounting residuals, not absorption claims', () => {
  const i = sample(optical), result = values(optical, i)
  assert.equal(result['optical-measurements-transmitted-fraction'], '3/5'); assert.equal(result['optical-measurements-reflected-fraction'], '1/5'); assert.equal(result['optical-measurements-unaccounted-fraction'], '1/5')
  assert.ok(!Object.keys(result).some(k => /absorption/.test(k)))
  const r = rowRecords(i, 'rows')[0], scaled = { ...i, rows: [{ ...r, incidentMicrowatts: 1000000000, transmittedMicrowatts: 600000000, reflectedMicrowatts: 200000000 }] }
  assert.deepEqual(values(optical, scaled), result)
})
test('optical outgoing tolerance is inclusive and does not clip a negative residual', () => {
  const i = sample(optical), r = rowRecords(i, 'rows')[0]
  const value = { ...i, tolerancePpm: 1000, rows: [{ ...r, transmittedMicrowatts: 801 }] }
  assert.deepEqual(codes(optical, value), []); assert.equal(values(optical, value)['optical-measurements-unaccounted-fraction'], '-1/1000')
  assert.deepEqual(codes(optical, { ...value, tolerancePpm: 999 }), ['optical-measurements-outgoing-power-excess'])
  assert.equal(values(optical, { ...i, rows: [{ ...r, transmittedMicrowatts: 800 }] })['optical-measurements-unaccounted-fraction'], '0')
})
test('optical incompatible geometry, band or calibration pins block normalization', () => {
  const i = sample(optical), r = rowRecords(i, 'rows')[0]
  for (const delta of [{ geometryRef: 'geometry2' }, { bandRef: 'band2' }, { calibrationDigest: 'sha256:' + 'b'.repeat(64) }]) {
    const result = inspect(optical, { ...i, rows: [{ ...r, ...delta }] }); assert.deepEqual(result.findings.map(f => f.code), ['optical-measurements-power-frame-mismatch']); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('optical unknown readings and zero incident power never normalize', () => {
  const i = sample(optical), r = rowRecords(i, 'rows')[0]
  for (const delta of [{ incidentMicrowatts: null }, { transmittedMicrowatts: null }, { reflectedMicrowatts: null }, { qualifier: 'unknown' }, { incidentMicrowatts: 0 }]) {
    const result = inspect(optical, { ...i, rows: [{ ...r, ...delta }] }); assert.ok(result.findings.length); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('optical fixed-unit inputs reject dark corrections, units, negatives and oversized power', () => {
  const i = sample(optical), r = rowRecords(i, 'rows')[0]
  for (const delta of [{ incidentMicrowatts: 1e9 + 1 }, { reflectedMicrowatts: -1 }, { transmittedMicrowatts: 0.1 }, { unit: 'watts' }, { darkCorrection: 1 }]) assert.throws(() => inspect(optical, { ...i, rows: [{ ...r, ...delta }] }))
  assert.throws(() => inspect(optical, { ...i, rows: [r, r] }))
})
test('thermal absolute temperature and differences are not interchangeable labels', () => {
  const id = 'thermal-measurements-unit-label-consistency', i = sample(id), r = rowRecords(i, 'measurements')[0]
  assert.deepEqual(codes(id, { ...i, measurements: [{ ...r, quantity: 'temperature-difference', unit: 'kelvin-difference' }] }), [])
  for (const delta of [{ unit: 'kelvin-difference' }, { quantity: 'temperature-difference' }]) assert.deepEqual(codes(id, { ...i, measurements: [{ ...r, ...delta }] }), ['thermal-measurements-quantity-unit-mismatch'])
  const conflict = { ...i, measurements: [r, { ...r, id: 'm2', unit: 'celsius' }] }
  assert.deepEqual(codes(id, conflict), ['thermal-measurements-unit-label-conflict'])
})
test('thermal missing timestamps remain unknown and caller age boundary is inclusive', () => {
  const id = 'thermal-measurements-timestamp-order-audit', i = sample(id), r = rowRecords(i, 'rows')[0]
  const boundary = { ...i, assessedAt: '2026-01-02T00:00:00.000Z', maximumAgeSeconds: 86400 }
  assert.deepEqual(codes(id, boundary), []); assert.deepEqual(codes(id, { ...boundary, maximumAgeSeconds: 86399 }), ['thermal-measurements-maximum-age-exceeded'])
  assert.deepEqual(codes(id, { ...i, rows: [{ ...r, processedAt: null, exportedAt: null }] }), ['thermal-measurements-processing-time-unknown', 'thermal-measurements-export-time-unknown'])
})
test('battery and optical duplicate identities check every scientific frame pin', () => {
  for (const category of ['battery-measurements', 'optical-measurements']) {
    const id = category + '-duplicate-record-identities', i = sample(id), r = rowRecords(i, 'rows')[0]
    const pins = category === 'battery-measurements' ? ['materialLotRef', 'cellConfigDigest', 'methodDigest'] : ['materialLotRef', 'geometryRef', 'calibrationDigest', 'methodDigest']
    for (const pin of pins) { const changed = { ...r, id: 'r2', [pin]: pin.endsWith('Digest') ? 'sha256:' + 'b'.repeat(64) : 'different' }; assert.deepEqual(codes(id, { ...i, rows: [r, changed] }), [category + '-conflicting-frame-content']) }
  }
})
test('material lot references and method-bound provenance are separate declarations', () => {
  for (const category of ['ceramic-measurements', 'battery-measurements', 'optical-measurements']) {
    const lotId = category + '-reference-integrity-map', i = sample(lotId), r = rowRecords(i, 'rows')[0]
    assert.deepEqual(codes(lotId, { ...i, rows: [{ ...r, methodDigest: 'sha256:' + 'b'.repeat(64) }] }), [])
    assert.deepEqual(codes(lotId, { ...i, rows: [{ ...r, materialLotRef: 'lot2' }] }), [category + '-material-lot-pin-mismatch'])
    const sourceId = category + '-provenance-edge-audit', s = sample(sourceId), source = rowRecords(s, 'sources')[0]
    assert.deepEqual(codes(sourceId, { ...s, sources: [{ ...source, methodDigest: 'sha256:' + 'b'.repeat(64) }] }), [category + '-measurement-source-pin-mismatch'])
  }
})
test('maximum optical row count keeps exact metrics within the closed output cap', async () => {
  const i = sample(optical), r = rowRecords(i, 'rows')[0], e = FOURTEENTH_BATCH.find(e => e.id === optical)!, h = handlerFor(e.id, e.amount)!
  const value = { ...i, rows: Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'r' + n })) }, out = await h.execute(value) as Report
  assert.equal(out.result.metrics.length, 97); assert.ok(out.result.metrics.every(m => m.value.length <= 80)); assert.ok(Buffer.byteLength(JSON.stringify(out)) < 65000)
  assert.deepEqual(validate({ success: true, data: out, proof: { settlement_id: TX } }, e.schema.output), [])
})
test('oversized dual optical exports stop before handler execution or settlement', async () => {
  const id = 'optical-measurements-export-semantic-parity', e = FOURTEENTH_BATCH.find(e => e.id === id)!, i = sample(id), r = rowRecords(i, 'before')[0]
  const before = Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'r' + 'x'.repeat(76) + String(n).padStart(3, '0'), datasetRef: 'd'.repeat(80), opticalRef: 'o'.repeat(80), geometryRef: 'g'.repeat(80), materialLotRef: 'l'.repeat(80), scopeRef: 's'.repeat(80) }))
  const value = { ...i, before, after: structuredClone(before) }; assert.ok(Buffer.byteLength(JSON.stringify(value)) > 32768)
  FOURTEENTH_BATCH_AUDITS.find(s => s.id === id)!.input.parse(value)
  const f = fixture(e, () => CLOCK)
  try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.equal((await route(f.request(value, await headers(e, value, quote)))).status, 400); assert.deepEqual(f.counts(), { settlements: 0, executions: 0 }) } finally { f.close() }
})
test('ambiguous arithmetic and duplicate row declarations never settle', async () => {
  const cases: [string, Record<string, unknown>][] = []
  const b = sample(battery), c = sample(ceramic), o = sample(optical)
  cases.push([battery, { ...b, windowEndMs: 0 }], [battery, { ...b, segments: Array(2).fill(rowRecords(b, 'segments')[0]) }], [ceramic, { ...c, rows: Array(2).fill(rowRecords(c, 'rows')[0]) }], [optical, { ...o, rows: Array(2).fill(rowRecords(o, 'rows')[0]) }])
  for (const [id, value] of cases) { const e = FOURTEENTH_BATCH.find(e => e.id === id)!, f = fixture(e, () => CLOCK)
    try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.notEqual((await route(f.request(value, await headers(e, value, quote)))).status, 200); assert.equal(f.counts().settlements, 0) } finally { f.close() }
  }
})
test('hardware commands, private keys, personal records and experimental instructions do not fit Batch 14', () => {
  for (const e of FOURTEENTH_BATCH) { const h = handlerFor(e.id, e.amount)!, i = sample(e.id)
    for (const field of ['chargingInstructions', 'heaterCommand', 'beamControl', 'privateKey', 'patientId', 'formulationInstructions']) assert.throws(() => h.input.parse({ ...i, [field]: 'not-accepted' }))
  }
})
