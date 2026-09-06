import assert from 'node:assert/strict'
import test from 'node:test'

import { declarationDigest } from '../lib/x402/declaration-digest.ts'
import { discoveryExtensionsFor } from '../lib/x402/discovery.ts'
import {
  BASE_MAINNET_CAIP2,
  CONTEXT_COMPRESSION_OFFER,
  DEEP_CONTEXT_EVALUATION_OFFER,
  MPS_AUTONOMOUS_AUDIT_OFFER,
  payableOffers,
  type X402Offer,
} from '../lib/x402/offers.ts'
import { BASE_USDC } from '../lib/x402/discovery-payment-recipe.ts'
import type { PaymentRequirement } from '../lib/x402/protocol.ts'
import {
  OFFER_SELECTION_CANONICAL_URL,
  OFFER_SELECTION_EXAMPLES,
  OFFER_SELECTION_SCHEMA_VERSION,
  MPS_MAX_PASSAGE_CHARACTERS,
  buildOfferSelectionDocument,
  selectMahaOffer,
  type OfferSelectionInput,
} from '../lib/x402/offer-selection.ts'
import { GET } from '../app/api/discovery/offer-selection/route.ts'

const COMPRESSION = 'context-compression'
const DEEP = 'deep-context-evaluation'
const MPS = 'mps-autonomous-audit'

const base = (over: Partial<OfferSelectionInput> = {}): OfferSelectionInput => ({
  objective: 'compile-context-pack',
  network: BASE_MAINNET_CAIP2,
  asset: BASE_USDC,
  ...over,
})

// --- The public route ------------------------------------------------------

test('the public route answers 200 with valid JSON', async () => {
  const response = await GET()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /application\/json/)
  const body = await response.json()
  assert.ok(body && typeof body === 'object')
  // Round-trips, so nothing unserializable (BigInt, undefined, cycle) slipped in.
  assert.deepEqual(JSON.parse(JSON.stringify(body)), body)
})

test('the document declares its schema version and canonical URL', async () => {
  const document = buildOfferSelectionDocument()
  assert.equal(document.schemaVersion, OFFER_SELECTION_SCHEMA_VERSION)
  assert.equal(document.canonicalUrl, OFFER_SELECTION_CANONICAL_URL)
  assert.equal(OFFER_SELECTION_CANONICAL_URL, 'https://www.mahastrategies.com/.well-known/maha/offer-selection.json')
})

// --- Catalog agreement -----------------------------------------------------

test('every payable catalog offer appears exactly once, and nothing else does', () => {
  const document = buildOfferSelectionDocument()
  const published = (document.offers as Array<{ offerId: string }>).map((offer) => offer.offerId)
  const expected = payableOffers().map((offer) => offer.id)
  assert.deepEqual([...published].sort(), [...expected].sort())
  assert.equal(new Set(published).size, published.length, 'no offer may be listed twice')
  // MPS became payable on 2026-08-12 and is now a selectable offer. The
  // withheld invariant is asserted below against a synthetic offer instead, so
  // it survives every future promotion.
  assert.ok(published.includes(MPS_AUTONOMOUS_AUDIT_OFFER.id))
})

test('published terms are the catalog terms, not a second hand-maintained copy', () => {
  const document = buildOfferSelectionDocument()
  const entries = document.offers as Array<Record<string, unknown>>
  for (const offer of payableOffers()) {
    const entry = entries.find((candidate) => candidate.offerId === offer.id)
    assert.ok(entry, `${offer.id} must be published`)
    assert.equal((entry.price as { baseUnits: string }).baseUnits, offer.amount)
    assert.equal(entry.resource, `https://www.mahastrategies.com${offer.path}`)
    assert.equal(entry.method, offer.method)
    assert.equal(entry.network, BASE_MAINNET_CAIP2)
    assert.equal(entry.asset, BASE_USDC)
    assert.equal(entry.status, offer.status)
    assert.equal((entry.requestLimits as { maxRequestBytes: number }).maxRequestBytes, offer.maxRequestBytes)
  }
})

