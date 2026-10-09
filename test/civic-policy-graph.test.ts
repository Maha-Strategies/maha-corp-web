import assert from 'node:assert/strict'
import test from 'node:test'
import { computePolicyDigest, type PolicyNode } from '../lib/civic/policy-graph.ts'

// Independent of the evolving live registry; every value is synthetic.
const fixture: PolicyNode = {
  id: 'synthetic-procurement',
  title: 'Synthetic procurement policy',
  category: 'anti-corruption',
  summary: 'Synthetic fixture for receipt verification only.',
  primaryLegislativeSources: [
    { citation: 'Synthetic source A', url: 'https://example.test/a', digest: 'a'.repeat(64) },
    { citation: 'Synthetic source B', url: 'https://example.test/b' },
  ],
  economicVariables: [
    { name: 'Illustrative spending', baselineValue: 100, projectedImpactDelta: -20.5, unit: 'Billion USD', confidenceInterval: [-30, -10] },
    { name: 'Illustrative review capacity', baselineValue: 3, projectedImpactDelta: 1, unit: 'Index points', confidenceInterval: [0.5, 1.5] },
  ],
  tradeoffsAndDownsides: ['Synthetic implementation cost', 'Synthetic review delay'],
  evidenceBasis: 'Synthetic test fixture; not a policy claim.',
}

// Independently computed SHA-256 of the fixture's sorted, compact JSON bytes.
// These finite decimal values have the same representation under RFC 8785.
const expectedDigest = '06811b59b82fc33e3c24040ba407f1699b7852ff66090b22e5b05237071d748f'

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]))
  }
  return value
}

test('policy digest is deterministic across repeated calls and detached JSON copies', () => {
  assert.match(computePolicyDigest(fixture), /^[a-f0-9]{64}$/)
  for (let i = 0; i < 10; i++) assert.equal(computePolicyDigest(fixture), expectedDigest)
  assert.equal(computePolicyDigest(structuredClone(fixture)), expectedDigest)
  assert.equal(computePolicyDigest(JSON.parse(JSON.stringify(fixture))), expectedDigest)
})

test('policy digest is unchanged by object key order at every nesting level', () => {
  const reordered = reverseObjectKeys(fixture) as PolicyNode
  assert.notEqual(JSON.stringify(reordered), JSON.stringify(fixture))
  assert.equal(computePolicyDigest(reordered), expectedDigest)
})

const mutations: [string, (node: PolicyNode) => void][] = [
  ['ID', node => { node.id = 'synthetic-revised' }],
  ['title', node => { node.title += ' revised' }],
  ['category', node => { node.category = 'healthcare-transparency' }],
  ['summary', node => { node.summary += ' Revised.' }],
  ['evidence basis', node => { node.evidenceBasis += ' Revised.' }],
  ['primary citation', node => { node.primaryLegislativeSources[0].citation += ' revised' }],
  ['primary URL', node => { node.primaryLegislativeSources[0].url = 'https://example.test/revised' }],
  ['source-byte digest', node => { node.primaryLegislativeSources[0].digest = 'b'.repeat(64) }],
  ['source-byte digest removal', node => { delete node.primaryLegislativeSources[0].digest }],
  ['source removal', node => { node.primaryLegislativeSources.pop() }],
  ['variable name', node => { node.economicVariables[0].name += ' revised' }],
  ['baseline', node => { node.economicVariables[0].baselineValue += 1 }],
  ['impact delta', node => { node.economicVariables[0].projectedImpactDelta = -21 }],
  ['unit', node => { node.economicVariables[0].unit = 'Million USD' }],
  ['lower impact bound', node => { node.economicVariables[0].confidenceInterval[0] = -31 }],
  ['upper impact bound', node => { node.economicVariables[0].confidenceInterval[1] = -9 }],
  ['variable removal', node => { node.economicVariables.pop() }],
  ['downside text', node => { node.tradeoffsAndDownsides[0] += ' revised' }],
  ['downside removal', node => { node.tradeoffsAndDownsides.pop() }],
]

for (const [field, mutate] of mutations) {
  test(`policy digest detects tampering with ${field}`, () => {
    const changed = structuredClone(fixture)
    mutate(changed)
    assert.notEqual(computePolicyDigest(changed), expectedDigest)
    assert.equal(computePolicyDigest(fixture), expectedDigest)
  })
}

test('policy digest preserves the order of source, economic-variable and downside arrays', () => {
  for (const key of ['primaryLegislativeSources', 'economicVariables', 'tradeoffsAndDownsides'] as const) {
    const changed = structuredClone(fixture)
    changed[key].reverse()
    assert.notEqual(computePolicyDigest(changed), expectedDigest, key)
  }
})

test('hashing does not mutate the caller and later nested edits cannot alter an issued digest', () => {
  const caller = structuredClone(fixture), before = structuredClone(caller)
  const recordedDigest = computePolicyDigest(caller)
  assert.deepEqual(caller, before)
  caller.economicVariables[0].baselineValue = 101
  assert.equal(recordedDigest, expectedDigest)
  assert.notEqual(computePolicyDigest(caller), recordedDigest)
  caller.economicVariables[0].baselineValue = 100
  assert.equal(computePolicyDigest(caller), recordedDigest)
})

test('malformed or unexpected policy fields are rejected before issuing a digest', () => {
  assert.throws(() => computePolicyDigest({ ...fixture, unexpected: true } as PolicyNode))
  assert.throws(() => computePolicyDigest({ ...fixture, primaryLegislativeSources: [{ ...fixture.primaryLegislativeSources[0], digest: 'invalid' }] }))
  assert.throws(() => computePolicyDigest({ ...fixture, economicVariables: [{ ...fixture.economicVariables[0], baselineValue: Infinity }] }))
  assert.throws(() => computePolicyDigest({ ...fixture, economicVariables: [{ ...fixture.economicVariables[0], confidenceInterval: [-10, -30] }] }))
})
