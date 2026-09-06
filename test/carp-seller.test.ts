import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import secp256k1 from 'secp256k1'

import {
  CABEZON_SELLER_ROLE_URL,
  BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER,
  BOGAWANTALAWA_LEGEND_TEA_TEST_REF,
  CARP_SELLER_ROLE_URL,
  MAHA_CARP_DIGITAL_OFFERS,
  SAMLEY_CINNAMON_TEA_RFQ_REF,
  MAHA_CARP_SELLER_URL,
  SAMLEY_CINNAMON_TEA_RFQ_OFFER,
  handleCarpSellerRequest,
  mahaCarpSellerProfile,
} from '../lib/carp/seller.ts'
import { approvedCarpPeer, THRIVBE } from '../lib/carp/gateway.ts'
import {
  didDocumentForPublicKey,
  multibaseForPublicKey,
  signedAgentDescriptor,
  verifySignedAgentDescriptor,
} from '../lib/carp/identity.ts'
import { pollCarpSeller } from '../scripts/run-carp-seller-worker.ts'
import {
  CONTEXT_BUDGET_LADDER_OFFER,
  CONTEXT_COMPRESSION_OFFER,
  DEEP_CONTEXT_EVALUATION_OFFER,
  EVIDENCE_RETENTION_MATRIX_OFFER,
  GOVERNED_CONTEXT_VERIFICATION_OFFER,
  MPS_AUTONOMOUS_AUDIT_OFFER,
  RESEARCH_INTAKE_EVIDENCE_PACK_OFFER,
} from '../lib/x402/offers.ts'

const role = JSON.parse(await readFile(new URL('../content/discovery/carp-seller-role.json', import.meta.url), 'utf8'))

test('the public Seller role mirrors the adopted upstream v0.2 contract', () => {
  assert.equal(role.sourceVersion, '0.2')
  assert.equal(role.upstreamStatus, 'adopted-in-bitsanity-cabezon-after-maha-pr-1')
  assert.equal(role.mahaContribution, 'https://github.com/bitsanity/cabezon/pull/1')
  assert.deepEqual(role.services.map((service: { service: string }) => service.service), ['about', 'enquiry', 'purchase'])
  assert.deepEqual(role.fulfillmentDescriptor.modes, ['physical', 'digital', 'hybrid'])
})

test('the Maha seller maps all seven payable products to the adopted digital offering shape', () => {
  assert.equal(mahaCarpSellerProfile.schemaVersion, '0.1.3')
  assert.equal(mahaCarpSellerProfile.roleContract, CABEZON_SELLER_ROLE_URL)
  assert.equal(mahaCarpSellerProfile.roleMirror, CARP_SELLER_ROLE_URL)
  assert.equal(mahaCarpSellerProfile.membership.status, 'confirmed_cabezon_seller_directory')
  assert.equal(mahaCarpSellerProfile.membership.confirmedAt, '2026-08-21')
  assert.match(mahaCarpSellerProfile.membership.confirmationEvidence, /thrivbe-buyer-review-2026-08-27\.json$/)
  assert.deepEqual(mahaCarpSellerProfile.membership.directPeerBindings, [{
    handle: 'thrivbe',
    status: 'bidirectional_adilos_verified_enquiry_round_trip_completed',
    did: THRIVBE.did,
    sadUrl: THRIVBE.sadUrl,
    descriptorSequence: 2,
    publicKey: THRIVBE.publicKey,
    carpUrl: THRIVBE.carpUrl,
    reciprocalEvidence: 'https://www.mahastrategies.com/artifacts/carp/thrivbe-reciprocal-success-2026-08-28.json',
    enquiryEvidence: 'https://www.mahastrategies.com/artifacts/carp/thrivbe-tea-enquiry-success-2026-08-28.json',
  }])
  const expected = [
    ['maha:context-compression:v1', '0.001', CONTEXT_COMPRESSION_OFFER],
    ['maha:context-budget-ladder:v1', '0.005', CONTEXT_BUDGET_LADDER_OFFER],
    ['maha:deep-context-evaluation:v1', '0.01', DEEP_CONTEXT_EVALUATION_OFFER],
    ['maha:evidence-retention-matrix:v1', '0.05', EVIDENCE_RETENTION_MATRIX_OFFER],
    ['maha:mps-autonomous-audit:v1', '0.10', MPS_AUTONOMOUS_AUDIT_OFFER],
    ['maha:governed-context-verification-pack:v1', '0.50', GOVERNED_CONTEXT_VERIFICATION_OFFER],
    ['maha:research-intake-evidence-pack:v1', '1.00', RESEARCH_INTAKE_EVIDENCE_PACK_OFFER],
  ] as const
  assert.equal(MAHA_CARP_DIGITAL_OFFERS.length, 7)
  for (const [offeringRef, amount, x402] of expected) {
    const offer = MAHA_CARP_DIGITAL_OFFERS.find((candidate) => candidate.offeringRef === offeringRef)
    assert.ok(offer)
    assert.equal(offer.kind, 'digital')
    assert.equal(offer.status, x402.status)
    assert.equal(offer.price.amount, amount)
    assert.equal(offer.directSettlement.amountBaseUnits, x402.amount)
    assert.equal(offer.directSettlement.resource, `https://www.mahastrategies.com${x402.path}`)
    assert.equal(offer.directSettlement.idempotencyRequired, x402.requiresIdempotency)
    assert.deepEqual(offer.fulfillment.modes, ['digital'])
  }
})

