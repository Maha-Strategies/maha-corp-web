import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildEvidenceExpansion, canonicalJson, sha256, SPECS } from '../lib/x402/expansion-evidence.ts'
import { schemaAccepts, type MicroSchema } from '../lib/x402/micro-schema.ts'
import { validate } from './helpers/json-schema.ts'

type Row = Record<string, unknown>
const list = (r: Row, k: string) => r[k] as Row[]
const sample = (id: string): Row => structuredClone(SPECS[id].sample)
const run = (id: string, input = sample(id)): Row => {
  const r = buildEvidenceExpansion(id, input)
  assert.ok(r)
  return r
}
const h = (text: string) => 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex')
// Independent, deliberately simple oracle for ordinary JSON fixtures.
const ordered = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(ordered)
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, ordered(x)]))
  return v
}
const json = (v: unknown) => JSON.stringify(ordered(v))
const prices = {
  'passage-hash-validation': '4000', 'claim-citation-coverage': '23000', 'citation-locator-conversion': '24000',
  'provenance-graph-integrity': '32500', 'retrieval-recovery-regression': '74000', 'paper-cluster-retrieval-comparison': '144000',
  'packing-displacement-analysis': '78000', 'evidence-budget-allocation': '28000', 'source-coverage-drift': '44500',
  'exact-quote-alignment': '26000', 'extraction-consistency': '46500', 'reproducibility-manifest-builder': '64000',
}

test('catalogue has exactly the 12 specified human-readable context products and prices', () => {
  assert.deepEqual(Object.keys(SPECS).sort(), Object.keys(prices).sort())
  for (const [id, amount] of Object.entries(prices)) {
    const s = SPECS[id]
    assert.equal(s.amount, amount); assert.equal(s.category, 'context')
    assert.ok(s.title.includes(' ') && s.title !== id)
    assert.ok(s.description.length > 40 && s.description.length <= 500)
    assert.ok(Buffer.byteLength(JSON.stringify(s.sample)) <= 32768)
  }
})

test('schemas are closed and bounded at every nesting level; only fixed ID/hash patterns, no refs', () => {
  const allowedPatterns = new Set(['^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$', '^sha256:[a-f0-9]{64}$'])
  const inspect = (s: MicroSchema): void => {
    if (s.oneOf) { s.oneOf.forEach(inspect); return }
    assert.ok(s.type)
    assert.equal(Object.hasOwn(s, '$ref'), false)
    if (s.pattern) assert.ok(allowedPatterns.has(s.pattern))
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false)
      assert.deepEqual(s.required, Object.keys(s.properties!))
      Object.values(s.properties!).forEach(inspect)
    }
    if (s.type === 'array') { assert.ok(s.maxItems! <= 128); assert.ok(s.minItems! >= 0); inspect(s.items!) }
    if (s.type === 'string') assert.ok(s.maxLength !== undefined ? s.maxLength <= 4096 : s.enum!.every(v => typeof v === 'string' && v.length <= 4096))
    if (s.type === 'integer') assert.ok(Number.isSafeInteger(s.minimum) && Number.isSafeInteger(s.maximum))
  }
  for (const s of Object.values(SPECS)) { inspect(s.inputSchema); inspect(s.resultSchema) }
})

for (const id of Object.keys(prices)) {
  test(`${id}: independent schema acceptance, deterministic checksums, and no input mutation`, () => {
    const input = sample(id), before = structuredClone(input), r = run(id, input)
    assert.equal(schemaAccepts(SPECS[id].inputSchema, input), true)
    assert.deepEqual(validate(input, SPECS[id].inputSchema as Row), [])
    assert.equal(schemaAccepts(SPECS[id].resultSchema, r), true)
    assert.deepEqual(validate(r, SPECS[id].resultSchema as Row), [])
    assert.ok(Buffer.byteLength(JSON.stringify(r)) <= 65536)
    assert.deepEqual(input, before)
    assert.deepEqual(run(id, input), r)
    assert.deepEqual(run(id, Object.fromEntries(Object.entries(input).reverse())), r)
    assert.equal(r.inputSha256, h(json(input)))
    const { resultSha256, ...body } = r
    assert.equal(resultSha256, h(json(body)))
    assert.equal(r.sourcesVerified, false)
    assert.match((r.limits as string[]).join(' '), /No network, models, secrets/)
    const changed = { ...input, dataClass: 'public' }
    assert.notEqual(run(id, changed).inputSha256, r.inputSha256)
    // Structurally valid tampering is not authenticated by a schema. Checksum
    // verification needs independent recomputation, and is not a signature.
    const tampered: Row = { ...r, dataClass: 'public' }
    assert.equal(schemaAccepts(SPECS[id].resultSchema, tampered), true)
    const { resultSha256: claimed, ...tamperedBody } = tampered
    assert.notEqual(claimed, h(json(tamperedBody)))
    assert.equal(schemaAccepts(SPECS[id].resultSchema, { ...r, surprise: true }), false)
    assert.equal(schemaAccepts(SPECS[id].resultSchema, { ...r, sourcesVerified: true }), false)
  })
  test(`${id}: rejects private/extra/missing fields and recursive unknown properties`, () => {
    const input = sample(id)
    for (const bad of [{ ...input, dataClass: 'private' }, { ...input, extra: true }, { ...input, dataClass: undefined }, {}]) assert.throws(() => run(id, bad))
    const properties = SPECS[id].inputSchema.properties!
    const nestedKey = Object.keys(properties).find(k => properties[k].type === 'array' && properties[k].items?.type === 'object')
    const nested = sample(id)
    if (nestedKey) list(nested, nestedKey)[0].extra = 'rejected'
    else (nested.before as Row).extra = 'rejected'
    assert.throws(() => run(id, nested), /invalid-input/)
  })
}

test('unknown and prototype IDs return null and do not inspect input', () => {
  const malicious = { get dataClass() { throw new Error('must not inspect') } }
  for (const id of ['unknown', '', '__proto__', 'constructor', 'toString']) assert.equal(buildEvidenceExpansion(id, malicious), null)
})

test('canonical JSON/hash match independent oracles, preserve array order, exact Unicode and escaped controls', () => {
  const value = { z: [2, 1], a: { emoji: '😀', line: 'x\n\ty', n: -3 }, nil: null }
  assert.equal(canonicalJson(value), json(value))
  assert.equal(sha256('abc'), 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.notEqual(sha256('é'), sha256('e\u0301'))
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]))
})

