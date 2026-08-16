import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  WSO2_EVALUATION_PATHS,
  assertCheckpointMatches,
  authorizeNextCall,
  callCostMicrodollars,
  countRetainedEvidenceSpans,
  emptyCheckpoint,
  findProhibitedAssertions,
  formatMicrodollars,
  hashArtifact,
  parseUsdToMicrodollars,
  planCalls,
  planResume,
  scoreRequiredFact,
  spentMicrodollars,
  type Microdollars,
  type Wso2CallRecord,
  type Wso2Checkpoint,
  type Wso2EvaluationPath,
} from '../lib/integrations/wso2-evaluation-harness.ts'
import {
  parseWso2EvaluationCorpus,
  type Wso2EvaluationWorkload,
} from '../lib/integrations/wso2-evaluation-corpus.ts'
import {
  WSO2_CONTEXT_EXTENSION,
  WSO2_CONTEXT_PLACEHOLDER,
  WSO2_INTERCEPTOR_TOKEN_HEADER,
  handleWso2ContextRequest,
  handleWso2ContextResponse,
} from '../lib/integrations/wso2-context-interceptor.ts'

/**
 * The 20-workload, three-path WSO2 evaluation.
 *
 * Extends the single-workload contract test rather than replacing it: the same
 * interceptor entry point, the same frozen corpus loader, the same measurement
 * vocabulary. What is new is that this one can spend money, which is why every
 * decision that leads to a provider call is in the harness library under test
 * and this file is mostly wiring.
 *
 * Defaults are inert. Without --execute it plans, scores against mock
 * responses, and writes an artifact; it never opens a socket to a provider.
 */

const MODEL = 'claude-haiku-4-5-20251001'
// $1 / $5 per million, the assumption the single-workload evaluation recorded.
const PRICING = { inputPerMillion: BigInt(1_000_000), outputPerMillion: BigInt(5_000_000) }
const TEMPERATURE = 0
const MAX_OUTPUT_TOKENS = 220

/** Conservative per-call bound, used for projection before anything is spent. */
const UPPER_BOUND_INPUT_TOKENS = 4_000
const UPPER_BOUND_OUTPUT_TOKENS = MAX_OUTPUT_TOKENS

/**
 * Placeholder used only in the non-executing modes, and long enough to satisfy
 * the interceptor's minimum secret length. An under-length value here is
 * refused by the interceptor -- correctly -- but the refusal arrives as a body
 * carrying `error`, which reads as a compiled request to anything that only
 * checks whether a body came back. Never a credential: live runs read
 * WSO2_CONTEXT_INTERCEPTOR_SECRET from the environment.
 */
const MOCK_INTERCEPTOR_SECRET = 'mock-interceptor-secret-for-non-executing-modes-only'

type GatewayConfig = {
  gateway: { version: string; ingress: string; controllerApi: string }
  apis: { pathId: Wso2EvaluationPath; name: string; context: string; resource: string; policies: unknown[] }[]
}

function gatewayConfig(): GatewayConfig {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'content/integrations/wso2-gateway-apis.json'), 'utf8'),
  ) as GatewayConfig
}

/** The gateway URL a path is routed through. Every path goes through WSO2. */
function routeFor(config: GatewayConfig, path: Wso2EvaluationPath): string {
  const api = config.apis.find((entry) => entry.pathId === path)
  if (!api) throw new Error(`No gateway API is defined for ${path}.`)
  return `${config.gateway.ingress.replace(/\/$/, '')}${api.context}${api.resource}`
}

type Options = {
  execute: boolean
  preflight: boolean
  validateOnly: boolean
  dryRun: boolean
  force: boolean
  workloadId?: string
  path?: Wso2EvaluationPath
  ceiling?: Microdollars
  output: string
  checkpoint: string
}

