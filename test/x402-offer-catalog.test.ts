import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  CONTEXT_COMPRESSION_OFFER,
  DEEP_CONTEXT_EVALUATION_OFFER,
  MPS_AUTONOMOUS_AUDIT_OFFER,
  X402_OFFERS,
  catalogMismatches,
  offerFor,
  payableOffers,
} from '../lib/x402/offers.ts'
import { MAX_RESOURCE_DESCRIPTION_BYTES, MAX_RESOURCE_DESCRIPTION_CHARS } from '../lib/x402/discovery.ts'
import { priceFor, x402Config, type X402Config } from '../lib/x402/config.ts'
import { releasesSlot } from '../lib/x402/slot.ts'
import { validate } from './helpers/json-schema.ts'

const DISCOVERY_DIR = join(import.meta.dirname, '..', 'content', 'discovery')

const ENV = {
  X402_ENABLED: 'true',
  X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0xSettlement',
  X402_ASSET: '0xUSDC',
  X402_NETWORK: 'base',
  X402_RESOURCES: JSON.stringify([
    { method: 'POST', path: '/api/v1/compress' },
    { method: 'POST', path: '/api/v1/compress/evaluate' },
    { method: 'POST', path: '/api/v1/mps/audit' },
  ]),
}
const config = () => x402Config(ENV) as X402Config

// --- 1. The three prices -----------------------------------------------------

test('each offer is published at exactly its intended price', () => {
  // Written as literals rather than derived from the catalog. A test that
  // reads the same constant it is checking passes whatever the constant
  // becomes, which is precisely the drift this file exists to catch.
  assert.equal(CONTEXT_COMPRESSION_OFFER.amount, '1000')
  assert.equal(DEEP_CONTEXT_EVALUATION_OFFER.amount, '10000')
  assert.equal(MPS_AUTONOMOUS_AUDIT_OFFER.amount, '100000')
  const ladder = X402_OFFERS.find((offer) => offer.id === 'context-budget-ladder')
  const matrix = X402_OFFERS.find((offer) => offer.id === 'evidence-retention-matrix')
  const governed = X402_OFFERS.find((offer) => offer.id === 'governed-context-verification-pack')
  const intake = X402_OFFERS.find((offer) => offer.id === 'research-intake-evidence-pack')
  assert.equal(ladder?.amount, '5000')
  assert.equal(matrix?.amount, '50000')
  assert.equal(governed?.amount, '500000')
  assert.equal(intake?.amount, '1000000')

  // And the runtime charges those amounts, not merely publishes them.
  assert.equal(priceFor('POST', '/api/v1/compress', config())?.amount, '1000')
  assert.equal(priceFor('POST', '/api/v1/compress/evaluate', config())?.amount, '10000')
  assert.equal(priceFor('POST', '/api/v1/mps/audit', config())?.amount, '100000')
})

test('the entry offer contract is unchanged', () => {
  // This offer has settled payments against it. A price, path, or schema
  // change here is a breaking change to a live product, not a refactor.
  assert.equal(CONTEXT_COMPRESSION_OFFER.path, '/api/v1/compress')
  assert.equal(CONTEXT_COMPRESSION_OFFER.amount, '1000')
  assert.equal(CONTEXT_COMPRESSION_OFFER.concurrencyCap, 8)
  const required = CONTEXT_COMPRESSION_OFFER.discovery.inputSchema.required as string[]
  assert.deepEqual(required, ['clientRequestId', 'task', 'tokenBudget', 'documents'])
  // The benchmark claim in the description is load-bearing copy; it must not
  // acquire a verification claim it cannot support.
  assert.match(CONTEXT_COMPRESSION_OFFER.description, /Extractive and budget-bound/)
})

// --- 2 and 3. Method-aware, exact-path matching ------------------------------

test('the standard endpoint cannot match the deep endpoint', () => {
  // The whole reason exact matching exists. Under longest-prefix rules
  // /api/v1/compress/evaluate matched the $0.001 entry offer, so a $0.01
  // resource would have been sold at a tenth of its price -- and the 402 would
  // have quoted the low price, so the payer would have done nothing wrong.
  const deep = priceFor('POST', '/api/v1/compress/evaluate', config())
  assert.equal(deep?.offerId, 'deep-context-evaluation')
  assert.notEqual(deep?.amount, CONTEXT_COMPRESSION_OFFER.amount)

  assert.equal(offerFor('POST', '/api/v1/compress')?.id, 'context-compression')
  assert.equal(offerFor('POST', '/api/v1/compress/evaluate')?.id, 'deep-context-evaluation')
})

