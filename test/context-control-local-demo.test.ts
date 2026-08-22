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

test('the local Context Control demo has two useful, no-secret success outcomes', async () => {
  const [request, gateway] = await Promise.all([
    callMcpTool('context_control.validate_request', { body: LOCAL_DEMO_REQUEST }),
    callMcpTool('context_control.gateway_status', { gateway: LOCAL_DEMO_EXPECTATIONS.gateway }, { root: process.cwd() }),
  ])

  assert.equal(request.ok, true)
  assert.equal(gateway.ok, true)
  const requestResult = request.ok ? request.result as { outcome?: string } : undefined
  const gatewayResult = gateway.ok ? gateway.result as { status?: string } : undefined
  assert.equal(isSuccessfulLocalDemo({ request: requestResult, gateway: gatewayResult }), true)
})
