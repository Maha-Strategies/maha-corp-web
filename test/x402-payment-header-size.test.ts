import assert from 'node:assert/strict'
import test from 'node:test'

import { priceFor, requirementFor, x402Config, type X402Config } from '../lib/x402/config.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { PAYMENT_HEADER_BUDGET, PAYMENT_HEADER_LIMIT } from '../lib/x402/declaration-compaction.ts'
import { buildTypedData, createPaidFetch, encodePaymentSignature } from '../lib/x402/client.ts'
import { parsePaymentHeader, matchesPaymentContext, PAYMENT_REQUIRED_HEADER, PAYMENT_SIGNATURE_HEADER } from '../lib/x402/protocol.ts'

// The interoperability regression this file exists to prevent.
//
// x402 v2 asks a payer to echo the declaration it was served. Vercel caps a
// request header at 16 KB, and the parser enforces the same 16,384 characters.
// A full Bazaar declaration for a richly documented offer is 10-18 KB of JSON
// before base64 inflates it by a third, so before compaction the real client
// produced 16,232 / 26,920 / 10,376 character headers for the three offers --
// two of which were unpayable by a conforming client. The failure surfaced as
// `payment_header_too_large` on a payload the payer had assembled correctly
// from our own challenge, which is the worst shape a protocol bug can take:
// the client did everything right.
//
// Everything below goes through the real `createPaidFetch` /
// `encodePaymentSignature` path. Hand-constructing a compact extension in a
// test would have proved only that a representation the shipped client never
// emits happens to fit.

const ENV = {
  X402_ENABLED: 'true',
  X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0x0000000000000000000000000000000000000042',
  X402_ASSET: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  X402_NETWORK: 'base',
  X402_RESOURCES: JSON.stringify(X402_OFFERS.map((offer) => ({ method: offer.method, path: offer.path }))),
}
const config = () => x402Config(ENV) as X402Config
const ORIGIN = 'https://www.mahastrategies.com'

const facilitator = { verify: async () => ({ ok: true as const, payer: '0xAgent' }), settle: async () => ({ ok: true as const, payer: '0xAgent', transaction: 'tx_1' }) }
const ledger = () => ({ rpc: async () => ({ data: 'claimed', error: null }) }) as never
const acquire = async () => ({ admitted: true, active: 1, token: 'slot-token' })

/** A store that always grants the claim, for tests about other things. */
const admissionLedger = (decision = 'proceed', transaction: string | null = null) => ({
  rpc: async (name: string) => name === 'reserve_x402_admission'
    ? { data: [{ decision, payment_transaction: transaction }], error: null }
    : { data: null, error: null },
})

/** Headers a payer must send for an offer that creates a job. */
const IDEMPOTENT = {
  'x-maha-idempotency-key': 'req_behaviour_0001',
  'x-maha-input-hash': `sha256:${'a'.repeat(64)}`,
}


/**
 * A fetch backed by the real gateway, so the challenge a client answers is the
 * one production would send.
 */
function serverBackedFetch(capture: { header?: string }) {
  return async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers = new Headers(init.headers as HeadersInit)
    const request = new Request(url, { method: init.method ?? 'POST', headers, body: init.body as BodyInit })

    const signature = headers.get(PAYMENT_SIGNATURE_HEADER)
    if (signature) capture.header = signature

    const outcome = await resolveX402(request, { config: config(), facilitator, ledger: ledger(), acquire, admissionLedger: admissionLedger() })
    if (outcome.kind === 'challenge') {
      return new Response(JSON.stringify(outcome.body), { status: 402, headers: { [PAYMENT_REQUIRED_HEADER]: outcome.header } })
    }
    if (outcome.kind === 'paid') return new Response('{"ok":true}', { status: 201 })
    return new Response(JSON.stringify(outcome), { status: 500 })
  }
}

/** Drives the shipped client end to end and returns the header it produced. */
async function headerFromRealClient(path: string): Promise<string> {
  const capture: { header?: string } = {}
  const paidFetch = createPaidFetch({
    address: '0x00000000000000000000000000000000000000aa',
    chainId: 8453,
    fetchImpl: serverBackedFetch(capture) as typeof fetch,
    // A deterministic stand-in for a wallet. Size is what is under test, and a
    // real secp256k1 signature is a fixed 132 characters either way.
    signTypedData: async () => `0x${'c'.repeat(130)}`,
  })

  const response = await paidFetch(`${ORIGIN}${path}`, {
    method: 'POST',
    // Sent for every offer. Only the job-creating ones require them, and a
    // header an offer ignores costs nothing -- but it must be counted in the
    // size budget, because a real payer of the MPS offer sends it.
    headers: { 'content-type': 'application/json', ...IDEMPOTENT },
    body: '{}',
  })
  assert.equal(response.status, 201, `${path} must be admitted after paying`)
  assert.ok(capture.header, `${path} produced no PAYMENT-SIGNATURE`)
  return capture.header!
}

test('the real client produces a payment header for every offer', async () => {
  for (const offer of X402_OFFERS) {
    const header = await headerFromRealClient(offer.path)
    assert.ok(header.length > 0)
  }
})

test('every offer stays inside the conservative payment-header budget', async () => {
  // Two ceilings on purpose. The limit is what breaks; the budget is what
  // fails the build, and the gap is the room a future field has to grow into.
  // A declaration that fits the limit exactly is one property away from an
  // unpayable offer, and that failure would first be seen by a paying agent.
  const measured: string[] = []
  for (const offer of X402_OFFERS) {
    const header = await headerFromRealClient(offer.path)
    measured.push(`${offer.id}=${header.length}`)
    assert.ok(
      header.length < PAYMENT_HEADER_BUDGET,
      `${offer.id} payment header is ${header.length} characters, over the ${PAYMENT_HEADER_BUDGET} budget (hard limit ${PAYMENT_HEADER_LIMIT}). Compact the declaration or move detail to declarationUrl.`,
    )
  }
  console.log('    payment header sizes:', measured.join(' '))
})