function parseArgs(argv: string[]): Options {
  const value = (flag: string): string | undefined => {
    const hit = argv.find((argument) => argument.startsWith(`${flag}=`))
    return hit?.slice(flag.length + 1)
  }
  const path = value('--path')
  if (path && !WSO2_EVALUATION_PATHS.includes(path as Wso2EvaluationPath)) {
    throw new Error(`--path must be one of ${WSO2_EVALUATION_PATHS.join(', ')}`)
  }
  const ceiling = value('--max-provider-cost-usd')
  return {
    execute: argv.includes('--execute'),
    preflight: argv.includes('--preflight'),
    validateOnly: argv.includes('--validate-only'),
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force-repeat-completed-calls'),
    workloadId: value('--workload'),
    path: path as Wso2EvaluationPath | undefined,
    ceiling: ceiling === undefined ? undefined : parseUsdToMicrodollars(ceiling),
    output: value('--output') ?? 'artifacts/wso2/three-path-evaluation.json',
    checkpoint: value('--checkpoint') ?? 'artifacts/wso2/three-path-checkpoint.json',
  }
}

// --- The three context paths ------------------------------------------------

type PreparedContext = {
  forwardedContext: string
  providerBody: Record<string, unknown>
  measurements: Record<string, unknown>
}

/**
 * Only the context-processing step differs between paths. Model, temperature,
 * output ceiling, task prompt, documents and citation instructions are built
 * once, here, so a difference in the report cannot come from a difference in
 * the prompt.
 */
function baseRequest(workload: Wso2EvaluationWorkload, context: string): Record<string, unknown> {
  return {
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_OUTPUT_TOKENS,
    stream: false,
    messages: [
      {
        role: 'system',
        content: 'Answer only from the source-linked evidence below. Cite the sourceId for every claim.\n\n' + context,
      },
      { role: 'user', content: workload.request.task },
    ],
  }
}

function wholeDocumentContext(workload: Wso2EvaluationWorkload): string {
  return workload.request.documents
    .map((document) => `[${document.id}] ${document.title ?? ''}\n${document.text}`)
    .join('\n\n')
}

/**
 * `mode` decides who compiles. 'live' hands WSO2 the untouched envelope;
 * 'measure' compiles in-process for the non-executing modes only.
 */
