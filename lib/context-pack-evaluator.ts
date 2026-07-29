import { createHash, randomUUID } from 'node:crypto'

import { compileContextPack, parseContextPackRequest, sha256, type ContextPackRequest } from './context-compiler.ts'

export const MAX_CONTEXT_EVALUATION_BYTES = 128_000

type RequiredEvidence = { evidenceId: string; sourceId: string; text: string }
export type ContextEvaluationRequest = ContextPackRequest & { requiredEvidence: RequiredEvidence[] }

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function line(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const output = value.trim()
  if (output.length < minimum || output.length > maximum || /[\r\n]/.test(output)) throw new Error(`${field} must contain ${minimum}-${maximum} characters on one line.`)
  return output
}

function normalize(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export function createContextEvaluationId(): string {
  return `ctxeval_${randomUUID().replaceAll('-', '')}`
}

export function parseContextEvaluationRequest(value: unknown): ContextEvaluationRequest {
  const body = object(value)
  if (!body) throw new Error('Request body must be a JSON object.')
  const context = parseContextPackRequest(body)
  if (!Array.isArray(body.requiredEvidence) || body.requiredEvidence.length < 1 || body.requiredEvidence.length > 32) throw new Error('requiredEvidence must contain 1-32 evidence spans.')
  const documents = new Map(context.documents.map((document) => [document.id, normalize(document.text)]))
  const evidenceIds = new Set<string>()
  const requiredEvidence = body.requiredEvidence.map((item, index) => {
    const evidence = object(item)
    if (!evidence) throw new Error(`requiredEvidence[${index}] must be an object.`)
    const evidenceId = line(evidence.evidenceId, `requiredEvidence[${index}].evidenceId`, 1, 80)
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(evidenceId)) throw new Error(`requiredEvidence[${index}].evidenceId contains unsupported characters.`)
    if (evidenceIds.has(evidenceId)) throw new Error('requiredEvidence[].evidenceId values must be unique.')
    evidenceIds.add(evidenceId)
    const sourceId = line(evidence.sourceId, `requiredEvidence[${index}].sourceId`, 1, 80)
    const text = typeof evidence.text === 'string' ? normalize(evidence.text) : ''
    if (text.length < 3 || text.length > 4_000) throw new Error(`requiredEvidence[${index}].text must contain 3-4,000 characters.`)
    const source = documents.get(sourceId)
    if (!source) throw new Error(`requiredEvidence[${index}].sourceId must reference a supplied document.`)
    if (!source.includes(text)) throw new Error(`requiredEvidence[${index}].text must be an exact span from its declared source document.`)
    return { evidenceId, sourceId, text }
  })
  return { ...context, requiredEvidence }
}

export function evaluateContextPack(input: ContextEvaluationRequest) {
  const compilation = compileContextPack(input)
  const evidence = input.requiredEvidence.map((required) => {
    const retained = compilation.includedPassages.some((passage) => passage.sourceId === required.sourceId && normalize(passage.text).includes(required.text))
    return { evidenceId: required.evidenceId, sourceId: required.sourceId, evidenceHash: sha256(required.text), status: retained ? 'retained' as const : 'omitted' as const }
  })
  const retainedCount = evidence.filter((item) => item.status === 'retained').length
  const inputHash = sha256(JSON.stringify({ contextInputHash: compilation.inputHash, evidence: evidence.map(({ evidenceId, sourceId, evidenceHash }) => ({ evidenceId, sourceId, evidenceHash })) }))
  return {
    evaluationId: createContextEvaluationId(),
    clientRequestId: input.clientRequestId,
    contextPack: compilation,
    evidence,
    metrics: {
      ...compilation.metrics,
      requiredEvidenceCount: evidence.length,
      retainedEvidenceCount: retainedCount,
      requiredEvidenceRetentionPercent: Number(((retainedCount / evidence.length) * 100).toFixed(1)),
    },
    inputHash,
    outputHash: `sha256:${createHash('sha256').update(JSON.stringify({ contextOutputHash: compilation.outputHash, evidence })).digest('hex')}`,
    warnings: [
      ...compilation.warnings,
      'Evidence retention means an exact required source span was present in the compiled pack. It does not establish factual accuracy, answer quality, legal compliance, or downstream model behavior.',
    ],
  }
}
