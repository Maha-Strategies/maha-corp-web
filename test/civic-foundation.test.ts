import assert from 'node:assert/strict'
import test from 'node:test'
import { civicDigest } from '../lib/civic/receipt.ts'
import { computePolicyDigest, INITIAL_POLICY_GRAPH, INITIAL_POLICY_REGISTRY, policyNodeSchema, simulatePolicy } from '../lib/civic/policy-graph.ts'
import { appendLedger, CIVIC_BASE, createLedgerReceipt, formatUsdc, GENESIS_DIGEST, prepareLedgerAnchor, verifyLedger, verifyLedgerAnchor, verifyUsdcTransfer, type CivicEvent, type CivicRpcReader } from '../lib/civic/transparency-ledger.ts'
import { answerTownhall } from '../lib/civic/townhall-agent.ts'
import { auditSpending, parseSpendingData, type SpendingRecord } from '../lib/civic/spending-audit.ts'
import { POST as simulateRoute } from '../app/api/civic/simulate/route.ts'
import { POST as townhallRoute } from '../app/api/civic/townhall/route.ts'
import { POST as auditRoute } from '../app/api/civic/audit/route.ts'
import { POST as ledgerRoute } from '../app/api/civic/ledger/route.ts'
import { POST as chainRoute } from '../app/api/civic/verify-chain/route.ts'

const node = INITIAL_POLICY_REGISTRY[0]
const genesis = { ledgerId: 'maha-civic', sequence: 0, digest: GENESIS_DIGEST }
const source = { citation: 'Synthetic test fixture', url: 'https://example.test/fixture' }
const event = (id: string): CivicEvent => ({ id, kind: 'decision', occurredAt: '2026-10-04T00:00:00Z', description: 'Publish a bounded scenario', evidence: [source], rationale: 'Record the supplied assumptions before review.' })
const from = '0x' + '1'.repeat(40), to = '0x' + '2'.repeat(40), hash = '0x' + 'a'.repeat(64), blockHash = '0x' + 'b'.repeat(64)
const transfer: CivicEvent = { id: 'contribution-1', occurredAt: '2026-10-04T00:00:00Z', description: 'Synthetic contribution', evidence: [source], kind: 'contribution', amountBaseUnits: '1000001',
  transfer: { network: 'eip155:8453', asset: CIVIC_BASE.usdc, from, to, transactionHash: hash, logIndex: 0 } }
