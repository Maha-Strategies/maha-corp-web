import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

import { instantiateKernel } from '../packages/wasm-kernel/src/kernel.ts'
import { createCalculationReceipt, verifyCalculationReceipt } from '../packages/wasm-kernel/src/receipt.ts'
import * as reference from '../packages/wasm-kernel/src/reference.ts'

const PACKAGE = new URL('../packages/wasm-kernel/', import.meta.url)

type Vector = { operation: string; inputs: string[]; output: string }

async function kernel() {
  const bytes = await readFile(new URL('dist/kernel.wasm', PACKAGE))
  return instantiateKernel(bytes)
}

test('the executable WASM kernel matches every frozen conformance vector', async () => {
  const wasm = await kernel()
  const corpus = JSON.parse(await readFile(new URL('conformance/vectors.json', PACKAGE), 'utf8')) as { vectors: Vector[] }
  const callable = wasm as unknown as Record<string, (...inputs: bigint[]) => bigint>
  for (const vector of corpus.vectors) {
    assert.equal(typeof callable[vector.operation], 'function', `${vector.operation} must be exported`)
    assert.equal(callable[vector.operation](...vector.inputs.map(BigInt)).toString(), vector.output, vector.operation)
  }
})

test('the TypeScript reference and WASM agree across bounded integer cases', async () => {
  const wasm = await kernel()
  for (const value of [BigInt("-720000001"), BigInt("-360000000"), BigInt("-1"), BigInt("0"), BigInt("1"), BigInt("359999999"), BigInt("720000001")]) {
    assert.equal(wasm.normalizeAngleMicrodegrees(value), reference.normalizeAngleMicrodegrees(value))
  }
  for (const [numerator, denominator] of [[BigInt("5"), BigInt("2")], [BigInt("7"), BigInt("2")], [BigInt("-5"), BigInt("2")], [BigInt("5"), BigInt("-2")], [BigInt("8"), BigInt("3")]] as const) {
    assert.equal(wasm.divideHalfEven(numerator, denominator), reference.divideHalfEven(numerator, denominator))
  }
  for (const value of [BigInt("0"), BigInt("1"), BigInt("2"), BigInt("15"), BigInt("16"), BigInt("17"), BigInt("1000000")]) {
    assert.equal(wasm.integerSqrt(value), reference.integerSqrt(value))
  }
})

test('half-even rounding does not systematically round ties upward', async () => {
  const wasm = await kernel()
  assert.equal(wasm.divideHalfEven(BigInt("5"), BigInt("2")), BigInt("2"))
  assert.equal(wasm.divideHalfEven(BigInt("7"), BigInt("2")), BigInt("4"))
  assert.equal(wasm.divideHalfEven(BigInt("-5"), BigInt("2")), BigInt("-2"))
  assert.equal(wasm.divideHalfEven(BigInt("-7"), BigInt("2")), BigInt("-4"))
})

test('calculation receipts are deterministic, normalized, and tamper-evident', async () => {
  const input = {
    module: 'core.angle', operation: 'normalize', inputs: { angle: '-1' }, units: { angle: 'microdegree' },
    constants: { fullCircle: '360000000' }, output: { angle: '359999999' }, uncertainty: { angle: '0' },
    precisionPolicy: 'signed i64; exact modulo', kernelVersion: '0.1.0',
    kernelSha256: `sha256:${'a'.repeat(64)}`, conformanceVersion: 'maha-wasm-conformance/1.0', runtime: 'wasm-i64-fixed-point' as const,
    proofReferences: [], witnessReceiptIds: [],
  }
  const first = await createCalculationReceipt(input)
  const reordered = await createCalculationReceipt({ ...input, inputs: { angle: '-1' }, module: 'core.angle'.normalize('NFD') })
  assert.equal(first.receiptSha256, reordered.receiptSha256)
  assert.equal(await verifyCalculationReceipt(first), true)
  assert.equal(await verifyCalculationReceipt({ ...first, output: { angle: '0' } }), false)
})

test('receipt construction rejects missing identity and fake kernel digests', async () => {
  const base = {
    module: 'core', operation: 'x', inputs: {}, units: {}, constants: {}, output: {}, uncertainty: {},
    precisionPolicy: 'exact', kernelVersion: '0.1.0', kernelSha256: 'not-a-digest',
    conformanceVersion: 'maha-wasm-conformance/1.0', runtime: 'wasm-i64-fixed-point' as const,
  }
  await assert.rejects(createCalculationReceipt(base), /kernelSha256/)
  await assert.rejects(createCalculationReceipt({ ...base, kernelSha256: `sha256:${'a'.repeat(64)}`, module: '' }), /required/)
})

test('the experimental kernel is absent from routes and public projection', async () => {
  const [appFiles, sitemap, llms] = await Promise.all([
    readdir(new URL('../app/', import.meta.url), { recursive: true }),
    readFile(new URL('../app/sitemap.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/llms.txt/route.ts', import.meta.url), 'utf8'),
  ])
  const routeSources = await Promise.all(appFiles.filter((file) => /\.(ts|tsx)$/.test(file)).map((file) => readFile(new URL(`../app/${file}`, import.meta.url), 'utf8')))
  assert.equal(routeSources.some((source) => source.includes('@maha/wasm-kernel') || source.includes('packages/wasm-kernel')), false)
  assert.doesNotMatch(sitemap, /wasm-kernel/)
  assert.doesNotMatch(llms, /wasm-kernel/)
})