function prepare(
  workload: Wso2EvaluationWorkload,
  path: Wso2EvaluationPath,
  secret: string,
  mode: 'live' | 'measure',
): PreparedContext {
  if (path === 'wso2-baseline') {
    const context = wholeDocumentContext(workload)
    return { forwardedContext: context, providerBody: baseRequest(workload, context), measurements: { contextStrategy: 'whole-documents' } }
  }

  if (path === 'wso2-native-prompt-compressor') {
    // Whole documents in. The gateway's Prompt Compressor v0.9.0 policy does
    // the reduction, so nothing is approximated here -- the previous local
    // truncation stand-in retained 100% of evidence spans, compressed nothing,
    // and would have made Maha look better by comparison with a comparator that
    // was not doing its job.
    //
    // Consequently the pre-inference measurements for this path are unknown to
    // this process: it never sees the compressed context. They are recorded as
    // null rather than guessed, and the provider input-token count is the
    // honest measure of what the policy actually did.
    const context = wholeDocumentContext(workload)
    return {
      forwardedContext: context,
      providerBody: baseRequest(workload, context),
      measurements: {
        contextStrategy: 'wso2-prompt-compressor-v0.9.0',
        policyAttachedInGateway: true,
        passageLevelCitationCapable: false,
        hardBudgetCompliant: null,
        sourceCoveragePercent: null,
        preInferenceMeasurementsAvailable: false,
        note: 'Compression happens inside the gateway; spans measured here are pre-compression and are not what the provider received.',
      },
    }
  }

  // The Maha path sends the envelope UNTOUCHED, with maha_context intact.
  //
  // The previous version compiled here and sent the rewritten body, so WSO2's
  // interceptor policy received an already-compiled request and had nothing to
  // do. That measured this process and reported it as the gateway. The whole
  // claim under test is that the gateway calls Maha, so the gateway has to be
  // the thing that calls Maha.
  //
  // `mode: 'measure'` still compiles locally, but only in the non-executing
  // modes, and only to produce pre-inference numbers without a provider. It
  // never supplies the live request body.
  const envelope = {
    ...baseRequest(workload, WSO2_CONTEXT_PLACEHOLDER),
    [WSO2_CONTEXT_EXTENSION]: workload.request,
  }

  if (mode === 'live') {
    return {
      forwardedContext: '',
      providerBody: envelope,
      measurements: {
        contextStrategy: 'maha-context-compiler',
        compiledInGateway: true,
        passageLevelCitationCapable: true,
        // Filled from the x-maha-* response headers the gateway returns. Null
        // here rather than guessed: this process did not compile anything.
        preInferenceMeasurementsAvailable: false,
      },
    }
  }

  const result = handleWso2ContextRequest({
    requestHeaders: { 'content-type': 'application/json', [WSO2_INTERCEPTOR_TOKEN_HEADER]: secret },
    requestBody: Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64'),
    invocationContext: {
      requestId: workload.request.clientRequestId,
      apiName: 'Maha-Context-Evaluation',
      apiVersion: 'v1.0',
      method: 'POST',
      path: '/v1/chat/completions',
    },
  }, secret)

  if (!result.body) throw new Error(`The interceptor refused workload ${workload.id} instead of compiling it.`)
  const rewritten = JSON.parse(Buffer.from(result.body, 'base64').toString('utf8')) as Record<string, unknown>
  if (!Array.isArray(rewritten.messages)) {
    throw new Error(`The interceptor returned no messages for ${workload.id}: ${JSON.stringify(rewritten.error ?? rewritten).slice(0, 200)}`)
  }
  const headers = handleWso2ContextResponse({ interceptorContext: result.interceptorContext }, secret).headersToAdd ?? {}
  return {
    forwardedContext: JSON.stringify(rewritten.messages),
    providerBody: rewritten,
    measurements: {
      contextStrategy: 'maha-context-compiler',
      compiledInGateway: false,
      passageLevelCitationCapable: true,
      packId: headers['x-maha-context-pack-id'],
      inputHash: headers['x-maha-context-input-hash'],
      outputHash: headers['x-maha-context-output-hash'],
      mahaEstimatedOriginalTokens: Number(headers['x-maha-original-estimated-tokens']),
      mahaEstimatedCompiledTokens: Number(headers['x-maha-compiled-estimated-tokens']),
      mahaEstimatedReductionPercent: Number(headers['x-maha-estimated-reduction-percent']),
      sourceCoveragePercent: Number(headers['x-maha-source-coverage-percent']),
      includedPassageCount: Number(headers['x-maha-included-passage-count']),
      hardBudgetCompliant: Number(headers['x-maha-compiled-estimated-tokens']) <= workload.request.tokenBudget,
      sourceTextStored: false,
      compiledContextStored: false,
    },
  }
}

// --- Provider ---------------------------------------------------------------

type ProviderResponse =
  | { ok: true; answer: string; inputTokens: number; outputTokens: number; gatewayHeaders?: Record<string, string> }
  | { ok: false; error: string; status?: number }

/** Deterministic stand-in used by every non-execute mode. Never opens a socket. */
function mockProvider(workload: Wso2EvaluationWorkload, forwardedContext: string): ProviderResponse {
  const spans = workload.labels.requiredFacts.flatMap((fact) => fact.evidence)
  const present = spans.filter((span) => forwardedContext.toLowerCase().includes(span.toLowerCase()))
  const citations = workload.request.documents.map((document) => `[${document.id}]`).join(' ')
  return {
    ok: true,
    answer: `${present.join(' ')} ${citations}`.trim(),
    inputTokens: Math.ceil(forwardedContext.length / 4),
    outputTokens: Math.min(MAX_OUTPUT_TOKENS, Math.ceil(present.join(' ').length / 4) + 8),
  }
}

