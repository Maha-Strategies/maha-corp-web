import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { SPECS, buildResearchContentExpansion as build } from '../lib/x402/expansion-research-content.ts'
import { schemaAccepts, type MicroSchema } from '../lib/x402/micro-schema.ts'
import { createLedgerReceipt, verifyLedger, GENESIS_DIGEST } from '../lib/civic/transparency-ledger.ts'

const sample = (id: string) => structuredClone(SPECS[id].sample)
const run = (id: string, input = sample(id)) => {
  const output = build(id, input)
  assert.ok(output)
  assert.equal(schemaAccepts(SPECS[id].resultSchema, output), true)
  assert.ok(Buffer.byteLength(JSON.stringify(output)) <= 65536)
  return output
}
const hash = (s: string | Buffer) => 'sha256:' + createHash('sha256').update(s).digest('hex')
// Independent JCS encoding for these JSON fixtures; no production digest helper.
const canonical = (v: unknown): string => {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k])).join(',') + '}'
  return JSON.stringify(v)
}
function closed(schema: MicroSchema): void {
  if (schema.oneOf) for (const child of schema.oneOf) closed(child)
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false)
    assert.ok(schema.required)
    for (const child of Object.values(schema.properties!)) closed(child)
  }
  if (schema.type === 'array') {
    assert.ok(Number.isSafeInteger(schema.maxItems))
    closed(schema.items!)
  }
}
// Try an unexpected field at every nested object in the returned JSON tree.
function poisonedObjects(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') return []
  const variants: unknown[] = []
  if (!Array.isArray(value)) variants.push({ ...value, contributorName: 'refuse-this-field' })
  for (const [key, child] of Object.entries(value)) for (const poisoned of poisonedObjects(child)) {
    const copy = structuredClone(value) as Record<string, unknown>
    copy[key] = poisoned
    variants.push(copy)
  }
  return variants
}
const expected = {
  'spatial-adjacency-check': ['29500', 'architecture'], 'experiment-plan-completeness': ['37000', 'research'],
  'partnership-milestone-review': ['61000', 'research'], 'research-opportunity-comparison': ['69000', 'research'],
  'evidence-brief-export': ['109000', 'research'], 'public-amendment-lineage': ['56000', 'public-finance'],
  'spending-variance-bridge': ['55000', 'public-finance'], 'transparency-hash-chain-verification': ['38500', 'public-finance'],
  'public-filing-amendment-resolver': ['58000', 'public-finance'], 'angular-separation-batch': ['8500', 'celestial'],
  'observing-window-planner': ['92000', 'celestial'], 'terrain-profile-arithmetic': ['65000', 'physical-ai'],
  'volcano-concept-evidence-pack': ['89000', 'books'], 'edition-locator-alignment': ['67000', 'books'],
  'manuscript-release-diff': ['83000', 'books'], 'cross-book-concept-pack': ['139000', 'books'],
}

test('16 independent product specifications, closed nested schemas and deterministic JSON samples', () => {
  assert.deepEqual(Object.keys(SPECS).sort(), Object.keys(expected).sort())
  for (const [id, [amount, category]] of Object.entries(expected)) {
    const spec = SPECS[id]
    assert.equal(spec.amount, amount); assert.equal(spec.category, category)
    assert.ok(spec.title.length > 10 && spec.description.length > 40)
    closed(spec.inputSchema); closed(spec.resultSchema)
    assert.equal(schemaAccepts(spec.inputSchema, spec.sample), true, id)
    const before = sample(id), output = run(id, before)
    assert.deepEqual(before, spec.sample, 'does not mutate caller input')
    assert.deepEqual(output, run(id))
    assert.equal(output.serviceId, id)
    for (const poisoned of poisonedObjects(output)) assert.equal(schemaAccepts(spec.resultSchema, poisoned), false, id)
    assert.equal(schemaAccepts(spec.resultSchema, { ...output, serviceId: 'wrong-service' }), false)
  }
})

test('known services fail closed on private, arbitrary fields, and poisoned nested input; unknown IDs return null', () => {
  for (const id of Object.keys(SPECS)) {
    assert.throws(() => build(id, { ...sample(id), dataClass: 'private' }), TypeError)
    assert.throws(() => build(id, { ...sample(id), contributorName: 'not-allowed' }), TypeError)
    for (const poisoned of poisonedObjects(sample(id))) assert.throws(() => build(id, poisoned as Record<string, unknown>), TypeError)
  }
  for (const id of ['unknown', '__proto__', 'constructor', 'toString', 'book-reading-pack-the-maha-principle']) assert.equal(build(id, {}), null)
})

