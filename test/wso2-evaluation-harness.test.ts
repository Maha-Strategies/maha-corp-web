import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { parseWso2EvaluationCorpus } from '../lib/integrations/wso2-evaluation-corpus.ts'

import {
  WSO2_EVALUATION_PATHS,
  assertCheckpointMatches,
  authorizeNextCall,
  buildBlindedAdjudication,
  callCostMicrodollars,
  checkpointResults,
  countRetainedEvidenceSpans,
  emptyCheckpoint,
  findProhibitedAssertions,
  formatMicrodollars,
  isResolvableSourceCitation,
  parseUsdToMicrodollars,
  planCalls,
  planResume,
  scoreRequiredFact,
  sanitizeAdjudicationAnswer,
  spentMicrodollars,
  type Wso2CallRecord,
} from '../lib/integrations/wso2-evaluation-harness.ts'

test('human-review answers are sanitized and path identities are kept in a separate key', () => {
  const corpus = parseWso2EvaluationCorpus(
    JSON.parse(readFileSync(new URL('../content/integrations/wso2-context-compiler-corpus.json', import.meta.url), 'utf8')),
  )
  const workload = corpus.workloads[0]
  const results = WSO2_EVALUATION_PATHS.map((path) => ({
    workloadId: workload.id,
    path,
    answer: { reviewText: sanitizeAdjudicationAnswer('Allowed answer. Bearer secret-token-value-1234567890 sk-ant-abcdefghijklmnop') },
  }))
  const review = buildBlindedAdjudication(corpus.labelFreeze.digest, [workload], results)
  const blindText = JSON.stringify(review.blinded)

  assert.equal(review.blinded.responses.length, 3)
  assert.equal(blindText.includes('wso2-baseline'), false)
  assert.equal(blindText.includes('wso2-native-prompt-compressor'), false)
  assert.equal(blindText.includes('wso2-maha-context-compiler'), false)
  assert.equal(blindText.includes('secret-token-value'), false)
  assert.equal(blindText.includes('abcdefghijklmnop'), false)
  assert.deepEqual(new Set(review.key.mappings.map((entry) => entry.path)), new Set(WSO2_EVALUATION_PATHS))
  assert.ok(review.blinded.responses.every((entry) => entry.requiredFacts.every((fact) => fact.verdict === null)))
})

// Claude Haiku 4.5, the model the single-workload evaluation used.
const PRICING = { inputPerMillion: BigInt(1_000_000), outputPerMillion: BigInt(5_000_000) }

// --- Exact money ------------------------------------------------------------

test('dollar strings parse to exact microdollars, and floating point is never involved', () => {
  assert.equal(parseUsdToMicrodollars('0.10'), BigInt(100_000))
  assert.equal(parseUsdToMicrodollars('0.250000'), BigInt(250_000))
  assert.equal(parseUsdToMicrodollars('1'), BigInt(1_000_000))
  // 0.1 + 0.2 !== 0.3 in binary floating point. It does here.
  assert.equal(parseUsdToMicrodollars('0.1') + parseUsdToMicrodollars('0.2'), parseUsdToMicrodollars('0.3'))
})

test('an inexact or malformed ceiling is refused rather than coerced', () => {
  for (const bad of ['', '0.1234567', 'ten cents', '-1', '1e-3', '$0.25', ' ']) {
    assert.throws(() => parseUsdToMicrodollars(bad), /exact dollar amount/, `${bad} must not parse`)
  }
})

test('per-call cost rounds up, so sixty calls cannot undercount the ceiling', () => {
  // 1 input token at $1/M is 1 microdollar exactly.
  assert.equal(callCostMicrodollars(1_000_000, 0, PRICING), BigInt(1_000_000))
  // A single token is a fraction of a microdollar and must still cost one.
  assert.equal(callCostMicrodollars(1, 0, PRICING), BigInt(1))
  // Output is priced at $5/M, so one output token is five microdollars -- not
  // one. Asserting symmetry here was wrong and would have hidden a 5x
  // undercount of the output side of every projection.
  assert.equal(callCostMicrodollars(0, 1, PRICING), BigInt(5))
  assert.equal(callCostMicrodollars(0, 0, PRICING), BigInt(0))
})

