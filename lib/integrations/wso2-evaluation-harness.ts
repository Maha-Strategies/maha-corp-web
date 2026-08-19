import { createHash, randomBytes } from 'node:crypto'

import type { Wso2EvaluationWorkload } from './wso2-evaluation-corpus.ts'

/**
 * The reproducible three-path harness.
 *
 * Separated from the runner script so the parts that decide whether money is
 * spent -- the ceiling, the checkpoint, the ordering -- are unit-testable
 * without a provider. Every paid mistake in this repository so far has been in
 * a code path that only ran when it was too late to check it.
 */

export const WSO2_EVALUATION_PATHS = [
  'wso2-baseline',
  'wso2-native-prompt-compressor',
  'wso2-maha-context-compiler',
] as const

/** Frozen provider boundary shared by the runner and reproduction contract. */
export const WSO2_EVALUATION_MODEL = 'claude-haiku-4-5-20251001'
export const WSO2_EVALUATION_TEMPERATURE = 0
export const WSO2_EVALUATION_MAX_OUTPUT_TOKENS = 220
export const WSO2_EVALUATION_PRICING = {
  inputPerMillion: BigInt(1_000_000),
  outputPerMillion: BigInt(5_000_000),
}

export type Wso2EvaluationPath = typeof WSO2_EVALUATION_PATHS[number]

// --- Exact money ------------------------------------------------------------

/**
 * Microdollars: integer millionths of a dollar.
 *
 * Anthropic prices per million tokens, so a per-call cost is a rational number
 * that binary floating point cannot hold exactly. Summing sixty of them and
 * comparing against a ceiling is precisely where the error accumulates, and a
 * ceiling that is wrong by a rounding error is not a ceiling. Every comparison
 * below is integer.
 */
export type Microdollars = bigint

// BigInt literals (0n) require an ES2020 target; this repo targets ES2017, so
// BigInt(0) is used throughout. Identical at runtime, and cheaper than moving
// the whole project to satisfy one evaluation harness.

const MICRO = BigInt(1_000_000)

/** Parses a decimal dollar string into exact microdollars. Never uses Number. */
export function parseUsdToMicrodollars(value: string): Microdollars {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`Not an exact dollar amount: "${value}". Use up to six decimal places, e.g. 0.250000.`)
  }
  const [whole, fraction = ''] = trimmed.split('.')
  return BigInt(whole) * MICRO + BigInt(fraction.padEnd(6, '0'))
}

