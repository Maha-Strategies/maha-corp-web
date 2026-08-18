/**
 * Concrete Amazon Bedrock AgentCore Payments adapter.
 *
 * Management and payment execution clients are deliberately separate. The
 * application owns policy authorization; this adapter only creates a bounded
 * session, asks AgentCore for one CRYPTO_X402 proof, and deletes the session.
 */

import {
  CreatePaymentSessionCommand,
  DeletePaymentSessionCommand,
  GetPaymentSessionCommand,
  ProcessPaymentCommand,
  type BedrockAgentCoreClient,
  type CryptoX402PaymentInput,
} from '@aws-sdk/client-bedrock-agentcore'

import type {
  AgentCorePaymentSession,
  AgentCorePaymentSessionRequest,
  AgentCorePaymentsAdapter,
} from './agentcore.ts'

export const AWS_AGENTCORE_ADAPTER_VERSION = '0.1.0' as const

export type AwsAgentCoreSessionHandle = {
  paymentSessionId: string
  paymentManagerArn: string
  userId: string
}

type CommandClient = Pick<BedrockAgentCoreClient, 'send'>

export type AwsAgentCoreSessionJournal = {
  created(handle: AwsAgentCoreSessionHandle): Promise<void>
  deleted(handle: AwsAgentCoreSessionHandle): Promise<void>
}

export type AwsAgentCorePaymentsConfig = {
  /** Client authenticated with the management role. */
  managementClient: CommandClient
  /** Client authenticated with the ProcessPayment execution role. */
  executionClient: CommandClient
  paymentManagerArn: string
  paymentInstrumentId: string
  userId: string
  agentName: string
  /** USDC uses six decimals. Override only for another USD-denominated asset. */
  assetDecimals?: number
  journal?: AwsAgentCoreSessionJournal
}

function bounded(value: string, name: string, maximum = 256): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > maximum) throw new Error(`${name} is missing or too long.`)
  return normalized
}

function sessionHandle(session: AgentCorePaymentSession): AwsAgentCoreSessionHandle {
  const value = session.handle
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AgentCore session handle is malformed.')
  const record = value as Record<string, unknown>
  return {
    paymentSessionId: bounded(String(record.paymentSessionId ?? ''), 'paymentSessionId'),
    paymentManagerArn: bounded(String(record.paymentManagerArn ?? ''), 'paymentManagerArn', 2048),
    userId: bounded(String(record.userId ?? ''), 'userId'),
  }
}

function expiryMinutes(input: AgentCorePaymentSessionRequest): number {
  const remaining = new Date(input.expiresAt).getTime() - Date.now()
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('The AgentCore session expiry is invalid.')
  // AgentCore currently accepts 15–480 minutes. Refuse rather than silently
  // expand an application request for a shorter capability.
  if (remaining < 14 * 60_000 || remaining > 15 * 60_000 + 5_000) {
    throw new Error('The AWS adapter requires the shortest AgentCore-supported session: 15 minutes.')
  }
  return 15
}

function proofHeader(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('AgentCore returned no CRYPTO_X402 payment payload.')
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  if (encoded.length < 8) throw new Error('AgentCore returned an unusable CRYPTO_X402 payment payload.')
  return encoded
}

function paymentDocument(payload: unknown): CryptoX402PaymentInput['payload'] {
  try {
    return JSON.parse(JSON.stringify(payload)) as CryptoX402PaymentInput['payload']
  } catch {
    throw new Error('The PAYMENT-REQUIRED payload is not a JSON-compatible AgentCore document.')
  }
}