test('request preflight refuses prototype tricks, getters, toJSON, symbols, cycles, sparse/oversized arrays and nonfinite numbers', () => {
  const id = 'spatial-adjacency-check'
  const circular: Record<string, unknown> = {}; circular.self = circular
  let executed = false
  const getter = Object.defineProperty(sample(id), 'extra', { enumerable: true, get() { executed = true; return 1 } })
  const toJSON = { ...sample(id), toJSON() { executed = true; return sample(id) } }
  const sparse = sample(id); sparse.rooms = Array(3)
  const huge = sample(id); huge.rooms = Array(129).fill('r')
  const hidden = Object.defineProperty(sample(id), 'hidden', { value: 1 })
  const symbol = { ...sample(id), [Symbol('secret')]: 1 }
  const deep: Record<string, unknown> = {}; let cursor = deep
  for (let i = 0; i < 14; i++) { const next = {}; cursor.child = next; cursor = next }
  for (const v of [circular, getter, toJSON, sparse, huge, hidden, symbol, deep, new Date(),
    JSON.parse('{"__proto__":{"polluted":true}}'), Object.create({ dataClass: 'synthetic' }),
    { ...sample(id), value: Infinity }, { ...sample(id), value: NaN }, { ...sample(id), value: BigInt(1) }])
    assert.throws(() => build(id, v as Record<string, unknown>), TypeError)
  assert.equal(executed, false)
  assert.equal(({} as Record<string, unknown>).polluted, undefined)
})

test('32 KiB UTF-8 request and 64 KiB response limits are enforced before delivery', () => {
  const brief = sample('evidence-brief-export')
  brief.plans = Array.from({ length: 16 }, (_, i) => ({ id: 'p' + i, text: 'x'.repeat(1600), sourceIds: ['s1'] }))
  brief.results = Array.from({ length: 16 }, (_, i) => ({ id: 'r' + i, text: 'x'.repeat(1600), sourceIds: ['s1'] }))
  assert.ok(Buffer.byteLength(JSON.stringify(brief)) > 32768)
  assert.throws(() => build('evidence-brief-export', brief), /32 KiB/)
  const utf8 = sample('evidence-brief-export')
  utf8.plans = Array.from({ length: 16 }, (_, i) => ({ id: 'p' + i, text: '界'.repeat(800), sourceIds: ['s1'] }))
  utf8.results = []
  assert.ok(JSON.stringify(utf8).length < 32768 && Buffer.byteLength(JSON.stringify(utf8)) > 32768)
  assert.throws(() => build('evidence-brief-export', utf8), /32 KiB/)
  const response = sample('evidence-brief-export')
  response.plans = Array.from({ length: 16 }, (_, i) => ({ id: 'p' + i, text: 'x'.repeat(1450), sourceIds: ['s1'] }))
  response.results = []
  assert.ok(Buffer.byteLength(JSON.stringify(response)) < 32768)
  assert.equal(schemaAccepts(SPECS['evidence-brief-export'].inputSchema, response), true)
  assert.throws(() => build('evidence-brief-export', response), /64 KiB/)
})

test('spatial checks distinguish contradiction, violation and unknown; topology is undirected', () => {
  const input = { dataClass: 'synthetic', rooms: ['a', 'b', 'c'], topology: [
    { from: 'a', to: 'b', adjacent: true }, { from: 'b', to: 'a', adjacent: false }, { from: 'a', to: 'c', adjacent: false }],
  requirements: [{ id: 'r1', from: 'a', to: 'b', relation: 'adjacent' },
    { id: 'r2', from: 'c', to: 'a', relation: 'adjacent' }, { id: 'r3', from: 'b', to: 'c', relation: 'separate' }] }
  assert.deepEqual(run('spatial-adjacency-check', input).checks, [
    { ...input.requirements[0], status: 'contradictory' }, { ...input.requirements[1], status: 'violated' }, { ...input.requirements[2], status: 'unknown' }])
  assert.deepEqual(run('spatial-adjacency-check', input).contradictoryPairs, ['a|b'])
  const opposite = { dataClass: 'public', rooms: ['a', 'b'], topology: [], requirements: [
    { id: 'x', from: 'a', to: 'b', relation: 'adjacent' }, { id: 'y', from: 'b', to: 'a', relation: 'separate' }] }
  assert.deepEqual(run('spatial-adjacency-check', opposite).contradictoryPairs, ['a|b'])
  assert.throws(() => build('spatial-adjacency-check', { ...input, rooms: ['a', 'a'] }))
  assert.throws(() => build('spatial-adjacency-check', { ...input, rooms: ['a', 'b'] }))
  assert.throws(() => build('spatial-adjacency-check', { ...input, topology: [{ from: 'a', to: 'a', adjacent: true }] }))
  assert.throws(() => build('spatial-adjacency-check', { ...input, topology: Array(65).fill(input.topology[0]) }))
})

test('experiment completeness counts declarations, treating null/whitespace as missing but zero as supplied', () => {
  const input = sample('experiment-plan-completeness')
  input.baseline = null; input.primaryMeasure = { name: ' ', unit: null }
  input.acceptance = { operator: 'gte', threshold: '0' }; input.stopRule = { maxTrials: null, abortCondition: ' ' }
  const output = run('experiment-plan-completeness', input)
  assert.equal(output.complete, false)
  assert.deepEqual(output.checks, [
    { component: 'baseline', status: 'missing', missingFields: ['baseline'] },
    { component: 'primaryMeasure', status: 'missing', missingFields: ['primaryMeasure.name', 'primaryMeasure.unit'] },
    { component: 'acceptance', status: 'declared', missingFields: [] },
    { component: 'stopRule', status: 'missing', missingFields: ['stopRule.maxTrials', 'stopRule.abortCondition'] }])
  assert.throws(() => build('experiment-plan-completeness', { ...input, stopRule: { maxTrials: 0, abortCondition: 'abort' } }))
  assert.throws(() => build('experiment-plan-completeness', { ...input, acceptance: { operator: 'gte', threshold: 'NaN' } }))
})