test('reject non-JSON values, cycles, depth, holes, accessors and hooks without running them', () => {
  const id = 'passage-hash-validation'
  let invoked = 0
  const accessor = sample(id)
  Object.defineProperty(accessor, 'dataClass', { enumerable: true, get() { invoked++; return 'synthetic' } })
  const hook = { ...sample(id), toJSON() { invoked++; return sample(id) } }
  const cycle: Row = {}; cycle.loop = cycle
  const sparse = new Array(2); sparse[1] = 'a'
  const decorated = ['a']; Object.assign(decorated, { extra: true })
  const nonenumerable = sample(id); Object.defineProperty(nonenumerable, 'hidden', { value: 'x' })
  let deep: unknown = 'x'; for (let n = 0; n < 18; n++) deep = { deep }
  for (const value of [undefined, NaN, Infinity, .5, BigInt(1), Symbol('x'), () => {}, new Date(0), cycle, sparse, decorated, deep, '\ud800', '\udfff']) assert.throws(() => canonicalJson(value))
  for (const bad of [accessor, hook, nonenumerable, Object.assign(sample(id), { [Symbol('x')]: 'x' }), Object.assign(Object.create({}), sample(id))]) assert.throws(() => run(id, bad))
  assert.equal(invoked, 0)
  assert.throws(() => sha256('x'.repeat(65537)), /limit/)
  assert.throws(() => canonicalJson(Array.from({ length: 4096 }, () => null)), /complexity-limit/)
  const nullProto = Object.assign(Object.create(null), sample(id)) as Row
  assert.equal(run(id, nullProto).allMatch, true)
})

test('input limit is exact canonical encoded bytes: 32768 accepted, 32769 rejected', () => {
  const id = 'passage-hash-validation'
  const passages = Array.from({ length: 8 }, (_, i) => ({ passageId: `p${i}`, text: i < 7 ? 'x'.repeat(4096) : '', expectedHash: h('') }))
  const input = { dataClass: 'synthetic', passages }
  passages[7].text = 'x'.repeat(32768 - Buffer.byteLength(json(input)))
  for (const p of passages) p.expectedHash = h(p.text)
  assert.equal(Buffer.byteLength(json(input)), 32768)
  assert.equal(schemaAccepts(SPECS[id].inputSchema, input), true)
  assert.equal(run(id, input).allMatch, true)
  passages[7].text += 'x'
  assert.equal(Buffer.byteLength(json(input)), 32769)
  assert.equal(schemaAccepts(SPECS[id].inputSchema, input), true)
  assert.throws(() => run(id, input), /json-byte-limit/)
  passages[7].text = '😀'.repeat(4096)
  assert.throws(() => run(id, input), /json-byte-limit/)
})

test('64 rows accepted, 65 rejected; oversized results fail instead of returning truncated/unbounded data', () => {
  const ps = Array.from({ length: 64 }, (_, i) => ({ passageId: `p${i}`, text: 'x', expectedHash: h('x') }))
  assert.equal(run('passage-hash-validation', { dataClass: 'public', passages: ps }).checked, 64)
  ps.push({ ...ps[0], passageId: 'p64' })
  assert.throws(() => run('passage-hash-validation', { dataClass: 'public', passages: ps }), /invalid-input/)
  const sources = Array.from({ length: 16 }, (_, i) => ({ sourceId: `s${i}`.padEnd(80, 'x'), locatorIds: ['l'] }))
  const citations = sources.map((s, i) => ({ citationId: `c${i}`, sourceId: s.sourceId, locatorId: 'l' }))
  const input = { dataClass: 'synthetic', sources, citations, claims: Array.from({ length: 64 }, (_, i) => ({ claimId: `claim${i}`.padEnd(80, 'x'), citationIds: citations.map(c => c.citationId) })) }
  assert.equal(schemaAccepts(SPECS['claim-citation-coverage'].inputSchema, input), true)
  assert.ok(Buffer.byteLength(json(input)) < 32768)
  assert.throws(() => run('claim-citation-coverage', input), /json-byte-limit/)
})

test('passage hashes use exact UTF-8 and report content substitution, not just expected-hash shape', () => {
  const input = { dataClass: 'public', passages: [{ passageId: 'a', text: 'é\n', expectedHash: h('é\n') }, { passageId: 'b', text: 'e\u0301\n', expectedHash: h('é\n') }] }
  const r = run('passage-hash-validation', input), ps = list(r, 'passages')
  assert.equal(r.allMatch, false); assert.equal(ps[0].matches, true); assert.equal(ps[1].matches, false)
  assert.equal(ps[0].utf8Bytes, 3); assert.equal(ps[1].utf8Bytes, 4)
  assert.equal(ps[1].contentSha256, h('e\u0301\n'))
  input.passages[1].passageId = 'a'
  assert.throws(() => run('passage-hash-validation', input), /duplicate-passage/)
})

test('claim coverage counts claims rather than citation volume or duplicate sources', () => {
  const input = { dataClass: 'synthetic', sources: [{ sourceId: 's1', locatorIds: ['l1', 'l2'] }, { sourceId: 's2', locatorIds: ['l1'] }],
    citations: [{ citationId: 'a', sourceId: 's1', locatorId: 'l1' }, { citationId: 'b', sourceId: 's1', locatorId: 'l2' }, { citationId: 'unused', sourceId: 's2', locatorId: 'l1' }],
    claims: [{ claimId: 'c1', citationIds: ['a', 'b'] }, { claimId: 'c2', citationIds: [] }, { claimId: 'c3', citationIds: ['a'] }] }
  const r = run('claim-citation-coverage', input)
  assert.equal(r.coverageBps, 6667); assert.equal(r.coveredClaims, 2)
  assert.deepEqual(r.uncoveredClaimIds, ['c2']); assert.deepEqual(r.unusedCitationIds, ['unused'])
  assert.deepEqual(list(r, 'claims')[0].sourceIds, ['s1']); assert.equal(r.semanticSupportVerified, false)
  for (const change of [
    (x: typeof input) => x.sources.push(x.sources[0]),
    (x: typeof input) => x.sources[0].locatorIds.push('l1'),
    (x: typeof input) => x.citations.push(x.citations[0]),
    (x: typeof input) => { x.citations[0].locatorId = 'missing' },
    (x: typeof input) => { x.citations[0].sourceId = 'missing' },
    (x: typeof input) => x.claims.push(x.claims[0]),
    (x: typeof input) => x.claims[0].citationIds.push('a'),
    (x: typeof input) => x.claims[0].citationIds.push('missing'),
  ]) { const bad = structuredClone(input); change(bad); assert.throws(() => run('claim-citation-coverage', bad)) }
})

