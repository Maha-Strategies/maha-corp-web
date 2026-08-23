/**
 * Run the shortest useful Context Control evaluation locally.
 *
 * Starts Maha's shipped MCP binary over stdio, then asks it to evaluate a
 * synthetic envelope, statically validate the WSO2 artifact, and structurally
 * verify a metadata-only synthetic evidence record. No credential, network
 * endpoint, provider, payment, or source document is involved.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

import { LOCAL_DEMO_EXPECTATIONS, LOCAL_DEMO_REQUEST, isSuccessfulLocalDemo } from '../lib/context-control-local-demo.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const binary = `${root}packages/maha-mcp-server/dist/maha-mcp-server/cli.js`
const evidencePath = `${root}fixtures/context-control-local-demo/evidence.json`

if (!existsSync(binary)) {
  process.stderr.write('Build the shipped MCP server first: npm --prefix packages/maha-mcp-server run build\n')
  process.exit(2)
}

const transport = new StdioClientTransport({ command: process.execPath, args: [binary] })
const client = new Client({ name: 'maha-context-control-local-demo', version: '0.1.0' }, { capabilities: {} })

function payload(response: { content?: Array<{ text?: string }> }): Record<string, unknown> {
  const text = response.content?.[0]?.text
  if (!text) throw new Error('The MCP response omitted its metadata payload.')
  const value = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The MCP response was not a JSON object.')
  return value as Record<string, unknown>
}

try {
  await client.connect(transport)
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'))
  const [requestResponse, gatewayResponse, evidenceResponse] = await Promise.all([
    client.callTool({ name: 'context_control.validate_request', arguments: { body: LOCAL_DEMO_REQUEST } }),
    client.callTool({ name: 'context_control.gateway_status', arguments: { gateway: LOCAL_DEMO_EXPECTATIONS.gateway } }),
    client.callTool({ name: 'context_control.verify_evidence', arguments: { evidence } }),
  ])

  const requestPayload = payload(requestResponse)
  const gatewayPayload = payload(gatewayResponse)
  const evidencePayload = payload(evidenceResponse)
  const result = {
    demo: 'maha-context-control-local-success-path',
    synthetic: true,
    sourceTextReturned: false,
    credentialsUsed: false,
    providerCallsMade: 0,
    paymentsInitiated: false,
    request: requestPayload.result,
    gateway: gatewayPayload.result,
    evidence: evidencePayload.result,
    boundaries: [requestPayload.boundary, gatewayPayload.boundary, evidencePayload.boundary],
  }

  if (!isSuccessfulLocalDemo(result)) {
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`)
    throw new Error('The local Context Control demo did not reach every expected success outcome.')
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  await client.close().catch(() => undefined)
}