export function formatMicrodollars(value: Microdollars): string {
  const negative = value < BigInt(0)
  const absolute = negative ? -value : value
  const whole = absolute / MICRO
  const fraction = (absolute % MICRO).toString().padStart(6, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

export type TokenPricing = {
  /** Integer microdollars per million input tokens. */
  inputPerMillion: Microdollars
  outputPerMillion: Microdollars
}

/**
 * Cost of one call, rounded **up**.
 *
 * Deliberately pessimistic: a ceiling that under-counts by a fraction of a
 * microdollar per call is a ceiling that can be crossed sixty times.
 */
export function callCostMicrodollars(
  inputTokens: number,
  outputTokens: number,
  pricing: TokenPricing,
): Microdollars {
  if (!Number.isInteger(inputTokens) || inputTokens < 0) throw new Error('inputTokens must be a non-negative integer.')
  if (!Number.isInteger(outputTokens) || outputTokens < 0) throw new Error('outputTokens must be a non-negative integer.')
  const numerator = BigInt(inputTokens) * pricing.inputPerMillion + BigInt(outputTokens) * pricing.outputPerMillion
  return (numerator + MICRO - BigInt(1)) / MICRO
}

export type SpendDecision =
  | { allowed: true; projectedTotal: Microdollars }
  | { allowed: false; reason: string; projectedTotal: Microdollars; ceiling: Microdollars }

/**
 * Asked **before** each call, never after.
 *
 * The upper bound of the call about to be made is added to everything already
 * spent, and the call is refused if that total would exceed the ceiling. A
 * check that runs after the request has been sent is an audit, not a limit.
 */
export function authorizeNextCall(
  spentSoFar: Microdollars,
  upperBoundForNextCall: Microdollars,
  ceiling: Microdollars,
): SpendDecision {
  const projectedTotal = spentSoFar + upperBoundForNextCall
  if (projectedTotal > ceiling) {
    return {
      allowed: false,
      projectedTotal,
      ceiling,
      reason: `Refusing the next call: $${formatMicrodollars(spentSoFar)} already spent plus an upper bound of `
        + `$${formatMicrodollars(upperBoundForNextCall)} would reach $${formatMicrodollars(projectedTotal)}, `
        + `above the ceiling of $${formatMicrodollars(ceiling)}.`,
    }
  }
  return { allowed: true, projectedTotal }
}

// --- Deterministic work ordering -------------------------------------------

export type Wso2EvaluationCall = { workloadId: string; path: Wso2EvaluationPath }

/**
 * Stable order: workloads in corpus order, paths in declared order.
 *
 * A resumed run must produce the same sequence as the run it resumes, or the
 * checkpoint cannot be matched against it.
 */
export function planCalls(
  workloads: readonly Pick<Wso2EvaluationWorkload, 'id'>[],
  filters: { workloadId?: string; path?: Wso2EvaluationPath } = {},
): Wso2EvaluationCall[] {
  const calls: Wso2EvaluationCall[] = []
  for (const workload of workloads) {
    if (filters.workloadId && workload.id !== filters.workloadId) continue
    for (const path of WSO2_EVALUATION_PATHS) {
      if (filters.path && path !== filters.path) continue
      calls.push({ workloadId: workload.id, path })
    }
  }
  return calls
}

export const callKey = (call: Wso2EvaluationCall): string => `${call.workloadId}::${call.path}`

// --- Checkpoint -------------------------------------------------------------

export type Wso2CallRecord = {
  workloadId: string
  path: Wso2EvaluationPath
  /** 'ok' or 'failed'. A failure is a recorded result, never a retry. */
  outcome: 'ok' | 'failed'
  costMicrodollars: string
  completedAt: string
  /**
   * The scored, sanitized result produced by this call.
   *
   * Identity without the result prevents duplicate billing but cannot rebuild
   * the report after an interruption. Older checkpoints may lack this field;
   * callers must fail closed rather than repeat the paid call or omit it.
   */
  result?: unknown
  [key: string]: unknown
}

export type Wso2Checkpoint = {
  schemaVersion: '1'
  corpusDigest: string
  model: string
  records: Wso2CallRecord[]
}

export function emptyCheckpoint(corpusDigest: string, model: string): Wso2Checkpoint {
  return { schemaVersion: '1', corpusDigest, model, records: [] }
}

/**
 * A checkpoint is only usable against the corpus and model it was written for.
 *
 * Resuming across a changed corpus would silently mix results from different
 * label sets into one report, and the digest exists precisely so that cannot
 * happen quietly.
 */
export function assertCheckpointMatches(checkpoint: Wso2Checkpoint, corpusDigest: string, model: string): void {
  if (checkpoint.corpusDigest !== corpusDigest) {
    throw new Error('The checkpoint was written against a different corpus digest. Start a new run rather than mixing label sets.')
  }
  if (checkpoint.model !== model) {
    throw new Error(`The checkpoint was written against model ${checkpoint.model}. Start a new run rather than mixing models.`)
  }
}

export function completedKeys(checkpoint: Wso2Checkpoint): Set<string> {
  return new Set(checkpoint.records.map((record) => callKey(record)))
}

export function spentMicrodollars(checkpoint: Wso2Checkpoint): Microdollars {
  return checkpoint.records.reduce((total, record) => total + BigInt(record.costMicrodollars), BigInt(0))
}

export type ResumePlan = {
  toRun: Wso2EvaluationCall[]
  alreadyComplete: Wso2EvaluationCall[]
  /** Only non-zero when the operator forces repeats. */
  repeatUpperBound: Microdollars
}

/**
 * Never repeats a completed call unless forced.
 *
 * The default is the whole point of the checkpoint: an interrupted run must
 * cost nothing to finish. `force` exists for the case where a completed record
 * is known bad, and the caller is required to show the operator the additional
 * upper bound before it proceeds.
 */
export function planResume(
  planned: readonly Wso2EvaluationCall[],
  checkpoint: Wso2Checkpoint,
  options: { force?: boolean; upperBoundPerCall: Microdollars },
): ResumePlan {
  const done = completedKeys(checkpoint)
  const alreadyComplete = planned.filter((call) => done.has(callKey(call)))
  const toRun = options.force ? [...planned] : planned.filter((call) => !done.has(callKey(call)))
  return {
    toRun,
    alreadyComplete,
    repeatUpperBound: options.force ? BigInt(alreadyComplete.length) * options.upperBoundPerCall : BigInt(0),
  }
}

/**
 * Rebuilds the artifact from durable checkpoint records in planned-call order.
 *
 * Later records win when an operator explicitly forced a repeat, while every
 * record remains in the checkpoint so cumulative spend is never erased.
 */
export function checkpointResults<T>(
  planned: readonly Wso2EvaluationCall[],
  checkpoint: Wso2Checkpoint,
): T[] {
  const latest = new Map<string, Wso2CallRecord>()
  for (const record of checkpoint.records) latest.set(callKey(record), record)

  return planned.flatMap((call) => {
    const record = latest.get(callKey(call))
    if (!record) return []
    if (record.result === undefined) {
      throw new Error(
        `Checkpoint call ${callKey(call)} is marked complete but has no scored result. `
        + 'Use a fresh checkpoint; repeating the provider call automatically is forbidden.',
      )
    }
    return [record.result as T]
  })
}

// --- Deterministic scoring --------------------------------------------------

export type FactVerdict = 'answered' | 'not_answered' | 'manual_review_required'

/**
 * Scored by exact evidence-span presence, and honest when it cannot be.
 *
 * A required fact counts as answered only when one of its frozen evidence spans
 * appears in the answer. A paraphrase that is semantically correct will not
 * match, and calling that a failure would understate every path equally but
 * dishonestly -- so it becomes `manual_review_required` and a human decides.
 * Uncertainty is not converted into a pass or a fail.
 *
 * No model is used as a judge here, reported or otherwise.
 */
export function scoreRequiredFact(answer: string, fact: { statement: string; evidence: string[] }): FactVerdict {
  const haystack = normalizeForMatch(answer)
  if (fact.evidence.some((span) => haystack.includes(normalizeForMatch(span)))) return 'answered'
  // The fact was clearly not addressed at all: no span, and no meaningful
  // overlap with the statement's distinctive terms.
  const terms = distinctiveTerms(fact.statement)
  const overlap = terms.filter((term) => haystack.includes(term)).length
  if (terms.length > 0 && overlap === 0) return 'not_answered'
  return 'manual_review_required'
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Words long enough to carry meaning, deduplicated, order-stable. */
function distinctiveTerms(statement: string): string[] {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'was', 'were', 'has', 'have', 'are', 'its'])
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of normalizeForMatch(statement).split(/[^a-z0-9]+/)) {
    if (raw.length < 4 || stop.has(raw) || seen.has(raw)) continue
    seen.add(raw)
    terms.push(raw)
  }
  return terms
}

