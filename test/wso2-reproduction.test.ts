import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import {
  WSO2_REPRODUCTION_CONTRACT_PATH,
  buildWso2ReproductionStages,
  loadAndValidateWso2Reproduction,
  parseWso2ReproductionContract,
  validateWso2LiveEnvironment,
} from '../lib/integrations/wso2-reproduction.ts'
import { parseWso2ReproductionArgs } from '../scripts/reproduce-wso2-evaluation.ts'
import { buildSanitizedWso2Trace } from '../scripts/generate-wso2-sanitized-trace.ts'

const ROOT = join(import.meta.dirname, '..')
const TEST_SECRET_MARKER = 'wso2-failure-path-test-secret-value'

test('the checked-in WSO2 reproduction contract matches every frozen input', () => {
  const loaded = loadAndValidateWso2Reproduction(ROOT)
  assert.equal(loaded.corpus.workloads.length, 20)
  assert.equal(loaded.requiredFactCount, 60)
  assert.equal(loaded.expectedCitationCount, 60)
  assert.equal(loaded.contract.corpus.labelFreezeDigest, loaded.corpus.labelFreeze.digest)
  assert.deepEqual(loaded.contract.gateway.paths, [
    'wso2-baseline',
    'wso2-native-prompt-compressor',
    'wso2-maha-context-compiler',
  ])
  assert.match(loaded.fileDigests.runner, /^[a-f0-9]{64}$/)
})

test('the reproduction contract rejects a path reorder and any automatic retry', () => {
  const source = JSON.parse(readFileSync(join(ROOT, WSO2_REPRODUCTION_CONTRACT_PATH), 'utf8'))
  const reordered = structuredClone(source)
  reordered.gateway.paths.reverse()
  assert.throws(() => parseWso2ReproductionContract(reordered), /path order exactly/)

  const retries = structuredClone(source)
  retries.execution.automaticRetries = 1
  assert.throws(() => parseWso2ReproductionContract(retries), /automaticRetries must be zero/)
})

test('the safe default is one dry-run evaluation stage with no gateway mutation', () => {
  const { contract } = loadAndValidateWso2Reproduction(ROOT)
  const options = parseWso2ReproductionArgs([], 'artifacts/wso2/reproduction')
  const stages = buildWso2ReproductionStages(contract, options)
  assert.equal(options.execute, false)
  assert.equal(options.outputDirectory, 'artifacts/wso2/reproduction/dry-run')
  assert.deepEqual(stages.map((stage) => stage.id), ['evaluation'])
  assert.ok(stages[0].args.includes('--dry-run'))
  assert.ok(!stages[0].args.includes('--execute'))
  assert.ok(stages[0].args.some((argument) => argument.includes('wso2-large-context-cost-corpus.json')))
})

test('live reproduction imports, preflights, then evaluates under an explicit ceiling', () => {
  const { contract } = loadAndValidateWso2Reproduction(ROOT)
  const options = parseWso2ReproductionArgs(['--execute', '--max-provider-cost-usd=4.000000'], contract.outputs.directory)
  const stages = buildWso2ReproductionStages(contract, options)
  assert.deepEqual(stages.map((stage) => stage.id), ['gateway-import', 'gateway-preflight', 'evaluation'])
  assert.equal(options.outputDirectory, 'artifacts/wso2/reproduction/live')
  assert.ok(stages[2].args.includes('--execute'))
  assert.ok(stages[2].args.includes('--max-provider-cost-usd=4.000000'))
})

test('live mode cannot be entered without a cost ceiling', () => {
  assert.throws(
    () => parseWso2ReproductionArgs(['--execute'], 'artifacts/wso2/reproduction'),
    /requires --max-provider-cost-usd/,
  )
  assert.throws(
    () => parseWso2ReproductionArgs(['--max-provider-cost-usd=4.000000'], 'artifacts/wso2/reproduction'),
    /only valid with --execute/,
  )
  assert.throws(
    () => parseWso2ReproductionArgs(['--execute', '--max-provider-cost-usd=not-money'], 'artifacts/wso2/reproduction'),
    /exact dollar amount/,
  )
  assert.throws(
    () => parseWso2ReproductionArgs(['--output-directory=content/integrations'], 'artifacts/wso2/reproduction'),
    /beneath artifacts\/wso2/,
  )
})

