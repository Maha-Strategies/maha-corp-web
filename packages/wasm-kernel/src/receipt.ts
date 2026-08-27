export const KERNEL_RECEIPT_SCHEMA = 'maha-calculation-receipt/1.0' as const

export interface CalculationReceiptInput {
  module: string
  operation: string
  inputs: Readonly<Record<string, string>>
  units: Readonly<Record<string, string>>
  constants: Readonly<Record<string, string>>
  output: Readonly<Record<string, string>>
  uncertainty: Readonly<Record<string, string>>
  precisionPolicy: string
  kernelVersion: string
  kernelSha256: string
  conformanceVersion: string
  runtime: 'wasm-i64-fixed-point'
  proofReferences?: readonly string[]
  witnessReceiptIds?: readonly string[]
}

export interface CalculationReceipt extends CalculationReceiptInput {
  schemaVersion: typeof KERNEL_RECEIPT_SCHEMA
  receiptSha256: string
}

function normalized(value: unknown): unknown {
  if (typeof value === 'string') return value.normalize('NFC')
  if (Array.isArray(value)) return value.map(normalized)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, normalized(entry)]))
  return value
}

export const canonicalJson = (value: unknown): string => JSON.stringify(normalized(value))

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function createCalculationReceipt(input: CalculationReceiptInput): Promise<CalculationReceipt> {
  if (!/^sha256:[a-f0-9]{64}$/.test(input.kernelSha256)) throw new Error('kernelSha256 must be a SHA-256 digest.')
  if (!input.module || !input.operation || !input.precisionPolicy || !input.conformanceVersion) throw new Error('Receipt identity and precision fields are required.')
  const snapshot = { schemaVersion: KERNEL_RECEIPT_SCHEMA, ...input }
  return { ...snapshot, receiptSha256: await sha256(canonicalJson(snapshot)) }
}

export async function verifyCalculationReceipt(receipt: CalculationReceipt): Promise<boolean> {
  const { receiptSha256, ...snapshot } = receipt
  return receipt.schemaVersion === KERNEL_RECEIPT_SCHEMA && receiptSha256 === await sha256(canonicalJson(snapshot))
}