test('the two published prices are exactly 1000 and 10000 base units', () => {
  assert.equal(CONTEXT_COMPRESSION_OFFER.amount, '1000')
  assert.equal(DEEP_CONTEXT_EVALUATION_OFFER.amount, '10000')
})

// --- Selection: the happy paths --------------------------------------------

test('compilation without measurement selects the cheaper offer', () => {
  const decision = selectMahaOffer(base({ needsDeduplication: true, needsCitationTraceability: true }))
  assert.equal(decision.decision, 'select')
  assert.deepEqual(decision.selectedOfferIds, [COMPRESSION])
  assert.equal(decision.estimatedOfferCostBaseUnits, '1000')
})

test('any measurement need selects Deep Context Evaluation', () => {
  for (const need of ['needsRetentionMeasurement', 'needsSourceCoverageMeasurement', 'needsQualityEvaluation'] as const) {
    const decision = selectMahaOffer(base({ [need]: true }))
    assert.deepEqual(decision.selectedOfferIds, [DEEP], `${need} must select the evaluating offer`)
    assert.equal(decision.estimatedOfferCostBaseUnits, '10000')
  }
})

// --- Boundaries ------------------------------------------------------------

test('a ceiling exactly equal to the price authorizes it', () => {
  assert.equal(selectMahaOffer(base({ maximumPriceBaseUnits: '1000' })).decision, 'select')
  assert.equal(
    selectMahaOffer(base({ objective: 'evaluate-context-quality', maximumPriceBaseUnits: '10000' })).decision,
    'select',
  )
})

test('one base unit under the price rejects', () => {
  assert.equal(selectMahaOffer(base({ maximumPriceBaseUnits: '999' })).decision, 'reject')
  assert.equal(
    selectMahaOffer(base({ objective: 'evaluate-context-quality', maximumPriceBaseUnits: '9999' })).decision,
    'reject',
  )
})

test('a 5000 base-unit ceiling cannot authorize Deep Context Evaluation, and never downgrades to compression', () => {
  const decision = selectMahaOffer(base({ objective: 'evaluate-context-quality', maximumPriceBaseUnits: '5000' }))
  assert.equal(decision.decision, 'reject')
  assert.deepEqual(decision.selectedOfferIds, [], 'a cheaper different product is not an answer')
  assert.ok(decision.reasons.some((reason) => reason.includes('10000')))
  assert.ok(
    decision.warnings.some((warning) => /does not measure retention/i.test(warning)),
    'the refusal must say why substituting would be wrong, not merely that it is too dear',
  )
})

test('a 20000 base-unit ceiling authorizes the two-stage sequence at exactly 11000 base units', () => {
  const decision = selectMahaOffer(base({ objective: 'compile-and-evaluate', maximumPriceBaseUnits: '20000' }))
  assert.equal(decision.decision, 'sequence')
  assert.deepEqual(decision.selectedOfferIds, [COMPRESSION, DEEP])
  assert.equal(decision.estimatedOfferCostBaseUnits, '11000')
})

test('the sequence is rejected when its total exceeds the ceiling, even though stage one fits', () => {
  const decision = selectMahaOffer(base({ objective: 'compile-and-evaluate', maximumPriceBaseUnits: '10999' }))
  assert.equal(decision.decision, 'reject')
  assert.deepEqual(decision.selectedOfferIds, [], 'a partial sequence is not a cheaper sequence')
})

// --- Fail closed -----------------------------------------------------------

test('an unknown network or asset fails closed', () => {
  assert.equal(selectMahaOffer(base({ network: 'eip155:1' })).decision, 'reject')
  assert.equal(selectMahaOffer(base({ network: 'eip155:84532' })).decision, 'reject')
  assert.equal(selectMahaOffer(base({ asset: '0x0000000000000000000000000000000000000000' })).decision, 'reject')
  assert.equal(selectMahaOffer(base({ asset: 'usdc' })).decision, 'reject')
})

test('a ceiling that is not an integer string fails closed rather than being ignored', () => {
  // '0.005' is the mistake the field name now guards against: a caller who
  // thinks in dollars. Rejected outright, because reading it as 0 base units
  // would block every offer and reading it as 5000 would invent permission
  // nobody granted.
  for (const ceiling of ['0.005', '0.01', '5e3', '', 'many', '-1', '1_000', ' 5000', '5000 ']) {
    const decision = selectMahaOffer(base({ maximumPriceBaseUnits: ceiling }))
    assert.equal(decision.decision, 'reject', `${ceiling} must not read as permissive`)
  }
})

