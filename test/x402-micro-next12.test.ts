import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMicroProduct, verifyMicroProduct, microDigest } from '../lib/x402/micro-products.ts'
import { NEXT_IDS, type NextProductId } from '../lib/x402/micro-next-contracts.ts'
import { NEXT_SAMPLES } from '../lib/x402/micro-next-samples.ts'
import { q, decimal, add, mul, cmp } from '../lib/x402/micro-next-numerics.ts'
import { TIRUVAYMOLI_ATLAS_TOPICS } from '../lib/tiruvaymoli-passage-atlas.ts'
const sample = (id: NextProductId) => structuredClone(NEXT_SAMPLES[id])
const run = async (id: NextProductId, input = sample(id)) => (await buildMicroProduct(id, input)).result
const h = (c: string) => `sha256:${c.repeat(64)}`
const fromWire = (v: unknown) => { const f = v as { numerator: string; denominator: string }; return q(BigInt(f.numerator), BigInt(f.denominator)) }

test('next twelve have unique semantic requests, deterministic outputs and tamper refusal', async () => {
  assert.equal(NEXT_IDS.length, 12)
  for (const id of NEXT_IDS) {
    const input = sample(id), result = await buildMicroProduct(id, input)
    assert.deepEqual(await buildMicroProduct(id, input), result)
    assert.equal(await verifyMicroProduct(id, input, result), true)
    const forged = { ...result, result: { ...result.result, manufacturedProof: true } }
    forged.receiptDigest = microDigest(Object.fromEntries(Object.entries(forged).filter(([k]) => k !== 'receiptDigest')))
    assert.equal(await verifyMicroProduct(id, input, forged), false)
    await assert.rejects(run(id, { ...input, privatePassage: 'not-retained' }))
  }
})

test('affine conversion scales uncertainty but never offsets it; differences omit temperature offsets', async () => {
  const id = 'unit-uncertainty-conversion', input = sample(id), r = await run(id, input)
  assert.equal(cmp(fromWire(r.value), q(BigInt(0))), 0)
  assert.equal(cmp(fromWire(r.standardUncertainty), q(BigInt(1))), 0)
  const difference = await run(id, { ...input, value: '18', quantity: 'difference' })
  assert.equal(cmp(fromWire(difference.value), q(BigInt(10))), 0)
  for (const change of [{ to: 'kg' }, { standardUncertainty: '-1' }, { from: 'unknown' }, { value: '1e3' }]) await assert.rejects(run(id, { ...input, ...change }))
  for (const value of ['-10', '0', '1', '273.15']) {
    const f = await run(id, { ...input, from: 'degC', to: 'degF', value })
    assert.equal(cmp(fromWire(f.value), add(mul(decimal(value), q(BigInt(9), BigInt(5))), q(BigInt(32)))), 0)
  }
})

test('linear solver distinguishes solution spaces and proves A*x=b and A*N=0 independently', async () => {
  const id = 'exact-linear-system'
  assert.equal((await run(id)).state, 'unique')
  assert.equal((await run(id, { ...sample(id), matrix: [['1', '1'], ['2', '2']], rhs: ['1', '3'] })).state, 'inconsistent')
  const u = await run(id, { ...sample(id), matrix: [['1', '2', '3']], rhs: ['6'] })
  assert.equal(u.state, 'underdetermined')
  const dot = (v: unknown[]) => v.reduce<ReturnType<typeof q>>((sum, x, i) => add(sum, mul(fromWire(x), q(BigInt(i + 1)))), q(BigInt(0)))
  assert.equal(cmp(dot(u.particular as unknown[]), q(BigInt(6))), 0)
  for (const v of u.nullspace as unknown[][]) assert.equal(cmp(dot(v), q(BigInt(0))), 0)
  for (const change of [{ matrix: [['1'], ['1', '2']] }, { rhs: ['1'] }, { matrix: Array(9).fill(['1']) }]) await assert.rejects(run(id, { ...sample(id), ...change }))
  for (let i = 1; i <= 20; i++) {
    const r = await run(id, { ...sample(id), matrix: [[String(i), '1'], ['0', '1']], rhs: [String(i * 3 + 2), '2'] })
    assert.equal(cmp(fromWire((r.particular as unknown[])[0]), q(BigInt(3))), 0)
  }
})

test('bisection encloses sqrt(2), reports exhaustion and refuses unbracketed or executable input', async () => {
  const id = 'bracketed-polynomial-root', r = await run(id), b = r.bracket as Record<string, unknown>, lo = fromWire(b.lower), hi = fromWire(b.upper)
  assert.ok(cmp(mul(lo, lo), q(BigInt(2))) <= 0 && cmp(mul(hi, hi), q(BigInt(2))) >= 0)
  assert.equal(r.state, 'tolerance-reached')
  assert.equal((await run(id, { ...sample(id), maxIterations: 1 })).state, 'iteration-limit')
  assert.equal((await run(id, { ...sample(id), coefficientsAscending: ['-1', '1'] })).state, 'exact-root')
  for (const change of [{ lower: '2', upper: '3' }, { tolerance: '0' }, { coefficientsAscending: ['0', '0'] }, { expression: 'process.exit()' }]) await assert.rejects(run(id, { ...sample(id), ...change }))
})

