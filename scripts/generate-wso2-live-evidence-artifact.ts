/**
 * Derives the public, sanitized live-evaluation artifact from the run's primary
 * evidence.
 *
 * The primary evidence is three files that are deliberately never committed --
 * the durable checkpoint, the path-blinded adjudication, and its blinding key --
 * because the first and second carry the model's answer text. This script is
 * the only supported way to turn them into the committed artifact, and it makes
 * no provider call: it reads finished measurements and projects them.
 *
 *   node --experimental-strip-types scripts/generate-wso2-live-evidence-artifact.ts \
 *     --checkpoint=/path/to/checkpoint.json \
 *     --adjudication=/path/to/adjudicated.json \
 *     --adjudication-key=/path/to/adjudication-key.json
 *
 * Pass --check to verify the committed artifact still reproduces byte-for-byte
 * from the same inputs rather than rewriting it.
 */
import { readFileSync, writeFileSync } from 'node:fs'

import {
  WSO2_LIVE_EVIDENCE_PATH,
  WSO2_LIVE_EVIDENCE_PATHS,
  deriveAggregates,
  deriveComparison,
  findForbiddenKeys,
  parseWso2LiveEvidence,
  sha256File,
  type Wso2LiveEvidenceRow,
  type Wso2LiveEvidenceWorkload,
} from '../lib/integrations/wso2-live-evidence.ts'
import {
  WSO2_EVALUATION_MAX_OUTPUT_TOKENS,
  WSO2_EVALUATION_MODEL,
  WSO2_EVALUATION_PRICING,
  WSO2_EVALUATION_TEMPERATURE,
} from '../lib/integrations/wso2-evaluation-harness.ts'

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

const checkpointPath = argument('checkpoint')
const adjudicationPath = argument('adjudication')
const adjudicationKeyPath = argument('adjudication-key')
const outputPath = argument('output') ?? WSO2_LIVE_EVIDENCE_PATH
const checkOnly = process.argv.includes('--check')

if (!checkpointPath || !adjudicationPath || !adjudicationKeyPath) {
  console.error('Required: --checkpoint=<path> --adjudication=<path> --adjudication-key=<path>')
  process.exit(2)
}

const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'))
const adjudication = JSON.parse(readFileSync(adjudicationPath, 'utf8'))
const adjudicationKey = JSON.parse(readFileSync(adjudicationKeyPath, 'utf8'))

// All three files must describe the same frozen corpus. A mismatch means the
// adjudication belongs to a different run than the measurements, which would
// silently produce a coherent-looking artifact about nothing.
const corpusDigest: string = checkpoint.corpusDigest
for (const [name, source] of [['adjudication', adjudication], ['adjudication key', adjudicationKey]] as const) {
  if (source.corpusDigest !== corpusDigest) {
    throw new Error(`The ${name} declares corpus ${source.corpusDigest}, but the checkpoint declares ${corpusDigest}.`)
  }
}

// Join the blinded adjudication back to its path. The blinding is what makes
// the semantic score credible; the key is what makes it attributable.
const pathByResponseId = new Map<string, string>(
  adjudicationKey.mappings.map((mapping: { responseId: string; path: string }) => [mapping.responseId, mapping.path]),
)
const adjudicatedByWorkloadAndPath = new Map<string, { answered: number; total: number }>()
for (const response of adjudication.responses) {
  const path = pathByResponseId.get(response.responseId)
  if (!path) throw new Error(`Adjudicated response ${response.responseId} has no entry in the blinding key.`)
  const answered = response.requiredFacts.filter((fact: { verdict: string }) => fact.verdict === 'answered').length
  adjudicatedByWorkloadAndPath.set(`${response.workloadId}::${path}`, { answered, total: response.requiredFacts.length })
}

const byWorkload = new Map<string, { difficulty: string; rows: Wso2LiveEvidenceRow[] }>()
for (const record of checkpoint.records) {
  const result = record.result
  const answer = result.answer
  const context = result.context ?? {}
  const isMaha = record.path === 'wso2-maha-context-compiler'
  const adjudicated = adjudicatedByWorkloadAndPath.get(`${record.workloadId}::${record.path}`)
  if (!adjudicated) throw new Error(`No adjudicated verdict for ${record.workloadId} on ${record.path}.`)

  const row: Wso2LiveEvidenceRow = {
    path: record.path,
    outcome: record.outcome === 'ok' ? 'ok' : 'failed',
    providerInputTokens: answer.providerInputTokens,
    providerOutputTokens: answer.providerOutputTokens,
    costMicrodollars: Number(record.costMicrodollars),
    latencyMs: answer.latencyMs,
    deterministicFacts: { answered: answer.requiredFactsAnswered, total: answer.requiredFactsTotal },
    adjudicatedFacts: adjudicated,
    expectedCitationLinks: {
      resolved: answer.expectedCitationLinksResolved,
      total: answer.expectedCitationLinksTotal,
    },
    prohibitedAssertionCount: (answer.prohibitedAssertions ?? []).length,
    contextStrategy: context.contextStrategy ?? 'unknown',
    bypassApplied: isMaha ? Boolean(context.bypassApplied) : null,
    bypassReason: isMaha ? String(context.bypassReason ?? 'none') : null,
  }

  const existing = byWorkload.get(record.workloadId)
  if (existing) existing.rows.push(row)
  else byWorkload.set(record.workloadId, { difficulty: result.difficulty, rows: [row] })
}

