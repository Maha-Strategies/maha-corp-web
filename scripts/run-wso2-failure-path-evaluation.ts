import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import {
  MAX_WSO2_OPENAI_BODY_BYTES,
  WSO2_CONTEXT_EXTENSION,
  WSO2_CONTEXT_PLACEHOLDER,
  WSO2_INTERCEPTOR_TOKEN_HEADER,
  handleWso2ContextRequest,
} from '../lib/integrations/wso2-context-interceptor.ts'

const TEST_SECRET = 'wso2-failure-path-test-secret-value'

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function errorBody(result: ReturnType<typeof handleWso2ContextRequest>) {
  if (!result.body) throw new Error('Expected a direct-response body.')
  return JSON.parse(Buffer.from(result.body, 'base64').toString('utf8')) as { error: { code: string } }
}

function invocation(body: Record<string, unknown>, token = TEST_SECRET) {
  return {
    requestHeaders: { 'content-type': 'application/json', [WSO2_INTERCEPTOR_TOKEN_HEADER]: token },
    requestBody: Buffer.from(JSON.stringify(body), 'utf8').toString('base64'),
    invocationContext: { requestId: 'failure-path-test', method: 'POST', path: '/v1/chat/completions' },
  }
}

function applicationCases() {
  const optedInBody = {
    messages: [{ role: 'system', content: WSO2_CONTEXT_PLACEHOLDER }],
    [WSO2_CONTEXT_EXTENSION]: {
      clientRequestId: 'failure-path-test',
      task: 'Return the bounded test fact.',
      tokenBudget: 256,
      documents: [{ id: 'source-1', text: 'The bounded test fact is ALPHA.' }],
    },
  }
  const missingConfiguration = handleWso2ContextRequest(invocation(optedInBody), undefined)
  const invalidCredential = handleWso2ContextRequest(invocation(optedInBody, 'wrong-secret'), TEST_SECRET)
  const oversized = handleWso2ContextRequest({
    requestHeaders: { 'content-type': 'application/json', [WSO2_INTERCEPTOR_TOKEN_HEADER]: TEST_SECRET },
    requestBody: Buffer.alloc(MAX_WSO2_OPENAI_BODY_BYTES + 1, 97).toString('base64'),
  }, TEST_SECRET)

  return [
    {
      id: 'missing-interceptor-configuration',
      layer: 'maha-interceptor',
      expected: { httpStatus: 503, code: 'interceptor_not_configured', upstreamForwarded: false },
      observed: {
        directRespond: missingConfiguration.directRespond === true,
        httpStatus: missingConfiguration.responseCode,
        code: errorBody(missingConfiguration).error.code,
        credentialHeaderRemoved: missingConfiguration.headersToRemove?.includes(WSO2_INTERCEPTOR_TOKEN_HEADER) === true,
        upstreamForwarded: false,
      },
    },
    {
      id: 'invalid-interceptor-credential',
      layer: 'maha-interceptor',
      expected: { httpStatus: 401, code: 'invalid_interceptor_credential', upstreamForwarded: false },
      observed: {
        directRespond: invalidCredential.directRespond === true,
        httpStatus: invalidCredential.responseCode,
        code: errorBody(invalidCredential).error.code,
        credentialHeaderRemoved: invalidCredential.headersToRemove?.includes(WSO2_INTERCEPTOR_TOKEN_HEADER) === true,
        upstreamForwarded: false,
      },
    },
    {
      id: 'oversized-decoded-input',
      layer: 'maha-interceptor',
      input: { decodedBodyBytes: MAX_WSO2_OPENAI_BODY_BYTES + 1, maximumDecodedBodyBytes: MAX_WSO2_OPENAI_BODY_BYTES },
      expected: { httpStatus: 413, code: 'payload_too_large', upstreamForwarded: false },
      observed: {
        directRespond: oversized.directRespond === true,
        httpStatus: oversized.responseCode,
        code: errorBody(oversized).error.code,
        credentialHeaderRemoved: oversized.headersToRemove?.includes(WSO2_INTERCEPTOR_TOKEN_HEADER) === true,
        upstreamForwarded: false,
      },
    },
  ]
}