test('citation spans convert Unicode coordinates in both directions and never split code points', () => {
  const input = sample('citation-locator-conversion')
  input.locators = ['utf8', 'utf16', 'codepoint'].map((unit, i) => ({ locatorId: `l${i}`, sourceId: 's1', unit, start: 1, end: [7, 4, 3][i] }))
  for (const l of list(run('citation-locator-conversion', input), 'locators')) {
    assert.equal(l.codepointStart, 1); assert.equal(l.codepointEnd, 3)
    assert.equal(l.utf16Start, 1); assert.equal(l.utf16End, 4)
    assert.equal(l.utf8Start, 1); assert.equal(l.utf8End, 7)
    assert.equal(l.excerptSha256, h('😀é'))
  }
  for (const locator of [{ unit: 'utf16', start: 2, end: 4 }, { unit: 'utf8', start: 2, end: 7 }, { unit: 'utf8', start: 1, end: 6 }, { unit: 'codepoint', start: 3, end: 2 }, { unit: 'codepoint', start: 0, end: 5 }]) {
    assert.throws(() => run('citation-locator-conversion', { ...input, locators: [{ locatorId: 'l', sourceId: 's1', ...locator }] }), /boundary/)
  }
  assert.throws(() => run('citation-locator-conversion', { ...input, locators: [{ locatorId: 'l', sourceId: 'unknown', unit: 'utf8', start: 0, end: 0 }] }), /dangling/)
  assert.throws(() => run('citation-locator-conversion', { ...input, locators: [list(input, 'locators')[0], list(input, 'locators')[0]] }), /duplicate/)
  const empty = run('citation-locator-conversion', { dataClass: 'public', sources: [{ sourceId: 's', text: '' }], locators: [{ locatorId: 'l', sourceId: 's', unit: 'utf8', start: 0, end: 0 }] })
  assert.equal(list(empty, 'locators')[0].excerptSha256, h(''))
})

test('provenance graph reports exact cycle members, not all blocked descendants', () => {
  const input = { dataClass: 'synthetic', nodes: ['a', 'b', 'descendant', 'orphan', 'source', 'rooted'].map(nodeId => ({ nodeId, kind: nodeId === 'source' ? 'source' : 'claim', digestHash: h(nodeId) })),
    edges: [['a', 'b'], ['b', 'a'], ['descendant', 'a'], ['rooted', 'source']].map(([from, to], i) => ({ edgeId: `e${i}`, from, to, relation: 'cites' })) }
  const r = run('provenance-graph-integrity', input)
  assert.equal(r.state, 'cyclic'); assert.deepEqual(r.cycleNodeIds, ['a', 'b'])
  assert.deepEqual(r.rootlessNodeIds, ['a', 'b', 'descendant', 'orphan']); assert.deepEqual(r.sourceRootIds, ['source'])
  const reordered = { ...input, nodes: [...input.nodes].reverse(), edges: [...input.edges].reverse() }
  assert.equal(run('provenance-graph-integrity', reordered).graphSha256, r.graphSha256)
  input.edges = []; assert.equal(run('provenance-graph-integrity', input).state, 'unrooted')
  input.edges = [{ edgeId: 'self', from: 'a', to: 'a', relation: 'cites' }]
  assert.deepEqual(run('provenance-graph-integrity', input).cycleNodeIds, ['a'])
})

test('provenance graph rejects duplicate IDs, logical duplicate edges, and dangling endpoints', () => {
  const id = 'provenance-graph-integrity'
  for (const mutate of [
    (x: Row) => list(x, 'nodes').push(list(x, 'nodes')[0]),
    (x: Row) => list(x, 'edges').push(list(x, 'edges')[0]),
    (x: Row) => list(x, 'edges').push({ ...list(x, 'edges')[0], edgeId: 'new-id' }),
    (x: Row) => { list(x, 'edges')[0].to = 'missing' },
  ]) { const bad = sample(id); mutate(bad); assert.throws(() => run(id, bad)) }
})

// A second implementation of the frozen encoding contract, not a module helper.
const frozenHash = (c: Row) => h(json({ corpusHash: c.corpusHash, paperIds: [...c.paperIds as string[]].sort(),
  evidence: [...list(c, 'evidence')].sort((a, b) => String(a.evidenceId) < String(b.evidenceId) ? -1 : String(a.evidenceId) > String(b.evidenceId) ? 1 : 0),
  questions: [...list(c, 'questions')].sort((a, b) => String(a.questionId) < String(b.questionId) ? -1 : String(a.questionId) > String(b.questionId) ? 1 : 0).map(q => ({ ...q, expectedEvidenceIds: [...q.expectedEvidenceIds as string[]].sort() })),
}))
const freeze = (input: Row) => { for (const key of ['baseline', 'candidate']) (input[key] as Row).cohortSha256 = frozenHash(input); return input }
function retrievalFixture(): Row {
  const paperIds = ['p1', 'p2', 'p3'], states = ['complete', 'partial', 'miss']
  const questions = Array.from({ length: 9 }, (_, i) => { const paperId = i === 0 ? 'p1' : i < 4 ? 'p2' : 'p3'; return { questionId: `q${i}`, paperId, expectedEvidenceIds: [`${paperId}-e1`, `${paperId}-e2`] } })
  const obs = (candidate: boolean) => questions.map((q, i) => ({ questionId: q.questionId, paperId: q.paperId,
    retrievedEvidenceIds: (candidate ? states[i % 3] : states[Math.floor(i / 3)]) === 'complete' ? q.expectedEvidenceIds : (candidate ? states[i % 3] : states[Math.floor(i / 3)]) === 'partial' ? [q.expectedEvidenceIds[0], `${q.paperId}-noise`] : [`${q.paperId}-noise`] }))
  return freeze({ dataClass: 'synthetic', corpusHash: h('frozen corpus'), paperIds, questions,
    evidence: paperIds.flatMap(paperId => ['e1', 'e2', 'noise'].map(e => ({ evidenceId: `${paperId}-${e}`, paperId }))),
    baseline: { runId: 'base', cohortSha256: '', observations: obs(false) }, candidate: { runId: 'cand', cohortSha256: '', observations: obs(true) }, maxCompleteDropBps: 0 })
}
const clusterInput = (fixture = retrievalFixture()): Row => {
  const { maxCompleteDropBps: unused, ...input } = fixture
  void unused
  return { ...input, seed: 12345, resamples: 300 }
}

