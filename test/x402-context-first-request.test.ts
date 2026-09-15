import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { parseContextPackRequest } from '../lib/context-compiler.ts'
import { parseDeepContextRequest } from '../lib/deep-context-evaluation.ts'
import { openApiDocument } from '../lib/openapi.ts'
import { MAHA_CARP_DIGITAL_OFFERS } from '../lib/carp/seller.ts'
import { x402Config } from '../lib/x402/config.ts'
import { compactSchema } from '../lib/x402/declaration-compaction.ts'
import { OFFER_EXTENSION } from '../lib/x402/discovery.ts'
import { BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { buildOfferSelectionDocument } from '../lib/x402/offer-selection.ts'
import { hasPreSettlementBodyContract } from '../lib/x402/pre-settlement-body.ts'
import { CONTEXT_COMPRESSION_OFFER, DEEP_CONTEXT_EVALUATION_OFFER, type X402Offer } from '../lib/x402/offers.ts'
import { validate } from './helpers/json-schema.ts'

// The first request an independent buyer sends to either context offer.
//
// Every artifact below is something a buyer can read before paying -- the
// discovery declaration, the inline 402 declaration, OpenAPI, the public JSON
// schema files, the CARP catalogue, the offer selection guide -- or a body Maha
// itself publishes a recipe for. Each is checked against the parser the route
// actually runs, because a schema that accepts a body the parser rejects is a
// body the buyer pays for and gets a 400 back.
//
// That matters more here than for most offers: neither offer validates the body
// before settlement (requiresIdempotency is false, and neither reserves capacity
// first), so a malformed first request is charged. See the last test.

const read = (path: string) => readFileSync(path, 'utf8')
/** A public schema file, minus the metadata keywords the independent checker does not interpret. */
const publicSchema = (path: string): Record<string, unknown> => {
  const schema = JSON.parse(read(path)) as Record<string, unknown>
  delete schema.$schema
  delete schema.$id
  return schema
}
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8')

type Case = {
  offer: X402Offer
  parse: (value: unknown) => unknown
  openApiPath: string
  publicSchemaFile: string
}

const CASES: Case[] = [
  { offer: CONTEXT_COMPRESSION_OFFER, parse: parseContextPackRequest, openApiPath: '/api/v1/compress', publicSchemaFile: 'public/context-pack-schema.json' },
  { offer: DEEP_CONTEXT_EVALUATION_OFFER, parse: parseDeepContextRequest, openApiPath: '/api/v1/compress/evaluate', publicSchemaFile: 'public/context-pack-evaluation-schema.json' },
]

function openApiRequestSchema(path: string) {
  const paths = openApiDocument.paths as unknown as Record<string, { post: { requestBody: { content: Record<string, { schema: Record<string, unknown> }> } } }>
  const operation = paths[path].post
  return operation.requestBody.content['application/json'].schema
}

// ---------------------------------------------------------------------------
// 1. The published example is a valid first request everywhere it is published
// ---------------------------------------------------------------------------

for (const { offer, parse, openApiPath, publicSchemaFile } of CASES) {
  test(`${offer.id}: the discovery example is accepted by the parser the route runs`, () => {
    assert.doesNotThrow(() => parse(structuredClone(offer.discovery.input)))
    assert.ok(bytes(offer.discovery.input) <= offer.maxRequestBytes, 'the example fits the published byte limit')
  })

  test(`${offer.id}: the discovery example validates against every schema a buyer can read`, () => {
    const input = offer.discovery.input
    assert.deepEqual(validate(input, offer.discovery.inputSchema), [], 'full discovery schema (declaration URL)')
    assert.deepEqual(validate(input, compactSchema(offer.discovery.inputSchema)), [], 'compact schema inlined in the 402')
    assert.deepEqual(validate(input, openApiRequestSchema(openApiPath)), [], `OpenAPI ${openApiPath}`)
    assert.deepEqual(validate(input, publicSchema(publicSchemaFile)), [], publicSchemaFile)
    const carp = MAHA_CARP_DIGITAL_OFFERS.find((entry) => entry.offerId === offer.id)
    assert.ok(carp, `${offer.id} is in the CARP catalogue`)
    // CARP does not inline a schema; it points buyers at the same free declaration.
    assert.equal(carp.inputSchema, `https://www.mahastrategies.com/api/discovery/x402-offers/${offer.id}`, 'CARP catalogue schema reference')
  })

  test(`${offer.id}: every published list of required fields agrees with the parser`, () => {
    const required = offer.discovery.inputSchema.required as string[]
    assert.deepEqual(openApiRequestSchema(openApiPath).required, required, 'OpenAPI')
    assert.deepEqual(publicSchema(publicSchemaFile).required, required, publicSchemaFile)
    const guide = (buildOfferSelectionDocument() as { offers: { offerId: string; requiredInputFields: string[] }[] })
      .offers.find((entry) => entry.offerId === offer.id)
    assert.deepEqual(guide?.requiredInputFields, required, 'offer selection guide')
    // Dropping any required field is a parser rejection, not a silent default.
    for (const field of required) {
      const body = structuredClone(offer.discovery.input)
      delete body[field]
      assert.throws(() => parse(body), new RegExp(field), `omitting ${field} names the field`)
    }
  })

  test(`${offer.id}: no buyer-facing schema caps a document below what the parser accepts`, () => {
    // The published schemas once declared documents[].text maxLength 64000.
    // No route enforces it, and Maha's own WSO2 large-context corpus sends
    // request-shaped documents of 81-83 thousand characters. A buyer reading
    // the stricter number would split documents the endpoint accepts whole.
    const oneLargeDocument = structuredClone(offer.discovery.input) as Record<string, unknown>
    const documents = oneLargeDocument.documents as { id: string; text: string }[]
    const long = `${documents[0].text} `.repeat(Math.ceil(90_000 / documents[0].text.length))
    documents[0] = { ...documents[0], text: long }
    assert.ok(long.length > 64_000 && bytes(oneLargeDocument) <= offer.maxRequestBytes)
    assert.doesNotThrow(() => parse(oneLargeDocument), 'the parser accepts it')
    for (const [label, schema] of [
      ['OpenAPI', openApiRequestSchema(openApiPath)],
      [publicSchemaFile, publicSchema(publicSchemaFile)],
      ['discovery', offer.discovery.inputSchema],
    ] as const) {
      assert.deepEqual(validate(oneLargeDocument, schema as Record<string, unknown>), [], `${label} must not reject it`)
    }
  })
}

test('the body the Bazaar recipe sends is a valid first request', () => {
  // scripts/run-bazaar-discovery-payment-recipe.ts replaces only the trace ID.
  const script = read('scripts/run-bazaar-discovery-payment-recipe.ts')
  assert.match(script, /const body = \{ \.\.\.contract\.inputExample, clientRequestId: `bazaar_recipe_\$\{crypto\.randomUUID\(\)\}` \}/)
  const body = { ...CONTEXT_COMPRESSION_OFFER.discovery.input, clientRequestId: `bazaar_recipe_${crypto.randomUUID()}` }
  assert.doesNotThrow(() => parseContextPackRequest(body))
  assert.deepEqual(validate(body, CONTEXT_COMPRESSION_OFFER.discovery.inputSchema), [])
})

test('the body the playground pays for fits the offer, so payment cannot end in a 413', () => {
  // ContextCompilerPlayground posts the server-built request with a new trace ID
  // to /api/v1/compress after a wallet payment.
  const component = read('app/context-compiler/playground/ContextCompilerPlayground.tsx')
  assert.match(component, /body: JSON\.stringify\(\{ \.\.\.data\.request, clientRequestId: `playground_paid_\$\{crypto\.randomUUID\(\)\}` \}\)/)
  const route = read('app/api/context-compiler/playground/route.ts')
  assert.match(route, /tokenBudget: supplied\.tokenBudget \?\? 8_000/)
  const documents = JSON.parse(read('content/recipes/context-compiler-playground-workload.json'))
  const request = parseContextPackRequest({
    clientRequestId: `playground_${crypto.randomUUID()}`,
    task: 'Compare how these works describe cognition, adaptation, imagination, agency, and the construction of a self.',
    tokenBudget: 16_000, documents, provenance: 'compact', scoring: 'bm25', budgetMode: 'guaranteed',
  })
  const paid = { ...request, clientRequestId: `playground_paid_${crypto.randomUUID()}` }
  assert.doesNotThrow(() => parseContextPackRequest(paid))
  assert.ok(bytes(paid) <= CONTEXT_COMPRESSION_OFFER.maxRequestBytes, `${bytes(paid)} bytes`)
})

// ---------------------------------------------------------------------------
// 2. An unpaid caller can find the example in the 402, body and header
// ---------------------------------------------------------------------------

function localConfig(payTo = MAHA_PAYEE) {
  return x402Config({
    X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://facilitator.example/x402', X402_PAY_TO: payTo,
    X402_ASSET: BASE_USDC, X402_NETWORK: 'base',
    X402_RESOURCES: JSON.stringify(CASES.map(({ offer }) => ({ method: 'POST', path: offer.path }))),
  })!
}

const NO_MONEY = {
  verify: async () => { throw new Error('an unpaid challenge must not verify') },
  settle: async () => { throw new Error('an unpaid challenge must not settle') },
}

async function unpaidChallenge(offer: X402Offer, body: string, payTo?: string) {
  const outcome = await resolveX402(
    new Request(`https://www.mahastrategies.com${offer.path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }),
    { config: localConfig(payTo), facilitator: NO_MONEY as never },
  )
  assert.equal(outcome.kind, 'challenge')
  if (outcome.kind !== 'challenge') throw new Error('unreachable')
  return outcome
}

for (const { offer } of CASES) {
  test(`${offer.id}: the unpaid 402 carries a JSON-body example in its body and in PAYMENT-REQUIRED`, async () => {
    const outcome = await unpaidChallenge(offer, '')
    assert.equal(outcome.status, 402)
    const fromHeader = JSON.parse(Buffer.from(outcome.header, 'base64').toString('utf8'))
    for (const [label, challenge] of [['body', outcome.body], ['PAYMENT-REQUIRED header', fromHeader]] as const) {
      type Declared = { bazaar: { info: { input: { method: string; bodyType: string; body: unknown } }; schema: { properties: { input: { properties: { body: Record<string, unknown> } } } } } }
      const extensions = (challenge as { extensions: Declared & Record<string, { maxRequestBytes: number; declarationUrl: string }> }).extensions
      const input = extensions.bazaar.info.input
      assert.equal(input.method, 'POST', label)
      assert.equal(input.bodyType, 'json', label)
      assert.deepEqual(input.body, offer.discovery.input, `${label}: the example is published verbatim`)
      assert.deepEqual(validate(input.body, extensions.bazaar.schema.properties.input.properties.body), [], `${label}: example validates against the inline schema`)
      const terms = extensions[OFFER_EXTENSION]
      assert.equal(terms.maxRequestBytes, offer.maxRequestBytes, label)
      assert.equal(terms.declarationUrl, `https://www.mahastrategies.com/api/discovery/x402-offers/${offer.id}`, `${label}: points at the full, free declaration`)
    }
    // A conforming client echoes the declaration in PAYMENT-SIGNATURE, which a
    // 16 KB request-header ceiling bounds.
    assert.ok(Buffer.byteLength(outcome.header) < 16_000, `${Buffer.byteLength(outcome.header)} bytes`)
  })
}