/**
 * One request. No retry, no backoff, no fallback.
 *
 * An automatic retry on an ambiguous failure is a second charge for a question
 * already asked, and the operator authorized a call count rather than an
 * outcome.
 */
async function callThroughGateway(
  url: string,
  body: Record<string, unknown>,
  interceptorToken?: string,
  requireMahaEvidence = false,
): Promise<ProviderResponse> {
  // Through WSO2, never straight to the provider. Calling Anthropic directly
  // for all three paths -- which the first version of this runner did -- does
  // not test the gateway at all: it measures three context strategies in this
  // process and reports them as a gateway comparison.
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY is not set.' }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // The gateway forwards request headers to the interceptor, which
        // validates this and strips it before upstream forwarding -- so it
        // never reaches Anthropic. Sent by the client because set-headers
        // v1.0.1 breaks policy-chain construction on this gateway build.
        ...(interceptorToken ? { [WSO2_INTERCEPTOR_TOKEN_HEADER]: interceptorToken } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) return { ok: false, error: `gateway HTTP ${response.status}`, status: response.status }
    // The interceptor's evidence headers, echoed by the gateway. On the Maha
    // live path these are the ONLY source of pre-inference measurements, since
    // this process no longer compiles anything.
    const gatewayHeaders: Record<string, string> = {}
    response.headers.forEach((headerValue, headerName) => {
      if (headerName.toLowerCase().startsWith('x-maha-')) gatewayHeaders[headerName.toLowerCase()] = headerValue
    })
    if (requireMahaEvidence) {
      const required = [
        'x-maha-context-pack-id',
        'x-maha-context-input-hash',
        'x-maha-context-output-hash',
        'x-maha-compiled-estimated-tokens',
        'x-maha-source-coverage-percent',
        'x-maha-included-passage-count',
      ]
      const missing = required.filter((name) => !gatewayHeaders[name])
      if (missing.length > 0) {
        return { ok: false, error: `Maha policy produced no verifiable downstream evidence; missing ${missing.join(', ')}.` }
      }
    }
    const payload = await response.json() as {
      content?: { text?: string }[]
      choices?: { message?: { content?: string } }[]
      usage?: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
    }
    const answer = (payload.content ?? []).map((part) => part.text ?? '').join('')
      || payload.choices?.[0]?.message?.content
      || ''
    return {
      ok: true,
      answer,
      inputTokens: payload.usage?.input_tokens ?? payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? payload.usage?.completion_tokens ?? 0,
      gatewayHeaders,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'gateway request failed' }
  }
}

/**
 * Zero-cost preflight. Answers every question that does not need a model.
 *
 * Run before any paid pilot: a gateway that is not running, or an API that is
 * not deployed, must be discovered for free rather than by spending on sixty
 * failed calls.
 */