test('the direct CARP allowlist binds Thrivbe to its verified DID key and callback', () => {
  assert.equal(didDocumentForPublicKey(THRIVBE.publicKey).id, THRIVBE.did)
  assert.equal(THRIVBE.carpUrl, 'https://carp.thrivbe.com')
  assert.equal(THRIVBE.descriptorSequence, 2)
  assert.deepEqual(approvedCarpPeer(THRIVBE.publicKey), THRIVBE)
  assert.deepEqual(approvedCarpPeer(THRIVBE.publicKey.toUpperCase()), THRIVBE)
  assert.equal(approvedCarpPeer('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'), null)
})

test('enquiry returns the canonical offering array for compatible needs', () => {
  const matched = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'enquiry-1',
    params: { query: 'measure evidence retention in RAG context', tags: ['provenance'], imgtxt: null },
  })
  assert.ok('result' in matched)
  assert.deepEqual(
    (matched as { result: Array<{ offeringRef: string }> }).result.map((offer) => offer.offeringRef),
    MAHA_CARP_DIGITAL_OFFERS.map((offer) => offer.offeringRef),
  )

  const unrelated = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'enquiry-2', params: { query: 'monthly accounting software', tags: [], imgtxt: null },
  })
  assert.ok('result' in unrelated)
  assert.deepEqual((unrelated as { result: unknown[] }).result, [])
})

test('tea enquiries expose the Samley pallet RFQ under Maha without inventing stock or exporter authority', () => {
  const matched = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'cinnamon-enquiry-1',
    params: { query: 'Pure Ceylon cinnamon exported from Sri Lanka', tags: ['physical', 'spice'], imgtxt: null },
  })
  assert.ok('result' in matched)
  const offers = (matched as { result: typeof mahaCarpSellerProfile.offers }).result
  assert.equal(offers.length, 1)
  const offer = offers[0]
  assert.equal(offer.offeringRef, SAMLEY_CINNAMON_TEA_RFQ_REF)
  assert.equal(offer.kind, 'physical')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.offerType, 'request_for_quote')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.status, 'request_for_quote')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.commercialAvailability, 'enquiry_only')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.price, null)
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.directSettlement, null)
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.productSpecification.itemCode, 'SG-S8')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.productSpecification.retailPacksPerPallet, 2_376)
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.indicativeCommercialTerms.indicativePalletProductValue, '1425.60')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.supplier.carpMembershipAsserted, false)
  assert.match(JSON.stringify(SAMLEY_CINNAMON_TEA_RFQ_OFFER.capabilityBoundaries), /Maha is the CABEZON Seller/)
})

