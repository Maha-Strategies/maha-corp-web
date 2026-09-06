import { canonicalJson } from '../evidence-dossier/digest.ts'
import {
  compileContextPack,
  parseContextPackRequest,
  sha256,
  type BudgetMode,
  type ContextPackRequest,
  type ProvenanceStyle,
  type ScoringMode,
} from '../context-compiler.ts'
import { evaluateContextPack, parseContextEvaluationRequest } from '../context-pack-evaluator.ts'

export const CONTEXT_BUDGET_LADDER_VERSION = '0.1' as const
export const EVIDENCE_RETENTION_MATRIX_VERSION = '0.1' as const
export const GOVERNED_CONTEXT_VERIFICATION_VERSION = '0.1' as const
export const CONTEXT_PRODUCT_RUNS = 5

type BaseInput = Omit<ContextPackRequest, 'tokenBudget'> & { tokenBudgets: number[] }
type MatrixInput = BaseInput & { requiredEvidence: Array<{ evidenceId: string; sourceId: string; text: string }> }

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stableId(prefix: string, digest: string): string {
  return `${prefix}${digest.slice('sha256:'.length, 'sha256:'.length + 32)}`
}

function exactFields(body: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(body).find((key) => !allowed.includes(key))
  if (unknown) throw new Error(`Unknown request field: ${unknown}.`)
}

function budgets(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== CONTEXT_PRODUCT_RUNS) {
    throw new Error(`tokenBudgets must contain exactly ${CONTEXT_PRODUCT_RUNS} entries.`)
  }
  const parsed = value.map((item) => {
    if (!Number.isInteger(item) || typeof item !== 'number' || item < 64 || item > 16_000) {
      throw new Error('Every token budget must be an integer between 64 and 16,000.')
    }
    return item
  })
  if (new Set(parsed).size !== parsed.length || parsed.some((item, index) => index > 0 && item <= parsed[index - 1]!)) {
    throw new Error('tokenBudgets must contain five distinct values in ascending order.')
  }
  return parsed
}

function parseBase(value: unknown, allowed: readonly string[]): BaseInput {
  const body = object(value)
  if (!body) throw new Error('Request body must be a JSON object.')
  exactFields(body, allowed)
  const tokenBudgets = budgets(body.tokenBudgets)
  const first = parseContextPackRequest({ ...body, tokenBudget: tokenBudgets[0] })
  return {
    clientRequestId: first.clientRequestId,
    task: first.task,
    documents: first.documents,
    provenance: first.provenance as ProvenanceStyle,
    scoring: first.scoring as ScoringMode,
    budgetMode: first.budgetMode as BudgetMode,
    tokenBudgets,
  }
}

const BASE_FIELDS = ['clientRequestId', 'task', 'tokenBudgets', 'documents', 'provenance', 'scoring', 'budgetMode'] as const

export function parseContextBudgetLadderInput(value: unknown): BaseInput {
  return parseBase(value, BASE_FIELDS)
}

export function buildContextBudgetLadder(inputValue: unknown) {
  const input = parseContextBudgetLadderInput(inputValue)
  const inputDigest = sha256(canonicalJson(input))
  const runs = input.tokenBudgets.map((tokenBudget) => {
    const pack = compileContextPack({ ...input, tokenBudget })
    return {
      tokenBudget,
      contextPack: { ...pack, packId: stableId('ctxpack_', sha256(canonicalJson({ inputDigest, tokenBudget }))) },
    }
  })
  const base = {
    version: CONTEXT_BUDGET_LADDER_VERSION,
    offerId: 'context-budget-ladder' as const,
    clientRequestId: input.clientRequestId,
    inputDigest,
    economicBasis: { componentOfferId: 'context-compression', componentRuns: CONTEXT_PRODUCT_RUNS, componentPriceBaseUnits: '1000', priceBaseUnits: '5000' },
    runs,
    comparison: runs.map(({ tokenBudget, contextPack }) => ({
      tokenBudget,
      compiledEstimatedTokens: contextPack.metrics.compiledEstimatedTokens,
      tokensSaved: contextPack.metrics.tokensSaved,
      sourceCoveragePercent: contextPack.metrics.sourceCoveragePercent,
      includedPassageIds: contextPack.includedPassages.map((passage) => passage.passageId),
      outputHash: contextPack.outputHash,
    })),
    boundaries: [
      'Five deterministic compilations of the same supplied documents; no source acquisition or model inference.',
      'Token counts are model-neutral estimates, not provider billing counts.',
      'Selection is extractive and does not verify claims, guarantee completeness, or assess answer quality.',
    ],
    sourceTextStored: false as const,
    compiledContextStored: false as const,
  }
  return { ...base, receiptDigest: sha256(canonicalJson(base)) }
}