test('covariance rejects indefinite/asymmetric matrices and includes cross terms', async () => {
  const id = 'covariance-uncertainty', r = await run(id)
  assert.equal(cmp(fromWire(r.variance), q(BigInt(44))), 0)
  const bounds = r.standardUncertainty as Record<string, unknown>
  assert.ok(cmp(mul(fromWire(bounds.lower), fromWire(bounds.lower)), q(BigInt(44))) <= 0)
  assert.ok(cmp(mul(fromWire(bounds.upper), fromWire(bounds.upper)), q(BigInt(44))) >= 0)
  for (const C of [[['1', '2'], ['2', '1']], [['0', '1'], ['1', '1']], [['1', '0'], ['1', '1']], [['-1', '0'], ['0', '1']]]) await assert.rejects(run(id, { ...sample(id), covariance: C }))
  assert.equal(cmp(fromWire((await run(id, { ...sample(id), covariance: [['0', '0'], ['0', '0']] })).variance), q(BigInt(0))), 0)
})

test('divine-name resolution preserves Mayon ambiguity and never merges namesakes or unknown spellings', async () => {
  const id = 'divine-name-disambiguation'
  assert.equal((await run(id)).state, 'ambiguous')
  for (const name of ['Māyōṉ', 'Tirumāl', 'திருமால்', 'Vishnu', 'Krishna']) assert.equal((await run(id, { ...sample(id), name })).state, 'matched')
  assert.equal((await run(id, { ...sample(id), name: 'not-a-known-name' })).state, 'not-in-supported-index')
  await assert.rejects(run(id, { ...sample(id), expectedRegistryDigest: h('0') }))
  assert.doesNotMatch(JSON.stringify(await run(id)), /CC BY-NC-SA|tolkappiyam-porul-5/)
})

test('every inspected atlas boundary resolves exactly once; unknown numbering is not invented', async () => {
  const id = 'edition-verse-resolution'
  for (const t of TIRUVAYMOLI_ATLAS_TOPICS) for (const pasuram of t.range.split('–').map(Number)) {
    const r = await run(id, { ...sample(id), pasuram })
    assert.equal((r.matches as { slug: string }[])[0].slug, t.slug)
  }
  assert.equal((await run(id, { ...sample(id), pasuram: 1 })).state, 'not-in-inspected-atlas')
  await assert.rejects(run(id, { ...sample(id), editionId: 'another-edition' }))
})

test('reception retrieval preserves attribution and refuses NC-source comparisons rather than dropping sources', async () => {
  const id = 'reception-lineage-retrieval', r = await run(id)
  assert.equal(r.uninterruptedTransmissionProven, false)
  assert.equal((r.evidence as unknown[]).length, 3)
  for (const slug of ['mayon-to-mayan-reception', 'unknown']) await assert.rejects(run(id, { ...sample(id), slug }))
})

test('policy diff is order-independent, content-aware and rejects duplicate IDs or reversed declarations', async () => {
  const id = 'policy-version-comparison', r = await run(id)
  assert.deepEqual(r.changed, [{ clauseId: 'retain', fields: ['text'] }])
  assert.equal(r.legalEffectDetermined, false)
  const input = sample(id), before = input.before as unknown[]
  await assert.rejects(run(id, { ...input, before: [...before, ...before] }))
  await assert.rejects(run(id, { ...input, afterSequence: 0 }))
  const scopeOnly = await run(id, { ...input, after: [{ ...(before[0] as object), scope: 'changed-scope' }] })
  assert.deepEqual(scopeOnly.changed, [{ clauseId: 'retain', fields: ['scope'] }])
})

test('control match refuses stale policy/content, rejected evidence and substituted scope independently', async () => {
  const id = 'control-evidence-gaps', input = sample(id), evidence = input.evidence as Record<string, unknown>[]
  for (const change of [{ policyDigest: h('9') }, { contentDigest: h('9') }, { scope: 'other' }, { status: 'rejected' }]) {
    const r = await run(id, { ...input, evidence: [{ ...evidence[0], ...change }] })
    assert.equal((r.results as { state: string }[])[0].state, 'gap')
  }
  assert.equal((await run(id)).complianceCertified, false)
})

test('MCP comparison refuses schema/transport substitution and unknown protocol versions', async () => {
  const id = 'mcp-contract-compatibility', input = sample(id), offered = input.offered as Record<string, unknown>
  for (const change of [{ transport: 'streamable-http' }, { tools: [] }, { tools: [{ name: 'synthetic-tool', inputSchemaDigest: h('9'), outputSchemaDigest: h('2') }] }]) assert.equal((await run(id, { ...input, offered: { ...offered, ...change } })).state, 'incompatible')
  await assert.rejects(run(id, { ...input, offered: { ...offered, protocolVersion: 'unknown' } }))
})

test('permission changes retain exact resources and flag wildcard additions without evaluating IAM', async () => {
  const id = 'tool-permission-diff', input = sample(id), r = await run(id)
  assert.equal((r.added as unknown[]).length, 1); assert.equal((r.removed as unknown[]).length, 1); assert.equal((r.wildcardAdditions as unknown[]).length, 1)
  assert.equal(r.effectiveAuthorizationEvaluated, false)
  await assert.rejects(run(id, { ...input, after: [...input.after as unknown[], ...input.after as unknown[]] }))
})

test('publication requires all three view kinds and exact source/revision/release/canonical/status agreement', async () => {
  const id = 'publication-bundle-consistency', input = sample(id), views = input.views as Record<string, unknown>[]
  assert.equal((await run(id)).consistent, true)
  for (const change of [{ contentDigest: h('9') }, { releaseDigest: h('9') }, { sourceSetDigest: h('9') }, { canonicalUrl: 'https://wrong.invalid/path' }, { status: 'withdrawn' }]) assert.equal((await run(id, { ...input, views: [{ ...views[0], ...change }, ...views.slice(1)] })).consistent, false)
  assert.equal((await run(id, { ...input, views: views.slice(0, 2) })).consistent, false)
  await assert.rejects(run(id, { ...input, canonicalUrl: 'https://user:password@example.com/' }))
})
