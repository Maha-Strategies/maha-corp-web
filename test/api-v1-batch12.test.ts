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
import { TWELFTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { TWELFTH_BATCH_AUDITS } from '../lib/api-v1/batch12-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-11-contract-snapshot.json' with { type: 'json' }
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
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch12_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => TWELFTH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(TWELFTH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof TWELFTH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof TWELFTH_BATCH[number], now: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch12-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('550 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 550); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.path, r.path); assert.equal(e.method, r.method); assert.equal(hash(e.schema.input), r.inputDigest); assert.equal(hash(e.schema.output), r.outputDigest); assert.equal(hash(e), r.contractDigest) }
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch12 is the next 50 unimplemented recipes, without recounting earlier cohorts', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => /^(ecology-observations|reaction-records|spectrometry-records|catalyst-measurements)-/.test(e.id) && !done.has(e.id)).slice(0, 50)
  assert.deepEqual(TWELFTH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(TWELFTH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of TWELFTH_BATCH) {
    assert.equal(e.productionApproved, false); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost.liveModelSpendApproved, false)
    assert.equal(e.execution_cost.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.equal(e.sourceReview, 'not-applicable')
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, 625)
})
for (const spec of TWELFTH_BATCH_AUDITS) {
  const e = TWELFTH_BATCH.find(e => e.id === spec.id)!
  test('batch12 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
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
  test('batch12 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
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
  test('batch12 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
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
  test('batch12 registry router honors the reviewed production projection: ' + e.id, async () => {
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
test('batch12 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
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
  }; visit(resolve('lib/api-v1/batch12-audits.ts')); assert.ok(visited.size >= 6)
})

test('ecology event windows include their start but exclude their end', () => {
  const id = 'ecology-observations-reference-integrity-map', i = sample(id), r = (i.rows as Record<string, unknown>[])[0], event = (i.events as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, observedAt: event.startsAt }] }).findings, [])
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, observedAt: event.endsAt }] }).findings.map(f => f.code), ['ecology-observations-observation-outside-event-window'])
  assert.throws(() => inspect(id, { ...i, events: [{ ...event, endsAt: event.startsAt }] }), /invalid_ecology_event_window/)
})
test('ecology event references pin dataset, event and method rather than timestamps alone', () => {
  const id = 'ecology-observations-reference-integrity-map', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  for (const delta of [{ datasetRef: 'other' }, { eventRef: 'other' }, { methodDigest: 'sha256:' + 'b'.repeat(64) }]) assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, ...delta }] }).findings.map(f => f.code), ['ecology-observations-event-frame-mismatch'])
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, eventId: 'missing' }] }).findings.map(f => f.code), ['ecology-observations-event-missing'])
})
test('non-detection and zero are not unknown count or ecological absence proof', async () => {
  const id = 'ecology-observations-declared-bound-audit', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, count: 0, detection: 'notDetected' }] }).findings, [])
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, count: null, detection: 'notDetected' }] }).findings.map(f => f.code), ['ecology-observations-count-unknown'])
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, count: 0, detection: 'detected' }] }).findings.map(f => f.code), ['ecology-observations-detection-count-conflict'])
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, count: 1, detection: 'notDetected' }] }).findings.map(f => f.code), ['ecology-observations-detection-count-conflict'])
  const e = TWELFTH_BATCH.find(e => e.id === id)!, output = await handlerFor(id, e.amount)!.execute({ ...i, rows: [{ ...r, count: 0, detection: 'notDetected' }] }) as Report
  assert.equal(output.result.domainValidationEstablished, false)
})
test('ecology effort stays unknown when absent, and effort labels are not numerically converted', () => {
  const id = 'ecology-observations-declared-bound-audit', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  for (const [delta, code] of [[{ effort: null }, 'effort-unknown'], [{ effort: 0 }, 'effort-below-policy'], [{ effortUnit: 'observer-hours' }, 'effort-unit-mismatch'], [{ detection: 'unknown' }, 'detection-unknown']] as const) {
    const result = inspect(id, { ...i, rows: [{ ...r, ...delta }] }); assert.deepEqual(result.findings.map(f => f.code), ['ecology-observations-' + code]); assert.equal(result.metrics[0].value, '0')
  }
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, count: 10, effort: 1 }] }).findings, [])
  assert.throws(() => inspect(id, { ...i, minimumCount: 11 }), /reversed_ecology_count_bounds/)
})
test('taxonomy provenance requires the exact taxon and taxonomy version', () => {
  const id = 'ecology-observations-provenance-edge-audit', i = sample(id), t = (i.taxa as Record<string, unknown>[])[0]
  for (const delta of [{ taxonRef: 'other-taxon' }, { taxonomyRevision: 'sha256:' + 'b'.repeat(64) }, { taxonDigest: 'sha256:' + 'b'.repeat(64) }]) assert.deepEqual(inspect(id, { ...i, taxa: [{ ...t, ...delta }] }).findings.map(f => f.code), ['ecology-observations-taxon-provenance-pin-mismatch'])
})
test('ecology observations with distinct occurrence IDs are not conflated within a shared event', () => {
  const id = 'ecology-observations-duplicate-record-identities', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, rows: [r, { ...r, id: 'r2', observationRef: 'obs2', taxonRef: 'taxon2' }] }).findings, [])
  assert.deepEqual(inspect(id, { ...i, rows: [r, { ...r, id: 'r2', taxonRef: 'taxon2' }] }).findings.map(f => f.code), ['ecology-observations-conflicting-frame-content'])
})
test('reaction conservation uses exact element-label counts and does not silently equate isotopes', () => {
  const id = 'reaction-records-condition-coverage-map', i = sample(id), rows = i.participants as Record<string, unknown>[]
  assert.deepEqual(inspect(id, i).metrics.map(m => [m.key, m.value]), [['reaction-records-elements-with-equal-declared-counts', '2'], ['reaction-records-charge-delta', '0'], ['reaction-records-element-delta', '0'], ['reaction-records-element-delta', '0']])
  assert.deepEqual(inspect(id, { ...i, participants: rows.toReversed() }).findings, [])
  const changed = rows.map(r => r.id === 'water' ? { ...r, atoms: [{ elementRef: 'H-isotope', count: 2 }, { elementRef: 'O', count: 1 }] } : r)
  assert.deepEqual(inspect(id, { ...i, participants: changed }).findings.map(f => f.code), ['reaction-records-declared-element-imbalance'])
})
test('balanced atoms do not conceal a charge imbalance', () => {
  const id = 'reaction-records-condition-coverage-map', i = sample(id), rows = i.participants as Record<string, unknown>[]
  const result = inspect(id, { ...i, participants: rows.map(r => r.id === 'water' ? { ...r, charge: 1 } : r) })
  assert.deepEqual(result.findings.map(f => f.code), ['reaction-records-declared-charge-imbalance']); assert.equal(result.metrics[1].value, '2')
})
test('reaction coefficients cannot be zero, negative or fractional and ambiguous element counts are rejected', () => {
  const id = 'reaction-records-condition-coverage-map', i = sample(id), rows = i.participants as Record<string, unknown>[]
  for (const coefficient of [0, -1, 0.5, 1000001]) assert.throws(() => inspect(id, { ...i, participants: [{ ...rows[0], coefficient }] }))
  assert.throws(() => inspect(id, { ...i, participants: [{ ...rows[0], atoms: [{ elementRef: 'H', count: 2 }, { elementRef: 'H', count: 3 }] }] }), /duplicate_ids/)
  assert.deepEqual(inspect(id, { ...i, participants: [rows[0]] }).findings.map(f => f.code), ['reaction-records-declared-element-imbalance', 'reaction-records-reaction-side-missing'])
})
test('large integer composition balances remain exact and bounded', () => {
  const id = 'reaction-records-condition-coverage-map', i = sample(id)
  const rows = Array.from({ length: 32 }, (_, n) => ({ id: 'p' + n, side: n < 16 ? 'reactant' : 'product', coefficient: 1000000, atoms: [{ elementRef: 'E', count: 1000000 }], charge: -1000000 }))
  assert.deepEqual(inspect(id, { ...i, participants: rows }).findings, [])
  const result = inspect(id, { ...i, participants: rows.map((r, n) => n === 31 ? { ...r, coefficient: 999999 } : r) })
  assert.equal(result.metrics.find(m => m.key === 'reaction-records-element-delta')!.value, '-1000000')
  assert.equal(result.metrics.find(m => m.key === 'reaction-records-charge-delta')!.value, '1000000')
})
test('reaction participant references pin dataset and composition version', () => {
  const id = 'reaction-records-reference-integrity-map', i = sample(id), r = (i.participants as Record<string, unknown>[])[0]
  for (const delta of [{ datasetRef: 'other' }, { speciesRef: 'other' }, { compositionRevision: 'sha256:' + 'b'.repeat(64) }, { compositionDigest: 'sha256:' + 'b'.repeat(64) }]) assert.deepEqual(inspect(id, { ...i, participants: [{ ...r, ...delta }] }).findings.map(f => f.code), ['reaction-records-participant-composition-pin-mismatch'])
})
test('spectral calibration coverage rejects unknown, missing, duplicate, expired or wrong-frame declarations', () => {
  const id = 'spectrometry-records-condition-coverage-map', i = sample(id), c = (i.calibrations as Record<string, unknown>[])[0]
  for (const calibrations of [[], [c, { ...c, id: 'c2' }], [{ ...c, state: 'unknown' }], [{ ...c, validUntil: null }], [{ ...c, validUntil: i.assessedAt }], [{ ...c, instrumentRef: 'other' }], [{ ...c, capturedAt: c.validUntil }], [{ ...c, validUntil: '2025-12-31T00:00:00.000Z' }]]) assert.equal(inspect(id, { ...i, calibrations }).metrics[0].value, '0')
  assert.deepEqual(inspect(id, { ...i, calibrations: [{ ...c, revision: 'sha256:' + 'b'.repeat(64) }] }).findings.map(f => f.code), ['spectrometry-records-calibration-not-established', 'spectrometry-records-calibration-undeclared'])
})
test('spectral references do not treat m/z, wavelength or calibration versions as interchangeable', () => {
  const id = 'spectrometry-records-reference-integrity-map', i = sample(id), r = (i.points as Record<string, unknown>[])[0]
  for (const delta of [{ calibrationDigest: 'sha256:' + 'b'.repeat(64) }, { instrumentRef: 'other' }, { revision: 'sha256:' + 'b'.repeat(64) }]) assert.deepEqual(inspect(id, { ...i, points: [{ ...r, ...delta }] }).findings.map(f => f.code), ['spectrometry-records-acquisition-pin-mismatch'])
  assert.deepEqual(inspect(id, { ...i, points: [{ ...r, axis: 'wavelength', axisUnit: 'nanometres' }] }).findings.map(f => f.code), ['spectrometry-records-acquisition-pin-mismatch'])
  assert.deepEqual(inspect(id, { ...i, points: [{ ...r, axisUnit: 'nanometres' }] }).findings.map(f => f.code), ['spectrometry-records-acquisition-pin-mismatch', 'spectrometry-records-axis-unit-incompatible'])
})
test('spectral insertions are not shared-point reorderings and non-increasing axes stay visible', () => {
  const id = 'spectrometry-records-record-sequence-diff', i = sample(id), r = (i.before as Record<string, unknown>[])[0]
  const next = { ...r, id: 'p2', axisValue: 200 }, inserted = { ...r, id: 'new', axisValue: 150 }
  assert.deepEqual(inspect(id, { ...i, before: [r, next], after: [r, inserted, next] }).findings.map(f => f.code), ['spectrometry-records-point-added'])
  assert.deepEqual(inspect(id, { ...i, before: [r, next], after: [next, r] }).findings.map(f => f.code), ['spectrometry-records-shared-point-order-changed', 'spectrometry-records-axis-not-strictly-increasing'])
  assert.deepEqual(inspect(id, { ...i, after: [r, { ...r, id: 'p2' }] }).findings.map(f => f.code), ['spectrometry-records-point-added', 'spectrometry-records-axis-not-strictly-increasing'])
})
test('spectral projections retain null and signed baseline intensity instead of inventing zero or clipping', () => {
  const id = 'spectrometry-records-record-sequence-diff', i = sample(id), r = (i.before as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, before: [{ ...r, intensity: null }], after: [{ ...r, intensity: 0 }] }).findings.map(f => f.code), ['spectrometry-records-point-changed'])
  assert.deepEqual(inspect(id, { ...i, before: [{ ...r, intensity: -1 }], after: [{ ...r, intensity: -1 }] }).findings, [])
})
test('numeric unit consistency is framed by run and method without implicit conversion', () => {
  for (const [family, unit] of [['reaction-records', 'mmol'], ['spectrometry-records', 'nanometres'], ['ecology-observations', 'trap-nights']]) {
    const id = family + '-unit-label-consistency', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0]
    const result = inspect(id, { ...i, measurements: [r, { ...r, id: 'r2', unit }] })
    assert.ok(result.findings.some(f => f.code === family + '-unit-label-conflict'))
    const separated = inspect(id, { ...i, measurements: [r, { ...r, id: 'r2', unit, runRef: 'run2' }] })
    assert.ok(!separated.findings.some(f => f.code === family + '-unit-label-conflict'))
  }
})
test('reaction and spectral source links bind methods and calibrations, not only source hashes', () => {
  for (const [family, field] of [['reaction-records', 'methodDigest'], ['spectrometry-records', 'calibrationDigest']]) {
    const id = family + '-provenance-edge-audit', i = sample(id), s = (i.sources as Record<string, unknown>[])[0]
    assert.equal(inspect(id, { ...i, sources: [{ ...s, [field]: 'sha256:' + 'b'.repeat(64) }] }).metrics[0].value, '0')
  }
})
test('catalyst duplicate frames preserve material-lot and measurement method distinctions', () => {
  const id = 'catalyst-measurements-duplicate-record-identities', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  for (const delta of [{ materialLotRef: 'lot2' }, { methodDigest: 'sha256:' + 'b'.repeat(64) }]) assert.deepEqual(inspect(id, { ...i, rows: [r, { ...r, id: 'r2', ...delta }] }).findings.map(f => f.code), ['catalyst-measurements-conflicting-frame-content'])
})
test('private keys, precise locations, participant names and procedural instructions are excluded by closed contracts', () => {
  for (const e of TWELFTH_BATCH) {
    const h = handlerFor(e.id, e.amount)!, i = sample(e.id)
    for (const field of ['privateKey', 'decimalLatitude', 'decimalLongitude', 'participantName', 'synthesisInstructions']) assert.throws(() => h.input.parse({ ...i, [field]: 'not-accepted' }))
  }
})
test('bounded reaction element-universe and output constraints hold with long labels', async () => {
  const id = 'reaction-records-condition-coverage-map', e = TWELFTH_BATCH.find(e => e.id === id)!, i = sample(id)
  const participants = Array.from({ length: 4 }, (_, n) => ({ id: 'p' + n, side: n % 2 ? 'product' : 'reactant', coefficient: 1, charge: 0, atoms: Array.from({ length: 16 }, (_, a) => ({ elementRef: 'E' + 'x'.repeat(76) + String(n * 16 + a).padStart(3, '0'), count: 1 })) }))
  const out = await handlerFor(id, e.amount)!.execute({ ...i, participants }) as Report
  assert.equal(out.result.metrics.length, 66); assert.ok(Buffer.byteLength(JSON.stringify(out)) < 65000)
  const tooMany = { ...i, participants: [...participants, { ...participants[0], id: 'extra', atoms: [{ elementRef: 'additional', count: 1 }] }] }
  assert.throws(() => handlerFor(id, e.amount)!.input.parse(tooMany), /reaction_element_universe_over_64/)
})
test('oversized dual spectral metadata exports are refused before work or settlement', async () => {
  const id = 'spectrometry-records-export-semantic-parity', e = TWELFTH_BATCH.find(e => e.id === id)!, i = sample(id), r = (i.before as Record<string, unknown>[])[0]
  const before = Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'r' + 'x'.repeat(76) + String(n).padStart(3, '0'), datasetRef: 'd'.repeat(80), spectrumRef: 's'.repeat(80), instrumentRef: 'i'.repeat(80), scopeRef: 's'.repeat(80) }))
  const value = { ...i, before, after: structuredClone(before) }; assert.ok(Buffer.byteLength(JSON.stringify(value)) > 32768)
  TWELFTH_BATCH_AUDITS.find(s => s.id === id)!.input.parse(value)
  const f = fixture(e, () => CLOCK)
  try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.equal((await route(f.request(value, await headers(e, value, quote)))).status, 400); assert.deepEqual(f.counts(), { settlements: 0, executions: 0 }) } finally { f.close() }
})
test('duplicate rows and invalid ecological bounds never cause settlement', async () => {
  const id = 'ecology-observations-declared-bound-audit', e = TWELFTH_BATCH.find(e => e.id === id)!, i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  for (const value of [{ ...i, minimumCount: 11 }, { ...i, rows: [r, r] }]) {
    const f = fixture(e, () => CLOCK)
    try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.notEqual((await route(f.request(value, await headers(e, value, quote)))).status, 200); assert.equal(f.counts().settlements, 0) } finally { f.close() }
  }
})