test('milestone readiness propagates missing evidence, detects cycles and is not array-order dependent', () => {
  const input = { dataClass: 'synthetic', evidence: [{ id: 'e1', reference: 'Synthetic public record' }, { id: 'e2', reference: null }], milestones: [
    { id: 'last', dependencies: ['first'], requiredEvidence: ['e1'], status: 'claimed-complete' },
    { id: 'first', dependencies: [], requiredEvidence: ['e2', 'unknown-evidence'], status: 'claimed-complete' },
    { id: 'x', dependencies: ['y'], requiredEvidence: [], status: 'claimed-complete' },
    { id: 'y', dependencies: ['x'], requiredEvidence: [], status: 'claimed-complete' }] }
  const output = run('partnership-milestone-review', input)
  assert.deepEqual(output.cycleIds, ['x', 'y'])
  assert.deepEqual(output.milestones, [
    { id: 'last', status: 'blocked', missingEvidenceIds: [], unmetDependencyIds: ['first'] },
    { id: 'first', status: 'incomplete', missingEvidenceIds: ['e2', 'unknown-evidence'], unmetDependencyIds: [] },
    { id: 'x', status: 'blocked', missingEvidenceIds: [], unmetDependencyIds: ['y'] },
    { id: 'y', status: 'blocked', missingEvidenceIds: [], unmetDependencyIds: ['x'] }])
  const ready = { ...input, milestones: input.milestones.slice(0, 2).map(m => ({ ...m, requiredEvidence: ['e1'] })) }
  assert.deepEqual((run('partnership-milestone-review', ready).milestones as { status: string }[]).map(m => m.status), ['declared-complete', 'declared-complete'])
  assert.throws(() => build('partnership-milestone-review', { ...input, milestones: [{ ...input.milestones[0], dependencies: ['absent'] }] }))
})

test('opportunity comparison has independently computed weighted ranks, ties and deterministic sensitivity', () => {
  const output = run('research-opportunity-comparison')
  assert.deepEqual(output.ranking, [
    { optionId: 'a', weightedSum: 2400, totalWeight: 3, score: '800.000000', rank: 1 },
    { optionId: 'b', weightedSum: 2300, totalWeight: 3, score: '766.666667', rank: 2 }])
  assert.deepEqual(output.sensitivity, [
    { criterionId: 'benefit', adjustment: 'minus', effectiveWeight: 1, totalWeight: 2, winnerIds: ['b'] },
    { criterionId: 'benefit', adjustment: 'plus', effectiveWeight: 3, totalWeight: 4, winnerIds: ['a'] },
    { criterionId: 'cost', adjustment: 'minus', effectiveWeight: 0, totalWeight: 2, winnerIds: ['a'] },
    { criterionId: 'cost', adjustment: 'plus', effectiveWeight: 2, totalWeight: 4, winnerIds: ['b'] }])
  const ties = { dataClass: 'synthetic', criteria: [{ id: 'c', weight: 1, direction: 'maximize' }],
    options: [{ id: 'z', scores: [{ criterionId: 'c', value: 5 }] }, { id: 'a', scores: [{ criterionId: 'c', value: 5 }] }], sensitivityDelta: 100 }
  assert.deepEqual(run('research-opportunity-comparison', ties).winnerIds, ['a', 'z'])
  assert.equal((run('research-opportunity-comparison', ties).sensitivity as { effectiveWeight: number }[])[0].effectiveWeight, 1)
  assert.throws(() => build('research-opportunity-comparison', { ...ties, options: [{ id: 'z', scores: [{ criterionId: 'unknown', value: 5 }] }] }))
})

test('brief exports preserve exact source-bound JSON but escape Markdown HTML, images, links and code', () => {
  const input = sample('evidence-brief-export')
  const evil = '<script>alert(1)</script> ![image](https://example.test/) `code` [link](javascript:alert(1))'
  input.title = '<img onerror=alert(1)>'
  input.plans = [{ id: 'p1', text: evil, sourceIds: ['s1'] }]
  const output = run('evidence-brief-export', input), markdown = output.markdown as string
  assert.ok(!markdown.includes('<script>') && !markdown.includes('<img'))
  assert.ok(markdown.includes('&lt;script&gt;') && markdown.includes('\\!\\[image\\]\\(') && markdown.includes('\\`code\\`'))
  assert.deepEqual(JSON.parse(output.json as string), output.document)
  assert.equal(output.jsonSha256, hash(output.json as string))
  assert.equal((JSON.parse(output.json as string).plans[0]).text, evil)
  assert.throws(() => build('evidence-brief-export', { ...input, plans: [{ id: 'p1', text: 'unbound', sourceIds: ['missing'] }] }))
  assert.throws(() => build('evidence-brief-export', { ...input, protectedDatasetIncluded: true }))
  assert.throws(() => build('evidence-brief-export', { ...input, sources: [{ id: 's1', citation: 'x', locator: 'x', digest: 'sha256:' + '1'.repeat(64), text: 'protected source' }] }))
})

