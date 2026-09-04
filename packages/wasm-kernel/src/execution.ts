import { instantiateKernel } from './kernel.js'
import {
  createCalculationReceipt,
  type CalculationReceipt,
  type CalculationReceiptInput,
} from './receipt.js'

export const EXECUTABLE_KERNEL_MODULE = '@maha/wasm-kernel' as const
export const EXECUTION_REQUEST_SCHEMA = 'maha-wasm-execution-request/1.0' as const

export type ExecutableKernelOperation =
  | 'normalize-angle-microdegrees'
  | 'layer-thermal-resistance-nanokelvin-per-watt'
  | 'temperature-rise-microkelvin'
  | 'interval-add'

export interface KernelManifest {
  schemaVersion: 'maha-wasm-kernel-manifest/1.0'
  kernelVersion: string
  abi: 'wasm-i64-fixed-point'
  compiler: Readonly<{ name: 'assemblyscript'; version: string; flags: readonly string[] }>
  arithmetic: Readonly<{ integerModel: 'signed-i64'; rounding: 'nearest-ties-to-even'; overflow: 'abort' }>
  sourceSha256: string
  conformanceVersion: string
  conformanceSha256: string
  uncertaintyConformanceSha256: string
  kernelSha256: string
}

export interface KernelExecutionRequest {
  schemaVersion: typeof EXECUTION_REQUEST_SCHEMA
  operation: ExecutableKernelOperation
  inputs: Readonly<Record<string, string>>
  units: Readonly<Record<string, string>>
  constants?: Readonly<Record<string, string>>
}

export interface KernelArtifact {
  bytes: Uint8Array
  manifest: KernelManifest
}

const DIGEST = /^sha256:[a-f0-9]{64}$/
const INTEGER = /^-?(0|[1-9][0-9]*)$/

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