test('the ceiling is enforced before the call, not after', () => {
  const ceiling = parseUsdToMicrodollars('1.00')
  const spent = parseUsdToMicrodollars('0.90')

  const fits = authorizeNextCall(spent, parseUsdToMicrodollars('0.10'), ceiling)
  assert.equal(fits.allowed, true, 'landing exactly on the ceiling is allowed')

  const overruns = authorizeNextCall(spent, parseUsdToMicrodollars('0.100001'), ceiling)
  assert.equal(overruns.allowed, false, 'one microdollar over must refuse')
  if (!overruns.allowed) {
    assert.match(overruns.reason, /Refusing the next call/)
    // The operator needs all three numbers to act, not just a refusal.
    assert.match(overruns.reason, /0\.900000/)
    assert.match(overruns.reason, /1\.000000/)
  }
})

test('formatting round-trips, so a reported ceiling is the enforced one', () => {
  for (const value of ['0.000001', '0.005347', '0.250000', '12.345678']) {
    assert.equal(formatMicrodollars(parseUsdToMicrodollars(value)), value)
  }
})

// --- Deterministic planning -------------------------------------------------

test('the plan is 60 calls in a stable order', () => {
  const workloads = Array.from({ length: 20 }, (_, index) => ({ id: `wl-${String(index + 1).padStart(2, '0')}` }))
  const calls = planCalls(workloads)
  assert.equal(calls.length, 60)
  assert.deepEqual(calls.slice(0, 3).map((call) => call.path), [...WSO2_EVALUATION_PATHS])
  assert.deepEqual(planCalls(workloads), calls, 'planning twice must give the same sequence')
})

test('filters narrow the plan without reordering it', () => {
  const workloads = [{ id: 'a' }, { id: 'b' }]
  assert.equal(planCalls(workloads, { workloadId: 'b' }).length, 3)
  assert.equal(planCalls(workloads, { path: 'wso2-baseline' }).length, 2)
  assert.equal(planCalls(workloads, { workloadId: 'a', path: 'wso2-baseline' }).length, 1)
})

// --- Checkpoint and no-repeat ----------------------------------------------

const record = (workloadId: string, path: typeof WSO2_EVALUATION_PATHS[number], cost = '1000'): Wso2CallRecord => ({
  workloadId, path, outcome: 'ok', costMicrodollars: cost, completedAt: '2026-08-14T00:00:00.000Z',
})

test('a resumed run repeats no completed call, so an interruption costs nothing', () => {
  const workloads = [{ id: 'a' }, { id: 'b' }]
  const planned = planCalls(workloads)
  const checkpoint = emptyCheckpoint('digest', 'model')
  checkpoint.records.push(record('a', 'wso2-baseline'), record('a', 'wso2-native-prompt-compressor'))

  const resume = planResume(planned, checkpoint, { upperBoundPerCall: BigInt(1000) })
  assert.equal(resume.toRun.length, 4)
  assert.equal(resume.alreadyComplete.length, 2)
  assert.equal(resume.repeatUpperBound, BigInt(0))
  assert.ok(!resume.toRun.some((call) => call.workloadId === 'a' && call.path === 'wso2-baseline'))
})

test('a resumed artifact retains prior scored results in planned order', () => {
  const planned = planCalls([{ id: 'a' }, { id: 'b' }])
  const checkpoint = emptyCheckpoint('digest', 'model')
  checkpoint.records.push(
    { ...record('a', 'wso2-baseline'), result: { marker: 'first' } },
    { ...record('a', 'wso2-native-prompt-compressor'), result: { marker: 'second' } },
  )

  assert.deepEqual(checkpointResults<{ marker: string }>(planned, checkpoint), [
    { marker: 'first' },
    { marker: 'second' },
  ])
})

test('a completed call without a scored result fails closed instead of being omitted or repeated', () => {
  const planned = planCalls([{ id: 'a' }])
  const checkpoint = emptyCheckpoint('digest', 'model')
  checkpoint.records.push(record('a', 'wso2-baseline'))
  assert.throws(
    () => checkpointResults(planned, checkpoint),
    /marked complete but has no scored result[\s\S]*fresh checkpoint/,
  )
})