test('matching is by exact method and exact path', () => {
  // A GET beside a priced POST is not the priced resource, in either
  // direction: it must not be challenged for the POST price, and a payment
  // signed for the POST must not admit it.
  assert.equal(priceFor('GET', '/api/v1/compress', config()), null)
  assert.equal(priceFor('GET', '/api/v1/mps/audit', config()), null)

  // A sub-path is not priced by inheritance. This is what keeps the MPS
  // retrieval path free for a caller recovering a job it already bought.
  assert.equal(priceFor('POST', '/api/v1/mps/audit/audit_abc', config()), null)
  assert.equal(priceFor('GET', '/api/v1/mps/audit/audit_abc', config()), null)
  assert.equal(priceFor('POST', '/api/v1/compress/evaluate/v2', config()), null)

  // A path that merely shares a prefix is a different path.
  assert.equal(priceFor('POST', '/api/v1/compressor', config()), null)
  assert.equal(priceFor('POST', '/api/v1/compress/', config()), null)
})

test('only routes that actually release their slot can be priced', () => {
  for (const offer of X402_OFFERS.filter((candidate) => candidate.status === 'available')) {
    assert.equal(releasesSlot(offer.method, offer.path), true, `${offer.id} must be in the slot-release allowlist`)
  }
  for (const offer of X402_OFFERS.filter((candidate) => candidate.status !== 'available')) {
    assert.equal(releasesSlot(offer.method, offer.path), false, `${offer.id} is not implemented and must not be in the slot-release allowlist`)
  }
  // The allowlist is exact, so a listed route does not vouch for its children.
  assert.equal(releasesSlot('POST', '/api/v1/mps/audit/audit_abc'), false)
  assert.equal(releasesSlot('GET', '/api/v1/compress'), false)
})

// --- 4. Description limits ---------------------------------------------------

test('every authored description fits the facilitator ceiling', () => {
  // 480 is the empirically enforced CDP limit: 480 is known to pass and 523 to
  // fail. Exceeding it does not degrade the listing, it breaks settlement --
  // the facilitator rejects the whole payment payload union before it looks at
  // the signature. Both counts are checked because they only diverge the day
  // someone adds a non-Latin sentence, at which point the field silently
  // triples in bytes while looking unchanged.
  for (const offer of X402_OFFERS) {
    const bytes = new TextEncoder().encode(offer.description).length
    assert.ok(
      offer.description.length <= MAX_RESOURCE_DESCRIPTION_CHARS,
      `${offer.id} description is ${offer.description.length} characters, over ${MAX_RESOURCE_DESCRIPTION_CHARS}`,
    )
    assert.ok(
      bytes <= MAX_RESOURCE_DESCRIPTION_BYTES,
      `${offer.id} description is ${bytes} bytes, over ${MAX_RESOURCE_DESCRIPTION_BYTES}`,
    )
  }
})

test('the paid offers state what they are not', () => {
  // An autonomous buyer has no human to ask, so the boundary has to travel
  // with the offer. These are the specific overclaims that would make each
  // product dishonest, asserted against the published description itself.
  assert.match(
    DEEP_CONTEXT_EVALUATION_OFFER.description,
    /not accuracy, answer quality, verification, or hallucination prevention/i,
  )
  assert.match(MPS_AUTONOMOUS_AUDIT_OFFER.description, /not factual certification, legal advice, or human verification/i)

  const intake = X402_OFFERS.find((offer) => offer.id === 'research-intake-evidence-pack')
  assert.ok(intake)
  assert.match(intake.capabilityBoundaries.join(' '), /public or synthetic and non-sensitive/i)
  assert.match(intake.capabilityBoundaries.join(' '), /transmitted to Anthropic/i)
  assert.match(intake.retention.note, /transmitted to Anthropic/i)

  for (const forbidden of [/\bfact-check/i, /\bguarantees? accuracy/i, /\bprevents? hallucination/i]) {
    for (const offer of X402_OFFERS) {
      assert.equal(forbidden.test(offer.description), false, `${offer.id} must not claim ${forbidden}`)
    }
  }
})

// --- 5 and 6. Examples validate against their declared schemas ---------------

test('every published input example validates against its declared input schema', () => {
  for (const offer of X402_OFFERS) {
    const errors = validate(offer.discovery.input, offer.discovery.inputSchema)
    assert.deepEqual(errors, [], `${offer.id} input example: ${errors.join('; ')}`)
  }
})