test('live environment normalization derives the interceptor endpoint without exposing a secret', () => {
  const normalized = validateWso2LiveEnvironment({
    ANTHROPIC_API_KEY: 'test-provider-credential',
    WSO2_CONTEXT_INTERCEPTOR_SECRET: 'a-dedicated-secret-that-is-long-enough',
    MAHA_INTERCEPTOR_BASE: 'http://localhost:3000/api/integrations/wso2/context-compiler/',
  })
  assert.equal(normalized.MAHA_INTERCEPTOR_BASE, 'http://localhost:3000/api/integrations/wso2/context-compiler')
  assert.equal(normalized.MAHA_INTERCEPTOR_ENDPOINT, 'http://localhost:3000/api/integrations/wso2/context-compiler/handle-request')
})

test('live environment validation refuses missing or weak credentials before gateway import', () => {
  assert.throws(() => validateWso2LiveEnvironment({}), /ANTHROPIC_API_KEY is required/)
  assert.throws(() => validateWso2LiveEnvironment({
    ANTHROPIC_API_KEY: 'provider',
    WSO2_CONTEXT_INTERCEPTOR_SECRET: 'short',
    MAHA_INTERCEPTOR_BASE: 'http://localhost:3000/interceptor',
  }), /at least 32 characters/)
})

test('the representative three-path trace contains no source text or credentials', () => {
  const corpusValue = JSON.parse(readFileSync(join(ROOT, 'content/integrations/wso2-large-context-cost-corpus.json'), 'utf8'))
  const gatewayConfiguration = JSON.parse(readFileSync(join(ROOT, 'content/integrations/wso2-gateway-apis.json'), 'utf8'))
  const checkedIn = JSON.parse(readFileSync(join(ROOT, 'content/integrations/wso2-sanitized-three-path-trace.json'), 'utf8'))
  const sourceWorkload = corpusValue.workloads.find((workload: { id: string }) => workload.id === checkedIn.workload.id)
  const serialized = JSON.stringify(checkedIn)

  assert.equal(checkedIn.traceKind, 'sanitized-reconstruction-from-frozen-corpus-and-durable-checkpoint')
  assert.equal(checkedIn.traces.length, 3)
  assert.deepEqual(checkedIn.traces.map((trace: { path: string }) => trace.path), [
    'wso2-baseline',
    'wso2-native-prompt-compressor',
    'wso2-maha-context-compiler',
  ])
  assert.equal(checkedIn.sanitization.credentialsRetained, false)
  assert.equal(checkedIn.sanitization.sourceDocumentTextRetained, false)
  assert.ok(checkedIn.traces.every((trace: { response: { body: { answer: string } } }) => trace.response.body.answer.length > 0))
  assert.deepEqual(checkedIn.traces.map((trace: { evaluation: { humanAdjudication: { requiredFactsAnswered: number } } }) => (
    trace.evaluation.humanAdjudication.requiredFactsAnswered
  )), [3, 0, 3])
  assert.ok(!serialized.includes('ANTHROPIC_API_KEY'))
  assert.ok(!serialized.includes('WSO2_CONTEXT_INTERCEPTOR_SECRET'))
  assert.ok(sourceWorkload.request.documents.every((document: { text: string }) => !serialized.includes(document.text)))
  assert.equal(gatewayConfiguration.gateway.version, checkedIn.provenance.gatewayVersion)
})

test('the trace builder rejects a checkpoint from another frozen corpus', () => {
  const corpusValue = JSON.parse(readFileSync(join(ROOT, 'content/integrations/wso2-large-context-cost-corpus.json'), 'utf8'))
  const gatewayConfiguration = JSON.parse(readFileSync(join(ROOT, 'content/integrations/wso2-gateway-apis.json'), 'utf8'))
  assert.throws(() => buildSanitizedWso2Trace({
    corpusValue,
    gatewayConfiguration,
    checkpoint: { schemaVersion: '1', corpusDigest: 'wrong', model: 'claude-haiku-4-5-20251001', records: [] },
    checkpointFilename: 'checkpoint.json',
    checkpointSha256: '0'.repeat(64),
    workloadId: 'release-evidence-rag',
  }), /corpus digest/)
})

