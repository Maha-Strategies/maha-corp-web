import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { canonicalJson as dossierCanonicalJson } from '../lib/evidence-dossier/digest.ts'
import { attachCalculationReceiptToDossier, serializeDossierCalculationAttachment } from '../packages/wasm-kernel/dist/dossier.js'
import { instantiateKernel } from '../packages/wasm-kernel/src/kernel.ts'
import { createCalculationReceipt, verifyCalculationReceipt } from '../packages/wasm-kernel/src/receipt.ts'
import { canonicalJson as kernelCanonicalJson } from '../packages/wasm-kernel/src/receipt.ts'
import * as reference from '../packages/wasm-kernel/src/reference.ts'
import { addIntervals, createOptionalThermalReceiptInput, temperatureRiseInterval, thermalResistanceInterval } from '../packages/wasm-kernel/src/uncertainty.ts'

const PACKAGE = new URL('../packages/wasm-kernel/', import.meta.url)

type Vector = { operation: string; inputs: string[]; output: string }
const BUILD = mkdtempSync(join(tmpdir(), 'maha-wasm-kernel-test-'))
const WASM = join(BUILD, 'kernel.wasm')
execFileSync(join(import.meta.dirname, '../node_modules/.bin/asc'), [
  join(import.meta.dirname, '../packages/wasm-kernel/assembly/index.ts'),
  '--outFile', WASM, '--optimize', '--runtime', 'stub', '--exportRuntime',
])
process.on('exit', () => rmSync(BUILD, { recursive: true, force: true }))

async function kernel() {
  const bytes = await readFile(WASM)
  return instantiateKernel(bytes)
}

