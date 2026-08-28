import { createHash } from 'node:crypto'

import { canonicalJson } from './canonicalize.ts'

export const COMPUTATIONAL_WITNESS_SCHEMA = 'maha-computational-witness/0.1' as const
export const DOSSIER_RUNTIME_WITNESS_ATTACHMENT_SCHEMA = 'maha-dossier-runtime-witness-attachment/0.1' as const

const DIGEST = /^sha256:[a-f0-9]{64}$/

export interface ComputationalWitnessReceipt {
  schemaVersion: typeof COMPUTATIONAL_WITNESS_SCHEMA
  canonicalizationVersion: 'maha-dossier-canonical/1.0'
  witnessVersion: string
  jobId: string
  callable: Readonly<{ module: string; qualname: string }>
  execution: Readonly<{ status: 'succeeded' | 'failed'; startedAt: string; finishedAt: string; failureType: string | null }>
  artifacts: readonly Readonly<{ name: string; role: 'input' | 'output' | 'code'; mediaType: string; bytes: number; sha256: string }>[]
  inputSha256: string
  outputSha256: string
  environment: Readonly<Record<string, unknown>>
  environmentSha256: string
  randomSeeds: Readonly<Record<string, string | number>>
  configuration: Readonly<Record<string, unknown>>
  adapters: readonly Readonly<Record<string, unknown>>[]
  bindings: Readonly<{ dossierId: string | null; claimIds: readonly string[]; calculationReceiptIds: readonly string[] }>
  assurance: Readonly<{
    executionObserved: true
    independentlyReproduced: false
    scientificValidityCertified: false
    environmentComplete: boolean
    secretsCaptured: false
  }>
  receiptSha256: string
}

export interface DossierRuntimeWitnessAttachment {
  schemaVersion: typeof DOSSIER_RUNTIME_WITNESS_ATTACHMENT_SCHEMA
  dossierId: string
  claimIds: readonly string[]
  calculationReceiptIds: readonly string[]
  receipt: ComputationalWitnessReceipt
}

const digest = (value: unknown): string => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function verifyComputationalWitnessReceipt(value: unknown): string[] {
  const findings: string[] = []
  if (!isObject(value)) return ['witness-unparseable']
  try {
    if (value.schemaVersion !== COMPUTATIONAL_WITNESS_SCHEMA) findings.push('witness-schema-invalid')
    if (value.canonicalizationVersion !== 'maha-dossier-canonical/1.0') findings.push('witness-canonicalization-invalid')
    const callable = isObject(value.callable) ? value.callable : {}
    if (typeof value.jobId !== 'string' || !value.jobId || typeof callable.module !== 'string' || !callable.module || typeof callable.qualname !== 'string' || !callable.qualname) findings.push('witness-identity-invalid')
    const execution = isObject(value.execution) ? value.execution : {}
    if (!['succeeded', 'failed'].includes(String(execution.status)) || typeof execution.startedAt !== 'string' || typeof execution.finishedAt !== 'string') findings.push('witness-execution-invalid')
    const artifacts = Array.isArray(value.artifacts) ? value.artifacts.filter(isObject) : []
    if (!Array.isArray(value.artifacts) || artifacts.length !== value.artifacts.length) findings.push('witness-artifacts-invalid')
    if (artifacts.some((item) => typeof item.name !== 'string' || !item.name || !['input', 'output', 'code'].includes(String(item.role)) || !Number.isSafeInteger(item.bytes) || Number(item.bytes) < 0 || !DIGEST.test(String(item.sha256)))) findings.push('witness-artifacts-invalid')
    if (new Set(artifacts.map((item) => item.name)).size !== artifacts.length || canonicalJson(artifacts) !== canonicalJson([...artifacts].sort((a, b) => String(a.name) < String(b.name) ? -1 : String(a.name) > String(b.name) ? 1 : 0))) findings.push('witness-artifacts-invalid')
    const inputs = artifacts.filter((item) => item.role === 'input' || item.role === 'code')
    const outputs = artifacts.filter((item) => item.role === 'output')
    if (value.inputSha256 !== digest(inputs)) findings.push('witness-input-digest-invalid')
    if (value.outputSha256 !== digest(outputs)) findings.push('witness-output-digest-invalid')
    if (value.environmentSha256 !== digest(value.environment)) findings.push('witness-environment-digest-invalid')
    const binding = isObject(value.bindings) ? value.bindings : {}
    if (!Array.isArray(binding.claimIds) || !Array.isArray(binding.calculationReceiptIds) || binding.claimIds.some((id) => typeof id !== 'string') || binding.calculationReceiptIds.some((id) => typeof id !== 'string' || !DIGEST.test(id))) findings.push('witness-binding-invalid')
    const { receiptSha256, ...snapshot } = value
    if (!DIGEST.test(String(receiptSha256)) || receiptSha256 !== digest(snapshot)) findings.push('witness-receipt-digest-invalid')
    const assurance = isObject(value.assurance) ? value.assurance : {}
    if (assurance.executionObserved !== true || assurance.independentlyReproduced !== false || assurance.scientificValidityCertified !== false || typeof assurance.environmentComplete !== 'boolean' || assurance.secretsCaptured !== false) findings.push('witness-assurance-invalid')
    return [...new Set(findings)]
  } catch {
    return [...new Set([...findings, 'witness-unparseable'])]
  }
}

export function attachRuntimeWitnessToDossier(input: {
  dossierId: string
  claimIds: readonly string[]
  calculationReceiptIds?: readonly string[]
  receipt: ComputationalWitnessReceipt
}): DossierRuntimeWitnessAttachment {
  const findings = verifyComputationalWitnessReceipt(input.receipt)
  if (findings.length) throw new Error(`Computational witness receipt is invalid: ${findings.join(',')}`)
  const claimIds = [...input.claimIds].sort()
  const calculationReceiptIds = [...(input.calculationReceiptIds ?? [])].sort()
  if (!input.dossierId.trim() || !claimIds.length || new Set(claimIds).size !== claimIds.length) throw new Error('A runtime witness requires one dossier and unique claim ids.')
  if (calculationReceiptIds.some((id) => !DIGEST.test(id)) || new Set(calculationReceiptIds).size !== calculationReceiptIds.length) throw new Error('Runtime witness calculation receipt ids must be unique SHA-256 digests.')
  const binding = input.receipt.bindings
  if (binding.dossierId !== input.dossierId || canonicalJson(binding.claimIds) !== canonicalJson(claimIds) || canonicalJson(binding.calculationReceiptIds) !== canonicalJson(calculationReceiptIds)) throw new Error('Runtime witness receipt binding does not match the dossier attachment.')
  return { schemaVersion: DOSSIER_RUNTIME_WITNESS_ATTACHMENT_SCHEMA, dossierId: input.dossierId, claimIds, calculationReceiptIds, receipt: input.receipt }
}
