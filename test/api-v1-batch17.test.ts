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
import { SEVENTEENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { SEVENTEENTH_BATCH_AUDITS } from '../lib/api-v1/batch17-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-16-contract-snapshot.json' with { type: 'json' }
import { decodeChallenge, decodeReceipt, buildTypedData, encodePaymentSignature } from '../lib/x402/client.ts'
import { prepareModularPurchase, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
import { MAHA_PAYEE } from '../lib/x402/merchant-identity.ts'
import { validate } from './helpers/json-schema.ts'
const CLOCK = Date.parse('2026-10-15T06:00:00Z'), TX = '0x' + '9a'.repeat(32)
const env = { NODE_ENV: 'test' as const, BASE_PAYEE_ADDRESS: MAHA_PAYEE }
// Unfunded test key. Neither a chain provider nor a real facilitator is used.
const account = privateKeyToAccount(('0x' + '39'.repeat(32)) as `0x${string}`)
const hash = (v: unknown) => 'sha256:' + createHash('sha256').update(canonicalize(v)!).digest('hex')
let networkAttempts = 0
const savedFetch = globalThis.fetch
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch17_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => SEVENTEENTH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(SEVENTEENTH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof SEVENTEENTH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof SEVENTEENTH_BATCH[number], now: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch17-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('800 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 800); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.path, r.path); assert.equal(e.method, r.method); assert.equal(hash(e.schema.input), r.inputDigest); assert.equal(hash(e.schema.output), r.outputDigest); assert.equal(hash(e), r.contractDigest) }
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch17 is the next 50 unimplemented recipes, without recounting earlier cohorts', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => /^(telescope-calibrations|planetary-measurements|publication-records|trial-registry-records)-/.test(e.id) && !done.has(e.id)).slice(0, 50)
  assert.deepEqual(SEVENTEENTH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(SEVENTEENTH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of SEVENTEENTH_BATCH) {
    assert.equal(e.productionApproved, false); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost.liveModelSpendApproved, false)
    assert.equal(e.execution_cost.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.equal(e.sourceReview, 'not-applicable')
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, 500)
})
for (const spec of SEVENTEENTH_BATCH_AUDITS) {
  const e = SEVENTEENTH_BATCH.find(e => e.id === spec.id)!
  test('batch17 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
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
  test('batch17 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
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
  test('batch17 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
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
  test('batch17 registry router honors the reviewed production projection: ' + e.id, async () => {
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
test('batch17 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
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
  }; visit(resolve('lib/api-v1/batch17-audits.ts')); assert.ok(visited.size >= 6)
})

const rows = (i: Record<string, unknown>, key = 'rows') => i[key] as Record<string, unknown>[]
const codes = (id: string, i: unknown) => inspect(id, i).findings.map(f => f.code)
const values = (id: string, i: unknown) => Object.fromEntries(inspect(id, i).metrics.map(m => [m.key, m.value]))
const changedPin = (key: string, value: unknown) => key === 'studyRef' ? 'NCT00000002' : key === 'doi' ? '10.5555/other' : String(value).startsWith('sha256:') ? 'sha256:' + 'b'.repeat(64) : 'different-pin'
for (const [category, requestedKey] of [['planetary-measurements', 'requiredQuantities'], ['publication-records', 'requiredRelations'], ['trial-registry-records', 'requiredSections']] as const) {
  const id = category + '-condition-coverage-map', fixture = sample(id)
  for (const key of Object.keys(fixture).filter(k => typeof fixture[k] === 'string' && k !== 'dataClass')) {
    test(category + ': coverage cannot cross the ' + key + ' pin', () => {
      const i = sample(id), row = rows(i)[0]
      const result = inspect(id, { ...i, rows: [{ ...row, [key]: changedPin(key, row[key]) }] })
      assert.ok(result.findings.some(f => f.code.includes('frame-mismatch')))
      assert.equal(result.metrics[0].value, '0')
    })
  }
  test(category + ': duplicate, missing and unknown declarations cannot establish coverage', () => {
    const i = sample(id), row = rows(i)[0]
    for (const r of [[], [row, { ...row, id: 'duplicate1' }], [{ ...row, ...(category === 'planetary-measurements' ? { qualifier: 'unknown' } : { state: 'unknown' }) }]]) {
      assert.equal(inspect(id, { ...i, rows: r }).metrics[0].value, '0')
      assert.ok(codes(id, { ...i, rows: r }).some(c => c.endsWith('not-established')))
    }
    assert.throws(() => inspect(id, { ...i, [requestedKey]: [...i[requestedKey] as string[], ...i[requestedKey] as string[]] }))
  })
}

test('publication relations reject self-reference and distinguish a version from a correction', () => {
  const id = 'publication-records-condition-coverage-map', i = sample(id), row = rows(i)[0]
  assert.ok(codes(id, { ...i, rows: [{ ...row, targetWorkRef: i.workRef }] }).includes('publication-records-relation-self-reference'))
  assert.ok(codes(id, { ...i, rows: [{ ...row, relation: 'is-correction-of' }] }).includes('publication-records-relation-undeclared'))
})

for (const category of ['publication-records', 'trial-registry-records']) {
  const unit = category + '-unit-label-consistency', bound = category + '-declared-bound-audit'
  test(category + ': counts reject fractions, negative values, infinity and overflow', () => {
    const i = sample(unit), row = rows(i, 'measurements')[0]
    for (const value of [-1, 0.5, 1000001, Infinity, '1']) assert.throws(() => inspect(unit, { ...i, measurements: [{ ...row, value }] }))
    assert.deepEqual(codes(unit, { ...i, measurements: [{ ...row, value: 0 }] }), [])
    assert.deepEqual(codes(unit, { ...i, measurements: [{ ...row, value: null }] }), []) // label check, not availability
  })
  test(category + ': exact bounds are inclusive; unknown/estimated counts never become zero', () => {
    const i = sample(bound), row = rows(i, 'measurements')[0], b = rows(i, 'bounds')[0]
    for (const value of [0, 1]) assert.deepEqual(codes(bound, { ...i, measurements: [{ ...row, value }] }), [])
    for (const delta of [{ value: null }, { qualifier: 'unknown' }, { qualifier: 'estimated' }]) {
      assert.deepEqual(codes(bound, { ...i, measurements: [{ ...row, ...delta }] }), [category + '-value-not-exact'])
      assert.equal(Object.values(values(bound, { ...i, measurements: [{ ...row, ...delta }] }))[0], '0')
    }
    assert.throws(() => inspect(bound, { ...i, bounds: [{ ...b, minimum: 2, maximum: 1 }] }))
    assert.deepEqual(codes(bound, { ...i, bounds: [b, { ...b, id: 'bound2' }] }), [category + '-bound-not-unique'])
    for (const key of Object.keys(b).filter(k => !['id', 'minimum', 'maximum', 'quantity', 'unit'].includes(k))) {
      assert.deepEqual(codes(bound, { ...i, bounds: [{ ...b, [key]: changedPin(key, b[key]) }] }), [category + '-bound-not-unique'])
    }
  })
  test(category + ': partial dates, time inversions, missing instants and frame drift remain explicit', () => {
    const id = category + '-timestamp-order-audit', i = sample(id), row = rows(i)[0], first = category === 'publication-records' ? 'issuedAt' : 'submittedAt', second = category === 'publication-records' ? 'updatedAt' : 'postedAt'
    assert.ok(codes(id, { ...i, rows: [{ ...row, [second]: null }] }).some(c => c.endsWith('unknown')))
    assert.ok(codes(id, { ...i, rows: [{ ...row, [first]: '2026-02-01T00:00:00.000Z' }] }).includes(category + '-chronology-conflict'))
    assert.throws(() => inspect(id, { ...i, rows: [{ ...row, [first]: '2026-01' }] }))
    const frameKey = category === 'publication-records' ? 'metadataRevision' : 'protocolDigest'
    assert.ok(codes(id, { ...i, rows: [{ ...row, [frameKey]: 'sha256:' + 'b'.repeat(64) }] }).includes(category + '-chronology-frame-mismatch'))
  })
}

test('planetary coverage preserves declared coordinate conventions and exactness, not physical truth', () => {
  const id = 'planetary-measurements-condition-coverage-map', i = sample(id), row = rows(i)[0]
  assert.ok(codes(id, { ...i, rows: [{ ...row, unit: 'degrees' }] }).includes('planetary-measurements-quantity-unit-mismatch'))
  assert.ok(codes(id, { ...i, rows: [{ ...row, value: null }] }).includes('planetary-measurements-measurement-not-exact'))
  assert.deepEqual(codes(id, { ...i, rows: [{ ...row, value: -1 }] }), []) // not a physical radius validator
})

for (const category of ['telescope-calibrations', 'planetary-measurements', 'publication-records', 'trial-registry-records']) {
  test(category + ': source/provenance findings bind digests without authenticating sources', () => {
    const id = category + '-provenance-edge-audit', i = sample(id), edge = rows(i, 'edges')[0]
    assert.ok(codes(id, { ...i, edges: [{ ...edge, parentDigest: 'sha256:' + 'b'.repeat(64) }] }).includes(category + '-edge-pin-mismatch'))
    assert.ok(codes(id, { ...i, edges: [edge, { ...edge, id: 'edge2' }] }).includes(category + '-duplicate-edge'))
    const reverse = { ...edge, id: 'reverse1', childId: edge.parentId, parentId: edge.childId }
    assert.ok(codes(id, { ...i, edges: [edge, reverse] }).includes(category + '-edge-cycle'))
  })
}