test('the ceiling field is named for its unit, with no dollar-named alias', async () => {
  // The guide has not shipped, so there is deliberately no compatibility
  // alias: a field that accepts both a base-unit name and a dollar-sounding
  // one would let a caller pick the reading that flatters their intent.
  const document = buildOfferSelectionDocument()
  const inputs = document.selectionInputs as Record<string, unknown>
  assert.ok('maximumPriceBaseUnits' in inputs)
  assert.ok(!('maximumPriceUsdc' in inputs), 'the misleading dollar-named field must not survive anywhere')

  // Scans the shipped source only. This test file necessarily names the old
  // field to assert its absence, so including it would fail on its own guard.
  const { readFile } = await import('node:fs/promises')
  const forbidden = `maximumPrice${'Usdc'}`
  for (const file of ['../lib/x402/offer-selection.ts', '../app/api/discovery/offer-selection/route.ts']) {
    const text = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.ok(!text.includes(forbidden), `${file} still references the old name`)
  }

  const ceiling = inputs.maximumPriceBaseUnits as Record<string, unknown>
  assert.equal(ceiling.assetDecimals, 6, 'the decimals a reader needs to convert must travel with the field')
  assert.equal(ceiling.pattern, '^[0-9]+$')
  // Any display value published beside it must be marked non-authoritative.
  for (const example of ceiling.examples as Array<Record<string, string>>) {
    assert.match(example.equivalentDisplay, /non-authoritative/)
  }
})

test('the asset comparison is case-insensitive, since checksummed and lowercase are the same address', () => {
  assert.equal(selectMahaOffer(base({ asset: BASE_USDC.toLowerCase() })).decision, 'select')
})

test('unsupported capabilities reject regardless of budget', () => {
  for (const objective of ['summarize', 'verify-facts'] as const) {
    for (const ceiling of ['5000', '20000', '100000000']) {
      const decision = selectMahaOffer(base({ objective, maximumPriceBaseUnits: ceiling }))
      assert.equal(decision.decision, 'reject', `${objective} at ${ceiling} must reject`)
      assert.deepEqual(decision.selectedOfferIds, [])
    }
  }
})

test('guaranteed completeness and binary input reject', () => {
  assert.equal(selectMahaOffer(base({ requiresGuaranteedCompleteness: true })).decision, 'reject')
  assert.equal(selectMahaOffer(base({ inputEncoding: 'binary' })).decision, 'reject')
})

test('a payload over the published limit rejects instead of paying to be refused', () => {
  const tooBig = DEEP_CONTEXT_EVALUATION_OFFER.maxRequestBytes + 1
  assert.equal(selectMahaOffer(base({ estimatedInputBytes: tooBig })).decision, 'reject')
  assert.equal(selectMahaOffer(base({ estimatedInputBytes: 1_000 })).decision, 'select')
})

test('more documents than Deep Context accepts rejects, and does not substitute compression', () => {
  const decision = selectMahaOffer(base({ objective: 'evaluate-context-quality', documentCount: 9 }))
  assert.equal(decision.decision, 'reject')
  assert.deepEqual(decision.selectedOfferIds, [])
  assert.ok(decision.rejectedAlternatives.some((alternative) => alternative.offerId === COMPRESSION))
})

test('an unavailable offer is never selected', () => {
  // The catalog with Deep Context withheld, as it was before 2026-08-11.
  const withheld: X402Offer[] = [
    CONTEXT_COMPRESSION_OFFER,
    { ...DEEP_CONTEXT_EVALUATION_OFFER, status: 'withheld', availability: { payableInProduction: false, blockedBy: ['not promoted'] } },
  ]
  const decision = selectMahaOffer(base({ objective: 'evaluate-context-quality' }), withheld)
  assert.equal(decision.decision, 'reject')
  assert.deepEqual(decision.selectedOfferIds, [])
  assert.ok(decision.warnings.includes('not promoted'))
})