test('black tea enquiries expose one bounded retail unit without inventing manufacturer authority', () => {
  const matched = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'black-tea-enquiry-1',
    params: { query: 'one box of Bogawantalawa high grown BOPF black tea', tags: ['physical'], imgtxt: null },
  })
  assert.ok('result' in matched)
  const offers = (matched as { result: typeof mahaCarpSellerProfile.offers }).result
  assert.equal(offers.length, 1)
  assert.equal(offers[0].offeringRef, BOGAWANTALAWA_LEGEND_TEA_TEST_REF)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.commercialAvailability, 'enquiry_only')
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.purchasable, false)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.price, null)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.directSettlement, null)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.inventory.availableUnits, 1)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.inventory.replenishmentPromised, false)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.productSpecification.barcode, '4791037556078')
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.seller.manufacturerAuthorizationAsserted, false)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.seller.distributorRelationshipAsserted, false)
  assert.match(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.productSpecification.visibleCondition, /compression\/creasing/)
  assert.match(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.termsUrl, /\/terms\/physical-goods$/)
  assert.match(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.termsManifest, /\/terms\/carp-physical-goods-v1\.json$/)
})

test('an exact offeringRef returns only that offer and takes priority over free text', () => {
  const exact = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'black-tea-exact-ref-1',
    params: {
      offeringRef: BOGAWANTALAWA_LEGEND_TEA_TEST_REF,
      query: 'AI evidence evaluation',
      tags: ['digital'],
    },
  })
  assert.ok('result' in exact)
  const exactOffers = (exact as { result: typeof mahaCarpSellerProfile.offers }).result
  assert.deepEqual(exactOffers.map((offer) => offer.offeringRef), [BOGAWANTALAWA_LEGEND_TEA_TEST_REF])

  const unknown = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'black-tea-exact-ref-2',
    params: { offeringRef: 'maha:unknown:offer-v1', query: 'tea context evidence' },
  })
  assert.ok('result' in unknown)
  assert.deepEqual((unknown as { result: unknown[] }).result, [])
})

test('each digital offeringRef is independently discoverable without widening to sibling products', () => {
  for (const offer of MAHA_CARP_DIGITAL_OFFERS) {
    const reply = handleCarpSellerRequest({
      jsonrpc: '2.0', method: 'enquiry', id: `enquiry-${offer.offeringRef}`,
      params: { offeringRef: offer.offeringRef, query: 'tea physical shipping' },
    })
    assert.ok('result' in reply)
    assert.deepEqual((reply as { result: Array<{ offeringRef: string }> }).result.map((item) => item.offeringRef), [offer.offeringRef])
  }
})

test('the research-intake offer returns its exact payment instructions', () => {
  const response = handleCarpSellerRequest({
    jsonrpc: '2.0',
    id: 'research-intake-preview-purchase',
    method: 'purchase',
    params: {
      clientOrderRef: 'research-intake-order-001',
      offeringRef: 'maha:research-intake-evidence-pack:v1',
      quantity: 1,
      agreedPrice: { amount: '1.00', asset: 'USDC', network: 'eip155:8453' },
      input: null,
      delivery: { mode: 'digital' },
    },
  })
  assert.ok('result' in response)
  const result = (response as { result: { status: string; paymentInstructions: { amount: string; amountBaseUnits: string; resource: string } } }).result
  assert.equal(result.status, 'PAYMENT_REQUIRED')
  assert.equal(result.paymentInstructions.amount, '1.00')
  assert.equal(result.paymentInstructions.amountBaseUnits, '1000000')
  assert.match(result.paymentInstructions.resource, /\/api\/v1\/research\/intake$/)
})