test('paired retrieval distinguishes all nine complete/partial/miss transitions with frozen paired IDs', () => {
  const r = run('retrieval-recovery-regression', retrievalFixture())
  assert.deepEqual(r.baselineCounts, { complete: 3, partial: 3, miss: 3 })
  assert.deepEqual(r.candidateCounts, { complete: 3, partial: 3, miss: 3 })
  assert.equal(r.baselineCompleteBps, 3333); assert.equal(r.candidateCompleteBps, 3333); assert.equal(r.completeDeltaBps, 0)
  assert.equal(r.improved, 3); assert.equal(r.regressed, 3); assert.equal(r.unchanged, 3)
  assert.equal(r.regressionObserved, false)
  assert.ok(list(r, 'transitions').every(t => t.count === 1))
  assert.deepEqual(list(r, 'papers').map(p => p.questionCount), [1, 3, 5])
  const partial = list(r, 'questions').find(q => q.questionId === 'q4')!
  assert.equal(partial.baselineState, 'partial'); assert.equal(partial.baselineRecovered, 1); assert.equal(partial.requiredCount, 2)
})

test('retrieval threshold is a declared strict drop limit; partial is not complete recovery', () => {
  const input = sample('retrieval-recovery-regression')
  const a = input.baseline as Row, b = input.candidate as Row
  list(a, 'observations')[0].retrievedEvidenceIds = ['a1', 'a2']
  list(b, 'observations')[0].retrievedEvidenceIds = ['a1']
  list(b, 'observations')[1].retrievedEvidenceIds = ['b1']
  input.maxCompleteDropBps = 5000
  const r = run('retrieval-recovery-regression', input)
  assert.equal(r.completeDeltaBps, -5000); assert.equal(r.regressionObserved, false)
  input.maxCompleteDropBps = 4999; assert.equal(run('retrieval-recovery-regression', input).regressionObserved, true)
})

test('paired retrieval rejects unmatched/changed cohorts, duplicate observations and dangling evidence', () => {
  const mutations: ((x: Row) => void)[] = [
    x => { (x.baseline as Row).cohortSha256 = h('different cohort') },
    x => { x.corpusHash = h('changed corpus') },
    x => { list(x, 'questions')[0].expectedEvidenceIds = ['p1-e1'] },
    x => { (x.candidate as Row).runId = 'base' },
    x => { list(x.candidate as Row, 'observations').pop() },
    x => { list(x.candidate as Row, 'observations')[0] = list(x.candidate as Row, 'observations')[1] },
    x => { list(x.baseline as Row, 'observations')[0].paperId = 'p2' },
    x => { list(x.baseline as Row, 'observations')[0].questionId = 'missing' },
    x => { list(x.baseline as Row, 'observations')[0].retrievedEvidenceIds = ['missing'] },
    x => { list(x.baseline as Row, 'observations')[0].retrievedEvidenceIds = ['p1-e1', 'p1-e1'] },
    x => { list(x, 'questions')[0].expectedEvidenceIds = ['p1-e1', 'p1-e1']; freeze(x) },
    x => { list(x, 'questions')[0].expectedEvidenceIds = ['p2-e1']; freeze(x) },
    x => { list(x, 'questions')[0].paperId = 'unknown'; freeze(x) },
    x => { list(x, 'evidence').push(list(x, 'evidence')[0]); freeze(x) },
    x => { list(x, 'questions').push(list(x, 'questions')[0]); freeze(x) },
    x => { (x.paperIds as string[]).push('p1'); freeze(x) },
    x => { (x.paperIds as string[]).push('empty-cluster'); freeze(x) },
  ]
  for (const mutate of mutations) {
    const input = retrievalFixture(); mutate(input)
    assert.throws(() => run('retrieval-recovery-regression', input))
    assert.throws(() => run('paper-cluster-retrieval-comparison', clusterInput(input)))
  }
})

test('retrieval aligns by question IDs regardless of observation/evidence/cohort order', () => {
  const input = retrievalFixture(), before = run('retrieval-recovery-regression', input)
  for (const key of ['baseline', 'candidate']) list(input[key] as Row, 'observations').reverse()
  list(input, 'questions').reverse(); list(input, 'evidence').reverse(); (input.paperIds as string[]).reverse()
  const after = run('retrieval-recovery-regression', input)
  for (const key of ['frozenCohortSha256', 'questions', 'papers', 'transitions', 'baselineCounts', 'candidateCounts']) assert.deepEqual(after[key], before[key])
})

test('cluster bootstrap independently resamples paired PAPER IDs, preserving unequal cluster sizes', () => {
  // From the nine transition fixture, cluster totals are analytically known:
  // p1: baseline=1/candidate=1/n=1; p2: 2/1/3; p3: 0/1/5.
  const clusters = [{ a: 1, b: 1, n: 1 }, { a: 2, b: 1, n: 3 }, { a: 0, b: 1, n: 5 }]
  for (const seed of [0, 1, 12345, 4294967295]) {
    const input = { ...clusterInput(), seed }, r = run('paper-cluster-retrieval-comparison', input)
    let state = BigInt(seed)
    const deltas: number[] = []
    for (let rep = 0; rep < 300; rep++) {
      let a = 0, b = 0, n = 0
      for (let draw = 0; draw < 3; draw++) {
        state = (BigInt(1664525) * state + BigInt(1013904223)) % BigInt(4294967296)
        const c = clusters[Number(state * BigInt(3) / BigInt(4294967296))]
        a += c.a; b += c.b; n += c.n
      }
      deltas.push(Math.round(10000 * (b - a) / n))
    }
    deltas.sort((a, b) => a - b)
    assert.equal(r.intervalLowBps, deltas[Math.ceil(.025 * 300) - 1])
    assert.equal(r.intervalHighBps, deltas[Math.ceil(.975 * 300) - 1])
    assert.equal(r.distinctBootstrapDeltas, new Set(deltas).size)
    assert.equal(r.resamplingUnit, 'paperId'); assert.equal(r.descriptiveOnly, true)
    assert.equal(r.estimator, 'question-weighted-complete-recovery-delta-bps')
    assert.ok((r.intervalLowBps as number) >= -3333 && (r.intervalHighBps as number) <= 2000)
    assert.match((r.limits as string[]).join(' '), /Few clusters.*no significance claim/)
  }
})