test('a withheld offer never reaches the published document either', () => {
  const withheld: X402Offer[] = [{ ...DEEP_CONTEXT_EVALUATION_OFFER, status: 'withheld' }]
  const document = buildOfferSelectionDocument(withheld)
  assert.deepEqual(document.offers, [])
})

// --- MPS audit selection ---------------------------------------------------

test('claim triage selects the MPS audit and nothing else', () => {
  const decision = selectMahaOffer(base({ objective: 'claim-provenance-triage', maximumPriceBaseUnits: '100000' }))
  assert.equal(decision.decision, 'select')
  assert.deepEqual(decision.selectedOfferIds, [MPS])
  assert.equal(decision.estimatedOfferCostBaseUnits, '100000')
  assert.equal(decision.estimatedOfferCostBaseUnits, MPS_AUTONOMOUS_AUDIT_OFFER.amount)
})

test('a compression request never falls through into the $0.10 model call', () => {
  // The expensive misroute. Triage is reachable only by asking for it.
  for (const objective of ['compile-context-pack', 'evaluate-context-quality', 'compile-and-evaluate', 'other'] as const) {
    const decision = selectMahaOffer(base({ objective, maximumPriceBaseUnits: '100000' }))
    assert.ok(!decision.selectedOfferIds.includes(MPS), `${objective} must not select the MPS audit`)
  }
})

test('MPS over budget rejects and never substitutes a compression offer', () => {
  const decision = selectMahaOffer(base({ objective: 'claim-provenance-triage', maximumPriceBaseUnits: '20000' }))
  assert.equal(decision.decision, 'reject')
  assert.deepEqual(decision.selectedOfferIds, [])
  assert.ok(decision.warnings.some((w) => /provenance statuses/i.test(w)))
})

test('the MPS boundary is exact at 100000 base units', () => {
  assert.equal(selectMahaOffer(base({ objective: 'claim-provenance-triage', maximumPriceBaseUnits: '100000' })).decision, 'select')
  assert.equal(selectMahaOffer(base({ objective: 'claim-provenance-triage', maximumPriceBaseUnits: '99999' })).decision, 'reject')
})

test('a passage over 6000 characters rejects before payment', () => {
  const over = { objective: 'claim-provenance-triage' as const, estimatedInputBytes: MPS_MAX_PASSAGE_CHARACTERS + 1, maximumPriceBaseUnits: '100000' }
  assert.equal(selectMahaOffer(base(over)).decision, 'reject')
  assert.equal(selectMahaOffer(base({ ...over, estimatedInputBytes: MPS_MAX_PASSAGE_CHARACTERS })).decision, 'select')
})

test('the published MPS entry preserves the contract exactly', () => {
  const entry = (buildOfferSelectionDocument().offers as Array<Record<string, unknown>>)
    .find((o) => o.offerId === MPS)!
  assert.ok(entry)
  assert.equal((entry.price as { baseUnits: string }).baseUnits, '100000')
  assert.equal(entry.resource, 'https://www.mahastrategies.com/api/v1/mps/audit')
  assert.equal(entry.method, 'POST')
  assert.equal(entry.network, BASE_MAINNET_CAIP2)
  assert.equal(entry.asset, BASE_USDC)
  assert.equal(entry.requiresIdempotency, true, 'idempotency key and input hash are required')
  const limits = entry.requestLimits as Record<string, number>
  assert.equal(limits.maxPassageCharacters, 6000)
  assert.equal(limits.maxRequestBytes, 32_768)
  assert.equal(limits.concurrencyCap, 2)
  const retention = entry.retention as { verbatimExcerptsRetained: boolean; fullSourceTextStored: boolean }
  assert.equal(retention.verbatimExcerptsRetained, true, 'MPS keeps 6-25 word claim excerpts by design')
  assert.equal(retention.fullSourceTextStored, false)
  // Standalone, not a stage of the compression pipeline.
  assert.deepEqual(entry.flow, { successor: null, predecessor: null, standalone: true })
  const nonFit = entry.nonFitConditions as string[]
  for (const claim of [/certification/i, /legal advice/i, /human/i, /hallucination|verification/i]) {
    assert.ok(nonFit.some((c) => claim.test(c)), `the MPS non-fit list must disclaim ${claim}`)
  }
  assert.match(String((entry.links as Record<string, string>).retrieval), /\/api\/v1\/mps\/audit\/\{auditId\}$/)
})