// Deterministic ordering: workloads by id, rows in declared path order. The
// artifact has to hash the same on every machine or the digest is worthless.
const workloads: Wso2LiveEvidenceWorkload[] = [...byWorkload.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([workloadId, entry]) => ({
    workloadId,
    difficulty: entry.difficulty as Wso2LiveEvidenceWorkload['difficulty'],
    rows: WSO2_LIVE_EVIDENCE_PATHS.map((path) => {
      const row = entry.rows.find((candidate) => candidate.path === path)
      if (!row) throw new Error(`Workload ${workloadId} has no ${path} row in the checkpoint.`)
      return row
    }),
  }))

const aggregates = deriveAggregates(workloads)

const artifact = {
  schemaVersion: '1.0.0' as const,
  artifactId: 'maha-wso2-large-context-live-v1' as const,
  runLabel: 'wso2-large-live-20260817-v1',
  observedAt: checkpoint.records
    .map((record: { completedAt: string }) => record.completedAt)
    .sort()
    .at(-1),
  generation: {
    method:
      'Derived mechanically from the durable live checkpoint plus the path-blinded adjudication joined to paths through its blinding key. No provider call is made by this generator, and no model answer text is carried forward.',
    generator: 'scripts/generate-wso2-live-evidence-artifact.ts',
    sourceCheckpointFilename: checkpointPath.split('/').at(-1),
    sourceCheckpointSha256: `sha256:${sha256File(checkpointPath)}`,
    sourceAdjudicationFilename: adjudicationPath.split('/').at(-1),
    sourceAdjudicationSha256: `sha256:${sha256File(adjudicationPath)}`,
    sourceAdjudicationKeyFilename: adjudicationKeyPath.split('/').at(-1),
    sourceAdjudicationKeySha256: `sha256:${sha256File(adjudicationKeyPath)}`,
    primaryEvidenceCommitted: false as const,
    primaryEvidenceWithheldReason:
      'The checkpoint and adjudication carry the model answer text for every call. They are retained outside the repository and identified here by SHA-256 so a reviewer under NDA can be given the exact bytes this artifact was derived from.',
  },
  corpus: {
    path: 'content/integrations/wso2-large-context-cost-corpus.json',
    labelFreezeDigest: corpusDigest,
    workloadCount: workloads.length,
    synthetic: true as const,
  },
  configuration: {
    gatewayProduct: 'WSO2 AI Gateway',
    gatewayVersion: '1.1.0',
    promptCompressorVersion: '0.9.0',
    promptCompressorRetainedRatio: 0.55,
    mahaInterceptorVersion: '1.0.0',
    mahaInterceptorFailClosed: true as const,
    model: checkpoint.model ?? WSO2_EVALUATION_MODEL,
    temperature: WSO2_EVALUATION_TEMPERATURE,
    maxOutputTokens: WSO2_EVALUATION_MAX_OUTPUT_TOKENS,
    automaticRetries: 0 as const,
    pricingAssumptionUsdPerMillionTokens: {
      input: WSO2_EVALUATION_PRICING.inputUsdPerMillion,
      output: WSO2_EVALUATION_PRICING.outputUsdPerMillion,
    },
  },
  workloads,
  aggregates,
  comparison: deriveComparison(aggregates),
  sanitization: {
    syntheticCorpus: true as const,
    modelAnswerTextRetained: false as const,
    sourceDocumentTextRetained: false as const,
    compiledContextRetained: false as const,
    credentialsRetained: false as const,
    requestBodiesRetained: false as const,
  },
  limitations: [
    'The corpus is synthetic. This run does not establish performance on a WSO2 customer workload.',
    'This is one execution on 2026-08-17. Latency is a single observation per call, not a percentile over repeated runs.',
    'Two fact scores are reported per row and they disagree. The deterministic score is exact-span containment and under-counts correct paraphrases; the adjudicated score applies a path-blinded semantic rubric to the same answers. Any published retention figure must say which one it is.',
    'The Prompt Compressor result is specific to WSO2 AI Gateway 1.1.0, Prompt Compressor 0.9.0 and a 0.55 retained ratio, and must not be generalized before WSO2 or a customer confirms that configuration is the intended production setup.',
    'Provider cost uses the declared pricing assumption applied to observed token counts; it is not a provider invoice.',
    'The primary checkpoint and adjudication files are not committed, so this artifact is reproducible only by a holder of those files. The digests above identify them exactly.',
  ],
}

const forbidden = findForbiddenKeys(artifact)
if (forbidden.length > 0) throw new Error(`Refusing to write: forbidden field(s) present: ${forbidden.join(', ')}`)

parseWso2LiveEvidence(artifact)

const serialized = `${JSON.stringify(artifact, null, 2)}\n`

if (checkOnly) {
  const current = readFileSync(outputPath, 'utf8')
  if (current !== serialized) {
    console.error(`${outputPath} does not reproduce from the supplied primary evidence.`)
    process.exit(1)
  }
  console.log(JSON.stringify({ status: 'reproduced', output: outputPath, workloads: workloads.length }, null, 2))
} else {
  writeFileSync(outputPath, serialized)
  console.log(JSON.stringify({
    status: 'written',
    output: outputPath,
    workloads: workloads.length,
    calls: workloads.length * WSO2_LIVE_EVIDENCE_PATHS.length,
    comparison: artifact.comparison,
    providerCallsMade: 0,
  }, null, 2))
}
