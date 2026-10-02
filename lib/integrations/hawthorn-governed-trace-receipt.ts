import { createHash } from 'node:crypto'

export const GOVERNED_TRACE_RECEIPT_SCHEMA = 'maha.governed-trace-receipt/0.1' as const
const SHA256 = /^sha256:[0-9a-f]{64}$/
const REASON_CODE = /^[a-z0-9][a-z0-9_-]*$/

export type Digest = `sha256:${string}`

export type HawthornTraceExport = {
  id: string
  schema_version: string
  source: string
  created_at: string
  runtime: { name: string }
  adapter: { name: string; version: string }
  metadata: {
    session_id: string
    actor: Record<string, unknown>
    retrieval: { context_present: boolean; context_sha256: string | null }
  }
  normalized_trace_sha256: string
  raw_trace_sha256: string
  [key: string]: unknown
}

export type GovernedTraceInput = {
  trace: HawthornTraceExport
  sources: Array<{ recordId: string; digest: Digest }>
  context: {
    selectedContextDigest: Digest
    retrievalPolicyDigest: Digest
    budget: { limitTokens: number; selectedTokens: number; held: boolean }
  }
  authority: {
    actorId: string
    organizationId: string
    role: string
    visibilityScope: string[]
  }
  governance: {
    guardrail: { outcome: 'passed' | 'blocked' | 'not_evaluated'; policyDigest: Digest; reasonCodes: string[] }
    compaction: { outcome: 'not_required' | 'applied' | 'failed'; inputDigest: Digest; outputDigest: Digest; reasonCodes: string[] }
    escalation: { outcome: 'not_required' | 'requested' | 'approved' | 'rejected'; reasonCodes: string[] }
  }
  lineage: { checkpointId?: string; parentTraceId?: string }
  completedAt: string
}

export type ReceiptProof = {
  algorithm: string
  keyId: string
  signature: string
}

export type ReceiptSigner = (canonicalPayload: Uint8Array) => Promise<ReceiptProof>
export type ReceiptSignatureVerifier = (canonicalPayload: Uint8Array, proof: ReceiptProof) => Promise<boolean>

export type GovernedTraceReceipt = {
  schema: typeof GOVERNED_TRACE_RECEIPT_SCHEMA
  profile: 'hawthorn-skillloop-trace-export/1.0'
  trace: {
    traceId: string
    sourceSchemaVersion: string
    runtime: string
    adapter: { name: string; version: string }
    normalizedTraceDigest: Digest
    rawTraceDigest: Digest
  }
  layers: {
    evidence: { orderedSourceRecords: Array<{ order: number; recordId: string; digest: Digest }> }
    context: GovernedTraceInput['context']
    authority: GovernedTraceInput['authority']
    receipt: {
      guardrail: GovernedTraceInput['governance']['guardrail']
      compaction: GovernedTraceInput['governance']['compaction']
      escalation: GovernedTraceInput['governance']['escalation']
      lineage: GovernedTraceInput['lineage']
      completedAt: string
    }
  }
  receiptDigest: Digest
  proof?: ReceiptProof
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortForCanonicalJson(item)]),
    )
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value))
}

