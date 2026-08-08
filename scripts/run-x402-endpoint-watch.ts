import { execFileSync } from 'node:child_process'

import { createPublicClient, formatUnits, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import {
  createPaidFetch,
  type PaymentRequirement,
  type TypedDataRequest,
} from '../lib/x402/client.ts'

const SUBJECT = 'https://www.mahastrategies.com/api/v1/compress'
const WATCH_URL = 'https://x402.fuchss.app/v1/watch-endpoint-30d'
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const EXPECTED_PAYEE = '0xbBECBE90F28632a9d52ed67b33b43767b8c89285'
const EXPECTED_BUYER = '0x7b7ff44288fADe4A1829abA2584DFCeB952146f2'
const WATCH_PRICE_BASE_UNITS = 200_000n
const KEYCHAIN_SERVICE = 'com.mahastrategies.x402-watch'
const KEYCHAIN_ACCOUNT = 'production-context-compiler'

type WatchResponse = {
  watch_id?: string
  secret?: string
  poll_url?: string
  renew_url?: string
  edit_url?: string
  cancel_url?: string
  expires_at?: string | number
  watched?: unknown
  probe_interval_sec?: number
  subscribed_events?: string[]
  liveness_sensitivity_n?: number
  delivery?: unknown
  next_steps?: unknown
}

type StoredWatch = {
  watchId: string
  secret: string
  pollUrl: string
  renewUrl?: string
  editUrl?: string
  cancelUrl?: string
  expiresAt?: string | number
  subject: string
  createdAt: string
}

function assertDiscordWebhook(raw: string | undefined): string {
  if (!raw) {
    throw new Error('Set X402_WATCH_DISCORD_URL in this terminal. Never paste the webhook URL into chat or commit it.')
  }
  const url = new URL(raw.trim())
  const allowedHosts = new Set(['discord.com', 'discordapp.com'])
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || !url.pathname.startsWith('/api/webhooks/')) {
    throw new Error('X402_WATCH_DISCORD_URL must be a Discord HTTPS incoming-webhook URL.')
  }
  return url.toString()
}

function redactWebhookCredentials(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(
      /https:\/\/(?:discord(?:app)?\.com)\/api\/webhooks\/[^\s"'<>]+/gi,
      '[Discord webhook configured]',
    )
  }
  if (Array.isArray(value)) return value.map(redactWebhookCredentials)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactWebhookCredentials(item)]))
  }
  return value
}

function assertRequirement(requirement: PaymentRequirement) {
  const failures: string[] = []
  if (requirement.scheme !== 'exact') failures.push(`scheme=${requirement.scheme}`)
  if (requirement.network !== 'eip155:8453') failures.push(`network=${requirement.network}`)
  if (BigInt(requirement.amount) !== WATCH_PRICE_BASE_UNITS) failures.push(`amount=${requirement.amount}`)
  if (requirement.asset.toLowerCase() !== BASE_USDC.toLowerCase()) failures.push(`asset=${requirement.asset}`)
  if (requirement.payTo.toLowerCase() !== EXPECTED_PAYEE.toLowerCase()) failures.push(`payTo=${requirement.payTo}`)
  if (requirement.extra?.name !== 'USD Coin') failures.push(`tokenName=${requirement.extra?.name ?? 'missing'}`)
  if (requirement.extra?.version !== '2') failures.push(`tokenVersion=${requirement.extra?.version ?? 'missing'}`)
  if (!Number.isFinite(requirement.maxTimeoutSeconds) || requirement.maxTimeoutSeconds <= 0 || requirement.maxTimeoutSeconds > 300) {
    failures.push(`maxTimeoutSeconds=${requirement.maxTimeoutSeconds}`)
  }
  if (failures.length > 0) throw new Error(`Refused unexpected watch payment terms: ${failures.join(', ')}`)
}