test('the executable WASM kernel matches every frozen conformance vector', async () => {
  const wasm = await kernel()
  const corpus = JSON.parse(await readFile(new URL('conformance/vectors.json', PACKAGE), 'utf8')) as { vectors: Vector[] }
  assert.ok(corpus.vectors.length >= 100)
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

test('checked arithmetic aborts rather than wrapping signed i64 values', async () => {
  const wasm = await kernel()
  assert.throws(() => wasm.intervalAddUpper(BigInt('9223372036854775807'), BigInt('1')), WebAssembly.RuntimeError)
  assert.throws(() => wasm.convertScaled(BigInt('9223372036854775807'), BigInt('2'), BigInt('1')), WebAssembly.RuntimeError)
  assert.throws(() => wasm.rootSumSquaresFloor(BigInt('3037000500'), BigInt('0')), WebAssembly.RuntimeError)
  assert.throws(() => wasm.layerThermalResistanceNanoKelvinPerWatt(BigInt('10000'), BigInt('1'), BigInt('1')), WebAssembly.RuntimeError)
  assert.throws(() => wasm.divideHalfEven(BigInt('-9223372036854775808'), BigInt('1')), WebAssembly.RuntimeError)
})

test('celestial primitives normalize boundaries without floating-point ambiguity', async () => {
  const wasm = await kernel()
  assert.equal(wasm.angularSeparationMicrodegrees(BigInt('1'), BigInt('359999999')), BigInt('2'))
  assert.equal(wasm.zodiacSignIndex(BigInt('359999999')), BigInt('11'))
  assert.equal(wasm.zodiacBoundaryDistanceMicrodegrees(BigInt('29999999')), BigInt('1'))
  assert.equal(wasm.zodiacBoundaryDistanceMicrodegrees(BigInt('30000000')), BigInt('0'))
})

test('semiconductor thermal primitives preserve declared units and half-even rounding', async () => {
  const wasm = await kernel()
  const resistance = wasm.layerThermalResistanceNanoKelvinPerWatt(BigInt('100'), BigInt('1000000'), BigInt('100000'))
  assert.equal(resistance, BigInt('1000000'))
  // 1000 mW = 1 W and 1,000,000 nK/W = 1,000 µK/W.
  assert.equal(wasm.temperatureRiseMicrokelvin(BigInt('1000'), resistance), BigInt('1000'))
  assert.throws(() => wasm.layerThermalResistanceNanoKelvinPerWatt(BigInt('1'), BigInt('0'), BigInt('1')), WebAssembly.RuntimeError)
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
    canonicalizationVersion: 'maha-dossier-canonical/1.0' as const,
    module: 'core.angle', operation: 'normalize', inputs: { angle: '-1' }, units: { angle: 'microdegree' },
    constants: { fullCircle: '360000000' }, output: { angle: '359999999' }, uncertainty: { angle: '0' },
    precisionPolicy: 'signed i64; exact modulo', kernelVersion: '0.1.0',
    kernelSha256: `sha256:${'a'.repeat(64)}`, conformanceVersion: 'maha-wasm-conformance/1.0', runtime: 'wasm-i64-fixed-point' as const,
    proofReferences: [], witnessReceiptIds: [],
    compiler: { name: 'assemblyscript' as const, version: '0.28.20', flags: ['--optimize', '--runtime=stub'] },
    arithmetic: { integerModel: 'signed-i64' as const, rounding: 'nearest-ties-to-even' as const, overflow: 'abort' as const },
    conformanceSha256: `sha256:${'b'.repeat(64)}`,
  }
  const first = await createCalculationReceipt(input)
  const reordered = await createCalculationReceipt({ ...input, inputs: { angle: '-1' }, module: 'core.angle'.normalize('NFD') })
  assert.equal(first.receiptSha256, reordered.receiptSha256)
  assert.equal(await verifyCalculationReceipt(first), true)
  assert.equal(await verifyCalculationReceipt({ ...first, output: { angle: '0' } }), false)
})

test('kernel and Evidence Dossier canonicalization are byte-identical for scientific payloads', () => {
  const cases: unknown[] = [
    { B: 2, a: 1 },
    { '1x': 1, Ax: 3, ax: 2 },
    { az: 2, 'ä': 1 },
    { 'Å': '3.82', Bc2: '54', mu: '0.13', tau: '1.4', Tc: '92' },
    { instant: '2026-08-27T05:00+00:00', decomposed: 'A\u030A', nested: { Ω: '12', µ: '0.3' } },
  ]
  for (const value of cases) assert.equal(kernelCanonicalJson(value), dossierCanonicalJson(value))
  assert.equal(kernelCanonicalJson(cases[3]), '{"Bc2":"54","Tc":"92","mu":"0.13","tau":"1.4","Å":"3.82"}')
})

test('uncertainty propagation matches frozen reproducibility fixtures with outward rounding', async () => {
  const fixture = JSON.parse(await readFile(new URL('conformance/uncertainty-vectors.json', PACKAGE), 'utf8')) as { vectors: Array<{ operation: string; inputs: Record<string, unknown>; output: unknown }> }
  for (const vector of fixture.vectors) {
    const actual = vector.operation === 'thermalResistanceInterval'
      ? thermalResistanceInterval(vector.inputs as unknown as Parameters<typeof thermalResistanceInterval>[0])
      : vector.operation === 'temperatureRiseInterval'
        ? temperatureRiseInterval(vector.inputs as unknown as Parameters<typeof temperatureRiseInterval>[0])
        : addIntervals(vector.inputs.left as Parameters<typeof addIntervals>[0], vector.inputs.right as Parameters<typeof addIntervals>[1])
    assert.deepEqual(actual, vector.output, vector.operation)
  }
})

test('optional calculations never invent absent inputs or zero-width uncertainty', () => {
  assert.equal(createOptionalThermalReceiptInput(), null)
  assert.throws(() => createOptionalThermalReceiptInput({
    thicknessNanometers: { lower: '100', upper: '100', unit: 'nm' },
    areaSquareMicrometers: { lower: '', upper: '', unit: 'um2' },
    conductivityMilliwattsPerMeterKelvin: { lower: '25000', upper: '25000', unit: 'mW/(m*K)' },
    kernel: { kernelVersion: '0.3.0', kernelSha256: `sha256:${'a'.repeat(64)}`, conformanceVersion: '3.0', conformanceSha256: `sha256:${'b'.repeat(64)}`, compiler: { name: 'assemblyscript', version: '0.28.20', flags: ['--optimize'] } },
  }), /must declare integer/)
})

test('kernel canonicalization contains no locale-sensitive comparator', async () => {
  const source = await readFile(new URL('../packages/wasm-kernel/src/receipt.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /localeCompare|Intl\.Collator/)
})

test('receipt construction rejects missing identity and fake kernel digests', async () => {
  const base = {
    canonicalizationVersion: 'maha-dossier-canonical/1.0' as const,
    module: 'core', operation: 'x', inputs: {}, units: {}, constants: {}, output: {}, uncertainty: {},
    precisionPolicy: 'exact', kernelVersion: '0.1.0', kernelSha256: 'not-a-digest',
    conformanceVersion: 'maha-wasm-conformance/1.0', runtime: 'wasm-i64-fixed-point' as const,
    compiler: { name: 'assemblyscript' as const, version: '0.28.20', flags: ['--optimize'] },
    arithmetic: { integerModel: 'signed-i64' as const, rounding: 'nearest-ties-to-even' as const, overflow: 'abort' as const },
    conformanceSha256: `sha256:${'b'.repeat(64)}`,
  }
  await assert.rejects(createCalculationReceipt(base), /kernelSha256/)
  await assert.rejects(createCalculationReceipt({ ...base, kernelSha256: `sha256:${'a'.repeat(64)}`, module: '' }), /required/)
})

test('dossier attachments accept only valid receipts and serialize deterministically', async () => {
  const receipt = await createCalculationReceipt({
    canonicalizationVersion: 'maha-dossier-canonical/1.0',
    module: 'semiconductor.thermal', operation: 'layer-resistance', inputs: { thicknessNanometers: '100' }, units: { output: 'nanoK/W' },
    constants: {}, output: { resistance: '1000000' }, uncertainty: { lower: '1000000', upper: '1000000' },
    precisionPolicy: 'signed i64; nearest ties to even; abort on overflow', kernelVersion: '0.2.0', kernelSha256: `sha256:${'a'.repeat(64)}`,
    conformanceVersion: 'maha-wasm-conformance/2.0', runtime: 'wasm-i64-fixed-point',
    compiler: { name: 'assemblyscript', version: '0.28.20', flags: ['--optimize', '--runtime=stub'] },
    arithmetic: { integerModel: 'signed-i64', rounding: 'nearest-ties-to-even', overflow: 'abort' },
    conformanceSha256: `sha256:${'b'.repeat(64)}`,
  })
  const first = await attachCalculationReceiptToDossier({ dossierId: 'dossier_hbn', claimIds: ['claim_b', 'claim_a'], receipt })
  const second = await attachCalculationReceiptToDossier({ dossierId: 'dossier_hbn', claimIds: ['claim_b', 'claim_a'], receipt })
  assert.equal(serializeDossierCalculationAttachment(first), serializeDossierCalculationAttachment(second))
  assert.deepEqual(first.claimIds, ['claim_a', 'claim_b'])
  await assert.rejects(attachCalculationReceiptToDossier({ dossierId: 'dossier_hbn', claimIds: ['claim_a'], receipt: { ...receipt, output: { resistance: '0' } } }), /invalid/)
})

test('two independent builds produce byte-identical WASM', async () => {
  const second = join(BUILD, 'kernel-second.wasm')
  execFileSync(join(import.meta.dirname, '../node_modules/.bin/asc'), [
    join(import.meta.dirname, '../packages/wasm-kernel/assembly/index.ts'), '--outFile', second, '--optimize', '--runtime', 'stub', '--exportRuntime',
  ])
  assert.deepEqual(await readFile(WASM), await readFile(second))
})

test('the reproducibility manifest binds source, conformance corpus, compiler, and generated kernel', async () => {
  const manifest = JSON.parse(await readFile(new URL('conformance/kernel-manifest.json', PACKAGE), 'utf8')) as {
    schemaVersion: string
    compiler: { version: string; flags: string[] }
    sourceSha256: string
    conformanceSha256: string
    uncertaintyConformanceSha256: string
    kernelSha256: string
  }
  const sha = (bytes: Uint8Array): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  assert.equal(manifest.schemaVersion, 'maha-wasm-kernel-manifest/1.0')
  assert.equal(manifest.compiler.version, '0.28.20')
  assert.deepEqual(manifest.compiler.flags, ['--optimize', '--runtime=stub', '--exportRuntime'])
  assert.equal(manifest.sourceSha256, sha(await readFile(new URL('assembly/index.ts', PACKAGE))))
  assert.equal(manifest.conformanceSha256, sha(await readFile(new URL('conformance/vectors.json', PACKAGE))))
  assert.equal(manifest.uncertaintyConformanceSha256, sha(await readFile(new URL('conformance/uncertainty-vectors.json', PACKAGE))))
  assert.equal(manifest.kernelSha256, sha(await readFile(WASM)))
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
