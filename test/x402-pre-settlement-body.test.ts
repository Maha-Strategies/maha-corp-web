import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { compileContextPack, maxContextPackBytes, parseContextPackRequest } from '../lib/context-compiler.ts'
import { MAX_X402_EVALUATION_BYTES, buildDeepContextEvaluation, parseDeepContextRequest } from '../lib/deep-context-evaluation.ts'
import { buildBookEditionReceipt } from '../lib/x402/book-edition-product.ts'
import { MACHINE_BOOK_IDS, buildBookSectionReceipt, resolveBookSectionRequest, type MachineBookId } from '../lib/x402/book-section-product.ts'
import { getOpenBookEdition } from '../lib/open-book-editions.ts'
import { priceFor, requirementFor, x402Config, type X402Config } from '../lib/x402/config.ts'
import {
  buildContextBudgetLadder,
  buildEvidenceRetentionMatrix,
  buildGovernedContextVerificationPack,
} from '../lib/x402/context-product-family.ts'
import { discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { X402_OFFERS, type X402Offer } from '../lib/x402/offers.ts'
import { hasPreSettlementBodyContract, validatePreSettlementBody } from '../lib/x402/pre-settlement-body.ts'
import type { PaymentFacilitator } from '../lib/x402/protocol.ts'

// A signed request whose body its route would reject used to be verified and
// settled first, and then answered 400, 413 or 415 by the handler. These tests
// prove the rejection now happens before any of: facilitator verify, settle,
// the replay-guard claim, and the capacity slot.

const ORIGIN = 'https://www.mahastrategies.com'
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** What each route runs once the proxy admits it, called the way the route calls it. */
const EXECUTION: Record<string, (value: unknown) => unknown> = {
  'context-compression': (value) => compileContextPack(parseContextPackRequest(value)),
  'deep-context-evaluation': (value) => buildDeepContextEvaluation(parseDeepContextRequest(value)),
  'context-budget-ladder': buildContextBudgetLadder,
  'evidence-retention-matrix': buildEvidenceRetentionMatrix,
  'governed-context-verification-pack': buildGovernedContextVerificationPack,
  'book-section-the-imagined-life': (value) => buildBookSectionReceipt('the-imagined-life', value),
  'book-section-the-volcanic-engine': (value) => buildBookSectionReceipt('the-volcanic-engine', value),
  'book-edition-the-imagined-life': (value) => buildBookEditionReceipt('the-imagined-life', value),
  'book-edition-the-volcanic-engine': (value) => buildBookEditionReceipt('the-volcanic-engine', value),
}

const ROUTES: Record<string, string> = {
  'context-compression': 'app/api/v1/compress/route.ts',
  'deep-context-evaluation': 'app/api/v1/compress/evaluate/route.ts',
  'context-budget-ladder': 'app/api/v1/context/budget-ladder/route.ts',
  'evidence-retention-matrix': 'app/api/v1/context/evidence-matrix/route.ts',
  'governed-context-verification-pack': 'app/api/v1/context/governed-verification/route.ts',
  'book-section-the-imagined-life': 'lib/x402/book-section-route.ts',
  'book-section-the-volcanic-engine': 'lib/x402/book-section-route.ts',
  'book-edition-the-imagined-life': 'lib/x402/book-edition-route.ts',
  'book-edition-the-volcanic-engine': 'lib/x402/book-edition-route.ts',
}

const REGISTERED = X402_OFFERS.filter((offer) => hasPreSettlementBodyContract(offer.id))
const example = (offer: X402Offer) => offer.discovery!.input as Record<string, unknown>

test('every proxy-priced offer without an admission claim has a pre-settlement body contract', () => {
  // MPS audit and research intake bind the body in admission-body.ts; micro
  // and celestial routes are self-managed and parse before they call the gateway.
  const expected = X402_OFFERS
    .filter((offer) => !offer.requiresIdempotency)
    .filter((offer) => !offer.path.startsWith('/api/v1/micro/') && !offer.path.startsWith('/api/v1/calculations/'))
    .map((offer) => offer.id)
    .sort()
  assert.deepEqual(REGISTERED.map((offer) => offer.id).sort(), expected)
  assert.deepEqual(Object.keys(EXECUTION).sort(), expected)
})

// ---------------------------------------------------------------------------
// The gateway contract is the execution contract
// ---------------------------------------------------------------------------

function mutations(offer: X402Offer): unknown[] {
  const base = example(offer)
  const cases: unknown[] = [null, [], 'text', 7, { ...base, unexpectedField: true }]
  for (const key of Object.keys(base)) {
    const without = { ...base }
    delete without[key]
    cases.push(without, { ...base, [key]: null }, { ...base, [key]: '' }, { ...base, [key]: 10_000_000 })
  }
  if (Array.isArray(base.documents)) {
    const [first] = base.documents as Record<string, unknown>[]
    cases.push(
      { ...base, documents: [] },
      { ...base, documents: [first, first] },
      { ...base, documents: [{ ...first, id: '-bad id' }] },
      { ...base, documents: Array.from({ length: 9 }, (_, index) => ({ ...first, id: `doc-${index}` })) },
    )
  }
  if (Array.isArray(base.requiredEvidence)) {
    const [evidence] = base.requiredEvidence as Record<string, unknown>[]
    cases.push(
      { ...base, requiredEvidence: [] },
      { ...base, requiredEvidence: [{ ...evidence, text: 'not a span of any supplied source document' }] },
      { ...base, requiredEvidence: [{ ...evidence, sourceId: 'missing-source' }] },
    )
  }
  return cases
}

const jsonRequest = (offer: X402Offer, body: string, contentType = 'application/json') =>
  new Request(`${ORIGIN}${offer.path}`, { method: 'POST', headers: { 'content-type': contentType }, body })

const throws = (run: () => unknown) => { try { run(); return false } catch { return true } }

test('the gateway rejects exactly the bodies execution rejects, for every registered offer', async () => {
  for (const offer of REGISTERED) {
    const execute = EXECUTION[offer.id]
    assert.equal(throws(() => execute(example(offer))), false, `${offer.id}: the published example executes`)
    assert.deepEqual(await validatePreSettlementBody(jsonRequest(offer, JSON.stringify(example(offer))), offer), { ok: true }, `${offer.id}: example admitted`)
    for (const value of mutations(offer)) {
      const decision = await validatePreSettlementBody(jsonRequest(offer, JSON.stringify(value)), offer)
      const label = `${offer.id}: ${JSON.stringify(value).slice(0, 80)}`
      assert.equal(!decision.ok, throws(() => execute(value)), label)
      if (!decision.ok) {
        assert.equal(decision.status, 400, label)
        assert.equal(decision.code, 'invalid_request', label)
        assert.match(decision.message, /No payment was taken\.$/, label)
      }
    }
  }
})

// ---------------------------------------------------------------------------
// Book sections: existence is decided by the edition's own lookup, before payment
// ---------------------------------------------------------------------------

const SECTION_OFFERS = REGISTERED.filter((entry) => entry.id.startsWith('book-section-'))
const bookOf = (offer: X402Offer) => offer.id.replace('book-section-', '') as MachineBookId
const slugsOf = (bookId: string) => getOpenBookEdition(bookId)!.sections.map((section) => section.slug)

test('every published section of each machine book is admitted and executes', async () => {
  assert.equal(SECTION_OFFERS.length, MACHINE_BOOK_IDS.length)
  for (const offer of SECTION_OFFERS) {
    const slugs = slugsOf(bookOf(offer))
    assert.ok(slugs.length > 0)
    for (const sectionId of slugs) {
      const body = { sectionId }
      assert.deepEqual(await validatePreSettlementBody(jsonRequest(offer, JSON.stringify(body)), offer), { ok: true }, `${offer.id}: ${sectionId}`)
      assert.equal((EXECUTION[offer.id](body) as { section: { id: string } }).section.id, sectionId)
    }
  }
})

test('a well-formed sectionId the edition does not publish is refused before payment', async () => {
  const otherBookOnly = (bookId: string) => MACHINE_BOOK_IDS.filter((id) => id !== bookId).flatMap(slugsOf).filter((slug) => !slugsOf(bookId).includes(slug))
  const nonMachineBook = slugsOf('the-cosmic-recursion').filter((slug) => !MACHINE_BOOK_IDS.flatMap(slugsOf).includes(slug))
  for (const offer of SECTION_OFFERS) {
    const bookId = bookOf(offer)
    const cases = [
      ['nonexistent section', 'no-such-section-anywhere'],
      ['section of the other machine book', otherBookOnly(bookId)[0]],
      ['section of a book with no machine offer', nonMachineBook[0]],
    ] as const
    for (const [label, sectionId] of cases) {
      assert.ok(sectionId, `${offer.id}: fixture for ${label}`)
      const body = { sectionId }
      const decision = await validatePreSettlementBody(jsonRequest(offer, JSON.stringify(body)), offer)
      assert.deepEqual(decision, { ok: false, status: 400, code: 'invalid_request', message: 'Unknown sectionId for this edition. No payment was taken.' }, `${offer.id}: ${label}`)
      assert.throws(() => EXECUTION[offer.id](body), /Unknown sectionId for this edition\./, `${offer.id}: ${label} is also refused by execution`)
    }
  }
})

test('the resolver refuses a book that has no machine offer, even for its own published section', () => {
  const [sectionId] = slugsOf('the-cosmic-recursion')
  assert.throws(() => resolveBookSectionRequest('the-cosmic-recursion' as MachineBookId, { sectionId }), /Book is not available\./)
  assert.throws(() => buildBookSectionReceipt('the-cosmic-recursion' as MachineBookId, { sectionId }), /Book is not available\./)
})

test('media type, size and JSON syntax follow each route handler', async () => {
  for (const offer of REGISTERED) {
    const route = read(ROUTES[offer.id])
    assert.match(route, /headers\.get\('content-type'\)\?\.toLowerCase\(\)\.startsWith\('application\/json'\)/, `${offer.id}: same media-type rule`)
    const valid = JSON.stringify(example(offer))

    const wrongType = await validatePreSettlementBody(jsonRequest(offer, valid, 'text/plain'), offer)
    assert.deepEqual(wrongType.ok ? null : [wrongType.status, wrongType.code], [415, 'unsupported_media_type'], offer.id)
    const charset = await validatePreSettlementBody(jsonRequest(offer, valid, 'Application/JSON; charset=utf-8'), offer)
    assert.equal(charset.ok, true, `${offer.id}: parameters and case are accepted, as in the route`)

    const syntax = await validatePreSettlementBody(jsonRequest(offer, '{"secret-looking value'), offer)
    assert.deepEqual(syntax.ok ? null : [syntax.status, syntax.code], [400, 'invalid_request'], offer.id)
    if (!syntax.ok) assert.doesNotMatch(syntax.message, /secret-looking/, 'a JSON syntax error never echoes the body')

    // One byte over the published limit, measured in UTF-8 bytes like the route.
    const oversized = `${' '.repeat(offer.maxRequestBytes - valid.length)}${valid}é`
    assert.equal(new TextEncoder().encode(oversized).byteLength, offer.maxRequestBytes + 2)
    const tooLarge = await validatePreSettlementBody(jsonRequest(offer, oversized), offer)
    assert.deepEqual(tooLarge.ok ? null : [tooLarge.status, tooLarge.code], [413, 'payload_too_large'], offer.id)
    const atLimit = `${' '.repeat(offer.maxRequestBytes - valid.length)}${valid}`
    assert.equal((await validatePreSettlementBody(jsonRequest(offer, atLimit), offer)).ok, true, `${offer.id}: the limit itself is accepted`)
  }
  // The route limits for a caller without an enterprise key are the published ones.
  const byId = Object.fromEntries(REGISTERED.map((offer) => [offer.id, offer]))
  assert.equal(maxContextPackBytes(null), byId['context-compression'].maxRequestBytes)
  assert.equal(MAX_X402_EVALUATION_BYTES, byId['deep-context-evaluation'].maxRequestBytes)
  for (const id of ['context-budget-ladder', 'evidence-retention-matrix', 'governed-context-verification-pack', 'book-section-the-imagined-life', 'book-edition-the-imagined-life']) {
    assert.match(read(ROUTES[id]), /Buffer\.byteLength\(raw, 'utf8'\) > [A-Za-z_]+\.maxRequestBytes/, `${id}: route limit is the offer's maxRequestBytes`)
  }
})

// ---------------------------------------------------------------------------
// Rejected bodies cost nothing: no verify, settle, claim or slot
// ---------------------------------------------------------------------------

const config = () => x402Config({
  X402_ENABLED: 'true',
  X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0xSettlement',
  X402_ASSET: '0xUSDC',
  X402_NETWORK: 'base',
  X402_RESOURCES: JSON.stringify(REGISTERED.map((offer) => ({ method: offer.method, path: offer.path }))),
}) as X402Config

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64')

async function signatureFor(offer: X402Offer) {
  const priced = priceFor('POST', offer.path, config())!
  const url = `${ORIGIN}${offer.path}`
  const accepted = requirementFor(priced, url, config())
  return encode({
    x402Version: 2,
    resource: resourceInfoFor(priced, url),
    accepted,
    payload: { signature: '0x' },
    extensions: await discoveryExtensionsFor(priced, url, accepted),
  })
}

function spies() {
  const calls = { verify: 0, settle: 0, claim: 0, acquire: 0, release: 0 }
  const facilitator: PaymentFacilitator = {
    verify: async () => { calls.verify += 1; return { ok: true, payer: '0xAgent' } },
    settle: async () => { calls.settle += 1; return { ok: true, payer: '0xAgent', transaction: 'tx_1' } },
  }
  const ledger = { rpc: async () => { calls.claim += 1; return { data: 'claimed', error: null } } }
  const acquire = async () => { calls.acquire += 1; return { admitted: true, active: 1, token: 'slot-token' } }
  const release = async () => { calls.release += 1 }
  return { calls, dependencies: { config: config(), facilitator, ledger, acquire, release, confirmOnChain: async () => ({ status: 'confirmed' as const }) } }
}

test('a signed request with a rejected body is refused before verification, settlement, claim or capacity', async () => {
  for (const offer of REGISTERED) {
    const signature = await signatureFor(offer)
    const valid = JSON.stringify(example(offer))
    const rejected: [string, Request, number, string][] = [
      ['wrong media type', new Request(`${ORIGIN}${offer.path}`, { method: 'POST', headers: { 'PAYMENT-SIGNATURE': signature, 'content-type': 'text/plain' }, body: valid }), 415, 'unsupported_media_type'],
      ['no body', new Request(`${ORIGIN}${offer.path}`, { method: 'POST', headers: { 'PAYMENT-SIGNATURE': signature, 'content-type': 'application/json' } }), 400, 'invalid_request'],
      ['malformed JSON', new Request(`${ORIGIN}${offer.path}`, { method: 'POST', headers: { 'PAYMENT-SIGNATURE': signature, 'content-type': 'application/json' }, body: '{' }), 400, 'invalid_request'],
      ['schema violation', new Request(`${ORIGIN}${offer.path}`, { method: 'POST', headers: { 'PAYMENT-SIGNATURE': signature, 'content-type': 'application/json' }, body: JSON.stringify([example(offer)]) }), 400, 'invalid_request'],
      ['oversized', new Request(`${ORIGIN}${offer.path}`, { method: 'POST', headers: { 'PAYMENT-SIGNATURE': signature, 'content-type': 'application/json' }, body: `${' '.repeat(offer.maxRequestBytes)}${valid}` }), 413, 'payload_too_large'],
    ]
    for (const [label, request, status, code] of rejected) {
      const { calls, dependencies } = spies()
      const outcome = await resolveX402(request, dependencies)
      assert.equal(outcome.kind, 'refused', `${offer.id}: ${label}`)
      if (outcome.kind === 'refused') {
        assert.equal(outcome.status, status, `${offer.id}: ${label}`)
        assert.equal(outcome.code, code, `${offer.id}: ${label}`)
        assert.match(outcome.message, /No payment was taken\./)
      }
      assert.deepEqual(calls, { verify: 0, settle: 0, claim: 0, acquire: 0, release: 0 }, `${offer.id}: ${label} touched payment state`)
    }
  }
})

test('a signed request for an unpublished or cross-book section settles nothing, and the same authorization then pays', async () => {
  for (const offer of SECTION_OFFERS) {
    const bookId = bookOf(offer)
    const signature = await signatureFor(offer)
    const foreign = MACHINE_BOOK_IDS.filter((id) => id !== bookId).flatMap(slugsOf).find((slug) => !slugsOf(bookId).includes(slug))!
    const { calls, dependencies } = spies()
    for (const sectionId of ['no-such-section-anywhere', foreign]) {
      const outcome = await resolveX402(new Request(`${ORIGIN}${offer.path}`, {
        method: 'POST', headers: { 'PAYMENT-SIGNATURE': signature, 'content-type': 'application/json' }, body: JSON.stringify({ sectionId }),
      }), dependencies)
      assert.equal(outcome.kind, 'refused', `${offer.id}: ${sectionId}`)
      if (outcome.kind === 'refused') {
        assert.deepEqual([outcome.status, outcome.code, outcome.message], [400, 'invalid_request', 'Unknown sectionId for this edition. No payment was taken.'])
      }
      assert.deepEqual(calls, { verify: 0, settle: 0, claim: 0, acquire: 0, release: 0 }, `${offer.id}: ${sectionId} touched payment state`)
    }
    const valid = slugsOf(bookId).at(-1)!
    const paid = await resolveX402(new Request(`${ORIGIN}${offer.path}`, {
      method: 'POST', headers: { 'PAYMENT-SIGNATURE': signature, 'content-type': 'application/json' }, body: JSON.stringify({ sectionId: valid }),
    }), dependencies)
    assert.equal(paid.kind, 'paid', `${offer.id}: ${valid}`)
    assert.deepEqual({ verify: calls.verify, settle: calls.settle, acquire: calls.acquire }, { verify: 1, settle: 1, acquire: 1 })
  }
})

test('the same authorization still pays once the body is corrected: nothing was consumed by the refusal', async () => {
  for (const offer of REGISTERED) {
    const signature = await signatureFor(offer)
    const { calls, dependencies } = spies()
    const refused = await resolveX402(new Request(`${ORIGIN}${offer.path}`, {
      method: 'POST', headers: { 'PAYMENT-SIGNATURE': signature, 'content-type': 'application/json' }, body: '[]',
    }), dependencies)
    assert.equal(refused.kind, 'refused', offer.id)

    const body = JSON.stringify(example(offer))
    const request = new Request(`${ORIGIN}${offer.path}`, {
      method: 'POST', headers: { 'PAYMENT-SIGNATURE': signature, 'content-type': 'application/json' }, body,
    })
    const paid = await resolveX402(request, dependencies)
    assert.equal(paid.kind, 'paid', offer.id)
    assert.deepEqual({ ...calls, claim: calls.claim > 0 }, { verify: 1, settle: 1, claim: true, acquire: 1, release: 0 }, offer.id)
    // The check read a clone; the route still receives the original body.
    assert.equal(await request.text(), body, `${offer.id}: body preserved for the handler`)
  }
})

test('an unsigned request is challenged without its body being read, so discovery is unchanged', async () => {
  for (const offer of REGISTERED) {
    let pulled = false
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulled = true; controller.enqueue(new TextEncoder().encode('{')); controller.close() } }, { highWaterMark: 0 })
    const { calls, dependencies } = spies()
    const outcome = await resolveX402(new Request(`${ORIGIN}${offer.path}`, {
      method: 'POST', headers: { 'content-type': 'text/plain' }, body, duplex: 'half',
    } as RequestInit), dependencies)
    assert.equal(outcome.kind, 'challenge', offer.id)
    if (outcome.kind === 'challenge') assert.equal(outcome.status, 402)
    assert.equal(pulled, false, `${offer.id}: body read for an unpaid probe`)
    assert.deepEqual(calls, { verify: 0, settle: 0, claim: 0, acquire: 0, release: 0 })
  }
})

test('offers outside the registry are not read by the gateway, so self-managed routes keep their body', async () => {
  const selfManaged = X402_OFFERS.filter((offer) => !hasPreSettlementBodyContract(offer.id))
  assert.ok(selfManaged.some((offer) => offer.path.startsWith('/api/v1/micro/')))
  for (const offer of selfManaged) {
    const request = new Request(`${ORIGIN}${offer.path}`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'not json' })
    await request.text()
    // A consumed body would make clone() throw; the registry lookup comes first.
    assert.deepEqual(await validatePreSettlementBody(request, offer), { ok: true }, offer.id)
  }
})