test('a forced repeat keeps spend history but uses the latest scored result once', () => {
  const planned = planCalls([{ id: 'a' }], { path: 'wso2-baseline' })
  const checkpoint = emptyCheckpoint('digest', 'model')
  checkpoint.records.push(
    { ...record('a', 'wso2-baseline', '7'), result: { marker: 'old' } },
    { ...record('a', 'wso2-baseline', '11'), result: { marker: 'new' } },
  )
  assert.equal(spentMicrodollars(checkpoint), BigInt(18), 'both paid attempts remain in spend history')
  assert.deepEqual(checkpointResults<{ marker: string }>(planned, checkpoint), [{ marker: 'new' }])
})

test('forcing repeats reports the exact additional maximum cost', () => {
  const planned = planCalls([{ id: 'a' }])
  const checkpoint = emptyCheckpoint('digest', 'model')
  checkpoint.records.push(record('a', 'wso2-baseline'), record('a', 'wso2-maha-context-compiler'))

  const forced = planResume(planned, checkpoint, { force: true, upperBoundPerCall: parseUsdToMicrodollars('0.01') })
  assert.equal(forced.toRun.length, 3, 'force re-runs everything planned')
  // Two completed calls would be paid for a second time. The operator sees the
  // number before it happens, not in the invoice.
  assert.equal(formatMicrodollars(forced.repeatUpperBound), '0.020000')
})

test('a failure is a recorded result, never a retry', () => {
  const planned = planCalls([{ id: 'a' }])
  const checkpoint = emptyCheckpoint('digest', 'model')
  checkpoint.records.push({ ...record('a', 'wso2-baseline'), outcome: 'failed' })

  const resume = planResume(planned, checkpoint, { upperBoundPerCall: BigInt(1000) })
  assert.ok(
    !resume.toRun.some((call) => call.path === 'wso2-baseline'),
    'a failed call is complete: re-running it is a second charge for a question already answered',
  )
})

test('spend is summed exactly from the checkpoint', () => {
  const checkpoint = emptyCheckpoint('digest', 'model')
  for (let index = 0; index < 60; index += 1) {
    checkpoint.records.push(record(`w${index}`, 'wso2-baseline', '1'))
  }
  assert.equal(spentMicrodollars(checkpoint), BigInt(60))
})

test('a checkpoint from a different corpus or model is refused', () => {
  const checkpoint = emptyCheckpoint('digest-a', 'model-a')
  assert.throws(() => assertCheckpointMatches(checkpoint, 'digest-b', 'model-a'), /different corpus digest/)
  assert.throws(() => assertCheckpointMatches(checkpoint, 'digest-a', 'model-b'), /mixing models/)
  assert.doesNotThrow(() => assertCheckpointMatches(checkpoint, 'digest-a', 'model-a'))
})

// --- Scoring ----------------------------------------------------------------

const fact = { statement: 'The rollback threshold is two percent over five minutes.', evidence: ['Rollback if API errors exceed 2 percent for five minutes'] }

test('an exact evidence span scores as answered', () => {
  assert.equal(scoreRequiredFact('The runbook says: Rollback if API errors exceed 2 percent for five minutes.', fact), 'answered')
})

test('an unrelated answer scores as not answered', () => {
  assert.equal(scoreRequiredFact('The weather in Colombo is warm today.', fact), 'not_answered')
})

test('a plausible paraphrase is flagged for review, not silently failed or passed', () => {
  // The honest case. A deterministic scorer cannot tell this from a wrong
  // answer, and guessing in either direction would misreport every path.
  const verdict = scoreRequiredFact('Roll back when the error rate passes two percent across a five minute window.', fact)
  assert.equal(verdict, 'manual_review_required')
})

test('prohibited assertions are matched exactly, and absence is not inferred', () => {
  const banned = ['the rollback threshold is 5 percent']
  assert.deepEqual(findProhibitedAssertions('The rollback threshold is 5 percent.', banned), banned)
  assert.deepEqual(findProhibitedAssertions('The rollback threshold is 2 percent.', banned), [])
})