test('free-text enquiry matching uses tokens rather than substrings', () => {
  const matched = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'black-tea-token-match-1',
    params: { query: BOGAWANTALAWA_LEGEND_TEA_TEST_REF, tags: [], imgtxt: null },
  })
  assert.ok('result' in matched)
  const offers = (matched as { result: typeof mahaCarpSellerProfile.offers }).result
  assert.deepEqual(offers.map((offer) => offer.offeringRef), [BOGAWANTALAWA_LEGEND_TEA_TEST_REF])
})

test('the one-box tea test fails closed at purchase pending a destination-specific quote', () => {
  const reply = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'black-tea-purchase-1',
    params: {
      offeringRef: BOGAWANTALAWA_LEGEND_TEA_TEST_REF,
      quantity: 1,
      agreedPrice: null,
    },
  })
  assert.ok('error' in reply)
  assert.equal(reply.error.code, -32011)
  assert.match(reply.error.message, /QUOTE_REQUIRED/)
  assert.equal((reply.error.data as { offeringRef: string }).offeringRef, BOGAWANTALAWA_LEGEND_TEA_TEST_REF)
  assert.equal(JSON.stringify(reply).includes('paymentInstructions'), false)
  assert.equal(JSON.stringify(reply).includes('escrowInstructions'), false)
  assert.equal(JSON.stringify(reply).includes('deliveryInstructions'), false)
})

test('the one-box tea test rejects legacy and expanded purchase shapes', () => {
  const legacy = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'black-tea-legacy-1',
    params: [1, BOGAWANTALAWA_LEGEND_TEA_TEST_REF, null],
  })
  assert.ok('error' in legacy)
  assert.equal(legacy.error.code, -32602)

  const expanded = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'black-tea-expanded-1',
    params: {
      offeringRef: BOGAWANTALAWA_LEGEND_TEA_TEST_REF,
      quantity: 1,
      agreedPrice: null,
      delivery: { destination: 'undisclosed' },
    },
  })
  assert.ok('error' in expanded)
  assert.equal(expanded.error.code, -32602)
  assert.match(expanded.error.message, /additional fields are refused/)
})

test('the one-box tea evidence is metadata-only and served from the declared public path', async () => {
  const canonicalBytes = await readFile(new URL('../artifacts/carp/bogawantalawa-legend-tea-retail-test-v1.json', import.meta.url))
  const publicBytes = await readFile(new URL('../public/artifacts/carp/bogawantalawa-legend-tea-retail-test-v1.json', import.meta.url))
  assert.deepEqual(publicBytes, canonicalBytes)
  const artifact = JSON.parse(canonicalBytes.toString('utf8'))
  assert.equal(artifact.subject.offeringRef, BOGAWANTALAWA_LEGEND_TEA_TEST_REF)
  assert.equal(artifact.inventory.availableUnits, 1)
  assert.equal(artifact.commercialBoundary.purchasable, false)
  assert.equal(artifact.commercialBoundary.paymentInstructionsPresent, false)
  assert.equal(artifact.claimBoundary.healthClaimsAdopted, false)
  assert.equal(artifact.evidence.imageBytesPublished, true)
  assert.equal(artifact.evidence.sha256.length, 4)
  assert.equal(artifact.evidence.inspectionCopies.length, 4)
  for (const [index, copy] of artifact.evidence.inspectionCopies.entries()) {
    const filename = new URL(copy.url).pathname.split('/').at(-1)
    assert.ok(filename)
    const bytes = await readFile(new URL(`../public/artifacts/carp/bogawantalawa-legend-tea-retail-test-v1/${filename}`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), copy.sha256)
    assert.equal(copy.sha256, artifact.evidence.sha256[index])
  }
  assert.equal(JSON.stringify(artifact).includes('/Users/'), false)
})

test('physical-goods terms are served at the declared human and machine paths', async () => {
  const terms = JSON.parse(await readFile(new URL('../public/terms/carp-physical-goods-v1.json', import.meta.url), 'utf8'))
  assert.equal(terms.purchasable, false)
  assert.equal(terms.currentAvailability, 'enquiry_only')
  assert.equal(terms.boundary.paymentInstructionsAvailable, false)
  assert.match(terms.failClosed, /suppresses payment, escrow and delivery instructions/)
  assert.match(await readFile(new URL('../app/terms/page.tsx', import.meta.url), 'utf8'), /\/terms\/physical-goods/)
  assert.match(await readFile(new URL('../app/terms/physical-goods/page.tsx', import.meta.url), 'utf8'), /Enquiry first/)
})

