import { createHash } from 'node:crypto'

import { compileContextPack, parseContextPackRequest, type ContextPackRequest } from '../context-compiler.ts'

export type Wso2EvaluationDifficulty = 'easy' | 'medium' | 'hard'

export type Wso2RequiredFact = {
  id: string
  statement: string
  sourceIds: string[]
  evidence: string[]
}

export type Wso2EvaluationWorkload = {
  id: string
  name: string
  difficulty: Wso2EvaluationDifficulty
  documentStructure: string
  challengeTags: string[]
  request: ContextPackRequest
  labels: { requiredFacts: Wso2RequiredFact[]; mustNotAssert: string[] }
}

export type Wso2EvaluationCorpus = {
  schemaVersion: string
  name: string
  description: string
  sanitization: {
    synthetic: boolean
    containsCustomerData: boolean
    containsPersonalData: boolean
    containsSecrets: boolean
    note: string
  }
  evaluationProtocol: {
    paths: string[]
    primaryMeasures: string[]
    secondaryMeasures: string[]
    labelPolicy: string
  }
  labelFreeze: {
    status: 'frozen'
    frozenAt: string
    digestAlgorithm: 'sha256'
    digest: string
    scope: string[]
  }
  workloads: Wso2EvaluationWorkload[]
}

export type Wso2CompilerRetentionResult = {
  workloadId: string
  difficulty: Wso2EvaluationDifficulty
  documentStructure: string
  requiredFactsRetained: number
  requiredFactsTotal: number
  requiredSourcesRetained: number
  requiredSourcesTotal: number
  sourceCoveragePercent: number
  originalEstimatedTokens: number
  compiledEstimatedTokens: number
  estimatedReductionPercent: number
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object.`)
  return value as Record<string, unknown>
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${path} must be a non-empty string.`)
  return value
}

function stringArray(value: unknown, path: string, minimum = 1): string[] {
  if (!Array.isArray(value) || value.length < minimum) throw new Error(`${path} must contain at least ${minimum} string(s).`)
  return value.map((item, index) => nonEmptyString(item, `${path}[${index}]`))
}

function unique(values: string[], path: string) {
  if (new Set(values).size !== values.length) throw new Error(`${path} must not contain duplicate values.`)
}

function labelFreezeProjection(corpus: Pick<Wso2EvaluationCorpus, 'schemaVersion' | 'workloads'>) {
  return {
    schemaVersion: corpus.schemaVersion,
    workloads: corpus.workloads.map((workload) => ({
      id: workload.id,
      request: workload.request,
      requiredFacts: workload.labels.requiredFacts,
      mustNotAssert: workload.labels.mustNotAssert,
    })),
  }
}

export function calculateWso2LabelFreezeDigest(corpus: Pick<Wso2EvaluationCorpus, 'schemaVersion' | 'workloads'>) {
  return createHash('sha256').update(JSON.stringify(labelFreezeProjection(corpus)), 'utf8').digest('hex')
}

function parseWorkload(value: unknown, index: number): Wso2EvaluationWorkload {
  const path = `workloads[${index}]`
  const body = record(value, path)
  const id = nonEmptyString(body.id, `${path}.id`)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`${path}.id must be a lowercase kebab-case identifier.`)
  const difficulty = body.difficulty
  if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') throw new Error(`${path}.difficulty must be easy, medium, or hard.`)
  const request = parseContextPackRequest(body.request)
  const labels = record(body.labels, `${path}.labels`)
  if (!Array.isArray(labels.requiredFacts) || labels.requiredFacts.length < 2) throw new Error(`${path}.labels.requiredFacts must contain at least two facts.`)
  const requiredFacts = labels.requiredFacts.map((item, factIndex) => {
    const factPath = `${path}.labels.requiredFacts[${factIndex}]`
    const fact = record(item, factPath)
    return {
      id: nonEmptyString(fact.id, `${factPath}.id`),
      statement: nonEmptyString(fact.statement, `${factPath}.statement`),
      sourceIds: stringArray(fact.sourceIds, `${factPath}.sourceIds`),
      evidence: stringArray(fact.evidence, `${factPath}.evidence`),
    }
  })
  unique(requiredFacts.map((fact) => fact.id), `${path}.labels.requiredFacts[].id`)
  return {
    id,
    name: nonEmptyString(body.name, `${path}.name`),
    difficulty,
    documentStructure: nonEmptyString(body.documentStructure, `${path}.documentStructure`),
    challengeTags: stringArray(body.challengeTags, `${path}.challengeTags`, 2),
    request,
    labels: {
      requiredFacts,
      mustNotAssert: stringArray(labels.mustNotAssert, `${path}.labels.mustNotAssert`),
    },
  }
}

