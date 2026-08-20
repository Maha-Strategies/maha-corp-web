import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  WSO2_EVALUATION_MAX_OUTPUT_TOKENS,
  WSO2_EVALUATION_MODEL,
  WSO2_EVALUATION_PATHS,
  WSO2_EVALUATION_TEMPERATURE,
  sanitizeAdjudicationAnswer,
  type Wso2EvaluationPath,
} from '../lib/integrations/wso2-evaluation-harness.ts'
import { parseWso2EvaluationCorpus } from '../lib/integrations/wso2-evaluation-corpus.ts'

type CheckpointRecord = {
  workloadId: string
  path: Wso2EvaluationPath
  outcome: 'ok' | 'failed'
  costMicrodollars: string
  completedAt: string
  result: {
    difficulty: string
    context: Record<string, unknown>
    answer: {
      ok: boolean
      error: string | null
      providerInputTokens: number | null
      providerOutputTokens: number | null
      latencyMs: number
      reviewText?: string
      requiredFactsAnswered: number
      requiredFactsTotal: number
      citationsResolvable: number
      expectedCitationLinksResolved: number
      expectedCitationLinksTotal: number
      prohibitedAssertions: string[]
    }
  }
}

type Checkpoint = {
  schemaVersion: string
  corpusDigest: string
  model: string
  records: CheckpointRecord[]
}

type GatewayConfiguration = {
  gateway: { version: string }
  apis: {
    pathId: Wso2EvaluationPath
    context: string
    resource: string
    policies: { name?: string; version?: string; installedVersion?: string; attachmentVersion?: string; parameters?: unknown }[]
  }[]
}

type Adjudication = {
  corpusDigest: string
  method: string
  responses: {
    responseId: string
    workloadId: string
    answer: string
    requiredFacts: { id: string; verdict: 'answered' | 'not_answered'; basis: string }[]
  }[]
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function usdFromMicrodollars(value: string): string {
  const amount = BigInt(value)
  const scale = BigInt(1_000_000)
  return `${amount / scale}.${(amount % scale).toString().padStart(6, '0')}`
}

function argumentValue(argv: string[], name: string): string | undefined {
  return argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)
}

