import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  AGENTIC_COMMERCE_API_URL,
  AGENTIC_COMMERCE_CONTEXT_URL,
  AGENTIC_COMMERCE_MANIFEST_URL,
  availableOffers,
  agenticCommerceDiscovery,
  mpsAuditOffer,
  mpsAuditServiceJsonLd,
} from '../lib/agentic-commerce.ts'

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public')
// The metered discovery documents moved out of public/ so that requests for
// them reach the origin and can be counted; they are served at the same URLs
// by rewrites.
const DISCOVERY_DIR = join(import.meta.dirname, '..', 'content', 'discovery')

test('MPS agentic-commerce offer is discovery-only and preserves the human payment boundary', () => {
  assert.equal(agenticCommerceDiscovery.transactionPolicy.autonomousPaymentSupported, false)
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

test('agent context links only to the canonical public discovery surfaces', () => {
  const context = readFileSync(join(DISCOVERY_DIR, 'agentic-commerce.md'), 'utf8')
  const llms = readFileSync(join(PUBLIC_DIR, 'llms.txt'), 'utf8')
  for (const url of [AGENTIC_COMMERCE_MANIFEST_URL, AGENTIC_COMMERCE_API_URL, AGENTIC_COMMERCE_CONTEXT_URL]) {
    assert.ok(context.includes(url) || llms.includes(url), `${url} must be discoverable`)
  }
  assert.match(context, /do(?:es)? not authorize an autonomous charge/i)
  assert.match(context, /cannot be recovered later/i)
})

test('the long-lived agent-offers manifest exposes the same MPS payment boundary', () => {
  const manifest = JSON.parse(readFileSync(join(DISCOVERY_DIR, 'agent-offers.json'), 'utf8')) as {
    transactionPolicy: { autonomousPaymentSupported: boolean; humanConfirmationRequired: boolean }
    offers: Array<{ id: string; purchase?: { mode?: string }; prepaidCredits?: { insufficientBalance?: { httpStatus?: number } } }>
  }
  const mpsOffer = manifest.offers.find((offer) => offer.id === mpsAuditOffer.id)
  assert.equal(manifest.transactionPolicy.autonomousPaymentSupported, false)
  assert.equal(manifest.transactionPolicy.humanConfirmationRequired, true)
  assert.equal(mpsOffer?.purchase?.mode, mpsAuditOffer.purchase.mode)
  assert.equal(mpsOffer?.prepaidCredits?.insufficientBalance?.httpStatus, 402)
})