test('public amendment lineage detects date, cycle, ancestor before-value and dangling-parent contradictions', () => {
  const input = { dataClass: 'public', publicNonpersonalRecords: true, contractId: 'contract', revisions: [
    { id: 'v3', parentId: 'v2', effectiveDate: '2026-03-01', changes: [{ field: 'scope', before: 'wrong', after: 'C' }] },
    { id: 'v2', parentId: 'v1', effectiveDate: '2025-12-01', changes: [] },
    { id: 'v1', parentId: null, effectiveDate: '2026-01-01', changes: [{ field: 'scope', before: null, after: 'A' }] },
    { id: 'dangling', parentId: 'missing', effectiveDate: '2026-04-01', changes: [] }] }
  assert.deepEqual(run('public-amendment-lineage', input).lineage, [
    { id: 'v2', parentId: 'v1', effectiveDate: '2025-12-01', changedFields: [], issues: ['effective-date-before-parent'] },
    { id: 'v1', parentId: null, effectiveDate: '2026-01-01', changedFields: ['scope'], issues: [] },
    { id: 'v3', parentId: 'v2', effectiveDate: '2026-03-01', changedFields: ['scope'], issues: ['before-value-mismatch'] },
    { id: 'dangling', parentId: 'missing', effectiveDate: '2026-04-01', changedFields: [], issues: ['missing-parent'] }])
  const cycle = { ...input, revisions: [{ ...input.revisions[0], id: 'a', parentId: 'b' }, { ...input.revisions[0], id: 'b', parentId: 'a' }] }
  assert.ok((run('public-amendment-lineage', cycle).lineage as { issues: string[] }[]).every(r => r.issues.includes('cycle')))
  assert.throws(() => build('public-amendment-lineage', { ...input, revisions: [{ ...input.revisions[0], effectiveDate: '2026-02-30' }] }))
  assert.throws(() => build('public-amendment-lineage', { ...input, revisions: [{ ...input.revisions[0], changes: [{ field: 'contributorName', before: null, after: 'refuse' }] }] }))
})

test('aggregate spending arithmetic is exact above safe-number precision and unknown is not zero', () => {
  const input = { dataClass: 'public', aggregateOnly: true, currency: 'USD', periods: { before: 'p1', after: 'p2' }, lines: [
    { id: 'large', beforeMinor: '900719925474099300', afterMinor: '900719925474099307' },
    { id: 'credit', beforeMinor: '-10', afterMinor: '0' }, { id: 'missing', beforeMinor: null, afterMinor: '5' }] }
  const output = run('spending-variance-bridge', input)
  assert.equal(output.beforeTotalMinor, null); assert.equal(output.afterTotalMinor, '900719925474099312')
  assert.equal(output.netDeltaMinor, null); assert.equal(output.knownLineDeltaMinor, '17')
  assert.deepEqual(output.unknownLineIds, ['missing'])
  assert.deepEqual((output.lines as { deltaMinor: string | null }[]).map(r => r.deltaMinor), ['7', '10', null])
  const complete = { ...input, lines: input.lines.slice(0, 2) }
  assert.equal(run('spending-variance-bridge', complete).netDeltaMinor, '17')
  assert.throws(() => build('spending-variance-bridge', { ...input, aggregateOnly: false }))
  assert.throws(() => build('spending-variance-bridge', { ...input, lines: [{ id: 'x', beforeMinor: '01', afterMinor: '0' }] }))
})

function ledgerFixture() {
  const preceding = { ledgerId: 'synthetic-ledger', sequence: 0, digest: GENESIS_DIGEST }
  const first = createLedgerReceipt({ kind: 'decision', id: 'd1', occurredAt: '2026-01-01T00:00:00.000Z',
    description: 'Synthetic organizational decision', rationale: 'Declared synthetic rationale',
    evidence: [{ citation: 'Synthetic public committee minutes', url: 'https://example.test/minutes' }] }, preceding)
  const intermediate = { ledgerId: preceding.ledgerId, sequence: 1, digest: first.digest }
  const second = createLedgerReceipt({ ...first.event, id: 'd2', occurredAt: '2026-01-02T00:00:00.000Z' }, intermediate)
  const expectedHead = { ledgerId: preceding.ledgerId, sequence: 2, digest: second.digest }
  return { dataClass: 'synthetic', publicNonpersonalRecords: true, preceding, expectedHead, receipts: [first, second] }
}
test('chain matches actual civic receipt format and independent canonical hash including supplied head/suffix', () => {
  const input = ledgerFixture(), { digest, ...payload } = input.receipts[0]
  assert.equal(digest, hash(canonical(payload)).slice(7))
  assert.deepEqual(verifyLedger(input.receipts, input.preceding, input.expectedHead), input.expectedHead)
  const output = run('transparency-hash-chain-verification', input)
  assert.equal(output.valid, true); assert.equal(output.verifiedReceiptCount, 2)
  assert.deepEqual(output.computedHead, input.expectedHead); assert.deepEqual(output.issues, [])
  const suffix = { ...input, preceding: { ledgerId: input.preceding.ledgerId, sequence: 1, digest: input.receipts[0].digest }, receipts: [input.receipts[1]] }
  assert.equal(run('transparency-hash-chain-verification', suffix).valid, true)
  const reorderedKeys = JSON.parse(canonical(input))
  assert.deepEqual(run('transparency-hash-chain-verification', reorderedKeys), output)
})

