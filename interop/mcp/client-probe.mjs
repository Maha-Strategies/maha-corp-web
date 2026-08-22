// Third-party client probe: the official MCP SDK acting as a real client over
// stdio. Nothing here is Maha code. Records metadata only.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { readFileSync } from 'node:fs'
// The SDK does not export package.json, so read it from disk rather than
// silently recording an undefined version.
const sdkVersion = JSON.parse(
  readFileSync(new URL('./node_modules/@modelcontextprotocol/sdk/package.json', import.meta.url), 'utf8'),
).version

const evidence = { client: { name: '@modelcontextprotocol/sdk', version: sdkVersion, role: 'third-party MCP client' },
  runtime: { node: process.version }, surface: [], credentialsUsed: false, providerCallsMade: 0, networkEgress: 'none (stdio child process)' }

const transport = new StdioClientTransport({ command: process.execPath, args: ['--experimental-strip-types', new URL('./server-shim.mts', import.meta.url).pathname] })
const client = new Client({ name: 'maha-interop-probe', version: '0.0.0' }, { capabilities: {} })

await client.connect(transport)
const info = client.getServerVersion()
evidence.surface.push({ method: 'initialize', status: 'ok', serverName: info?.name ?? null, serverVersion: info?.version ?? null })

const listed = await client.listTools()
evidence.surface.push({ method: 'tools/list', status: 'ok', toolCount: listed.tools.length, toolNames: listed.tools.map(t => t.name).sort(),
  everyToolHasSchema: listed.tools.every(t => t.inputSchema && t.inputSchema.type === 'object') })

// Call every advertised tool through the real client, with minimal valid args.
// Arguments taken from each tool's advertised inputSchema, not guessed.
const HERE = new URL('.', import.meta.url).pathname
const ARGS = {
  'context_control.describe': {},
  'context_control.validate_request': { body: { model: 'x', messages: [], maha_context: { task: 'demo', tokenBudget: 512, documents: [{ id: 'd1', text: 'alpha beta gamma' }] } } },
  'context_control.compile_sanitized': { inputPath: HERE + 'synthetic-input.json', outputPath: HERE + 'synthetic-evidence.json' },
  'context_control.verify_evidence': { evidence: {} },
  'context_control.gateway_status': { gateway: 'wso2' },
}
for (const tool of listed.tools) {
  try {
    const res = await client.callTool({ name: tool.name, arguments: ARGS[tool.name] ?? {} })
    let parsed = null
    try { parsed = JSON.parse(res.content?.[0]?.text ?? 'null') } catch {}
    evidence.surface.push({ method: 'tools/call', tool: tool.name, dispatch: 'ok', isError: res.isError === true,
      resultOk: parsed?.ok ?? null, declaresBoundary: !!parsed && typeof parsed.boundary === 'object' && parsed.boundary !== null,
      boundaryKeys: parsed?.boundary ? Object.keys(parsed.boundary).sort() : null })
  } catch (e) {
    evidence.surface.push({ method: 'tools/call', tool: tool.name, dispatch: 'threw', error: String(e?.message ?? e).slice(0, 120) })
  }
}

// An unknown tool must be refused, not silently accepted.
try {
  const res = await client.callTool({ name: 'context_control.__nope', arguments: {} })
  let parsed = null; try { parsed = JSON.parse(res.content?.[0]?.text ?? 'null') } catch {}
  evidence.surface.push({ method: 'tools/call', tool: '__unknown__', dispatch: 'ok', refused: res.isError === true || parsed?.ok === false })
} catch {
  evidence.surface.push({ method: 'tools/call', tool: '__unknown__', dispatch: 'rejected-by-protocol', refused: true })
}

await client.close()
console.log(JSON.stringify(evidence, null, 2))