test('evidence-span retention measures the forwarded context, not the answer', () => {
  // The distinction the report must not collapse: a span can survive
  // compression and still go unused, and an answer can be right without it.
  const facts = [fact, { evidence: ['credential-rotation evidence'] }]
  const forwarded = 'Rollback if API errors exceed 2 percent for five minutes. Nothing about rotation here.'
  assert.deepEqual(countRetainedEvidenceSpans(forwarded, facts), { retained: 1, total: 2 })
})

test('source-level and source-linked passage citations both resolve', () => {
  const sources = new Set(['release-policy', 'rollback-runbook'])
  assert.equal(isResolvableSourceCitation('release-policy', sources), true)
  assert.equal(isResolvableSourceCitation('release-policy:1', sources), true)
  assert.equal(isResolvableSourceCitation('release-policy:appendix:2', sources), true)
  assert.equal(isResolvableSourceCitation('unknown:1', sources), false)
})

test('retention counts spans, so a fact with several spans is not one unit', () => {
  const facts = [{ evidence: ['alpha span', 'beta span'] }]
  assert.deepEqual(countRetainedEvidenceSpans('alpha span only', facts), { retained: 1, total: 2 })
})

// --- Interceptor fail-closed shape -----------------------------------------
//
// Recorded because it was misdiagnosed. A probe read `directRespond?.statusCode`
// on a boolean, printed "none", and produced a report claiming the interceptor
// could leak an error body upstream as a model request. It does not. The
// difference between "the code is wrong" and "my probe was wrong" is worth a
// test rather than a memory.

import {
  WSO2_CONTEXT_EXTENSION,
  WSO2_CONTEXT_PLACEHOLDER,
  WSO2_INTERCEPTOR_TOKEN_HEADER,
  handleWso2ContextRequest,
  handleWso2ContextResponse,
} from '../lib/integrations/wso2-context-interceptor.ts'

const SECRET = 'wso2-evaluation-secret-at-least-32-characters'

// A real frozen workload rather than a hand-made one. A minimal envelope is
// refused by the compiler for missing fields, which is correct behaviour but
// makes the compile-path test measure the wrong thing.
const CORPUS = parseWso2EvaluationCorpus(
  JSON.parse(readFileSync(new URL('../content/integrations/wso2-context-compiler-corpus.json', import.meta.url), 'utf8')),
)

function envelope(): string {
  return Buffer.from(JSON.stringify({
    model: 'm',
    messages: [
      { role: 'system', content: `x\n\n${WSO2_CONTEXT_PLACEHOLDER}` },
      { role: 'user', content: CORPUS.workloads[0].request.task },
    ],
    [WSO2_CONTEXT_EXTENSION]: CORPUS.workloads[0].request,
  }), 'utf8').toString('base64')
}

const context = { requestId: 'r', apiName: 'a', apiVersion: 'v1', method: 'POST', path: '/v1/chat/completions' }

test('a bad credential fails closed: directRespond, 401, and the token stripped', () => {
  for (const [label, sent] of [
    ['under-length', 'too-short-to-be-a-secret'],
    ['wrong value', 'x'.repeat(SECRET.length)],
    ['absent', undefined],
  ] as const) {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (sent) headers[WSO2_INTERCEPTOR_TOKEN_HEADER] = sent
    const result = handleWso2ContextRequest({ requestHeaders: headers, requestBody: envelope(), invocationContext: context }, SECRET)

    assert.equal(result.directRespond, true, `${label}: WSO2 must stop the request, not forward it`)
    assert.equal(result.responseCode, 401, `${label}: refusal must be a 401`)
    // The gateway-only credential must never reach the provider, even on refusal.
    assert.ok(result.headersToRemove?.includes(WSO2_INTERCEPTOR_TOKEN_HEADER), `${label}: token must be stripped`)
    // A stale content-length on a replaced body is how a proxy truncates or hangs.
    assert.ok(result.headersToRemove?.includes('content-length'), `${label}: content-length must be recalculated`)
  }
})

test('a refusal body is never mistakable for a compiled request', () => {
  const result = handleWso2ContextRequest({
    requestHeaders: { 'content-type': 'application/json', [WSO2_INTERCEPTOR_TOKEN_HEADER]: 'wrong' },
    requestBody: envelope(),
    invocationContext: context,
  }, SECRET)
  const body = JSON.parse(Buffer.from(result.body!, 'base64').toString('utf8')) as Record<string, unknown>
  assert.ok(body.error, 'a refusal carries an error')
  assert.equal(body.messages, undefined, 'and carries no messages a provider could answer')
  // Both together: directRespond stops it, and the shape could not be answered
  // even if something forwarded it anyway.
  assert.equal(result.directRespond, true)
})