/** A prohibited assertion is scored the same way, and only on an exact span. */
export function findProhibitedAssertions(answer: string, mustNotAssert: readonly string[]): string[] {
  const haystack = normalizeForMatch(answer)
  return mustNotAssert.filter((claim) => haystack.includes(normalizeForMatch(claim)))
}

/**
 * Exact evidence spans present in the context *forwarded to the provider*.
 *
 * Distinct from whether the answer used them. Retention is a property of the
 * context; correctness is a property of the answer; and collapsing the two is
 * the single most common way a context-compression benchmark flatters itself.
 */
export function countRetainedEvidenceSpans(
  forwardedContext: string,
  facts: readonly { evidence: string[] }[],
): { retained: number; total: number } {
  const haystack = normalizeForMatch(forwardedContext)
  let retained = 0
  let total = 0
  for (const fact of facts) {
    for (const span of fact.evidence) {
      total += 1
      if (haystack.includes(normalizeForMatch(span))) retained += 1
    }
  }
  return { retained, total }
}

/** A passage citation (`sourceId:passage`) resolves to its source as well. */
export function isResolvableSourceCitation(citation: string, sourceIds: Set<string>): boolean {
  return [...sourceIds].some((sourceId) => citation === sourceId || citation.startsWith(`${sourceId}:`))
}

export function hashArtifact(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

// --- Human adjudication ----------------------------------------------------

const MAX_ADJUDICATION_ANSWER_CHARS = 16_000

/** Retain reviewable model output without retaining credential-shaped strings. */
export function sanitizeAdjudicationAnswer(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\b(?:sk-ant-|sk-|xox[baprs]-)[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_CREDENTIAL]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED_CREDENTIAL]')
    .replace(/\b0x[a-fA-F0-9]{64}\b/g, '[REDACTED_PRIVATE_KEY_SHAPE]')
    .slice(0, MAX_ADJUDICATION_ANSWER_CHARS)
}

type ReviewableResult = {
  workloadId: string
  path: Wso2EvaluationPath
  answer: { reviewText?: string }
}

export function buildBlindedAdjudication(
  corpusDigest: string,
  workloads: readonly Wso2EvaluationWorkload[],
  results: readonly ReviewableResult[],
) {
  const workloadById = new Map(workloads.map((workload) => [workload.id, workload]))
  const joined = results.map((result) => {
    const workload = workloadById.get(result.workloadId)
    if (!workload) throw new Error(`No frozen workload exists for ${result.workloadId}.`)
    if (typeof result.answer.reviewText !== 'string') throw new Error(`Result ${callKey(result)} has no sanitized answer for adjudication.`)
    // Random rather than a digest of the path: the latter is reversible from
    // this open-source code and the three known path names, so it is not blind.
    const responseId = `review_${randomBytes(12).toString('hex')}`
    return {
      blind: {
        responseId,
        workloadId: workload.id,
        difficulty: workload.difficulty,
        answer: result.answer.reviewText,
        requiredFacts: workload.labels.requiredFacts.map((fact) => ({ id: fact.id, statement: fact.statement, sourceIds: fact.sourceIds, verdict: null })),
        mustNotAssert: workload.labels.mustNotAssert,
      },
      key: { responseId, workloadId: workload.id, path: result.path },
    }
  })
  joined.sort((left, right) => left.blind.responseId.localeCompare(right.blind.responseId))
  return {
    blinded: {
      schemaVersion: '1',
      corpusDigest,
      instructions: 'Review answers without access to path identity. Set each requiredFacts[].verdict to answered, not_answered, or unsupported, and record notes separately.',
      responses: joined.map((entry) => entry.blind),
    },
    key: { schemaVersion: '1', corpusDigest, mappings: joined.map((entry) => entry.key) },
  }
}
