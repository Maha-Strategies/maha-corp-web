import assert from 'node:assert/strict'
import test from 'node:test'
import { LOCAL_DEMO_EXPECTATIONS, LOCAL_DEMO_REQUEST, isSuccessfulLocalDemo } from '../lib/context-control-local-demo.ts'
import { callMcpTool } from '../lib/maha-mcp/index.ts'

test('the local Context Control demo uses only a synthetic bounded envelope', () => {
  assert.equal(LOCAL_DEMO_REQUEST.model, 'synthetic-evaluation-model')
  assert.equal(LOCAL_DEMO_REQUEST.maha_context.tokenBudget, 512)
  assert.equal(LOCAL_DEMO_REQUEST.maha_context.documents.length, 1)
  assert.match(LOCAL_DEMO_REQUEST.maha_context.documents[0].text, /No customer or production source text/)
})

test('the local Context Control demo has three useful, no-secret success outcomes', async () => {
  const evidence = JSON.parse(await readFile(new URL('../fixtures/context-control-local-demo/evidence.json', import.meta.url), 'utf8'))
  const [request, gateway, verified] = await Promise.all([
    callMcpTool('context_control.validate_request', { body: LOCAL_DEMO_REQUEST }),
    callMcpTool('context_control.gateway_status', { gateway: LOCAL_DEMO_EXPECTATIONS.gateway }, { root: process.cwd() }),
    callMcpTool('context_control.verify_evidence', { evidence }),
  ])

  assert.equal(request.ok, true)
  assert.equal(gateway.ok, true)
  assert.equal(verified.ok, true)
  const requestResult = request.ok ? request.result as { outcome?: string } : undefined
  const gatewayResult = gateway.ok ? gateway.result as { status?: string } : undefined
  const evidenceResult = verified.ok ? verified.result as { status?: string; findings?: unknown[] } : undefined
  assert.equal(isSuccessfulLocalDemo({ request: requestResult, gateway: gatewayResult, evidence: evidenceResult }), true)
})
import { readFile } from 'node:fs/promises'
