/**
 * The architect evaluation command.
 *
 * Starts both transports as real processes against sanitized fixtures and
 * checks the safe failure paths — the behaviours that matter more than the
 * happy path, because they are what a reviewer cannot verify from a README.
 *
 * Everything runs on this machine. MCP speaks stdio; A2A binds loopback. No
 * credential is read, no provider is contacted, and no payment is possible.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { A2A_CARD_PATH, A2A_TASKS_PATH, startMahaA2AServer } from '../lib/maha-a2a-server/index.ts'
import { createMahaMcpServer } from '../lib/maha-mcp-server/index.ts'
import { findCredentialFields, findUnboundedResponseStrings } from '../lib/maha-transport/boundary.ts'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const FIXTURES = `${HERE}../fixtures/transport-evaluation`

type Check = { name: string; expectation: string; pass: boolean; observed: string }
const checks: Check[] = []
const record = (name: string, expectation: string, pass: boolean, observed: string) => {
  checks.push({ name, expectation, pass, observed })
}

// ---------------------------------------------------------------- MCP (stdio)

async function evaluateMcp() {
  // The server is constructed in-process here only to confirm it builds a
  // handler table; the protocol-level run is the third-party harness in
  // interop/mcp, which drives the real binary over a real stdio process.
  const server = createMahaMcpServer()
  record('mcp.server.constructs', 'the shipped server object is constructible without configuration', server !== null, 'constructed')

  const binary = `${HERE}../packages/maha-mcp-server/dist/maha-mcp-server/cli.js`
  const refuses = await runProcess(binary, ['--api-key', 'not-a-real-value'])
  record('mcp.cli.refuses-credential-argument', 'exit 2 and no credential echoed',
    refuses.code === 2 && !refuses.stderr.includes('not-a-real-value'),
    `exit=${refuses.code}, echoed=${refuses.stderr.includes('not-a-real-value')}`)

  const help = await runProcess(binary, ['--help'])
  record('mcp.cli.help-on-stderr-only', 'stdout stays clean so it cannot corrupt the protocol stream',
    help.stdout.trim() === '' && help.stderr.length > 0, `stdout=${help.stdout.length}b stderr=${help.stderr.length}b`)
}

// -------------------------------------------------------------- A2A (loopback)

async function evaluateA2A() {
  const started = await startMahaA2AServer({ port: 0 })
  try {
    record('a2a.binds.loopback-only', 'the default bind address is loopback',
      started.host === '127.0.0.1', `bound ${started.host}:${started.port}`)

    const card = await getJson(`${started.baseUrl}${A2A_CARD_PATH}`)
    record('a2a.card.discoverable', 'the agent card is served at the well-known path',
      card.body?.protocolVersion === '0.2', `protocolVersion=${card.body?.protocolVersion}`)
    record('a2a.card.publishes-input-schema', 'a caller can build a task from the card alone',
      Array.isArray(card.body?.skills) && !!card.body.skills[0]?.inputSchema,
      `inputSchema=${card.body?.skills?.[0]?.inputSchema ? 'present' : 'absent'}`)
    record('a2a.card.declares-boundary', 'the card states its exposure and payment position',
      card.body?.boundary?.transport?.networkExposure === 'loopback' && card.body?.boundary?.paymentsInitiated === false,
      `exposure=${card.body?.boundary?.transport?.networkExposure} payments=${card.body?.boundary?.paymentsInitiated}`)

    const task = JSON.parse(readFileSync(`${FIXTURES}/a2a-task.json`, 'utf8'))

    const accepted = await postJson(`${started.baseUrl}${A2A_TASKS_PATH}`, task)
    record('a2a.task.fixture-accepted', 'the sanitized fixture task completes',
      accepted.body?.state === 'completed', `state=${accepted.body?.state}`)
    record('a2a.task.no-source-text-returned', 'no document text appears in the response',
      !JSON.stringify(accepted.body).includes('Alpha beta gamma'), 'checked response body')
    record('a2a.task.labels-verification', 'the response separates locally verified from trusted pass-through',
      accepted.body?.boundary?.verification?.taskEnvelope === 'locally_verified' &&
      accepted.body?.boundary?.verification?.documentContents === 'trusted_pass_through',
      `envelope=${accepted.body?.boundary?.verification?.taskEnvelope} documents=${accepted.body?.boundary?.verification?.documentContents}`)

    // ---- safe failure paths ----
    const noBudget = await postJson(`${started.baseUrl}${A2A_TASKS_PATH}`, { ...task, taskId: 'eval-nobudget', policy: {} })
    record('a2a.fail.no-implicit-token-budget', 'an omitted budget is rejected, never defaulted',
      noBudget.body?.state === 'rejected' && noBudget.body?.failure?.code === 'policy_required',
      `state=${noBudget.body?.state} code=${noBudget.body?.failure?.code}`)

    const wrongSkill = await postJson(`${started.baseUrl}${A2A_TASKS_PATH}`, { ...task, taskId: 'eval-wrongskill', skillId: 'maha.context-control.__nope' })
    record('a2a.fail.unknown-skill-rejected', 'a task addressed to another skill is refused',
      wrongSkill.body?.state === 'rejected' && wrongSkill.body?.failure?.code === 'unknown_skill',
      `state=${wrongSkill.body?.state} code=${wrongSkill.body?.failure?.code}`)

    const withCredential = await postJson(`${started.baseUrl}${A2A_TASKS_PATH}`, { ...task, taskId: 'eval-credential', apiKey: 'not-a-real-value' })
    record('a2a.fail.credential-refused', 'a credential is refused at the transport and never echoed',
      withCredential.body?.error?.code === 'credential_rejected' && !JSON.stringify(withCredential.body).includes('not-a-real-value'),
      `code=${withCredential.body?.error?.code}`)

    const replay = await postJson(`${started.baseUrl}${A2A_TASKS_PATH}`, task)
    record('a2a.fail.replay-returns-original', 'the same taskId returns the first result rather than re-running',
      replay.body?.replayed === true, `replayed=${replay.body?.replayed}`)

    const malformed = await postJson(`${started.baseUrl}${A2A_TASKS_PATH}`, { nonsense: true })
    record('a2a.fail.malformed-rejected', 'a malformed task is rejected',
      malformed.body?.state === 'rejected', `state=${malformed.body?.state}`)

    const unknownPath = await getJson(`${started.baseUrl}/admin`)
    record('a2a.fail.unknown-path-404', 'no route exists beyond the card and the task endpoint',
      unknownPath.status === 404, `status=${unknownPath.status}`)

    // The whole surface, scanned once for the two things that must never leave.
    const everything = [card.body, accepted.body, noBudget.body, wrongSkill.body, withCredential.body, replay.body, malformed.body]
    // stringValuesOnly, because a boundary statement saying
    // `credentialsAccepted: false` is a declaration, not a leak.
    const leaked = findCredentialFields(everything, '$', [], { stringValuesOnly: true })
    record('a2a.responses.no-credential-values', 'no response carries a credential value',
      leaked.length === 0, `found=${leaked.length}`)
    record('a2a.responses.metadata-only', 'no response carries a string long enough to be prose',
      findUnboundedResponseStrings(everything).length === 0, `found=${findUnboundedResponseStrings(everything).length}`)
  } finally {
    await started.close()
  }
}

// Compile requires explicit runtime configuration, and must not invent it.
async function evaluateCompileFailsClosed() {
  const { callMcpTool } = await import('../lib/maha-mcp/index.ts')
  const result = await callMcpTool('context_control.compile_sanitized', {
    inputPath: `${FIXTURES}/sanitized-context.json`,
    outputPath: `${FIXTURES}/.evaluation-output.json`,
  }, { environment: {} })
  record('compile.fails-closed-without-configuration', 'compilation refuses rather than guessing configuration',
    result.ok === false, `ok=${result.ok} code=${(result as { error?: { code?: string } }).error?.code ?? '-'}`)
}

// ------------------------------------------------------------------ utilities

function runProcess(command: string, args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [command, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

async function getJson(url: string) {
  const response = await fetch(url)
  return { status: response.status, body: await response.json().catch(() => null) as Record<string, never> | null }
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: response.status, body: await response.json().catch(() => null) as Record<string, never> | null }
}

// ----------------------------------------------------------------------- main

await evaluateMcp()
await evaluateA2A()
await evaluateCompileFailsClosed()

const failed = checks.filter((check) => !check.pass)
for (const check of checks) {
  process.stdout.write(`${check.pass ? 'PASS' : 'FAIL'}  ${check.name}\n        expect: ${check.expectation}\n        saw:    ${check.observed}\n`)
}
process.stdout.write(`\n${checks.length - failed.length}/${checks.length} checks passed.\n`)
process.stdout.write('No credential was read, no provider was contacted, no payment was possible, and nothing bound beyond loopback.\n')
process.exit(failed.length === 0 ? 0 : 1)
