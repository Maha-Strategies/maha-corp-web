import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  AGENTIC_COMMERCE_API_URL,
  AGENTIC_COMMERCE_CONTEXT_URL,
  AGENTIC_COMMERCE_MANIFEST_URL,
  availableOffers,
  agenticCommerceDiscovery,
  contextCompressionX402Capability,
  mpsAuditOffer,
  mpsAuditServiceJsonLd,
} from '../lib/agentic-commerce.ts'
import claimsData from '../lib/atlas/generated-claims.json' with { type: 'json' }
import { buildLlmsManifest } from '../lib/llms-manifest.ts'
import type { MpsClaim } from '../scripts/expand-graph.ts'

// The metered discovery documents moved out of public/ so that requests for
// them reach the origin and can be counted; they are served at the same URLs
// by rewrites.
const DISCOVERY_DIR = join(import.meta.dirname, '..', 'content', 'discovery')

test('discovery scopes autonomous x402 to Context Compression and preserves the MPS human payment boundary', () => {
  assert.equal(agenticCommerceDiscovery.transactionPolicy.autonomousPaymentSupported, true)
  assert.deepEqual(agenticCommerceDiscovery.transactionPolicy.autonomousPaymentScope, ['context-compression'])
  assert.equal(agenticCommerceDiscovery.transactionPolicy.humanConfirmationRequired, true)
  assert.equal(mpsAuditOffer.purchase.mode, 'human_confirmed_stripe_checkout')
  assert.equal(mpsAuditOffer.prepaidCredits.insufficientBalance.httpStatus, 402)
  assert.equal(mpsAuditOffer.prepaidCredits.unit, 'mps_audit_invocation')
  assert.match(mpsAuditOffer.credentialPolicy.recovery, /cannot be recovered/i)
})

test('discovery includes every currently available product with an explicit acquisition model', () => {
  const ids = new Set(availableOffers.map((offer) => offer.id))
  for (const id of [
    'mps-prepaid-audit-access', 'mps-preflight', 'book-the-imagined-life', 'book-the-orbital-mind',
    'book-the-synthetic-self', 'book-the-unfinished-species', 'maha-os-mobile-app',
    'rapid-intelligence-brief', 'verified-research-brief',
  ]) assert.ok(ids.has(id), `missing ${id}`)
  assert.equal(availableOffers.length, 9)
})

test('machine-readable book offers distinguish free reading from the paid local-MCP entitlement', () => {
  const books = availableOffers.filter((offer) => offer.id.startsWith('book-'))
  assert.equal(books.length, 4)
  for (const book of books) {
    assert.ok('access' in book && 'pricing' in book && 'entitlementPolicy' in book, `${book.id} is missing book-access terms`)
    assert.match(book.access.publicWebEdition, /Free to read/i)
    assert.match(book.access.machineReadableContent, /heading-addressable/i)
    assert.equal(book.pricing.type, 'stripe_checkout_disclosed')
    assert.match(book.entitlementPolicy.refundAndDispute, /dispute.*lost/i)
  }
})

test('MPS purchase-page JSON-LD identifies the same commercial service without inventing a price', () => {
  assert.equal(mpsAuditServiceJsonLd['@type'], 'Service')
  assert.equal(mpsAuditServiceJsonLd.url, mpsAuditOffer.serviceUrl)
  assert.equal('offers' in mpsAuditServiceJsonLd, false)
  assert.match(JSON.stringify(mpsAuditServiceJsonLd), /402 Payment Required/)
})