test('the sanitized Thrivbe report preserves the blocked round trip without personal or encrypted content', async () => {
  const canonical = await readFile(new URL('../artifacts/carp/thrivbe-buyer-review-2026-08-27.json', import.meta.url))
  const published = await readFile(new URL('../public/artifacts/carp/thrivbe-buyer-review-2026-08-27.json', import.meta.url))
  assert.deepEqual(published, canonical)
  const artifact = JSON.parse(canonical.toString('utf8'))
  assert.equal(artifact.observations.cabezonSellerDirectoryDiscovery, 'pass')
  assert.equal(artifact.observations.mahaEncryptedEnquiryHttpStatus, 401)
  assert.equal(artifact.observations.sellerSideAsyncResultCreated, false)
  assert.equal(artifact.scope.moneyAuthorized, false)
  assert.equal(artifact.retention.credentialsRetained, false)
  assert.equal(artifact.retention.encryptedPayloadsRetained, false)
  assert.match(artifact.claimBoundary, /not a completed direct encrypted enquiry/)
  assert.doesNotMatch(canonical.toString('utf8'), /@|\+47|938 12345|msghex|sighex/)
})

test('the reciprocal attempt artifact records the HTTP parsing failure without protocol secrets', async () => {
  const canonical = await readFile(new URL('../artifacts/carp/thrivbe-reciprocal-attempt-2026-08-28.json', import.meta.url))
  const published = await readFile(new URL('../public/artifacts/carp/thrivbe-reciprocal-attempt-2026-08-28.json', import.meta.url))
  assert.deepEqual(published, canonical)
  const artifact = JSON.parse(canonical.toString('utf8'))
  assert.equal(artifact.observations.mahaSignedDescriptorFetch, 'pass')
  assert.equal(artifact.correction.supersedesClassification, 'failed_transport')
  assert.equal(artifact.observations.requestReachedThrivbe, true)
  assert.equal(artifact.observations.thrivbeChallengeFetch, 'failed_http_response_parsing')
  assert.equal(artifact.observations.nodeParserErrorCode, 'HPE_INVALID_HEADER_TOKEN')
  assert.equal(artifact.observations.parseableChallengeReceivedByMaha, false)
  assert.equal(artifact.observations.responseGenerated, false)
  assert.equal(artifact.observations.responseSent, false)
  assert.equal(artifact.observations.reciprocalProofCompleted, false)
  assert.equal(artifact.observations.encryptedEnquirySent, false)
  assert.equal(artifact.followUpDiagnosis.nextAttemptRequiresFreshAuthorization, true)
  assert.equal(artifact.refreshedDescriptorVerification.sequence, 2)
  assert.equal(artifact.refreshedDescriptorVerification.carpUrl, THRIVBE.carpUrl)
  assert.equal(artifact.refreshedDescriptorVerification.publicKeyUnchanged, true)
  assert.equal(artifact.refreshedDescriptorVerification.signatureVerified, true)
  assert.equal(artifact.retention.privateKeysRetained, false)
  assert.equal(artifact.retention.adilosChallengesRetained, false)
  assert.doesNotMatch(canonical.toString('utf8'), /"challenge"\s*:|"response"\s*:|"privateKey"\s*:|CARP_AGENT_PRIVATE_KEY/)
})