test('cluster bootstrap has bounded resamples/papers/seed and permits degenerate descriptive intervals', () => {
  const input = clusterInput()
  for (const patch of [{ seed: -1 }, { seed: 4294967296 }, { seed: .5 }, { resamples: 99 }, { resamples: 2001 }]) assert.throws(() => run('paper-cluster-retrieval-comparison', { ...input, ...patch }))
  assert.throws(() => run('paper-cluster-retrieval-comparison', { ...input, paperIds: ['p1'] }), /invalid-input/)
  input.candidate = { ...(input.candidate as Row), observations: structuredClone((input.baseline as Row).observations) }
  input.resamples = 2000
  const r = run('paper-cluster-retrieval-comparison', input)
  assert.equal(r.intervalLowBps, 0); assert.equal(r.intervalHighBps, 0); assert.equal(r.distinctBootstrapDeltas, 1)
})

test('packing distinguishes rank-prefix stop, rank-fit skip, density-fit and observed violations', () => {
  const input = sample('packing-displacement-analysis'), r = run('packing-displacement-analysis', input)
  assert.deepEqual((r.rankPrefix as Row).selectedPassageIds, ['p1'])
  assert.deepEqual((r.greedyFit as Row).selectedPassageIds, ['p1', 'p3'])
  assert.deepEqual((r.densityGreedy as Row).selectedPassageIds, ['p2', 'p3'])
  assert.equal((r.rankPrefix as Row).coverageBps, 5000); assert.equal((r.greedyFit as Row).coverageBps, 10000)
  assert.equal((r.greedyFit as Row).usedTokens, 8); assert.equal((r.densityGreedy as Row).usedTokens, 7)
  assert.deepEqual(r.greedyAddedPassageIds, ['p3']); assert.deepEqual(r.densityDisplacedPassageIds, ['p1'])
  assert.deepEqual(r.greedyRecoveredEvidenceIds, ['e2']); assert.equal(r.observedSelection, null); assert.equal(r.causalityEstablished, false)
  input.observedSelectedPassageIds = ['p1', 'p2']
  const observed = run('packing-displacement-analysis', input).observedSelection as Row
  assert.equal(observed.usedTokens, 11); assert.equal(observed.overBudget, true)
  input.observedSelectedPassageIds = []
  assert.deepEqual((run('packing-displacement-analysis', input).observedSelection as Row).omittedRequiredEvidenceIds, ['e1', 'e2'])
  assert.equal(run('packing-displacement-analysis', input).causalityEstablished, false)
})

test('packing handles exact 2048 budget, rank ties/references/duplicate observations and integer limits', () => {
  const id = 'packing-displacement-analysis'
  const input = { dataClass: 'synthetic', budget: 2048, requiredEvidenceIds: ['e'], candidates: [{ passageId: 'a', rank: 1, tokens: 2048, score: 1000000, evidenceIds: ['e'] }], observedSelectedPassageIds: null }
  assert.equal((run(id, input).greedyFit as Row).usedTokens, 2048)
  for (const patch of [{ budget: 2049 }, { budget: 0 }, { budget: 1.5 }]) assert.throws(() => run(id, { ...input, ...patch }))
  for (const mutate of [
    (x: Row) => { list(x, 'candidates')[0].tokens = 0 },
    (x: Row) => { list(x, 'candidates')[0].score = -1 },
    (x: Row) => { list(x, 'candidates')[0].evidenceIds = ['unknown'] },
    (x: Row) => { list(x, 'candidates')[0].evidenceIds = ['e', 'e'] },
    (x: Row) => list(x, 'candidates').push({ ...list(x, 'candidates')[0], passageId: 'b' }),
    (x: Row) => list(x, 'candidates').push({ ...list(x, 'candidates')[0], rank: 2 }),
    (x: Row) => { x.observedSelectedPassageIds = ['a', 'a'] },
    (x: Row) => { x.observedSelectedPassageIds = ['unknown'] },
  ]) { const bad: Row = structuredClone(input); mutate(bad); assert.throws(() => run(id, bad)) }
  const tie = sample(id); list(tie, 'candidates')[0].score = 12; list(tie, 'candidates')[1].score = 10; list(tie, 'candidates')[2].score = 4
  assert.deepEqual((run(id, tie).densityGreedy as Row).selectedPassageIds, ['p1', 'p3'])
  list(tie, 'candidates').reverse()
  assert.deepEqual((run(id, tie).densityGreedy as Row).selectedPassageIds, ['p1', 'p3'])
})

test('exact allocation beats density heuristics and agrees with independent exhaustive subsets', () => {
  const id = 'evidence-budget-allocation'
  assert.deepEqual(run(id).selectedEvidenceIds, ['b', 'c']); assert.equal(run(id).totalValue, 20)
  for (let trial = 0; trial < 24; trial++) {
    const items = Array.from({ length: 8 }, (_, i) => ({ evidenceId: `e${i}`, tokens: (i * 7 + trial * 3) % 9 + 1, value: (i * 11 + trial * 5) % 23 }))
    const budget = trial % 16
    let best = 0
    for (let mask = 0; mask < 256; mask++) {
      let cost = 0, value = 0
      for (let i = 0; i < 8; i++) if (mask & (1 << i)) { cost += items[i].tokens; value += items[i].value }
      if (cost <= budget) best = Math.max(best, value)
    }
    const r = run(id, { dataClass: 'public', budget, items }), selected = items.filter(i => (r.selectedEvidenceIds as string[]).includes(i.evidenceId))
    assert.equal(r.totalValue, best); assert.equal(r.totalValue, selected.reduce((n, i) => n + i.value, 0))
    assert.equal(r.usedTokens, selected.reduce((n, i) => n + i.tokens, 0)); assert.equal(r.unspentTokens, budget - (r.usedTokens as number))
    assert.equal(new Set(r.selectedEvidenceIds as string[]).size, selected.length)
    assert.ok((r.usedTokens as number) <= budget)
  }
})

test('allocation handles zero values/capacity, ties, input order, upper bounds and duplicates', () => {
  const id = 'evidence-budget-allocation', input = { dataClass: 'synthetic', budget: 1, items: [{ evidenceId: 'b', tokens: 1, value: 5 }, { evidenceId: 'a', tokens: 1, value: 5 }] }
  assert.deepEqual(run(id, input).selectedEvidenceIds, ['a'])
  input.items.reverse(); assert.deepEqual(run(id, input).selectedEvidenceIds, ['a'])
  input.budget = 0; assert.deepEqual(run(id, input).selectedEvidenceIds, [])
  input.budget = 4096; input.items.forEach(i => { i.value = 0 })
  assert.deepEqual(run(id, input).selectedEvidenceIds, [])
  const max = { dataClass: 'public', budget: 4096, items: Array.from({ length: 64 }, (_, i) => ({ evidenceId: `e${i}`, tokens: 64, value: 1000000 })) }
  assert.equal(run(id, max).totalValue, 64000000); assert.equal(run(id, max).usedTokens, 4096)
  input.items.push(input.items[0]); assert.throws(() => run(id, input), /duplicate/)
  for (const budget of [-1, 4097, .1]) assert.throws(() => run(id, { ...max, budget }))
})