test('chain detects expected-head truncation, tamper, order/ledger/link changes and duplicate event IDs', () => {
  const id = 'transparency-hash-chain-verification', input = ledgerFixture()
  assert.deepEqual(run(id, { ...input, receipts: input.receipts.slice(0, 1) }).issues, ['expected-head-mismatch'])
  assert.deepEqual(run(id, { ...input, receipts: [] }).issues, ['expected-head-mismatch'])
  const tamper = structuredClone(input); tamper.receipts[0].event.description = 'Tampered public decision'
  assert.deepEqual(run(id, tamper).issues, ['digest-mismatch', 'expected-head-mismatch'])
  assert.equal(run(id, tamper).verifiedReceiptCount, 0)
  for (const change of [ { ledgerId: 'other-ledger' }, { sequence: 10 }, { previousDigest: '1'.repeat(64) } ]) {
    const altered = { ...input, receipts: [{ ...input.receipts[0], ...change }, input.receipts[1]] }
    assert.deepEqual(run(id, altered).issues, ['chain-mismatch', 'expected-head-mismatch'])
  }
  assert.deepEqual(run(id, { ...input, receipts: [...input.receipts].reverse() }).issues, ['chain-mismatch', 'expected-head-mismatch'])
  const duplicate = createLedgerReceipt(input.receipts[0].event, { ledgerId: input.preceding.ledgerId, sequence: 1, digest: input.receipts[0].digest })
  assert.deepEqual(run(id, { ...input, expectedHead: { ...input.expectedHead, digest: duplicate.digest }, receipts: [input.receipts[0], duplicate] }).issues,
    ['duplicate-event', 'expected-head-mismatch'])
  assert.throws(() => build(id, { ...input, expectedHead: undefined }))
  assert.throws(() => build(id, { ...input, preceding: { ...input.preceding, digest: '1'.repeat(64) } }))
  const donor = structuredClone(input) as unknown as { receipts: { event: Record<string, unknown> }[] }
  donor.receipts[0].event.counterpartyLabel = 'Individual contributor'
  assert.throws(() => build(id, donor as unknown as Record<string, unknown>))
  const contribution = structuredClone(input) as unknown as { receipts: { event: Record<string, unknown> }[] }
  contribution.receipts[0].event.kind = 'contribution'
  assert.throws(() => build(id, contribution as unknown as Record<string, unknown>))
})

test('committee filing resolver handles duplicate IDs, supersession, branches and dangling chains', () => {
  const digest = 'sha256:' + 'a'.repeat(64)
  const base = { filingId: 'f1', amendsId: null, filedAt: '2026-01-01', digest }
  const input = { dataClass: 'public', commercialUseAuthorized: true, noIndividualContributorInformation: true, committeeId: 'committee',
    filings: [base, { ...base }, { filingId: 'f2', amendsId: 'f1', filedAt: '2026-02-01', digest }] }
  const output = run('public-filing-amendment-resolver', input)
  assert.deepEqual(output.duplicateFilingIds, ['f1']); assert.deepEqual(output.conflictingFilingIds, [])
  assert.deepEqual(output.filings, [
    { filingId: 'f1', amendsId: null, status: 'superseded', issues: [] }, { filingId: 'f2', amendsId: 'f1', status: 'current', issues: [] }])
  const conflicting = { ...input, filings: [...input.filings, { ...base, digest: 'sha256:' + 'b'.repeat(64) }] }
  assert.deepEqual(run('public-filing-amendment-resolver', conflicting).conflictingFilingIds, ['f1'])
  assert.ok((run('public-filing-amendment-resolver', conflicting).filings as { status: string }[]).every(f => f.status === 'unresolved'))
  const branch = { ...input, filings: [...input.filings, { filingId: 'f3', amendsId: 'f1', filedAt: '2026-03-01', digest }] }
  assert.ok((run('public-filing-amendment-resolver', branch).filings as { issues: string[] }[]).every(f => f.issues.includes('branching')))
  const dangling = { ...input, filings: [{ ...base, amendsId: 'missing' }] }
  assert.deepEqual(run('public-filing-amendment-resolver', dangling).filings, [{ filingId: 'f1', amendsId: 'missing', status: 'unresolved', issues: ['missing-parent'] }])
  const cycle = { ...input, filings: [{ ...base, amendsId: 'f2' }, { ...base, filingId: 'f2', amendsId: 'f1' }] }
  assert.deepEqual(run('public-filing-amendment-resolver', cycle).cycleIds, ['f1', 'f2'])
  for (const field of ['commercialUseAuthorized', 'noIndividualContributorInformation']) {
    assert.throws(() => build('public-filing-amendment-resolver', { ...input, [field]: false }))
    const omitted = { ...input }; delete omitted[field as keyof typeof omitted]
    assert.throws(() => build('public-filing-amendment-resolver', omitted))
  }
  for (const field of ['contributorName', 'donorAddress', 'employer', 'contributions', 'politicalTargeting'])
    assert.throws(() => build('public-filing-amendment-resolver', { ...input, filings: [{ ...base, [field]: 'refuse' }] }))
})