test('the reciprocal success artifact records identity proof only and retains no protocol secrets', async () => {
  const canonical = await readFile(new URL('../artifacts/carp/thrivbe-reciprocal-success-2026-08-28.json', import.meta.url))
  const published = await readFile(new URL('../public/artifacts/carp/thrivbe-reciprocal-success-2026-08-28.json', import.meta.url))
  assert.deepEqual(published, canonical)
  const artifact = JSON.parse(canonical.toString('utf8'))
  assert.equal(artifact.outcome, 'reciprocal_proof_completed')
  assert.equal(artifact.peer.descriptorSequence, 2)
  assert.equal(artifact.peer.carpUrl, THRIVBE.carpUrl)
  assert.equal(artifact.checks.acknowledgedPublishedMahaKey, true)
  assert.equal(artifact.checks.encryptedEnquirySent, false)
  assert.equal(artifact.checks.moneyUsed, false)
  assert.equal(artifact.executionBoundary.temporaryRouteRemovedAfterAttempt, true)
  assert.equal(artifact.retention.privateKeysRetained, false)
  assert.doesNotMatch(canonical.toString('utf8'), /"challenge"\s*:|"response"\s*:|"privateKey"\s*:|CARP_AGENT_PRIVATE_KEY/)
})

test('the final Thrivbe artifact records exactly one no-money encrypted tea enquiry', async () => {
  const canonical = await readFile(new URL('../artifacts/carp/thrivbe-tea-enquiry-success-2026-08-28.json', import.meta.url))
  const published = await readFile(new URL('../public/artifacts/carp/thrivbe-tea-enquiry-success-2026-08-28.json', import.meta.url))
  assert.deepEqual(published, canonical)
  const artifact = JSON.parse(canonical.toString('utf8'))
  assert.equal(artifact.scope.offeringRef, BOGAWANTALAWA_LEGEND_TEA_TEST_REF)
  assert.equal(artifact.scope.encryptedEnquiriesAuthorized, 1)
  assert.equal(artifact.scope.encryptedEnquiriesSent, 1)
  assert.equal(artifact.observations.mahaEncryptedEnquiryHttpStatus, 200)
  assert.equal(artifact.observations.correlatedEncryptedCallbackReceived, true)
  assert.equal(artifact.observations.offersReturned, 2)
  assert.equal(artifact.observations.offersMatchingExactReference, 1)
  assert.match(artifact.observations.sellerMatchingFinding, /ai appeared inside the word retail/)
  assert.equal(artifact.confirmedCommercialBoundary.purchasable, false)
  assert.equal(artifact.confirmedCommercialBoundary.price, null)
  assert.equal(artifact.confirmedCommercialBoundary.paymentInstructionsPresent, false)
  assert.equal(artifact.retention.rawCorrelatedAnswerRetained, false)
  assert.equal(artifact.retention.encryptedPayloadsRetained, false)
  assert.doesNotMatch(canonical.toString('utf8'), /@|\+47|938 12345|msghex|sighex|"challenge"\s*:|"response"\s*:/)
})

test('the Samley RFQ fails closed at purchase until an order-specific quote exists', () => {
  const reply = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'cinnamon-purchase-1',
    params: {
      offeringRef: SAMLEY_CINNAMON_TEA_RFQ_REF,
      quantity: 1,
      agreedPrice: null,
    },
  })
  assert.ok('error' in reply)
  assert.equal(reply.error.code, -32011)
  assert.match(reply.error.message, /QUOTE_REQUIRED/)
  assert.equal((reply.error.data as { commercialAvailability: string }).commercialAvailability, 'enquiry_only')
  assert.equal(JSON.stringify(reply).includes('paymentInstructions'), false)
})

test('the physical RFQ accepts only its exact v0.2 object boundary', () => {
  const legacy = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'cinnamon-legacy-1',
    params: [1, SAMLEY_CINNAMON_TEA_RFQ_REF, null],
  })
  assert.ok('error' in legacy)
  assert.equal(legacy.error.code, -32602)
  assert.match(legacy.error.message, /Legacy positional arguments/)

  const extraFields = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'cinnamon-extra-fields-1',
    params: {
      offeringRef: SAMLEY_CINNAMON_TEA_RFQ_REF,
      quantity: 1,
      agreedPrice: null,
      delivery: { mode: 'physical', destination: { country: 'US' } },
    },
  })
  assert.ok('error' in extraFields)
  assert.equal(extraFields.error.code, -32602)
  assert.match(extraFields.error.message, /additional fields are refused/)
})