export function buildSanitizedWso2Trace(input: {
  corpusValue: unknown
  gatewayConfiguration: GatewayConfiguration
  checkpoint: Checkpoint
  checkpointFilename: string
  checkpointSha256: string
  adjudication?: Adjudication
  adjudicationFilename?: string
  adjudicationSha256?: string
  workloadId: string
}) {
  const corpus = parseWso2EvaluationCorpus(input.corpusValue)
  if (input.checkpoint.corpusDigest !== corpus.labelFreeze.digest) {
    throw new Error('Checkpoint corpus digest does not match the frozen corpus.')
  }
  if (input.checkpoint.model !== WSO2_EVALUATION_MODEL) {
    throw new Error('Checkpoint model does not match the frozen evaluator model.')
  }
  if (input.adjudication && input.adjudication.corpusDigest !== corpus.labelFreeze.digest) {
    throw new Error('Adjudication corpus digest does not match the frozen corpus.')
  }
  const workload = corpus.workloads.find((candidate) => candidate.id === input.workloadId)
  if (!workload) throw new Error(`Unknown workload: ${input.workloadId}`)
  const records = WSO2_EVALUATION_PATHS.map((path) => input.checkpoint.records.find(
    (record) => record.workloadId === workload.id && record.path === path,
  ))
  if (records.some((record) => !record)) throw new Error('The checkpoint does not contain all three requested path results.')

  const documents = workload.request.documents.map((document) => ({
    sourceId: document.id,
    title: document.title ?? null,
    utf8Bytes: Buffer.byteLength(document.text, 'utf8'),
    sha256: `sha256:${sha256(document.text)}`,
    textRetainedInTrace: false,
  }))
  const contextBytes = workload.request.documents.reduce((sum, document) => sum + Buffer.byteLength(document.text, 'utf8'), 0)
  const completedAt = records.map((record) => record!.completedAt).sort().at(-1)

  return {
    schemaVersion: '1.0.0',
    traceId: `wso2-sanitized-${workload.id}`,
    traceKind: 'sanitized-reconstruction-from-frozen-corpus-and-durable-checkpoint',
    observedAt: completedAt,
    warning: 'This is a sanitized reconstruction for technical review, not a raw packet capture.',
    sanitization: {
      syntheticWorkload: true,
      customerDataRetained: false,
      sourceDocumentTextRetained: false,
      compiledContextRetained: false,
      credentialsRetained: false,
      rawRequestHeadersRetained: false,
      modelAnswerRetained: true,
    },
    provenance: {
      checkpointFilename: basename(input.checkpointFilename),
      checkpointSha256: `sha256:${input.checkpointSha256}`,
      adjudicationFilename: input.adjudicationFilename ? basename(input.adjudicationFilename) : null,
      adjudicationSha256: input.adjudicationSha256 ? `sha256:${input.adjudicationSha256}` : null,
      corpusDigest: corpus.labelFreeze.digest,
      gatewayVersion: input.gatewayConfiguration.gateway.version,
      model: WSO2_EVALUATION_MODEL,
      temperature: WSO2_EVALUATION_TEMPERATURE,
      maxOutputTokens: WSO2_EVALUATION_MAX_OUTPUT_TOKENS,
      automaticRetries: 0,
    },
    workload: {
      id: workload.id,
      difficulty: workload.difficulty,
      task: workload.request.task,
      tokenBudget: workload.request.tokenBudget,
      documentCount: documents.length,
      totalSourceUtf8Bytes: contextBytes,
      documents,
    },
    traces: WSO2_EVALUATION_PATHS.map((path, index) => {
      const record = records[index]!
      if (record.outcome !== 'ok' || !record.result.answer.ok || !record.result.answer.reviewText) {
        throw new Error(`Path ${path} has no successful sanitized response to trace.`)
      }
      const api = input.gatewayConfiguration.apis.find((candidate) => candidate.pathId === path)
      if (!api) throw new Error(`Gateway configuration has no API for ${path}.`)
      const isMaha = path === 'wso2-maha-context-compiler'
      const systemPrompt = isMaha
        ? { representation: 'maha-context-placeholder', sourceTextIncluded: false }
        : {
            representation: 'whole-source-context-redacted',
            sourceTextIncluded: false,
            sourceDocumentCount: documents.length,
            sourceUtf8Bytes: contextBytes,
            sourceDigests: documents.map((document) => ({ sourceId: document.sourceId, sha256: document.sha256 })),
          }
      const allowedEvidenceHeaders = isMaha ? Object.fromEntries([
        ['x-maha-context-pack-id', record.result.context.packId],
        ['x-maha-context-input-hash', record.result.context.inputHash],
        ['x-maha-context-output-hash', record.result.context.outputHash],
        ['x-maha-compiled-estimated-tokens', record.result.context.mahaEstimatedCompiledTokens],
        ['x-maha-source-coverage-percent', record.result.context.sourceCoveragePercent],
        ['x-maha-included-passage-count', record.result.context.includedPassageCount],
        ['x-maha-context-bypassed', record.result.context.bypassApplied],
        ['x-maha-context-bypass-reason', record.result.context.bypassReason],
      ].filter(([, value]) => value !== undefined)) : {}
      const reviewText = sanitizeAdjudicationAnswer(record.result.answer.reviewText)
      const adjudicated = input.adjudication?.responses.find((response) => (
        response.workloadId === workload.id
        && sanitizeAdjudicationAnswer(response.answer) === reviewText
      ))

      return {
        path,
        gatewayRoute: `${api.context}${api.resource}`,
        policies: api.policies.map((policy) => ({
          name: policy.name ?? null,
          installedVersion: policy.installedVersion ?? policy.version ?? null,
          attachmentVersion: policy.attachmentVersion ?? null,
          parameters: policy.parameters ?? null,
        })),
        request: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': '[REDACTED]',
            ...(isMaha ? { 'x-maha-interceptor-token': '[REDACTED_AND_STRIPPED_BEFORE_PROVIDER]' } : {}),
          },
          body: {
            model: WSO2_EVALUATION_MODEL,
            temperature: WSO2_EVALUATION_TEMPERATURE,
            max_tokens: WSO2_EVALUATION_MAX_OUTPUT_TOKENS,
            stream: false,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: workload.request.task },
            ],
            ...(isMaha ? {
              maha_context: {
                clientRequestId: workload.request.clientRequestId,
                tokenBudget: workload.request.tokenBudget,
                documents,
              },
            } : {}),
          },
        },
        response: {
          httpStatus: 200,
          evidenceHeaders: allowedEvidenceHeaders,
          body: {
            answer: reviewText,
            answerSha256: `sha256:${sha256(reviewText)}`,
            usage: {
              inputTokens: record.result.answer.providerInputTokens,
              outputTokens: record.result.answer.providerOutputTokens,
            },
          },
          latencyMs: record.result.answer.latencyMs,
          estimatedProviderCostUsd: usdFromMicrodollars(record.costMicrodollars),
        },
        evaluation: {
          requiredFactsAnsweredByDeterministicScorer: record.result.answer.requiredFactsAnswered,
          requiredFactsTotal: record.result.answer.requiredFactsTotal,
          citationsResolvable: record.result.answer.citationsResolvable,
          expectedCitationLinksResolved: record.result.answer.expectedCitationLinksResolved,
          expectedCitationLinksTotal: record.result.answer.expectedCitationLinksTotal,
          prohibitedAssertions: record.result.answer.prohibitedAssertions,
          contextMeasurements: record.result.context,
          humanAdjudication: adjudicated ? {
            pathBlindedDuringReview: true,
            method: input.adjudication?.method,
            responseId: adjudicated.responseId,
            requiredFactsAnswered: adjudicated.requiredFacts.filter((fact) => fact.verdict === 'answered').length,
            requiredFactsTotal: adjudicated.requiredFacts.length,
            verdicts: adjudicated.requiredFacts,
          } : null,
        },
      }
    }),
    limitations: [
      'The workload is synthetic and does not establish performance on customer data.',
      'Request bodies are structural reconstructions with source text replaced by lengths and digests.',
      'Prompt Compressor internal context is not observable at this measurement boundary.',
      'Deterministic fact scoring can send semantically correct paraphrases to manual review.',
      'One trace is illustrative; aggregate conclusions must use the complete frozen corpus.',
    ],
  }
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2)
  const checkpointPath = argumentValue(argv, '--checkpoint')
  if (!checkpointPath) throw new Error('--checkpoint=<path> is required.')
  const corpusPath = argumentValue(argv, '--corpus') ?? 'content/integrations/wso2-large-context-cost-corpus.json'
  const gatewayPath = argumentValue(argv, '--gateway') ?? 'content/integrations/wso2-gateway-apis.json'
  const workloadId = argumentValue(argv, '--workload') ?? 'release-evidence-rag'
  const outputPath = argumentValue(argv, '--output') ?? 'content/integrations/wso2-sanitized-three-path-trace.json'
  const adjudicationPath = argumentValue(argv, '--adjudication')
  const checkpointBytes = readFileSync(checkpointPath)
  const adjudicationBytes = adjudicationPath ? readFileSync(adjudicationPath) : undefined
  const artifact = buildSanitizedWso2Trace({
    corpusValue: JSON.parse(readFileSync(join(process.cwd(), corpusPath), 'utf8')),
    gatewayConfiguration: JSON.parse(readFileSync(join(process.cwd(), gatewayPath), 'utf8')) as GatewayConfiguration,
    checkpoint: JSON.parse(checkpointBytes.toString('utf8')) as Checkpoint,
    checkpointFilename: checkpointPath,
    checkpointSha256: sha256(checkpointBytes),
    adjudication: adjudicationBytes ? JSON.parse(adjudicationBytes.toString('utf8')) as Adjudication : undefined,
    adjudicationFilename: adjudicationPath,
    adjudicationSha256: adjudicationBytes ? sha256(adjudicationBytes) : undefined,
    workloadId,
  })
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ output: outputPath, workloadId, paths: artifact.traces.length, liveCalls: 0 }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error)
    process.exitCode = 1
  })
}