test('the full declaration is served free, outside the payment proxy', () => {
  // The inline schema is compacted: descriptions, patterns and nested items are
  // dropped. The rules a buyer needs -- unique document IDs, exact evidence
  // spans -- are only in the full declaration, so it must stay unpaid.
  const route = read('app/api/discovery/x402-offers/[offerId]/route.ts')
  assert.match(route, /export async function GET/)
  const proxy = read('proxy.ts')
  // Outside /api/v1 the proxy only removes proxy-asserted headers; it never prices.
  assert.match(proxy, /if \(!pathname\.startsWith\('\/api\/v1\/'\)\) return forward\(request\)/)
})

// ---------------------------------------------------------------------------
// 3. Payment recipient
// ---------------------------------------------------------------------------

test('every in-repo declaration of the context offers names the same payee as the seller configuration', async () => {
  assert.match(MAHA_PAYEE, /^0x[0-9a-f]{40}$/)
  for (const { offer } of CASES) {
    const carp = MAHA_CARP_DIGITAL_OFFERS.find((entry) => entry.offerId === offer.id)
    assert.equal(carp?.directSettlement.payee, MAHA_PAYEE, `${offer.id}: CARP catalogue`)
    const guide = (buildOfferSelectionDocument() as { offers: { offerId: string; payTo: string }[] })
      .offers.find((entry) => entry.offerId === offer.id)
    assert.equal(guide?.payTo, MAHA_PAYEE, `${offer.id}: offer selection guide`)
  }
  const policy = JSON.parse(read('public/x402/buyer-policy.example.json'))
  assert.deepEqual(policy.approvedPayees.map((payee: string) => payee.toLowerCase()), [MAHA_PAYEE], 'published buyer policy example')
  // The settlement ledger counts transfers to this address and no other.
  assert.match(read('lib/x402/settlement-refresh.ts'), /MAHA_PAYEE/)
  // The live recipient is environment configuration, never a committed value.
  assert.match(read('.env.example'), /^X402_PAY_TO=$/m)
})

