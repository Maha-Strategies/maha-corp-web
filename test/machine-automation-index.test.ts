import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import claimsData from '../lib/atlas/generated-claims.json' with { type: 'json' }
import { buildLlmsManifest } from '../lib/llms-manifest.ts'
import { MCP_PUBLIC_MANIFEST_VERSION, mcpPublicManifest } from '../lib/mcp-public-manifest.ts'
import { MCP_TOOLS } from '../lib/maha-mcp/index.ts'
import { MPS_PREFLIGHT_MCP_SERVER, MPS_PREFLIGHT_MCP_TOOL } from '../lib/mps-preflight-mcp.ts'
import type { MpsClaim } from '../scripts/expand-graph.ts'

const root = new URL('../', import.meta.url)

test('mcp.json is a bounded catalog of the callable and source-available tools that actually exist', () => {
  assert.equal(mcpPublicManifest.schemaVersion, MCP_PUBLIC_MANIFEST_VERSION)
  assert.equal(mcpPublicManifest.canonicalUrl, 'https://www.mahastrategies.com/mcp.json')
  assert.equal(mcpPublicManifest.summary.servers, 2)
  assert.equal(mcpPublicManifest.summary.tools, 6)
  assert.equal(mcpPublicManifest.summary.callablePublicTools, 1)
  assert.equal(mcpPublicManifest.summary.sourceAvailablePackageTools, 5)

  const publicServer = mcpPublicManifest.servers.find((server) => server.id === MPS_PREFLIGHT_MCP_SERVER.name)
  assert.equal(publicServer?.status, 'available-public-rate-limited')
  assert.equal(publicServer?.transport.type, 'streamable-http')
  assert.deepEqual(publicServer?.tools.map((tool) => tool.name), [MPS_PREFLIGHT_MCP_TOOL.name])

  const localServer = mcpPublicManifest.servers.find((server) => server.id === 'maha-context-control')
  assert.equal(localServer?.status, 'source-available-package-not-published')
  assert.equal(localServer?.transport.type, 'local-stdio')
  assert.deepEqual(localServer?.tools.map((tool) => tool.name), MCP_TOOLS.map((tool) => tool.name))

  const serialized = JSON.stringify(mcpPublicManifest)
  assert.match(serialized, /noImpliedAuthority/)
  assert.match(serialized, /package-not-published/)
  for (const forbidden of ['deploy.', 'payment.', 'outreach.', 'publish_canonical', 'delete.']) {
    assert.equal(mcpPublicManifest.servers.some((server) => server.tools.some((tool) => tool.name.includes(forbidden))), false)
  }
})

test('the public MCP preflight and the root manifest share one tool contract', async () => {
  const route = await readFile(new URL('app/api/mcp/mps-preflight/route.ts', root), 'utf8')
  assert.match(route, /import \{ MPS_PREFLIGHT_MCP_PROTOCOL_VERSION, MPS_PREFLIGHT_MCP_SERVER, MPS_PREFLIGHT_MCP_TOOL \}/)
  assert.match(route, /const tool = MPS_PREFLIGHT_MCP_TOOL/)
  assert.match(route, /serverInfo: MPS_PREFLIGHT_MCP_SERVER/)
  assert.doesNotMatch(route, /name: 'mps_claim_preflight'/)
})

test('llms.txt is the automation index and points to every principal discovery surface', () => {
  const llms = buildLlmsManifest(claimsData as MpsClaim[])
  assert.match(llms, /^# Maha Strategies Machine-Readable Index/m)
  for (const url of [
    'https://www.mahastrategies.com/mcp.json',
    'https://www.mahastrategies.com/api/mcp/mps-preflight',
    'https://www.mahastrategies.com/maha-machine-readable-registry.json',
    'https://www.mahastrategies.com/knowledge/quantum-systems/registry',
    'https://www.mahastrategies.com/knowledge/synthetic-biology/registry',
  ]) assert.ok(llms.includes(url), `llms.txt is missing ${url}`)
  assert.match(llms, /npm package is not published/i)
  assert.match(llms, /No manifest entry grants authority/i)
})

test('machine discovery routes are static, linked, and self-described', async () => {
  const [route, llmsRoute, layout, registry, schema] = await Promise.all([
    readFile(new URL('app/mcp.json/route.ts', root), 'utf8'),
    readFile(new URL('app/llms.txt/route.ts', root), 'utf8'),
    readFile(new URL('app/layout.tsx', root), 'utf8'),
    readFile(new URL('public/maha-machine-readable-registry.json', root), 'utf8'),
    readFile(new URL('public/schemas/mcp-tool-manifest-0.1.json', root), 'utf8'),
  ])
  assert.match(route, /dynamic = 'force-static'/)
  assert.match(route, /mcpPublicManifest/)
  assert.match(route, /<\/llms\.txt>/)
  assert.match(llmsRoute, /<\/mcp\.json>/)
  assert.match(layout, /type="application\/json"[^>]+href="\/mcp\.json"/)

  const registryDocument = JSON.parse(registry) as { resources: Array<{ id: string; url: string; schemas?: string[] }> }
  const entry = registryDocument.resources.find((resource) => resource.id === 'mcp-tool-manifest')
  assert.equal(entry?.url, 'https://www.mahastrategies.com/mcp.json')
  assert.deepEqual(entry?.schemas, ['https://www.mahastrategies.com/schemas/mcp-tool-manifest-0.1.json'])

  const schemaDocument = JSON.parse(schema) as { $id: string; properties: { schemaVersion: { const: string } } }
  assert.equal(schemaDocument.$id, mcpPublicManifest.$schema)
  assert.equal(schemaDocument.properties.schemaVersion.const, MCP_PUBLIC_MANIFEST_VERSION)
})