export function parseWso2EvaluationCorpus(value: unknown): Wso2EvaluationCorpus {
  const body = record(value, 'corpus')
  const sanitization = record(body.sanitization, 'corpus.sanitization')
  if (sanitization.synthetic !== true) throw new Error('corpus.sanitization.synthetic must be true.')
  for (const field of ['containsCustomerData', 'containsPersonalData', 'containsSecrets'] as const) {
    if (sanitization[field] !== false) throw new Error(`corpus.sanitization.${field} must be false.`)
  }
  const protocol = record(body.evaluationProtocol, 'corpus.evaluationProtocol')
  const labelFreeze = record(body.labelFreeze, 'corpus.labelFreeze')
  if (!Array.isArray(body.workloads) || body.workloads.length !== 20) throw new Error('corpus.workloads must contain exactly 20 workloads.')
  const workloads = body.workloads.map(parseWorkload)
  unique(workloads.map((workload) => workload.id), 'corpus.workloads[].id')
  unique(workloads.map((workload) => workload.request.clientRequestId), 'corpus.workloads[].request.clientRequestId')

  const difficultyCounts = new Map<Wso2EvaluationDifficulty, number>([['easy', 0], ['medium', 0], ['hard', 0]])
  for (const workload of workloads) difficultyCounts.set(workload.difficulty, (difficultyCounts.get(workload.difficulty) ?? 0) + 1)
  for (const [difficulty, count] of difficultyCounts) {
    if (count < 5) throw new Error(`corpus must contain at least five ${difficulty} workloads; found ${count}.`)
  }
  if (new Set(workloads.map((workload) => workload.documentStructure)).size < 8) throw new Error('corpus must exercise at least eight document structures.')

  for (const workload of workloads) {
    const documentById = new Map(workload.request.documents.map((document) => [document.id, document]))
    for (const fact of workload.labels.requiredFacts) {
      unique(fact.sourceIds, `${workload.id}/${fact.id}.sourceIds`)
      for (const sourceId of fact.sourceIds) {
        const document = documentById.get(sourceId)
        if (!document) throw new Error(`${workload.id}/${fact.id} names missing source ${sourceId}.`)
        if (!fact.evidence.some((span) => document.text.includes(span))) throw new Error(`${workload.id}/${fact.id} has no exact evidence span in source ${sourceId}.`)
      }
      for (const span of fact.evidence) {
        if (!fact.sourceIds.some((sourceId) => documentById.get(sourceId)?.text.includes(span))) throw new Error(`${workload.id}/${fact.id} evidence is absent from its labelled sources: ${span}`)
      }
    }
  }

  if (labelFreeze.status !== 'frozen') throw new Error('corpus.labelFreeze.status must be frozen.')
  if (labelFreeze.digestAlgorithm !== 'sha256') throw new Error('corpus.labelFreeze.digestAlgorithm must be sha256.')
  const corpus: Wso2EvaluationCorpus = {
    schemaVersion: nonEmptyString(body.schemaVersion, 'corpus.schemaVersion'),
    name: nonEmptyString(body.name, 'corpus.name'),
    description: nonEmptyString(body.description, 'corpus.description'),
    sanitization: {
      synthetic: true,
      containsCustomerData: false,
      containsPersonalData: false,
      containsSecrets: false,
      note: nonEmptyString(sanitization.note, 'corpus.sanitization.note'),
    },
    evaluationProtocol: {
      paths: stringArray(protocol.paths, 'corpus.evaluationProtocol.paths', 3),
      primaryMeasures: stringArray(protocol.primaryMeasures, 'corpus.evaluationProtocol.primaryMeasures'),
      secondaryMeasures: stringArray(protocol.secondaryMeasures, 'corpus.evaluationProtocol.secondaryMeasures'),
      labelPolicy: nonEmptyString(protocol.labelPolicy, 'corpus.evaluationProtocol.labelPolicy'),
    },
    labelFreeze: {
      status: 'frozen',
      frozenAt: nonEmptyString(labelFreeze.frozenAt, 'corpus.labelFreeze.frozenAt'),
      digestAlgorithm: 'sha256',
      digest: nonEmptyString(labelFreeze.digest, 'corpus.labelFreeze.digest'),
      scope: stringArray(labelFreeze.scope, 'corpus.labelFreeze.scope', 3),
    },
    workloads,
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corpus.labelFreeze.frozenAt)) throw new Error('corpus.labelFreeze.frozenAt must be YYYY-MM-DD.')
  if (!/^[a-f0-9]{64}$/.test(corpus.labelFreeze.digest)) throw new Error('corpus.labelFreeze.digest must be a lowercase SHA-256 hex digest.')
  const calculatedDigest = calculateWso2LabelFreezeDigest(corpus)
  if (corpus.labelFreeze.digest !== calculatedDigest) {
    throw new Error(`corpus.labelFreeze.digest does not match the frozen requests, required facts, and expected citations; expected ${calculatedDigest}.`)
  }
  return corpus
}