// --- Examples --------------------------------------------------------------

test('every published example reproduces its documented decision', () => {
  for (const example of OFFER_SELECTION_EXAMPLES) {
    const decision = selectMahaOffer(example.input)
    assert.equal(decision.decision, example.expected.decision, example.name)
    assert.deepEqual(decision.selectedOfferIds, example.expected.selectedOfferIds, example.name)
    assert.equal(decision.estimatedOfferCostBaseUnits, example.expected.estimatedOfferCostBaseUnits, example.name)
  }
})

test('the document ships the same eight examples it was specified with', () => {
  const document = buildOfferSelectionDocument()
  const examples = document.examples as Array<{ decision: { decision: string } }>
  assert.equal(examples.length, 8)
  assert.deepEqual(
    examples.map((example) => example.decision.decision),
    ['select', 'select', 'select', 'reject', 'reject', 'reject', 'reject', 'sequence'],
  )
})

// --- Public-contract consistency -------------------------------------------

test('the guide is reachable from the public discovery surfaces', async () => {
  const { readFile } = await import('node:fs/promises')
  const surfaces = [
    'content/discovery/agent-card.json',
    'content/discovery/agent-offers.json',
    'content/discovery/agentic-commerce.md',
    'lib/llms-manifest.ts',
  ]
  for (const surface of surfaces) {
    const text = await readFile(new URL(`../${surface}`, import.meta.url), 'utf8')
    assert.ok(
      text.includes('/.well-known/maha/offer-selection.json'),
      `${surface} must link the machine-readable offer selection guide`,
    )
  }
})

test('the rewrite that gives the guide its canonical URL exists', async () => {
  const { readFile } = await import('node:fs/promises')
  const config = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8')
  assert.ok(config.includes("source: '/.well-known/maha/offer-selection.json'"))
  assert.ok(config.includes("destination: '/api/discovery/offer-selection'"))
})

// --- The payable declarations must not move --------------------------------

/**
 * Pinned before this change, from the same builder the live challenge uses.
 *
 * The point is not that these numbers are meaningful but that they are
 * *unchanged*: adding a documentation link to a payable declaration would
 * re-digest it, which invalidates the Bazaar listing and forces a settlement to
 * refresh. This change is documentation, and documentation must not cost
 * $0.001 to publish.
 */
const PINNED_DIGESTS: Record<string, string> = {
  [COMPRESSION]: 'sha256:3ad1b8bc5580c06a96f11438129a3e8425b1ad76607e9fd81e49d265ae32e359',
  [DEEP]: 'sha256:300c3e7541695b50233f6b5623c977a607acaabafd33e6959ed07078c5361fae',
}

test('no payable declaration digest changed as a side effect of publishing the guide', async () => {
  const requirement = (amount: string): PaymentRequirement => ({
    scheme: 'exact',
    network: BASE_MAINNET_CAIP2,
    amount,
    payTo: '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28',
    maxTimeoutSeconds: 60,
    asset: BASE_USDC,
    extra: { name: 'USD Coin', version: '2' },
  })
  for (const offer of [CONTEXT_COMPRESSION_OFFER, DEEP_CONTEXT_EVALUATION_OFFER]) {
    const url = `https://www.mahastrategies.com${offer.path}`
    const extensions = await discoveryExtensionsFor(
      {
        offerId: offer.id,
        method: offer.method,
        path: offer.path,
        amount: offer.amount,
        description: offer.description,
        concurrencyCap: offer.concurrencyCap,
      },
      url,
      requirement(offer.amount),
    )
    const digest = await declarationDigest({
      x402Version: 2,
      resource: { url, method: offer.method },
      accepts: [requirement(offer.amount)],
      extensions,
    })
    assert.equal(
      digest,
      PINNED_DIGESTS[offer.id],
      `${offer.id}'s declaration changed. If that is intended, the Bazaar listing goes stale and refreshing it costs a settlement.`,
    )
  }
})