export function sha256(value: string | Uint8Array): Digest {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function digestFromHawthorn(value: string, field: string): Digest {
  const digest = `sha256:${value}`
  if (!SHA256.test(digest)) throw new Error(`${field} must be a lowercase SHA-256 hex digest.`)
  return digest as Digest
}

function assertDigest(value: string, field: string): asserts value is Digest {
  if (!SHA256.test(value)) throw new Error(`${field} must use sha256:<lowercase hex>.`)
}

function assertEnum(value: string, allowed: readonly string[], field: string): void {
  if (!allowed.includes(value)) throw new Error(`${field} has an unsupported outcome.`)
}

function assertReasonCodes(value: string[], field: string): void {
  if (!Array.isArray(value) || value.length === 0 || new Set(value).size !== value.length || value.some((item) => !REASON_CODE.test(item))) {
    throw new Error(`${field} must contain unique machine-readable reason codes.`)
  }
}

function hawthornTracePayload(trace: HawthornTraceExport): Record<string, unknown> {
  const { normalized_trace_sha256: _normalized, raw_trace_sha256: _raw, ...payload } = trace
  return payload
}

function assertGovernance(governance: GovernedTraceInput['governance']): void {
  assertEnum(governance.guardrail.outcome, ['passed', 'blocked', 'not_evaluated'], 'guardrail.outcome')
  assertDigest(governance.guardrail.policyDigest, 'guardrail.policyDigest')
  assertReasonCodes(governance.guardrail.reasonCodes, 'guardrail.reasonCodes')
  assertEnum(governance.compaction.outcome, ['not_required', 'applied', 'failed'], 'compaction.outcome')
  assertDigest(governance.compaction.inputDigest, 'compaction.inputDigest')
  assertDigest(governance.compaction.outputDigest, 'compaction.outputDigest')
  assertReasonCodes(governance.compaction.reasonCodes, 'compaction.reasonCodes')
  assertEnum(governance.escalation.outcome, ['not_required', 'requested', 'approved', 'rejected'], 'escalation.outcome')
  assertReasonCodes(governance.escalation.reasonCodes, 'escalation.reasonCodes')
}

function unsignedPayload(receipt: GovernedTraceReceipt): Omit<GovernedTraceReceipt, 'receiptDigest' | 'proof'> {
  const { receiptDigest: _digest, proof: _proof, ...payload } = receipt
  return payload
}

function assertInput(input: GovernedTraceInput): void {
  if (!input.trace.id || input.trace.source !== 'agent_architecture') throw new Error('Unsupported or missing Hawthorn trace identity.')
  if (input.trace.adapter?.name !== 'agent_architecture_trace_export') throw new Error('Trace is not from Hawthorn trace_export.py.')
  const computedTraceDigest = sha256(canonicalJson(hawthornTracePayload(input.trace))).slice('sha256:'.length)
  if (input.trace.normalized_trace_sha256 !== computedTraceDigest || input.trace.raw_trace_sha256 !== computedTraceDigest) throw new Error('Hawthorn trace digest does not match the exported trace payload.')
  if (input.sources.length === 0) throw new Error('At least one ordered source record is required.')
  if (new Set(input.sources.map((item) => item.recordId)).size !== input.sources.length) throw new Error('Source record IDs must be unique.')
  input.sources.forEach((source, index) => assertDigest(source.digest, `sources[${index}].digest`))
  assertDigest(input.context.selectedContextDigest, 'selectedContextDigest')
  assertDigest(input.context.retrievalPolicyDigest, 'retrievalPolicyDigest')
  if (input.context.budget.limitTokens < 0 || input.context.budget.selectedTokens < 0) throw new Error('Token counts cannot be negative.')
  if (input.context.budget.held !== (input.context.budget.selectedTokens <= input.context.budget.limitTokens)) throw new Error('Context budget held flag contradicts token counts.')
  if (!input.authority.actorId || !input.authority.organizationId || !input.authority.role || input.authority.visibilityScope.length === 0) throw new Error('Complete authority identity and visibility scope are required.')
  if (!input.lineage.checkpointId && !input.lineage.parentTraceId) throw new Error('Checkpoint or parent-trace lineage is required.')
  assertGovernance(input.governance)
  if (Number.isNaN(Date.parse(input.completedAt))) throw new Error('completedAt must be an ISO date-time.')
}

export async function buildGovernedTraceReceipt(
  input: GovernedTraceInput,
  signer?: ReceiptSigner,
): Promise<GovernedTraceReceipt> {
  assertInput(input)
  const receipt = {
    schema: GOVERNED_TRACE_RECEIPT_SCHEMA,
    profile: 'hawthorn-skillloop-trace-export/1.0' as const,
    trace: {
      traceId: input.trace.id,
      sourceSchemaVersion: input.trace.schema_version,
      runtime: input.trace.runtime.name,
      adapter: input.trace.adapter,
      normalizedTraceDigest: digestFromHawthorn(input.trace.normalized_trace_sha256, 'normalized_trace_sha256'),
      rawTraceDigest: digestFromHawthorn(input.trace.raw_trace_sha256, 'raw_trace_sha256'),
    },
    layers: {
      evidence: {
        orderedSourceRecords: input.sources.map((source, order) => ({ order, ...source })),
      },
      context: input.context,
      authority: input.authority,
      receipt: {
        ...input.governance,
        lineage: input.lineage,
        completedAt: input.completedAt,
      },
    },
  }
  const canonical = new TextEncoder().encode(canonicalJson(receipt))
  const result: GovernedTraceReceipt = { ...receipt, receiptDigest: sha256(canonical) }
  if (signer) result.proof = await signer(canonical)
  return result
}

export async function verifyGovernedTraceReceipt(
  receipt: GovernedTraceReceipt,
  signatureVerifier?: ReceiptSignatureVerifier,
): Promise<{ valid: true; receiptDigest: Digest }> {
  if (receipt.schema !== GOVERNED_TRACE_RECEIPT_SCHEMA || receipt.profile !== 'hawthorn-skillloop-trace-export/1.0') throw new Error('Unsupported receipt schema or profile.')
  const sources = receipt.layers?.evidence?.orderedSourceRecords
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('Ordered source records are required.')
  sources.forEach((source, index) => {
    if (source.order !== index) throw new Error('Source record order is non-contiguous or has been changed.')
    assertDigest(source.digest, `orderedSourceRecords[${index}].digest`)
  })
  if (new Set(sources.map((source) => source.recordId)).size !== sources.length) throw new Error('Source record IDs must be unique.')
  assertDigest(receipt.layers.context.selectedContextDigest, 'selectedContextDigest')
  assertDigest(receipt.layers.context.retrievalPolicyDigest, 'retrievalPolicyDigest')
  if (receipt.layers.context.budget.held !== (receipt.layers.context.budget.selectedTokens <= receipt.layers.context.budget.limitTokens)) throw new Error('Context budget invariant failed.')
  if (!receipt.layers.authority.actorId || !receipt.layers.authority.organizationId || !receipt.layers.authority.role || receipt.layers.authority.visibilityScope.length === 0) throw new Error('Authority boundary is incomplete.')
  if (!receipt.layers.receipt.lineage.checkpointId && !receipt.layers.receipt.lineage.parentTraceId) throw new Error('Lineage boundary is missing.')
  assertGovernance(receipt.layers.receipt)
  if (Number.isNaN(Date.parse(receipt.layers.receipt.completedAt))) throw new Error('completedAt must be an ISO date-time.')
  assertDigest(receipt.trace.normalizedTraceDigest, 'normalizedTraceDigest')
  assertDigest(receipt.trace.rawTraceDigest, 'rawTraceDigest')

  const canonical = new TextEncoder().encode(canonicalJson(unsignedPayload(receipt)))
  const actual = sha256(canonical)
  if (actual !== receipt.receiptDigest) throw new Error('Receipt digest mismatch.')
  if (receipt.proof) {
    if (!signatureVerifier) throw new Error('A signed receipt requires an explicit signature verifier.')
    if (!await signatureVerifier(canonical, receipt.proof)) throw new Error('Receipt signature verification failed.')
  }
  return { valid: true, receiptDigest: actual }
}
