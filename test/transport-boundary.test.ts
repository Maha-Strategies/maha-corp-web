import assert from 'node:assert/strict'
import test from 'node:test'

import {
  boundaryStatement, findCredentialFields, findUnboundedResponseStrings, isCredentialFieldName,
} from '../lib/maha-transport/boundary.ts'
import { A2A_CARD_PATH, A2A_TASKS_PATH, startMahaA2AServer } from '../lib/maha-a2a-server/index.ts'

/**
 * The transport boundary.
 *
 * The credential matcher is the part most worth attacking: substring matching
 * flagged `minimumCompileTokens` — a field the agent card publishes — and
 * `credentialsAccepted`, which is the statement that credentials are refused.
 * The first rejected a valid task in production code; the second is the
 * disclaimer-flags-itself trap. Both directions are asserted here.
 */

test('a measurement field is not mistaken for a credential', () => {
  for (const field of ['tokenBudget', 'minimumCompileTokens', 'estimatedTokens', 'tokenCount', 'maxTokens', 'totalTokensUsed']) {
    assert.equal(isCredentialFieldName(field), false, `${field} is a measurement, not a credential`)
  }
})

test('a credential field is still caught, including compound forms', () => {
  for (const field of ['secret', 'password', 'authorization', 'bearer', 'cookie', 'token', 'tokens',
    'apiKey', 'api_key', 'clientSecret', 'authToken', 'accessToken', 'refresh_token', 'privateKey']) {
    assert.equal(isCredentialFieldName(field), true, `${field} must be treated as a credential`)
  }
})

test('a boundary declaration is not reported as a leaked credential', () => {
  const response = { ...boundaryStatement({ kind: 'stdio', verification: { x: 'locally_verified' } }), apiKey: 'sk-leak' }
  const leaked = findCredentialFields(response, '$', [], { stringValuesOnly: true })
  // The boolean `credentialsAccepted: false` says a credential was refused.
  // Reporting it as a leak would be exactly backwards.
  assert.deepEqual(leaked, ['$.apiKey'])
})

test('the boundary statement separates locally verified from trusted pass-through', () => {
  const statement = boundaryStatement({
    kind: 'http_loopback',
    verification: { envelope: 'locally_verified', documents: 'trusted_pass_through', authenticity: 'not_established' },
  })
  assert.equal(statement.transport.networkExposure, 'loopback')
  assert.equal(statement.credentialsAccepted, false)
  assert.equal(statement.paymentsInitiated, false)
  assert.equal(statement.providerCallsMade, 0)
  assert.ok(statement.limitations.length >= 5)
  assert.equal(statement.verification.envelope, 'locally_verified')
  assert.equal(statement.verification.documents, 'trusted_pass_through')
})

test('stdio declares no network exposure at all', () => {
  assert.equal(boundaryStatement({ kind: 'stdio', verification: {} }).transport.networkExposure, 'none')
})

test('the A2A server accepts the documented optional policy field', async () => {
  const started = await startMahaA2AServer({ port: 0 })
  try {
    const task = {
      taskId: 'boundary-test-1', skillId: 'maha.context-control.evaluate',
      // minimumCompileTokens is published on the agent card. A transport that
      // rejects it as a credential breaks a documented request.
      policy: { tokenBudget: 512, minimumCompileTokens: 1024 },
      request: { model: 'synthetic', messages: [], maha_context: { task: 'demo', tokenBudget: 512, documents: [{ id: 'd1', text: 'alpha beta gamma delta' }] } },
    }
    const response = await fetch(`${started.baseUrl}${A2A_TASKS_PATH}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(task),
    })
    const body = await response.json() as { state?: string; error?: { code?: string } }
    assert.notEqual(body.error?.code, 'credential_rejected', 'a documented policy field must not read as a credential')
    assert.equal(body.state, 'completed')
  } finally { await started.close() }
})

test('the A2A server refuses to bind beyond loopback without an explicit flag', async () => {
  await assert.rejects(startMahaA2AServer({ port: 0, host: '0.0.0.0' }), /Refusing to bind/)
})

test('the A2A server refuses a credential and never echoes it', async () => {
  const started = await startMahaA2AServer({ port: 0 })
  try {
    const response = await fetch(`${started.baseUrl}${A2A_TASKS_PATH}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId: 't', policy: { tokenBudget: 1 }, request: {}, apiKey: 'sk-should-never-appear' }),
    })
    const text = await response.text()
    assert.equal(response.status, 400)
    assert.match(text, /credential_rejected/)
    assert.ok(!text.includes('sk-should-never-appear'), 'the refused credential must not be echoed back')
  } finally { await started.close() }
})

test('the agent card is served with its boundary, and no other route exists', async () => {
  const started = await startMahaA2AServer({ port: 0 })
  try {
    const card = await (await fetch(`${started.baseUrl}${A2A_CARD_PATH}`)).json() as Record<string, never>
    assert.equal((card as { protocolVersion?: string }).protocolVersion, '0.2')
    assert.equal((card as { boundary?: { transport?: { networkExposure?: string } } }).boundary?.transport?.networkExposure, 'loopback')
    assert.equal((await fetch(`${started.baseUrl}/admin`)).status, 404)
    assert.deepEqual(findUnboundedResponseStrings(card), [])
  } finally { await started.close() }
})