test('coverage drift detects source replacement even with unchanged global coverage', () => {
  const id = 'source-coverage-drift'
  const input = { dataClass: 'public', sourceIds: ['a', 'b', 'c'], recordIds: ['r1', 'r2'],
    before: { snapshotId: 'v1', records: [{ recordId: 'r1', sourceIds: ['a', 'b'] }, { recordId: 'r2', sourceIds: [] }] },
    after: { snapshotId: 'v2', records: [{ recordId: 'r2', sourceIds: ['b'] }, { recordId: 'r1', sourceIds: ['b', 'c'] }] } }
  const r = run(id, input)
  assert.equal(r.beforeCoverageBps, 6667); assert.equal(r.afterCoverageBps, 6667); assert.equal(r.coverageDeltaBps, 0)
  assert.deepEqual(r.gainedSourceIds, ['c']); assert.deepEqual(r.lostSourceIds, ['a']); assert.equal(r.changedRecordCount, 2)
  assert.deepEqual(list(r, 'sources'), [{ sourceId: 'a', beforeRecordCount: 1, afterRecordCount: 0, delta: -1 }, { sourceId: 'b', beforeRecordCount: 1, afterRecordCount: 2, delta: 1 }, { sourceId: 'c', beforeRecordCount: 0, afterRecordCount: 1, delta: 1 }])
  for (const s of [input.before, input.after]) for (const r of s.records) r.sourceIds = []
  const empty = run(id, input); assert.equal(empty.changedRecordCount, 0); assert.equal(empty.beforeCoverageBps, 0)
})

test('drift rejects unknown/duplicate sources, mismatched record cohorts and duplicate snapshots', () => {
  const id = 'source-coverage-drift'
  for (const mutate of [
    (x: Row) => { (x.sourceIds as string[]).push('s1') },
    (x: Row) => { (x.recordIds as string[]).push('r1') },
    (x: Row) => { (x.recordIds as string[]).push('missing-record') },
    (x: Row) => { (x.after as Row).snapshotId = (x.before as Row).snapshotId },
    (x: Row) => { list(x.after as Row, 'records')[0].recordId = 'unknown' },
    (x: Row) => { list(x.after as Row, 'records')[0].sourceIds = ['unknown'] },
    (x: Row) => { list(x.after as Row, 'records')[0].sourceIds = ['s1', 's1'] },
    (x: Row) => { list(x.after as Row, 'records').push(list(x.after as Row, 'records')[0]) },
  ]) { const bad = sample(id); mutate(bad); assert.throws(() => run(id, bad)) }
})

test('quote alignment uses codepoints, exact text and overlapping matches, with truthful truncation', () => {
  const id = 'exact-quote-alignment', r = run(id)
  assert.equal(r.allAligned, true); assert.equal(list(r, 'quotes')[0].occurrenceCount, 2)
  assert.deepEqual(list(r, 'quotes')[0].occurrences, [{ start: 3, end: 8 }, { start: 10, end: 15 }])
  const input = { dataClass: 'public', sources: [{ sourceId: 's', text: '😀aaaa' }], quotes: [{ quoteId: 'q', sourceId: 's', quote: 'aa', start: 1, end: 3 }] }
  let q = list(run(id, input), 'quotes')[0]
  assert.equal(q.exactAtDeclaredOffsets, true); assert.equal(q.occurrenceCount, 3); assert.equal(q.uniqueMatch, null)
  assert.deepEqual(q.occurrences, [{ start: 1, end: 3 }, { start: 2, end: 4 }, { start: 3, end: 5 }])
  input.sources[0].text = 'a'.repeat(96)
  q = list(run(id, input), 'quotes')[0]
  assert.equal(q.occurrenceCount, 95); assert.equal((q.occurrences as Row[]).length, 32); assert.equal(q.occurrencesTruncated, true)
  input.sources[0].text = 'xé'; input.quotes[0] = { quoteId: 'q', sourceId: 's', quote: 'é', start: 0, end: 1 }
  q = list(run(id, input), 'quotes')[0]
  assert.equal(q.exactAtDeclaredOffsets, false); assert.deepEqual(q.uniqueMatch, { start: 1, end: 2 })
  for (const quote of ['e\u0301', 'É', ' é']) {
    input.quotes[0].quote = quote
    assert.equal(list(run(id, input), 'quotes')[0].occurrenceCount, 0)
  }
})

test('quote alignment rejects duplicate IDs, dangling sources, invalid spans and overlong quotes', () => {
  const id = 'exact-quote-alignment'
  for (const mutate of [
    (x: Row) => list(x, 'quotes').push(list(x, 'quotes')[0]),
    (x: Row) => list(x, 'sources').push(list(x, 'sources')[0]),
    (x: Row) => { list(x, 'quotes')[0].sourceId = 'unknown' },
    (x: Row) => { list(x, 'quotes')[0].end = 100 },
    (x: Row) => { list(x, 'quotes')[0].start = 9 },
    (x: Row) => { list(x, 'quotes')[0].quote = 'x'.repeat(513) },
    (x: Row) => { list(x, 'quotes')[0].quote = '' },
  ]) { const bad = sample(id); mutate(bad); assert.throws(() => run(id, bad)) }
})

test('extraction compares exact source slices separately from hash matching and cross-tool agreement', () => {
  const id = 'extraction-consistency', input = sample(id), r = run(id, input)
  assert.equal(r.allExact, false); assert.equal(r.allHashesMatch, true); assert.equal(r.conflictingSpanCount, 1)
  assert.equal(list(r, 'checks')[0].exactSourceMatch, true); assert.equal(list(r, 'checks')[1].exactSourceMatch, false)
  const passage = list(list(input, 'extractions')[1], 'passages')[0]
  passage.expectedHash = h('Hello')
  assert.equal(run(id, input).allHashesMatch, false)
  passage.text = 'Hello'
  let fixed = run(id, input)
  assert.equal(fixed.allExact, true); assert.equal(fixed.allHashesMatch, true); assert.equal(fixed.conflictingSpanCount, 0)
  for (const x of list(input, 'extractions')) { list(x, 'passages')[0].text = 'hello'; list(x, 'passages')[0].expectedHash = h('hello') }
  fixed = run(id, input)
  assert.equal(list(fixed, 'spans')[0].consistentText, true); assert.equal(fixed.allExact, false)
})