test('the header the real client emits is accepted by the real parser', async () => {
  for (const offer of X402_OFFERS) {
    const header = await headerFromRealClient(offer.path)
    const parsed = parsePaymentHeader(header)
    assert.equal(parsed.ok, true, `${offer.id}: ${parsed.ok ? '' : parsed.reason}`)
  }
})

test('a standard full-echo client is still accepted, not only our own', async () => {
  // Criterion the compaction exists to protect: an external x402 v2 client
  // echoes `challenge.extensions` verbatim, and that must keep working. It is
  // also why the fix was compaction rather than a Maha-only compact binding --
  // shrinking what we *send* is what lets a conforming client's echo fit,
  // instead of requiring every client to speak a private dialect.
  for (const offer of X402_OFFERS) {
    const url = `${ORIGIN}${offer.path}`
    const priced = priceFor('POST', offer.path, config())!
    const requirement = requirementFor(priced, url, config())
    const extensions = await discoveryExtensionsFor(priced, url, requirement)

    // The full echo, exactly as encodePaymentSignature builds it.
    const typedData = buildTypedData(requirement as never, '0x00000000000000000000000000000000000000aa')
    const header = encodePaymentSignature(
      requirement as never,
      typedData.message,
      `0x${'c'.repeat(130)}`,
      { resource: resourceInfoFor(priced, url) as never, extensions },
    )

    assert.ok(header.length < PAYMENT_HEADER_BUDGET, `${offer.id} full echo is ${header.length} characters`)
    const parsed = parsePaymentHeader(header)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) continue
    assert.equal(
      matchesPaymentContext(parsed.payment, resourceInfoFor(priced, url), extensions),
      true,
      `${offer.id}: a full echo must bind`,
    )
  }
})

test('digest-only binding remains accepted as an optional shortcut', async () => {
  // Kept, documented as a Maha extension, and deliberately not required.
  // Interoperability rests on the full echo fitting; this only spares a client
  // that already holds the digest from resending the declaration.
  const offer = X402_OFFERS[1]!
  const url = `${ORIGIN}${offer.path}`
  const priced = priceFor('POST', offer.path, config())!
  const requirement = requirementFor(priced, url, config())
  const extensions = await discoveryExtensionsFor(priced, url, requirement)

  const digestOnly = { 'declaration-integrity': extensions!['declaration-integrity'] }
  assert.equal(
    matchesPaymentContext(
      { x402Version: 2, resource: resourceInfoFor(priced, url), accepted: {}, extensions: digestOnly } as never,
      resourceInfoFor(priced, url),
      extensions,
    ),
    true,
  )
})

test('the compacted declaration still tells a client where the full one lives', async () => {
  for (const offer of X402_OFFERS) {
    const url = `${ORIGIN}${offer.path}`
    const priced = priceFor('POST', offer.path, config())!
    const extensions = await discoveryExtensionsFor(priced, url, requirementFor(priced, url, config()))
    const published = extensions!['maha-offer'] as { declarationUrl: string; declarationInline: string }

    assert.equal(published.declarationInline, 'compact')
    assert.equal(published.declarationUrl, `${ORIGIN}/api/discovery/x402-offers/${offer.id}`)
  }
})

test('the compacted inline schema still accepts the published example', async () => {
  // Compaction must only ever loosen. A compacted schema that rejected a valid
  // payload would tell a client its correct request is malformed -- and the
  // client would believe the schema, because that is what a schema is for.
  const { validate } = await import('./helpers/json-schema.ts')
  for (const offer of X402_OFFERS) {
    const url = `${ORIGIN}${offer.path}`
    const priced = priceFor('POST', offer.path, config())!
    const extensions = await discoveryExtensionsFor(priced, url, requirementFor(priced, url, config()))
    const info = (extensions!.bazaar as { info: { input: { body: unknown } } }).info
    const schema = (extensions!.bazaar as { schema: { properties: { input: { properties: { body: Record<string, unknown> } } } } }).schema

    const problems = validate(info.input.body, schema.properties.input.properties.body)
    assert.deepEqual(problems, [], `${offer.id} inline example vs inline schema: ${problems.join('; ')}`)
  }
})

test('the input example a crawler replays is published verbatim', async () => {
  // The deep contract requires each evidence span to be an exact substring of
  // its document. Truncating the input example would silently break that, and
  // a crawler that paid and replayed it would receive a 400 for a request our
  // own declaration handed it. Only schemas and response examples are reduced.
  const offer = X402_OFFERS[1]!
  const url = `${ORIGIN}${offer.path}`
  const priced = priceFor('POST', offer.path, config())!
  const extensions = await discoveryExtensionsFor(priced, url, requirementFor(priced, url, config()))
  const body = (extensions!.bazaar as { info: { input: { body: Record<string, unknown> } } }).info.input.body

  assert.deepEqual(body, offer.discovery.input)

  const documents = body.documents as { id: string; text: string }[]
  const evidence = body.requiredEvidence as { sourceId: string; text: string }[]
  for (const span of evidence) {
    const source = documents.find((document) => document.id === span.sourceId)
    assert.ok(source, `evidence names a document that is not in the example`)
    assert.ok(source!.text.includes(span.text), 'the published example must remain callable')
  }
})
