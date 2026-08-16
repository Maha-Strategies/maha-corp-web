import { writeFileSync } from 'node:fs'

import { estimateTokens, parseContextPackRequest } from '../lib/context-compiler.ts'
import { calculateWso2LabelFreezeDigest, type Wso2EvaluationCorpus, type Wso2EvaluationDifficulty } from '../lib/integrations/wso2-evaluation-corpus.ts'

const targets = [20_000, 24_000, 28_000, 32_000, 36_000, 40_000, 44_000, 48_000, 52_000, 56_000, 60_000, 64_000, 68_000, 72_000, 76_000, 80_000, 85_000, 90_000, 95_000, 99_980]
const scenarios = [
  ['release-evidence-rag', 'RAG passage export', 'release'],
  ['claims-policy-manual', 'policy manual with appendices', 'claims'],
  ['incident-timeline', 'timestamped incident timeline', 'incident'],
  ['vendor-contract-set', 'multi-contract clause set', 'vendor'],
  ['clinical-protocol-library', 'synthetic clinical protocol library', 'protocol'],
  ['audit-event-stream', 'dense audit event stream', 'audit'],
  ['support-ticket-history', 'threaded support ticket history', 'support'],
  ['board-packet-archive', 'board packet archive', 'board'],
  ['security-control-catalog', 'control catalog and evidence matrix', 'security'],
  ['financial-close-workpapers', 'synthetic close workpapers', 'close'],
  ['engineering-design-records', 'architecture decision record collection', 'design'],
  ['procurement-bid-library', 'procurement response library', 'procurement'],
  ['regulatory-comment-docket', 'regulatory comment docket', 'docket'],
  ['research-literature-export', 'research abstract and note export', 'research'],
  ['meeting-transcript-archive', 'meeting transcript archive', 'meeting'],
  ['observability-log-bundle', 'compact observability log bundle', 'telemetry'],
  ['data-governance-register', 'data governance register', 'governance'],
  ['customer-success-notes', 'synthetic account note archive', 'success'],
  ['insurance-case-file', 'synthetic insurance case file', 'insurance'],
  ['mixed-enterprise-rag', 'mixed-format enterprise RAG export', 'enterprise'],
] as const

function filler(topic: string, sequence: number, structure: string): string {
  // Compact, realistic machine-export rows let the 100K-token boundary remain
  // under the interceptor's 512KB decoded-body limit. Fields are synthetic.
  const state = sequence % 7 === 0 ? 'review' : 'ok'
  return `${topic.slice(0, 3)}-${sequence},${state},q${sequence % 19},s${sequence % 5},${structure.split(' ')[0]}\n`
}

function difficulty(index: number): Wso2EvaluationDifficulty {
  return index < 6 ? 'easy' : index < 13 ? 'medium' : 'hard'
}

const workloads = scenarios.map(([id, structure, topic], index) => {
  const facts = [
    `${topic.toUpperCase()}-${index + 1}-ALPHA requires owner approval before the controlled action proceeds.`,
    `${topic.toUpperCase()}-${index + 1}-BRAVO sets the rollback threshold at ${index + 2} consecutive failures.`,
    `${topic.toUpperCase()}-${index + 1}-CHARLIE requires evidence retention for ${30 + index} days.`,
  ]
  const documents = facts.map((fact, sourceIndex) => ({
    id: `${topic}-source-${sourceIndex + 1}`,
    title: `${structure} source ${sourceIndex + 1}`,
    text: `Authoritative ${topic} record. ${fact}\n`,
  }))
  let sequence = 0
  let estimated = estimateTokens(documents.map((document) => document.text).join('\n\n'))
  while (estimated < targets[index]) {
    const document = documents[sequence % documents.length]
    const row = filler(topic, sequence, structure)
    document.text += row
    estimated += estimateTokens(row)
    sequence += 1
  }
  for (const document of documents) document.text = document.text.trim()
  return {
    id,
    name: `${structure}: ${targets[index].toLocaleString('en-US')} token class`,
    difficulty: difficulty(index),
    documentStructure: structure,
    challengeTags: ['large-context', topic, index % 2 === 0 ? 'rag' : 'long-document'],
    request: {
      clientRequestId: `wso2_large_${String(index + 1).padStart(2, '0')}`,
      task: `Report the ${topic.toUpperCase()} ALPHA condition, BRAVO threshold, and CHARLIE retention period. Cite every source.`,
      tokenBudget: 1_024,
      budgetMode: 'guaranteed' as const,
      provenance: 'full' as const,
      scoring: 'bm25' as const,
      documents,
    },
    labels: {
      requiredFacts: facts.map((fact, factIndex) => ({
        id: `${topic}-${['alpha', 'bravo', 'charlie'][factIndex]}`,
        statement: fact,
        sourceIds: [documents[factIndex].id],
        evidence: [fact],
      })),
      mustNotAssert: [`${topic.toUpperCase()}-${index + 1}-DELTA authorizes unrestricted execution.`],
    },
  }
})

const corpus: Wso2EvaluationCorpus = {
  schemaVersion: '2026-08-16.large-context.v1',
  name: 'WSO2 Large-Context Cost and Retention Corpus',
  description: 'Twenty deterministic, sanitized 20K-100K model-neutral-token RAG and long-document workloads for comparing provider token cost, required-fact retention, source citations, and latency.',
  sanitization: {
    synthetic: true,
    containsCustomerData: false,
    containsPersonalData: false,
    containsSecrets: false,
    note: 'All entities, events, identifiers and records are synthetic. Compact export rows model realistic high-volume machine and RAG payloads without copying external text.',
  },
  evaluationProtocol: {
    paths: ['wso2-baseline', 'wso2-native-prompt-compressor', 'wso2-maha-context-compiler'],
    primaryMeasures: ['provider input-token cost', 'required-fact retention', 'resolvable source citations', 'end-to-end latency'],
    secondaryMeasures: ['hard token-budget compliance', 'Maha bypass status', 'provider output tokens', 'failures'],
    labelPolicy: 'Requests, sources, required facts, expected source links and prohibited assertions are frozen before any provider call. Human adjudication uses path-blinded sanitized answers.',
  },
  labelFreeze: {
    status: 'frozen',
    frozenAt: '2026-08-16',
    digestAlgorithm: 'sha256',
    digest: '0'.repeat(64),
    scope: ['requests and fully expanded synthetic source documents', 'required fact statements and exact evidence spans', 'expected source links and prohibited assertions'],
  },
  workloads,
}

// Freeze the parser-normalized request shape. Optional defaults are material
// to reproducibility and the evaluator always works from this normalized form.
corpus.workloads = corpus.workloads.map((workload) => ({ ...workload, request: parseContextPackRequest(workload.request) }))
corpus.labelFreeze.digest = calculateWso2LabelFreezeDigest(corpus)
writeFileSync('content/integrations/wso2-large-context-cost-corpus.json', `${JSON.stringify(corpus, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({
  output: 'content/integrations/wso2-large-context-cost-corpus.json',
  digest: corpus.labelFreeze.digest,
  workloads: workloads.length,
  estimatedTokens: workloads.map((workload) => estimateTokens(workload.request.documents.map((document) => document.text).join('\n\n'))),
}, null, 2))
