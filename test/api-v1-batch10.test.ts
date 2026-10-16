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
import { TENTH_BATCH, LOCAL_BATCH_PLAN } from '../lib/api-v1/batch50.ts'
import { TENTH_BATCH_AUDITS } from '../lib/api-v1/batch10-audits.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { createEndpointRouter } from '../lib/api-v1/router.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { localPaymentJournal } from '../lib/api-v1/local-journal.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { searchEndpoints } from '../lib/api-v1/discovery.ts'
import { VALUE_BANDS, amountWithinBand } from '../lib/api-v1/value-staircase.ts'
import { assertExecutionCost } from '../lib/api-v1/cost-policy.ts'
import { PRODUCTION_ENDPOINTS, ORIGINAL_PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import previous from '../content/api-v1/batches-1-9-contract-snapshot.json' with { type: 'json' }
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
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('batch10_external_network_forbidden') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0) })
type Report = { inputHash: string; chargedAmount: string; resultHash: string; result: { findings: { code: string; recordIds: string[] }[]; metrics: { key: string; recordId: string; value: string }[]; domainValidationEstablished: false; authoritativeSourcesConsulted: false } }
const inspect = (id: string, i: unknown) => TENTH_BATCH_AUDITS.find(s => s.id === id)!.run(i)
const sample = (id: string) => structuredClone(TENTH_BATCH_AUDITS.find(s => s.id === id)!.sample)
async function headers(e: typeof TENTH_BATCH[number], value: unknown, quote: ReturnType<typeof decodeChallenge>, clock = CLOCK) {
  // Independent literal input-binding construction, not the SDK nonce helper.
  const secret = '09'.repeat(32), inputHash = hash(value)
  const nonce = '0x' + hash({ version: 'maha-api-v1/1', productId: e.id, inputHash, recoverySecret: secret }).slice(7)
  const typed = buildTypedData(quote.accepts[0], account.address)
  typed.message = { from: account.address, to: quote.accepts[0].payTo, value: BigInt(e.amount), validAfter: BigInt(clock / 1000 - 600), validBefore: BigInt(clock / 1000 + 59), nonce }
  const signature = await account.signTypedData(typed as Parameters<typeof account.signTypedData>[0])
  return { 'Content-Type': 'application/json', 'X-Maha-Input-Hash': inputHash, 'X-Maha-Recovery-Secret': secret, 'PAYMENT-SIGNATURE': encodePaymentSignature(quote.accepts[0], typed.message, signature, quote) }
}
function fixture(e: typeof TENTH_BATCH[number], now: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'maha-batch10-'))
  let journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }), settlements = 0, executions = 0
  const h = handlerFor(e.id, e.amount)!
  const route = () => with402Payment(e, { ...h, execute: async i => { executions++; return h.execute(i) } }, { environment: env, now, store: journal.store,
    facilitator: { verify: async () => ({ ok: true, payer: account.address }), settle: async () => { settlements++; return { ok: true, payer: account.address, transaction: TX } } }, confirm: async () => true })
  return { h, route, request: (i: unknown, headers: Record<string, string> = {}) => new Request('https://www.mahastrategies.com' + e.path, { method: 'POST', headers, body: JSON.stringify(i) }),
    restart: () => { journal.close(); journal = localPaymentJournal(join(dir, 'payments.sqlite'), { environment: env, now }) },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }) }, counts: () => ({ settlements, executions }) }
}
test('450 earlier contracts, 1000 unique prices and the production release artifact remain unchanged', () => {
  assert.equal(previous.implemented.length, 450); assert.equal(previous.prices.length, 1000)
  for (const r of previous.implemented) assertEarlierLocalContract(ENDPOINTS.find(e => e.id === r.id)!, r)
  for (const r of previous.prices) { const e = ENDPOINTS.find(e => e.id === r.id)!; assert.equal(e.amount, r.amount); assert.equal(e.pricing?.tier, r.tier) }
  assert.equal(hash(JSON.parse(readFileSync('content/api-v1/production-release-296.json', 'utf8'))), previous.productionReleaseDigest)
  assert.equal(ORIGINAL_PRODUCTION_ENDPOINTS.length, 296)
})
test('batch10 is the next 50 unimplemented recipes, without recounting a prior package crosswalk', () => {
  const done = new Set(previous.implemented.map(e => e.id))
  const candidates = previous.prices.filter(e => /^(license-records|package-manifests|quantum-circuit-records|quantum-calibrations)-/.test(e.id) && !done.has(e.id)).slice(0, 50)
  assert.deepEqual(TENTH_BATCH.map(e => e.id), candidates.map(e => e.id))
  assert.equal(TENTH_BATCH.length, 50); assert.equal(REGISTRY_SUMMARY.localImplemented, 1000)
  assert.equal(LOCAL_BATCH_PLAN.implemented, 1000); assert.equal(LOCAL_BATCH_PLAN.remaining.length, 0)
  assert.equal(new Set(ENDPOINTS.map(e => e.amount)).size, 1000)
  for (const e of TENTH_BATCH) {
    assert.equal(e.productionApproved, false); assert.equal(e.execution_cost?.mode, 'local-cpu-wasm'); assert.equal(e.execution_cost.liveModelSpendApproved, false)
    assert.equal(e.execution_cost.maximum_external_cost_usdc, null); assertExecutionCost(e.amount, e.execution_cost)
    assert.ok(amountWithinBand(e.amount, e.pricing!.tier)); assert.equal(e.pricing!.label, VALUE_BANDS[e.pricing!.tier].name)
    assert.equal(e.schema_status, 'validated-local'); assert.equal(e.sourceReview, 'not-applicable')
    const result = searchEndpoints({ q: e.id, domain: e.domain, limit: 10 }, { local: true })
    assert.ok(result.matches.some(m => m.id === e.id && !m.paymentEnabled))
  }
  assert.equal(searchEndpoints({}, { local: true }).totalMatches, 1000); assert.equal(searchEndpoints({}).totalMatches, PRODUCTION_ENDPOINTS.length)
})
for (const spec of TENTH_BATCH_AUDITS) {
  const e = TENTH_BATCH.find(e => e.id === spec.id)!
  test('batch10 literal positive/adverse fixtures and independent schemas: ' + e.id, async () => {
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
  test('batch10 independent purchase, invalid input, restart recovery, expiry and hosted gate: ' + e.id, async () => {
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
  test('batch10 buyer adapter persists before signing submission and recovers lost response once: ' + e.id, async () => {
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
  test('batch10 registry router honors the reviewed production projection: ' + e.id, async () => {
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
test('batch10 executable import closure is CPU-only and has no hosted database, upstream API or model capability', () => {
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
  }; visit(resolve('lib/api-v1/batch10-audits.ts')); assert.ok(visited.size >= 6)
})

test('circuit operand upper bound, arity, repeated operands and duplicate parameter names are independent failures', () => {
  const id = 'quantum-circuit-records-reference-integrity-map', i = sample(id), op = (i.operations as Record<string, unknown>[])[0]
  const last = inspect(id, { ...i, operations: [{ ...op, qubits: [1] }] }); assert.deepEqual(last.findings, [])
  assert.deepEqual(inspect(id, { ...i, operations: [{ ...op, qubits: [2] }] }).findings.map(f => f.code), ['qcir-operand-outside-register'])
  const duplicate = inspect(id, { ...i, gates: [{ id: 'rotation', arity: 2 }], operations: [{ ...op, qubits: [0, 0] }] })
  assert.deepEqual(duplicate.findings.map(f => f.code), ['qcir-duplicate-operand']); assert.equal(duplicate.metrics[0].value, '0')
  assert.deepEqual(inspect(id, { ...i, operations: [{ ...op, gateRef: 'unavailable' }] }).findings.map(f => f.code), ['qcir-gate-reference-missing'])
  assert.deepEqual(inspect(id, { ...i, operations: [{ ...op, parameters: [{ parameterRef: 'angle', value: 1, unit: 'radians' }, { parameterRef: 'angle', value: 2, unit: 'radians' }] }] }).findings.map(f => f.code), ['qcir-duplicate-parameter'])
})
test('coupling direction is not reversed and ambiguous support does not become approval', () => {
  const id = 'quantum-circuit-records-condition-coverage-map', i = sample(id), check = (i.checks as Record<string, unknown>[])[0]
  assert.equal(inspect(id, { ...i, checks: [{ ...check, qubits: [1, 0] }] }).metrics[0].value, '0')
  for (const checks of [[], [{ ...check, state: 'unknown' }], [check, { ...check, id: 's2' }], [check, { ...check, id: 's2', state: 'unsupported' }]]) {
    // This contract requires at least one declaration; absent-all is rejected at input.
    if (!checks.length) { assert.throws(() => inspect(id, { ...i, checks })); continue }
    assert.deepEqual(inspect(id, { ...i, checks }).findings.map(f => f.code), ['qcir-target-support-not-established'])
  }
})
test('circuit export parity preserves ordered operands and instruction sequence, not physical equivalence', () => {
  const id = 'quantum-circuit-records-export-semantic-parity', i = sample(id), op = (i.before as Record<string, unknown>[])[0], second = { ...op, id: 'op2' }
  assert.deepEqual(inspect(id, { ...i, before: [op, second], after: [second, op] }).findings.map(f => f.code), ['qcir-ordered-export-difference'])
  assert.deepEqual(inspect(id, { ...i, before: [{ ...op, gateRef: 'cx', qubits: [0, 1], parameters: [] }], after: [{ ...op, gateRef: 'cx', qubits: [1, 0], parameters: [] }] }).findings.map(f => f.code), ['qcir-ordered-export-difference'])
})
test('circuit insertion differs from reordering surviving instructions', () => {
  const id = 'quantum-circuit-records-record-sequence-diff', i = sample(id), op = (i.before as Record<string, unknown>[])[0], second = { ...op, id: 'op2' }, added = { ...op, id: 'new' }
  assert.deepEqual(inspect(id, { ...i, before: [op, second], after: [op, added, second] }).findings.map(f => f.code), ['qcir-operation-added'])
  assert.deepEqual(inspect(id, { ...i, before: [op, second], after: [second, added, op] }).findings.map(f => f.code), ['qcir-operation-added', 'qcir-shared-operation-order-changed'])
})
test('circuit count ceilings are inclusive and supplied operation count is reconciled', () => {
  const id = 'quantum-circuit-records-declared-bound-audit', i = sample(id)
  assert.deepEqual(inspect(id, { ...i, maximumDepth: 1, maximumOperations: 1 }).findings, [])
  assert.deepEqual(inspect(id, { ...i, declaredOperations: 0 }).findings.map(f => f.code), ['qcir-declared-operation-count-mismatch'])
  assert.deepEqual(inspect(id, { ...i, declaredDepth: 11 }).findings.map(f => f.code), ['qcir-depth-ceiling-exceeded'])
})
test('circuit transformation can change backend but parent pins, cycles and duplicate edges remain enforced', () => {
  const id = 'quantum-circuit-records-provenance-edge-audit', i = sample(id), nodes = i.nodes as Record<string, unknown>[], edges = i.edges as Record<string, unknown>[]
  assert.deepEqual(inspect(id, { ...i, nodes: [{ ...nodes[0], backendRef: 'destination' }, nodes[1]] }).findings, [])
  assert.equal(inspect(id, { ...i, edges: [{ ...edges[0], parentBackendRef: 'wrong-parent' }] }).metrics[0].value, '0')
  assert.equal(inspect(id, { ...i, edges: [edges[0], { ...edges[0], id: 'e2' }] }).findings.filter(f => f.code === 'qcir-duplicate-lineage-edge').length, 2)
  assert.equal(inspect(id, { ...i, edges: [edges[0], { ...edges[0], id: 'e2', childId: 'parent', parentId: 'circuit1' }] }).findings.filter(f => f.code === 'qcir-lineage-cycle').length, 2)
})
test('circuit register or scope conflicts do not masquerade as exact duplicate content', () => {
  const id = 'quantum-circuit-records-duplicate-record-identities', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  for (const delta of [{ qubitCount: 3 }, { scopeRef: 'other-scope' }]) assert.deepEqual(inspect(id, { ...i, rows: [r, { ...r, id: 'r2', ...delta }] }).findings.map(f => f.code), ['qcir-frame-conflict'])
  assert.deepEqual(inspect(id, { ...i, rows: [r, { ...r, id: 'r2', circuitRevision: 'sha256:' + 'b'.repeat(64) }] }).findings, [])
})
test('calibration freshness equality, unknown expiry and future capture are kept separate', () => {
  const id = 'quantum-calibrations-timestamp-order-audit', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, rows: [{ ...r, validUntil: null }] }).findings.map(f => f.code), ['qcal-expiry-undeclared'])
  const assessed = new Date(Date.parse(r.capturedAt as string) + 86400000).toISOString()
  assert.deepEqual(inspect(id, { ...i, assessedAt: assessed }).findings, [], 'exact max age is inclusive while still before declared expiry')
  assert.deepEqual(inspect(id, { ...i, assessedAt: new Date(Date.parse(assessed) + 1).toISOString() }).findings.map(f => f.code), ['qcal-maximum-age-exceeded'])
  assert.ok(inspect(id, { ...i, rows: [{ ...r, capturedAt: r.validUntil }] }).findings.some(f => f.code === 'qcal-capture-from-future'))
})
test('calibration units are checked by quantity and exact backend/run/ordered-qubit frame', () => {
  const id = 'quantum-calibrations-unit-label-consistency', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, measurements: [r, { ...r, id: 'm2', unit: 'percent' }] }).findings.map(f => f.code), ['qcal-metric-unit-conflict'])
  assert.deepEqual(inspect(id, { ...i, measurements: [r, { ...r, id: 'm2', unit: 'percent', runRef: 'run2' }] }).findings, [])
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, qubits: [0, 0] }] }).findings.map(f => f.code), ['qcal-duplicate-measurement-qubit'])
})
test('calibration support cannot borrow a measurement from another backend or revision', () => {
  const id = 'quantum-calibrations-condition-coverage-map', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0]
  for (const change of [{ backendRef: 'backend2' }, { runRef: 'run2' }, { revision: 'sha256:' + 'b'.repeat(64) }]) {
    const result = inspect(id, { ...i, measurements: [{ ...r, ...change }] }); assert.equal(result.metrics[0].value, '0')
    assert.deepEqual(result.findings.map(f => f.code), ['qcal-required-measurement-not-established', 'qcal-measurement-frame-mismatch'])
  }
  assert.equal(inspect(id, { ...i, measurements: [r, { ...r, id: 'm2' }] }).metrics[0].value, '0')
})
test('unknown calibration values are not zero and incompatible units are never converted implicitly', () => {
  const id = 'quantum-calibrations-declared-bound-audit', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0], b = (i.bounds as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, value: null }] }).findings.map(f => f.code), ['qcal-value-unknown'])
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, value: 0 }] }).findings, [])
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, unit: 'percent', value: 1 }] }).findings.map(f => f.code), ['qcal-bound-quantity-unit-mismatch'])
  assert.throws(() => inspect(id, { ...i, bounds: [{ ...b, minimum: 1 }] }), /reversed_calibration_bounds/)
})
test('calibration configuration checks zero-based operand boundaries and pinned register sizes', () => {
  const id = 'quantum-calibrations-reference-integrity-map', i = sample(id), r = (i.measurements as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, qubits: [1] }] }).findings, [])
  assert.deepEqual(inspect(id, { ...i, measurements: [{ ...r, qubits: [2] }] }).findings.map(f => f.code), ['qcal-measurement-qubit-outside-register'])
  const prov = 'quantum-calibrations-provenance-edge-audit', p = sample(prov), c = (p.configurations as Record<string, unknown>[])[0]
  assert.deepEqual(inspect(prov, { ...p, configurations: [{ ...c, qubitCount: 3 }] }).findings.map(f => f.code), ['qcal-provenance-pin-mismatch'])
})
test('package manifest lineage does not accept another package as an implicit dependency edge', () => {
  const id = 'package-manifests-reference-integrity-map', i = sample(id), r = (i.rows as Record<string, unknown>[])[0]
  const rows = [r, { ...r, id: 'child', packageRef: 'other-package', parentId: r.id }]
  assert.deepEqual(inspect(id, { ...i, rows }).findings.map(f => f.code), ['package-manifests-parent-frame-mismatch'])
})
test('license output-schema direction and strictness are metadata guarantees, not rights grants', () => {
  const id = 'license-records-schema-directionality', i = sample(id), r = (i.before as Record<string, unknown>[])[0], extra = { ...r, name: 'extra' }
  assert.deepEqual(inspect(id, { ...i, after: [r, extra], consumerAllowsExtraFields: true }).findings, [])
  assert.deepEqual(inspect(id, { ...i, after: [r, extra], consumerAllowsExtraFields: false }).findings.map(f => f.code), ['license-records-schema-extra-field'])
})
test('maximally repeated circuit errors fit the 65KB retained-response ceiling', async () => {
  const id = 'quantum-circuit-records-reference-integrity-map', e = TENTH_BATCH.find(e => e.id === id)!, i = sample(id), r = (i.operations as Record<string, unknown>[])[0]
  const value = { ...i, qubitCount: 1, operations: Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'o' + 'x'.repeat(76) + String(n).padStart(3, '0'), gateRef: 'unknown', qubits: [3, 3, 3, 3], parameters: [{ parameterRef: 'angle', value: 1, unit: 'radians' }, { parameterRef: 'angle', value: 2, unit: 'radians' }] })) }
  const report = await handlerFor(id, e.amount)!.execute(value) as Report
  assert.equal(report.result.findings.length, 128); assert.ok(Buffer.byteLength(JSON.stringify(report)) < 65000)
})
test('oversized combined calibration projections stop before work or settlement', async () => {
  const id = 'quantum-calibrations-record-sequence-diff', e = TENTH_BATCH.find(e => e.id === id)!, i = sample(id), r = (i.before as Record<string, unknown>[])[0]
  const before = Array.from({ length: 32 }, (_, n) => ({ ...r, id: 'r' + 'x'.repeat(76) + String(n).padStart(3, '0'), backendRef: 'b'.repeat(80), calibrationRef: 'c'.repeat(80), scopeRef: 's'.repeat(80) }))
  const value = { ...i, before, after: structuredClone(before) }; assert.ok(Buffer.byteLength(JSON.stringify(value)) > 32768)
  TENTH_BATCH_AUDITS.find(s => s.id === id)!.input.parse(value)
  const f = fixture(e, () => CLOCK)
  try { const route = f.route(), quote = decodeChallenge((await route(f.request(value))).headers.get('PAYMENT-REQUIRED')!); assert.equal((await route(f.request(value, await headers(e, value, quote)))).status, 400); assert.deepEqual(f.counts(), { settlements: 0, executions: 0 }) } finally { f.close() }
})
