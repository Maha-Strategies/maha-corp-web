import assert from 'node:assert/strict'

import workload from '../content/integrations/wso2-context-compiler-workload.json' with { type: 'json' }
import {
  WSO2_CONTEXT_EXTENSION,
  WSO2_CONTEXT_PLACEHOLDER,
  WSO2_INTERCEPTOR_TOKEN_HEADER,
  handleWso2ContextRequest,
} from '../lib/integrations/wso2-context-interceptor.ts'

const secret = 'bounded-evaluation-only-secret-0001'
const openAiRequest = {
  model: 'evaluation-model',
  stream: false,
  messages: [
    { role: 'system', content: `Use only the source-linked evidence below.\n\n${WSO2_CONTEXT_PLACEHOLDER}` },
    { role: 'user', content: workload.request.task },
  ],
  [WSO2_CONTEXT_EXTENSION]: workload.request,
}

const result = handleWso2ContextRequest({
  requestHeaders: {
    'content-type': 'application/json',
    [WSO2_INTERCEPTOR_TOKEN_HEADER]: secret,
  },
  requestBody: Buffer.from(JSON.stringify(openAiRequest), 'utf8').toString('base64'),
  invocationContext: {
    requestId: 'wso2-bounded-evaluation',
    apiName: 'Maha-Context-Evaluation',
    apiVersion: 'v1.0',
    method: 'POST',
    path: '/v1/chat/completions',
  },
}, secret)

assert.equal(result.directRespond, undefined)
assert.ok(result.body)
assert.ok(result.headersToAdd)
assert.ok(result.interceptorContext)

const rewritten = JSON.parse(Buffer.from(result.body, 'base64').toString('utf8')) as Record<string, unknown>
assert.equal(rewritten[WSO2_CONTEXT_EXTENSION], undefined)
const rendered = JSON.stringify(rewritten.messages)
assert.equal(rendered.includes(WSO2_CONTEXT_PLACEHOLDER), false)
for (const fact of workload.requiredFacts) assert.match(rendered.toLowerCase(), new RegExp(fact.toLowerCase().replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')))

const report = {
  evaluation: workload.name,
  contract: 'WSO2 Interceptor Service request phase v1',
  result: 'pass',
  requiredFactsRetained: workload.requiredFacts.length,
  requiredFactsTotal: workload.requiredFacts.length,
  metrics: {
    originalEstimatedTokens: Number(result.headersToAdd['x-maha-original-estimated-tokens']),
    compiledEstimatedTokens: Number(result.headersToAdd['x-maha-compiled-estimated-tokens']),
    tokensSaved: Number(result.headersToAdd['x-maha-saved-estimated-tokens']),
    estimatedReductionPercent: Number(result.headersToAdd['x-maha-estimated-reduction-percent']),
    sourceCoveragePercent: Number(result.headersToAdd['x-maha-source-coverage-percent']),
    includedPassageCount: Number(result.headersToAdd['x-maha-included-passage-count']),
  },
  evidence: {
    packId: result.headersToAdd['x-maha-context-pack-id'],
    inputHash: result.headersToAdd['x-maha-context-input-hash'],
    outputHash: result.headersToAdd['x-maha-context-output-hash'],
    sourceTextStored: false,
    compiledContextStored: false,
  },
  boundaries: [
    'Model-neutral token estimates are not provider billing counts.',
    'The compiler ranks and deduplicates text; it does not verify claims or guarantee completeness.',
    'This local contract test does not measure WSO2 network overhead or compare WSO2 native compression.',
  ],
}

console.log(JSON.stringify(report, null, 2))
