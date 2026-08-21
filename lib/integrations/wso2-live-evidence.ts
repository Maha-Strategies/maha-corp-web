import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/**
 * The public, sanitized record of the 2026-08-17 live three-path WSO2 evaluation.
 *
 * The run's primary evidence -- the durable checkpoint, the path-blinded
 * adjudication and its blinding key -- is deliberately *not* committed: those
 * files carry the model's answer text. This artifact is the derived,
 * answer-free projection of them, and it exists so that a reviewer can check
 * the published aggregate against per-workload rows instead of taking a
 * headline number on trust.
 *
 * Nothing here is recomputed at read time from the model. Every aggregate is a
 * pure function of `workloads`, and `assertAggregatesDerivable` re-derives all
 * of them so a hand-edited total fails rather than publishes.
 */
export const WSO2_LIVE_EVIDENCE_PATH = 'content/integrations/wso2-live-evaluation-evidence.json'

/** The only path labels this evaluation defines. Any other label is a defect. */
export const WSO2_LIVE_EVIDENCE_PATHS = [
  'wso2-baseline',
  'wso2-native-prompt-compressor',
  'wso2-maha-context-compiler',
] as const

export type Wso2LiveEvidencePath = (typeof WSO2_LIVE_EVIDENCE_PATHS)[number]

/**
 * Field names that must never reach a public artifact.
 *
 * The generator strips them, but stripping is a transformation and this is the
 * assertion. They are checked against every key at every depth, because the
 * expensive mistake is not a top-level `reviewText` -- it is one nested three
 * levels down in a row that nobody re-read.
 */
export const WSO2_LIVE_EVIDENCE_FORBIDDEN_KEYS = [
  'reviewText', 'answer', 'answerText', 'text', 'documents', 'sourceText',
  'compiledContext', 'context', 'messages', 'prompt', 'authorization',
  'apiKey', 'secret', 'token', 'credential', 'requestBody', 'responseBody',
] as const

/**
 * Two fact scores, deliberately kept apart.
 *
 * `deterministic` is exact-span containment. It is reproducible by anyone with
 * the corpus, and it under-counts: a semantically correct answer that
 * paraphrases the span scores zero. On this run it reports 24/60 for the Maha
 * path.
 *
 * `adjudicated` is the path-blinded semantic rubric applied to the same
 * answers, which is the number the public page shows. It reports 60/60.
 *
 * Publishing one without the other is how a reviewer who recomputes from the
 * checkpoint concludes the page is wrong. Both travel together, always.
 */
export type Wso2LiveFactScore = { answered: number; total: number }

export type Wso2LiveEvidenceRow = {
  path: Wso2LiveEvidencePath
  outcome: 'ok' | 'failed'
  providerInputTokens: number
  providerOutputTokens: number
  costMicrodollars: number
  latencyMs: number
  deterministicFacts: Wso2LiveFactScore
  adjudicatedFacts: Wso2LiveFactScore
  expectedCitationLinks: { resolved: number; total: number }
  prohibitedAssertionCount: number
  contextStrategy: string
  /** Present only on the Maha path; null elsewhere because no bypass exists to report. */
  bypassApplied: boolean | null
  bypassReason: string | null
}

export type Wso2LiveEvidenceWorkload = {
  workloadId: string
  difficulty: 'easy' | 'medium' | 'hard'
  rows: Wso2LiveEvidenceRow[]
}

export type Wso2LiveEvidencePathAggregate = {
  calls: number
  successfulCalls: number
  providerInputTokens: number
  providerOutputTokens: number
  costMicrodollars: number
  costUsd: string
  deterministicFacts: Wso2LiveFactScore
  adjudicatedFacts: Wso2LiveFactScore
  expectedCitationLinks: { resolved: number; total: number }
  latencyMs: { p50: number; p95: number; min: number; max: number }
  bypassCount: number
}

