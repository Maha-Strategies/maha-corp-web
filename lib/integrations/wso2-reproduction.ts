import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  WSO2_EVALUATION_MAX_OUTPUT_TOKENS,
  WSO2_EVALUATION_MODEL,
  WSO2_EVALUATION_PATHS,
  WSO2_EVALUATION_PRICING,
  WSO2_EVALUATION_TEMPERATURE,
  formatMicrodollars,
} from './wso2-evaluation-harness.ts'
import { parseWso2EvaluationCorpus } from './wso2-evaluation-corpus.ts'

export const WSO2_REPRODUCTION_CONTRACT_PATH = 'content/integrations/wso2-reproduction.json'

export type Wso2ReproductionContract = {
  schemaVersion: '1.0.0'
  suiteId: string
  description: string
  corpus: {
    path: string
    labelFreezeDigest: string
    fileSha256: string
    workloadCount: number
    requiredFactCount: number
    expectedCitationCount: number
    synthetic: true
    containsCustomerData: false
    containsPersonalData: false
    containsSecrets: false
  }
  gateway: {
    configurationPath: string
    configurationSha256: string
    product: string
    version: string
    paths: string[]
    promptCompressor: { installedVersion: string; attachmentVersion: string; retainedRatio: number }
    mahaInterceptor: { installedVersion: string; attachmentVersion: string; failClosed: true }
    apiArtifacts: { path: string; sha256: string }[]
  }
  provider: {
    model: string
    temperature: number
    maxOutputTokens: number
    pricingAssumptionUsdPerMillionTokens: { input: string; output: string }
  }
  execution: {
    runner: string
    gatewayImporter: string
    automaticRetries: number
    checkpointAfterEveryCall: boolean
    defaultMode: 'dry-run'
    liveExecutionRequiresExplicitCeiling: true
  }
  outputs: {
    directory: string
    comparison: string
    checkpoint: string
    blindedAnswers: string
    blindingKey: string
    runManifest: string
    representativeTrace: string
    representativeTraceSha256: string
    failurePathEvidence: string
    failurePathEvidenceSha256: string
  }
  limitations: string[]
}

export type Wso2ReproductionOptions = {
  execute: boolean
  skipGatewayImport: boolean
  maxProviderCostUsd?: string
  outputDirectory: string
}

export type Wso2ReproductionStage = {
  id: 'gateway-import' | 'gateway-preflight' | 'evaluation'
  command: string
  args: string[]
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
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
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`${path} must be a non-negative integer.`)
  return Number(value)
}

function asNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${path} must be a finite number from ${minimum} through ${maximum}.`)
  }
  return value
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`${path} must be a non-empty string array.`)
  }
  return value as string[]
}

export function parseWso2ReproductionContract(value: unknown): Wso2ReproductionContract {
  const body = asRecord(value, 'contract')
  if (body.schemaVersion !== '1.0.0') throw new Error('contract.schemaVersion must be 1.0.0.')
  const corpus = asRecord(body.corpus, 'contract.corpus')
  const gateway = asRecord(body.gateway, 'contract.gateway')
  const promptCompressor = asRecord(gateway.promptCompressor, 'contract.gateway.promptCompressor')
  const mahaInterceptor = asRecord(gateway.mahaInterceptor, 'contract.gateway.mahaInterceptor')
  const provider = asRecord(body.provider, 'contract.provider')
  const pricing = asRecord(provider.pricingAssumptionUsdPerMillionTokens, 'contract.provider.pricingAssumptionUsdPerMillionTokens')
  const execution = asRecord(body.execution, 'contract.execution')
  const outputs = asRecord(body.outputs, 'contract.outputs')
  const paths = stringArray(gateway.paths, 'contract.gateway.paths')
  const apiArtifacts = Array.isArray(gateway.apiArtifacts)
    ? gateway.apiArtifacts.map((value, index) => {
        const artifact = asRecord(value, `contract.gateway.apiArtifacts[${index}]`)
        const sha256 = asString(artifact.sha256, `contract.gateway.apiArtifacts[${index}].sha256`)
        if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`contract.gateway.apiArtifacts[${index}].sha256 must be lowercase SHA-256 hex.`)
        return { path: asString(artifact.path, `contract.gateway.apiArtifacts[${index}].path`), sha256 }
      })
    : []
  if (apiArtifacts.length !== 3) throw new Error('contract.gateway.apiArtifacts must name exactly three files.')
  if (JSON.stringify(paths) !== JSON.stringify(WSO2_EVALUATION_PATHS)) {
    throw new Error('contract.gateway.paths must match the evaluator path order exactly.')
  }
  if (corpus.synthetic !== true || corpus.containsCustomerData !== false || corpus.containsPersonalData !== false || corpus.containsSecrets !== false) {
    throw new Error('contract.corpus must declare a synthetic corpus containing no customer data, personal data, or secrets.')
  }
  if (mahaInterceptor.failClosed !== true) throw new Error('contract.gateway.mahaInterceptor.failClosed must be true.')
  if (execution.automaticRetries !== 0) throw new Error('contract.execution.automaticRetries must be zero.')
  if (execution.checkpointAfterEveryCall !== true) throw new Error('contract.execution.checkpointAfterEveryCall must be true.')
  if (execution.defaultMode !== 'dry-run') throw new Error('contract.execution.defaultMode must be dry-run.')
  if (execution.liveExecutionRequiresExplicitCeiling !== true) {
    throw new Error('contract.execution.liveExecutionRequiresExplicitCeiling must be true.')
  }
  const digest = asString(corpus.labelFreezeDigest, 'contract.corpus.labelFreezeDigest')
  const fileDigest = asString(corpus.fileSha256, 'contract.corpus.fileSha256')
  const gatewayDigest = asString(gateway.configurationSha256, 'contract.gateway.configurationSha256')
  const representativeTraceSha256 = asString(outputs.representativeTraceSha256, 'contract.outputs.representativeTraceSha256')
  const failurePathEvidenceSha256 = asString(outputs.failurePathEvidenceSha256, 'contract.outputs.failurePathEvidenceSha256')
  if (![digest, fileDigest, gatewayDigest, representativeTraceSha256, failurePathEvidenceSha256].every((value) => /^[a-f0-9]{64}$/.test(value))) {
    throw new Error('Corpus and gateway digests must be lowercase SHA-256 hex.')
  }

  return {
    schemaVersion: '1.0.0',
    suiteId: asString(body.suiteId, 'contract.suiteId'),
    description: asString(body.description, 'contract.description'),
    corpus: {
      path: asString(corpus.path, 'contract.corpus.path'),
      labelFreezeDigest: digest,
      fileSha256: fileDigest,
      workloadCount: asInteger(corpus.workloadCount, 'contract.corpus.workloadCount'),
      requiredFactCount: asInteger(corpus.requiredFactCount, 'contract.corpus.requiredFactCount'),
      expectedCitationCount: asInteger(corpus.expectedCitationCount, 'contract.corpus.expectedCitationCount'),
      synthetic: true,
      containsCustomerData: false,
      containsPersonalData: false,
      containsSecrets: false,
    },
    gateway: {
      configurationPath: asString(gateway.configurationPath, 'contract.gateway.configurationPath'),
      configurationSha256: gatewayDigest,
      product: asString(gateway.product, 'contract.gateway.product'),
      version: asString(gateway.version, 'contract.gateway.version'),
      paths,
      promptCompressor: {
        installedVersion: asString(promptCompressor.installedVersion, 'contract.gateway.promptCompressor.installedVersion'),
        attachmentVersion: asString(promptCompressor.attachmentVersion, 'contract.gateway.promptCompressor.attachmentVersion'),
        retainedRatio: asNumber(promptCompressor.retainedRatio, 'contract.gateway.promptCompressor.retainedRatio', 0, 1),
      },
      mahaInterceptor: {
        installedVersion: asString(mahaInterceptor.installedVersion, 'contract.gateway.mahaInterceptor.installedVersion'),
        attachmentVersion: asString(mahaInterceptor.attachmentVersion, 'contract.gateway.mahaInterceptor.attachmentVersion'),
        failClosed: true,
      },
      apiArtifacts,
    },
    provider: {
      model: asString(provider.model, 'contract.provider.model'),
      temperature: asNumber(provider.temperature, 'contract.provider.temperature', 0, 2),
      maxOutputTokens: asInteger(provider.maxOutputTokens, 'contract.provider.maxOutputTokens'),
      pricingAssumptionUsdPerMillionTokens: {
        input: asString(pricing.input, 'contract.provider.pricingAssumptionUsdPerMillionTokens.input'),
        output: asString(pricing.output, 'contract.provider.pricingAssumptionUsdPerMillionTokens.output'),
      },
    },
    execution: {
      runner: asString(execution.runner, 'contract.execution.runner'),
      gatewayImporter: asString(execution.gatewayImporter, 'contract.execution.gatewayImporter'),
      automaticRetries: 0,
      checkpointAfterEveryCall: true,
      defaultMode: 'dry-run',
      liveExecutionRequiresExplicitCeiling: true,
    },
    outputs: {
      directory: asString(outputs.directory, 'contract.outputs.directory'),
      comparison: asString(outputs.comparison, 'contract.outputs.comparison'),
      checkpoint: asString(outputs.checkpoint, 'contract.outputs.checkpoint'),
      blindedAnswers: asString(outputs.blindedAnswers, 'contract.outputs.blindedAnswers'),
      blindingKey: asString(outputs.blindingKey, 'contract.outputs.blindingKey'),
      runManifest: asString(outputs.runManifest, 'contract.outputs.runManifest'),
      representativeTrace: asString(outputs.representativeTrace, 'contract.outputs.representativeTrace'),
      representativeTraceSha256,
      failurePathEvidence: asString(outputs.failurePathEvidence, 'contract.outputs.failurePathEvidence'),
      failurePathEvidenceSha256,
    },
    limitations: stringArray(body.limitations, 'contract.limitations'),
  }
}

export function loadAndValidateWso2Reproduction(root = process.cwd()) {
  const contractPath = join(root, WSO2_REPRODUCTION_CONTRACT_PATH)
  const contract = parseWso2ReproductionContract(JSON.parse(readFileSync(contractPath, 'utf8')))
  const corpusPath = join(root, contract.corpus.path)
  const corpus = parseWso2EvaluationCorpus(JSON.parse(readFileSync(corpusPath, 'utf8')))
  const gatewayPath = join(root, contract.gateway.configurationPath)
  const representativeTracePath = join(root, contract.outputs.representativeTrace)
  const failurePathEvidencePath = join(root, contract.outputs.failurePathEvidence)
  const gateway = asRecord(JSON.parse(readFileSync(gatewayPath, 'utf8')), 'gateway configuration')
  const gatewayBody = asRecord(gateway.gateway, 'gateway configuration.gateway')
  const gatewayInvariants = asRecord(gateway.invariants, 'gateway configuration.invariants')
  const gatewayApis = gateway.apis
  if (!Array.isArray(gatewayApis)) throw new Error('gateway configuration.apis must be an array.')

  const requiredFactCount = corpus.workloads.reduce((sum, workload) => sum + workload.labels.requiredFacts.length, 0)
  const expectedCitationCount = corpus.workloads.reduce(
    (sum, workload) => sum + workload.labels.requiredFacts.reduce((inner, fact) => inner + fact.sourceIds.length, 0),
    0,
  )
  const native = gatewayApis.map((value) => asRecord(value, 'gateway API')).find((api) => api.pathId === 'wso2-native-prompt-compressor')
  const nativePolicy = Array.isArray(native?.policies) ? asRecord(native.policies[0], 'native policy') : {}
  const nativeParameters = asRecord(nativePolicy.parameters, 'native policy.parameters')
  const maha = gatewayApis.map((value) => asRecord(value, 'gateway API')).find((api) => api.pathId === 'wso2-maha-context-compiler')
  const mahaPolicy = Array.isArray(maha?.policies) ? asRecord(maha.policies[0], 'Maha policy') : {}
  const apiArtifactDigests = Object.fromEntries(contract.gateway.apiArtifacts.map((artifact) => [
    artifact.path,
    sha256File(join(root, artifact.path)),
  ]))
  const assertions: [boolean, string][] = [
    [sha256File(corpusPath) === contract.corpus.fileSha256, 'corpus file SHA-256 does not match the reproduction contract'],
    [corpus.labelFreeze.digest === contract.corpus.labelFreezeDigest, 'corpus label-freeze digest does not match the reproduction contract'],
    [corpus.workloads.length === contract.corpus.workloadCount, 'corpus workload count does not match the reproduction contract'],
    [requiredFactCount === contract.corpus.requiredFactCount, 'required-fact count does not match the reproduction contract'],
    [expectedCitationCount === contract.corpus.expectedCitationCount, 'expected-citation count does not match the reproduction contract'],
    [sha256File(gatewayPath) === contract.gateway.configurationSha256, 'gateway configuration SHA-256 does not match the reproduction contract'],
    [gatewayBody.version === contract.gateway.version, 'gateway version does not match the reproduction contract'],
    [gatewayInvariants.model === contract.provider.model && contract.provider.model === WSO2_EVALUATION_MODEL, 'provider model does not match the runner and gateway invariant'],
    [gatewayInvariants.temperature === contract.provider.temperature && contract.provider.temperature === WSO2_EVALUATION_TEMPERATURE, 'temperature does not match the runner and gateway invariant'],
    [gatewayInvariants.maxOutputTokens === contract.provider.maxOutputTokens && contract.provider.maxOutputTokens === WSO2_EVALUATION_MAX_OUTPUT_TOKENS, 'output ceiling does not match the runner and gateway invariant'],
    [contract.provider.pricingAssumptionUsdPerMillionTokens.input === formatMicrodollars(WSO2_EVALUATION_PRICING.inputPerMillion), 'input-token price does not match the runner'],
    [contract.provider.pricingAssumptionUsdPerMillionTokens.output === formatMicrodollars(WSO2_EVALUATION_PRICING.outputPerMillion), 'output-token price does not match the runner'],
    [JSON.stringify(gatewayApis.map((api) => asRecord(api, 'gateway API').pathId)) === JSON.stringify(contract.gateway.paths), 'gateway path order does not match the reproduction contract'],
    [nativePolicy.installedVersion === contract.gateway.promptCompressor.installedVersion, 'Prompt Compressor installed version does not match the reproduction contract'],
    [nativePolicy.attachmentVersion === contract.gateway.promptCompressor.attachmentVersion, 'Prompt Compressor attachment version does not match the reproduction contract'],
    [nativeParameters.retainedRatio === contract.gateway.promptCompressor.retainedRatio, 'Prompt Compressor ratio does not match the reproduction contract'],
    [mahaPolicy.installedVersion === contract.gateway.mahaInterceptor.installedVersion, 'Maha interceptor installed version does not match the reproduction contract'],
    [mahaPolicy.attachmentVersion === contract.gateway.mahaInterceptor.attachmentVersion, 'Maha interceptor attachment version does not match the reproduction contract'],
    [mahaPolicy.failClosed === contract.gateway.mahaInterceptor.failClosed, 'Maha fail-closed setting does not match the reproduction contract'],
    [contract.gateway.apiArtifacts.every((artifact) => apiArtifactDigests[artifact.path] === artifact.sha256), 'one or more deployable API artifact digests do not match the reproduction contract'],
    [sha256File(representativeTracePath) === contract.outputs.representativeTraceSha256, 'representative trace SHA-256 does not match the reproduction contract'],
    [sha256File(failurePathEvidencePath) === contract.outputs.failurePathEvidenceSha256, 'failure-path evidence SHA-256 does not match the reproduction contract'],
  ]
  for (const [pass, message] of assertions) if (!pass) throw new Error(message)

  return {
    contract,
    corpus,
    corpusPath,
    gatewayPath,
    requiredFactCount,
    expectedCitationCount,
    fileDigests: {
      contract: sha256File(contractPath),
      corpus: sha256File(corpusPath),
      gatewayConfiguration: sha256File(gatewayPath),
      runner: sha256File(join(root, contract.execution.runner)),
      gatewayImporter: sha256File(join(root, contract.execution.gatewayImporter)),
      representativeTrace: sha256File(representativeTracePath),
      failurePathEvidence: sha256File(failurePathEvidencePath),
      ...Object.fromEntries(Object.entries(apiArtifactDigests).map(([path, digest]) => [`api:${path}`, digest])),
    },
  }
}

export function buildWso2ReproductionStages(
  contract: Wso2ReproductionContract,
  options: Wso2ReproductionOptions,
): Wso2ReproductionStage[] {
  const output = (name: string) => join(options.outputDirectory, name)
  const evaluationArgs = [
    '--experimental-strip-types',
    contract.execution.runner,
    options.execute ? '--execute' : '--dry-run',
    `--corpus=${contract.corpus.path}`,
    `--output=${output(contract.outputs.comparison)}`,
    `--checkpoint=${output(contract.outputs.checkpoint)}`,
    `--adjudication-output=${output(contract.outputs.blindedAnswers)}`,
    `--adjudication-key-output=${output(contract.outputs.blindingKey)}`,
  ]
  if (options.execute) evaluationArgs.push(`--max-provider-cost-usd=${options.maxProviderCostUsd}`)

  if (!options.execute) return [{ id: 'evaluation', command: process.execPath, args: evaluationArgs }]
  const stages: Wso2ReproductionStage[] = []
  if (!options.skipGatewayImport) {
    stages.push({ id: 'gateway-import', command: 'bash', args: [contract.execution.gatewayImporter] })
  }
  stages.push({
    id: 'gateway-preflight',
    command: process.execPath,
    args: ['--experimental-strip-types', contract.execution.runner, '--preflight', `--corpus=${contract.corpus.path}`],
  })
  stages.push({ id: 'evaluation', command: process.execPath, args: evaluationArgs })
  return stages
}

export function validateWso2LiveEnvironment<T extends Record<string, string | undefined>>(
  environment: T,
): T & { MAHA_INTERCEPTOR_BASE: string; MAHA_INTERCEPTOR_ENDPOINT: string } {
  for (const name of ['ANTHROPIC_API_KEY', 'WSO2_CONTEXT_INTERCEPTOR_SECRET']) {
    if (!environment[name]) throw new Error(`${name} is required for live execution.`)
  }
  if ((environment.WSO2_CONTEXT_INTERCEPTOR_SECRET ?? '').length < 32) {
    throw new Error('WSO2_CONTEXT_INTERCEPTOR_SECRET must contain at least 32 characters.')
  }
  let base = environment.MAHA_INTERCEPTOR_BASE?.replace(/\/$/, '')
  let endpoint = environment.MAHA_INTERCEPTOR_ENDPOINT?.replace(/\/$/, '')
  if (!base && endpoint?.endsWith('/handle-request')) base = endpoint.slice(0, -'/handle-request'.length)
  if (!endpoint && base) endpoint = `${base}/handle-request`
  if (!base || !endpoint) {
    throw new Error('Set MAHA_INTERCEPTOR_BASE or MAHA_INTERCEPTOR_ENDPOINT; the other value is derived safely.')
  }
  for (const [name, value] of [['MAHA_INTERCEPTOR_BASE', base], ['MAHA_INTERCEPTOR_ENDPOINT', endpoint]] as const) {
    try { new URL(value) } catch { throw new Error(`${name} must be an absolute URL.`) }
  }
  return { ...environment, MAHA_INTERCEPTOR_BASE: base, MAHA_INTERCEPTOR_ENDPOINT: endpoint }
}