function saveToKeychain(watch: StoredWatch) {
  execFileSync('/usr/bin/security', [
    'add-generic-password',
    '-U',
    '-s', KEYCHAIN_SERVICE,
    '-a', KEYCHAIN_ACCOUNT,
    '-w', JSON.stringify(watch),
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
}

function readFromKeychain(): StoredWatch {
  const raw = execFileSync('/usr/bin/security', [
    'find-generic-password',
    '-s', KEYCHAIN_SERVICE,
    '-a', KEYCHAIN_ACCOUNT,
    '-w',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return JSON.parse(raw.trim()) as StoredWatch
}

async function poll(watch: StoredWatch) {
  const response = await fetch(watch.pollUrl, {
    headers: { Authorization: `Bearer ${watch.secret}` },
  })
  if (!response.ok) {
    throw new Error(`Authenticated watch poll failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
  }
  return response.json() as Promise<Record<string, unknown>>
}

if (process.argv.includes('--poll')) {
  const watch = readFromKeychain()
  const events = await poll(watch)
  console.log(JSON.stringify({
    watchId: watch.watchId,
    subject: watch.subject,
    expiresAt: watch.expiresAt,
    poll: events,
  }, null, 2))
  process.exit(0)
}

if (process.argv.includes('--update-discord')) {
  const discordUrl = assertDiscordWebhook(process.env.X402_WATCH_DISCORD_URL)
  const watch = readFromKeychain()
  if (!watch.editUrl) throw new Error('The stored watch does not contain its edit URL.')

  const response = await fetch(watch.editUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${watch.secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ delivery: { slack_url: discordUrl } }),
  })
  const raw = await response.text()
  const parsed = (() => {
    try { return JSON.parse(raw) as unknown } catch { return raw }
  })()
  if (!response.ok) {
    throw new Error(`Watch Discord update failed with HTTP ${response.status}: ${JSON.stringify(redactWebhookCredentials(parsed))}`)
  }
  console.log('Watch Discord delivery updated without an x402 payment.')
  console.log(JSON.stringify(redactWebhookCredentials(parsed), null, 2))
  process.exit(0)
}

if (!process.argv.includes('--pay')) {
  console.log('No payment attempted. Use --pay to create the guarded 30-day production watch.')
  console.log(`Fixed price ceiling: ${formatUnits(WATCH_PRICE_BASE_UNITS, 6)} USDC on Base Mainnet.`)
  process.exit(0)
}

const discordUrl = assertDiscordWebhook(process.env.X402_WATCH_DISCORD_URL)
const privateKey = (process.env.TEST_BUYER_PRIVATE_KEY ?? process.env.X402_BUYER_PRIVATE_KEY)?.trim() as `0x${string}` | undefined
if (!privateKey) {
  throw new Error('Set TEST_BUYER_PRIVATE_KEY (or X402_BUYER_PRIVATE_KEY) in this terminal. Never paste the key into chat or commit it.')
}

const account = privateKeyToAccount(privateKey)
if (account.address.toLowerCase() !== EXPECTED_BUYER.toLowerCase()) {
  throw new Error(`Refused unexpected buyer wallet ${account.address}; expected the funded production test wallet ${EXPECTED_BUYER}.`)
}
const publicClient = createPublicClient({ chain: base, transport: http() })
const balance = await publicClient.readContract({
  address: BASE_USDC,
  abi: [{
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  }],
  functionName: 'balanceOf',
  args: [account.address],
})

console.log('Maha production x402 endpoint watch')
console.log(`Subject: ${SUBJECT}`)
console.log(`Buyer: ${account.address}`)
console.log(`Base USDC balance: ${formatUnits(balance, 6)} USDC`)
console.log(`Hard payment ceiling: ${formatUnits(WATCH_PRICE_BASE_UNITS, 6)} USDC`)
console.log('Discord webhook: configured (value redacted)')
if (balance < WATCH_PRICE_BASE_UNITS) {
  throw new Error(`Insufficient Base USDC: need at least ${formatUnits(WATCH_PRICE_BASE_UNITS, 6)} USDC.`)
}

const discordTest = await fetch(discordUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: 'Maha preflight: Discord webhook is reachable. Creating the x402 endpoint watch next.' }),
})
if (!discordTest.ok) {
  throw new Error(`Discord webhook preflight failed with HTTP ${discordTest.status}. No x402 payment was attempted.`)
}
console.log(`Discord webhook preflight: PASS (HTTP ${discordTest.status})`)

const paidFetch = createPaidFetch({
  address: account.address,
  chainId: base.id,
  signTypedData: async (request: TypedDataRequest) => account.signTypedData({
    domain: { ...request.domain, verifyingContract: request.domain.verifyingContract as `0x${string}` },
    types: request.types,
    primaryType: request.primaryType,
    message: {
      ...request.message,
      from: request.message.from as `0x${string}`,
      to: request.message.to as `0x${string}`,
      nonce: request.message.nonce as `0x${string}`,
    },
  }),
  onPaymentRequired: assertRequirement,
})

console.log('\nCreating watch. The service will connection-test Discord before the payment is signed...')
const response = await paidFetch(WATCH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endpoint: SUBJECT,
    liveness_sensitivity_n: 2,
    delivery: { slack_url: discordUrl },
  }),
})

const receipt = response.x402?.receipt
if (!receipt?.success || !receipt.transaction) {
  throw new Error('Watch response omitted a successful settlement receipt.')
}

const body = await response.json() as WatchResponse
if (!body.watch_id || !body.secret || !body.poll_url) {
  throw new Error('Watch was paid, but the response omitted watch_id, one-time secret, or poll_url. Preserve the transaction hash and contact the watch provider.')
}

const stored: StoredWatch = {
  watchId: body.watch_id,
  secret: body.secret,
  pollUrl: new URL(body.poll_url, WATCH_URL).toString(),
  renewUrl: body.renew_url ? new URL(body.renew_url, WATCH_URL).toString() : undefined,
  editUrl: body.edit_url ? new URL(body.edit_url, WATCH_URL).toString() : undefined,
  cancelUrl: body.cancel_url ? new URL(body.cancel_url, WATCH_URL).toString() : undefined,
  expiresAt: body.expires_at,
  subject: SUBJECT,
  createdAt: new Date().toISOString(),
}
saveToKeychain(stored)

const firstPoll = await poll(stored)
console.log('\nWatch created and secret stored in macOS Keychain (secret not printed).')
console.log(JSON.stringify({
  watchId: body.watch_id,
  subject: body.watched ?? SUBJECT,
  expiresAt: body.expires_at,
  probeIntervalSeconds: body.probe_interval_sec,
  subscribedEvents: body.subscribed_events,
  livenessSensitivity: body.liveness_sensitivity_n,
  delivery: redactWebhookCredentials(body.delivery),
  transaction: receipt.transaction,
  keychain: { service: KEYCHAIN_SERVICE, account: KEYCHAIN_ACCOUNT },
  initialPoll: firstPoll,
}, null, 2))