export type Wso2LiveEvidenceArtifact = {
  schemaVersion: '1.0.0'
  artifactId: 'maha-wso2-large-context-live-v1'
  runLabel: string
  observedAt: string
  generation: {
    method: string
    generator: string
    sourceCheckpointFilename: string
    sourceCheckpointSha256: string
    sourceAdjudicationFilename: string
    sourceAdjudicationSha256: string
    sourceAdjudicationKeyFilename: string
    sourceAdjudicationKeySha256: string
    primaryEvidenceCommitted: false
    primaryEvidenceWithheldReason: string
  }
  corpus: { path: string; labelFreezeDigest: string; workloadCount: number; synthetic: true }
  configuration: {
    gatewayProduct: string
    gatewayVersion: string
    promptCompressorVersion: string
    promptCompressorRetainedRatio: number
    mahaInterceptorVersion: string
    mahaInterceptorFailClosed: true
    model: string
    temperature: number
    maxOutputTokens: number
    automaticRetries: 0
    pricingAssumptionUsdPerMillionTokens: { input: string; output: string }
  }
  workloads: Wso2LiveEvidenceWorkload[]
  aggregates: Record<Wso2LiveEvidencePath, Wso2LiveEvidencePathAggregate>
  comparison: {
    inputTokenReductionPercent: string
    costReductionPercent: string
    baselinePath: Wso2LiveEvidencePath
    comparedPath: Wso2LiveEvidencePath
  }
  sanitization: {
    syntheticCorpus: true
    modelAnswerTextRetained: false
    sourceDocumentTextRetained: false
    compiledContextRetained: false
    credentialsRetained: false
    requestBodiesRetained: false
  }
  limitations: string[]
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object.`)
  return value as Record<string, unknown>
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${path} must be a non-empty string.`)
  return value
}

function asInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`${path} must be a non-negative integer.`)
  return value
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean.`)
  return value
}

function asFactScore(value: unknown, path: string): Wso2LiveFactScore {
  const record = asRecord(value, path)
  const answered = asInteger(record.answered, `${path}.answered`)
  const total = asInteger(record.total, `${path}.total`)
  if (answered > total) throw new Error(`${path}.answered cannot exceed ${path}.total.`)
  return { answered, total }
}

/** Microdollars to a fixed six-decimal USD string, without floating-point drift. */
export function formatCostUsd(microdollars: number): string {
  const negative = microdollars < 0
  const absolute = Math.abs(microdollars)
  const whole = Math.floor(absolute / 1_000_000)
  const fraction = String(absolute % 1_000_000).padStart(6, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/** Nearest-rank percentile over a sorted copy. Matches the failure-path suite's convention. */
function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const rank = Math.max(1, Math.ceil(fraction * sorted.length))
  return sorted[Math.min(rank, sorted.length) - 1]
}

function percent(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.00'
  return ((numerator / denominator) * 100).toFixed(2)
}

/**
 * Recomputes every aggregate from the rows.
 *
 * This is the whole point of the artifact: the totals are not asserted, they
 * are derived, and a discrepancy between the stored total and the derived one
 * is a hard failure rather than a rounding note.
 */
export function deriveAggregates(
  workloads: Wso2LiveEvidenceWorkload[],
): Record<Wso2LiveEvidencePath, Wso2LiveEvidencePathAggregate> {
  const output = {} as Record<Wso2LiveEvidencePath, Wso2LiveEvidencePathAggregate>
  for (const path of WSO2_LIVE_EVIDENCE_PATHS) {
    const rows = workloads.flatMap((workload) => workload.rows.filter((row) => row.path === path))
    const latencies = rows.map((row) => row.latencyMs).sort((left, right) => left - right)
    const costMicrodollars = rows.reduce((sum, row) => sum + row.costMicrodollars, 0)
    output[path] = {
      calls: rows.length,
      successfulCalls: rows.filter((row) => row.outcome === 'ok').length,
      providerInputTokens: rows.reduce((sum, row) => sum + row.providerInputTokens, 0),
      providerOutputTokens: rows.reduce((sum, row) => sum + row.providerOutputTokens, 0),
      costMicrodollars,
      costUsd: formatCostUsd(costMicrodollars),
      deterministicFacts: {
        answered: rows.reduce((sum, row) => sum + row.deterministicFacts.answered, 0),
        total: rows.reduce((sum, row) => sum + row.deterministicFacts.total, 0),
      },
      adjudicatedFacts: {
        answered: rows.reduce((sum, row) => sum + row.adjudicatedFacts.answered, 0),
        total: rows.reduce((sum, row) => sum + row.adjudicatedFacts.total, 0),
      },
      expectedCitationLinks: {
        resolved: rows.reduce((sum, row) => sum + row.expectedCitationLinks.resolved, 0),
        total: rows.reduce((sum, row) => sum + row.expectedCitationLinks.total, 0),
      },
      latencyMs: {
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        min: latencies[0] ?? 0,
        max: latencies[latencies.length - 1] ?? 0,
      },
      bypassCount: rows.filter((row) => row.bypassApplied === true).length,
    }
  }
  return output
}

export function deriveComparison(
  aggregates: Record<Wso2LiveEvidencePath, Wso2LiveEvidencePathAggregate>,
): Wso2LiveEvidenceArtifact['comparison'] {
  const baseline = aggregates['wso2-baseline']
  const maha = aggregates['wso2-maha-context-compiler']
  return {
    inputTokenReductionPercent: percent(baseline.providerInputTokens - maha.providerInputTokens, baseline.providerInputTokens),
    costReductionPercent: percent(baseline.costMicrodollars - maha.costMicrodollars, baseline.costMicrodollars),
    baselinePath: 'wso2-baseline',
    comparedPath: 'wso2-maha-context-compiler',
  }
}

/** Walks every key at every depth. A forbidden key anywhere fails the artifact. */
export function findForbiddenKeys(value: unknown, path = 'artifact'): string[] {
  const found: string[] = []
  const forbidden = new Set<string>(WSO2_LIVE_EVIDENCE_FORBIDDEN_KEYS)
  const visit = (node: unknown, where: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${where}[${index}]`))
      return
    }
    if (!node || typeof node !== 'object') return
    for (const [key, child] of Object.entries(node)) {
      if (forbidden.has(key)) found.push(`${where}.${key}`)
      visit(child, `${where}.${key}`)
    }
  }
  visit(value, path)
  return found
}