test('angular separation computes known spherical angles, pole/RA wrap and tiny distances', () => {
  const position = (raMicrodeg: number, decMicrodeg = 0) => ({ raMicrodeg, decMicrodeg })
  const pairs = [ { id: 'same', first: position(0), second: position(0) },
    { id: 'quarter', first: position(0), second: position(90_000_000) }, { id: 'antipodal', first: position(0), second: position(180_000_000) },
    { id: 'poles', first: position(0, 90_000_000), second: position(200_000_000, 90_000_000) },
    { id: 'wrap', first: position(359_000_000), second: position(1_000_000) }, { id: 'tiny', first: position(0), second: position(1) },
    { id: 'oblique', first: position(0, 45_000_000), second: position(90_000_000, 45_000_000) } ]
  const angles = run('angular-separation-batch', { dataClass: 'synthetic', pairs }).angles as { separationDeg: string }[]
  assert.deepEqual(angles.map(a => a.separationDeg), ['0.000000', '90.000000', '180.000000', '0.000000', '2.000000', '0.000001', '60.000000'])
  assert.throws(() => build('angular-separation-batch', { dataClass: 'public', pairs: [{ ...pairs[0], second: position(360_000_000) }] }))
  assert.throws(() => build('angular-separation-batch', { dataClass: 'public', pairs: [{ ...pairs[0], second: position(0, 91_000_000) }] }))
})

test('observing planner has independently computed J2000 GMST geometry and sampled-only windows', () => {
  const input = sample('observing-window-planner')
  const times = ['2000-01-01T12:00:00.000Z', '2000-01-01T18:00:00.000Z', '2000-01-02T00:00:00.000Z']
  input.times = times
  input.targets = [{ id: 'fixed', position: { raMicrodeg: 280_460_618, decMicrodeg: 0 } }]
  input.minimumAltitudeMicrodeg = 0
  const target = (run('observing-window-planner', input).targets as { samples: { altitudeDeg: string; localSiderealDeg: string; meetsMinimum: boolean }[]; sampledWindows: unknown[] }[])[0]
  assert.equal(target.samples[0].localSiderealDeg, '280.460618')
  assert.equal(target.samples[0].altitudeDeg, '90.000000')
  // On the equator with dec=0, altitude near this quarter-turn is 90 - GMST rotation.
  const expectedAtSixHours = 90 - (360.98564736629 * 0.25 + 0.000387933 * (0.25 / 36525) ** 2 - (0.25 / 36525) ** 3 / 38710000 + 0.00000037)
  assert.ok(Math.abs(Number(target.samples[1].altitudeDeg) - expectedAtSixHours) < 0.000001)
  assert.deepEqual(target.samples.map(s => s.meetsMinimum), [true, false, false])
  assert.deepEqual(target.sampledWindows, [{ firstSample: times[0], lastSample: times[0], sampleCount: 1 }])
  const polar = { ...input, site: { latitudeMicrodeg: 90_000_000, longitudeMicrodeg: 0 },
    targets: [{ id: 'polar', position: { raMicrodeg: 0, decMicrodeg: 30_000_000 } }], minimumAltitudeMicrodeg: 30_000_000 }
  const polarTarget = (run('observing-window-planner', polar).targets as { samples: { altitudeDeg: string; meetsMinimum: boolean }[] }[])[0]
  assert.ok(polarTarget.samples.every(s => s.altitudeDeg === '30.000000' && s.meetsMinimum))
  assert.throws(() => build('observing-window-planner', { ...input, times: ['2000-02-30T12:00:00.000Z'] }))
  assert.throws(() => build('observing-window-planner', { ...input, times: [...times].reverse() }))
  assert.throws(() => build('observing-window-planner', { ...input, times: ['2000-01-01T12:00:00.000Z', '2000-01-10T12:00:00.000Z'] }))
  assert.throws(() => build('observing-window-planner', { ...input, weather: 'clear' }))
})

test('terrain profile gives exact runs/rises and known Pythagorean lengths without hazard claims', () => {
  const input = { dataClass: 'synthetic', samples: [
    { id: 'a', distanceMm: 0, elevationMm: 0 }, { id: 'b', distanceMm: 3000, elevationMm: 4000 }, { id: 'c', distanceMm: 6000, elevationMm: 0 }] }
  const output = run('terrain-profile-arithmetic', input)
  assert.deepEqual(output.segments, [
    { from: 'a', to: 'b', runMm: 3000, riseMm: 4000, gradePercent: '133.333333', angleDeg: '53.130102', lengthMm: '5000.000000' },
    { from: 'b', to: 'c', runMm: 3000, riseMm: -4000, gradePercent: '-133.333333', angleDeg: '-53.130102', lengthMm: '5000.000000' }])
  assert.equal(output.totalRunMm, 6000); assert.equal(output.netRiseMm, 0)
  assert.equal(output.ascentMm, 4000); assert.equal(output.descentMm, 4000); assert.equal(output.sampledPathLengthMm, '10000.000000')
  assert.throws(() => build('terrain-profile-arithmetic', { ...input, samples: [input.samples[0], { ...input.samples[1], distanceMm: 0 }] }))
  assert.throws(() => build('terrain-profile-arithmetic', { ...input, samples: [...input.samples].reverse() }))
})