test('a compiled request forwards messages and no maha_context', () => {
  const result = handleWso2ContextRequest({
    requestHeaders: { 'content-type': 'application/json', [WSO2_INTERCEPTOR_TOKEN_HEADER]: SECRET },
    requestBody: envelope(),
    invocationContext: context,
  }, SECRET)
  assert.equal(result.directRespond, undefined)
  const body = JSON.parse(Buffer.from(result.body!, 'base64').toString('utf8')) as Record<string, unknown>
  assert.ok(Array.isArray(body.messages))
  assert.equal(body[WSO2_CONTEXT_EXTENSION], undefined, 'the extension must not reach the provider')
  assert.equal(JSON.stringify(body.messages).includes(WSO2_CONTEXT_PLACEHOLDER), false, 'the placeholder must be replaced')
  assert.equal(result.headersToAdd, undefined, 'response evidence must not leak upstream')
  const response = handleWso2ContextResponse({ interceptorContext: result.interceptorContext }, SECRET)
  assert.match(response.headersToAdd?.['x-maha-context-input-hash'] ?? '', /^sha256:/)
})

// --- The gateway must be the thing that compiles ----------------------------

test('the live Maha request carries maha_context untouched, so WSO2 does the compiling', async () => {
  // The defect this pins: the runner used to compile locally and send the
  // rewritten body, so the gateway's interceptor policy received an
  // already-compiled request and had nothing to do. The evaluation measured
  // this process and reported it as the gateway.
  //
  // Read from source because the live body is assembled inside a paid path.
  // A test that had to spend $0.005 to check this would not be run.
  const runner = readFileSync(new URL('../scripts/run-wso2-three-path-evaluation.ts', import.meta.url), 'utf8')

  // The live branch returns the envelope, and the envelope is the thing that
  // still carries the extension key.
  const liveBranch = runner.slice(runner.indexOf("if (mode === 'live')"), runner.indexOf("const result = handleWso2ContextRequest"))
  assert.match(liveBranch, /providerBody: envelope/, 'the live path must send the untouched envelope')
  assert.match(liveBranch, /compiledInGateway: true/, 'and must record that the gateway compiled it')
  assert.ok(
    !liveBranch.includes('handleWso2ContextRequest'),
    'the live path must not call the interceptor in-process',
  )

  // The local compile survives, but only for the non-executing modes.
  assert.match(runner, /prepare\(workload, call\.path, MOCK_INTERCEPTOR_SECRET, 'measure'\)/)
  assert.match(runner, /prepare\(workload, call\.path, secret, 'live'\)/)
})

test('the envelope sent live still contains the extension the gateway acts on', () => {
  // If the extension key were stripped before sending, the gateway's policy
  // would have nothing to trigger on and the path would silently degrade to
  // baseline while still being labelled as Maha.
  const runner = readFileSync(new URL('../scripts/run-wso2-three-path-evaluation.ts', import.meta.url), 'utf8')
  const envelopeBlock = runner.slice(runner.indexOf('const envelope = {'), runner.indexOf("if (mode === 'live')"))
  assert.match(envelopeBlock, /\[WSO2_CONTEXT_EXTENSION\]: workload\.request/)
  assert.match(envelopeBlock, /WSO2_CONTEXT_PLACEHOLDER/, 'and the placeholder the interceptor replaces')
})

