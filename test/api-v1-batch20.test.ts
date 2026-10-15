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
import { TWENTIETH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { TWENTIETH_BATCH_AUDITS } from '../lib/api-v1/batch20-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-19-contract-snapshot.json' with { type: 'json' }
import { decodeChallenge, decodeReceipt, buildTypedData, encodePaymentSignature } from '../lib/x402/client.ts'
import { prepareModularPurchase, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
import { MAHA_PAYEE } from '../lib/x402/merchant-identity.ts'
import { validate } from './helpers/json-schema.ts'
import { BATCH20_PORTS, batch20Port } from '../lib/api-v1/batch20-ports.ts'
import { batch20FixtureHandler, MOCK_MODEL_POLICY } from '../scripts/lib/api-v1-batch20-fixtures.ts'
import type { HandlerContract } from '../lib/api-v1/types.ts'
const CLOCK = Date.parse('2026-10-15T06:00:00Z'), TX = '0x' + '9a'.repeat(32)
const env = { NODE_ENV: 'test' as const, BASE_PAYEE_ADDRESS: MAHA_PAYEE }
// Unfunded test key. Neither a chain provider nor a real facilitator is used.
const account = privateKeyToAccount(('0x' + '39'.repeat(32)) as `0x${string}`)
const hash = (v: unknown) => 'sha256:' + createHash('sha256').update(canonicalize(v)!).digest('hex')
let networkAttempts = 0
const savedFetch = globalThis.fetch
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch20_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => TWENTIETH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(TWENTIETH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof TWENTIETH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof TWENTIETH_BATCH[number], now: () => number, override?: HandlerContract) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch20-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = override ?? handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('950 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 950); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) assertEarlierLocalContract(ENDPOINTS.find(e => e.id === r.id)!, r)
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch20 is the next 50 unimplemented recipes, without recounting earlier cohorts', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => !done.has(e.id))
  assert.deepEqual(TWENTIETH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(TWENTIETH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of TWENTIETH_BATCH) {
    assert.equal(e.productionApproved, false); assert.notEqual(e.execution_cost?.mode, 'unreviewed'); assert.equal(e.execution_cost!.liveModelSpendApproved, false)
    assert.equal(e.execution_cost!.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.ok(['pending', 'not-applicable', 'reviewed-local'].includes(e.sourceReview))
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, PRODUCTION_ENDPOINTS.length)
})
for (const spec of TWENTIETH_BATCH_AUDITS) {
  const e = TWENTIETH_BATCH.find(e => e.id === spec.id)!
  test('batch20 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
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
  test('batch20 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
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
  test('batch20 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
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
  test('batch20 registry router honors the reviewed production projection: ' + e.id, async () => {
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
test('batch20 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
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
}; visit(resolve('lib/api-v1/batch20-audits.ts')); assert.ok(visited.size >= 6)
})

for (const spec of BATCH20_PORTS) {
  const original = TWENTIETH_BATCH.find(e => e.id === spec.id)!
  // Only this isolated fixture receives a mock spending policy. The registry
  // remains frozen with spending unapproved and has no model connector.
  const e = original
  test('batch20 port: independent input/output schemas, hash and price binding: ' + e.id, async () => {
    const h = batch20FixtureHandler(e.id, e.amount)!, out = await h.execute(spec.sample) as Record<string, unknown>
    assert.deepEqual(validate(spec.sample, original.schema.input), [])
    assert.deepEqual(validate({ success: true, data: out, proof: { settlement_id: TX } }, original.schema.output), [])
    assert.equal(out.inputHash, hash(h.input.parse(spec.sample))); assert.equal(out.resultHash, hash(out.result)); assert.equal(out.chargedAmount, e.amount)
    assert.ok(Buffer.byteLength(JSON.stringify(out)) < 65000)
    assert.throws(() => h.output.parse({ ...out, resultHash: 'sha256:' + '0'.repeat(64) }))
    assert.throws(() => h.output.parse({ ...out, chargedAmount: '1' }))
    for (const bad of [{ ...spec.sample, dataClass: 'private' }, { ...spec.sample, nonpersonalMetadata: false }, { ...spec.sample, privateKey: 'forbidden' }]) assert.throws(() => h.input.parse(bad))
    const request = spec.sample.request as Record<string, unknown>
    assert.throws(() => h.input.parse({ ...spec.sample, request: { ...request, privateKey: 'forbidden' } }))
  })
  test('batch20 port: local settlement, restart recovery and exact expiry: ' + e.id, async () => {
    let now = CLOCK; const f = fixture(e, () => now, batch20FixtureHandler(e.id, e.amount))
    try {
      let route = f.route(); const quote = decodeChallenge((await route(f.request(spec.sample))).headers.get('PAYMENT-REQUIRED')!)
      const invalid = { ...spec.sample, nonpersonalMetadata: false }
      assert.equal((await route(f.request(invalid, await headers(e, invalid, quote)))).status, 400)
      assert.equal(f.counts().settlements, 0)
      const authorization = await headers(e, spec.sample, quote), response = await route(f.request(spec.sample, authorization))
      assert.equal(response.status, 200); const output = await response.json(); assert.deepEqual(validate(output, original.schema.output), [])
      f.restart(); now += 120000; route = f.route()
      const recovered = await route(f.request(spec.sample, { ...authorization, 'X-Maha-Recovery-Mode': 'retained-result' }))
      assert.equal(recovered.status, 200); assert.deepEqual(await recovered.json(), output); assert.deepEqual(f.counts(), { executions: 1, settlements: 1 })
      now = CLOCK + 86400000
      assert.equal((await route(f.request(spec.sample, { ...authorization, 'X-Maha-Recovery-Mode': 'retained-result' }))).status, 410)
      assert.deepEqual(f.counts(), { executions: 1, settlements: 1 })
    } finally { f.close() }
  })
  test('batch20 port: buyer persists before submission and recovers lost response without repayment: ' + e.id, async () => {
    const f = fixture(e, () => CLOCK, batch20FixtureHandler(e.id, e.amount))
    try {
      const route = f.route(); let persisted = false, signatures = 0
      const transport: typeof fetch = async (url, init) => { if (new Headers(init?.headers).has('PAYMENT-SIGNATURE')) assert.ok(persisted); return route(new Request(url, init)) }
      const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (i: unknown) => f.h.input.parse(i), validateOutput: (o: unknown) => f.h.output.parse(o) }
      const capsule = await prepareModularPurchase(contract, { input: spec.sample, payer: account.address, maximumAmount: BigInt(e.amount), now: CLOCK, fetchImpl: transport,
        signTypedData: async typed => { signatures++; return account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]) }, persist: async () => { persisted = true } })
      const lost: typeof fetch = async (url, init) => { const response = await transport(url, init); assert.equal(response.status, 200); await response.body?.cancel(); throw Error('response_lost') }
      assert.equal((await submitModularPurchase(contract, capsule, { fetchImpl: lost, now: CLOCK })).delivery, 'unresolved')
      const recovered = await submitModularPurchase(contract, capsule, { fetchImpl: transport, now: CLOCK + 120000, recovery: 'retained-result' })
      assert.equal(recovered.delivery, 'validated_response'); assert.equal(recovered.replayed, true)
      assert.equal(signatures, 1); assert.deepEqual(f.counts(), { executions: 1, settlements: 1 })
    } finally { f.close() }
  })
  test('batch20 port: default quote or spending refusal; production route stays absent: ' + e.id, async () => {
    const route = createEndpointRouter({ environment: env, store: memoryPaymentStore(() => CLOCK), now: () => CLOCK,
      facilitator: { verify: async () => { throw Error('must_not_verify') }, settle: async () => { throw Error('must_not_settle') } } })
    const request = () => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', body: JSON.stringify(spec.sample) })
    const quoted = await route(request()); assert.equal(quoted.status, 402)
    assert.equal(decodeChallenge(quoted.headers.get('PAYMENT-REQUIRED')!).accepts[0].amount, e.amount)
    const production = createEndpointRouter({ environment: { NODE_ENV: 'production', VERCEL: '1' } })
    assert.equal((await production(request())).status, PRODUCTION_ENDPOINTS.some(p => p.id === e.id) ? 503 : 404)
  })
}

const rows = (i: Record<string, unknown>, key = 'rows') => i[key] as Record<string, unknown>[]
const codes = (id: string, i: unknown) => inspect(id, i).findings.map(f => f.code)
for (const category of ['reading-plans', 'edition-records', 'glossary-records']) {
  const bound = category + '-declared-bound-audit'
  test(category + ': counts reject fractions, unknowns and duplicate bounds; inclusive edges pass', () => {
    const i = sample(bound), b = rows(i, 'bounds')[0], r = rows(i, 'measurements')[0]
    for (const value of [-1, 0.5, '1', 1000001]) assert.throws(() => inspect(bound, { ...i, measurements: [{ ...r, value }] }))
    for (const value of [0, 1]) assert.deepEqual(codes(bound, { ...i, measurements: [{ ...r, value }] }), [])
    for (const patch of [{ value: null }, { qualifier: 'unknown' }, { qualifier: 'estimated' }]) assert.deepEqual(codes(bound, { ...i, measurements: [{ ...r, ...patch }] }), [category + '-value-not-exact'])
    assert.deepEqual(codes(bound, { ...i, bounds: [b, { ...b, id: 'bound2' }] }), [category + '-bound-not-unique'])
    assert.throws(() => inspect(bound, { ...i, bounds: [{ ...b, minimum: 2, maximum: 1 }] }))
  })
  test(category + ': module presence is unique and exact-frame, not semantic completeness', () => {
    const id = category + '-condition-coverage-map', i = sample(id), r = rows(i)[0]
    assert.deepEqual(codes(id, { ...i, rows: [r, { ...r, id: 'r2' }] }), [category + '-module-not-established'])
    for (const state of ['unknown', 'absent']) assert.ok(codes(id, { ...i, rows: [{ ...r, state }] }).includes(category + '-module-not-established'))
    for (const key of Object.keys(r).filter(k => !['id', 'moduleRef', 'state'].includes(k))) {
      const value = String(r[key]).startsWith('sha256:') ? 'sha256:' + 'b'.repeat(64) : 'different-pin'
      assert.ok(codes(id, { ...i, rows: [{ ...r, [key]: value }] }).includes(category + '-module-frame-mismatch'))
    }
  })
}
test('CPU MPS replacement ignores model connectors and unapproved budgets entirely', async () => {
  const spec = BATCH20_PORTS.find(s => s.id === 'mps-autonomous-audit')!; let calls = 0
  await batch20Port(spec.id, '100002')!.execute(spec.sample)
  for (const policy of [{ ...MOCK_MODEL_POLICY, liveModelSpendApproved: false }, { ...MOCK_MODEL_POLICY, costEnvelopeReviewed: false }, { ...MOCK_MODEL_POLICY, maximum_external_cost_usdc: null }, { ...MOCK_MODEL_POLICY, expected_usdc: .04, maximum_external_cost_usdc: .04 }]) {
    await batch20Port(spec.id, '100002', { model: { policy, maximumCallCostUsd: .001, run: async () => { calls++; return '{}' } } })!.execute(spec.sample)
  }
  await batch20Port(spec.id, '100002', { model: { policy: MOCK_MODEL_POLICY, maximumCallCostUsd: .002, run: async () => { calls++; return '{}' } } })!.execute(spec.sample)
  assert.equal(calls, 0)
})
test('CPU MPS does not invoke a failing or fabricated model connector', async () => {
  const spec = BATCH20_PORTS.find(s => s.id === 'mps-autonomous-audit')!; let calls = 0
  const h = batch20Port(spec.id, '100002', { model: { policy: MOCK_MODEL_POLICY, maximumCallCostUsd: .001, run: async () => { calls++; throw Error('mock_timeout') } } })!
  await h.execute(spec.sample); assert.equal(calls, 0)
  const invalid = batch20Port(spec.id, '100002', { model: { policy: MOCK_MODEL_POLICY, maximumCallCostUsd: .001, run: async () => '{"claims":[{"excerpt":"not in source","tag":"VERIFIED","rationale":"fabricated"}]}' } })!
  await invalid.execute(spec.sample); assert.equal(calls, 0)
})
test('context inputs bind required evidence to exact source and reject repeated budgets/documents', async () => {
  const spec = BATCH20_PORTS.find(s => s.id === 'evidence-retention-matrix')!, h = batch20FixtureHandler(spec.id, '50001')!, i = structuredClone(spec.sample), r = i.request as Record<string, unknown>
  const spans = r.requiredEvidence as Record<string, unknown>[]
  await assert.rejects(h.execute({ ...i, request: { ...r, requiredEvidence: [{ ...spans[0], text: 'not a supplied span' }] } }), /exact span/)
  await assert.rejects(h.execute({ ...i, request: { ...r, tokenBudgets: [64, 64, 96, 128, 256] } }))
  const docs = r.documents as Record<string, unknown>[]
  await assert.rejects(h.execute({ ...i, request: { ...r, documents: [docs[0], docs[0]] } }), /duplicate/)
  const out = await h.execute(i) as { result: { runs: { evidence: { status: string }[] }[]; evidenceFrontier: { retainedAtBudgets: number[] }[] } }
  assert.equal(out.result.runs.length, 5); assert.ok(out.result.runs.at(-1)!.evidence.every(e => e.status === 'retained'))
})
test('celestial calculations use existing local engine and reject impossible dates/negative timing windows', async () => {
  const s = BATCH20_PORTS.find(s => s.id === 'celestial-position-snapshot')!, h = batch20FixtureHandler(s.id, '20001')!, r = s.sample.request as Record<string, unknown>
  await assert.rejects(h.execute({ ...s.sample, request: { ...r, instantUtc: '2026-02-30T00:00:00.000Z' } }))
  const out = await h.execute(s.sample) as { result: { result: { positions: { body: string; tropicalLongitude: number }[] } } }
  assert.equal(out.result.result.positions.length, 7)
  const sun = out.result.result.positions.find(p => p.body === 'Sun')!; assert.ok(sun.tropicalLongitude > 280 && sun.tropicalLongitude < 281)
  const t = BATCH20_PORTS.find(s => s.id === 'celestial-vimshottari-timing')!, tr = t.sample.request as Record<string, unknown>
  await assert.rejects(batch20FixtureHandler(t.id, '120001')!.execute({ ...t.sample, request: { ...tr, referenceInstantUtc: '1999-01-01T00:00:00.000Z' } }), /out_of_range/)
})
test('source-backed adapters reject unapproved targets and source URLs before mock acquisition', async () => {
  let reads = 0
  for (const id of ['live-x402-payment-preflight', 'live-citation-recheck', 'source-bound-research-microbrief']) {
    const s = BATCH20_PORTS.find(s => s.id === id)!, i = structuredClone(s.sample), r = i.request as Record<string, unknown>
    if ('resource' in r) r.resource = 'https://unapproved.invalid/resource'
    if ('citations' in r) (r.citations as Record<string, unknown>[])[0].url = 'https://unapproved.invalid/resource'
    if ('sources' in r) (r.sources as Record<string, unknown>[])[0].url = 'https://unapproved.invalid/resource'
    const h = batch20Port(id, '100001', { demand: { read: async () => { reads++; throw Error('must_not_read') } } })!
    await assert.rejects(h.execute(i), /not_allowed|not_reviewed/)
  }
  assert.equal(reads, 0)
})
test('extractive source fixtures return exact locators, no script text or invented answer', async () => {
  const s = BATCH20_PORTS.find(s => s.id === 'source-bound-research-microbrief')!, out = await batch20FixtureHandler(s.id, '240001')!.execute(s.sample) as { result: { modelCalls: number; briefMarkdown: string; citations: { quote: string; startCodePoint: number; endCodePoint: number }[] } }
  assert.equal(out.result.modelCalls, 0); assert.ok(out.result.citations.length > 0); assert.doesNotMatch(out.result.briefMarkdown, /Ignore all instructions/)
  for (const c of out.result.citations) assert.equal(c.endCodePoint - c.startCodePoint, Array.from(c.quote).length)
})
test('reviewed legacy adapter static dependency closure excludes hosted databases, partner API and model SDKs', () => {
  const visited = new Set<string>(), allowed = new Set(['zod', 'canonicalize', 'astronomy-engine', 'node:crypto', 'node:dns/promises', 'node:net', 'node:https'])
  const visit = (path: string) => {
    if (visited.has(path)) return; visited.add(path)
    assert.ok(path.startsWith(resolve('lib') + '/') || path === resolve('content/x402/demand6/quote-history.json'))
    const source = readFileSync(path, 'utf8'), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    assert.doesNotMatch(source, /from\s+['"][^'"]*(?:supabase|zizka|anthropic|openai)|api-v1-batch20-fixtures/i)
    // Only the shared public network-definition module has environment-default
    // helpers. These adapters call usdcNetwork, not its RPC/config helpers.
    if (path !== resolve('lib/x402/networks.ts')) assert.doesNotMatch(source, /process\.env/)
    const walk = (n: ts.Node) => {
      if ((ts.isImportDeclaration(n) && !n.importClause?.isTypeOnly) || (ts.isExportDeclaration(n) && !n.isTypeOnly && n.moduleSpecifier)) {
        const moduleRef = (n as ts.ImportDeclaration | ts.ExportDeclaration).moduleSpecifier
        if (moduleRef && ts.isStringLiteral(moduleRef)) { const name = moduleRef.text; if (name.startsWith('.')) visit(resolve(dirname(path), name)); else assert.ok(allowed.has(name), name) }
      }
      ts.forEachChild(n, walk)
    }; walk(ast)
  }
  visit(resolve('lib/api-v1/batch20-ports.ts')); assert.ok(visited.size > 15)
})
test('all 1000 local products have handlers, unique routes/prices, and no production approval', () => {
  assert.equal(ENDPOINTS.length, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0); assert.equal(LOCAL_BATCH_PLAN.plannedBatches.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.method + ':' + e.path)).size, 1000)
  for (const e of ENDPOINTS) { assert.ok(handlerFor(e.id, e.amount), e.id); assert.equal(e.status, 'local-implemented'); assert.equal(e.productionApproved, false); assert.equal(e.schema_status, 'validated-local'); assertExecutionCost(e.amount, e.execution_cost) }
})
