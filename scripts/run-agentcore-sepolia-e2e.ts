/**
 * One-shot Amazon Bedrock AgentCore Payments rehearsal on Base Sepolia.
 *
 * Default: configuration-only preflight (no network, session, proof, or money).
 * --execute: one unpaid challenge, one session, one ProcessPayment call, one
 * paid retry, independent receipt confirmation, and session deletion.
 * --recover-session: inspect/delete the journalled session; never pays.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BedrockAgentCoreClient } from '@aws-sdk/client-bedrock-agentcore'
import { fromIni, fromTemporaryCredentials } from '@aws-sdk/credential-providers'

import { createAgentCoreControlledCommerceTool, type AgentCorePaymentsAdapter, type MerchantChallenge } from '../lib/x402/agentcore.ts'
import {
  createAwsAgentCorePaymentsAdapter,
  inspectAwsAgentCorePaymentSession,
  type AwsAgentCoreSessionHandle,
  type AwsAgentCoreSessionJournal,
} from '../lib/x402/aws-agentcore.ts'
import { createInMemoryBuyerPolicyLedger, type BuyerPolicy } from '../lib/x402/buyer-policy.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'
import { decodeChallenge, decodeReceipt, PAYMENT_REQUIRED_HEADER, PAYMENT_RESPONSE_HEADER, PAYMENT_SIGNATURE_HEADER } from '../lib/x402/client.ts'
import { agentCoreCredentialMode, type AgentCoreRunnerCredentialConfig } from '../lib/x402/agentcore-runner-auth.ts'

const BASE_SEPOLIA = 'eip155:84532'
const DEFAULT_STATE = resolve(tmpdir(), 'maha-agentcore-sepolia-session.json')

type RecoveryState = {
  version: 1
  phase: 'session_created' | 'proof_created' | 'merchant_accepted'
  handle: AwsAgentCoreSessionHandle
  requestId: string
  providerReference?: string
  updatedAt: string
}

type Config = AgentCoreRunnerCredentialConfig & {
  region: string
  resourceUrl: string
  paymentManagerArn: string
  paymentInstrumentId: string
  userId: string
  agentName: string
  payer: string
  payee: string
  asset: string
  maximumBaseUnits: string
  rpcUrl: string
  stateFile: string
  bypass?: string
}

const value = (name: string) => process.env[name]?.trim() || ''
const address = (input: string) => /^0x[0-9a-fA-F]{40}$/.test(input)

function loadConfig(): Config {
  return {
    region: value('AWS_REGION') || 'us-east-1',
    resourceUrl: value('AGENTCORE_TEST_RESOURCE_URL'),
    paymentManagerArn: value('AGENTCORE_PAYMENT_MANAGER_ARN'),
    paymentInstrumentId: value('AGENTCORE_PAYMENT_INSTRUMENT_ID'),
    managementProfile: value('AGENTCORE_MANAGEMENT_AWS_PROFILE'),
    executionProfile: value('AGENTCORE_EXECUTION_AWS_PROFILE'),
    managementRoleArn: value('AGENTCORE_MANAGEMENT_ROLE_ARN'),
    executionRoleArn: value('AGENTCORE_EXECUTION_ROLE_ARN'),
    userId: value('AGENTCORE_TEST_USER_ID'),
    agentName: value('AGENTCORE_TEST_AGENT_NAME'),
    payer: value('AGENTCORE_TEST_PAYER'),
    payee: value('AGENTCORE_TEST_PAYEE'),
    asset: value('AGENTCORE_TEST_ASSET'),
    maximumBaseUnits: value('AGENTCORE_TEST_MAX_BASE_UNITS'),
    rpcUrl: value('BASE_SEPOLIA_RPC_URL') || rpcUrlFor(BASE_SEPOLIA) || '',
    stateFile: value('AGENTCORE_TEST_STATE_FILE') || DEFAULT_STATE,
    ...(value('VERCEL_AUTOMATION_BYPASS_SECRET') ? { bypass: value('VERCEL_AUTOMATION_BYPASS_SECRET') } : {}),
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true).catch(() => false)
}

function configurationChecks(config: Config, mode: 'preflight' | 'execute' | 'recover-session') {
  const credentialMode = agentCoreCredentialMode(config)
  const identitiesDiffer = credentialMode === 'profiles'
    ? config.managementProfile !== config.executionProfile
    : credentialMode === 'roles' && config.managementRoleArn !== config.executionRoleArn
  const checks = [
    ['resource is public HTTPS', (() => { try { return new URL(config.resourceUrl).protocol === 'https:' } catch { return false } })()],
    ['payment manager ARN configured', config.paymentManagerArn.startsWith('arn:aws:')],
    ['payment instrument configured', config.paymentInstrumentId.length >= 8],
    ['exactly one AWS credential mode configured', credentialMode !== 'invalid'],
    ['management and execution identities differ', identitiesDiffer],
    ['user and agent identities configured', config.userId.length >= 3 && config.agentName.length >= 3],
    ['payer, payee, and asset are EVM addresses', address(config.payer) && address(config.payee) && address(config.asset)],
    ['integer ceiling is positive', /^\d+$/.test(config.maximumBaseUnits) && BigInt(config.maximumBaseUnits || '0') > 0n],
    ['RPC configured', /^https:\/\//.test(config.rpcUrl)],
    ['recovery journal is absolute and outside the repository', isAbsolute(config.stateFile) && !resolve(config.stateFile).startsWith(`${process.cwd()}/`)],
    ['exact execute authorization digest present', mode !== 'execute' || value('AGENTCORE_TESTNET_AUTHORIZATION_DIGEST') === authorizationDigest(config)],
    ['explicit recovery authorization present', mode !== 'recover-session' || value('AGENTCORE_SESSION_RECOVERY') === 'I authorize deletion of the journalled AgentCore test session'],
  ] as const
  return checks.map(([name, pass]) => ({ name, pass }))
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}

const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`

function authorizationDigest(config: Config): string {
  return digest({
    resource: config.resourceUrl,
    network: BASE_SEPOLIA,
    asset: config.asset.toLowerCase(),
    payee: config.payee.toLowerCase(),
    maximumBaseUnits: config.maximumBaseUnits,
    processPaymentCalls: 1,
    paidMerchantRequests: 1,
    automaticRetries: 0,
  })
}

async function writeState(path: string, state: RecoveryState): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await rename(temporary, path)
}

async function readState(path: string): Promise<RecoveryState> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as RecoveryState
  if (parsed.version !== 1 || !parsed.handle?.paymentSessionId || !parsed.requestId) throw new Error('The AgentCore recovery journal is malformed.')
  return parsed
}

function awsClients(config: Config) {
  if (agentCoreCredentialMode(config) === 'profiles') {
    return {
      management: new BedrockAgentCoreClient({ region: config.region, maxAttempts: 1, credentials: fromIni({ profile: config.managementProfile }) }),
      execution: new BedrockAgentCoreClient({ region: config.region, maxAttempts: 1, credentials: fromIni({ profile: config.executionProfile }) }),
    }
  }
  const assumed = (roleArn: string, roleSessionName: string) => fromTemporaryCredentials({
    clientConfig: { region: config.region, maxAttempts: 1 },
    params: { RoleArn: roleArn, RoleSessionName: roleSessionName, DurationSeconds: 900 },
  })
  return {
    management: new BedrockAgentCoreClient({ region: config.region, maxAttempts: 1, credentials: assumed(config.managementRoleArn, 'maha-agentcore-management') }),
    execution: new BedrockAgentCoreClient({ region: config.region, maxAttempts: 1, credentials: assumed(config.executionRoleArn, 'maha-agentcore-execution') }),
  }
}

function requestBody() {
  return {
    clientRequestId: `agentcore_sepolia_${Date.now()}`,
    task: 'Retain the release condition and rollback threshold with source provenance.',
    tokenBudget: 120,
    documents: [
      { id: 'release', text: 'Release is allowed after the security owner confirms credential rotation. Roll back if API errors exceed two percent for five minutes.' },
      { id: 'background', text: 'This sanitized test document contains no customer information and exists only for the Base Sepolia rehearsal.' },
    ],
  }
}

function requestHeaders(config: Config, extra: Record<string, string> = {}) {
  return {
    'content-type': 'application/json',
    ...(config.bypass ? { 'x-vercel-protection-bypass': config.bypass } : {}),
    ...extra,
  }
}

function selectChallenge(response: Response, config: Config): MerchantChallenge {
  if (response.status !== 402) throw new Error(`The unpaid merchant request returned HTTP ${response.status}, not 402.`)
  const challenge = decodeChallenge(response.headers.get(PAYMENT_REQUIRED_HEADER))
  const requirement = challenge.accepts.find((candidate) => candidate.scheme === 'exact' && candidate.network === BASE_SEPOLIA)
  if (!requirement) throw new Error('The merchant offered no exact Base Sepolia requirement.')
  if (challenge.resource.url !== config.resourceUrl) throw new Error('The challenge resource does not match the requested resource.')
  if (requirement.payTo.toLowerCase() !== config.payee.toLowerCase()) throw new Error('The challenge payee differs from the operator-approved payee.')
  if (requirement.asset.toLowerCase() !== config.asset.toLowerCase()) throw new Error('The challenge asset differs from the operator-approved asset.')
  if (!/^\d+$/.test(requirement.amount) || BigInt(requirement.amount) > BigInt(config.maximumBaseUnits)) throw new Error('The challenge exceeds the operator-approved Base Sepolia ceiling.')
  const bazaar = challenge.extensions?.bazaar as { info?: { input?: { method?: string } }; schema?: unknown } | undefined
  if (bazaar?.info?.input?.method !== 'POST' || !bazaar.schema) throw new Error('The merchant challenge has no validated POST discovery schema.')
  return {
    declaredResource: challenge.resource.url,
    requirement,
    schema: { status: 'valid', digest: digest(bazaar.schema) },
    paymentRequired: { version: String(challenge.x402Version), payload: challenge },
  }
}

async function recover(config: Config): Promise<void> {
  if (!(await exists(config.stateFile))) throw new Error('No AgentCore recovery journal exists.')
  const state = await readState(config.stateFile)
  const { management, execution } = awsClients(config)
  try {
    const current = await inspectAwsAgentCorePaymentSession(management, state.handle, config.agentName)
    console.log(JSON.stringify({ recovery: 'session_found', phase: state.phase, sessionMatches: current?.paymentSessionId === state.handle.paymentSessionId }))
    const adapter = createAwsAgentCorePaymentsAdapter({
      managementClient: management,
      executionClient: execution,
      paymentManagerArn: config.paymentManagerArn,
      paymentInstrumentId: config.paymentInstrumentId,
      userId: config.userId,
      agentName: config.agentName,
      journal: { async created() {}, async deleted() { await rm(config.stateFile, { force: true }) } },
    })
    await adapter.deleteSession({ handle: state.handle })
    console.log(JSON.stringify({ recovery: 'session_deleted', paymentAttempted: false }))
  } finally {
    management.destroy()
    execution.destroy()
  }
}

async function recoveryDrill(config: Config): Promise<void> {
  const { management, execution } = awsClients(config)
  const requestId = `agentcore-recovery-drill-${Date.now()}`
  const journal: AwsAgentCoreSessionJournal = {
    async created(handle) {
      await writeState(config.stateFile, {
        version: 1,
        phase: 'session_created',
        handle,
        requestId,
        updatedAt: new Date().toISOString(),
      })
    },
    async deleted() { await rm(config.stateFile, { force: true }) },
  }
  try {
    const adapter = createAwsAgentCorePaymentsAdapter({
      managementClient: management,
      executionClient: execution,
      paymentManagerArn: config.paymentManagerArn,
      paymentInstrumentId: config.paymentInstrumentId,
      userId: config.userId,
      agentName: config.agentName,
      journal,
    })
    await adapter.createSession({
      requestId,
      purpose: 'session_recovery_drill',
      resource: config.resourceUrl,
      network: BASE_SEPOLIA,
      asset: config.asset,
      payee: config.payee,
      maximumAmount: config.maximumBaseUnits,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    })
  } finally {
    management.destroy()
    execution.destroy()
  }
  // The second client pair represents a restarted process. It must recover the
  // session from disk without generating a proof or contacting the merchant.
  await recover(config)
  if (await exists(config.stateFile)) throw new Error('The recovery drill left a stale AgentCore session journal.')
  console.log(JSON.stringify({ recoveryDrill: 'passed', processPaymentCalls: 0, merchantCalls: 0 }))
}

async function execute(config: Config): Promise<void> {
  if (await exists(config.stateFile)) throw new Error(`Recovery journal exists at ${config.stateFile}; run --recover-session before any new payment.`)
  const body = JSON.stringify(requestBody())
  let lastChallenge: MerchantChallenge | null = null
  let recovery: RecoveryState | null = null
  const { management, execution } = awsClients(config)
  const requestId = `agentcore-request-${Date.now()}`
  const journal: AwsAgentCoreSessionJournal = {
    async created(handle) {
      recovery = { version: 1, phase: 'session_created', handle, requestId, updatedAt: new Date().toISOString() }
      await writeState(config.stateFile, recovery)
    },
    async deleted() { await rm(config.stateFile, { force: true }); recovery = null },
  }
  const aws = createAwsAgentCorePaymentsAdapter({
    managementClient: management,
    executionClient: execution,
    paymentManagerArn: config.paymentManagerArn,
    paymentInstrumentId: config.paymentInstrumentId,
    userId: config.userId,
    agentName: config.agentName,
    journal,
  })
  const payments: AgentCorePaymentsAdapter = {
    ...aws,
    async createPaymentProof(input) {
      const result = await aws.createPaymentProof(input)
      if (!recovery) throw new Error('The AgentCore recovery journal disappeared before proof generation.')
      recovery = { ...recovery, phase: 'proof_created', ...(result.providerReference ? { providerReference: result.providerReference } : {}), updatedAt: new Date().toISOString() }
      await writeState(config.stateFile, recovery)
      return result
    },
  }
  const policy: BuyerPolicy = {
    schemaVersion: '1.0.0',
    policyId: 'agentcore-sepolia-rehearsal',
    policyVersion: '2026-08-17',
    approvedSchemes: ['exact'],
    approvedResources: [config.resourceUrl],
    approvedPayees: [config.payee],
    assetRules: [{ network: BASE_SEPOLIA, asset: config.asset, maxAmountPerCall: config.maximumBaseUnits, maxAmountPerTask: config.maximumBaseUnits }],
    requireValidatedSchema: true,
    settlement: { requirePaymentResponse: true, requireOnchainConfirmation: true },
  }
  const tool = createAgentCoreControlledCommerceTool({
    policy,
    ledger: createInMemoryBuyerPolicyLedger(),
    approvedPurposes: ['controlled_agentcore_rehearsal'],
    payer: config.payer,
    payments,
    sessionDurationSeconds: 900,
    merchant: {
      async inspect() {
        const response = await fetch(config.resourceUrl, { method: 'POST', headers: requestHeaders(config), body, redirect: 'error', signal: AbortSignal.timeout(15_000) })
        lastChallenge = selectChallenge(response, config)
        return lastChallenge
      },
      async redeem({ paymentHeader }) {
        const response = await fetch(config.resourceUrl, {
          method: 'POST', headers: requestHeaders(config, { [PAYMENT_SIGNATURE_HEADER]: paymentHeader }), body,
          redirect: 'error', signal: AbortSignal.timeout(60_000),
        })
        const bytes = new Uint8Array(await response.arrayBuffer())
        const receipt = decodeReceipt(response.headers.get(PAYMENT_RESPONSE_HEADER))
        if (recovery) {
          recovery = { ...recovery, phase: 'merchant_accepted', updatedAt: new Date().toISOString() }
          await writeState(config.stateFile, recovery)
        }
        return { status: response.status, report: { delivered: response.ok, byteLength: bytes.length }, responseBytes: bytes, receipt }
      },
    },
    async confirmSettlement({ authorization, receipt }) {
      if (!receipt?.transaction || !receipt.payer) return { status: 'indeterminate', reason: 'receipt_missing_transaction_or_payer' }
      const chain = await confirmSettlement({
        rpcUrl: config.rpcUrl,
        caip2Network: authorization.network,
        transaction: receipt.transaction,
        asset: authorization.asset,
        payer: receipt.payer,
        payTo: authorization.payee,
        minAmount: authorization.amount,
        attempts: 3,
        retryDelayMs: 1_000,
        requestTimeoutMs: 5_000,
      })
      if (chain.status !== 'confirmed') return chain
      return { ...chain, status: 'confirmed', network: authorization.network, asset: authorization.asset, payer: receipt.payer, payTo: authorization.payee }
    },
  })

  try {
    const result = await tool.purchase(
      { resourceUrl: config.resourceUrl, purpose: 'controlled_agentcore_rehearsal' },
      { requestId, taskId: `agentcore-task-${Date.now()}`, authorizationId: `agentcore-authorization-${Date.now()}`, idempotencyKey: `agentcore-payment-${Date.now()}` },
    )
    console.log(JSON.stringify({
      status: result.status,
      network: result.network,
      amount: result.amount,
      settlementVerified: result.settlementVerified,
      receiptReference: result.receiptReference,
      responseHash: result.responseHash,
      sessionCleanupVerified: !(await exists(config.stateFile)),
      calls: { processPayment: 1, paidMerchantRequests: 1, automaticRetries: 0 },
      challengeDigest: lastChallenge?.schema.digest,
    }, null, 2))
  } finally {
    management.destroy()
    execution.destroy()
  }
}

async function main() {
  const config = loadConfig()
  const executeRequested = process.argv.includes('--execute')
  const recoverRequested = process.argv.includes('--recover-session')
  if (executeRequested && recoverRequested) throw new Error('Choose either --execute or --recover-session.')
  const mode = recoverRequested ? 'recover-session' : executeRequested ? 'execute' : 'preflight'
  const checks = configurationChecks(config, mode)
  const staleSession = await exists(config.stateFile)
  console.log(JSON.stringify({
    mode,
    checks,
    staleSession,
    ready: checks.every((check) => check.pass) && (recoverRequested ? staleSession : !staleSession),
    authorizationRequest: {
      resource: config.resourceUrl || null,
      network: BASE_SEPOLIA,
      asset: config.asset || null,
      payee: config.payee || null,
      maximumBaseUnits: config.maximumBaseUnits || null,
      processPaymentCalls: 1,
      paidMerchantRequests: 1,
      automaticRetries: 0,
      digest: authorizationDigest(config),
    },
    networkCalls: executeRequested || recoverRequested ? 'not_started' : 0,
    paymentAttempted: false,
  }, null, 2))
  if (!checks.every((check) => check.pass)) process.exitCode = 1
  else if (recoverRequested) await recover(config)
  else if (executeRequested) {
    await recoveryDrill(config)
    await execute(config)
  }
  else if (staleSession) process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try { await main() } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