function runUpstreamPolicyTests(root: string) {
  const source = join(root, 'policies/interceptor-service')
  const scratch = mkdtempSync(join(tmpdir(), 'maha-wso2-interceptor-policy-'))
  try {
    cpSync(source, scratch, { recursive: true })
    cpSync(
      join(process.cwd(), 'test/fixtures/wso2-interceptor-unavailable_test.go'),
      join(scratch, 'maha_unavailable_test.go'),
    )
    const names = [
      'TestOnRequestBody_ErrorPassthroughOrFail',
      'TestOnRequestBody_TimeoutPassthrough',
      'TestMahaUnavailableInterceptorFailsClosed',
      'TestMahaRepeatedPolicyLatency',
    ]
    const result = spawnSync('go', ['test', '-run', `^(${names.join('|')})$`, '-count=1', '-v'], {
      cwd: scratch,
      encoding: 'utf8',
      env: process.env,
    })
    if (result.status !== 0) {
      throw new Error(`WSO2 policy verification failed:\n${result.stdout}\n${result.stderr}`)
    }
    const passed = names.filter((name) => result.stdout.includes(`--- PASS: ${name}`))
    if (passed.length !== names.length) throw new Error('Not every required WSO2 policy test reported PASS.')
    const latencyMarker = result.stdout.match(/^MAHA_LATENCY_JSON:(.+)$/m)?.[1]
    if (!latencyMarker) throw new Error('The repeated WSO2 latency test did not emit its measurement record.')
    const latency = JSON.parse(latencyMarker) as Record<string, {
      samples: number
      samplesMillis: number[]
      minMillis: number
      medianMillis: number
      p95Millis: number
      maxMillis: number
    }>
    for (const [scenario, summary] of Object.entries(latency)) {
      if (summary.samples !== 9 || summary.samplesMillis.length !== 9) {
        throw new Error(`${scenario} did not retain exactly nine latency observations.`)
      }
      if (summary.minMillis > summary.medianMillis || summary.medianMillis > summary.p95Millis || summary.p95Millis > summary.maxMillis) {
        throw new Error(`${scenario} latency summary is internally inconsistent.`)
      }
    }
    return {
      command: `go test -run '^(${names.join('|')})$' -count=1 -v`,
      testsPassed: passed,
      repeatedLatency: {
        measurementBoundary: 'WSO2 Interceptor Service v1 OnRequestBody policy action',
        repetitionsPerScenario: 9,
        statisticMethod: 'median; p95 uses nearest-rank; range is minMillis through maxMillis',
        scenarios: latency,
      },
      source: {
        module: 'github.com/wso2/gateway-controllers/policies/interceptor-service',
        moduleGoModSha256: `sha256:${sha256(join(source, 'go.mod'))}`,
        implementationSha256: `sha256:${sha256(join(source, 'interceptorservice.go'))}`,
        upstreamTestsSha256: `sha256:${sha256(join(source, 'interceptorservice_test.go'))}`,
        mahaUnavailableFixtureSha256: `sha256:${sha256(join(process.cwd(), 'test/fixtures/wso2-interceptor-unavailable_test.go'))}`,
      },
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

function assertCase(caseResult: ReturnType<typeof applicationCases>[number]) {
  for (const key of ['httpStatus', 'code', 'upstreamForwarded'] as const) {
    if (caseResult.observed[key] !== caseResult.expected[key]) {
      throw new Error(`${caseResult.id} did not meet expected ${key}.`)
    }
  }
  if (!caseResult.observed.directRespond || !caseResult.observed.credentialHeaderRemoved) {
    throw new Error(`${caseResult.id} did not fail closed and strip its credential.`)
  }
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2)
  const value = (name: string) => argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)
  const upstreamRoot = value('--wso2-source')
  if (!upstreamRoot) throw new Error('--wso2-source=<gateway-controllers checkout> is required.')
  const output = value('--output') ?? 'content/integrations/wso2-failure-path-result.json'
  const configPath = join(process.cwd(), 'content/integrations/wso2-apis/maha-compiler.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
    spec: { policies: { paths: { params: { request: { passthroughOnError: boolean }; response: { passthroughOnError: boolean }; timeoutMillis: number } }[] }[] }
  }
  const params = config.spec.policies[0]?.paths[0]?.params
  if (!params || params.request.passthroughOnError !== false || params.response.passthroughOnError !== false) {
    throw new Error('Maha WSO2 policy must fail closed in both phases.')
  }
  if (!Number.isInteger(params.timeoutMillis) || params.timeoutMillis < 100 || params.timeoutMillis > 60_000) {
    throw new Error('Maha WSO2 policy timeout is outside WSO2 bounds.')
  }

  const cases = applicationCases()
  cases.forEach(assertCase)
  const upstream = runUpstreamPolicyTests(upstreamRoot)
  const artifact = {
    schemaVersion: '1.0.0',
    evaluationId: 'maha-wso2-failure-paths-v1',
    evaluatedAt: new Date().toISOString(),
    scope: 'zero-cost local contract and exact WSO2 interceptor-service policy tests',
    liveProviderCalls: 0,
    providerCredentialsUsed: false,
    sourcePayloadsRetained: false,
    configuration: {
      artifact: 'content/integrations/wso2-apis/maha-compiler.json',
      sha256: `sha256:${sha256(configPath)}`,
      requestPassthroughOnError: params.request.passthroughOnError,
      responsePassthroughOnError: params.response.passthroughOnError,
      timeoutMillis: params.timeoutMillis,
    },
    cases: [
      ...cases,
      {
        id: 'interceptor-timeout',
        layer: 'wso2-interceptor-service-v1',
        stimulus: 'localhost interceptor sleeps beyond the configured 100 ms test timeout',
        observed: { upstreamTest: 'TestOnRequestBody_TimeoutPassthrough', passed: true, failClosedBranchReturnsImmediateResponse: true, upstreamForwarded: false, httpStatus: 500 },
      },
      {
        id: 'interceptor-unavailable',
        layer: 'wso2-interceptor-service-v1',
        stimulus: 'connection refused by a closed localhost listener',
        observed: { upstreamTest: 'TestMahaUnavailableInterceptorFailsClosed', passed: true, failClosedBranchReturnsImmediateResponse: true, upstreamForwarded: false, httpStatus: 500 },
      },
    ],
    upstreamPolicyVerification: upstream,
    limitations: [
      'These are local contract tests; they do not claim a deployed WSO2 environment was exercised.',
      'The timeout test uses 100 ms to keep verification bounded; Maha production evaluation configuration pins 20,000 ms.',
      'Repeated latency measures the local WSO2 policy boundary, not network, deployed gateway, model-provider, or end-to-end request latency.',
      'No Anthropic request was made, so upstream non-forwarding is established by immediate-response control flow rather than provider logs.',
    ],
  }
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ output: basename(output), cases: artifact.cases.length, passed: true, liveProviderCalls: 0 }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error)
    process.exitCode = 1
  })
}