test('licensed prose discovery is explicitly paid and samples select real corpus without containing excerpts', () => {
  for (const id of ['volcano-concept-evidence-pack', 'cross-book-concept-pack', 'manuscript-release-diff']) assert.equal(SPECS[id].paidContent, true)
  for (const id of ['volcano-concept-evidence-pack', 'cross-book-concept-pack']) {
    const input = sample(id)
    assert.equal(Object.hasOwn(input, 'sources'), false)
    const output = run(id)
    for (const source of output.sources as { text: string; textSha256: string; repositoryFile: string; repositoryFileSha256: string; locator: string; sourceBasis: string; editionId: string }[]) {
      const bytes = readFileSync(new URL('../' + source.repositoryFile, import.meta.url))
      const line = Number(source.locator.slice(source.locator.lastIndexOf(':') + 1))
      assert.equal(source.text, bytes.toString('utf8').split('\n')[line - 1])
      assert.equal(source.textSha256, hash(source.text)); assert.equal(source.repositoryFileSha256, hash(bytes))
      assert.equal(source.editionId, 'repo-' + hash(bytes)); assert.equal(source.sourceBasis, 'repository-original-microexcerpt')
      assert.ok(!JSON.stringify(input).includes(source.text))
    }
  }
  assert.equal(SPECS['edition-locator-alignment'].paidContent, undefined)
})

const callerSource = (id: string, bookId: string) => ({ id, bookId, editionId: 'authorized-microedition', sectionId: 'original-microsection',
  locator: 'Original authorized microcontent paragraph 1', text: 'Original Maha-authored educational microtext declared by the caller.',
  author: 'Mayone Maha Rajan', license: 'original-maha-commercial-microcontent-v1', originalMahaAuthored: true,
  commercialUseAuthorized: true, redistributionAuthorized: true, thirdPartyTextIncluded: false })

test('volcano pack supports exact licensed microcontent, rejects third-party/NC texts and binds sources', () => {
  const input = { dataClass: 'public', sources: [callerSource('s1', 'the-volcanic-engine')], concepts: [{ id: 'c1', label: 'Declared educational concept', sourceIds: ['s1'] }] }
  const output = run('volcano-concept-evidence-pack', input)
  const source = (output.sources as { textSha256: string; repositoryFile: null }[])[0]
  assert.equal(source.textSha256, hash(input.sources[0].text)); assert.equal(source.repositoryFile, null)
  assert.equal(output.boundary, 'educational-not-official-hazard-forecast')
  for (const [field, value] of [['author', 'Third-party author'], ['license', 'CC-BY-NC'], ['originalMahaAuthored', false],
    ['commercialUseAuthorized', false], ['redistributionAuthorized', false], ['thirdPartyTextIncluded', true]] as const)
    assert.throws(() => build('volcano-concept-evidence-pack', { ...input, sources: [{ ...input.sources[0], [field]: value }] }))
  assert.throws(() => build('volcano-concept-evidence-pack', { ...input, concepts: [{ ...input.concepts[0], sourceIds: ['missing'] }] }))
  assert.throws(() => build('volcano-concept-evidence-pack', { ...input, sources: [callerSource('s1', 'the-orbital-mind')] }))
  assert.throws(() => build('volcano-concept-evidence-pack', { ...sample('volcano-concept-evidence-pack'), repositorySourceIds: ['../../secret'] }))
  assert.throws(() => build('volcano-concept-evidence-pack', { ...sample('volcano-concept-evidence-pack'), sources: input.sources }))
})

test('edition crosswalk distinguishes declared mapping, unknown locator and two-way ambiguity without PDF parsing', () => {
  const input = sample('edition-locator-alignment')
  input.crosswalk = [ { id: 'a', sectionId: 'introduction', sourceLocator: 'intro', targetLocator: 'page 10' },
    { id: 'b', sectionId: 'introduction', sourceLocator: 'intro', targetLocator: 'page 11' },
    { id: 'c', sectionId: 'maha-framework', sourceLocator: 'framework', targetLocator: null },
    { id: 'd', sectionId: 'how-to-use-this-book', sourceLocator: 'usage', targetLocator: 'page 5' } ]
  const rows = run('edition-locator-alignment', input).crosswalk as { status: string }[]
  assert.deepEqual(rows.map(r => r.status), ['ambiguous', 'ambiguous', 'unmapped', 'declared-mapped'])
  assert.throws(() => build('edition-locator-alignment', { ...input, callerAuthorizedEditions: false }))
  assert.throws(() => build('edition-locator-alignment', { ...input, crosswalk: [{ id: 'x', sectionId: 'unknown', sourceLocator: 's', targetLocator: 't' }] }))
  assert.throws(() => build('edition-locator-alignment', { ...input, pdfUrl: 'https://example.test/book.pdf' }))
  assert.throws(() => build('edition-locator-alignment', { ...input, targetEdition: { ...(input.targetEdition as object), bookId: 'the-maha-principle' } }))
})

