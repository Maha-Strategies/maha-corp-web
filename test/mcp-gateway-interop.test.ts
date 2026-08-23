import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'

import { McpGatewayInterop } from '../lib/mcp-gateway-interop/adapter.ts'
import { evaluateGatewayAction } from '../lib/mcp-gateway-interop/governance.ts'
import {
  McpTranslationError, argumentsDigest, canonicalJson, mcpToolCallToGatewayRequest,
} from '../lib/mcp-gateway-interop/mcp-adapter.ts'
import * as F from '../lib/mcp-gateway-interop/fixtures.ts'

/**
 * The four properties a gateway operator has to be able to check.
 *
 * Each is attacked rather than restated: the denial test counts dispatch calls
 * rather than reading a decision field, because a decision that says "deny"
 * while the callback still fires is the failure that matters.
 */

function harness(chain = F.FIXTURE_CHAIN) {
  const interop = new McpGatewayInterop({ chain, clock: F.fixtureClock() })
  const calls: string[] = []
  const dispatch = async (authorized: { idempotencyKey: string }) => {
    calls.push(authorized.idempotencyKey)
    return { outcome: 'succeeded' as const, receiptId: `receipt-${calls.length}` }
  }
  return { interop, calls, dispatch }
}

const read = () => mcpToolCallToGatewayRequest(F.FIXTURE_READ_FRAME, F.FIXTURE_CONTEXT)
const exportRecords = (evidence = F.FIXTURE_CONTEXT.evidence) =>
  mcpToolCallToGatewayRequest(F.FIXTURE_EXPORT_FRAME, { ...F.FIXTURE_CONTEXT, evidence })

test('property 1: a denied action cannot reach the dispatch callback', async () => {
  const { interop, calls, dispatch } = harness()
  const denied = mcpToolCallToGatewayRequest(F.FIXTURE_DELETE_FRAME, F.FIXTURE_CONTEXT)
  const result = await interop.handle(denied, dispatch)
  assert.equal(result.decision, 'deny')
  assert.ok(result.reasonCodes.includes('capability_not_allowed'))
  // The decision field is not the proof. This is.
  assert.deepEqual(calls, [], 'the gateway dispatch callback must never be invoked for a denied action')
  assert.equal(result.dispatch.attempted, false)
})

test('property 1b: a denial stands even where the tenant policy withdrew the capability later', async () => {
  const { interop, calls, dispatch } = harness(F.FIXTURE_RESTRICTED_CHAIN)
  const result = await interop.handle(exportRecords(), dispatch)
  assert.equal(result.decision, 'deny')
  assert.deepEqual(calls, [])
})

test('property 2: approval is invalidated when its bound evidence changes', async () => {
  const { interop, calls, dispatch } = harness()
  const original = exportRecords()
  const first = await interop.handle(original, dispatch)
  assert.equal(first.decision, 'approval_required')
  assert.deepEqual(calls, [], 'an unapproved action must not dispatch')

  interop.recordApproval({ request: original, decision: 'grant', reviewer: F.FIXTURE_REVIEWER })

  // Same action, evidence revised after the reviewer signed off.
  const revised = exportRecords(F.FIXTURE_EVIDENCE_REVISED)
  const after = await interop.handle(revised, dispatch)
  assert.equal(after.decision, 'approval_required', 'the granted approval must not carry over to changed evidence')
  assert.ok(after.reasonCodes.includes('approval_binding_stale'))
  assert.deepEqual(calls, [], 'a stale approval must not authorise a dispatch')

  // And the binding really did change — that is the mechanism, not a flag.
  const before = evaluateGatewayAction({ request: original, chain: F.FIXTURE_CHAIN, now: F.FIXTURE_EPOCH })
  const later = evaluateGatewayAction({ request: revised, chain: F.FIXTURE_CHAIN, now: F.FIXTURE_EPOCH })
  assert.notEqual(before.evidenceSetSha256, later.evidenceSetSha256)
})

test('property 2b: an approval bound to the unchanged inputs does authorise', async () => {
  // Without this the previous test would pass even if approval never worked.
  const { interop, calls, dispatch } = harness()
  const request = exportRecords()
  await interop.handle(request, dispatch)
  interop.recordApproval({ request, decision: 'grant', reviewer: F.FIXTURE_REVIEWER })
  const after = await interop.handle(request, dispatch)
  assert.equal(after.decision, 'allow')
  assert.ok(after.reasonCodes.includes('approval_granted'))
  assert.deepEqual(calls, [request.idempotencyKey])
})

test('property 2c: an agent cannot approve its own action', async () => {
  const { interop, dispatch } = harness()
  const request = exportRecords()
  await interop.handle(request, dispatch)
  assert.throws(
    () => interop.recordApproval({ request, decision: 'grant', reviewer: F.FIXTURE_AGENT_ACTOR }),
    /Only a human reviewer/,
  )
})

test('property 3: a duplicate idempotency key does not cause a second dispatch', async () => {
  const { interop, calls, dispatch } = harness()
  const request = read()
  const first = await interop.handle(request, dispatch)
  const second = await interop.handle(request, dispatch)

  assert.equal(first.decision, 'allow')
  assert.equal(first.dispatch.idempotentReplay, false)
  assert.equal(second.decision, 'allow')
  assert.equal(second.dispatch.idempotentReplay, true)
  assert.equal(calls.length, 1, 'the dispatch callback must be invoked exactly once for one idempotency key')
  // The replay returns the original decision, not a fresh one.
  assert.equal(second.evidence.decisionSha256, first.evidence.decisionSha256)
  assert.deepEqual(second.dispatch.receipt, first.dispatch.receipt)
})