export function validateWso2EvaluationLabels(value: unknown) {
  const corpus = parseWso2EvaluationCorpus(value)
  return {
    corpus,
    digest: calculateWso2LabelFreezeDigest(corpus),
    workloadCount: corpus.workloads.length,
    requiredFactCount: corpus.workloads.reduce((count, workload) => count + workload.labels.requiredFacts.length, 0),
    expectedCitationCount: corpus.workloads.reduce(
      (count, workload) => count + workload.labels.requiredFacts.reduce((factCount, fact) => factCount + fact.sourceIds.length, 0),
      0,
    ),
  }
}

function evidenceForSource(workload: Wso2EvaluationWorkload, fact: Wso2RequiredFact, sourceId: string) {
  const source = workload.request.documents.find((document) => document.id === sourceId)
  return source ? fact.evidence.filter((span) => source.text.includes(span)) : []
}

export function evaluateWso2CompilerRetention(workload: Wso2EvaluationWorkload): Wso2CompilerRetentionResult {
  const pack = compileContextPack(workload.request)
  let requiredFactsRetained = 0
  let requiredSourcesRetained = 0
  let requiredSourcesTotal = 0
  for (const fact of workload.labels.requiredFacts) {
    let factRetained = true
    for (const sourceId of fact.sourceIds) {
      requiredSourcesTotal += 1
      const retained = evidenceForSource(workload, fact, sourceId).some((span) => pack.context.includes(span))
      if (retained) requiredSourcesRetained += 1
      else factRetained = false
    }
    if (factRetained) requiredFactsRetained += 1
  }
  return {
    workloadId: workload.id,
    difficulty: workload.difficulty,
    documentStructure: workload.documentStructure,
    requiredFactsRetained,
    requiredFactsTotal: workload.labels.requiredFacts.length,
    requiredSourcesRetained,
    requiredSourcesTotal,
    sourceCoveragePercent: pack.metrics.sourceCoveragePercent,
    originalEstimatedTokens: pack.metrics.originalEstimatedTokens,
    compiledEstimatedTokens: pack.metrics.compiledEstimatedTokens,
    estimatedReductionPercent: pack.metrics.estimatedReductionPercent,
  }
}

export function validateWso2CompilerCorpus(value: unknown) {
  const corpus = parseWso2EvaluationCorpus(value)
  const results = corpus.workloads.map(evaluateWso2CompilerRetention)
  const failures = results.filter((result) => result.requiredFactsRetained !== result.requiredFactsTotal)
  return { corpus, results, failures }
}
