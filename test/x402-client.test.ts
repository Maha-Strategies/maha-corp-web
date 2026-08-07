import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NETWORK_CHAIN_IDS,
  X402PaymentError,
  buildTypedData,
  createPaidFetch,
  decodeChallenge,
  encodePaymentSignature,
  selectRequirement,
  type PaymentRequirement,
} from '../lib/x402/client.ts'
import { paymentId } from '../lib/x402/protocol.ts'
import { formatAmount } from '../lib/hooks/usePaidFetch.ts'

// The buyer side, tested against the bytes the seller actually sends. The
// pairing that matters is the last test: the header this builds must hash to
// the id the server claims against, or replay protection guards nothing.

const REQUIREMENT: PaymentRequirement = {
  scheme: 'exact',
  network: 'eip155:84532',
  amount: '10000',
  payTo: '0x86C2372038774e160b61903D5EDC14bE9233752F',
  maxTimeoutSeconds: 60,
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  extra: { name: 'USDC', version: '2' },
}

const ADDRESS = '0x1111111111111111111111111111111111111111'
const SIGNATURE = `0x${'ab'.repeat(65)}`

const toBase64 = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
const RESOURCE = { url: 'https://maha.test/api/v1/compress', description: 'One context compression', mimeType: 'application/json' }
const EXTENSIONS = { bazaar: { info: { input: { type: 'http', method: 'POST' } }, schema: {} } }
const challengeHeader = (accepts: PaymentRequirement[] = [REQUIREMENT], error = 'Payment is required for this resource.') =>
  toBase64({ x402Version: 2, resource: RESOURCE, accepts, extensions: EXTENSIONS, error })

function server(options: {
  onPaid?: (header: string | null) => Response
  challenge?: string
} = {}) {
  const seen: Array<{ signature: string | null; body: string | null }> = []
  const impl = (async (_input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers as HeadersInit)
    const signature = headers.get('PAYMENT-SIGNATURE')
    seen.push({ signature, body: typeof init.body === 'string' ? init.body : null })
    if (!signature) {
      return new Response(JSON.stringify({ x402Version: 2 }), {
        status: 402,
        headers: { 'PAYMENT-REQUIRED': options.challenge ?? challengeHeader() },
      })
    }
    return options.onPaid
      ? options.onPaid(signature)
      : new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'PAYMENT-RESPONSE': toBase64({ success: true, transaction: '0xtx', network: 'eip155:84532', payer: ADDRESS }) },
        })
  }) as unknown as typeof fetch
  return { impl, seen }
}

const signer = async () => SIGNATURE

test('a request that needs no payment is returned untouched', async () => {
  let prompted = 0
  const impl = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
  const paidFetch = createPaidFetch({ signTypedData: async () => { prompted += 1; return SIGNATURE }, address: ADDRESS, chainId: 84532, fetchImpl: impl })

  assert.equal((await paidFetch('https://maha.test/api/v1/compress')).status, 200)
  // No wallet prompt for a free resource.
  assert.equal(prompted, 0)
})

test('a 402 is answered by signing once and asking again', async () => {
  const { impl, seen } = server()
  const paidFetch = createPaidFetch({ signTypedData: signer, address: ADDRESS, chainId: 84532, fetchImpl: impl })

  const response = await paidFetch('https://maha.test/api/v1/compress', { method: 'POST', body: '{"task":"x"}' })
  assert.equal(response.status, 200)
  assert.equal(seen.length, 2, 'exactly one retry')
  assert.equal(seen[0].signature, null)
  assert.ok(seen[1].signature)
  assert.equal(response.x402?.receipt?.transaction, '0xtx')
})

test('the retried request carries the original body and headers', async () => {
  // The body is sent twice. Losing it on the retry serves an empty request
  // that has already been paid for.
  const { impl, seen } = server()
  const paidFetch = createPaidFetch({ signTypedData: signer, address: ADDRESS, chainId: 84532, fetchImpl: impl })
  await paidFetch('https://maha.test/api/v1/compress', {
    method: 'POST', body: '{"task":"summarise"}', headers: { 'content-type': 'application/json' },
  })
  assert.equal(seen[1].body, '{"task":"summarise"}')
})