async function digestBytes(bytes: Uint8Array): Promise<string> {
  const value = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return `sha256:${[...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function exactKeys(value: Readonly<Record<string, string>>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort(codeUnitCompare)
  const wanted = [...expected].sort(codeUnitCompare)
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(`${label} keys must be exactly: ${wanted.join(', ')}.`)
}

function integer(value: string, name: string): bigint {
  if (!INTEGER.test(value)) throw new Error(`${name} must be a canonical base-10 integer.`)
  const parsed = BigInt(value)
  if (parsed < BigInt('-9223372036854775808') || parsed > BigInt('9223372036854775807')) throw new Error(`${name} exceeds the signed-i64 range.`)
  return parsed
}

function requireUnit(units: Readonly<Record<string, string>>, names: readonly string[], expected: string): void {
  for (const name of names) if (units[name] !== expected) throw new Error(`${name} must use unit ${expected}.`)
}

export async function verifyKernelArtifact(artifact: KernelArtifact): Promise<string[]> {
  const findings: string[] = []
  const manifest = artifact.manifest
  if (manifest.schemaVersion !== 'maha-wasm-kernel-manifest/1.0' || manifest.abi !== 'wasm-i64-fixed-point') findings.push('kernel-manifest-schema-invalid')
  if (!manifest.conformanceVersion || !DIGEST.test(manifest.conformanceSha256) || !DIGEST.test(manifest.uncertaintyConformanceSha256)) findings.push('kernel-conformance-identity-invalid')
  if (!DIGEST.test(manifest.kernelSha256) || manifest.kernelSha256 !== await digestBytes(artifact.bytes)) findings.push('kernel-byte-digest-mismatch')
  if (manifest.compiler.name !== 'assemblyscript' || !manifest.compiler.version || !manifest.compiler.flags.length) findings.push('kernel-compiler-identity-invalid')
  if (manifest.arithmetic.integerModel !== 'signed-i64' || manifest.arithmetic.rounding !== 'nearest-ties-to-even' || manifest.arithmetic.overflow !== 'abort') findings.push('kernel-arithmetic-policy-invalid')
  try { await instantiateKernel(artifact.bytes as BufferSource) } catch { findings.push('kernel-instantiation-failed') }
  return [...new Set(findings)]
}

export async function executeKernelRequest(request: KernelExecutionRequest, artifact: KernelArtifact): Promise<Pick<CalculationReceiptInput, 'output' | 'uncertainty'>> {
  const artifactFindings = await verifyKernelArtifact(artifact)
  if (artifactFindings.length) throw new Error(`Kernel artifact is invalid: ${artifactFindings.join(',')}`)
  if (request.schemaVersion !== EXECUTION_REQUEST_SCHEMA) throw new Error('Execution request schema is invalid.')
  if (Object.keys(request.constants ?? {}).length) throw new Error('This kernel version does not declare operation constants.')
  const kernel = await instantiateKernel(artifact.bytes as BufferSource)

  if (request.operation === 'normalize-angle-microdegrees') {
    exactKeys(request.inputs, ['angleMicrodegrees'], 'input')
    exactKeys(request.units, ['angleMicrodegrees', 'normalizedAngleMicrodegrees'], 'unit')
    requireUnit(request.units, ['angleMicrodegrees', 'normalizedAngleMicrodegrees'], 'microdegree')
    return { output: { normalizedAngleMicrodegrees: kernel.normalizeAngleMicrodegrees(integer(request.inputs.angleMicrodegrees, 'angleMicrodegrees')).toString() }, uncertainty: {} }
  }
  if (request.operation === 'layer-thermal-resistance-nanokelvin-per-watt') {
    exactKeys(request.inputs, ['areaSquareMicrometers', 'conductivityMilliwattsPerMeterKelvin', 'thicknessNanometers'], 'input')
    exactKeys(request.units, ['areaSquareMicrometers', 'conductivityMilliwattsPerMeterKelvin', 'resistanceNanoKelvinPerWatt', 'thicknessNanometers'], 'unit')
    requireUnit(request.units, ['thicknessNanometers'], 'nm')
    requireUnit(request.units, ['areaSquareMicrometers'], 'um2')
    requireUnit(request.units, ['conductivityMilliwattsPerMeterKelvin'], 'mW/(m*K)')
    requireUnit(request.units, ['resistanceNanoKelvinPerWatt'], 'nK/W')
    const value = kernel.layerThermalResistanceNanoKelvinPerWatt(
      integer(request.inputs.thicknessNanometers, 'thicknessNanometers'),
      integer(request.inputs.areaSquareMicrometers, 'areaSquareMicrometers'),
      integer(request.inputs.conductivityMilliwattsPerMeterKelvin, 'conductivityMilliwattsPerMeterKelvin'),
    )
    return { output: { resistanceNanoKelvinPerWatt: value.toString() }, uncertainty: {} }
  }
  if (request.operation === 'temperature-rise-microkelvin') {
    exactKeys(request.inputs, ['heatMilliwatts', 'resistanceNanoKelvinPerWatt'], 'input')
    exactKeys(request.units, ['heatMilliwatts', 'resistanceNanoKelvinPerWatt', 'temperatureRiseMicrokelvin'], 'unit')
    requireUnit(request.units, ['heatMilliwatts'], 'mW')
    requireUnit(request.units, ['resistanceNanoKelvinPerWatt'], 'nK/W')
    requireUnit(request.units, ['temperatureRiseMicrokelvin'], 'uK')
    const value = kernel.temperatureRiseMicrokelvin(integer(request.inputs.heatMilliwatts, 'heatMilliwatts'), integer(request.inputs.resistanceNanoKelvinPerWatt, 'resistanceNanoKelvinPerWatt'))
    return { output: { temperatureRiseMicrokelvin: value.toString() }, uncertainty: {} }
  }
  if (request.operation === 'interval-add') {
    exactKeys(request.inputs, ['leftLower', 'leftUpper', 'rightLower', 'rightUpper'], 'input')
    exactKeys(request.units, ['leftLower', 'leftUpper', 'resultLower', 'resultUpper', 'rightLower', 'rightUpper'], 'unit')
    const unit = request.units.leftLower
    if (!unit || Object.values(request.units).some((value) => value !== unit)) throw new Error('Interval-add values must share one explicit unit.')
    const leftLower = integer(request.inputs.leftLower, 'leftLower'); const leftUpper = integer(request.inputs.leftUpper, 'leftUpper')
    const rightLower = integer(request.inputs.rightLower, 'rightLower'); const rightUpper = integer(request.inputs.rightUpper, 'rightUpper')
    if (leftLower > leftUpper || rightLower > rightUpper) throw new Error('Interval lower bounds must not exceed upper bounds.')
    const lower = kernel.intervalAddLower(leftLower, rightLower); const upper = kernel.intervalAddUpper(leftUpper, rightUpper)
    return { output: { interval: `[${lower},${upper}]` }, uncertainty: { lower: lower.toString(), upper: upper.toString(), unit } }
  }
  throw new Error(`Unsupported kernel operation: ${String(request.operation)}`)
}

export async function createExecutedCalculationReceipt(request: KernelExecutionRequest, artifact: KernelArtifact): Promise<CalculationReceipt> {
  const result = await executeKernelRequest(request, artifact)
  return createCalculationReceipt({
    canonicalizationVersion: 'maha-dossier-canonical/1.0', module: EXECUTABLE_KERNEL_MODULE, operation: request.operation,
    inputs: request.inputs, units: request.units, constants: request.constants ?? {}, output: result.output, uncertainty: result.uncertainty,
    precisionPolicy: 'signed-i64 fixed-point; nearest ties to even; overflow abort', kernelVersion: artifact.manifest.kernelVersion,
    kernelSha256: artifact.manifest.kernelSha256, conformanceVersion: artifact.manifest.conformanceVersion, runtime: 'wasm-i64-fixed-point',
    compiler: artifact.manifest.compiler, arithmetic: artifact.manifest.arithmetic, conformanceSha256: artifact.manifest.conformanceSha256,
  })
}

/**
 * A stable rendering of a flat receipt field, independent of key order.
 *
 * Receipts pass through canonicalization on their way into a package, which
 * sorts keys. Comparing raw JSON would therefore reject a packaged receipt for
 * a difference that is not one.
 */
function canonicalFields(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(Object.entries(value ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

export async function verifyExecutedCalculationReceipt(receipt: CalculationReceipt, artifact: KernelArtifact): Promise<string[]> {
  const findings = await verifyKernelArtifact(artifact)
  if (receipt.module !== EXECUTABLE_KERNEL_MODULE) findings.push('receipt-module-unsupported')
  if (receipt.kernelVersion !== artifact.manifest.kernelVersion || receipt.kernelSha256 !== artifact.manifest.kernelSha256) findings.push('receipt-kernel-identity-mismatch')
  if (receipt.conformanceVersion !== artifact.manifest.conformanceVersion || receipt.conformanceSha256 !== artifact.manifest.conformanceSha256) findings.push('receipt-conformance-identity-mismatch')
  if (JSON.stringify(receipt.compiler) !== JSON.stringify(artifact.manifest.compiler) || JSON.stringify(receipt.arithmetic) !== JSON.stringify(artifact.manifest.arithmetic)) findings.push('receipt-build-policy-mismatch')
  try {
    const recomputed = await createExecutedCalculationReceipt({ schemaVersion: EXECUTION_REQUEST_SCHEMA, operation: receipt.operation as ExecutableKernelOperation, inputs: receipt.inputs, units: receipt.units, constants: receipt.constants }, artifact)
    // The result itself, not only the digest over it.
    //
    // Recomputation reproduces the receipt the inputs imply, digest included.
    // Comparing digests alone therefore compares the recomputed receipt with a
    // number the receipt carries about itself, which a tampered receipt keeps
    // unchanged while altering the result it reports. Verification passed on a
    // receipt whose output had been replaced outright.
    //
    // Comparing the executed output is what "ignores the claimed result and
    // reruns the operation" has to mean.
    // Compared canonically, because a receipt that has been through the dossier
    // canonicalizer carries the same fields in sorted order. A first pass used
    // JSON.stringify directly and rejected identical content whose keys had
    // been reordered, which would have failed every packaged receipt.
    if (canonicalFields(recomputed.output) !== canonicalFields(receipt.output)) findings.push('receipt-output-mismatch')
    if (canonicalFields(recomputed.uncertainty) !== canonicalFields(receipt.uncertainty)) findings.push('receipt-uncertainty-mismatch')
    if (recomputed.receiptSha256 !== receipt.receiptSha256) findings.push('receipt-execution-recomputation-mismatch')
  } catch { findings.push('receipt-execution-failed') }
  return [...new Set(findings)]
}
