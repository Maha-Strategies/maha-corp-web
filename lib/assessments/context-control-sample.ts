import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  WSO2_LIVE_EVIDENCE_PATH,
  WSO2_LIVE_EVIDENCE_PATHS,
  loadWso2LiveEvidence,
  type Wso2LiveEvidencePath,
} from '../integrations/wso2-live-evidence.ts'

/**
 * The model behind the sample Context-Control Evidence Assessment.
 *
 * Everything a reader could check is computed here from committed evidence.
 * Nothing in this module types a measurement in by hand, which is the property
 * the accompanying test enforces: the document is regenerated and compared
 * byte-for-byte, so a number that drifts from the artifact fails the build
 * rather than reaching a buyer.
 *
 * The corpus behind these figures is synthetic. Every surface produced from
 * this model has to say so, on every page.
 */
export const SAMPLE_ASSESSMENT_MARKDOWN_PATH = 'content/assessments/context-control-evidence-assessment-sample.md'
export const SAMPLE_ASSESSMENT_PDF_PATH = 'content/assessments/context-control-evidence-assessment-sample.pdf'

export const SAMPLE_ASSESSMENT_BANNER = 'Sample assessment - synthetic evaluation corpus - not a customer result.'

const REPRODUCTION_PATH = 'content/integrations/wso2-reproduction.json'
const FAILURE_PATH = 'content/integrations/wso2-failure-path-result.json'
const TRACE_PATH = 'content/integrations/wso2-sanitized-three-path-trace.json'