test('every gateway API artifact is deployable and free of secrets', () => {
  const dir = new URL('../content/integrations/wso2-apis/', import.meta.url).pathname
  const files = readdirSync(dir).filter((file) => file.endsWith('.json'))
  assert.equal(files.length, 3, 'one artifact per evaluation path')

  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8')
    const artifact = JSON.parse(text) as {
      kind?: string
      metadata?: { name?: string }
      spec?: { context?: string; provider?: { id?: string }; policies?: { name?: string; version?: string; paths?: { path?: string; methods?: string[]; params?: Record<string, unknown> }[] }[] }
    }
    assert.equal(artifact.kind, 'LlmProxy', `${file}: the entity is an LlmProxy, not an API`)
    assert.ok(artifact.metadata?.name, `${file} needs metadata.name`)
    assert.ok(artifact.spec?.context, `${file} needs spec.context -- that is the routing field`)
    assert.ok(artifact.spec?.provider?.id, `${file} needs a provider`)

    assert.ok(!/sk-ant|Bearer\s+\S+/.test(text), `${file} must contain no credential`)
    assert.ok(!text.includes('<maha-preview-deployment>'), `${file} must contain no placeholder endpoint`)

    for (const policy of artifact.spec?.policies ?? []) {
      assert.match(policy.version ?? '', /^v\d+$/, `${file}: operation policies attach by major version only`)
      // The defect that cost the most time: parameters as a sibling of `name`
      // are accepted and silently dropped, so the policy deploys at its
      // default and reports success. They belong at paths[].params.
      assert.ok(
        Array.isArray(policy.paths) && policy.paths.length > 0,
        `${file}: policy ${policy.name} must carry paths[] -- parameters live there`,
      )
      for (const entry of policy.paths ?? []) {
        assert.ok(entry.params, `${file}: policy ${policy.name} must supply paths[].params`)
        assert.equal(entry.path, '/v1/chat/completions', `${file}: policy must bind the evaluated operation exactly`)
        assert.deepEqual(entry.methods, ['POST'], `${file}: policy must bind POST only`)
      }
      assert.ok(
        !Object.hasOwn(policy as object, 'params') && !Object.hasOwn(policy as object, 'parameters'),
        `${file}: policy ${policy.name} has parameters as a sibling of name; the gateway ignores them there`,
      )
    }
  }
})

test('the compressor artifact pins the ratio the evaluation was designed around', () => {
  const artifact = JSON.parse(
    readFileSync(new URL('../content/integrations/wso2-apis/native-compressor.json', import.meta.url), 'utf8'),
  ) as { spec: { policies: { name: string; version: string; paths: { params: { rules: { upperTokenLimit: number; type: string; value: number }[] } }[] }[] } }

  const policy = artifact.spec.policies[0]
  assert.equal(policy.name, 'prompt-compressor', 'the deployed policy name, not promptCompressor')
  assert.equal(policy.version, 'v0', 'WSO2 operation attachments accept major versions only')

  const rules = policy.paths[0].params.rules
  // A -1 catch-all is required by the policy schema; without it the rule set is
  // rejected and the compressor falls back to its default.
  assert.ok(rules.some((rule) => rule.upperTokenLimit === -1), 'a -1 catch-all rule is required')
  assert.deepEqual(rules[0], { upperTokenLimit: -1, type: 'ratio', value: 0.55 })
})

test('the Maha artifact configures fail-closed request and response phases', () => {
  const artifact = JSON.parse(
    readFileSync(new URL('../content/integrations/wso2-apis/maha-compiler.json', import.meta.url), 'utf8'),
  ) as { spec: { policies: { version: string; paths: { params: { request?: Record<string, unknown>; response?: Record<string, unknown> } }[] }[] } }
  const policy = artifact.spec.policies[0]
  const params = policy.paths[0].params
  assert.equal(policy.version, 'v1')
  assert.equal(params.request?.passthroughOnError, false)
  assert.equal(params.response?.passthroughOnError, false)
  assert.equal(params.response?.includeRequestBody, false)
  assert.equal(params.response?.includeResponseBody, false)
})

test('the evaluation runner parses, because tsconfig excludes scripts/', async () => {
  // tsconfig excludes scripts/, so `npm run typecheck` never sees this file.
  // A duplicate const declaration therefore reached the operator as a runtime
  // SyntaxError after they had already started a gateway and exported a
  // secret. Importing it here is the cheapest way to make the test suite cover
  // what the type checker does not.
  //
  // Import only: the module runs nothing unless invoked as the entry point,
  // and every paid path is behind --execute.
  await assert.doesNotReject(
    () => import('../scripts/run-wso2-three-path-evaluation.ts'),
    'the runner must at least parse and load',
  )
})