test('the served orientation file points agents at the commercial surfaces', () => {
  // /llms.txt is the conventional file an evaluating agent reads first. It
  // listed the research claim index and the API endpoints but no commercial
  // surface, so nothing led an agent from there to the offers.
  const llms = buildLlmsManifest(claimsData as MpsClaim[])
  for (const url of [AGENTIC_COMMERCE_MANIFEST_URL, AGENTIC_COMMERCE_API_URL, AGENTIC_COMMERCE_CONTEXT_URL]) {
    assert.ok(llms.includes(url), `${url} must appear in the served /llms.txt`)
  }
  assert.ok(llms.includes('/.well-known/agent.json'), 'the agent card must be reachable from /llms.txt')
  // The payment boundary travels with the offer, not only on the purchase page.
  assert.match(llms, /human purchaser must authorize/i)
  assert.match(llms, /x402 v2 payment of 0\.001 USDC/i)
  assert.match(llms, /api\/v1\/compress/)
  for (const endpoint of [
    '/api/v1/jobs/tensor-network',
    '/api/v1/jobs/geometric-registration',
  ]) assert.ok(llms.includes(endpoint), `${endpoint} must be discoverable`)
  // The standalone QUBO reference engine is beta and unbenchmarked, so it must
  // not appear here: /llms.txt is the first file an evaluating agent reads, and
  // an entry in it is an advertisement. See docs/qubo-reference-promotion.md.
  assert.equal(llms.includes('/api/v1/jobs/qubo-ising'), false, 'the unpromoted engine must not be discoverable')
  for (const marker of ['tensor-opt', 'geometric-ai', 'holographic-qec', 'qec-compiler', 'landscape-opt']) {
    assert.equal(llms.toLowerCase().includes(marker), false, `${marker} must not be publicly discoverable`)
  }
})

test('the generated orientation route is not shadowed by an obsolete public file', () => {
  assert.equal(existsSync(join(import.meta.dirname, '..', 'public', 'llms.txt')), false)
})

test('public agent discovery identifies live capabilities and the scoped Context Compression payment contract', () => {
  const offers = JSON.parse(readFileSync(join(DISCOVERY_DIR, 'agent-offers.json'), 'utf8')) as {
    updatedAt: string
    transactionPolicy: { autonomousPaymentSupported: boolean; autonomousPaymentScope: string[] }
    technicalCapabilities: Array<{
      id: string
      endpoint?: string
      status?: string
      methodBoundary?: string
      benchmarkUrl?: string
      benchmarkResultsUrl?: string
      executableRecipeUrl?: string
      discoveryPaymentRecipeUrl?: string
      machinePayment?: {
        protocol: string
        version: number
        network: string
        asset: string
        amount: string
        displayAmount: string
      }
    }>
  }
  const card = JSON.parse(readFileSync(join(DISCOVERY_DIR, 'agent-card.json'), 'utf8')) as {
    serviceCatalog: string
    capabilities: Array<{
      id: string
      status?: string
      benchmark?: string
      executableRecipe?: string
      discoveryPaymentRecipe?: string
      payment?: { protocol: string; version: number; network: string; amount: string; assetSymbol: string; autonomous: boolean }
    }>
  }
  assert.equal(offers.updatedAt, '2026-08-08T00:00:00.000Z')
  assert.equal(offers.transactionPolicy.autonomousPaymentSupported, true)
  assert.deepEqual(offers.transactionPolicy.autonomousPaymentScope, ['context-compression'])
  const expected = [
    'context-compression',
    // gpu-qubo-ising is deliberately absent: the standalone reference engine is
    // beta and undiscoverable until its vectorized candidate has passing A10G
    // evidence. See docs/qubo-reference-promotion.md.
    'gpu-tensor-network',
    'gpu-geometric-registration',
    'enterprise-mcp-gateway',
  ]
  assert.deepEqual(offers.technicalCapabilities.map((capability) => capability.id), expected)
  assert.deepEqual(card.capabilities.map((capability) => capability.id), expected)
  assert.equal(card.serviceCatalog, AGENTIC_COMMERCE_MANIFEST_URL)
  assert.match(offers.technicalCapabilities.find((capability) => capability.id === 'gpu-tensor-network')?.methodBoundary ?? '', /heuristic/i)

  const contextOffer = offers.technicalCapabilities.find((capability) => capability.id === 'context-compression')
  const contextCard = card.capabilities.find((capability) => capability.id === 'context-compression')
  assert.equal(contextOffer?.status, 'available_with_api_key_or_x402')
  assert.equal(contextCard?.status, 'available_with_api_key_or_x402')
  assert.equal(contextOffer?.benchmarkUrl, 'https://www.mahastrategies.com/benchmarks/context-retention')
  assert.equal(contextOffer?.benchmarkResultsUrl, 'https://www.mahastrategies.com/benchmarks/mcrb-1/results.json')
  assert.equal(contextOffer?.executableRecipeUrl, 'https://www.mahastrategies.com/recipes/context-compiler-large-document')
  assert.equal(contextOffer?.discoveryPaymentRecipeUrl, 'https://www.mahastrategies.com/recipes/bazaar-discovery-to-payment')
  assert.equal(contextCard?.benchmark, contextOffer?.benchmarkUrl)
  assert.equal(contextCard?.executableRecipe, contextOffer?.executableRecipeUrl)
  assert.equal(contextCard?.discoveryPaymentRecipe, contextOffer?.discoveryPaymentRecipeUrl)
  assert.equal(contextOffer?.machinePayment?.protocol, contextCompressionX402Capability.payment.protocol)
  assert.equal(contextOffer?.machinePayment?.version, contextCompressionX402Capability.payment.version)
  assert.equal(contextOffer?.machinePayment?.network, contextCompressionX402Capability.payment.network)
  assert.equal(contextOffer?.machinePayment?.asset, contextCompressionX402Capability.payment.asset)
  assert.equal(contextOffer?.machinePayment?.amount, contextCompressionX402Capability.payment.amount)
  assert.equal(contextOffer?.machinePayment?.displayAmount, contextCompressionX402Capability.payment.displayAmount)
  assert.deepEqual(contextCard?.payment, {
    protocol: contextCompressionX402Capability.payment.protocol,
    version: contextCompressionX402Capability.payment.version,
    network: contextCompressionX402Capability.payment.network,
    amount: contextCompressionX402Capability.payment.amount,
    assetSymbol: contextCompressionX402Capability.payment.assetSymbol,
    autonomous: true,
  })
})

