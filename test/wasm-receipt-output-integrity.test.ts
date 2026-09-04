import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createExecutedCalculationReceipt,
  verifyExecutedCalculationReceipt,
  type KernelArtifact,
  type KernelExecutionRequest,
} from '../packages/wasm-kernel/dist/execution.js'
import { kernelArtifact } from './helpers/wasm-kernel.ts'

const artifact: KernelArtifact = kernelArtifact() as unknown as KernelArtifact

const angleRequest: KernelExecutionRequest = {
  schemaVersion: 'maha-wasm-execution-request/1.0',
  operation: 'normalize-angle-microdegrees',
  inputs: { angleMicrodegrees: '400000000' },
  units: { angleMicrodegrees: 'microdegree', normalizedAngleMicrodegrees: 'microdegree' },
} as never

/**
 * Verification once compared only digests.
 *
 * Recomputation reproduces the receipt the inputs imply, digest included, so
 * comparing digests compared the recomputed receipt against a number the
 * receipt carries about itself. A receipt whose output had been replaced
 * outright kept that number unchanged and verified clean. These tests pin the
 * result comparison that closes it.
 */

test('a receipt verifies against a rerun of the kernel', async () => {
  const receipt = await createExecutedCalculationReceipt(angleRequest, artifact)
  assert.equal(receipt.output.normalizedAngleMicrodegrees, '40000000', '400 degrees normalises to 40')
  assert.deepEqual(await verifyExecutedCalculationReceipt(receipt, artifact), [])
})

test('a replaced output is refused', async () => {
  const receipt = await createExecutedCalculationReceipt(angleRequest, artifact)
  const tampered = { ...receipt, output: { normalizedAngleMicrodegrees: '99000000' } }
  const findings = await verifyExecutedCalculationReceipt(tampered as never, artifact)
  assert.ok(findings.includes('receipt-output-mismatch'),
    `a receipt reporting a result the kernel did not produce must be refused, got ${JSON.stringify(findings)}`)
})

test('a replaced output is refused even with the digest left untouched', async () => {
  // The exact shape of the original defect: the attacker changes the reported
  // result and leaves receiptSha256 alone, because recomputation would
  // reproduce that same digest from the unchanged inputs.
  const receipt = await createExecutedCalculationReceipt(angleRequest, artifact)
  const tampered = { ...receipt, output: { normalizedAngleMicrodegrees: '1' } }
  assert.equal(tampered.receiptSha256, receipt.receiptSha256, 'the digest is deliberately left intact')
  const findings = await verifyExecutedCalculationReceipt(tampered as never, artifact)
  assert.ok(findings.length > 0, 'an intact digest must not rescue a false result')
  assert.ok(findings.includes('receipt-output-mismatch'))
})

test('an added or removed output field is refused', async () => {
  const receipt = await createExecutedCalculationReceipt(angleRequest, artifact)
  const extra = { ...receipt, output: { ...receipt.output, smuggled: '1' } }
  assert.ok((await verifyExecutedCalculationReceipt(extra as never, artifact)).includes('receipt-output-mismatch'))
  const emptied = { ...receipt, output: {} }
  assert.ok((await verifyExecutedCalculationReceipt(emptied as never, artifact)).includes('receipt-output-mismatch'))
})

test('a tampered uncertainty field is refused', async () => {
  const receipt = await createExecutedCalculationReceipt(angleRequest, artifact)
  const tampered = { ...receipt, uncertainty: { normalizedAngleMicrodegrees: '5' } }
  const findings = await verifyExecutedCalculationReceipt(tampered as never, artifact)
  assert.ok(findings.includes('receipt-uncertainty-mismatch'),
    'an invented uncertainty must not pass, since it changes what the receipt claims')
})

test('the digest check still catches a tampered input', async () => {
  // The original check remains useful: it catches a receipt whose inputs were
  // altered, which changes what the recomputation produces.
  const receipt = await createExecutedCalculationReceipt(angleRequest, artifact)
  const tampered = { ...receipt, receiptSha256: 'sha256:' + '0'.repeat(64) }
  const findings = await verifyExecutedCalculationReceipt(tampered as never, artifact)
  assert.ok(findings.includes('receipt-execution-recomputation-mismatch'))
})

test('verification refuses a substituted kernel before it looks at the result', async () => {
  const receipt = await createExecutedCalculationReceipt(angleRequest, artifact)
  const wrongKernel = { ...receipt, kernelSha256: 'sha256:' + 'a'.repeat(64) }
  const findings = await verifyExecutedCalculationReceipt(wrongKernel as never, artifact)
  assert.ok(findings.includes('receipt-kernel-identity-mismatch'))
})

test('a packaged receipt is not rejected for key order alone', () => {
  // The first version of this fix compared raw JSON and rejected identical
  // content whose keys had been reordered, which every canonicalized receipt
  // in a dossier would have hit.
  return (async () => {
    const receipt = await createExecutedCalculationReceipt({
      schemaVersion: 'maha-wasm-execution-request/1.0', operation: 'interval-add',
      inputs: { leftLower: '1000', leftUpper: '1010', rightLower: '500', rightUpper: '505' },
      units: { leftLower: 'nm', leftUpper: 'nm', rightLower: 'nm', rightUpper: 'nm', resultLower: 'nm', resultUpper: 'nm' },
    } as never, artifact)
    const u = receipt.uncertainty as Record<string, string>
    const reordered = { ...receipt, uncertainty: { unit: u.unit, upper: u.upper, lower: u.lower } }
    assert.notEqual(JSON.stringify(reordered.uncertainty), JSON.stringify(receipt.uncertainty),
      'the fixture must actually differ in key order')
    assert.deepEqual(await verifyExecutedCalculationReceipt(reordered as never, artifact), [],
      'identical content in a different key order must verify')
  })()
})

test('reordering does not smuggle a changed value past the comparison', async () => {
  const receipt = await createExecutedCalculationReceipt({
    schemaVersion: 'maha-wasm-execution-request/1.0', operation: 'interval-add',
    inputs: { leftLower: '1000', leftUpper: '1010', rightLower: '500', rightUpper: '505' },
    units: { leftLower: 'nm', leftUpper: 'nm', rightLower: 'nm', rightUpper: 'nm', resultLower: 'nm', resultUpper: 'nm' },
  } as never, artifact)
  const u = receipt.uncertainty as Record<string, string>
  const sneaky = { ...receipt, uncertainty: { unit: u.unit, upper: '9999', lower: u.lower } }
  const findings = await verifyExecutedCalculationReceipt(sneaky as never, artifact)
  assert.ok(findings.includes('receipt-uncertainty-mismatch'),
    'order tolerance must not become value tolerance')
})