export const PATH_LABELS: Record<Wso2LiveEvidencePath, string> = {
  'wso2-baseline': 'Baseline (no compression)',
  'wso2-native-prompt-compressor': 'WSO2 Prompt Compressor',
  'wso2-maha-context-compiler': 'WSO2 + Maha Context Compiler',
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Thousands separators without pulling in a locale that varies by machine. */
export function groupDigits(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export type AssessmentFindingRow = {
  path: Wso2LiveEvidencePath
  label: string
  providerInputTokens: string
  modeledCostUsd: string
  latencyP50: string
  latencyP95: string
  adjudicatedFacts: string
  deterministicFacts: string
  citations: string
}

export type AssessmentFailureCase = {
  id: string
  layer: string
  observedStatus: string
  upstreamForwarded: string
}

export type AssessmentTraceRow = {
  label: string
  inputTokens: string
  outputTokens: string
  latencyMs: string
  modeledCostUsd: string
}

export type SampleAssessment = ReturnType<typeof buildSampleAssessment>

export function buildSampleAssessment() {
  const evidence = loadWso2LiveEvidence()
  const reproduction = JSON.parse(readFileSync(REPRODUCTION_PATH, 'utf8'))
  const failure = JSON.parse(readFileSync(FAILURE_PATH, 'utf8'))
  const trace = JSON.parse(readFileSync(TRACE_PATH, 'utf8'))

  const callCount = evidence.workloads.length * WSO2_LIVE_EVIDENCE_PATHS.length
  const difficulties = { easy: 0, medium: 0, hard: 0 }
  for (const workload of evidence.workloads) difficulties[workload.difficulty] += 1

  const findings: AssessmentFindingRow[] = WSO2_LIVE_EVIDENCE_PATHS.map((path) => {
    const aggregate = evidence.aggregates[path]
    return {
      path,
      label: PATH_LABELS[path],
      providerInputTokens: groupDigits(aggregate.providerInputTokens),
      modeledCostUsd: `$${aggregate.costUsd}`,
      latencyP50: `${groupDigits(aggregate.latencyMs.p50)} ms`,
      latencyP95: `${groupDigits(aggregate.latencyMs.p95)} ms`,
      adjudicatedFacts: `${aggregate.adjudicatedFacts.answered} / ${aggregate.adjudicatedFacts.total}`,
      deterministicFacts: `${aggregate.deterministicFacts.answered} / ${aggregate.deterministicFacts.total}`,
      citations: `${aggregate.expectedCitationLinks.resolved} / ${aggregate.expectedCitationLinks.total}`,
    }
  })

  const maha = evidence.aggregates['wso2-maha-context-compiler']
  const baseline = evidence.aggregates['wso2-baseline']

  // Bypass is the guarantee that enabling the policy cannot make a small or
  // non-reducing payload larger. On this corpus it never engaged, and that is
  // reported as an absence of observation rather than as a passed test.
  const bypassEngaged = maha.bypassCount

  const failureCases: AssessmentFailureCase[] = failure.cases.map((entry: Record<string, unknown>) => {
    const observed = entry.observed as Record<string, unknown>
    return {
      id: String(entry.id),
      layer: String(entry.layer),
      observedStatus: `HTTP ${observed.httpStatus}${observed.code ? ` (${observed.code})` : ''}`,
      upstreamForwarded: observed.upstreamForwarded === false ? 'No' : 'Yes',
    }
  })

  // Metrics only. The committed trace retains a model answer; it must not
  // travel into a document that leaves the building.
  const traceRows: AssessmentTraceRow[] = trace.traces.map((entry: Record<string, unknown>) => {
    const response = entry.response as Record<string, unknown>
    const usage = (response.body as Record<string, unknown>).usage as Record<string, number>
    return {
      label: PATH_LABELS[entry.path as Wso2LiveEvidencePath] ?? String(entry.path),
      inputTokens: groupDigits(usage.inputTokens),
      outputTokens: groupDigits(usage.outputTokens),
      latencyMs: `${groupDigits(response.latencyMs as number)} ms`,
      modeledCostUsd: `$${response.estimatedProviderCostUsd}`,
    }
  })

  return {
    banner: SAMPLE_ASSESSMENT_BANNER,
    title: 'Context-Control Evidence Assessment',
    subtitle: 'Sample deliverable, produced from a frozen synthetic evaluation corpus',
    preparedBy: 'Maha Strategies LLC',
    runLabel: evidence.runLabel,
    observedDate: evidence.observedAt.slice(0, 10),
    corpus: {
      workloadCount: evidence.workloads.length,
      callCount,
      difficulties,
      labelFreezeDigest: evidence.corpus.labelFreezeDigest,
      path: evidence.corpus.path,
      requiredFactCount: reproduction.corpus.requiredFactCount as number,
      expectedCitationCount: reproduction.corpus.expectedCitationCount as number,
    },
    configuration: evidence.configuration,
    findings,
    comparison: evidence.comparison,
    tokensAvoided: groupDigits(baseline.providerInputTokens - maha.providerInputTokens),
    costAvoidedUsd: `$${((baseline.costMicrodollars - maha.costMicrodollars) / 1_000_000).toFixed(6)}`,
    successfulCalls: WSO2_LIVE_EVIDENCE_PATHS.reduce((sum, path) => sum + evidence.aggregates[path].successfulCalls, 0),
    prohibitedAssertions: evidence.workloads
      .flatMap((workload) => workload.rows)
      .reduce((sum, row) => sum + row.prohibitedAssertionCount, 0),
    bypassEngaged,
    failure: {
      evaluationId: failure.evaluationId as string,
      evaluatedDate: String(failure.evaluatedAt).slice(0, 10),
      liveProviderCalls: failure.liveProviderCalls as number,
      requestPassthroughOnError: failure.configuration.requestPassthroughOnError as boolean,
      responsePassthroughOnError: failure.configuration.responsePassthroughOnError as boolean,
      timeoutMillis: failure.configuration.timeoutMillis as number,
      cases: failureCases,
      upstreamTests: failure.upstreamPolicyVerification.testsPassed as string[],
      repetitionsPerScenario: failure.upstreamPolicyVerification.repeatedLatency.repetitionsPerScenario as number,
      limitations: failure.limitations as string[],
    },
    trace: {
      traceId: trace.traceId as string,
      workloadId: trace.workload.id as string,
      difficulty: trace.workload.difficulty as string,
      documentCount: trace.workload.documentCount as number,
      sourceBytes: groupDigits(trace.workload.totalSourceUtf8Bytes as number),
      rows: traceRows,
      limitations: trace.limitations as string[],
    },
    digests: {
      evidenceArtifact: sha256File(WSO2_LIVE_EVIDENCE_PATH),
      corpusLabelFreeze: evidence.corpus.labelFreezeDigest,
      sourceCheckpoint: evidence.generation.sourceCheckpointSha256,
      sourceAdjudication: evidence.generation.sourceAdjudicationSha256,
      reproductionManifest: sha256File(REPRODUCTION_PATH),
      failurePathEvidence: sha256File(FAILURE_PATH),
    },
    artifactLimitations: evidence.limitations,
  }
}