test('the checked-in WSO2 failure paths all fail closed without provider calls', () => {
  const evidence = JSON.parse(readFileSync(join(ROOT, 'content/integrations/wso2-failure-path-result.json'), 'utf8'))
  const serialized = JSON.stringify(evidence)
  assert.equal(evidence.liveProviderCalls, 0)
  assert.equal(evidence.providerCredentialsUsed, false)
  assert.equal(evidence.sourcePayloadsRetained, false)
  assert.equal(evidence.configuration.requestPassthroughOnError, false)
  assert.equal(evidence.configuration.responsePassthroughOnError, false)
  assert.deepEqual(evidence.cases.map((entry: { id: string }) => entry.id), [
    'missing-interceptor-configuration',
    'invalid-interceptor-credential',
    'oversized-decoded-input',
    'interceptor-timeout',
    'interceptor-unavailable',
  ])
  assert.ok(evidence.cases.every((entry: { observed: { upstreamForwarded: boolean } }) => entry.observed.upstreamForwarded === false))
  assert.ok(!serialized.includes(TEST_SECRET_MARKER))
  assert.ok(!serialized.includes('ANTHROPIC_API_KEY'))
  assert.ok(!serialized.includes('WSO2_CONTEXT_INTERCEPTOR_SECRET'))
})

test('WSO2 policy latency retains repeated observations rather than one sample', () => {
  const evidence = JSON.parse(readFileSync(join(ROOT, 'content/integrations/wso2-failure-path-result.json'), 'utf8'))
  const repeated = evidence.upstreamPolicyVerification.repeatedLatency
  assert.equal(repeated.repetitionsPerScenario, 9)
  assert.deepEqual(Object.keys(repeated.scenarios).sort(), [
    'healthyInterceptor',
    'interceptorTimeout',
    'interceptorUnavailable',
  ])
  for (const summary of Object.values(repeated.scenarios) as Array<{
    samples: number
    samplesMillis: number[]
    minMillis: number
    medianMillis: number
    p95Millis: number
    maxMillis: number
  }>) {
    assert.equal(summary.samples, 9)
    assert.equal(summary.samplesMillis.length, 9)
    assert.equal(summary.minMillis, Math.min(...summary.samplesMillis))
    assert.equal(summary.maxMillis, Math.max(...summary.samplesMillis))
    assert.ok(summary.minMillis <= summary.medianMillis)
    assert.ok(summary.medianMillis <= summary.p95Millis)
    assert.ok(summary.p95Millis <= summary.maxMillis)
  }
  assert.equal(evidence.liveProviderCalls, 0)
})

test('the WSO2 policy bundle is deployable, pinned, fail closed and secret free', () => {
  const directory = join(ROOT, 'content/integrations/wso2-policy-bundle')
  const bundle = JSON.parse(readFileSync(join(directory, 'bundle.json'), 'utf8'))
  const template = JSON.parse(readFileSync(join(directory, 'llm-proxy.template.json'), 'utf8'))
  const serializedTemplate = JSON.stringify(template)
  const policy = template.spec.policies[0]
  const route = policy.paths[0]
  const params = route.params

  assert.equal(bundle.status, 'evaluation-only')
  assert.equal(bundle.compatibility.wso2AiGateway, '1.1.0')
  assert.equal(bundle.compatibility.interceptorServiceInstalledVersion, '1.0.0')
  assert.equal(policy.name, 'interceptor-service')
  assert.equal(policy.version, 'v1')
  assert.equal(route.path, '/v1/chat/completions')
  assert.deepEqual(route.methods, ['POST'])
  assert.equal(params.request.passthroughOnError, false)
  assert.equal(params.response.passthroughOnError, false)
  assert.equal(params.request.includeRequestHeaders, true)
  assert.equal(params.request.includeRequestBody, true)
  assert.equal(params.timeoutMillis, 20_000)
  assert.equal(params.tlsSkipVerify, false)
  assert.equal(params.endpointFromEnv, 'MAHA_INTERCEPTOR_BASE')
  assert.ok(!serializedTemplate.includes('x-maha-wso2-interceptor-token'))
  assert.ok(!serializedTemplate.includes('WSO2_CONTEXT_INTERCEPTOR_SECRET'))
  assert.ok(!serializedTemplate.includes('www.mahastrategies.com'))

  for (const artifact of bundle.artifacts as Array<{ path: string; sha256: string }>) {
    const bytes = readFileSync(join(directory, artifact.path))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256)
  }
  for (const script of ['install.sh', 'uninstall.sh']) {
    assert.notEqual(statSync(join(directory, script)).mode & 0o111, 0)
    const checked = spawnSync('bash', ['-n', join(directory, script)], { encoding: 'utf8' })
    assert.equal(checked.status, 0, checked.stderr)
  }

  const guide = readFileSync(join(directory, 'README.md'), 'utf8')
  assert.match(guide, /evaluation bundle, not\s+a production-security claim/)
  assert.match(guide, /Policy chain not found for route/)
  assert.match(guide, /authenticated service identity, or mTLS/)
})