test('a streamed body survives being sent twice', async () => {
  const stream = new Response('{"task":"streamed"}').body!
  const { impl, seen } = server()
  const paidFetch = createPaidFetch({ signTypedData: signer, address: ADDRESS, chainId: 84532, fetchImpl: impl })
  // A ReadableStream cannot be replayed. Discovering that at the retry means
  // discovering it after the wallet has already signed.
  await paidFetch('https://maha.test/api/v1/compress', { method: 'POST', body: stream })
  assert.equal(seen.length, 2)
})

test('the signed payload is the terms the server published', async () => {
  const typedData = buildTypedData(REQUIREMENT, ADDRESS, 1_800_000_000_000)
  assert.equal(typedData.domain.chainId, 84532)
  assert.equal(typedData.domain.verifyingContract, REQUIREMENT.asset)
  // From the challenge, not a constant. A different domain signs something the
  // facilitator will not reconstruct.
  assert.equal(typedData.domain.name, 'USDC')
  assert.equal(typedData.domain.version, '2')
  assert.equal(typedData.message.to, REQUIREMENT.payTo)
  assert.equal(typedData.message.value, BigInt(10_000))
  assert.equal(typedData.message.from, ADDRESS)
  assert.match(typedData.message.nonce, /^0x[0-9a-f]{64}$/)
  // Match the reference EVM authorization window exactly.
  assert.equal(typedData.message.validAfter, BigInt(1_800_000_000 - 600))
  assert.equal(typedData.message.validBefore, BigInt(1_800_000_000 + REQUIREMENT.maxTimeoutSeconds))
})

test('each payment gets its own nonce', () => {
  const first = buildTypedData(REQUIREMENT, ADDRESS)
  const second = buildTypedData(REQUIREMENT, ADDRESS)
  assert.notEqual(first.message.nonce, second.message.nonce)
})

test('a requirement is only selected for the chain the wallet is on', () => {
  const challenge = decodeChallenge(challengeHeader())
  assert.equal(selectRequirement(challenge, 84532)?.network, 'eip155:84532')
  // Signing on the wrong chain yields a signature that is valid and useless.
  assert.equal(selectRequirement(challenge, 8453), null)
  assert.equal(NETWORK_CHAIN_IDS['eip155:84532'], 84532)
})

test('a wallet on the wrong chain is told which one to switch to, before signing', async () => {
  let prompted = 0
  const { impl } = server()
  const paidFetch = createPaidFetch({ signTypedData: async () => { prompted += 1; return SIGNATURE }, address: ADDRESS, chainId: 1, fetchImpl: impl })

  const error = await paidFetch('https://maha.test/api/v1/compress').then(() => null, (e) => e as X402PaymentError)
  assert.equal(error?.code, 'wrong_network')
  assert.match(error!.message, /84532/)
  assert.equal(prompted, 0, 'no wallet prompt that could not have succeeded')
})

test('a disconnected wallet is reported rather than prompted', async () => {
  const { impl } = server()
  const paidFetch = createPaidFetch({ signTypedData: signer, address: undefined, chainId: 84532, fetchImpl: impl })
  const error = await paidFetch('https://maha.test/api/v1/compress').then(() => null, (e) => e as X402PaymentError)
  assert.equal(error?.code, 'wallet_not_connected')
})

test('a declined signature is an ordinary outcome, and nothing settled', async () => {
  const { impl, seen } = server()
  const paidFetch = createPaidFetch({
    signTypedData: async () => { throw new Error('User rejected the request.') },
    address: ADDRESS, chainId: 84532, fetchImpl: impl,
  })
  const error = await paidFetch('https://maha.test/api/v1/compress').then(() => null, (e) => e as X402PaymentError)
  assert.equal(error?.code, 'signature_rejected')
  assert.equal(error?.settled, false)
  assert.equal(seen.length, 1, 'nothing was presented')
})

test('a replayed payment says so, and says money already moved', async () => {
  const { impl } = server({ onPaid: () => new Response(JSON.stringify({ error: { code: 'payment_already_used' } }), { status: 409 }) })
  const paidFetch = createPaidFetch({ signTypedData: signer, address: ADDRESS, chainId: 84532, fetchImpl: impl })
  const error = await paidFetch('https://maha.test/api/v1/compress').then(() => null, (e) => e as X402PaymentError)

  assert.equal(error?.code, 'payment_already_used')
  assert.match(error!.message, /Payment already used/)
  // The distinction a payer actually needs: an earlier payment succeeded.
  assert.equal(error?.settled, true)
})