test('the sanitized RFQ verification artifact records only the pre-money response boundary', async () => {
  const artifact = JSON.parse(await readFile(new URL('../artifacts/carp/rfq-purchase-verification-v0.2.json', import.meta.url), 'utf8'))
  assert.equal(artifact.subject.offeringRef, SAMLEY_CINNAMON_TEA_RFQ_REF)
  assert.deepEqual(artifact.acceptedRequestShape.params, {
    offeringRef: SAMLEY_CINNAMON_TEA_RFQ_REF,
    quantity: 1,
    agreedPrice: null,
  })
  assert.equal(artifact.acceptedRequestShape.legacyPositionalArgumentsAccepted, false)
  assert.equal(artifact.acceptedRequestShape.additionalFieldsAccepted, false)
  assert.equal(artifact.observedOutcome.reasonCode, 'QUOTE_REQUIRED')
  assert.equal(artifact.observedOutcome.paymentInstructionsPresent, false)
  assert.equal(artifact.retention.credentialsRetained, false)
  const forbiddenKeys = new Set(['CARP_AGENT_PRIVATE_KEY', 'privateKey', 'accessToken', 'authorization', 'sessionKey'])
  const collectKeys = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(collectKeys)
    if (!value || typeof value !== 'object') return []
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [key, ...collectKeys(nested)])
  }
  assert.equal(collectKeys(artifact).some((key) => forbiddenKeys.has(key)), false)
})

test('the physical RFQ discloses non-binding economics without presenting freight as a fixed price', () => {
  const offer = SAMLEY_CINNAMON_TEA_RFQ_OFFER
  assert.equal(offer.productSpecification.masterCartonsPerPallet * offer.productSpecification.retailPacksPerMasterCarton, 2_376)
  assert.equal((Number(offer.indicativeCommercialTerms.retailPackUnitPrice) * offer.productSpecification.retailPacksPerPallet).toFixed(2), '1425.60')
  assert.equal(offer.indicativeCommercialTerms.nonBinding, true)
  assert.equal(offer.indicativeCommercialTerms.namedPort, null)
  assert.ok(offer.indicativeCommercialTerms.excludes.includes('freight'))
  assert.doesNotMatch(JSON.stringify(offer), /1500/)
})

test('purchase binds each canonical order to its own exact x402 instructions', () => {
  const payable = MAHA_CARP_DIGITAL_OFFERS.filter((offer) => offer.status === 'available')
  for (const [index, offer] of payable.entries()) {
    const accepted = handleCarpSellerRequest({
      jsonrpc: '2.0', method: 'purchase', id: `purchase-${index + 1}`,
      params: {
        clientOrderRef: `buyer-order-00${index + 1}`,
        offeringRef: offer.offeringRef,
        quantity: 1,
        agreedPrice: offer.price,
        input: { clientRequestId: `carp-test-${index + 1}` },
        delivery: { mode: 'digital', destination: null, replyTo: `carp://buyer/results/buyer-order-00${index + 1}` },
        specialInstructions: null,
      },
    })
    assert.ok('result' in accepted)
    const result = (accepted as { result: { status: string; paymentInstructions: { mode: string; amount: string; amountBaseUnits: string; resource: string } } }).result
    assert.equal(result.status, 'PAYMENT_REQUIRED')
    assert.equal(result.paymentInstructions.mode, 'x402_direct')
    assert.equal(result.paymentInstructions.amount, offer.price.amount)
    assert.equal(result.paymentInstructions.amountBaseUnits, offer.directSettlement.amountBaseUnits)
    assert.equal(result.paymentInstructions.resource, offer.directSettlement.resource)
  }

  const stale = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'purchase-stale',
    params: {
      clientOrderRef: 'buyer-order-002', offeringRef: 'maha:deep-context-evaluation:v1', quantity: 1,
      agreedPrice: { amount: '0.009', asset: 'USDC', network: 'eip155:8453' },
      delivery: { mode: 'digital', destination: null },
    },
  })
  assert.ok('error' in stale)
  assert.equal(stale.error.code, -32010)

  const substituted = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'purchase-substituted-price',
    params: {
      clientOrderRef: 'buyer-order-substitution', offeringRef: 'maha:context-compression:v1', quantity: 1,
      agreedPrice: { amount: '0.10', asset: 'USDC', network: 'eip155:8453' },
      delivery: { mode: 'digital', destination: null },
    },
  })
  assert.ok('error' in substituted)
  assert.equal(substituted.error.code, -32010)
  assert.deepEqual(substituted.error.data, MAHA_CARP_DIGITAL_OFFERS[0].price)
})

