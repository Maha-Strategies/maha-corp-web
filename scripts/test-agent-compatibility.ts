import nextEnv from '@next/env'
import assert from 'node:assert/strict'

nextEnv.loadEnvConfig(process.cwd())

const baseUrl = process.env.TEST_API_URL ?? 'http://localhost:3000'
const apiKey = process.env.STAGING_API_KEY
const a2aCardUrl = process.env.TEST_A2A_AGENT_CARD_URL
const a2aToken = process.env.TEST_A2A_UPSTREAM_TOKEN
const mcpUrl = process.env.TEST_MCP_UPSTREAM_URL
const mcpToken = process.env.TEST_MCP_UPSTREAM_TOKEN
if (!apiKey || !a2aCardUrl || !a2aToken || !mcpUrl || !mcpToken) throw new Error('Set STAGING_API_KEY, TEST_A2A_AGENT_CARD_URL, TEST_A2A_UPSTREAM_TOKEN, TEST_MCP_UPSTREAM_URL and TEST_MCP_UPSTREAM_TOKEN.')

const request = async (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${apiKey}`)
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers.set('x-vercel-protection-bypass', process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
  return fetch(`${baseUrl}${path}`, { ...init, headers })
}

type JsonObject = Record<string, unknown>

function object(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const json = async (response: Response): Promise<JsonObject> => {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`)
  if (!object(body)) throw new Error(`HTTP ${response.status} returned a non-object JSON body.`)
  return body
}

const rpcBody = (id: string, method: string, params: Record<string, unknown>) => JSON.stringify({ jsonrpc: '2.0', id, method, params })

async function main() {
  console.log('Maha A2A + MCP compatibility proof')

  const mcp = await json(await request('/api/v1/mcp/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name: 'Compatibility MCP fixture', baseUrl: mcpUrl, authType: 'bearer', secret: mcpToken,
      allowedMethods: ['tools/list', 'tools/call'], allowedToolNames: ['calculateRiskScore'],
    }),
  }))
  const mcpId = typeof mcp.serverId === 'string' ? mcp.serverId : typeof mcp.id === 'string' ? mcp.id : ''
  assert.match(mcpId, /^mcp_srv_/)
  const mcpAllowed = await json(await request(`/api/v1/mcp/gateway/${mcpId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: rpcBody('mcp-allowed', 'tools/call', { name: 'calculateRiskScore', arguments: { portfolioId: 'compatibility-proof' } }),
  }))
  assert.equal(object(mcpAllowed.result) ? mcpAllowed.result.authenticated : undefined, true)
  const mcpBlocked = await request(`/api/v1/mcp/gateway/${mcpId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: rpcBody('mcp-blocked', 'tools/call', { name: 'admin.delete', arguments: {} }),
  })
  assert.equal(mcpBlocked.status, 403)
  console.log('1. MCP tool allowlist: PASS')

  const cardResponse = await fetch(a2aCardUrl)
  assert.equal(cardResponse.status, 200)
  const card = await cardResponse.json() as JsonObject
  const interfaces = Array.isArray(card.supportedInterfaces) ? card.supportedInterfaces.filter(object) : []
  const selectedInterface = interfaces.find((item) => String(item.protocolBinding).toUpperCase() === 'JSONRPC')
  const rpcUrl = typeof card.url === 'string' ? card.url : typeof selectedInterface?.url === 'string' ? selectedInterface.url : ''
  assert.match(rpcUrl, /^https:\/\//)
  const paymentPolicy = {
    schemaVersion: '1.0.0', policyId: 'policy:a2a:compatibility', policyVersion: '1', approvedSchemes: ['exact'],
    approvedResources: [rpcUrl], approvedPayees: ['0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'],
    assetRules: [{ network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', maxAmountPerCall: '1000', maxAmountPerTask: '5000' }],
    requireValidatedSchema: false, settlement: { requirePaymentResponse: true, requireOnchainConfirmation: false },
  }
  const registered = await json(await request('/api/v1/a2a/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name: 'Compatibility A2A fixture', agentCardUrl: a2aCardUrl, authType: 'bearer', secret: a2aToken,
      taskPolicy: { allowedMethods: ['message/send', 'tasks/get'], allowedTaskClasses: ['governance.echo'], maxTextBytes: 4_096 }, paymentPolicy,
    }),
  }))
  if (!object(registered.agent)) throw new Error('A2A registration returned no agent object.')
  const agentId = typeof registered.agent.id === 'string' ? registered.agent.id : ''
  const registeredPaymentPolicy = object(registered.agent.paymentPolicy) ? registered.agent.paymentPolicy : null
  assert.match(agentId, /^a2a_agt_/)
  assert.equal(registeredPaymentPolicy?.configured, true)
  assert.equal(JSON.stringify(registered).includes(a2aToken), false)

  const a2aHeaders = { 'Content-Type': 'application/json', 'X-Maha-Task-Class': 'governance.echo', 'A2A-Version': '0.3.0' }
  const message = (id: string, text: string) => rpcBody(id, 'message/send', { message: { messageId: `message-${id}-12345678`, role: 'user', parts: [{ kind: 'text', text }] } })
  const a2aAllowed = await json(await request(`/api/v1/a2a/gateway/${agentId}`, { method: 'POST', headers: a2aHeaders, body: message('allowed', 'Compatibility task') }))
  const a2aResult = object(a2aAllowed.result) ? a2aAllowed.result : null
  const a2aStatus = object(a2aResult?.status) ? a2aResult.status : null
  assert.equal(a2aStatus?.state, 'completed')
  const a2aBlocked = await request(`/api/v1/a2a/gateway/${agentId}`, { method: 'POST', headers: { ...a2aHeaders, 'X-Maha-Task-Class': 'payments.transfer' }, body: message('blocked', 'Do not forward') })
  assert.equal(a2aBlocked.status, 403)
  console.log('2. A2A Agent Card + task allowlist: PASS')

  const priced = await request(`/api/v1/a2a/gateway/${agentId}`, { method: 'POST', headers: a2aHeaders, body: message('priced', 'paid: policy preflight') })
  assert.equal(priced.status, 402)
  assert.ok(priced.headers.get('PAYMENT-REQUIRED'))
  const expensive = await request(`/api/v1/a2a/gateway/${agentId}`, { method: 'POST', headers: a2aHeaders, body: message('expensive', 'expensive: policy must block') })
  assert.equal(expensive.status, 403)
  console.log('3. x402 payment policy (allowed challenge + over-ceiling denial): PASS')
  console.log(`\nCompatibility proof complete: MCP=${mcpId} A2A=${agentId}`)
}

main().catch((error) => { console.error('\nCompatibility proof failed:', error); process.exit(1) })
