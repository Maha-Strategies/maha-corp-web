/**
 * Live x402 payment lifecycle against Base Sepolia.
 *
 *   node --experimental-strip-types scripts/verify-x402-sepolia.ts
 *   node --experimental-strip-types scripts/verify-x402-sepolia.ts --dry-run
 *
 * Everything else in this codebase stubs the facilitator. This does not: it
 * signs a real EIP-3009 authorization with a testnet key, presents it, and
 * checks what the ledger actually recorded. It is the only thing that can tell
 * you the client and the server agree on what a payment is.
 *
 * --dry-run stops before the network is touched. It generates a throwaway key,
 * builds and signs the payload, and checks that the signature recovers to the
 * signing address and that the payment id matches what the server will compute.
 * That validates every step this script owns without needing funds, a
 * facilitator, or a deployment -- useful in CI and when the wiring changes.
 *
 * TESTNET ONLY. It refuses to run against mainnet: the point is to rehearse a
 * payment path, and a rehearsal that can move real money is not a rehearsal.
 * Never put a mainnet key in X402_TEST_PRIVATE_KEY.
 */

import { createPublicClient, http, parseAbi, verifyTypedData, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

import { paymentId, type PaymentPayload } from '../lib/x402/protocol.ts'

const DRY_RUN = process.argv.includes('--dry-run')
const BASE_SEPOLIA_CHAIN_ID = 84532
const EXPECTED_CAIP2 = `eip155:${BASE_SEPOLIA_CHAIN_ID}`

let failures = 0
let checks = 0

function check(description: string, ok: boolean, detail?: unknown) {
  checks += 1
  if (!ok) failures += 1
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${description}${ok || detail === undefined ? '' : ` -- ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
}

function stage(name: string) {
  console.log(`\n${name}`)
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`\n${name} is required.\n\nSee .env.example for the Base Sepolia block. This script needs a deployment with X402_ENABLED=true, a CDP testnet facilitator, and a funded testnet key -- none of which should ever be production values.`)
    process.exit(1)
  }
  return value
}

// ---------------------------------------------------------------------------
// Payload construction
// ---------------------------------------------------------------------------

type Requirement = {
  scheme: string
  network: string
  maxAmountRequired: string
  resource: string
  payTo: string
  asset: string
  maxTimeoutSeconds: number
  /** The token's EIP-712 domain. Without it the facilitator answers
   *  invalid_exact_evm_missing_eip712_domain and refuses every payment. */
  extra?: { name?: string; version?: string }
}

/**
 * The `exact` scheme on an EVM chain is an EIP-3009 `transferWithAuthorization`
 * the payer signs and the facilitator submits. The signature authorizes exactly
 * one transfer, bounded by a validity window and a nonce, which is why a
 * payment can be handed over as a header without handing over an account.
 */
async function signAuthorization(input: {
  account: ReturnType<typeof privateKeyToAccount>
  requirement: Requirement
  nonce: Hex
  validAfter: bigint
  validBefore: bigint
}) {
  // Taken from the challenge, not assumed. The server publishes the domain it
  // will hand the facilitator, and signing against a different one produces a
  // signature that verifies locally and is rejected on presentation.
  const domain = {
    name: input.requirement.extra?.name ?? 'USDC',
    version: input.requirement.extra?.version ?? '2',
    chainId: BASE_SEPOLIA_CHAIN_ID,
    verifyingContract: input.requirement.asset as Hex,
  } as const

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  } as const

  const message = {
    from: input.account.address,
    to: input.requirement.payTo as Hex,
    value: BigInt(input.requirement.maxAmountRequired),
    validAfter: input.validAfter,
    validBefore: input.validBefore,
    nonce: input.nonce,
  } as const

  const signature = await input.account.signTypedData({ domain, types, primaryType: 'TransferWithAuthorization', message })
  return { domain, types, message, signature }
}

function encodePayload(requirement: Requirement, message: Record<string, unknown>, signature: Hex): { payload: PaymentPayload; header: string } {
  const payload: PaymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: requirement.network,
    payload: {
      signature,
      authorization: {
        from: message.from,
        to: message.to,
        value: String(message.value),
        validAfter: String(message.validAfter),
        validBefore: String(message.validBefore),
        nonce: message.nonce,
      },
    },
  }
  return { payload, header: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64') }
}

const decode = (header: string) => JSON.parse(Buffer.from(header, 'base64').toString('utf8'))

// ---------------------------------------------------------------------------
// Dry run: everything this script owns, without a network
// ---------------------------------------------------------------------------

async function dryRun() {
  console.log('Dry run: no network, no funds, no facilitator.\n')

  const account = privateKeyToAccount(generatePrivateKey())
  const requirement: Requirement = {
    scheme: 'exact',
    network: 'base-sepolia',
    maxAmountRequired: '10000',
    resource: 'https://example.test/api/v1/compress',
    payTo: '0x0000000000000000000000000000000000000002',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    maxTimeoutSeconds: 60,
    extra: { name: 'USDC', version: '2' },
  }

  stage('Signing')
  const now = BigInt(Math.floor(Date.now() / 1000))
  const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as Hex
  const signed = await signAuthorization({ account, requirement, nonce, validAfter: now - 60n, validBefore: now + 600n })
  check('the authorization signs', signed.signature.startsWith('0x'))

  const recovered = await verifyTypedData({
    address: account.address,
    domain: signed.domain,
    types: signed.types,
    primaryType: 'TransferWithAuthorization',
    message: signed.message,
    signature: signed.signature,
  })
  check('the signature recovers to the signing address', recovered)

  stage('Payload identity')
  const { payload, header } = encodePayload(requirement, signed.message, signed.signature)
  const id = await paymentId(payload)
  check('the payment id is a sha256 hex digest', /^[0-9a-f]{64}$/.test(id), id)

  // The server computes this from the decoded header. If the two disagree the
  // replay guard silently protects nothing, so it is asserted rather than
  // assumed.
  const serverSide = await paymentId(decode(header))
  check('the id survives the base64 round trip the header takes', serverSide === id)

  // Key order must not change the identity, or one authorization re-encoded
  // presents as two distinct payments and buys the resource twice.
  const reordered = { payload: payload.payload, network: payload.network, scheme: payload.scheme, x402Version: payload.x402Version } as PaymentPayload
  check('re-ordering the payload keys does not change the id', (await paymentId(reordered)) === id)

  const different = await paymentId({ ...payload, payload: { ...payload.payload, signature: '0xdifferent' } })
  check('a different signature is a different payment', different !== id)

  return
}

// ---------------------------------------------------------------------------
// Live run
// ---------------------------------------------------------------------------

async function liveRun() {
  const baseUrl = required('X402_TEST_BASE_URL').replace(/\/$/, '')
  const path = process.env.X402_TEST_PATH?.trim() || '/api/v1/compress'
  const privateKey = required('X402_TEST_PRIVATE_KEY') as Hex
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim() || 'https://sepolia.base.org'
  // A Vercel preview sits behind deployment protection. Without the bypass the
  // first request is answered by Vercel's own SSO 401, which looks nothing
  // like the app and wastes a signing cycle to diagnose.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.error('X402_TEST_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key.')
    process.exit(1)
  }

  const account = privateKeyToAccount(privateKey)
  console.log(`Target:  ${baseUrl}${path}`)
  console.log(`Payer:   ${account.address}`)
  console.log(`Chain:   Base Sepolia (${BASE_SEPOLIA_CHAIN_ID})\n`)

  const request = (headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(bypass ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'false' } : {}),
        ...headers,
      },
      body: JSON.stringify({ sources: [{ id: 'probe', text: 'x402 sepolia verification probe.' }], budgetTokens: 64 }),
      cache: 'no-store',
    })

  // -- Stage 0: the ledger is ready --------------------------------------
  // Checked before anything is signed. A missing migration surfaces at stage 4
  // as a refusal on a payment that has already been signed, which is a
  // confusing place to learn it.
  stage('Stage 0 -- the ledger is migrated')
  const ledgerUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const ledgerKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const readLedger = async (table: string, query: string) => {
    if (!ledgerUrl || !ledgerKey) return null
    const response = await fetch(`${ledgerUrl}/rest/v1/${table}?${query}`, {
      headers: { apikey: ledgerKey, authorization: `Bearer ${ledgerKey}` },
      cache: 'no-store',
    })
    return response.ok ? (await response.json()) as Record<string, unknown>[] : null
  }

  if (!ledgerUrl || !ledgerKey) {
    console.log('  skipped: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the environment under test')
    console.log('  NOTE: without these the ledger assertions cannot run, and a missing')
    console.log('        migration will surface as a refusal after signing.')
  } else {
    const payments = await readLedger('x402_payments', 'select=payment_id&limit=1')
    const settlements = await readLedger('x402_settlements', 'select=payment_id&limit=1')
    check('x402_payments exists and is readable', payments !== null, 'apply 20260804000100_x402_payment_id_replay_key.sql')
    check('x402_settlements exists and is readable', settlements !== null, 'apply 20260804000100_x402_payment_id_replay_key.sql')
    if (payments === null || settlements === null) {
      console.log('\n  Nothing was signed. Apply the migration to this environment first.')
      return finish()
    }
  }

  // -- Stage 1: the challenge --------------------------------------------
  stage('Stage 1 -- challenge')
  const challenged = await request()
  check('an unpaid request is answered 402', challenged.status === 402, `got ${challenged.status}`)

  const challengeHeader = challenged.headers.get('PAYMENT-REQUIRED')
  check('the challenge travels in PAYMENT-REQUIRED', Boolean(challengeHeader))
  if (!challengeHeader) return finish()

  const challenge = decode(challengeHeader)
  const requirement: Requirement = challenge.accepts?.[0]
  check('the challenge states x402 version 1', challenge.x402Version === 1)
  check('the challenge names Base Sepolia', requirement?.network === 'base-sepolia', requirement?.network)
  check('the challenge binds to the resource being bought', requirement?.resource === `${baseUrl}${path}`, requirement?.resource)
  check('the challenge names a price', /^[0-9]+$/.test(requirement?.maxAmountRequired ?? ''), requirement?.maxAmountRequired)
  check('the challenge names an asset and a payee', Boolean(requirement?.asset && requirement?.payTo))
  // Verified against the live facilitator: without this it answers
  // invalid_exact_evm_missing_eip712_domain and no payment can ever succeed.
  check('the challenge carries the EIP-712 domain', Boolean(requirement?.extra?.name && requirement?.extra?.version), JSON.stringify(requirement?.extra))
  if (!requirement) return finish()

  // -- Stage 2: the asset is what it claims to be -------------------------
  stage('Stage 2 -- asset and balance on chain')
  const chain = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) })
  const erc20 = parseAbi([
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)',
    'function name() view returns (string)',
    'function version() view returns (string)',
  ])

  let assetOk = false
  let domainName = 'USDC'
  let domainVersion = '2'
  try {
    const [symbol, decimals, balance, name] = await Promise.all([
      chain.readContract({ address: requirement.asset as Hex, abi: erc20, functionName: 'symbol' }),
      chain.readContract({ address: requirement.asset as Hex, abi: erc20, functionName: 'decimals' }),
      chain.readContract({ address: requirement.asset as Hex, abi: erc20, functionName: 'balanceOf', args: [account.address] }),
      chain.readContract({ address: requirement.asset as Hex, abi: erc20, functionName: 'name' }).catch(() => 'USDC'),
    ])
    domainName = String(name)
    // The EIP-712 domain must match the token's own, or the signature is valid
    // and useless. Read it rather than assume the usual '2'.
    domainVersion = await chain.readContract({ address: requirement.asset as Hex, abi: erc20, functionName: 'version' }).then(String).catch(() => '2')

    console.log(`  asset:   ${symbol} (${decimals} decimals) at ${requirement.asset}`)
    console.log(`  balance: ${balance} (need ${requirement.maxAmountRequired})`)
    check('the advertised asset is a real token on this chain', true)
    check('the payer holds enough of it to settle', balance >= BigInt(requirement.maxAmountRequired), `have ${balance}`)
    assetOk = balance >= BigInt(requirement.maxAmountRequired)
  } catch (error) {
    check('the advertised asset is a real token on this chain', false, error instanceof Error ? error.message : 'read failed')
  }
  if (!assetOk) {
    console.log('\n  Fund the payer with Base Sepolia USDC before signing. Nothing was signed.')
    return finish()
  }

  // -- Stage 3: sign ------------------------------------------------------
  stage('Stage 3 -- sign the authorization')
  const now = BigInt(Math.floor(Date.now() / 1000))
  const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as Hex
  const signed = await signAuthorization({
    account,
    requirement: { ...requirement },
    nonce,
    validAfter: now - 60n,
    validBefore: now + BigInt(Math.max(requirement.maxTimeoutSeconds, 120)),
  })
  // Use the token's real domain rather than the assumed one.
  // The challenge's domain must match the token's own, or the facilitator
  // rebuilds a different digest than the one that was signed.
  const domainMatches = signed.domain.name === domainName && signed.domain.version === domainVersion
  check('the published EIP-712 domain matches the token contract', domainMatches, `challenge says ${signed.domain.name} v${signed.domain.version}; contract says ${domainName} v${domainVersion}`)
  check('the authorization is signed', signed.signature.startsWith('0x'))

  const { payload, header } = encodePayload(requirement, signed.message, signed.signature)
  const expectedId = await paymentId(payload)
  console.log(`  payment id: ${expectedId}`)

  // -- Stage 4: pay -------------------------------------------------------
  stage('Stage 4 -- present the payment')
  const paid = await request({ 'PAYMENT-SIGNATURE': header })
  check('the paid request is served', paid.status >= 200 && paid.status < 300, `got ${paid.status}: ${(await paid.clone().text()).slice(0, 300)}`)

  const receiptHeader = paid.headers.get('PAYMENT-RESPONSE')
  if (receiptHeader) {
    const receipt = decode(receiptHeader)
    check('the receipt reports success', receipt.success === true)
    check('the receipt carries a settlement transaction', Boolean(receipt.transaction), receipt.transaction)
    check('the receipt names Base Sepolia in CAIP-2', receipt.network === EXPECTED_CAIP2, receipt.network)
    console.log(`  transaction: ${receipt.transaction}`)
  } else {
    check('the response carries PAYMENT-RESPONSE', false)
  }

  // -- Stage 5: the ledger ------------------------------------------------
  stage('Stage 5 -- what the ledger recorded')
  if (!ledgerUrl || !ledgerKey) {
    console.log('  skipped: no ledger credentials')
  } else {
    const read = readLedger
    const claims = await read('x402_payments', `payment_id=eq.${expectedId}&select=*`)
    check('the claim is recorded under the payload hash', claims?.length === 1, claims === null ? 'ledger unreadable' : `${claims?.length ?? 0} rows`)
    if (claims?.length === 1) {
      check('the claim records the resource that was bought', claims[0].resource === `${baseUrl}${path}`, claims[0].resource)
      check('the claim records the payer', String(claims[0].payer).toLowerCase() === account.address.toLowerCase(), claims[0].payer)
      check('the claim records Base Sepolia', claims[0].network === EXPECTED_CAIP2, claims[0].network)
    }

    const settlements = await read('x402_settlements', `payment_id=eq.${expectedId}&select=*`)
    check('the settlement is recorded separately', settlements?.length === 1, settlements === null ? 'ledger unreadable' : `${settlements?.length ?? 0} rows`)
  }

  // -- Stage 6: replay ----------------------------------------------------
  stage('Stage 6 -- replay the identical payload')
  const replayed = await request({ 'PAYMENT-SIGNATURE': header })
  const replayBody = await replayed.json().catch(() => ({})) as { error?: { code?: string } }
  check('the replay is refused with 409', replayed.status === 409, `got ${replayed.status}`)
  check('and named as an already-used payment', replayBody.error?.code === 'payment_already_used', replayBody.error?.code)
  check('the replay is not served', replayed.status !== 200)

  if (ledgerUrl && ledgerKey) {
    const settlements = await fetch(`${ledgerUrl}/rest/v1/x402_settlements?payment_id=eq.${expectedId}&select=payment_id`, {
      headers: { apikey: ledgerKey, authorization: `Bearer ${ledgerKey}` },
      cache: 'no-store',
    }).then((response) => response.ok ? response.json() as Promise<unknown[]> : null)
    // The refusal must happen locally. A second settlement row would mean the
    // replay reached the facilitator, which is the failure this guards.
    check('the replay never reached settlement', settlements?.length === 1, `${settlements?.length ?? '?'} settlement rows`)
  }

  // -- Stage 7: capacity is returned --------------------------------------
  stage('Stage 7 -- the concurrency slot was returned')
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log('  skipped: set the Upstash variables to assert slot release')
  } else {
    const { activeSlots } = await import('../lib/x402/concurrency.ts')
    const prefix = process.env.X402_TEST_SLOT_PREFIX?.trim() || path
    const held = await activeSlots(prefix)
    // The handler releases in a finally, so by now the slot is back. A held
    // slot here means the route is priced but never frees capacity.
    check('no slot is still held for the resource', held === 0, `${held} held`)
  }

  // -- Stage 8: the flag still governs ------------------------------------
  stage('Stage 8 -- a disabled deployment is unchanged')
  const disabledUrl = process.env.X402_DISABLED_BASE_URL?.trim()
  if (!disabledUrl) {
    console.log('  skipped: set X402_DISABLED_BASE_URL to a deployment with X402_ENABLED unset')
  } else {
    const disabled = await fetch(`${disabledUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', cache: 'no-store',
    })
    check('an unpaid request falls back to 401', disabled.status === 401, `got ${disabled.status}`)
    check('and emits no challenge header', disabled.headers.get('PAYMENT-REQUIRED') === null)
  }
}

function finish(): never {
  console.log(`\n${failures === 0 ? `All ${checks} checks passed.` : `${failures} of ${checks} checks failed.`}`)
  process.exit(failures === 0 ? 0 : 1)
}

if (DRY_RUN) await dryRun()
else await liveRun()

finish()
