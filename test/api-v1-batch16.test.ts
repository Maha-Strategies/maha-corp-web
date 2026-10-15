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
import { SIXTEENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { SIXTEENTH_BATCH_AUDITS } from '../lib/api-v1/batch16-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-15-contract-snapshot.json' with { type: 'json' }
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
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch16_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => SIXTEENTH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(SIXTEENTH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof SIXTEENTH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof SIXTEENTH_BATCH[number], now: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch16-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('750 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 750); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.path, r.path); assert.equal(e.method, r.method); assert.equal(hash(e.schema.input), r.inputDigest); assert.equal(hash(e.schema.output), r.outputDigest); assert.equal(hash(e), r.contractDigest) }
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch16 is the next 50 unimplemented recipes, without recounting earlier cohorts', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => /^(sky-observations|orbital-records|ephemeris-snapshots|telescope-calibrations)-/.test(e.id) && !done.has(e.id)).slice(0, 50)
  assert.deepEqual(SIXTEENTH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(SIXTEENTH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of SIXTEENTH_BATCH) {
    assert.equal(e.productionApproved, false); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost.liveModelSpendApproved, false)
    assert.equal(e.execution_cost.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.equal(e.sourceReview, 'not-applicable')
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, 958)
})
for (const spec of SIXTEENTH_BATCH_AUDITS) {
  const e = SIXTEENTH_BATCH.find(e => e.id === spec.id)!
  test('batch16 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
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
  test('batch16 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
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
  test('batch16 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
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
  test('batch16 registry router honors the reviewed production projection: ' + e.id, async () => {
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
test('batch16 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
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
  }; visit(resolve('lib/api-v1/batch16-audits.ts')); assert.ok(visited.size >= 6)
})

const rows = (i: Record<string, unknown>, k = 'rows') => i[k] as Record<string, unknown>[]
const codes = (id: string, i: unknown) => inspect(id, i).findings.map(f => f.code)
const metrics = (id: string, i: unknown) => Object.fromEntries(inspect(id, i).metrics.map(m => [m.key, m.value]))
const differentHash = 'sha256:' + 'b'.repeat(64)

for (const category of ['orbital-records', 'ephemeris-snapshots']) {
  const id = category + '-timestamp-order-audit'
  test(category + ': epoch order uses the exact inclusive gap and preserves input order', () => {
    const i = sample(id), [a, b] = rows(i)
    assert.deepEqual(codes(id, i), [])
    assert.deepEqual(codes(id, { ...i, maximumGapTicks: 9 }), [category + '-epoch-gap-exceeded'])
    assert.deepEqual(codes(id, { ...i, rows: [b, a] }), [category + '-epoch-not-increasing'])
    assert.deepEqual(codes(id, { ...i, rows: [a, { ...b, epochTick: 0 }] }), [category + '-epoch-not-increasing'])
    assert.deepEqual(codes(id, { ...i, rows: [{ ...a, epochTick: -10 }, { ...b, epochTick: 0 }] }), [])
    assert.deepEqual(metrics(id, { ...i, rows: [{ ...a, epochTick: -1e9 }, { ...b, epochTick: 1e9 }], maximumGapTicks: 2e9 }), { [category + '-comparable-adjacent-epochs']: '1', [category + '-largest-adjacent-gap-ticks']: '2000000000' })
  })
  test(category + ': every frame pin and an unknown epoch break adjacency without bridging a gap', () => {
    const i = sample(id), [a, b] = rows(i)
    for (const key of Object.keys(a).filter(k => !['id', 'epochTick', 'qualifier'].includes(k))) {
      const delta = { [key]: String(a[key]).startsWith('sha256:') ? differentHash : 'different-pin' }
      const out = inspect(id, { ...i, rows: [a, { ...b, ...delta }, { ...b, id: 'e3', epochTick: 100000 }] })
      assert.deepEqual(out.findings.map(f => f.code), [category + '-epoch-frame-mismatch'], key)
      assert.deepEqual(out.metrics.map(m => m.value), ['0', '0'])
    }
    for (const delta of [{ epochTick: null }, { qualifier: 'unknown' }]) {
      assert.deepEqual(codes(id, { ...i, rows: [a, { ...b, ...delta }, { ...b, id: 'e3', epochTick: 100000 }] }), [category + '-epoch-not-exact'])
    }
  })
  test(category + ': malformed, fractional and out-of-range ticks fail before execution', () => {
    const i = sample(id), r = rows(i)[0]
    for (const value of [1.5, 1e9 + 1, -1e9 - 1, '10', Infinity]) assert.throws(() => inspect(id, { ...i, rows: [{ ...r, epochTick: value }] }))
    assert.throws(() => inspect(id, { ...i, maximumGapTicks: -1 }))
    assert.throws(() => inspect(id, { ...i, rows: [r, r] }))
  })
}

const orbital = 'orbital-records-condition-coverage-map'
test('orbital state projection establishes only requested exact components, not a full orbit', () => {
  const i = sample(orbital), r = rows(i)[0]
  const components = ['x', 'y', 'z', 'vx', 'vy', 'vz']
  const full = { ...i, requiredComponents: components, rows: components.map((component, n) => ({ ...r, id: 's' + n, component, unit: component.startsWith('v') ? 'kilometres-per-second' : 'kilometres', value: n - 3 })) }
  assert.deepEqual(codes(orbital, full), []); assert.deepEqual(Object.values(metrics(orbital, full)), ['6'])
  const missing = { ...full, rows: full.rows.slice(0, 5) }
  assert.deepEqual(codes(orbital, missing), ['orbital-records-state-component-not-established'])
  assert.deepEqual(Object.values(metrics(orbital, missing)), ['5'])
  const alternate = { ...i, positionUnit: 'au', velocityUnit: 'metres-per-second', requiredComponents: ['vx'], rows: [{ ...r, component: 'vx', unit: 'metres-per-second' }] }
  assert.deepEqual(codes(orbital, alternate), [])
})
test('orbital projection rejects duplicate, unknown, unrequested and unit-mismatched components', () => {
  const i = sample(orbital), r = rows(i)[0]
  for (const delta of [{ value: null }, { qualifier: 'unknown' }, { unit: 'au' }, { epochTick: 1 }]) {
    const result = inspect(orbital, { ...i, rows: [{ ...r, ...delta }] })
    assert.ok(result.findings.some(f => f.code.endsWith('component-not-established')))
    assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
  assert.deepEqual(codes(orbital, { ...i, rows: [r, { ...r, id: 's2' }] }), ['orbital-records-state-component-not-established'])
  assert.deepEqual(codes(orbital, { ...i, rows: [r, { ...r, id: 's2', component: 'y' }] }), ['orbital-records-state-component-undeclared'])
  assert.throws(() => inspect(orbital, { ...i, requiredComponents: ['x', 'x'] }))
  assert.throws(() => inspect(orbital, { ...i, rows: [{ ...r, component: 'radius' }] }))
})
test('orbital projection binds every target, centre, frame, time-scale and solution pin', () => {
  const i = sample(orbital), r = rows(i)[0]
  for (const key of ['datasetRef', 'targetRef', 'centreRef', 'coordinateFrameRef', 'timeScaleRef', 'epochOriginRef', 'tickUnitRef', 'solutionDigest', 'recordRevision']) {
    const value = String(r[key]).startsWith('sha256:') ? differentHash : 'other-pin'
    assert.deepEqual(codes(orbital, { ...i, rows: [{ ...r, [key]: value }] }), ['orbital-records-state-component-not-established', 'orbital-records-state-frame-mismatch'], key)
  }
})

const ephemeris = 'ephemeris-snapshots-condition-coverage-map'
test('ephemeris grid preserves exact requested coverage without interpolation or extrapolation', () => {
  const i = sample(ephemeris), [a, b] = rows(i)
  assert.deepEqual(Object.values(metrics(ephemeris, i)), ['2', '0'])
  assert.deepEqual(codes(ephemeris, { ...i, rows: [b, a] }), [])
  assert.deepEqual(Object.values(metrics(ephemeris, { ...i, requestedEpochTicks: [0, 5, 10] })), ['2', '1'])
  assert.deepEqual(codes(ephemeris, { ...i, requestedEpochTicks: [0] }), ['ephemeris-snapshots-epoch-not-requested'])
  const boundary = { ...i, requestedEpochTicks: [-1e9, 1e9], rows: [{ ...a, epochTick: -1e9 }, { ...b, epochTick: 1e9 }] }
  assert.deepEqual(codes(ephemeris, boundary), [])
})
test('ephemeris ambiguous and unavailable rows do not count as covered epochs', () => {
  const i = sample(ephemeris), [a, b] = rows(i)
  assert.deepEqual(Object.values(metrics(ephemeris, { ...i, rows: [a, b, { ...a, id: 'e3' }] })), ['1', '1'])
  for (const valueState of ['unknown', 'missing']) {
    const out = inspect(ephemeris, { ...i, rows: [a, { ...b, valueState }] })
    assert.deepEqual(out.findings.map(f => f.code), ['ephemeris-snapshots-epoch-coverage-not-established', 'ephemeris-snapshots-grid-row-unusable'])
    assert.deepEqual(out.metrics.map(m => m.value), ['1', '1'])
  }
  assert.throws(() => inspect(ephemeris, { ...i, requestedEpochTicks: [0, 0] }))
  assert.throws(() => inspect(ephemeris, { ...i, requestedEpochTicks: [] }))
})
test('ephemeris cannot pool different kernels, aberration corrections, origins or time scales', () => {
  const i = sample(ephemeris), [a, b] = rows(i)
  for (const key of Object.keys(a).filter(k => !['id', 'epochTick', 'valueState'].includes(k))) {
    const value = String(a[key]).startsWith('sha256:') ? differentHash : 'other-pin'
    const out = inspect(ephemeris, { ...i, rows: [{ ...a, [key]: value }, b] })
    assert.deepEqual(out.findings.map(f => f.code), ['ephemeris-snapshots-epoch-coverage-not-established', 'ephemeris-snapshots-grid-frame-mismatch'], key)
    assert.deepEqual(out.metrics.map(m => m.value), ['1', '1'])
  }
})

const telescopeTime = 'telescope-calibrations-timestamp-order-audit', telescope = 'telescope-calibrations-condition-coverage-map'
test('telescope validity is a half-open interval; unknown, empty or future-created calibrations never pass', () => {
  const i = sample(telescopeTime), r = rows(i)[0]
  assert.deepEqual(Object.values(metrics(telescopeTime, i)), ['1'])
  assert.deepEqual(codes(telescopeTime, { ...i, acquiredAt: '2026-01-31T23:59:59.999Z' }), [])
  for (const delta of [{ validUntil: null }, { validUntil: r.validFrom }, { validUntil: '2025-01-01T00:00:00.000Z' }, { createdAt: '2026-01-01T00:00:00.001Z' }]) {
    assert.deepEqual(Object.values(metrics(telescopeTime, { ...i, rows: [{ ...r, ...delta }] })), ['0'])
  }
  assert.deepEqual(codes(telescopeTime, { ...i, acquiredAt: '2025-12-31T23:59:59.999Z' }), ['telescope-calibrations-acquisition-outside-validity', 'telescope-calibrations-calibration-created-after-acquisition'])
  assert.throws(() => inspect(telescopeTime, { ...i, acquiredAt: '2026-02-30T00:00:00.000Z' }))
})
test('telescope validity and master applicability bind every instrument/configuration pin', () => {
  for (const id of [telescopeTime, telescope]) {
    const i = sample(id), r = rows(i)[0]
    for (const key of ['datasetRef', 'instrumentRef', 'detectorRef', 'filterRef', 'binningRef', 'readoutModeRef', 'pipelineDigest', 'calibrationDigest', 'recordRevision']) {
      const value = String(r[key]).startsWith('sha256:') ? differentHash : 'other-pin'
      const out = inspect(id, { ...i, rows: [{ ...r, [key]: value }] })
      assert.ok(out.findings.some(f => /mismatch$/.test(f.code)), key)
      assert.deepEqual(out.metrics.map(m => m.value), ['0'])
    }
  }
})
test('telescope master matching treats missing, ambiguous and unknown records as negative evidence', () => {
  const i = sample(telescope), r = rows(i)[0]
  for (const delta of [{ exposureMilliseconds: null }, { exposureMilliseconds: 999 }, { state: 'unknown' }, { state: 'missing' }]) assert.deepEqual(Object.values(metrics(telescope, { ...i, rows: [{ ...r, ...delta }] })), ['0'])
  assert.deepEqual(codes(telescope, { ...i, rows: [r, { ...r, id: 'dark2' }] }), ['telescope-calibrations-master-not-established'])
  assert.deepEqual(codes(telescope, { ...i, rows: [r, { ...r, id: 'flat1', kind: 'flat' }] }), ['telescope-calibrations-master-kind-undeclared'])
  const all = { ...i, requiredKinds: ['bias', 'dark', 'flat'], rows: ['bias', 'dark', 'flat'].map(kind => ({ ...r, id: kind + '1', kind })) }
  assert.deepEqual(codes(telescope, all), []); assert.deepEqual(Object.values(metrics(telescope, all)), ['3'])
  assert.throws(() => inspect(telescope, { ...i, requiredKinds: ['dark', 'dark'] }))
})

for (const category of ['orbital-records', 'ephemeris-snapshots', 'telescope-calibrations']) {
  test(category + ': unit conflicts and numeric bounds never merge distinct full frames', () => {
    const unitId = category + '-unit-label-consistency', i = sample(unitId), r = rows(i, 'measurements')[0]
    const otherUnit = category === 'telescope-calibrations' ? 'milliseconds' : 'au'
    assert.deepEqual(codes(unitId, { ...i, measurements: [r, { ...r, id: 'm2', unit: otherUnit }] }), [category + '-unit-label-conflict'])
    assert.deepEqual(codes(unitId, { ...i, measurements: [r, { ...r, id: 'm2', unit: otherUnit, [category === 'ephemeris-snapshots' ? 'snapshotRevision' : 'recordRevision']: differentHash }] }), [])
    const boundId = category + '-declared-bound-audit', b = sample(boundId), bound = rows(b, 'bounds')[0], measurement = rows(b, 'measurements')[0]
    assert.deepEqual(codes(boundId, b), [])
    for (const delta of [{ value: null }, { qualifier: 'below-limit' }, { unit: otherUnit }]) assert.ok(codes(boundId, { ...b, measurements: [{ ...measurement, ...delta }] }).length)
    assert.deepEqual(codes(boundId, { ...b, bounds: [bound, { ...bound, id: 'b2' }] }), [category + '-bound-not-unique'])
    assert.throws(() => inspect(boundId, { ...b, bounds: [{ ...bound, minimum: 2, maximum: 1 }] }))
  })
}