test('the 402 quotes the configured recipient, so declaration and configuration cannot silently diverge', async () => {
  for (const { offer } of CASES) {
    const configured = await unpaidChallenge(offer, '')
    assert.equal((configured.body as { accepts: { payTo: string }[] }).accepts[0].payTo, MAHA_PAYEE)
    // A different configured address is quoted as-is. This test proves the 402
    // follows configuration; it cannot prove what Production is configured with.
    const other = `0x${'1'.repeat(40)}`
    const diverged = await unpaidChallenge(offer, '', other)
    assert.equal((diverged.body as { accepts: { payTo: string }[] }).accepts[0].payTo, other)
  }
})

// ---------------------------------------------------------------------------
// 4. Malformed input: what an unpaid caller learns, and what a paid one does
// ---------------------------------------------------------------------------

test('an unpaid malformed body receives the same 402 as a valid one: an unsigned body is never read', async () => {
  for (const { offer } of CASES) {
    const valid = await unpaidChallenge(offer, JSON.stringify(offer.discovery.input))
    for (const malformed of ['', '{', '{"not":"a request"}', JSON.stringify({ ...offer.discovery.input, tokenBudget: 1 })]) {
      const challenge = await unpaidChallenge(offer, malformed)
      assert.deepEqual(challenge.body, valid.body, `${offer.id}: ${malformed.slice(0, 30)}`)
    }
  }
})