test('property 3b: the same key with changed material inputs is refused, not re-run', async () => {
  const { interop, calls, dispatch } = harness()
  const request = read()
  await interop.handle(request, dispatch)
  // Same key, different evidence set: a different action wearing the same key.
  const mutated = { ...request, evidence: F.FIXTURE_EVIDENCE_REVISED }
  const result = await interop.handle(mutated, dispatch)
  assert.equal(result.decision, 'deny')
  assert.ok(result.reasonCodes.includes('replay_material_change_rejected'))
  assert.equal(result.recovery, 'blocked_duplicate')
  assert.equal(calls.length, 1)
})

test('property 4: an authorized action without a usable receipt becomes indeterminate', async () => {
  const interop = new McpGatewayInterop({ chain: F.FIXTURE_CHAIN, clock: F.fixtureClock() })
  let calls = 0
  const dispatchUnknown = async () => { calls += 1; return { outcome: 'indeterminate' as const, receiptId: 'receipt-unknown' } }
  const request = read()
  const result = await interop.handle(request, dispatchUnknown)

  assert.equal(result.decision, 'allow')
  assert.equal(result.recovery, 'indeterminate_side_effect')
  const recovery = interop.recoveryFor(request.idempotencyKey)
  assert.equal(recovery.known, true)
  assert.equal(recovery.safeToRetry, false, 'an indeterminate effect must never be marked safe to retry')

  // A resumed run hitting the same key gets the original record, not a re-run.
  await interop.handle(request, dispatchUnknown)
  assert.equal(calls, 1, 'an indeterminate action must not be automatically retried')
})

test('property 4b: a succeeded receipt is not indeterminate', async () => {
  const { interop, dispatch } = harness()
  const request = read()
  const result = await interop.handle(request, dispatch)
  assert.equal(result.recovery, 'not_applicable')
  assert.equal(interop.recoveryFor(request.idempotencyKey).safeToRetry, true)
})

test('the MCP translation commits to arguments without carrying them', () => {
  const request = read()
  assert.match(request.inputSha256, /^sha256:[0-9a-f]{64}$/)
  const serialized = JSON.stringify(request)
  assert.ok(!serialized.includes('SYNTH-REC-0001'), 'argument values must not cross the boundary')
  // Property order must not change the commitment, or an idempotency key would
  // depend on how a client happened to serialise its request.
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }))
  assert.equal(argumentsDigest({ b: 1, a: 2 }).inputSha256, argumentsDigest({ a: 2, b: 1 }).inputSha256)
})

test('the MCP translation refuses a credential-bearing argument', () => {
  for (const field of ['apiKey', 'authorization', 'access_token', 'clientSecret', 'password']) {
    assert.throws(
      () => mcpToolCallToGatewayRequest(
        { method: 'tools/call', params: { name: 'records.read', arguments: { [field]: 'x' } } },
        F.FIXTURE_CONTEXT,
      ),
      (error: unknown) => {
        assert.ok(error instanceof McpTranslationError)
        assert.equal(error.code, 'credential_rejected')
        return true
      },
      `${field} must be refused`,
    )
  }
  // A tool named without arguments is still fine.
  assert.doesNotThrow(() => mcpToolCallToGatewayRequest({ method: 'tools/list' }, F.FIXTURE_CONTEXT))
})

test('every result states its boundaries and retains no content', async () => {
  const { interop, dispatch } = harness()
  for (const request of [read(), exportRecords(), mcpToolCallToGatewayRequest(F.FIXTURE_DELETE_FRAME, F.FIXTURE_CONTEXT)]) {
    const result = await interop.handle(request, dispatch)
    assert.equal(result.evidence.contentRetained, false)
    assert.equal(result.boundaries.credentialsAccepted, false)
    assert.equal(result.boundaries.providerCallsMade, 0)
    assert.equal(result.boundaries.paymentsInitiated, false)
    assert.equal(result.boundaries.verification.policyEvaluation, 'locally_verified')
    assert.equal(result.boundaries.verification.inputDigest, 'trusted_pass_through')
    assert.equal(result.boundaries.verification.dispatchExecution, 'not_established')
    assert.ok(result.reasonCodes.every((code) => /^[a-z0-9_]+$/.test(code)), 'reason codes must be machine-readable')
  }
})

test('the committed fixtures match what the adapter produces today', () => {
  const dir = new URL('../fixtures/mcp-gateway-interop/', import.meta.url).pathname
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'))
  assert.deepEqual(files.sort(), ['allow.json', 'approval-invalidated.json', 'approval-required.json', 'deny.json', 'indeterminate-recovery.json'])
  for (const name of files) {
    const fixture = JSON.parse(readFileSync(`${dir}${name}`, 'utf8'))
    assert.match(fixture.notice, /Synthetic fixture/)
    assert.ok(fixture.demonstrates.length > 0)
    // No fixture may carry an argument value or a credential.
    const serialized = JSON.stringify(fixture)
    assert.ok(!serialized.includes('SYNTH-REC-0001'), `${name} carries an argument value`)
    assert.ok(!/"(apiKey|password|secret|authorization)"\s*:/.test(serialized), `${name} carries a credential field`)
  }
})