test('agent context links only to the canonical public discovery surfaces', () => {
  const context = readFileSync(join(DISCOVERY_DIR, 'agentic-commerce.md'), 'utf8')
  // The manifest that /llms.txt actually serves, not the shadowed public/
  // file. Reading the latter made this guarantee pass while being false in
  // production: the served document listed no commercial surface at all.
  const llms = buildLlmsManifest(claimsData as MpsClaim[])
  for (const url of [AGENTIC_COMMERCE_MANIFEST_URL, AGENTIC_COMMERCE_API_URL, AGENTIC_COMMERCE_CONTEXT_URL]) {
    assert.ok(context.includes(url) || llms.includes(url), `${url} must be discoverable`)
  }
  assert.match(context, /accepts autonomous payment/i)
  assert.match(context, /does not authorize autonomous Stripe Checkout/i)
  assert.match(context, /cannot be recovered later/i)
})

test('the long-lived agent-offers manifest exposes the same MPS payment boundary', () => {
  const manifest = JSON.parse(readFileSync(join(DISCOVERY_DIR, 'agent-offers.json'), 'utf8')) as {
    transactionPolicy: { autonomousPaymentSupported: boolean; autonomousPaymentScope: string[]; humanConfirmationRequired: boolean }
    offers: Array<{ id: string; purchase?: { mode?: string }; prepaidCredits?: { insufficientBalance?: { httpStatus?: number } } }>
  }
  const mpsOffer = manifest.offers.find((offer) => offer.id === mpsAuditOffer.id)
  assert.equal(manifest.transactionPolicy.autonomousPaymentSupported, true)
  assert.deepEqual(manifest.transactionPolicy.autonomousPaymentScope, ['context-compression'])
  assert.equal(manifest.transactionPolicy.humanConfirmationRequired, true)
  assert.equal(mpsOffer?.purchase?.mode, mpsAuditOffer.purchase.mode)
  assert.equal(mpsOffer?.prepaidCredits?.insufficientBalance?.httpStatus, 402)
})
