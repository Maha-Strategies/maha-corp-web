import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { doctor, gatewayValidate, verify, GATEWAY_NAMES } from '../lib/context-control-cli/index.ts'
import { MCP_TOOLS, callMcpTool, mcpManifest, EVIDENCE_BOUNDARY } from '../lib/maha-mcp/index.ts'
import { a2aAgentCard, handleA2ATask, resetA2AReplayMemory } from '../lib/maha-a2a/index.ts'
import { mcpCredentialArgumentFields } from '../lib/maha-mcp-server/index.ts'

const ROOT = join(import.meta.dirname, '..')
const PACKAGES = ['context-control-core', 'context-control-cli', 'maha-mcp', 'maha-a2a'] as const
const manifestOf = (name: string) => JSON.parse(readFileSync(join(ROOT, 'packages', name, 'package.json'), 'utf8'))

test('every package declares the metadata a consumer needs', () => {
  for (const name of PACKAGES) {
    const pkg = manifestOf(name)
    assert.match(pkg.name, /^@mahastrategies\//)
    assert.equal(pkg.version, '0.1.0', 'prerelease version expected')
    assert.equal(pkg.license, 'MIT')
    assert.ok(pkg.repository?.url?.includes('github.com'), `${name} has no repository URL`)
    assert.equal(pkg.repository.directory, `packages/${name}`)
    assert.ok(pkg.bugs?.url, `${name} has no bugs URL`)
    assert.ok(pkg.homepage, `${name} has no homepage`)
    assert.deepEqual(pkg.files.slice(0, 3), ['dist', 'README.md', 'LICENSE'], `${name} has no files allowlist`)
    assert.ok(pkg.types?.endsWith('.d.ts'), `${name} publishes no declarations`)
    assert.ok(pkg.exports?.['.'], `${name} has no export map`)
    assert.equal(pkg.scripts.prepack, 'npm run build', `${name} would pack a stale dist`)
  }
})

test('each package ships a README and a licence', () => {
  for (const name of PACKAGES) {
    for (const file of ['README.md', 'LICENSE']) {
      assert.ok(existsSync(join(ROOT, 'packages', name, file)), `packages/${name}/${file} is missing`)
    }
  }
})

test('the export surface is narrow and intentional', () => {
  // A package that re-exports everything is a package nobody can version.
  const core = readFileSync(join(ROOT, 'lib/context-control-core/index.ts'), 'utf8')
  assert.ok(!/export \* from/.test(core), 'the core package uses a wildcard re-export')
})

/** The gate/contract split exists so a client library never carries the compiler. */
test('the core package does not reach the Context Compiler at runtime', () => {
  const gate = readFileSync(join(ROOT, 'lib/integrations/gateway-context-gate.ts'), 'utf8')
  assert.ok(!/from '\.\.\/context-compiler/.test(gate), 'the gate imports the compiler')
  const built = join(ROOT, 'packages/context-control-core/dist/integrations/gateway-context-gate.js')
  if (existsSync(built)) {
    assert.ok(!readFileSync(built, 'utf8').includes('context-compiler'), 'the built core reaches the compiler')
  }
})

test('doctor fails closed on missing configuration and never prints a secret', () => {
  const empty = doctor({} as unknown as NodeJS.ProcessEnv)
  assert.equal(empty.status, 'incomplete')
  assert.ok(empty.findings.some((finding) => finding.check === 'interceptor-secret' && finding.status === 'fail'))

  const secret = 'z'.repeat(48)
  const healthy = doctor({
    MAHA_CONTEXT_INTERCEPTOR_SECRET: secret,
    MAHA_COMPILER_URL: 'https://example.invalid/api/integrations/gateway/context-compiler',
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(healthy.status, 'ok')
  assert.ok(!JSON.stringify(healthy).includes(secret), 'doctor leaked the secret')
  assert.ok(JSON.stringify(healthy).includes('[redacted]'))
})

test('doctor refuses a plaintext non-local endpoint', () => {
  const report = doctor({
    MAHA_CONTEXT_INTERCEPTOR_SECRET: 'z'.repeat(48),
    MAHA_COMPILER_URL: 'http://compiler.example.com/compile',
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(report.status, 'incomplete')
  assert.ok(report.findings.some((finding) => finding.check === 'compiler-endpoint' && finding.status === 'fail'))
})

test('verify separates what it can check from what it must trust', () => {
  const evidence = {
    contractVersion: '1.0.0', policyVersion: '2026-08-16', outcome: 'compiled',
    headers: {
      'x-maha-compiled': 'true',
      'x-maha-input-hash': `sha256:${'a'.repeat(64)}`,
      'x-maha-output-hash': `sha256:${'b'.repeat(64)}`,
      'x-maha-token-budget': '800', 'x-maha-retained-passages': '12',
      'x-maha-source-coverage-bps': '9000', 'x-maha-policy-version': '2026-08-16',
    },
    sourceTextRetained: false, credentialsRetained: false,
  }
  const report = verify(evidence)
  assert.equal(report.status, 'ok')
  const passthrough = report.findings.filter((finding) => finding.verifiable === 'trusted-passthrough')
  assert.ok(passthrough.length > 0, 'verify claims to check something it cannot')
  assert.ok(passthrough.some((finding) => finding.check === 'hash-binding'))
})

test('verify rejects malformed hashes, out-of-range coverage and inconsistent state', () => {
  const base = {
    contractVersion: '1.0.0', policyVersion: '2026-08-16', outcome: 'compiled',
    headers: {
      'x-maha-compiled': 'true',
      'x-maha-input-hash': `sha256:${'a'.repeat(64)}`,
      'x-maha-output-hash': `sha256:${'b'.repeat(64)}`,
      'x-maha-token-budget': '800', 'x-maha-retained-passages': '12',
      'x-maha-source-coverage-bps': '9000', 'x-maha-policy-version': '2026-08-16',
    },
    sourceTextRetained: false, credentialsRetained: false,
  }
  const cases: Record<string, unknown>[] = [
    { ...base, headers: { ...base.headers, 'x-maha-input-hash': 'nope' } },
    { ...base, headers: { ...base.headers, 'x-maha-source-coverage-bps': '10001' } },
    { ...base, policyVersion: '1999-01-01' },
    { ...base, sourceTextRetained: true },
    { ...base, outcome: 'passthrough' }, // claims compiled headers on a passthrough
  ]
  for (const candidate of cases) assert.equal(verify(candidate).status, 'invalid', JSON.stringify(candidate).slice(0, 60))
  assert.equal(verify('not an object').status, 'invalid')
})

test('gateway validate is static and covers all four adapters', () => {
  for (const gateway of GATEWAY_NAMES) {
    const report = gatewayValidate(gateway, ROOT)
    assert.equal(report.status, 'ok', `${gateway}: ${JSON.stringify(report.checks.filter((c) => c.status === 'fail'))}`)
  }
})

test('the MCP surface exposes exactly five read-only-by-default tools', () => {
  assert.equal(MCP_TOOLS.length, 5)
  assert.deepEqual(MCP_TOOLS.map((tool) => tool.name), [
    'context_control.describe',
    'context_control.validate_request',
    'context_control.compile_sanitized',
    'context_control.verify_evidence',
    'context_control.gateway_status',
  ])
  for (const tool of MCP_TOOLS) {
    assert.equal(tool.inputSchema.type, 'object')
    assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} accepts unknown properties`)
  }
})

/** Absent, not hidden. A hidden dangerous tool is one flag from being live. */
test('no deploying, paying or provider-calling tool exists in the surface', () => {
  const source = readFileSync(join(ROOT, 'lib/maha-mcp/index.ts'), 'utf8')
  for (const forbidden of ['deploy', 'publish', 'pay', 'settle', 'x402', 'wallet', 'provision', 'register_server']) {
    assert.ok(!MCP_TOOLS.some((tool) => tool.name.includes(forbidden)), `a ${forbidden} tool is exposed`)
  }
  assert.ok(!/fetch\(\s*['"`]https?:\/\//.test(source), 'the MCP module hardcodes an outbound URL')
})

test('no MCP tool accepts a credential, whatever the schema says', async () => {
  for (const key of ['secret', 'apiKey', 'api_key', 'token', 'authorization', 'password', 'credential']) {
    const result = await callMcpTool('context_control.describe', { [key]: 'value' })
    assert.equal(result.ok, false)
    if (result.ok) continue
    assert.equal(result.error.code, 'credential_rejected')
  }
})

test('the MCP transport permits only literal false retention declarations', () => {
  assert.deepEqual(mcpCredentialArgumentFields({ evidence: { credentialsRetained: false, credentialsAccepted: false } }), [])
  for (const value of [true, 'not-a-real-value', {}, []]) {
    assert.deepEqual(mcpCredentialArgumentFields({ evidence: { credentialsRetained: value } }), ['arguments.evidence.credentialsRetained'])
  }
  assert.deepEqual(mcpCredentialArgumentFields({ evidence: { apiKey: 'not-a-real-value' } }), ['arguments.evidence.apiKey'])
})

test('every MCP response declares its evidence boundary', async () => {
  const describe = await callMcpTool('context_control.describe')
  assert.equal(describe.ok, true)
  assert.deepEqual(describe.boundary, EVIDENCE_BOUNDARY)
  assert.equal(EVIDENCE_BOUNDARY.providerCallsMade, 0)
  assert.equal(EVIDENCE_BOUNDARY.credentialsAccepted, false)
  assert.ok(EVIDENCE_BOUNDARY.limitations.length >= 3)

  const unknown = await callMcpTool('context_control.does_not_exist')
  assert.equal(unknown.ok, false)
  if (!unknown.ok) assert.equal(unknown.error.code, 'unknown_tool')
})

test('validate_request runs the real gate without needing a credential', async () => {
  const result = await callMcpTool('context_control.validate_request', {
    body: { messages: [{ role: 'system', content: 'x {{MAHA_CONTEXT_PACK}}' }], maha_context: { task: 't' } },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(['proceed', 'rejected', 'passthrough'].includes((result.result as { outcome: string }).outcome))

  const alreadyCompiled = await callMcpTool('context_control.validate_request', {
    body: { messages: [], maha_context: {} }, alreadyCompiled: true,
  })
  assert.equal(alreadyCompiled.ok, true)
  if (alreadyCompiled.ok) {
    assert.equal((alreadyCompiled.result as { reason: string }).reason, 'already_compiled')
  }
})

test('the MCP manifest is machine-readable and marks read-only tools', () => {
  const manifest = mcpManifest() as { tools: { name: string; inputSchema: unknown; annotations: { readOnlyHint: boolean } }[] }
  assert.equal(manifest.tools.length, 5)
  for (const tool of manifest.tools) {
    assert.ok(tool.inputSchema, `${tool.name} has no schema`)
    assert.equal(typeof tool.annotations.readOnlyHint, 'boolean')
  }
  assert.equal(manifest.tools.filter((tool) => tool.annotations.readOnlyHint).length, 4)
})

test('the A2A card declares its boundaries rather than omitting them', () => {
  const card = a2aAgentCard('https://example.invalid/a2a') as {
    skills: { id: string }[]
    boundaries: Record<string, unknown>
    capabilities: Record<string, unknown>
  }
  assert.equal(card.skills.length, 1, 'this is one bounded capability, not a framework')
  assert.equal(card.skills[0].id, 'maha.context-control.evaluate')
  for (const flag of ['payments', 'externalTaskCreation', 'documentRetention', 'credentialsAccepted', 'providerCalls']) {
    assert.equal(card.boundaries[flag], false, `${flag} must be declared false, not omitted`)
  }
})

test('an A2A task requires an explicit budget rather than inheriting a default', () => {
  resetA2AReplayMemory()
  const result = handleA2ATask({ taskId: 'task-1', request: { messages: [], maha_context: {} } })
  assert.equal(result.state, 'rejected')
  assert.equal(result.failure?.code, 'policy_required')
  assert.equal(result.policy.tokenBudget, null)
})

test('A2A makes replay, approval and failure state explicit', () => {
  resetA2AReplayMemory()
  const task = {
    taskId: 'task-replay',
    policy: { tokenBudget: 800 },
    request: {
      messages: [{ role: 'system', content: 'Use {{MAHA_CONTEXT_PACK}}' }],
      maha_context: { clientRequestId: 'abcdefgh', task: 'a question', tokenBudget: 800, documents: [{ id: 'd', text: 'text' }] },
    },
  }
  const first = handleA2ATask(task)
  assert.equal(first.replayed, false)
  assert.equal(first.approvalRequired, false)
  assert.equal(first.state, 'completed')

  const second = handleA2ATask(task)
  assert.equal(second.replayed, true, 'the same taskId was executed twice')
  assert.deepEqual(second.evidence, first.evidence)
})

test('A2A refuses credentials and retains no source document', () => {
  resetA2AReplayMemory()
  const rejected = handleA2ATask({ taskId: 't', policy: { tokenBudget: 100 }, apiKey: 'x', request: {} })
  assert.equal(rejected.state, 'rejected')
  assert.equal(rejected.failure?.code, 'credential_rejected')

  const ok = handleA2ATask({
    taskId: 't2', policy: { tokenBudget: 800 },
    request: {
      messages: [{ role: 'system', content: '{{MAHA_CONTEXT_PACK}}' }],
      maha_context: { clientRequestId: 'abcdefgh', task: 'q', tokenBudget: 800, documents: [{ id: 'd', text: 'SECRET-SOURCE-TEXT' }] },
    },
  })
  assert.equal(ok.boundaries.sourceDocumentsRetained, false)
  assert.equal(ok.boundaries.paymentsInitiated, false)
  assert.ok(!JSON.stringify(ok).includes('SECRET-SOURCE-TEXT'), 'the A2A result carries source text')
})