function parseRow(value: unknown, path: string): Wso2LiveEvidenceRow {
  const record = asRecord(value, path)
  const rowPath = asString(record.path, `${path}.path`)
  if (!(WSO2_LIVE_EVIDENCE_PATHS as readonly string[]).includes(rowPath)) {
    throw new Error(`${path}.path must be one of: ${WSO2_LIVE_EVIDENCE_PATHS.join(', ')}.`)
  }
  const outcome = asString(record.outcome, `${path}.outcome`)
  if (outcome !== 'ok' && outcome !== 'failed') throw new Error(`${path}.outcome must be 'ok' or 'failed'.`)
  const citations = asRecord(record.expectedCitationLinks, `${path}.expectedCitationLinks`)
  const resolved = asInteger(citations.resolved, `${path}.expectedCitationLinks.resolved`)
  const total = asInteger(citations.total, `${path}.expectedCitationLinks.total`)
  if (resolved > total) throw new Error(`${path}.expectedCitationLinks.resolved cannot exceed total.`)

  // Bypass is a Maha-path concept. Reporting `false` on a baseline row would
  // read as "we checked and it did not bypass", which is not a thing that can
  // be checked there, so those rows carry null.
  const isMaha = rowPath === 'wso2-maha-context-compiler'
  const bypassApplied = record.bypassApplied === null ? null : asBoolean(record.bypassApplied, `${path}.bypassApplied`)
  const bypassReason = record.bypassReason === null ? null : asString(record.bypassReason, `${path}.bypassReason`)
  if (isMaha && bypassApplied === null) throw new Error(`${path}.bypassApplied is required on the Maha path.`)
  if (!isMaha && bypassApplied !== null) throw new Error(`${path}.bypassApplied must be null outside the Maha path.`)

  return {
    path: rowPath as Wso2LiveEvidencePath,
    outcome,
    providerInputTokens: asInteger(record.providerInputTokens, `${path}.providerInputTokens`),
    providerOutputTokens: asInteger(record.providerOutputTokens, `${path}.providerOutputTokens`),
    costMicrodollars: asInteger(record.costMicrodollars, `${path}.costMicrodollars`),
    latencyMs: asInteger(record.latencyMs, `${path}.latencyMs`),
    deterministicFacts: asFactScore(record.deterministicFacts, `${path}.deterministicFacts`),
    adjudicatedFacts: asFactScore(record.adjudicatedFacts, `${path}.adjudicatedFacts`),
    expectedCitationLinks: { resolved, total },
    prohibitedAssertionCount: asInteger(record.prohibitedAssertionCount, `${path}.prohibitedAssertionCount`),
    contextStrategy: asString(record.contextStrategy, `${path}.contextStrategy`),
    bypassApplied,
    bypassReason,
  }
}

/**
 * Validates shape, completeness and internal consistency, then re-derives every
 * aggregate. A stored total that disagrees with the rows throws.
 */