test('every published response example validates against its declared output schema', () => {
  // A Bazaar agent builds its call from the example and its parser from the
  // schema. If the two disagree it spends money and then fails to read the
  // answer, and nothing on this side reports an error.
  for (const offer of X402_OFFERS) {
    const errors = validate(offer.discovery.output, offer.discovery.outputSchema)
    assert.deepEqual(errors, [], `${offer.id} output example: ${errors.join('; ')}`)
  }
})

test('the deep evaluation example shows an omitted span, not only retained ones', () => {
  // A 100%-retention example teaches a buyer nothing about the failure mode it
  // is actually buying insight into, and quietly implies retention is assured.
  const output = DEEP_CONTEXT_EVALUATION_OFFER.discovery.output as {
    evidence: { status: string }[]
    metrics: { requiredEvidenceRetentionPercent: number }
  }
  assert.ok(output.evidence.some((span) => span.status === 'omitted'), 'the example must show an omitted span')
  assert.ok(output.metrics.requiredEvidenceRetentionPercent < 100)
})

// --- 18. Static manifests and the runtime catalog agree ----------------------

test('the static manifests do not contradict the runtime catalog', () => {
  const card = JSON.parse(readFileSync(join(DISCOVERY_DIR, 'agent-card.json'), 'utf8')) as {
    capabilities: { id: string; endpoint?: string; payment?: { amount: string; network: string } }[]
  }
  const offers = JSON.parse(readFileSync(join(DISCOVERY_DIR, 'agent-offers.json'), 'utf8')) as {
    transactionPolicy: { autonomousPaymentScope: string[]; describedNotPayable?: string[] }
    technicalCapabilities: { id: string; endpoint?: string; machinePayment?: { amount: string; network: string } }[]
  }

  for (const offer of X402_OFFERS) {
    const cardEntry = card.capabilities.find((capability) => capability.id === offer.id)
    const manifestEntry = offers.technicalCapabilities.find((capability) => capability.id === offer.id)
    assert.ok(cardEntry, `${offer.id} must appear in agent-card.json`)
    assert.ok(manifestEntry, `${offer.id} must appear in agent-offers.json`)

    // The amount is the field that costs money when it drifts.
    assert.equal(cardEntry!.payment?.amount, offer.amount, `${offer.id} agent-card amount`)
    assert.equal(manifestEntry!.machinePayment?.amount, offer.amount, `${offer.id} agent-offers amount`)
    assert.equal(cardEntry!.payment?.network, 'eip155:8453')
    assert.equal(manifestEntry!.machinePayment?.network, 'eip155:8453')
    assert.ok(cardEntry!.endpoint?.endsWith(offer.path), `${offer.id} agent-card endpoint`)
    assert.ok(manifestEntry!.endpoint?.endsWith(offer.path), `${offer.id} agent-offers endpoint`)
  }

  // The payable scope is exactly the offers marked available -- no more, no
  // fewer. An extra id here advertises a payment contract that does not exist;
  // a missing one hides a route that will answer 402.
  assert.deepEqual(
    [...offers.transactionPolicy.autonomousPaymentScope].sort(),
    payableOffers().map((offer) => offer.id).sort(),
  )
  // Everything else is still described, so an offer does not vanish between
  // crawls, but is listed as not payable.
  assert.deepEqual(
    [...(offers.transactionPolicy.describedNotPayable ?? [])].sort(),
    X402_OFFERS.filter((offer) => offer.status !== 'available').map((offer) => offer.id).sort(),
  )
})

test('a withheld or preview offer is never advertised as payable', () => {
  const card = JSON.parse(readFileSync(join(DISCOVERY_DIR, 'agent-card.json'), 'utf8')) as {
    capabilities: { id: string; payableNow?: boolean; payment?: { autonomous?: boolean } }[]
  }
  const offers = JSON.parse(readFileSync(join(DISCOVERY_DIR, 'agent-offers.json'), 'utf8')) as {
    technicalCapabilities: { id: string; payableNow?: boolean; machinePayment?: { payableNow?: boolean } }[]
  }

  for (const offer of X402_OFFERS) {
    const expected = offer.status === 'available'
    const cardEntry = card.capabilities.find((capability) => capability.id === offer.id)!
    const manifestEntry = offers.technicalCapabilities.find((capability) => capability.id === offer.id)!

    assert.equal(cardEntry.payableNow, expected, `${offer.id} agent-card payableNow`)
    assert.equal(manifestEntry.payableNow, expected, `${offer.id} agent-offers payableNow`)
    // The autonomous flag is what a buying agent branches on, so it must agree
    // with the status rather than describing the eventual intent.
    if (cardEntry.payment) assert.equal(cardEntry.payment.autonomous, expected, `${offer.id} agent-card autonomous`)
    if (manifestEntry.machinePayment) {
      assert.equal(manifestEntry.machinePayment.payableNow, expected, `${offer.id} agent-offers machinePayment.payableNow`)
    }
    assert.equal(offer.availability.payableInProduction, expected)
    if (!expected) assert.ok(offer.availability.blockedBy.length > 0, `${offer.id} must publish why it is not payable`)
  }
})