async function preflight(config: GatewayConfig): Promise<{ ok: boolean; checks: Record<string, unknown>[] }> {
  const checks: Record<string, unknown>[] = []
  // The management API is basic-auth protected. Defaulted for the disposable
  // local gateway and overridable, so a shared instance never needs the
  // credential written down here.
  const auth = `Basic ${Buffer.from(process.env.WSO2_MANAGEMENT_AUTH ?? 'admin:admin').toString('base64')}`
  const managed = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers as Record<string, string> ?? {}), authorization: auth },
  })
  const add = (id: string, pass: boolean, detail: unknown) => { checks.push({ id, pass, detail }) }

  const probe = async (url: string, init?: RequestInit): Promise<{ status: number } | { error: string }> => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000), ...init })
      return { status: response.status }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'request failed' }
    }
  }

  // 1. Controller must answer, and we must be able to read DEPLOYED state --
  // not the local JSON. A previous version checked the repository file and
  // called that a gateway check, which would pass with no gateway running.
  const listUrl = `${config.gateway.controllerApi.replace(/\/$/, '')}/api/management/v0.9/llm-proxies`
  const list = await probe(listUrl, managed())
  if ('error' in list) {
    add('controller.reachable', false, list.error)
    add('controller.deployedState', false, 'not read: controller unreachable')
    return { ok: false, checks }
  }
  add('controller.reachable', list.status === 200, `HTTP ${list.status}`)

  let deployed: { name?: string; context?: string; policies?: { name?: string; version?: string; parameters?: Record<string, unknown> }[] }[] = []
  try {
    const response = await fetch(listUrl, managed({ signal: AbortSignal.timeout(4000) }))
    const payload = await response.json() as { proxies?: typeof deployed; list?: typeof deployed } | typeof deployed
    deployed = Array.isArray(payload) ? payload : (payload.proxies ?? payload.list ?? [])
    add('controller.deployedState', true, `${deployed.length} API(s) deployed`)
  } catch (error) {
    add('controller.deployedState', false, error instanceof Error ? error.message : 'unreadable')
    return { ok: false, checks }
  }

  // 2. Each route must exist AND answer as expected. A 404 is a route that is
  // not deployed; treating any HTTP response as success -- which the previous
  // version did -- would have green-lit a gateway serving nothing.
  for (const api of config.apis) {
    const live = deployed.find((entry) => (entry as { spec?: { context?: string } }).spec?.context === api.context || entry.context === api.context)
    add(`api.${api.pathId}.deployed`, Boolean(live), live ? `context ${api.context}` : `no deployed API at ${api.context}`)

    const result = await probe(routeFor(config, api.pathId), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    if ('error' in result) {
      add(`api.${api.pathId}.route`, false, result.error)
      continue
    }
    // The probe must reach the UPSTREAM and be rejected there, which proves the
    // whole chain resolves. Anything else is a gateway fault wearing a status
    // code.
    //
    // 5xx was previously accepted, and it hid the defect this check exists to
    // catch: the controller reported "deployed successfully" while the runtime
    // logged "Policy chain not found for route, returning 500". Roughly forty
    // of sixty calls would have failed after the ceiling was authorized.
    //
    // 401/403 is the expected pass: the request reached Anthropic and was
    // refused for want of a key. 404 means the route is absent, 200 means a
    // model call nobody intended, 5xx means the gateway itself broke.
    const reason = result.status === 404 ? 'route not deployed'
      : result.status === 200 ? 'unexpected success on an empty body -- a model call was made'
      : result.status >= 500 ? 'gateway fault: the request never reached the upstream'
      : result.status === 401 || result.status === 403 ? ''
      : 'unexpected status; the probe should be refused by the upstream, not the gateway'
    add(`api.${api.pathId}.route`, reason === '', `HTTP ${result.status}${reason ? ` (${reason})` : ' (reached upstream)'}`)
  }

  // 3. The compressor version must come from DEPLOYED policy state, not from
  // the file that merely says what we intended to deploy.
  const nativeApi = config.apis.find((api) => api.pathId === 'wso2-native-prompt-compressor')
  const deployedNative = deployed.find((entry) => (entry as { spec?: { context?: string } }).spec?.context === nativeApi?.context)
  const nativeSpec = (deployedNative as { spec?: { policies?: { name?: string; version?: string; paths?: { params?: { rules?: { value?: number }[] } }[] }[] } } | undefined)?.spec
  const policy = nativeSpec?.policies?.find((entry) => entry.name === 'prompt-compressor')
  const nativeRoute = policy?.paths?.[0] as ({ path?: string; methods?: string[]; params?: { rules?: { value?: number }[] } } | undefined)
  const ratio = nativeRoute?.params?.rules?.[0]?.value
  add(
    'policy.promptCompressor.deployed',
    policy?.version === 'v0' && nativeRoute?.path === '/v1/chat/completions' && nativeRoute.methods?.includes('POST') === true && typeof ratio === 'number',
    policy
      ? `attached by ${policy.version}, operation=${String(nativeRoute?.path)}, ratio=${String(ratio)}${typeof ratio === 'number' ? '' : ' (PARAMETERS DID NOT PERSIST -- the policy is at its default)'}`
      : 'not present in deployed state',
  )

  const mahaApi = config.apis.find((api) => api.pathId === 'wso2-maha-context-compiler')
  const deployedMaha = deployed.find((entry) => (entry as { spec?: { context?: string } }).spec?.context === mahaApi?.context)
  const mahaSpec = (deployedMaha as { spec?: { policies?: { name?: string; version?: string; paths?: { path?: string; methods?: string[]; params?: { request?: unknown; response?: unknown } }[] }[] } } | undefined)?.spec
  const mahaPolicy = mahaSpec?.policies?.find((entry) => entry.name === 'interceptor-service')
  const mahaRoute = mahaPolicy?.paths?.[0]
  add(
    'policy.mahaInterceptor.deployed',
    mahaPolicy?.version === 'v1'
      && mahaRoute?.path === '/v1/chat/completions'
      && mahaRoute.methods?.includes('POST') === true
      && Boolean(mahaRoute.params?.request)
      && Boolean(mahaRoute.params?.response),
    mahaPolicy
      ? `attached by ${String(mahaPolicy.version)}, operation=${String(mahaRoute?.path)}, request+response=${Boolean(mahaRoute?.params?.request) && Boolean(mahaRoute?.params?.response)}`
      : 'not present in deployed state',
  )

  // 4. The interceptor must refuse an unauthenticated call. If it does not,
  // the credential is not actually enforced and the Maha path is untrusted.
  const configured = process.env.MAHA_INTERCEPTOR_ENDPOINT
  // The gateway reaches the interceptor at host.docker.internal, which is a
  // Docker-internal name that does not resolve on the host running preflight.
  // Probing the configured value verbatim reports "fetch failed" for a
  // perfectly healthy endpoint -- a false alarm on the check whose whole job is
  // to prove the credential is enforced.
  const endpoint = configured?.replace('host.docker.internal', 'localhost')
  if (!endpoint) {
    add('interceptor.unauthenticatedRefusal', false, 'MAHA_INTERCEPTOR_ENDPOINT is not set')
  } else {
    const refusal = await probe(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestHeaders: {}, requestBody: '', invocationContext: {} }),
    })
    // The route answers 200 carrying directRespond:true + responseCode:401 --
    // that IS the refusal, expressed in the interceptor contract rather than in
    // the transport. Checked on the body, not the status.
    let refusedInBody = false
    if (!('error' in refusal)) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ requestHeaders: {}, requestBody: '', invocationContext: {} }),
          signal: AbortSignal.timeout(4000),
        })
        const payload = await response.json() as { directRespond?: boolean; responseCode?: number }
        refusedInBody = payload.directRespond === true && payload.responseCode === 401
      } catch { refusedInBody = false }
    }
    const refused = refusedInBody || (!('error' in refusal) && (refusal.status === 401 || refusal.status === 403))
    add('interceptor.unauthenticatedRefusal', refused, 'error' in refusal
      ? refusal.error
      : `HTTP ${refusal.status}, directRespond+401 in body: ${refusedInBody}`)
  }

  return { ok: checks.every((check) => check.pass === true), checks }
}