export function baseUnitsToUsd(value: string, decimals = 6): string {
  if (!/^\d+$/.test(value) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('The session maximum must be non-negative integer base units with valid asset decimals.')
  }
  const normalized = value.replace(/^0+(?=\d)/, '')
  if (decimals === 0) return normalized
  const padded = normalized.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/**
 * Creates an adapter around the official AWS JavaScript SDK commands.
 * Configure both SDK clients with maxAttempts: 1; the constructor verifies
 * distinct client objects. The caller must bind those clients to distinct IAM
 * roles; the Sepolia runner additionally checks distinct role ARNs.
 */
export function createAwsAgentCorePaymentsAdapter(config: AwsAgentCorePaymentsConfig): AgentCorePaymentsAdapter {
  if (config.managementClient === config.executionClient) {
    throw new Error('AgentCore management and payment execution must use separate client instances.')
  }
  const paymentManagerArn = bounded(config.paymentManagerArn, 'paymentManagerArn', 2048)
  const paymentInstrumentId = bounded(config.paymentInstrumentId, 'paymentInstrumentId')
  const userId = bounded(config.userId, 'userId')
  const agentName = bounded(config.agentName, 'agentName', 2048)
  const assetDecimals = config.assetDecimals ?? 6

  return {
    async createSession(input) {
      const output = await config.managementClient.send(new CreatePaymentSessionCommand({
        userId,
        agentName,
        paymentManagerArn,
        limits: { maxSpendAmount: { value: baseUnitsToUsd(input.maximumAmount, assetDecimals), currency: 'USD' } },
        expiryTimeInMinutes: expiryMinutes(input),
        clientToken: input.requestId,
      }))
      const created = output.paymentSession
      if (!created?.paymentSessionId || created.paymentManagerArn !== paymentManagerArn || created.userId !== userId) {
        throw new Error('AgentCore returned a missing or mismatched payment session.')
      }
      const handle: AwsAgentCoreSessionHandle = { paymentSessionId: created.paymentSessionId, paymentManagerArn, userId }
      if (config.journal) {
        try {
          await config.journal.created(handle)
        } catch (error) {
          await config.managementClient.send(new DeletePaymentSessionCommand({
            userId,
            paymentManagerArn,
            paymentSessionId: handle.paymentSessionId,
          })).catch(() => undefined)
          throw error
        }
      }
      return { handle }
    },

    async createPaymentProof(input) {
      const handle = sessionHandle(input.session)
      if (handle.paymentManagerArn !== paymentManagerArn || handle.userId !== userId) {
        throw new Error('AgentCore session is not bound to the configured manager and user.')
      }
      const paymentRequired = input.challenge.paymentRequired
      if (!paymentRequired || paymentRequired.version !== '2' || !paymentRequired.payload) {
        throw new Error('The merchant did not provide a decoded x402 v2 PAYMENT-REQUIRED payload.')
      }
      // AgentCore expects the selected payment requirement, not the outer
      // PAYMENT-REQUIRED envelope. The envelope contains `accepts`; the data
      // plane payload begins directly with `scheme`, `network`, and `amount`.
      const output = await config.executionClient.send(new ProcessPaymentCommand({
        userId,
        agentName,
        paymentManagerArn,
        paymentSessionId: handle.paymentSessionId,
        paymentInstrumentId,
        paymentType: 'CRYPTO_X402',
        paymentInput: { cryptoX402: { version: paymentRequired.version, payload: paymentDocument(input.challenge.requirement) } },
        clientToken: input.idempotencyKey,
      }))
      if (output.status !== 'PROOF_GENERATED' || output.paymentSessionId !== handle.paymentSessionId) {
        throw new Error('AgentCore did not generate a proof for the bounded payment session.')
      }
      const crypto = output.paymentOutput?.cryptoX402
      if (!crypto || crypto.version !== '2') throw new Error('AgentCore returned no compatible x402 v2 proof.')
      if (!output.processPaymentId) throw new Error('AgentCore returned no process-payment reference.')
      return { paymentHeader: proofHeader(crypto.payload), providerReference: output.processPaymentId }
    },

    async deleteSession(session) {
      const handle = sessionHandle(session)
      const output = await config.managementClient.send(new DeletePaymentSessionCommand({
        userId: handle.userId,
        paymentManagerArn: handle.paymentManagerArn,
        paymentSessionId: handle.paymentSessionId,
      }))
      if (output.status !== 'DELETED') throw new Error('AgentCore did not confirm payment-session deletion.')
      await config.journal?.deleted(handle)
    },
  }
}

/** Read-only recovery check for an operator before attempting cleanup. */
export async function inspectAwsAgentCorePaymentSession(
  managementClient: CommandClient,
  handle: AwsAgentCoreSessionHandle,
  agentName: string,
) {
  const output = await managementClient.send(new GetPaymentSessionCommand({
    userId: handle.userId,
    agentName,
    paymentManagerArn: handle.paymentManagerArn,
    paymentSessionId: handle.paymentSessionId,
  }))
  return output.paymentSession
}