export function parseWso2LiveEvidence(value: unknown): Wso2LiveEvidenceArtifact {
  const record = asRecord(value, 'artifact')
  if (record.schemaVersion !== '1.0.0') throw new Error("artifact.schemaVersion must be '1.0.0'.")
  if (record.artifactId !== 'maha-wso2-large-context-live-v1') throw new Error('artifact.artifactId is not the expected identifier.')

  const forbidden = findForbiddenKeys(record)
  if (forbidden.length > 0) throw new Error(`artifact contains forbidden field(s): ${forbidden.join(', ')}.`)

  const corpus = asRecord(record.corpus, 'artifact.corpus')
  const expectedWorkloads = asInteger(corpus.workloadCount, 'artifact.corpus.workloadCount')
  if (corpus.synthetic !== true) throw new Error('artifact.corpus.synthetic must be true; this corpus is synthetic.')

  if (!Array.isArray(record.workloads)) throw new Error('artifact.workloads must be an array.')
  if (record.workloads.length !== expectedWorkloads) {
    throw new Error(`artifact.workloads must contain ${expectedWorkloads} workloads; found ${record.workloads.length}.`)
  }

  const seen = new Set<string>()
  const workloads: Wso2LiveEvidenceWorkload[] = record.workloads.map((item, index) => {
    const where = `artifact.workloads[${index}]`
    const workload = asRecord(item, where)
    const workloadId = asString(workload.workloadId, `${where}.workloadId`)
    if (seen.has(workloadId)) throw new Error(`${where}.workloadId '${workloadId}' is duplicated.`)
    seen.add(workloadId)
    const difficulty = asString(workload.difficulty, `${where}.difficulty`)
    if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') {
      throw new Error(`${where}.difficulty must be easy, medium or hard.`)
    }
    if (!Array.isArray(workload.rows)) throw new Error(`${where}.rows must be an array.`)
    const rows = workload.rows.map((row, rowIndex) => parseRow(row, `${where}.rows[${rowIndex}]`))
    // Every workload must carry exactly one row per path, or an aggregate is
    // averaging over a hole it cannot see.
    const paths = rows.map((row) => row.path)
    for (const path of WSO2_LIVE_EVIDENCE_PATHS) {
      const count = paths.filter((candidate) => candidate === path).length
      if (count !== 1) throw new Error(`${where} must contain exactly one '${path}' row; found ${count}.`)
    }
    return { workloadId, difficulty, rows }
  })

  const derivedAggregates = deriveAggregates(workloads)
  const storedAggregates = asRecord(record.aggregates, 'artifact.aggregates')
  for (const path of WSO2_LIVE_EVIDENCE_PATHS) {
    const stored = JSON.stringify(asRecord(storedAggregates[path], `artifact.aggregates.${path}`))
    const derived = JSON.stringify(derivedAggregates[path])
    if (stored !== derived) {
      throw new Error(`artifact.aggregates.${path} does not match the value derived from workload rows.`)
    }
  }

  const derivedComparison = deriveComparison(derivedAggregates)
  if (JSON.stringify(record.comparison) !== JSON.stringify(derivedComparison)) {
    throw new Error('artifact.comparison does not match the value derived from workload rows.')
  }

  const sanitization = asRecord(record.sanitization, 'artifact.sanitization')
  for (const flag of ['modelAnswerTextRetained', 'sourceDocumentTextRetained', 'compiledContextRetained', 'credentialsRetained', 'requestBodiesRetained'] as const) {
    if (sanitization[flag] !== false) throw new Error(`artifact.sanitization.${flag} must be false.`)
  }
  if (sanitization.syntheticCorpus !== true) throw new Error('artifact.sanitization.syntheticCorpus must be true.')

  // An empty pricing object serializes away silently and takes every cost
  // figure's basis with it. Both prices must be present and parseable.
  const configuration = asRecord(record.configuration, 'artifact.configuration')
  const pricing = asRecord(configuration.pricingAssumptionUsdPerMillionTokens, 'artifact.configuration.pricingAssumptionUsdPerMillionTokens')
  for (const side of ['input', 'output'] as const) {
    const price = asString(pricing[side], `artifact.configuration.pricingAssumptionUsdPerMillionTokens.${side}`)
    if (!/^\d+\.\d{6}$/.test(price)) {
      throw new Error(`artifact.configuration.pricingAssumptionUsdPerMillionTokens.${side} must be a six-decimal USD string.`)
    }
  }

  if (!Array.isArray(record.limitations) || record.limitations.length === 0) {
    throw new Error('artifact.limitations must list at least one limitation.')
  }

  return record as unknown as Wso2LiveEvidenceArtifact
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

let cached: Wso2LiveEvidenceArtifact | null = null

/** Reads, validates and memoizes the committed artifact. Throws on any defect. */
export function loadWso2LiveEvidence(path = WSO2_LIVE_EVIDENCE_PATH): Wso2LiveEvidenceArtifact {
  if (cached && path === WSO2_LIVE_EVIDENCE_PATH) return cached
  const parsed = parseWso2LiveEvidence(JSON.parse(readFileSync(path, 'utf8')))
  if (path === WSO2_LIVE_EVIDENCE_PATH) cached = parsed
  return parsed
}