// --- Run --------------------------------------------------------------------

function readCheckpoint(path: string, digest: string): Wso2Checkpoint {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Wso2Checkpoint
    assertCheckpointMatches(parsed, digest, MODEL)
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyCheckpoint(digest, MODEL)
    throw error
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const corpus = parseWso2EvaluationCorpus(
    JSON.parse(readFileSync(join(process.cwd(), 'content/integrations/wso2-context-compiler-corpus.json'), 'utf8')),
  )
  const digest = corpus.labelFreeze.digest

  const config = gatewayConfig()

  if (options.preflight) {
    const result = await preflight(config)
    console.log(JSON.stringify({ mode: 'preflight', gatewayVersion: config.gateway.version, liveModelCalls: 0, ...result }, null, 2))
    if (!result.ok) process.exitCode = 1
    return
  }

  if (options.validateOnly) {
    console.log(JSON.stringify({ mode: 'validate-only', digest, workloads: corpus.workloads.length, plannedCalls: planCalls(corpus.workloads).length }, null, 2))
    return
  }

  const planned = planCalls(corpus.workloads, { workloadId: options.workloadId, path: options.path })
  const upperBoundPerCall = callCostMicrodollars(UPPER_BOUND_INPUT_TOKENS, UPPER_BOUND_OUTPUT_TOKENS, PRICING)
  const checkpoint = readCheckpoint(options.checkpoint, digest)
  const resume = planResume(planned, checkpoint, { force: options.force, upperBoundPerCall })
  const projection = BigInt(resume.toRun.length) * upperBoundPerCall

  if (options.force && resume.repeatUpperBound > BigInt(0)) {
    console.log(`FORCE: repeating ${resume.alreadyComplete.length} completed calls costs up to an ADDITIONAL $${formatMicrodollars(resume.repeatUpperBound)}.`)
  }

  const summary = {
    digest,
    model: MODEL,
    plannedCalls: planned.length,
    alreadyComplete: resume.alreadyComplete.length,
    callsToRun: resume.toRun.length,
    upperBoundPerCallUsd: formatMicrodollars(upperBoundPerCall),
    projectedUpperBoundUsd: formatMicrodollars(projection),
    ceilingUsd: options.ceiling === undefined ? null : formatMicrodollars(options.ceiling),
    alreadySpentUsd: formatMicrodollars(spentMicrodollars(checkpoint)),
  }

  if (!options.execute) {
    // The default. Scores every planned call against the deterministic mock so
    // the whole pipeline is exercised without a provider.
    const results = resume.toRun.map((call) => {
      const workload = corpus.workloads.find((candidate) => candidate.id === call.workloadId)!
      const prepared = prepare(workload, call.path, MOCK_INTERCEPTOR_SECRET, 'measure')
      const response = mockProvider(workload, prepared.forwardedContext)
      return score(workload, call.path, prepared, response, 0)
    })
    writeJson(options.output, { mode: options.dryRun ? 'dry-run' : 'mock', ...summary, results })
    console.log(JSON.stringify({ ...summary, mode: options.dryRun ? 'dry-run' : 'mock', wrote: options.output, liveCalls: 0 }, null, 2))
    return
  }

  // --- Live, from here down -------------------------------------------------
  if (options.ceiling === undefined) {
    throw new Error('--execute requires --max-provider-cost-usd. A live run without a ceiling is not a bounded evaluation.')
  }
  const secret = process.env.WSO2_CONTEXT_INTERCEPTOR_SECRET
  if (!secret) throw new Error('WSO2_CONTEXT_INTERCEPTOR_SECRET is not set.')
  if (spentMicrodollars(checkpoint) + projection > options.ceiling) {
    throw new Error(`Refusing to start: the projected upper bound of $${formatMicrodollars(projection)} plus $${formatMicrodollars(spentMicrodollars(checkpoint))} already spent exceeds the ceiling of $${formatMicrodollars(options.ceiling)}.`)
  }

  const results: unknown[] = []
  for (const call of resume.toRun) {
    const decision = authorizeNextCall(spentMicrodollars(checkpoint), upperBoundPerCall, options.ceiling)
    if (!decision.allowed) {
      console.error(decision.reason)
      break
    }
    const workload = corpus.workloads.find((candidate) => candidate.id === call.workloadId)!
    const prepared = prepare(workload, call.path, secret, 'live')
    const startedAt = Date.now()
    const response = await callThroughGateway(
      routeFor(config, call.path),
      prepared.providerBody,
      call.path === 'wso2-maha-context-compiler' ? secret : undefined,
      call.path === 'wso2-maha-context-compiler',
    )
    const latency = Date.now() - startedAt
    const cost = response.ok ? callCostMicrodollars(response.inputTokens, response.outputTokens, PRICING) : BigInt(0)

    const scored = score(workload, call.path, prepared, response, latency)
    results.push(scored)
    // Written after every call, so an interruption never repeats a paid one.
    checkpoint.records.push({
      workloadId: call.workloadId,
      path: call.path,
      outcome: response.ok ? 'ok' : 'failed',
      costMicrodollars: cost.toString(),
      completedAt: new Date().toISOString(),
    } satisfies Wso2CallRecord)
    writeJson(options.checkpoint, checkpoint)
  }

  const artifact = { mode: 'live', ...summary, spentUsd: formatMicrodollars(spentMicrodollars(checkpoint)), results }
  writeJson(options.output, artifact)
  console.log(JSON.stringify({ ...summary, mode: 'live', liveCalls: results.length, spentUsd: formatMicrodollars(spentMicrodollars(checkpoint)), artifactHash: hashArtifact(artifact) }, null, 2))
}

