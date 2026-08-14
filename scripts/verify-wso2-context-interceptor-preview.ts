import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

import workload from '../content/integrations/wso2-context-compiler-workload.json' with { type: 'json' }
import {
  WSO2_CONTEXT_EXTENSION,
  WSO2_CONTEXT_PLACEHOLDER,
  WSO2_INTERCEPTOR_TOKEN_HEADER,
} from '../lib/integrations/wso2-context-interceptor.ts'

function option(name: string): string | null {
  const prefix = `${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null
}

async function readSecret(): Promise<string> {
  let value = ''
  for await (const chunk of process.stdin) value += String(chunk)
  const secret = value.trim()
  if (secret.length < 32) throw new Error('A WSO2 interceptor secret of at least 32 characters is required on stdin.')
  return secret
}

function runVercelCurl(deployment: string, envelope: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('vercel', [
      'curl',
      '/api/integrations/wso2/context-compiler/handle-request',
      '--deployment', deployment,
      '--',
      '--silent',
      '--show-error',
      '--request', 'POST',
      '--header', 'content-type: application/json',
      '--data-binary', '@-',
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`vercel curl failed (${code ?? 'unknown'}): ${stderr.trim()}`))
    })
    child.stdin.end(JSON.stringify(envelope))
  })
}

const deployment = option('--url')
if (!deployment || !/^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/i.test(deployment)) {
  throw new Error('Pass the exact Vercel Preview URL as --url=https://...vercel.app')
}

const secret = await readSecret()
const upstreamBody = {
  model: 'bounded-evaluation-model',
  messages: [
    { role: 'system', content: `Use only the source-linked evidence below.\n\n${WSO2_CONTEXT_PLACEHOLDER}` },
    { role: 'user', content: workload.request.task },
  ],
  [WSO2_CONTEXT_EXTENSION]: workload.request,
}
const envelope = {
  requestHeaders: {
    'content-type': 'application/json',
    [WSO2_INTERCEPTOR_TOKEN_HEADER]: secret,
  },
  requestBody: Buffer.from(JSON.stringify(upstreamBody), 'utf8').toString('base64'),
  invocationContext: { requestId: 'wso2-live-preview-evaluation' },
}

const raw = await runVercelCurl(deployment, envelope)
const response = JSON.parse(raw) as {
  body?: string
  directRespond?: boolean
  responseCode?: number
  headersToAdd?: Record<string, string>
  headersToRemove?: string[]
  interceptorContext?: Record<string, string>
}
if (response.directRespond) {
  const decodedError = response.body
    ? Buffer.from(response.body, 'base64').toString('utf8')
    : 'No response body.'
  throw new Error(`Live interceptor rejected the request (${response.responseCode ?? 'unknown'}): ${decodedError}`)
}
assert.ok(response.body)
assert.equal(response.headersToRemove?.includes(WSO2_INTERCEPTOR_TOKEN_HEADER), true)
assert.equal(response.headersToRemove?.includes('content-length'), true)
assert.equal(response.headersToAdd?.['x-maha-zero-data-retention'], 'true')

const rewritten = JSON.parse(Buffer.from(response.body, 'base64').toString('utf8')) as Record<string, unknown>
const rendered = JSON.stringify(rewritten)
assert.equal(rendered.includes(WSO2_CONTEXT_EXTENSION), false)
assert.equal(rendered.includes(WSO2_CONTEXT_PLACEHOLDER), false)
for (const fact of workload.requiredFacts) assert.ok(rendered.includes(fact.text), `Missing required fact: ${fact.id}`)

console.log(JSON.stringify({
  status: 'pass',
  deployment,
  contract: 'WSO2 Interceptor Service request phase v1',
  requiredFactsRetained: workload.requiredFacts.length,
  requiredFactsTotal: workload.requiredFacts.length,
  evidence: response.interceptorContext,
  credentialRemoved: true,
  sourceTextStored: false,
  note: 'This verifies the live Vercel Preview adapter. It does not claim that a WSO2 gateway invoked it.',
}, null, 2))
