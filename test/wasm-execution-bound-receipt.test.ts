import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  createExecutedCalculationReceipt,
  executeKernelRequest,
  verifyExecutedCalculationReceipt,
  verifyKernelArtifact,
  type KernelArtifact,
  type KernelExecutionRequest,
} from '../packages/wasm-kernel/dist/execution.js'

const artifact: KernelArtifact = {
  bytes: readFileSync(resolve('packages/wasm-kernel/dist/kernel.wasm')),
  manifest: JSON.parse(readFileSync(resolve('packages/wasm-kernel/conformance/kernel-manifest.json'), 'utf8')),
}

const request = (operation: KernelExecutionRequest['operation'], inputs: Record<string, string>, units: Record<string, string>): KernelExecutionRequest => ({
  schemaVersion: 'maha-wasm-execution-request/1.0', operation, inputs, units,
})

test('embedded kernel identity is validated from its actual bytes', async () => {
  assert.deepEqual(await verifyKernelArtifact(artifact), [])
  const changed = new Uint8Array(artifact.bytes); changed[changed.length - 1] ^= 1
  assert.ok((await verifyKernelArtifact({ ...artifact, bytes: changed })).includes('kernel-byte-digest-mismatch'))
})

test('celestial angle receipt is produced by and independently rerun against WASM', async () => {
  const item = request('normalize-angle-microdegrees', { angleMicrodegrees: '-1000000' }, { angleMicrodegrees: 'microdegree', normalizedAngleMicrodegrees: 'microdegree' })
  const receipt = await createExecutedCalculationReceipt(item, artifact)
  assert.deepEqual(receipt.output, { normalizedAngleMicrodegrees: '359000000' })
  assert.deepEqual(await verifyExecutedCalculationReceipt(receipt, artifact), [])
})

test('semiconductor thermal receipts preserve exact fixed-point units and outputs', async () => {
  const resistance = await createExecutedCalculationReceipt(request(
    'layer-thermal-resistance-nanokelvin-per-watt',
    { thicknessNanometers: '100', areaSquareMicrometers: '1000', conductivityMilliwattsPerMeterKelvin: '200000' },
    { thicknessNanometers: 'nm', areaSquareMicrometers: 'um2', conductivityMilliwattsPerMeterKelvin: 'mW/(m*K)', resistanceNanoKelvinPerWatt: 'nK/W' },
  ), artifact)
  assert.deepEqual(resistance.output, { resistanceNanoKelvinPerWatt: '500000000' })
  const rise = await createExecutedCalculationReceipt(request(
    'temperature-rise-microkelvin',
    { heatMilliwatts: '250', resistanceNanoKelvinPerWatt: resistance.output.resistanceNanoKelvinPerWatt },
    { heatMilliwatts: 'mW', resistanceNanoKelvinPerWatt: 'nK/W', temperatureRiseMicrokelvin: 'uK' },
  ), artifact)
  assert.deepEqual(rise.output, { temperatureRiseMicrokelvin: '125000' })
  assert.deepEqual(await verifyExecutedCalculationReceipt(rise, artifact), [])
})

test('interval uncertainty propagation is executed at both WASM bounds', async () => {
  const item = request('interval-add', { leftLower: '-5', leftUpper: '10', rightLower: '2', rightUpper: '8' }, {
    leftLower: 'mK', leftUpper: 'mK', rightLower: 'mK', rightUpper: 'mK', resultLower: 'mK', resultUpper: 'mK',
  })
  assert.deepEqual(await executeKernelRequest(item, artifact), { output: { interval: '[-3,18]' }, uncertainty: { lower: '-3', upper: '18', unit: 'mK' } })
})

test('unknown operations, wrong units, malformed integers and overflow fail closed', async () => {
  await assert.rejects(() => executeKernelRequest(request('unknown' as KernelExecutionRequest['operation'], {}, {}), artifact), /Unsupported/)
  await assert.rejects(() => executeKernelRequest(request('normalize-angle-microdegrees', { angleMicrodegrees: '1' }, { angleMicrodegrees: 'degree', normalizedAngleMicrodegrees: 'degree' }), artifact), /microdegree/)
  await assert.rejects(() => executeKernelRequest(request('normalize-angle-microdegrees', { angleMicrodegrees: '01' }, { angleMicrodegrees: 'microdegree', normalizedAngleMicrodegrees: 'microdegree' }), artifact), /canonical base-10/)
  await assert.rejects(() => executeKernelRequest(request('interval-add', { leftLower: '9223372036854775807', leftUpper: '9223372036854775807', rightLower: '1', rightUpper: '1' }, { leftLower: 'x', leftUpper: 'x', rightLower: 'x', rightUpper: 'x', resultLower: 'x', resultUpper: 'x' }), artifact), /aborted|overflow|unreachable/i)
})

test('self-consistent receipt substitution cannot cross kernel or conformance identity', async () => {
  const receipt = await createExecutedCalculationReceipt(request('normalize-angle-microdegrees', { angleMicrodegrees: '1' }, { angleMicrodegrees: 'microdegree', normalizedAngleMicrodegrees: 'microdegree' }), artifact)
  assert.ok((await verifyExecutedCalculationReceipt({ ...receipt, kernelSha256: `sha256:${'0'.repeat(64)}` }, artifact)).includes('receipt-kernel-identity-mismatch'))
  assert.ok((await verifyExecutedCalculationReceipt({ ...receipt, conformanceSha256: `sha256:${'0'.repeat(64)}` }, artifact)).includes('receipt-conformance-identity-mismatch'))
})
