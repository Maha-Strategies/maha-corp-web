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
import { THIRTEENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { THIRTEENTH_BATCH_AUDITS } from '../lib/api-v1/batch13-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-12-contract-snapshot.json' with { type: 'json' }
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
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch13_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => THIRTEENTH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(THIRTEENTH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof THIRTEENTH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof THIRTEENTH_BATCH[number], now: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch13-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('600 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 600); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) assertEarlierLocalContract(ENDPOINTS.find(e => e.id === r.id)!, r)
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch13 is the next 50 unimplemented recipes, without recounting earlier cohorts', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => /^(catalyst-measurements|polymer-measurements|alloy-measurements|ceramic-measurements)-/.test(e.id) && !done.has(e.id)).slice(0, 50)
  assert.deepEqual(THIRTEENTH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(THIRTEENTH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of THIRTEENTH_BATCH) {
    assert.equal(e.productionApproved, false); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost.liveModelSpendApproved, false)
    assert.equal(e.execution_cost.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.equal(e.sourceReview, 'not-applicable')
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, PRODUCTION_ENDPOINTS.length)
})
for (const spec of THIRTEENTH_BATCH_AUDITS) {
  const e = THIRTEENTH_BATCH.find(e => e.id === spec.id)!
  test('batch13 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
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
  test('batch13 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
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
  test('batch13 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
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
  test('batch13 registry router honors the reviewed production projection: ' + e.id, async () => {
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
test('batch13 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
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
  }; visit(resolve('lib/api-v1/batch13-audits.ts')); assert.ok(visited.size >= 6)
})

test('polymer averages use number counts, not equal weighting of occupied bins', () => {
  const id = 'polymer-measurements-condition-coverage-map', i = sample(id), result = inspect(id, i)
  assert.deepEqual(result.findings, [])
  assert.deepEqual(result.metrics.map(m => [m.key, m.value]), [['polymer-measurements-averages-derived', '1'], ['polymer-measurements-number-average-molar-mass', '150'], ['polymer-measurements-mass-average-molar-mass', '500/3'], ['polymer-measurements-molar-mass-dispersity', '10/9'], ['polymer-measurements-total-declared-number-count', '2']])
  const bins = (i.bins as Record<string, unknown>[]).map((r, n) => n === 1 ? { ...r, count: 3 } : r), weighted = inspect(id, { ...i, bins })
  assert.equal(weighted.metrics[1].value, '175'); assert.equal(weighted.metrics[2].value, '1300/7'); assert.equal(weighted.metrics[3].value, '52/49'); assert.equal(weighted.metrics[4].value, '4')
  assert.equal(weighted.metrics[1].recordId, 'grams-per-mol')
})
test('monodisperse and zero-weight bins keep exact averages without invented chains', () => {
  const id = 'polymer-measurements-condition-coverage-map', i = sample(id), bins = i.bins as Record<string, unknown>[]
  const result = inspect(id, { ...i, bins: [{ ...bins[0], count: 10 }, { ...bins[1], count: 0 }] })
  assert.equal(result.metrics[1].value, '100'); assert.equal(result.metrics[2].value, '100'); assert.equal(result.metrics[3].value, '1'); assert.equal(result.metrics[4].value, '10')
  assert.deepEqual(inspect(id, { ...i, bins: bins.map(r => ({ ...r, count: 0 })) }).findings.map(f => f.code), ['polymer-measurements-distribution-zero-total-count'])
})
test('polymer missing or censored number counts block all derived averages', () => {
  const id = 'polymer-measurements-condition-coverage-map', i = sample(id), bins = i.bins as Record<string, unknown>[]
  for (const delta of [{ count: null }, { qualifier: 'censored' }, { qualifier: 'unknown' }]) {
    const result = inspect(id, { ...i, bins: [{ ...bins[0], ...delta }, bins[1]] })
    assert.deepEqual(result.findings.map(f => f.code), ['polymer-measurements-distribution-count-not-exact']); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
})
test('polymer units are explicit and not converted or mixed', () => {
  const id = 'polymer-measurements-condition-coverage-map', i = sample(id), bins = i.bins as Record<string, unknown>[]
  assert.deepEqual(inspect(id, { ...i, bins: [{ ...bins[0], unit: 'kilograms-per-mol' }, bins[1]] }).findings.map(f => f.code), ['polymer-measurements-distribution-unit-mismatch'])
  const consistent = inspect(id, { ...i, unit: 'kilograms-per-mol', bins: bins.map(r => ({ ...r, unit: 'kilograms-per-mol' })) })
  assert.equal(consistent.metrics[1].value, '150'); assert.equal(consistent.metrics[1].recordId, 'kilograms-per-mol'); assert.equal(consistent.metrics[3].value, '10/9')
})
test('duplicate polymer mass-bin labels are ambiguous even when ingestion IDs differ', () => {
  const id = 'polymer-measurements-condition-coverage-map', i = sample(id), bins = i.bins as Record<string, unknown>[]
  const result = inspect(id, { ...i, bins: [bins[0], { ...bins[0], id: 'b2' }] })
  assert.equal(result.findings.filter(f => f.code === 'polymer-measurements-duplicate-molar-mass-bin').length, 2); assert.equal(result.metrics[0].value, '0')
  assert.throws(() => inspect(id, { ...i, bins: [bins[0], bins[0]] }), /duplicate_ids/)
})
test('polymer count and molar-mass limits reject negatives, zero mass, fractional counts and overflow', () => {
  const id = 'polymer-measurements-condition-coverage-map', i = sample(id), bin = (i.bins as Record<string, unknown>[])[0]
  for (const delta of [{ molarMass: 0 }, { molarMass: -1 }, { molarMass: 1000000001 }, { count: -1 }, { count: 0.5 }, { count: 1000001 }]) assert.throws(() => inspect(id, { ...i, bins: [{ ...bin, ...delta }] }))
})
test('polymer arithmetic is stable under bin order and exact count scaling', () => {
  const id = 'polymer-measurements-condition-coverage-map', i = sample(id), bins = i.bins as Record<string, unknown>[]
  const original = inspect(id, i)
  assert.deepEqual(inspect(id, { ...i, bins: bins.toReversed() }).metrics, original.metrics)
  const scaled = inspect(id, { ...i, bins: bins.map(r => ({ ...r, count: (r.count as number) * 1000000 })) })
  assert.deepEqual(scaled.metrics.slice(0, 4), original.metrics.slice(0, 4)); assert.equal(scaled.metrics[4].value, '2000000')
})
test('alloy ppm closure uses integer sums and inclusive tolerance boundaries', () => {
  const id = 'alloy-measurements-condition-coverage-map', i = sample(id), rows = i.constituents as Record<string, unknown>[]
  const atLimit = inspect(id, { ...i, tolerancePpm: 1, constituents: [rows[0], { ...rows[1], amountPpm: 400001 }] })
  assert.deepEqual(atLimit.findings, []); assert.deepEqual(atLimit.metrics.map(m => m.value), ['1', '1000001', '1'])
  const over = inspect(id, { ...i, tolerancePpm: 1, constituents: [rows[0], { ...rows[1], amountPpm: 400002 }] })
  assert.deepEqual(over.findings.map(f => f.code), ['alloy-measurements-composition-total-outside-tolerance']); assert.deepEqual(over.metrics.map(m => m.value), ['0', '1000002', '2'])
  const lower = inspect(id, { ...i, tolerancePpm: 1, constituents: [rows[0], { ...rows[1], amountPpm: 399999 }] })
  assert.deepEqual(lower.findings, []); assert.equal(lower.metrics[2].value, '-1')
})
test('alloy incomplete composition is reported, not normalized or filled with a remainder', () => {
  const id = 'alloy-measurements-condition-coverage-map', i = sample(id), rows = i.constituents as Record<string, unknown>[]
  const result = inspect(id, { ...i, constituents: [rows[0]] })
  assert.deepEqual(result.metrics.map(m => m.value), ['0', '600000', '-400000']); assert.deepEqual(result.findings.map(f => f.code), ['alloy-measurements-composition-total-outside-tolerance'])
})
test('alloy mass and atom composition bases never share an inferred conversion', () => {
  const id = 'alloy-measurements-condition-coverage-map', i = sample(id), rows = i.constituents as Record<string, unknown>[]
  assert.deepEqual(inspect(id, { ...i, constituents: [rows[0], { ...rows[1], basis: 'atom' }] }).findings.map(f => f.code), ['alloy-measurements-composition-basis-mismatch'])
  const atom = inspect(id, { ...i, basis: 'atom', constituents: rows.map(r => ({ ...r, basis: 'atom' })) })
  assert.deepEqual(atom.findings, []); assert.deepEqual(atom.metrics.map(m => m.value), ['1', '1000000', '0'])
})
test('unknown, censored and duplicate alloy constituents block closure', () => {
  const id = 'alloy-measurements-condition-coverage-map', i = sample(id), rows = i.constituents as Record<string, unknown>[]
  for (const delta of [{ amountPpm: null }, { qualifier: 'below-limit' }, { qualifier: 'unknown' }]) {
    const result = inspect(id, { ...i, constituents: [{ ...rows[0], ...delta }, rows[1]] }); assert.deepEqual(result.findings.map(f => f.code), ['alloy-measurements-composition-value-not-exact']); assert.deepEqual(result.metrics.map(m => m.value), ['0'])
  }
  const duplicate = inspect(id, { ...i, constituents: [rows[0], { ...rows[1], elementRef: rows[0].elementRef }] })
  assert.equal(duplicate.findings.filter(f => f.code === 'alloy-measurements-duplicate-constituent-label').length, 2); assert.equal(duplicate.metrics[0].value, '0')
})
test('alloy amount and tolerance bounds reject fractional, negative and excessive declarations', () => {
  const id = 'alloy-measurements-condition-coverage-map', i = sample(id), r = (i.constituents as Record<string, unknown>[])[0]
  for (const amountPpm of [-1, 0.5, 1000001]) assert.throws(() => inspect(id, { ...i, constituents: [{ ...r, amountPpm }] }))
  for (const tolerancePpm of [-1, 0.5, 10001]) assert.throws(() => inspect(id, { ...i, tolerancePpm }))
})
test('material references pin dataset/material/lot/revision/digest but not an inferred measurement method', () => {
  for (const family of ['catalyst-measurements', 'polymer-measurements', 'alloy-measurements']) {
    const id = family + '-reference-integrity-map', i = sample(id), lot = (i.lots as Record<string, unknown>[])[0]
    for (const delta of [{ datasetRef: 'other' }, { materialRef: 'other' }, { materialLotRef: 'other-lot' }, { lotRevision: 'sha256:' + 'b'.repeat(64) }, { materialDigest: 'sha256:' + 'b'.repeat(64) }]) assert.deepEqual(inspect(id, { ...i, lots: [{ ...lot, ...delta }] }).findings.map(f => f.code), [family + '-material-lot-pin-mismatch'])
    const r = (i.rows as Record<string, unknown>[])[0]
    assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, methodDigest: 'sha256:' + 'b'.repeat(64) }] }).findings, [], 'lot identity and measurement method are distinct declarations')
    assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, lotId: 'missing' }] }).findings.map(f => f.code), [family + '-material-lot-missing'])
  }
})
test('material measurement provenance pins methods and source versions separately from lot identity', () => {
  for (const family of ['catalyst-measurements', 'polymer-measurements', 'alloy-measurements']) {
    const id = family + '-provenance-edge-audit', i = sample(id), s = (i.sources as Record<string, unknown>[])[0]
    for (const delta of [{ materialLotRef: 'other-lot' }, { methodDigest: 'sha256:' + 'b'.repeat(64) }, { sourceRevision: 'sha256:' + 'b'.repeat(64) }]) assert.deepEqual(inspect(id, { ...i, sources: [{ ...s, ...delta }] }).findings.map(f => f.code), [family + '-measurement-source-pin-mismatch'])
  }
})
test('catalyst and material numeric bounds do not impute censored measurements or convert units', () => {
  for (const [family, alternativeUnit] of [['catalyst-measurements', 'percent'], ['polymer-measurements', 'kilograms-per-mol'], ['alloy-measurements', 'percent']]) {
    const id = family + '-declared-bound-audit', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0]
    assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, value: null }] }).findings.map(f => f.code), [family + '-value-not-exact'])
    assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, qualifier: 'below-limit' }] }).findings.map(f => f.code), [family + '-value-not-exact'])
    assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, unit: alternativeUnit }] }).findings.map(f => f.code), [family + '-bound-frame-or-unit-mismatch'])
    assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, value: 0 }] }).findings, [])
  }
})
test('catalyst control conditions cannot borrow unknown or unrelated method evidence', () => {
  const id = 'catalyst-measurements-condition-coverage-map', i = sample(id), c = (i.controls as Record<string, unknown>[])[0]
  for (const controls of [[], [c, { ...c, id: 'c2' }], [{ ...c, state: 'unknown' }], [{ ...c, methodDigest: 'sha256:' + 'b'.repeat(64) }]]) assert.equal(inspect(id, { ...i, controls }).metrics[0].value, '0')
})
test('ceramic and material unit checks preserve incompatible quantity labels and method frames', () => {
  const id = 'ceramic-measurements-unit-label-consistency', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, measurements: [r, { ...r, id: 'm2', unit: 'g-per-cm3' }] }).findings.map(f => f.code), ['ceramic-measurements-unit-label-conflict'])
  assert.deepEqual(inspect(id, { ...i, measurements: [r, { ...r, id: 'm2', unit: 'g-per-cm3', methodDigest: 'sha256:' + 'b'.repeat(64) }] }).findings, [])
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, unit: 'kelvin' }] }).findings.map(f => f.code), ['ceramic-measurements-quantity-unit-mismatch'])
})
test('ceramic capture chronology and unknown processing/export dates stay explicit', () => {
  const id = 'ceramic-measurements-timestamp-order-audit', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, processedAt: null, exportedAt: null }] }).findings.map(f => f.code), ['ceramic-measurements-processing-time-unknown', 'ceramic-measurements-export-time-unknown'])
  const atLimit = new Date(Date.parse(r.collectedAt as string) + 86400000).toISOString()
  assert.deepEqual(inspect(id, { ...i, assessedAt: atLimit }).findings, [])
  assert.deepEqual(inspect(id, { ...i, assessedAt: new Date(Date.parse(atLimit) + 1).toISOString() }).findings.map(f => f.code), ['ceramic-measurements-maximum-age-exceeded'])
})
test('alloy basis and ceramic method differences are not identical duplicate content', () => {
  for (const [family, delta] of [['alloy-measurements', { compositionBasis: 'atom' }], ['ceramic-measurements', { methodDigest: 'sha256:' + 'b'.repeat(64) }]] as const) {
    const id = family + '-duplicate-record-identities', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
    assert.deepEqual(inspect(id, { ...i, rows: [r, { ...r, id: 'r2', ...delta }] }).findings.map(f => f.code), [family + '-conflicting-frame-content'])
  }
})
test('bounded large polymer distributions produce exact values below the metric and response ceilings', async () => {
  const id = 'polymer-measurements-condition-coverage-map', e = THIRTEENTH_BATCH.find(e => e.id === id)!, i = sample(id), r = (i.bins as Record<string, unknown>[])[0]
  const bins = Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'b' + n, molarMass: 1000000000 - n, count: 1000000 }))
  const out = await handlerFor(id, e.amount)!.execute({ ...i, bins }) as Report
  assert.deepEqual(out.result.findings, []); assert.equal(out.result.metrics[1].value, '1999999969/2'); assert.equal(out.result.metrics[4].value, '32000000')
  assert.ok(out.result.metrics.every(m => m.value.length <= 80)); assert.ok(Buffer.byteLength(JSON.stringify(out)) < 65000)
})
test('alloy large totals remain exact rather than wrapping or clipping', () => {
  const id = 'alloy-measurements-condition-coverage-map', i = sample(id), r = (i.constituents as Record<string, unknown>[])[0]
  const constituents = Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'c' + n, elementRef: 'E' + n, amountPpm: 1000000 }))
  const result = inspect(id, { ...i, constituents }); assert.deepEqual(result.metrics.map(m => m.value), ['0', '32000000', '31000000'])
})
test('formulation instructions, private keys and personal metadata do not fit any closed Batch 13 contract', () => {
  for (const e of THIRTEENTH_BATCH) {
    const h = handlerFor(e.id, e.amount)!, i = sample(e.id)
    for (const field of ['formulationInstructions', 'synthesisInstructions', 'privateKey', 'patientId', 'participantName']) assert.throws(() => h.input.parse({ ...i, [field]: 'not-accepted' }))
  }
})
test('oversized dual alloy metadata exports stop before work or settlement', async () => {
  const id = 'alloy-measurements-export-semantic-parity', e = THIRTEENTH_BATCH.find(e => e.id === id)!, i = sample(id), r = (i.before as Record<string, unknown>[])[0]
  const before = Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'r' + 'x'.repeat(76) + String(n).padStart(3, '0'), datasetRef: 'd'.repeat(80), alloyRef: 'a'.repeat(80), materialLotRef: 'l'.repeat(80), scopeRef: 's'.repeat(80) }))
  const value = { ...i, before, after: structuredClone(before) }; assert.ok(Buffer.byteLength(JSON.stringify(value)) > 32768)
  THIRTEENTH_BATCH_AUDITS.find(s => s.id === id)!.input.parse(value)
  const f = fixture(e, () => CLOCK)
  try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.equal((await route(f.request(value, await headers(e, value, quote)))).status, 400); assert.deepEqual(f.counts(), { settlements: 0, executions: 0 }) } finally { f.close() }
})
test('invalid numeric bounds and duplicate material row IDs never settle', async () => {
  const id = 'catalyst-measurements-declared-bound-audit', e = THIRTEENTH_BATCH.find(e => e.id === id)!, i = sample(id), b = (i.bounds as Record<string, unknown>[])[0], r = (i.measurements as Record<string, unknown>[])[0]
  for (const value of [{ ...i, bounds: [{ ...b, minimum: 2 }] }, { ...i, measurements: [r, r] }]) {
    const f = fixture(e, () => CLOCK)
    try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.notEqual((await route(f.request(value, await headers(e, value, quote)))).status, 200); assert.equal(f.counts().settlements, 0) } finally { f.close() }
  }
})