test('a ledger failure says the money did not move', async () => {
  const { impl } = server({ onPaid: () => new Response(JSON.stringify({ error: { code: 'x402_ledger_unavailable' } }), { status: 503 }) })
  const paidFetch = createPaidFetch({ signTypedData: signer, address: ADDRESS, chainId: 84532, fetchImpl: impl })
  const error = await paidFetch('https://maha.test/api/v1/compress').then(() => null, (e) => e as X402PaymentError)

  assert.equal(error?.code, 'ledger_unavailable')
  assert.match(error!.message, /were not settled/)
  assert.equal(error?.settled, false, 'retrying is free')
})

test('a second 402 is reported, never answered with another payment', async () => {
  let payments = 0
  const { impl } = server({
    onPaid: () => {
      payments += 1
      return new Response(JSON.stringify({ x402Version: 2 }), {
        status: 402,
        headers: { 'PAYMENT-REQUIRED': challengeHeader([REQUIREMENT], 'invalid_exact_evm_insufficient_balance') },
      })
    },
  })
  const paidFetch = createPaidFetch({ signTypedData: signer, address: ADDRESS, chainId: 84532, fetchImpl: impl })
  const error = await paidFetch('https://maha.test/api/v1/compress').then(() => null, (e) => e as X402PaymentError)

  assert.equal(error?.code, 'payment_rejected')
  // The facilitator's own reason, not a generic failure.
  assert.match(error!.message, /insufficient_balance/)
  // A loop here would prompt the wallet repeatedly and could settle several
  // payments for one resource.
  assert.equal(payments, 1)
})

test('a capacity refusal does not imply the payment was lost', async () => {
  const { impl } = server({ onPaid: () => new Response(JSON.stringify({ error: { code: 'resource_at_capacity' } }), { status: 429 }) })
  const paidFetch = createPaidFetch({ signTypedData: signer, address: ADDRESS, chainId: 84532, fetchImpl: impl })
  const error = await paidFetch('https://maha.test/api/v1/compress').then(() => null, (e) => e as X402PaymentError)
  assert.equal(error?.code, 'resource_at_capacity')
})

test('a challenge that cannot be read is a clear error, not a crash', () => {
  assert.throws(() => decodeChallenge(null), /no PAYMENT-REQUIRED header/)
  assert.throws(() => decodeChallenge('not-base64!!'), X402PaymentError)
  assert.throws(() => decodeChallenge(toBase64({ x402Version: 2, resource: RESOURCE, accepts: [] })), /no terms/)
})

test('the header the client builds hashes to the id the server claims against', async () => {
  // The whole replay guard rests on this. If the two sides disagree about what
  // a payment is, duplicates are never detected and nothing anywhere says so.
  const typedData = buildTypedData(REQUIREMENT, ADDRESS)
  const header = encodePaymentSignature(REQUIREMENT, typedData.message, SIGNATURE, { resource: RESOURCE, extensions: EXTENSIONS })
  const serverSide = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))

  assert.equal(serverSide.x402Version, 2)
  assert.equal(serverSide.accepted.scheme, 'exact')
  assert.equal(serverSide.accepted.network, 'eip155:84532')
  assert.deepEqual(serverSide.resource, RESOURCE)
  assert.deepEqual(serverSide.extensions, EXTENSIONS)
  // BigInts must cross as decimal strings; JSON cannot carry them natively.
  assert.equal(serverSide.payload.authorization.value, '10000')
  assert.equal(typeof serverSide.payload.authorization.validBefore, 'string')

  const id = await paymentId(serverSide)
  assert.match(id, /^[0-9a-f]{64}$/)
  // Re-presenting the identical header is the same payment, which is exactly
  // what the server's 409 depends on.
  assert.equal(await paymentId(JSON.parse(Buffer.from(header, 'base64').toString('utf8'))), id)
})

test('amounts are shown to people in the asset, not in base units', () => {
  assert.equal(formatAmount(REQUIREMENT), '0.01 USDC')
  assert.equal(formatAmount({ ...REQUIREMENT, amount: '1500000' }), '1.5 USDC')
  assert.equal(formatAmount({ ...REQUIREMENT, amount: '2000000' }), '2 USDC')
})