test('extraction enforces the total 64-span limit, namespaced span groups, and duplicate/reference rules', () => {
  const id = 'extraction-consistency'
  const makePassages = (n: number) => Array.from({ length: n }, (_, i) => ({ passageId: `p${i}`, start: i, end: i + 1, text: 'x', expectedHash: h('x') }))
  const input = { dataClass: 'public', sources: [{ sourceId: 's', text: 'x'.repeat(32) }, { sourceId: 'other', text: 'x'.repeat(32) }], extractions: [
    { extractionId: 'a', sourceId: 's', toolId: 'a', passages: makePassages(32) }, { extractionId: 'b', sourceId: 'other', toolId: 'b', passages: makePassages(32) },
  ] }
  const r = run(id, input)
  assert.equal(list(r, 'checks').length, 64); assert.equal(list(r, 'spans').length, 64)
  input.extractions.push({ extractionId: 'c', sourceId: 's', toolId: 'c', passages: makePassages(1) })
  assert.throws(() => run(id, input), /total-passage-limit/)
  for (const mutate of [
    (x: Row) => { list(x, 'extractions')[1].extractionId = 'x1' },
    (x: Row) => { list(x, 'extractions')[1].toolId = 'tool-a' },
    (x: Row) => { list(x, 'extractions')[0].sourceId = 'missing' },
    (x: Row) => { list(list(x, 'extractions')[0], 'passages')[0].end = 100 },
    (x: Row) => { list(list(x, 'extractions')[0], 'passages').push(list(list(x, 'extractions')[0], 'passages')[0]) },
    (x: Row) => { list(list(x, 'extractions')[0], 'passages').push({ ...list(list(x, 'extractions')[0], 'passages')[0], passageId: 'new' }) },
  ]) { const bad = sample(id); mutate(bad); assert.throws(() => run(id, bad)) }
})

test('reproducibility manifest is sorted, topological, independently hashed and not a signature/replay', () => {
  const id = 'reproducibility-manifest-builder', input = sample(id), r = run(id, input), manifest = r.manifest as Row
  assert.equal(r.manifestSha256, h(json(manifest)))
  assert.deepEqual(r.topologicalArtifactIds, ['corpus', 'result'])
  assert.equal(r.allHashesMatch, true); assert.equal(r.executionReplayed, false); assert.equal(r.signed, false)
  list(input, 'artifacts').reverse(); list(input, 'parameters').reverse()
  assert.equal(run(id, input).manifestSha256, r.manifestSha256)
  const artifact = list(input, 'artifacts').find(a => a.artifactId === 'corpus')!
  artifact.content = 'Tampered corpus'
  const tampered = run(id, input)
  assert.equal(tampered.allHashesMatch, false); assert.notEqual(tampered.manifestSha256, r.manifestSha256)
  artifact.expectedHash = h(artifact.content as string)
  assert.equal(run(id, input).allHashesMatch, true)
  assert.match((tampered.limits as string[]).join(' '), /caller can recompute hashes after editing/)
  const detached = run(id, input), oldHash = detached.manifestSha256
  list(input, 'parameters')[0].value = 'modified after build'
  assert.equal(detached.manifestSha256, oldHash)
  assert.equal(h(json(detached.manifest)), oldHash)
})

test('manifest rejects duplicates/dangling dependencies/cycles and deterministically orders independent roots', () => {
  const id = 'reproducibility-manifest-builder'
  for (const mutate of [
    (x: Row) => list(x, 'artifacts').push(list(x, 'artifacts')[0]),
    (x: Row) => list(x, 'parameters').push(list(x, 'parameters')[0]),
    (x: Row) => { list(x, 'artifacts')[1].dependsOn = ['corpus', 'corpus'] },
    (x: Row) => { list(x, 'artifacts')[1].dependsOn = ['unknown'] },
    (x: Row) => { list(x, 'artifacts')[0].dependsOn = ['corpus'] },
    (x: Row) => { list(x, 'artifacts')[0].dependsOn = ['result'] },
  ]) { const bad = sample(id); mutate(bad); assert.throws(() => run(id, bad)) }
  const input = sample(id)
  list(input, 'artifacts').push({ artifactId: 'a-code', kind: 'code', content: 'code', expectedHash: h('code'), dependsOn: [] })
  assert.deepEqual(run(id, input).topologicalArtifactIds, ['a-code', 'corpus', 'result'])
})

test('identifier/hash constraints reject control characters, path-like IDs, invalid hashes and Unicode surrogates', () => {
  const id = 'passage-hash-validation'
  for (const passageId of ['', '__proto__', 'a/b', 'a\n', 'a'.repeat(81)]) {
    const input = sample(id); list(input, 'passages')[0].passageId = passageId
    assert.throws(() => run(id, input))
  }
  for (const expectedHash of ['sha256:' + 'A'.repeat(64), 'sha256:' + '0'.repeat(63), 'md5:' + '0'.repeat(64), 'sha256:' + '0'.repeat(64) + '\n']) {
    const input = sample(id); list(input, 'passages')[0].expectedHash = expectedHash
    assert.throws(() => run(id, input))
  }
  for (const text of ['\ud800', 'x\udfff']) {
    const input = sample(id); list(input, 'passages')[0].text = text
    assert.throws(() => run(id, input), /invalid-json-string/)
  }
})