/** Phase C: context measurements and answer measurements, kept apart. */
function score(
  workload: Wso2EvaluationWorkload,
  path: Wso2EvaluationPath,
  prepared: PreparedContext,
  response: ProviderResponse,
  latencyMs: number,
) {
  const retention = countRetainedEvidenceSpans(prepared.forwardedContext, workload.labels.requiredFacts)
  const sourceIds = new Set(workload.request.documents.map((document) => document.id))
  const answer = response.ok ? response.answer : ''
  const verdicts = workload.labels.requiredFacts.map((fact) => ({ id: fact.id, verdict: scoreRequiredFact(answer, fact) }))
  const citations = [...answer.matchAll(/\[([A-Za-z0-9._:-]+)\]/g)].map((match) => match[1])

  // Evidence the gateway reported. Present only when the gateway ran the
  // interceptor, which is exactly the proof that it did.
  const fromGateway = (response.ok && response.gatewayHeaders) ? response.gatewayHeaders : {}
  const gatewayEvidence = Object.keys(fromGateway).length === 0 ? {} : {
    compiledInGateway: true,
    packId: fromGateway['x-maha-context-pack-id'],
    inputHash: fromGateway['x-maha-context-input-hash'],
    outputHash: fromGateway['x-maha-context-output-hash'],
    mahaEstimatedCompiledTokens: Number(fromGateway['x-maha-compiled-estimated-tokens']),
    sourceCoveragePercent: Number(fromGateway['x-maha-source-coverage-percent']),
    includedPassageCount: Number(fromGateway['x-maha-included-passage-count']),
    hardBudgetCompliant: Number(fromGateway['x-maha-compiled-estimated-tokens']) <= workload.request.tokenBudget,
    preInferenceMeasurementsAvailable: true,
  }

  return {
    workloadId: workload.id,
    difficulty: workload.difficulty,
    path,
    // Pre-inference: a property of the context, not of the answer.
    context: {
      requiredEvidenceSpansPresent: retention.retained,
      requiredEvidenceSpansTotal: retention.total,
      requiredSourceIdsRepresented: [...sourceIds].filter((id) => prepared.forwardedContext.includes(id)).length,
      requiredSourceIdsTotal: sourceIds.size,
      ...prepared.measurements,
      ...gatewayEvidence,
    },
    // Downstream: a property of the answer, not of the context.
    answer: {
      ok: response.ok,
      error: response.ok ? null : response.error,
      requiredFactsAnswered: verdicts.filter((entry) => entry.verdict === 'answered').length,
      requiredFactsTotal: verdicts.length,
      manualReviewRequired: verdicts.filter((entry) => entry.verdict === 'manual_review_required').map((entry) => entry.id),
      verdicts,
      citationsReturned: citations.length,
      citationsResolvable: citations.filter((id) => sourceIds.has(id)).length,
      prohibitedAssertions: findProhibitedAssertions(answer, workload.labels.mustNotAssert),
      providerInputTokens: response.ok ? response.inputTokens : null,
      providerOutputTokens: response.ok ? response.outputTokens : null,
      latencyMs,
    },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error)
    process.exitCode = 1
  })
}