test('both context offers validate a signed body before settlement, so a malformed paid request is not charged', () => {
  // Behaviour, with zero verify/settle/claim/slot calls, is proven in
  // test/x402-pre-settlement-body.test.ts. This pins the wiring.
  for (const { offer } of CASES) {
    assert.equal(offer.requiresIdempotency, false, offer.id)
    assert.equal(hasPreSettlementBodyContract(offer.id), true, offer.id)
  }
  const gateway = read('lib/x402/gateway.ts')
  const check = gateway.indexOf('await validatePreSettlementBody(request, offer)')
  assert.ok(check > 0, 'the gateway runs the body contract')
  assert.ok(check < gateway.indexOf('const reserveFirst ='), 'before capacity is reserved')
  assert.ok(check < gateway.indexOf('accepted = await acceptPayment('), 'before verification and settlement')
})

test('validation messages name the field and limit, and disclose nothing private', () => {
  const base = CONTEXT_COMPRESSION_OFFER.discovery.input
  type Evidence = { evidenceId: string; sourceId: string; text: string }
  const deep = DEEP_CONTEXT_EVALUATION_OFFER.discovery.input as Record<string, unknown> & { requiredEvidence: Evidence[] }
  const firstDocument = (base.documents as Record<string, unknown>[])[0]
  const cases: [string, () => unknown, RegExp][] = [
    ['not an object', () => parseContextPackRequest([]), /Request body must be a JSON object\./],
    ['short trace ID', () => parseContextPackRequest({ ...base, clientRequestId: 'short' }), /clientRequestId must contain 8-120 characters on one line\./],
    ['budget below floor', () => parseContextPackRequest({ ...base, tokenBudget: 10 }), /tokenBudget must be an integer between 64 and 16,000\./],
    ['no documents', () => parseContextPackRequest({ ...base, documents: [] }), /documents must contain 1-8 source documents\./],
    ['duplicate document IDs', () => parseContextPackRequest({ ...base, documents: [firstDocument, firstDocument] }), /documents\[\]\.id values must be unique\./],
    ['bad document ID', () => parseContextPackRequest({ ...base, documents: [{ id: '-bad id', text: 'x' }] }), /documents\[0\]\.id contains unsupported characters\./],
    ['unknown enum', () => parseContextPackRequest({ ...base, scoring: 'vector' }), /scoring must be one of: keyword, bm25\./],
    ['no evidence', () => parseDeepContextRequest({ ...deep, requiredEvidence: [] }), /requiredEvidence must contain 1-32 evidence spans\./],
    ['span not in source', () => parseDeepContextRequest({ ...deep, requiredEvidence: [{ ...deep.requiredEvidence[0], text: 'this text is not in the source' }] }), /requiredEvidence\[0\]\.text must be an exact span from its declared source document\./],
    ['unknown source', () => parseDeepContextRequest({ ...deep, requiredEvidence: [{ ...deep.requiredEvidence[0], sourceId: 'missing' }] }), /requiredEvidence\[0\]\.sourceId must reference a supplied document\./],
  ]
  for (const [label, run, expected] of cases) {
    let message = ''
    try { run() } catch (error) { message = (error as Error).message }
    assert.match(message, expected, label)
    // The caller's own values are never echoed back, nor is anything internal.
    assert.doesNotMatch(message, /\/Users\/|\/private\/|node_modules|at [\w.]+ \(|this text is not in the source/, label)
  }
})

test('the Bazaar recipe page says a rejected body is not charged and states catalogue prices', () => {
  const page = read('app/recipes/bazaar-discovery-to-payment/page.tsx')
  const usd = (offer: X402Offer) => `$${(Number(offer.amount) / 1e6).toString()}`
  assert.match(page, new RegExp(`pays \\${usd(CONTEXT_COMPRESSION_OFFER)}`), 'Context Compiler price')
  assert.match(page, new RegExp(`Deep Context Evaluation costs \\${usd(DEEP_CONTEXT_EVALUATION_OFFER)}`), 'Deep Context Evaluation price')
  assert.match(page, /the request body is validated before the payment settles/)
  for (const { offer } of CASES) assert.ok(page.includes(`/api/discovery/x402-offers/${offer.id}`), `links the free ${offer.id} declaration`)
  // The heading counts the gates the page actually lists.
  const gates = [...page.matchAll(/^  \['(\d)', '/gm)].map((match) => Number(match[1]))
  assert.deepEqual(gates, [1, 2, 3, 4, 5, 6])
  assert.match(page, /Six gates\. Nothing is signed until the first three pass\./)
  assert.match(page, /\['4', 'Pay once'/, 'signing happens in the fourth gate')
})