export function parseEvidenceRetentionMatrixInput(value: unknown): MatrixInput {
  const body = object(value)
  if (!body) throw new Error('Request body must be a JSON object.')
  const base = parseBase(body, [...BASE_FIELDS, 'requiredEvidence'])
  const parsed = parseContextEvaluationRequest({ ...base, tokenBudget: base.tokenBudgets[0], requiredEvidence: body.requiredEvidence })
  return { ...base, requiredEvidence: parsed.requiredEvidence }
}

export function buildEvidenceRetentionMatrix(inputValue: unknown) {
  const input = parseEvidenceRetentionMatrixInput(inputValue)
  const inputDigest = sha256(canonicalJson(input))
  const runs = input.tokenBudgets.map((tokenBudget) => {
    const result = evaluateContextPack({ ...input, tokenBudget })
    const runDigest = sha256(canonicalJson({ inputDigest, tokenBudget, contextOutputHash: result.contextPack.outputHash, evidence: result.evidence }))
    return {
      tokenBudget,
      evaluationId: stableId('ctxeval_', runDigest),
      contextPack: { ...result.contextPack, packId: stableId('ctxpack_', sha256(canonicalJson({ inputDigest, tokenBudget }))) },
      evidence: result.evidence,
      metrics: result.metrics,
      outputHash: result.outputHash,
      runDigest,
    }
  })
  const evidenceFrontier = input.requiredEvidence.map(({ evidenceId, sourceId, text }) => {
    const retainedAtBudgets = runs.filter((run) => run.evidence.some((item) => item.evidenceId === evidenceId && item.status === 'retained')).map((run) => run.tokenBudget)
    return {
      evidenceId,
      sourceId,
      evidenceHash: sha256(text),
      retainedAtBudgets,
      firstRetainedBudget: retainedAtBudgets[0] ?? null,
      retainedInEveryRun: retainedAtBudgets.length === runs.length,
    }
  })
  const base = {
    version: EVIDENCE_RETENTION_MATRIX_VERSION,
    offerId: 'evidence-retention-matrix' as const,
    clientRequestId: input.clientRequestId,
    inputDigest,
    economicBasis: { componentOfferId: 'deep-context-evaluation', componentRuns: CONTEXT_PRODUCT_RUNS, componentPriceBaseUnits: '10000', priceBaseUnits: '50000' },
    runs,
    evidenceFrontier,
    boundaries: [
      'Measures exact supplied-span retention across five token budgets.',
      'Retention is not factual accuracy, answer quality, legal compliance, or hallucination prevention.',
      'Uses only caller-supplied documents and evidence spans; no source acquisition or model inference.',
    ],
    sourceTextStored: false as const,
    compiledContextStored: false as const,
    requiredEvidenceTextStored: false as const,
  }
  return { ...base, receiptDigest: sha256(canonicalJson(base)) }
}

export function buildGovernedContextVerificationPack(inputValue: unknown) {
  const input = parseContextEvaluationRequest(inputValue)
  const result = evaluateContextPack(input)
  const inputDigest = sha256(canonicalJson(input))
  const contextPack = { ...result.contextPack, packId: stableId('ctxpack_', inputDigest) }
  const deliverable = {
    evaluationId: stableId('ctxeval_', inputDigest),
    contextPack,
    evidence: result.evidence,
    metrics: result.metrics,
    policy: {
      policyVersion: 'governed-context-verification-policy/0.1',
      decision: 'accepted' as const,
      limits: { maxDocuments: 8, maxRequiredEvidence: 32, maxTokenBudget: 16_000 },
      observed: {
        documentCount: input.documents.length,
        requiredEvidenceCount: input.requiredEvidence.length,
        requestedTokenBudget: input.tokenBudget,
        compiledEstimatedTokens: result.metrics.compiledEstimatedTokens,
      },
      budgetSatisfied: result.metrics.compiledEstimatedTokens <= input.tokenBudget,
    },
    integrity: {
      requestHash: inputDigest,
      contextInputHash: contextPack.inputHash,
      contextOutputHash: contextPack.outputHash,
      evaluationOutputHash: result.outputHash,
    },
  }
  const base = {
    version: GOVERNED_CONTEXT_VERIFICATION_VERSION,
    offerId: 'governed-context-verification-pack' as const,
    clientRequestId: input.clientRequestId,
    deliverable,
    limitations: [
      'This is a machine-generated context-control evidence packet, not a factual or compliance certification.',
      'Exact-span retention does not establish truth, completeness, answer quality, or downstream model behavior.',
      'No source acquisition, human judgment, or model inference is performed.',
    ],
    sourceTextStored: false as const,
    compiledContextStored: false as const,
    requiredEvidenceTextStored: false as const,
  }
  return { ...base, receiptDigest: sha256(canonicalJson(base)) }
}