const post = (body: unknown) => new Request('https://example.test/api/civic', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('policy receipt validates input and canonicalizes key order without rewriting arrays', () => {
  assert.equal(computePolicyDigest(node), computePolicyDigest(Object.fromEntries(Object.entries(node).reverse()) as typeof node))
  assert.equal(civicDigest({ a: 1, b: 2 }), civicDigest({ b: 2, a: 1 }))
  assert.notEqual(computePolicyDigest(node), computePolicyDigest({ ...node, evidenceBasis: node.evidenceBasis + ' Revised.' }))
  assert.ok(Object.isFrozen(node.economicVariables[0]))
  assert.throws(() => policyNodeSchema.parse({ ...node, hallucinated: true }))
  assert.throws(() => policyNodeSchema.parse({ ...node, economicVariables: [{ ...node.economicVariables[0], baselineValue: Infinity }] }))
  assert.throws(() => policyNodeSchema.parse({ ...node, economicVariables: [{ ...node.economicVariables[0], confidenceInterval: [-30, -45] }] }))
  assert.throws(() => policyNodeSchema.parse({ ...node, primaryLegislativeSources: [{ citation: 'Unsafe link', url: 'javascript:alert(1)' }] }))
})

test('simulation computes bounded linear scenarios and admits unsupported confidence', () => {
  const baseline = simulatePolicy({ policyId: node.id, adoptionRate: 0 })
  assert.equal(baseline.variables[0].projectedValue, 100)
  assert.deepEqual(baseline.variables[0].scenarioBounds, [100, 100])
  const half = simulatePolicy({ policyId: node.id, adoptionRate: .5, baselineOverrides: { [node.economicVariables[0].name]: 80 } })
  assert.equal(half.variables[0].projectedValue, 60.75)
  assert.deepEqual(half.variables[0].scenarioBounds, [57.5, 65])
  assert.equal(half.evidenceStatus, 'illustrative-unvalidated')
  assert.match(half.evidenceBasis, /not measured/)
  assert.ok(Object.isFrozen(half.variables))
  const { digest, ...payload } = half; assert.equal(digest, civicDigest(payload))
  assert.throws(() => simulatePolicy({ policyId: node.id, adoptionRate: 1.01 }))
  assert.throws(() => simulatePolicy({ policyId: 'unknown', adoptionRate: 1 }))
  assert.throws(() => simulatePolicy({ policyId: node.id, adoptionRate: 1, baselineOverrides: { unknown: 5 } }))
})

test('graph resolves prerequisites, rejects cycles, duplicates and dangling edges', () => {
  const prerequisite = { ...node, id: 'prerequisite' }
  const graph = { nodes: [node, prerequisite], edges: [{ from: node.id, to: prerequisite.id, relationship: 'depends-on' as const, rationale: 'Prerequisite for review' }] }
  assert.deepEqual(simulatePolicy({ policyId: node.id, adoptionRate: 1 }, graph).executionOrder, ['prerequisite', node.id])
  assert.throws(() => simulatePolicy({ policyId: node.id, adoptionRate: 1 }, { ...graph, edges: [...graph.edges, { ...graph.edges[0], from: prerequisite.id, to: node.id }] }))
  assert.throws(() => simulatePolicy({ policyId: node.id, adoptionRate: 1 }, { ...graph, nodes: [node, node] }))
  assert.throws(() => simulatePolicy({ policyId: node.id, adoptionRate: 1 }, { ...graph, edges: [{ ...graph.edges[0], to: 'missing' }] }))
  assert.equal(INITIAL_POLICY_GRAPH.edges.length, 0)
})

test('ledger chains snapshots and detects tampering, reorder, truncation and replay', () => {
  const one = appendLedger([], event('one')), two = appendLedger(one, event('two'))
  assert.equal(one.length, 1); assert.equal(two.length, 2)
  assert.ok(Object.isFrozen(two[0].event.evidence))
  const head = { ledgerId: 'maha-civic', sequence: 2, digest: two[1].digest }
  assert.deepEqual(verifyLedger(two, genesis, head), head)
  assert.deepEqual(verifyLedger([two[1]], { ledgerId: 'maha-civic', sequence: 1, digest: one[0].digest }, head), head)
  assert.throws(() => verifyLedger([two[1], two[0]], genesis))
  assert.throws(() => verifyLedger(one, genesis, head), /expected head/)
  assert.throws(() => verifyLedger([{ ...two[0], event: { ...two[0].event, description: 'Tampered description' } }], genesis), /digest mismatch/)
  assert.throws(() => appendLedger(one, event('one')), /Duplicate/)
  assert.throws(() => appendLedger(appendLedger([], transfer), { ...transfer, id: 'replayed' }), /Duplicate USDC/)
  assert.equal(formatUsdc('1000001'), '1.000001')
  assert.throws(() => formatUsdc('1.2'))
  assert.throws(() => createLedgerReceipt({ ...event('bad'), secrets: 'bad' } as unknown as CivicEvent, genesis))
})

const topic = (address: string) => `0x${address.slice(2).padStart(64, '0')}`
const receipt = () => ({ transactionHash: hash, status: '0x1', blockNumber: '0xa', blockHash,
  logs: [{ address: CIVIC_BASE.usdc, topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', topic(from), topic(to)], data: '0x' + BigInt('1000001').toString(16).padStart(64, '0'), logIndex: '0x0' }] })
const checkpoint = { ledgerId: 'maha-civic', sequence: 1, digest: 'f'.repeat(64) }
function mockRpc(overrides: Partial<Record<string, unknown>> = {}): CivicRpcReader {
  return async (method, params) => {
    if (method in overrides) return overrides[method]
    if (method === 'eth_chainId') return '0x2105'
    if (method === 'eth_getTransactionReceipt') return receipt()
    if (method === 'eth_getBlockByNumber') return { number: params[0] === 'finalized' ? '0xb' : '0xa', hash: blockHash }
    if (method === 'eth_getTransactionByHash') return { hash, from, to: from, input: prepareLedgerAnchor(checkpoint, from).data, value: '0x0', blockHash }
    throw new Error('Unexpected RPC method')
  }
}

test('Base anchor verification binds checkpoint, publisher, chain and finalized canonical block', async () => {
  const prepared = prepareLedgerAnchor(checkpoint, from)
  assert.equal(prepared.value, '0x0'); assert.equal(prepared.from, prepared.to)
  assert.equal((await verifyLedgerAnchor(checkpoint, from, hash, mockRpc())).status, 'confirmed-finalized')
  assert.equal((await verifyLedgerAnchor({ ...checkpoint, digest: 'e'.repeat(64) }, from, hash, mockRpc())).status, 'contradicted')
  assert.equal((await verifyLedgerAnchor(checkpoint, to, hash, mockRpc())).status, 'contradicted')
  assert.equal((await verifyLedgerAnchor(checkpoint, from, hash, mockRpc({ eth_chainId: '0x1' }))).status, 'contradicted')
  assert.equal((await verifyLedgerAnchor(checkpoint, from, hash, mockRpc({ eth_getTransactionReceipt: null }))).status, 'indeterminate')
  assert.equal((await verifyLedgerAnchor(checkpoint, from, hash, mockRpc({ eth_getBlockByNumber: { number: '0x9', hash: blockHash } }))).status, 'indeterminate')
  const rpc = mockRpc()
  const reorg: CivicRpcReader = (method, params) => method === 'eth_getBlockByNumber' && params[0] !== 'finalized' ? Promise.resolve({ number: '0xa', hash }) : rpc(method, params)
  assert.equal((await verifyLedgerAnchor(checkpoint, from, hash, reorg)).status, 'contradicted')
  assert.equal((await verifyLedgerAnchor(checkpoint, from, hash, async () => { throw new Error('offline') })).status, 'indeterminate')
})

test('USDC checks exact log, amount, token, addresses, receipt status and removed flag', async () => {
  assert.equal((await verifyUsdcTransfer(transfer, mockRpc())).status, 'confirmed-finalized')
  const changed = structuredClone(transfer)
  changed.amountBaseUnits = '1000000'
  assert.equal((await verifyUsdcTransfer(changed, mockRpc())).status, 'contradicted')
  for (const alteration of [{ address: from }, { topics: [hash, topic(from), topic(to)] }, { topics: [receipt().logs[0].topics[0], topic(to), topic(from)] }, { removed: true }, { logIndex: '0x1' }]) {
    const r = receipt(); Object.assign(r.logs[0], alteration)
    assert.equal((await verifyUsdcTransfer(transfer, mockRpc({ eth_getTransactionReceipt: r }))).status, 'contradicted')
  }
  assert.equal((await verifyUsdcTransfer(transfer, mockRpc({ eth_getTransactionReceipt: { ...receipt(), status: '0x0' } }))).status, 'contradicted')
  assert.equal((await verifyUsdcTransfer(transfer, mockRpc({ eth_getTransactionReceipt: {} }))).status, 'indeterminate')
})

test('town hall discloses evidence limits and never converts an assumption to established law', async () => {
  const savings = await answerTownhall({ policyId: node.id, question: 'What evidence supports the projected savings?' })
  assert.equal(savings.topic, 'simulation'); assert.match(savings.passages[0].text, /No empirical calibration/)
  assert.equal(savings.citations[0].sourceIntegrity, 'digest-supplied-not-independently-verified')
  const law = await answerTownhall({ policyId: node.id, question: 'Is the proposal current law?' })
  assert.match(law.passages[0].text, /cannot establish/)
  const unknown = await answerTownhall({ policyId: node.id, question: 'Who is corrupt and who should I vote for?' })
  assert.equal(unknown.status, 'insufficient-evidence'); assert.equal(unknown.passages.length, 0)
  const { digest, ...payload } = savings; assert.equal(digest, civicDigest(payload))
})

test('AI interpreter cannot inject prose, citations or unsupported labels; outages fall back visibly', async () => {
  const input = { policyId: node.id, question: 'Describe the proposal.' }
  const classified = await answerTownhall(input, { interpret: async () => 'proposal' })
  assert.equal(classified.mode, 'ai-classified-source-retrieval'); assert.equal(classified.passages[0].text, node.summary)
  const bad = await answerTownhall(input, { interpret: async () => 'invented law and source' as 'proposal' })
  assert.equal(bad.mode, 'source-retrieval-ai-unavailable')
  assert.equal(bad.passages[0].text, node.summary)
})

const row = (id: string, contractor: string, amount: string, other: Partial<SpendingRecord> = {}): SpendingRecord => ({ id, contractor, amountUsdCents: amount, agency: 'Agency', program: 'Software', fiscalYear: 2026, budgetUsdCents: '1500000000', competition: 'competitive', source, ...other })
const scan = (rows: SpendingRecord[]) => auditSpending({ format: 'json', data: JSON.stringify(rows) })

test('spending parser preserves quoted commas, escaped quotes and newlines and rejects bad data', () => {
  const header = 'id,agency,contractor,program,fiscalYear,amountUsdCents,budgetUsdCents,competition,sourceCitation,sourceUrl\r\n'
  const parsed = parseSpendingData('csv', header + 'award-1,Agency,"A, ""B""",Software,2026,100,,unknown,"Source\nfixture",https://example.test/fixture\r\n')
  assert.equal(parsed[0].contractor, 'A, "B"'); assert.equal(parsed[0].source.citation, 'Source\nfixture')
  assert.throws(() => parseSpendingData('csv', header + '"unterminated'))
  assert.throws(() => parseSpendingData('csv', header + '"id"x,Agency,A,Software,2026,100,,unknown,Test,https://example.test'))
  assert.throws(() => scan([row('invalid', 'A', '1.50')]))
  assert.throws(() => scan([row('invalid', 'A', '100', { source: { ...source, url: 'file:///etc/passwd' } })]))
})

test('auditor binds thresholds, uses exact cents and emits sourced review leads only', () => {
  const report = scan([row('one', 'A', '1200000000', { competition: 'noncompetitive' }), row('two', 'A', '400000000'), row('three', 'B', '200000000')])
  assert.equal(report.totalReportedUsdCents, '1800000000')
  assert.deepEqual(report.findings.map(f => f.rule), ['large-noncompetitive-award', 'budget-exceedance', 'contractor-concentration'])
  assert.ok(report.findings.every(f => f.status === 'review-required' && f.sources.length))
  assert.match(report.limitations[0], /not allegations/)
  const { digest, ...payload } = report; assert.equal(digest, civicDigest(payload))
  assert.equal(scan([row('one', 'A', '9007199254740993')]).totalReportedUsdCents, '9007199254740993')
})

test('duplicates are excluded, inconsistent caps withhold budget comparisons and groups do not mix', () => {
  const report = scan([row('duplicate', 'A', '100'), row('duplicate', 'A', '100'), row('unique', 'B', '50')])
  assert.equal(report.totalReportedUsdCents, '50'); assert.deepEqual(report.excludedDuplicateIds, ['duplicate'])
  const inconsistent = scan([row('one', 'A', '100', { budgetUsdCents: '1' }), row('two', 'B', '100', { budgetUsdCents: '2' })])
  assert.equal(inconsistent.findings[0].rule, 'inconsistent-budget'); assert.ok(!inconsistent.findings.some(f => f.rule === 'budget-exceedance'))
  const separate = scan([row('one', 'A', '100', { budgetUsdCents: '100' }), row('two', 'B', '100', { program: 'Another', budgetUsdCents: '100' })])
  assert.equal(separate.findings.length, 0)
})

test('HTTP routes serve receipts, reject malformed/oversized inputs and verify downloaded chains', async () => {
  const sim = await simulateRoute(post({ policyId: node.id, adoptionRate: .5 })); assert.equal(sim.status, 200); assert.match((await sim.json()).digest, /^[a-f0-9]{64}$/)
  assert.equal(sim.headers.get('cache-control'), 'no-store')
  assert.equal((await simulateRoute(post({ policyId: node.id, adoptionRate: -1 }))).status, 400)
  assert.equal((await simulateRoute(new Request('https://example.test', { method: 'POST', body: '{}' }))).status, 415)
  assert.equal((await simulateRoute(post({ junk: 'x'.repeat(9000) }))).status, 413)
  assert.equal((await simulateRoute(post({ junk: '字'.repeat(3000) }))).status, 413)
  assert.equal((await townhallRoute(post({ policyId: node.id, question: 'What are the tradeoffs?' }))).status, 200)
  assert.equal((await auditRoute(post({ format: 'json', data: JSON.stringify([row('one', 'A', '100')]) }))).status, 200)
  const receipts = appendLedger([], event('one')), expectedHead = { ledgerId: 'maha-civic', sequence: 1, digest: receipts[0].digest }
  assert.equal((await ledgerRoute(post({ receipts, preceding: genesis, expectedHead }))).status, 200)
  assert.equal((await ledgerRoute(post({ receipts: [], preceding: genesis, expectedHead }))).status, 400)
  assert.equal((await chainRoute(post({ kind: 'anchor', checkpoint: genesis, publisher: from, transactionHash: hash }))).status, 400)
})

test('AI route remains gated before any model call', async () => {
  const previous = process.env.CIVIC_TOWNHALL_AI_ENABLED
  process.env.CIVIC_TOWNHALL_AI_ENABLED = 'false'
  try {
    const request = post({ policyId: node.id, question: 'What is the proposal?' }); request.headers.set('x-civic-ai', 'true')
    assert.equal((await townhallRoute(request)).status, 503)
  } finally { if (previous === undefined) delete process.env.CIVIC_TOWNHALL_AI_ENABLED; else process.env.CIVIC_TOWNHALL_AI_ENABLED = previous }
})