test('manuscript release diff hashes complete sections and reports exact bounded line edits, added/removed sections', () => {
  const input = sample('manuscript-release-diff')
  const before = { editionId: 'v1', sections: [
    { id: 'intro', title: 'Intro', locator: 'section 1', text: 'same\n\nold\nrepeat' },
    { id: 'removed', title: 'Removed', locator: 'section 2', text: 'removed text' }] }
  const after = { editionId: 'v2', sections: [
    { id: 'intro', title: 'Intro revised', locator: 'section A', text: 'same\nnew\nrepeat' },
    { id: 'added', title: 'Added', locator: 'section B', text: 'added text' }] }
  input.before = before; input.after = after
  const output = run('manuscript-release-diff', input)
  assert.equal(output.beforeReleaseSha256, hash(canonical(before))); assert.equal(output.afterReleaseSha256, hash(canonical(after)))
  assert.equal(output.releasesIdentical, false)
  const changes = output.changes as { id: string; status: string; removedLines: string[]; addedLines: string[]; changedFields: string[]; beforeTextSha256: string; beforeSectionSha256: string }[]
  assert.deepEqual(changes.map(c => [c.id, c.status]), [['added', 'added'], ['intro', 'modified'], ['removed', 'removed']])
  assert.deepEqual(changes[1].removedLines, ['', 'old']); assert.deepEqual(changes[1].addedLines, ['new'])
  assert.deepEqual(changes[1].changedFields, ['text', 'title', 'locator'])
  assert.equal(changes[1].beforeTextSha256, hash(before.sections[0].text)); assert.equal(changes[1].beforeSectionSha256, hash(canonical(before.sections[0])))
  const unchanged = run('manuscript-release-diff', { ...input, after: before })
  assert.equal(unchanged.releasesIdentical, true)
  assert.ok((unchanged.changes as { status: string }[]).every(c => c.status === 'unchanged'))
  const reordered = run('manuscript-release-diff', { ...input, after: { ...before, sections: [...before.sections].reverse() } })
  assert.equal(reordered.releasesIdentical, false)
  assert.ok((reordered.changes as { status: string }[]).every(c => c.status === 'unchanged'))
  assert.throws(() => build('manuscript-release-diff', { ...input, before: { editionId: 'v1', sections: [{ ...before.sections[0], text: Array(65).fill('x').join('\n') }] } }))
  assert.throws(() => build('manuscript-release-diff', { ...input, license: 'CC-BY-NC' }))
})

test('cross-book packs require two licensed books for every concept and closed declared crosslinks', () => {
  const input = { dataClass: 'public', sources: [callerSource('s1', 'the-volcanic-engine'), callerSource('s2', 'the-orbital-mind')],
    concepts: [{ id: 'c1', label: 'First declared metaphor', sourceIds: ['s1', 's2'] }, { id: 'c2', label: 'Second declared metaphor', sourceIds: ['s1', 's2'] }],
    crosslinks: [{ fromConceptId: 'c1', toConceptId: 'c2', relation: 'authorial-metaphor' }] }
  const output = run('cross-book-concept-pack', input)
  assert.deepEqual(output.crosslinks, input.crosslinks)
  assert.deepEqual((output.concepts as { bookIds: string[] }[])[0].bookIds, ['the-orbital-mind', 'the-volcanic-engine'])
  assert.equal(output.boundary, 'authorial-metaphor-not-clinical-truth')
  assert.throws(() => build('cross-book-concept-pack', { ...input, concepts: [{ ...input.concepts[0], sourceIds: ['s1'] }] }))
  assert.throws(() => build('cross-book-concept-pack', { ...input, sources: [input.sources[0], { ...input.sources[1], bookId: 'the-volcanic-engine' }] }))
  assert.throws(() => build('cross-book-concept-pack', { ...input, crosslinks: [{ ...input.crosslinks[0], toConceptId: 'unknown' }] }))
  assert.throws(() => build('cross-book-concept-pack', { ...input, crosslinks: [{ ...input.crosslinks[0], relation: 'clinically-proven' }] }))
  assert.throws(() => build('cross-book-concept-pack', { ...input, sources: [input.sources[0], { ...input.sources[1], thirdPartyTextIncluded: true }] }))
})

test('owned service module has no route/offer/product dependency cycles or outbound execution calls', () => {
  const source = readFileSync(new URL('../lib/x402/expansion-research-content.ts', import.meta.url), 'utf8')
  const imports = [...source.matchAll(/from '([^']+)'/g)].map(m => m[1])
  assert.deepEqual(imports, ['node:crypto', 'node:fs', 'node:path', '../civic/receipt.ts', '../open-book-editions.ts', './micro-schema.ts'])
  assert.ok(!/\b(fetch|exec|spawn|eval|createBaseRpcReader|verifyLedgerAnchor)\s*\(/.test(source))
  assert.ok(!/process\.env/.test(source))
})
