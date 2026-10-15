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
import { ELEVENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { ELEVENTH_BATCH_AUDITS } from '../lib/api-v1/batch11-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-10-contract-snapshot.json' with { type: 'json' }
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
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch11_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => ELEVENTH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(ELEVENTH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof ELEVENTH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof ELEVENTH_BATCH[number], now: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch11-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('500 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 500); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.path, r.path); assert.equal(e.method, r.method); assert.equal(hash(e.schema.input), r.inputDigest); assert.equal(hash(e.schema.output), r.outputDigest); assert.equal(hash(e), r.contractDigest) }
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch11 is the next 50 unimplemented recipes, without recounting earlier cohorts', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => /^(quantum-calibrations|biology-assays|genomic-records|protein-measurements)-/.test(e.id) && !done.has(e.id)).slice(0, 50)
  assert.deepEqual(ELEVENTH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(ELEVENTH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of ELEVENTH_BATCH) {
    assert.equal(e.productionApproved, false); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost.liveModelSpendApproved, false)
    assert.equal(e.execution_cost.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.equal(e.sourceReview, 'not-applicable')
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, 625)
})
for (const spec of ELEVENTH_BATCH_AUDITS) {
  const e = ELEVENTH_BATCH.find(e => e.id === spec.id)!
  test('batch11 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
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
  test('batch11 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
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
  test('batch11 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
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
  test('batch11 registry router honors the reviewed production projection: ' + e.id, async () => {
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
test('batch11 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
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
  }; visit(resolve('lib/api-v1/batch11-audits.ts')); assert.ok(visited.size >= 6)
})

test('assay protocol bindings do not borrow a digest from another study', () => {
  const id = 'biology-assays-reference-integrity-map', i = sample(id), p = (i.protocols as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, protocols: [{ ...p, studyRef: 'study2' }] }).findings.map(f => f.code), ['biology-assays-protocol-frame-mismatch'])
  const r = (i.rows as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, protocolId: 'absent' }] }).findings.map(f => f.code), ['biology-assays-protocol-missing'])
})
test('assay duplicate frames include protocol, batch and scope conflicts', () => {
  const id = 'biology-assays-duplicate-record-identities', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  for (const delta of [{ protocolDigest: 'sha256:' + 'b'.repeat(64) }, { batchRef: 'batch2' }, { scopeRef: 'other' }]) assert.deepEqual(inspect(id, { ...i, rows: [r, { ...r, id: 'r2', ...delta }] }).findings.map(f => f.code), ['biology-assays-conflicting-frame-content'])
})
test('scientific unit checks separate method and run frames and never silently convert', () => {
  const id = 'biology-assays-unit-label-consistency', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, measurements: [r, { ...r, id: 'r2', unit: 'ug-per-L' }] }).findings.map(f => f.code), ['biology-assays-unit-label-conflict'])
  for (const delta of [{ runRef: 'run2' }, { methodDigest: 'sha256:' + 'b'.repeat(64) }, { subjectRef: 'subject2' }]) assert.deepEqual(inspect(id, { ...i, measurements: [r, { ...r, id: 'r2', unit: 'ug-per-L', ...delta }] }).findings, [])
})
test('control coverage rejects absent, duplicate, unknown and wrong-frame declarations in all science families', () => {
  for (const family of ['biology-assays', 'genomic-records', 'protein-measurements']) {
    const id = family + '-condition-coverage-map', i = sample(id), c = (i.controls as Record<string, unknown>[])[0]
    for (const controls of [[], [c, { ...c, id: 'c2' }], [{ ...c, state: 'unknown' }], [{ ...c, runRef: 'wrong' }], [{ ...c, revision: 'sha256:' + 'b'.repeat(64) }]]) assert.equal(inspect(id, { ...i, controls }).metrics[0].value, '0')
    assert.deepEqual(inspect(id, { ...i, controls: [{ ...c, methodDigest: 'sha256:' + 'b'.repeat(64) }] }).findings.map(f => f.code), [family + '-control-not-established', family + '-control-frame-mismatch'])
  }
})
test('null and censored assay/protein values are not substituted by zero', () => {
  for (const family of ['biology-assays', 'protein-measurements']) {
    const id = family + '-declared-bound-audit', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0]
    assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, value: 0 }] }).findings, [])
    for (const delta of [{ value: null }, { qualifier: 'below-limit' }, { qualifier: 'above-limit' }, { qualifier: 'unknown' }]) assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, ...delta }] }).findings.map(f => f.code), [family + '-value-not-exact'])
  }
})
test('measurement bounds are inclusive, unique and pinned to exact run and units', () => {
  const id = 'protein-measurements-declared-bound-audit', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0], b = (i.bounds as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, value: 1 }] }).findings, [])
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, value: 1.000001 }] }).findings.map(f => f.code), ['protein-measurements-value-outside-declared-bound'])
  assert.deepEqual(inspect(id, { ...i, bounds: [b, { ...b, id: 'b2' }] }).findings.map(f => f.code), ['protein-measurements-bound-not-unique'])
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, runRef: 'wrong' }] }).findings.map(f => f.code), ['protein-measurements-bound-not-unique'])
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, unit: 'ug-per-mL' }] }).findings.map(f => f.code), ['protein-measurements-bound-frame-or-unit-mismatch'])
  assert.throws(() => inspect(id, { ...i, bounds: [{ ...b, minimum: 2 }] }), /reversed_science_bounds/)
})
test('collection age equality is inclusive and unknown processing/export timestamps remain unknown', () => {
  const id = 'biology-assays-timestamp-order-audit', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  const atLimit = new Date(Date.parse(r.collectedAt as string) + 86400000).toISOString()
  assert.deepEqual(inspect(id, { ...i, assessedAt: atLimit }).findings, [])
  assert.deepEqual(inspect(id, { ...i, assessedAt: new Date(Date.parse(atLimit) + 1).toISOString() }).findings.map(f => f.code), ['biology-assays-maximum-age-exceeded'])
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, processedAt: null, exportedAt: null }] }).findings.map(f => f.code), ['biology-assays-processing-time-unknown', 'biology-assays-export-time-unknown'])
})
test('processing/export order conflicts remain negative metadata rather than freshness approval', () => {
  const id = 'protein-measurements-timestamp-order-audit', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, exportedAt: '2025-12-31T23:59:59.000Z' }] }).findings.map(f => f.code), ['protein-measurements-timestamp-order-conflict'])
})
test('genomic intervals honor half-open versus closed coordinate boundaries', () => {
  const id = 'genomic-records-reference-integrity-map', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  assert.equal(inspect(id, i).metrics[1].value, '100')
  assert.equal(inspect(id, { ...i, rows: [{ ...r, coordinateConvention: 'one-based-closed', start: 1, end: 100 }] }).metrics[1].value, '100')
  assert.equal(inspect(id, { ...i, rows: [{ ...r, coordinateConvention: 'one-based-closed', start: 1, end: 1 }] }).metrics[1].value, '1')
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, start: 10, end: 10 }] }).findings.map(f => f.code), ['genomic-records-invalid-interval-order'])
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, coordinateConvention: 'one-based-closed', start: 0, end: 100 }] }).findings.map(f => f.code), ['genomic-records-interval-outside-contig'])
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, start: 101, end: 100 }] }).findings.map(f => f.code), ['genomic-records-invalid-interval-order'])
})
test('genomic interval lengths are not emitted for wrong assembly/version/digest/length frames', () => {
  const id = 'genomic-records-reference-integrity-map', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  for (const delta of [{ assemblyRef: 'assembly2' }, { contigRevision: 'sha256:' + 'b'.repeat(64) }, { sequenceDigest: 'sha256:' + 'b'.repeat(64) }, { contigLength: 101 }]) {
    const result = inspect(id, { ...i, rows: [{ ...r, ...delta }] }); assert.deepEqual(result.findings.map(f => f.code), ['genomic-records-contig-frame-mismatch']); assert.equal(result.metrics.length, 1); assert.equal(result.metrics[0].value, '0')
  }
})
test('genomic window union does not double count nested/overlapping intervals', () => {
  const id = 'genomic-records-declared-bound-audit', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  const rows = [{ ...r, start: 0, end: 5 }, { ...r, id: 'i2', start: 3, end: 8 }, { ...r, id: 'i3', start: 2, end: 3 }, { ...r, id: 'i4', start: 9, end: 10 }]
  assert.equal(inspect(id, { ...i, rows }).metrics[1].value, '9')
  assert.equal(inspect(id, { ...i, coordinateConvention: 'one-based-closed', windowStart: 1, rows: rows.map(r => ({ ...r, start: r.start + 1, coordinateConvention: 'one-based-closed' })) }).metrics[1].value, '9')
  assert.equal(inspect(id, { ...i, rows: rows.toReversed() }).metrics[1].value, '9')
  assert.throws(() => inspect(id, { ...i, windowEnd: 0 }), /invalid_genomic_window/)
})
test('invalid, outside or mismatched genomic windows contribute no coverage', () => {
  const id = 'genomic-records-declared-bound-audit', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  for (const delta of [{ end: 11 }, { assemblyRef: 'wrong' }, { coordinateConvention: 'one-based-closed' }, { start: 5, end: 5 }]) assert.equal(inspect(id, { ...i, rows: [{ ...r, ...delta }] }).metrics[1].value, '0')
})
test('protein isoform and sequence revision must match even when public references agree', () => {
  const id = 'protein-measurements-reference-integrity-map', i = sample(id), p = (i.proteins as Record<string, unknown>[])[0]
  for (const delta of [{ isoformRef: 'isoform2' }, { sequenceRevision: 'sha256:' + 'b'.repeat(64) }, { sequenceDigest: 'sha256:' + 'b'.repeat(64) }]) assert.deepEqual(inspect(id, { ...i, proteins: [{ ...p, ...delta }] }).findings.map(f => f.code), ['protein-measurements-protein-frame-mismatch'])
})
test('source bindings pin study batches, assembly revisions and protein isoforms rather than only artifact digests', () => {
  for (const [family, key, field] of [['biology-assays', 'sources', 'batchRef'], ['protein-measurements', 'sources', 'isoformRef'], ['genomic-records', 'assemblies', 'assemblyRef']]) {
    const id = family + '-provenance-edge-audit', i = sample(id), source = (i[key] as Record<string, unknown>[])[0]
    assert.equal(inspect(id, { ...i, [key]: [{ ...source, [field]: 'wrong' }] }).metrics[0].value, '0')
  }
})
test('record export parity preserves numeric convention and protein pins while allowing row reorder', () => {
  for (const [family, delta] of [['genomic-records', { coordinateConvention: 'one-based-closed' }], ['protein-measurements', { isoformRef: 'isoform2' }], ['quantum-calibrations', { qubitCount: 3 }]] as const) {
    const id = family + '-export-semantic-parity', i = sample(id), r = (i.before as Record<string, unknown>[])[0], second = { ...r, id: 'r2' }
    assert.deepEqual(inspect(id, { ...i, before: [r, second], after: [second, r] }).findings, [])
    assert.deepEqual(inspect(id, { ...i, after: [{ ...r, ...delta }] }).findings.map(f => f.code), [family + '-export-changed'])
  }
})
test('no raw sequences, genotypes, patient data or private keys fit the closed contracts', () => {
  for (const e of ELEVENTH_BATCH) {
    const h = handlerFor(e.id, e.amount)!, i = sample(e.id)
    for (const field of ['rawSequence', 'genotype', 'patientId', 'privateKey']) assert.throws(() => h.input.parse({ ...i, [field]: 'not-accepted' }))
  }
})
test('worst bounded protein provenance failures stay under the retained output ceiling', async () => {
  const id = 'protein-measurements-provenance-edge-audit', e = ELEVENTH_BATCH.find(e => e.id === id)!, i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  const value = { ...i, rows: Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'r' + 'x'.repeat(76) + String(n).padStart(3, '0'), sourceId: 'missing' })) }
  const output = await handlerFor(id, e.amount)!.execute(value) as Report
  assert.equal(output.result.findings.length, 32); assert.ok(Buffer.byteLength(JSON.stringify(output)) < 65000)
})
test('oversized dual protein projections are refused before work or settlement', async () => {
  const id = 'protein-measurements-record-sequence-diff', e = ELEVENTH_BATCH.find(e => e.id === id)!, i = sample(id), r = (i.before as Record<string, unknown>[])[0]
  const before = Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'r' + 'x'.repeat(76) + String(n).padStart(3, '0'), datasetRef: 'd'.repeat(80), proteinRef: 'p'.repeat(80), isoformRef: 'i'.repeat(80), scopeRef: 's'.repeat(80) }))
  const value = { ...i, before, after: structuredClone(before) }; assert.ok(Buffer.byteLength(JSON.stringify(value)) > 32768)
  ELEVENTH_BATCH_AUDITS.find(s => s.id === id)!.input.parse(value)
  const f = fixture(e, () => CLOCK)
  try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.equal((await route(f.request(value, await headers(e, value, quote)))).status, 400); assert.deepEqual(f.counts(), { settlements: 0, executions: 0 }) } finally { f.close() }
})
test('reversed scientific bounds and duplicate row IDs never settle', async () => {
  const id = 'biology-assays-declared-bound-audit', e = ELEVENTH_BATCH.find(e => e.id === id)!, i = sample(id), b = (i.bounds as Record<string, unknown>[])[0], r = (i.measurements as Record<string, unknown>[])[0]
  for (const value of [{ ...i, bounds: [{ ...b, minimum: 2 }] }, { ...i, measurements: [r, r] }]) {
    const f = fixture(e, () => CLOCK)
    try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.notEqual((await route(f.request(value, await headers(e, value, quote)))).status, 200); assert.equal(f.counts().settlements, 0) } finally { f.close() }
  }
})
