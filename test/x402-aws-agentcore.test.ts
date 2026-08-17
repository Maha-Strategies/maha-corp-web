import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CreatePaymentSessionCommand,
  DeletePaymentSessionCommand,
  GetPaymentSessionCommand,
  ProcessPaymentCommand,
} from '@aws-sdk/client-bedrock-agentcore'

import {
  createAwsAgentCorePaymentsAdapter,
  baseUnitsToUsd,
  inspectAwsAgentCorePaymentSession,
  type AwsAgentCoreSessionHandle,
} from '../lib/x402/aws-agentcore.ts'
import type { AgentCorePaymentSessionRequest, MerchantChallenge } from '../lib/x402/agentcore.ts'

const MANAGER = 'arn:aws:bedrock-agentcore:us-east-1:123456789012:payment-manager/test-manager'
const INSTRUMENT = 'instrument-test-0001'
const USER = 'user-test-0001'
const AGENT = 'agent-test-0001'
const SESSION = 'session-test-0001'

type Sent = { constructor: { name: string }; input: Record<string, unknown> }

function clients() {
  const managementCommands: Sent[] = []
  const executionCommands: Sent[] = []
  const management = {
    async send(command: Sent) {
      managementCommands.push(command)
      if (command instanceof CreatePaymentSessionCommand) {
        return {
          paymentSession: {
            paymentSessionId: SESSION,
            paymentManagerArn: MANAGER,
            userId: USER,
            expiryTimeInMinutes: 15,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }
      }
      if (command instanceof DeletePaymentSessionCommand) return { status: 'DELETED' }
      if (command instanceof GetPaymentSessionCommand) return { paymentSession: { paymentSessionId: SESSION, paymentManagerArn: MANAGER, userId: USER } }
      throw new Error(`Unexpected management command ${command.constructor.name}`)
    },
  }
  const execution = {
    async send(command: Sent) {
      executionCommands.push(command)
      if (!(command instanceof ProcessPaymentCommand)) throw new Error(`Unexpected execution command ${command.constructor.name}`)
      return {
        processPaymentId: 'process-payment-test-0001',
        status: 'PROOF_GENERATED',
        paymentSessionId: SESSION,
        paymentOutput: { cryptoX402: { version: '2', payload: { x402Version: 2, payload: { signature: '0xsigned' } } } },
      }
    },
  }
  return { management, execution, managementCommands, executionCommands }
}

const request: AgentCorePaymentSessionRequest = {
  requestId: 'request-agentcore-0001',
  purpose: 'context_optimization',
  resource: 'https://merchant.example/resource',
  network: 'eip155:84532',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  payee: '0x0000000000000000000000000000000000000002',
  maximumAmount: '1000',
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
}

const challenge: MerchantChallenge = {
  declaredResource: request.resource,
  requirement: { scheme: 'exact', network: request.network, asset: request.asset, payTo: request.payee, amount: request.maximumAmount },
  schema: { status: 'valid', digest: `sha256:${'a'.repeat(64)}` },
  paymentRequired: { version: '2', payload: { x402Version: 2, accepts: [request] } },
}

function adapterHarness() {
  const c = clients()
  const journalEvents: string[] = []
  const adapter = createAwsAgentCorePaymentsAdapter({
    managementClient: c.management as never,
    executionClient: c.execution as never,
    paymentManagerArn: MANAGER,
    paymentInstrumentId: INSTRUMENT,
    userId: USER,
    agentName: AGENT,
    journal: {
      async created(handle) { journalEvents.push(`created:${handle.paymentSessionId}`) },
      async deleted(handle) { journalEvents.push(`deleted:${handle.paymentSessionId}`) },
    },
  })
  return { ...c, adapter, journalEvents }
}

test('AWS adapter separates management from execution and emits one x402 proof', async () => {
  const h = adapterHarness()
  const session = await h.adapter.createSession(request)
  const proof = await h.adapter.createPaymentProof({
    session,
    authorization: {
      allowed: true,
      code: 'allowed',
      policyId: 'agentcore-test-policy',
      policyVersion: '2026-08-17',
      taskId: 'task-agentcore-0001',
      authorizationId: 'authorization-agentcore-0001',
      resource: request.resource,
      scheme: 'exact',
      network: request.network,
      asset: request.asset,
      payee: request.payee,
      amount: request.maximumAmount,
    },
    challenge,
    idempotencyKey: 'payment-agentcore-0001',
  })
  await h.adapter.deleteSession(session)

  assert.equal(h.managementCommands.filter((command) => command instanceof CreatePaymentSessionCommand).length, 1)
  const created = h.managementCommands.find((command) => command instanceof CreatePaymentSessionCommand)?.input as { limits: { maxSpendAmount: { value: string } } }
  assert.equal(created.limits.maxSpendAmount.value, '0.001')
  assert.equal(h.executionCommands.filter((command) => command instanceof ProcessPaymentCommand).length, 1)
  assert.equal(h.managementCommands.filter((command) => command instanceof DeletePaymentSessionCommand).length, 1)
  const process = h.executionCommands[0].input as { paymentType: string; paymentInput: { cryptoX402: { version: string; payload: unknown } } }
  assert.equal(process.paymentType, 'CRYPTO_X402')
  assert.equal(process.paymentInput.cryptoX402.version, '2')
  assert.deepEqual(process.paymentInput.cryptoX402.payload, challenge.paymentRequired?.payload)
  assert.deepEqual(JSON.parse(Buffer.from(proof.paymentHeader, 'base64').toString('utf8')), {
    x402Version: 2,
    payload: { signature: '0xsigned' },
  })
  assert.equal(proof.providerReference, 'process-payment-test-0001')
  assert.deepEqual(h.journalEvents, [`created:${SESSION}`, `deleted:${SESSION}`])
})

test('AWS adapter refuses to silently expand a shorter application session', async () => {
  const h = adapterHarness()
  await assert.rejects(
    h.adapter.createSession({ ...request, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() }),
    /requires the shortest AgentCore-supported session/,
  )
  assert.equal(h.managementCommands.length, 0)
})

test('base-unit ceilings convert exactly without floating-point arithmetic', () => {
  assert.equal(baseUnitsToUsd('1'), '0.000001')
  assert.equal(baseUnitsToUsd('1000'), '0.001')
  assert.equal(baseUnitsToUsd('1000000'), '1')
  assert.equal(baseUnitsToUsd('1234567'), '1.234567')
  assert.throws(() => baseUnitsToUsd('0.1'), /integer base units/)
})

test('AWS adapter refuses missing v2 challenge before ProcessPayment', async () => {
  const h = adapterHarness()
  const session = await h.adapter.createSession(request)
  await assert.rejects(
    h.adapter.createPaymentProof({
      session,
      authorization: {} as never,
      challenge: { ...challenge, paymentRequired: undefined },
      idempotencyKey: 'payment-agentcore-0002',
    }),
    /decoded x402 v2/,
  )
  assert.equal(h.executionCommands.length, 0)
})

test('AWS adapter requires separate client instances', () => {
  const client = clients().management
  assert.throws(() => createAwsAgentCorePaymentsAdapter({
    managementClient: client as never,
    executionClient: client as never,
    paymentManagerArn: MANAGER,
    paymentInstrumentId: INSTRUMENT,
    userId: USER,
    agentName: AGENT,
  }), /separate client instances/)
})

test('a journal failure triggers best-effort deletion before the session can escape', async () => {
  const c = clients()
  const adapter = createAwsAgentCorePaymentsAdapter({
    managementClient: c.management as never,
    executionClient: c.execution as never,
    paymentManagerArn: MANAGER,
    paymentInstrumentId: INSTRUMENT,
    userId: USER,
    agentName: AGENT,
    journal: {
      async created() { throw new Error('disk unavailable') },
      async deleted() {},
    },
  })
  await assert.rejects(adapter.createSession(request), /disk unavailable/)
  assert.equal(c.managementCommands.filter((command) => command instanceof CreatePaymentSessionCommand).length, 1)
  assert.equal(c.managementCommands.filter((command) => command instanceof DeletePaymentSessionCommand).length, 1)
  assert.equal(c.executionCommands.length, 0)
})

test('session inspection is read-only and bound to the persisted handle', async () => {
  const h = clients()
  const handle: AwsAgentCoreSessionHandle = { paymentSessionId: SESSION, paymentManagerArn: MANAGER, userId: USER }
  const session = await inspectAwsAgentCorePaymentSession(h.management as never, handle, AGENT)
  assert.equal(session?.paymentSessionId, SESSION)
  assert.equal(h.managementCommands.length, 1)
  assert.ok(h.managementCommands[0] instanceof GetPaymentSessionCommand)
})