test('the retention claim matches what each offer actually keeps', () => {
  // The claim that was wrong. An MPS result identifies each claim by a 6-25
  // word verbatim excerpt, so excerpts are retained by design; publishing "no
  // source text is retained" was a promise the product could not keep.
  assert.equal(MPS_AUTONOMOUS_AUDIT_OFFER.retention.fullSourceTextStored, false)
  assert.equal(MPS_AUTONOMOUS_AUDIT_OFFER.retention.verbatimExcerptsRetained, true)
  assert.match(MPS_AUTONOMOUS_AUDIT_OFFER.retention.note, /complete submitted passage is not retained/i)
  assert.match(MPS_AUTONOMOUS_AUDIT_OFFER.retention.note, /verbatim claim excerpts/i)

  // The compression offers genuinely keep nothing, and may say so.
  for (const offer of [CONTEXT_COMPRESSION_OFFER, DEEP_CONTEXT_EVALUATION_OFFER]) {
    assert.equal(offer.retention.fullSourceTextStored, false)
    assert.equal(offer.retention.verbatimExcerptsRetained, false)
  }

  // And no offer may publish the flat, false claim anywhere.
  for (const offer of X402_OFFERS) {
    assert.equal(/no source text is retained/i.test(offer.description), false, `${offer.id} description`)
    assert.equal(/no source text is retained/i.test(offer.retention.note), false, `${offer.id} retention note`)
  }
})

test('the GPU routes are not advertised as x402 products in this phase', () => {
  const offers = JSON.parse(readFileSync(join(DISCOVERY_DIR, 'agent-offers.json'), 'utf8')) as {
    transactionPolicy: { autonomousPaymentScope: string[]; describedNotPayable?: string[] }
  }
  for (const gpu of ['gpu-tensor-network', 'gpu-geometric-registration', 'gpu-qubo-ising']) {
    assert.equal(offers.transactionPolicy.autonomousPaymentScope.includes(gpu), false)
  }
  assert.equal(offerFor('POST', '/api/v1/jobs/tensor-network'), undefined)
  assert.equal(offerFor('POST', '/api/v1/jobs/geometric-registration'), undefined)
})

// --- Readiness: deployment config may not contradict the published catalog ----

test('readiness fails when the deployment variable contradicts the catalog', () => {
  // X402_RESOURCES stays the enablement mechanism -- it decides which offers
  // are on -- but it does not get to decide what they cost or claim.
  const problems = catalogMismatches([
    { method: 'POST', path: '/api/v1/compress', amount: '9999', description: CONTEXT_COMPRESSION_OFFER.description, concurrencyCap: 8 },
  ])
  assert.equal(problems.length, 1)
  assert.match(problems[0]!, /prices POST \/api\/v1\/compress at 9999 but the catalog publishes 1000/)

  assert.deepEqual(catalogMismatches([
    { method: 'POST', path: '/api/v1/compress', amount: '1000', description: CONTEXT_COMPRESSION_OFFER.description, concurrencyCap: 8 },
  ]), [])

  assert.match(
    catalogMismatches([{ method: 'POST', path: '/api/v1/nope', amount: '1', description: 'x', concurrencyCap: 1 }])[0]!,
    /not in the public offer catalog/,
  )
})

test('a contradicting deployment still serves the catalog price, never the variable', () => {
  // Serving the environment's number would mean a stale variable silently
  // sells an offer at a price the published manifests contradict. The
  // contradiction is recorded for readiness instead.
  const drifted = x402Config({
    ...ENV,
    X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress', amount: '5', description: 'cheap', concurrencyCap: 99 }]),
  }) as X402Config
  assert.equal(drifted.resources[0]!.amount, '1000')
  assert.equal(drifted.resources[0]!.description, CONTEXT_COMPRESSION_OFFER.description)
  assert.equal(drifted.resources[0]!.concurrencyCap, 8)
  assert.equal(drifted.catalogContradictions.length, 3)
})
