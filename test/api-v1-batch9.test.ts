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
import { NINTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { NINTH_BATCH_AUDITS } from '../lib/api-v1/batch9-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-8-contract-snapshot.json' with { type: 'json' }
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
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch9_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => NINTH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(NINTH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof NINTH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof NINTH_BATCH[number], now: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch9-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('400 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 400); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.path, r.path); assert.equal(e.method, r.method); assert.equal(hash(e.schema.input), r.inputDigest); assert.equal(hash(e.schema.output), r.outputDigest) }
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch9 is the next 50 unimplemented metadata recipes, excluding previously implemented license conditions', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => /^(tabular-records|identity-records|provenance-manifests|license-records)-/.test(e.id) && !done.has(e.id)).slice(0, 50)
  assert.deepEqual(NINTH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(NINTH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of NINTH_BATCH) {
    assert.equal(e.productionApproved, false); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost.liveModelSpendApproved, false)
    assert.equal(e.execution_cost.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.equal(e.sourceReview, 'not-applicable')
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, 500)
})
for (const spec of NINTH_BATCH_AUDITS) {
  const e = NINTH_BATCH.find(e => e.id === spec.id)!
  test('batch9 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
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
  test('batch9 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
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
  test('batch9 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
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
  test('batch9 registry router honors the reviewed production projection: ' + e.id, async () => {
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
test('batch9 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
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
  }; visit(resolve('lib/api-v1/batch9-audits.ts')); assert.ok(visited.size >= 6)
})
test('condition coverage fails closed for contradictory, duplicate and unknown checks', () => {
  const id = 'identity-records-condition-coverage-map', i = sample(id)
  for (const states of [['unknown'], ['satisfied', 'unknown'], ['satisfied', 'satisfied'], ['unsatisfied']]) {
    const r = inspect(id, { ...i, checks: states.map((state, n) => ({ id: 'c' + n, checkId: 'one', state })) })
    assert.equal(r.metrics[0].value, '0'); assert.deepEqual(r.findings.map(f => f.code), ['identity-records-condition-not-established'])
  }
})
test('identity expiry equality, future issue and unknown expiry are distinct', () => {
  const id = 'identity-records-timestamp-order-audit', i = sample(id), rows = i.rows as Record<string, unknown>[]
  assert.equal(inspect(id, { ...i, assessedAt: rows[0].expiresAt }).findings[0].code, 'identity-records-expired-at-assessment')
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...rows[0], expiresAt: null }] }).findings, [])
  assert.equal(inspect(id, { ...i, rows: [{ ...rows[0], createdAt: rows[0].expiresAt, expiresAt: null }] }).findings[0].code, 'identity-records-creation-from-future')
})
test('unit mismatches cannot be compared against numeric limits, and exact ceilings pass', () => {
  const id = 'license-records-declared-bound-audit', i = sample(id)
  assert.deepEqual(inspect(id, i).findings, [])
  assert.deepEqual(inspect(id, { ...i, measurements: [{ id: 'r1', unit: 'seats', value: 0 }] }).findings.map(f => f.code), ['license-records-bound-unit-mismatch'])
})
test('tabular joins respect exact frame, units and inclusive bounds', () => {
  const id = 'tabular-records-declared-bound-audit', i = sample(id), values = i.values as Record<string, unknown>[], bounds = i.bounds as Record<string, unknown>[]
  assert.deepEqual(inspect(id, { ...i, values: [{ ...values[0], value: 0 }] }).findings, [])
  for (const delta of [{ unitRef: 'USD' }, { tableRef: 'table2' }, { revision: 'sha256:' + 'b'.repeat(64) }]) assert.equal(inspect(id, { ...i, values: [{ ...values[0], ...delta }] }).findings[0].code, 'tabular-bound-frame-mismatch')
  assert.throws(() => inspect(id, { ...i, bounds: [{ ...bounds[0], minimum: 11 }] }), /reversed_tabular_bounds/)
})
test('provenance cycles and cross-dataset links cannot count as bound edges', () => {
  const id = 'provenance-manifests-provenance-edge-audit', i = sample(id), edges = i.edges as Record<string, unknown>[], nodes = i.nodes as Record<string, unknown>[]
  const cycle = inspect(id, { ...i, edges: [edges[0], { ...edges[0], id: 'e2', childId: 'parent', parentId: 'manifest1' }] })
  assert.equal(cycle.findings.filter(f => f.code === 'provenance-manifests-edge-cycle').length, 2); assert.equal(cycle.metrics[0].value, '0')
  assert.equal(inspect(id, { ...i, nodes: [nodes[0], { ...nodes[1], datasetRef: 'dataset2' }] }).findings[0].code, 'provenance-manifests-edge-frame-mismatch')
})
test('tabular aliases preserve key identity and insertion does not reorder surviving keys', () => {
  const id = 'tabular-records-record-sequence-diff', i = sample(id), r = (i.before as Record<string, unknown>[])[0], r2 = { ...r, id: 'r2', primaryKeyDigest: 'sha256:' + 'b'.repeat(64) }, added = { ...r, id: 'new', primaryKeyDigest: 'sha256:' + 'c'.repeat(64) }
  assert.deepEqual(inspect(id, { ...i, after: [{ ...r, id: 'new-ingestion' }] }).findings, [])
  assert.deepEqual(inspect(id, { ...i, before: [r, r2], after: [r, added, r2] }).findings.map(f => f.code), ['tabular-projection-added'])
  assert.deepEqual(inspect('tabular-records-export-semantic-parity', { ...i, before: [r, r2], after: [r2, r] }).findings, [])
})
test('schema output weakening and extra fields depend on explicit consumer strictness', () => {
  const id = 'identity-records-schema-directionality', i = sample(id), r = (i.before as Record<string, unknown>[])[0]
  assert.equal(inspect(id, { ...i, after: [{ ...r, nullable: true }] }).findings[0].code, 'identity-records-schema-guarantee-weakened')
  const extra = { ...r, name: 'extra' }
  assert.deepEqual(inspect(id, { ...i, after: [r, extra], consumerAllowsExtraFields: true }).findings, [])
  assert.equal(inspect(id, { ...i, after: [r, extra], consumerAllowsExtraFields: false }).findings[0].code, 'identity-records-schema-extra-field')
})
test('worst permitted tabular missingness result remains recoverable below 65KB', async () => {
  const id = 'tabular-records-missingness-cooccurrence', e = NINTH_BATCH.find(e => e.id === id)!
  const longId = (kind: string, n: number) => kind + 'x'.repeat(76) + String(n).padStart(3, '0')
  const value = { dataClass: 'synthetic', nonpersonalMetadata: true, requiredColumns: Array.from({ length: 14 }, (_, n) => longId('c', n)),
    rows: Array.from({ length: 32 }, (_, n) => ({ id: longId('r', n), presentColumns: [] })) }
  const result = await handlerFor(id, e.amount)!.execute(value) as Report
  assert.equal(result.result.findings.length, 32); assert.equal(result.result.metrics.length, 91)
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 65000)
  assert.throws(() => handlerFor(id, e.amount)!.input.parse({ ...value, requiredColumns: [...value.requiredColumns, 'extra'] }))
})
test('combined oversized metadata export is refused before work or payment', async () => {
  const id = 'provenance-manifests-export-semantic-parity', e = NINTH_BATCH.find(e => e.id === id)!, s = sample(id), r = (s.before as Record<string, unknown>[])[0]
  const before = Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'r' + 'x'.repeat(76) + String(n).padStart(3, '0'), producerRef: 'p'.repeat(80), datasetRef: 'd'.repeat(80), scopeRef: 's'.repeat(80) }))
  const value = { ...s, before, after: structuredClone(before) }
  NINTH_BATCH_AUDITS.find(s => s.id === id)!.input.parse(value); assert.ok(Buffer.byteLength(JSON.stringify(value)) > 32768)
  const fixtureValue = fixture(e, () => CLOCK)
  try {
    const route = fixtureValue.route(), quote = decodeChallenge((await route(fixtureValue.request(value))).headers.get('PAYMENT-REQUIRED')!)
    assert.equal((await route(fixtureValue.request(value, await headers(e, value, quote)))).status, 400)
    assert.deepEqual(fixtureValue.counts(), { settlements: 0, executions: 0 })
  } finally { fixtureValue.close() }
})