test('legacy purchase arrays remain compatible with base-unit quotes', () => {
  const payable = MAHA_CARP_DIGITAL_OFFERS.filter((offer) => offer.status === 'available')
  for (const [index, offer] of payable.entries()) {
    const accepted = handleCarpSellerRequest({
      jsonrpc: '2.0', method: 'purchase', id: `0x${String(index + 1).repeat(64)}`,
      params: [1, offer.offeringRef, { amount: offer.directSettlement.amountBaseUnits, asset: offer.directSettlement.assetContract, network: offer.price.network }, null, ''],
    })
    assert.ok('result' in accepted)
    assert.equal((accepted as { result: { paymentInstructions: { amountBaseUnits: string } } }).result.paymentInstructions.amountBaseUnits, offer.directSettlement.amountBaseUnits)
  }

  const wrongAsset = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: `0x${'4'.repeat(64)}`,
    params: [1, MAHA_CARP_DIGITAL_OFFERS[0].offeringRef, {
      amount: MAHA_CARP_DIGITAL_OFFERS[0].directSettlement.amountBaseUnits,
      asset: '0x0000000000000000000000000000000000000000',
      network: MAHA_CARP_DIGITAL_OFFERS[0].price.network,
    }, null, ''],
  })
  assert.ok('error' in wrongAsset)
  assert.equal(wrongAsset.error.code, -32010)
})

test('Maha DID and SAD are derived from and signed by the same secp256k1 identity', () => {
  const privateKey = '1'.padStart(64, '0')
  const publicKey = Buffer.from(secp256k1.publicKeyCreate(Buffer.from(privateKey, 'hex'), true)).toString('hex')
  assert.match(multibaseForPublicKey(publicKey), /^zQ3s/)
  const did = didDocumentForPublicKey(publicKey)
  const sad = signedAgentDescriptor({ privateKey, issuedAt: '2026-08-13T00:00:00.000Z', expiresAt: '2027-08-13T00:00:00.000Z' })
  assert.equal(sad.id, did.id)
  assert.equal(sad.publicKey.value, publicKey)
  assert.equal(verifySignedAgentDescriptor(sad), true)
  assert.equal(sad.proof.canonicalization, 'RFC8785')
  assert.equal(sad.sequence, 2)
  assert.match(sad.descrip, /physical-goods enquiries/)
  assert.match(sad.descrip, /enquiry-only/)
})

test('the worker polls one authenticated request and returns a JSON-RPC result', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const client = `02${'a'.repeat(64)}`
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.endsWith('/cgi-bin/nextrequest')) return Response.json({ method: 'about', params: {}, client, cookie: 'request-cookie-001' })
    return new Response('ACK', { status: 200 })
  }
  assert.equal(await pollCarpSeller({ baseUrl: 'http://127.0.0.1:8000/', timeoutMs: 2_000, fetchImpl }), true)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, 'http://127.0.0.1:8000/cgi-bin/result')
})

test('public CARP discovery URLs are stable', () => {
  assert.equal(CARP_SELLER_ROLE_URL, 'https://www.mahastrategies.com/.well-known/carp/seller-role.json')
  assert.equal(MAHA_CARP_SELLER_URL, 'https://www.mahastrategies.com/.well-known/carp/seller.json')
})