test('graph cycles and root reachability agree with an independent bounded breadth-first oracle', () => {
  const id = 'provenance-graph-integrity'
  for (let trial = 0; trial < 20; trial++) {
    const nodes = Array.from({ length: 7 }, (_, i) => ({ nodeId: `n${i}`, kind: i < 2 ? 'source' : 'claim', digestHash: h(`n${i}`) }))
    const edges = nodes.flatMap((a, i) => nodes.filter((b, j) => (i * 13 + j * 19 + trial * 7) % 11 === 0).map(b => ({ edgeId: `${a.nodeId}-${b.nodeId}`, from: a.nodeId, to: b.nodeId, relation: 'cites' })))
    const reach = nodes.map(n => {
      let frontier = edges.filter(e => e.from === n.nodeId).map(e => e.to)
      const visited = new Set<string>()
      for (let depth = 0; depth < nodes.length && frontier.length; depth++) {
        frontier.forEach(v => visited.add(v))
        frontier = [...new Set(frontier.flatMap(v => edges.filter(e => e.from === v).map(e => e.to)))].filter(v => !visited.has(v))
      }
      return visited
    })
    const roots = nodes.filter(n => n.kind === 'source' && !edges.some(e => e.from === n.nodeId)).map(n => n.nodeId)
    const r = run(id, { dataClass: 'synthetic', nodes, edges })
    assert.deepEqual(r.cycleNodeIds, nodes.filter((n, i) => reach[i].has(n.nodeId)).map(n => n.nodeId))
    assert.deepEqual(r.sourceRootIds, roots)
    assert.deepEqual(r.rootlessNodeIds, nodes.filter((n, i) => !roots.some(root => n.nodeId === root || reach[i].has(root))).map(n => n.nodeId))
  }
})

test('provenance handles 64-node chain and 128 distinct edges; rejects 65 nodes or 129 edges', () => {
  const id = 'provenance-graph-integrity'
  const nodes = Array.from({ length: 64 }, (_, i) => ({ nodeId: `n${i}`, kind: i === 0 ? 'source' : 'passage', digestHash: h(`n${i}`) }))
  const edges = Array.from({ length: 63 }, (_, i) => ({ edgeId: `e${i}`, from: `n${i + 1}`, to: `n${i}`, relation: 'derived-from' }))
  const input = { dataClass: 'public', nodes, edges }
  const chain = run(id, input)
  assert.equal(chain.state, 'rooted'); assert.deepEqual(chain.cycleNodeIds, []); assert.deepEqual(chain.rootlessNodeIds, [])
  input.edges.push(...Array.from({ length: 63 }, (_, i) => ({ edgeId: `cite${i}`, from: `n${i + 1}`, to: `n${i}`, relation: 'cites' })))
  input.edges.push({ edgeId: 'x', from: 'n2', to: 'n0', relation: 'cites' }, { edgeId: 'y', from: 'n3', to: 'n0', relation: 'cites' })
  assert.equal(run(id, input).state, 'rooted')
  input.edges.push({ edgeId: 'z', from: 'n4', to: 'n0', relation: 'cites' })
  assert.throws(() => run(id, input), /invalid-input/)
  input.edges.pop(); input.nodes.push({ nodeId: 'n64', kind: 'passage', digestHash: h('n64') })
  assert.throws(() => run(id, input), /invalid-input/)
})

test('maximum 64-paper paired bootstrap remains schema-valid, deterministic and bounded at 2000 replicates', () => {
  const paperIds = Array.from({ length: 64 }, (_, i) => `p${i}`)
  const questions = paperIds.map((paperId, i) => ({ questionId: `q${i}`, paperId, expectedEvidenceIds: [`e${i}`] }))
  const observations = questions.map((q, i) => ({ questionId: q.questionId, paperId: q.paperId, retrievedEvidenceIds: i % 2 ? q.expectedEvidenceIds : [] }))
  const input = freeze({ dataClass: 'synthetic', corpusHash: h('64-cluster-corpus'), paperIds, questions,
    evidence: questions.map(q => ({ evidenceId: q.expectedEvidenceIds[0], paperId: q.paperId })),
    baseline: { runId: 'a', cohortSha256: '', observations }, candidate: { runId: 'b', cohortSha256: '', observations }, seed: 0, resamples: 2000 })
  const r = run('paper-cluster-retrieval-comparison', input)
  assert.equal(r.questionCount, 64); assert.equal(list(r, 'papers').length, 64)
  assert.equal(r.baselineCompleteBps, 5000); assert.equal(r.intervalLowBps, 0); assert.equal(r.intervalHighBps, 0)
  assert.ok(Buffer.byteLength(json(input)) <= 32768); assert.ok(Buffer.byteLength(json(r)) <= 65536)
  assert.deepEqual(validate(r, SPECS['paper-cluster-retrieval-comparison'].resultSchema as Row), [])
})

test('valid cross-paper retrieval distractors never count as expected evidence or complete recovery', () => {
  const input = sample('retrieval-recovery-regression')
  list(input.candidate as Row, 'observations')[0].retrievedEvidenceIds = ['b1']
  list(input.candidate as Row, 'observations')[1].retrievedEvidenceIds = ['a1', 'a2']
  const r = run('retrieval-recovery-regression', input)
  assert.deepEqual(r.candidateCounts, { complete: 0, partial: 0, miss: 2 })
  assert.ok(list(r, 'questions').every(q => q.candidateRecovered === 0))
})

test('locator conversion round-trips every boundary of mixed Unicode/control text', () => {
  const id = 'citation-locator-conversion', text = '😀Aé\n𐐀\t終'
  const chars = Array.from(text)
  for (let start = 0; start <= chars.length; start++) for (let end = start; end <= chars.length; end++) {
    const prefix = chars.slice(0, start).join(''), through = chars.slice(0, end).join('')
    const locators = [
      { locatorId: 'cp', sourceId: 's', unit: 'codepoint', start, end },
      { locatorId: 'u16', sourceId: 's', unit: 'utf16', start: prefix.length, end: through.length },
      { locatorId: 'u8', sourceId: 's', unit: 'utf8', start: Buffer.byteLength(prefix), end: Buffer.byteLength(through) },
    ]
    const r = run(id, { dataClass: 'public', sources: [{ sourceId: 's', text }], locators })
    for (const locator of list(r, 'locators')) {
      assert.equal(locator.codepointStart, start); assert.equal(locator.codepointEnd, end)
      assert.equal(locator.utf16Start, prefix.length); assert.equal(locator.utf8End, Buffer.byteLength(through))
      assert.equal(locator.excerptSha256, h(chars.slice(start, end).join('')))
    }
  }
})

test('implementation imports only crypto and micro-schema, with no network, models or environment dependency', () => {
  const code = readFileSync(new URL('../lib/x402/expansion-evidence.ts', import.meta.url), 'utf8')
  const imports = [...code.matchAll(/from ['"]([^'"]+)['"]/g)].map(m => m[1])
  assert.deepEqual(imports, ['node:crypto', './micro-schema.ts'])
  assert.doesNotMatch(code, /\bprocess\.env\b|\b(?:fetch|Date\.now|Math\.random)\s*\(/)
  assert.doesNotMatch(code, /import\s*\(/)
})
