import { createHash } from 'node:crypto'

import agentOffers from '../content/discovery/agent-offers.json' with { type: 'json' }

import { BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER, SAMLEY_CINNAMON_TEA_RFQ_OFFER } from './carp/seller.ts'
import { canonicalJson } from './evidence-dossier/digest.ts'
import { MCP_EVIDENCE_CAPABILITY, MCP_EVIDENCE_LICENSE_PLANS, MCP_EVIDENCE_TOOL_NAME } from './mcp-evidence-licensing.ts'
import { X402_OFFERS } from './x402/offers.ts'

export const PRODUCT_FEDERATION_VERSION = 'maha-product-federation/0.1' as const
export const PRODUCT_FEDERATION_EFFECTIVE_AT = '2026-08-29T00:00:00.000Z' as const

export type FederatedProductState = 'informational' | 'inquiry_available' | 'licensed' | 'payable' | 'withheld'
export type FederatedProductFamily =
  | 'evidence-and-governance'
  | 'machine-utilities'
  | 'computational-provenance'
  | 'knowledge-and-books'
  | 'advisory'
  | 'software'
  | 'celestial'
  | 'physical-goods'

export interface ProductFederationIdentity {
  did: string
  sadSha256: string
  endpoint: string
}

export interface FederatedProduct {
  productId: string
  namespace: 'maha-strategies' | 'maha-celestial'
  family: FederatedProductFamily
  title: string
  description: string
  state: FederatedProductState
  discoveryUrl: string
  source: {
    authority: 'agent-offers' | 'x402-catalog' | 'carp-seller' | 'mcp-license-registry' | 'internal-product-contract'
    sourceId: string
    sourceSha256: string
  }
  access: {
    mode: 'public-read' | 'bounded-enquiry' | 'licensed-tool' | 'self-service-purchase' | 'withheld'
    enquiryEnabled: boolean
    purchaseEnabledInSource: boolean
    purchaseEnabledThroughCabezonPreview: false
    deliveryMode: 'web' | 'api' | 'mcp' | 'app-store' | 'human-delivery' | 'physical-rfq' | 'none'
  }
  capability: string | null
  boundaries: readonly string[]
}

export interface ProductFederationProjection {
  schemaVersion: typeof PRODUCT_FEDERATION_VERSION
  mode: 'preview-read-only-federation'
  effectiveAt: typeof PRODUCT_FEDERATION_EFFECTIVE_AT
  seller: ProductFederationIdentity
  products: FederatedProduct[]
  counts: Record<FederatedProductState, number>
  authority: {
    discoveryOnly: true
    paymentEnabled: false
    escrowEnabled: false
    entitlementMutationEnabled: false
    corpusInspectionEnabled: false
    canonicalReleaseEnabled: false
  }
  projectionSha256: string
}

const SITE = 'https://www.mahastrategies.com'

function sha256Canonical(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

function agentState(status: string): FederatedProductState {
  if (status === 'available_for_self_service_purchase') return 'payable'
  if (status === 'available_for_inquiry') return 'inquiry_available'
  if (status === 'contract_published_runtime_withheld') return 'withheld'
  return 'informational'
}

function familyForAgentOffer(id: string): FederatedProductFamily {
  if (id.startsWith('book-')) return 'knowledge-and-books'
  if (id === 'maha-os-mobile-app') return 'software'
  if (id.includes('brief')) return 'advisory'
  return 'evidence-and-governance'
}

function deliveryForAgentOffer(id: string, state: FederatedProductState): FederatedProduct['access']['deliveryMode'] {
  if (id.startsWith('book-')) return 'web'
  if (id === 'maha-os-mobile-app') return 'app-store'
  if (state === 'inquiry_available') return 'human-delivery'
  return state === 'payable' ? 'api' : 'none'
}

function buildAgentProducts(): FederatedProduct[] {
  return agentOffers.offers.map((offer) => {
    const state = agentState(offer.status)
    return {
      productId: offer.id,
      namespace: 'maha-strategies',
      family: familyForAgentOffer(offer.id),
      title: offer.name,
      description: offer.description ?? `${offer.name} as declared in Maha's canonical agent-offer catalog.`,
      state,
      discoveryUrl: offer.serviceUrl,
      source: { authority: 'agent-offers', sourceId: offer.id, sourceSha256: sha256Canonical(offer) },
      access: {
        mode: state === 'payable' ? 'self-service-purchase' : state === 'inquiry_available' ? 'bounded-enquiry' : state === 'withheld' ? 'withheld' : 'public-read',
        enquiryEnabled: state === 'inquiry_available',
        purchaseEnabledInSource: state === 'payable',
        purchaseEnabledThroughCabezonPreview: false,
        deliveryMode: deliveryForAgentOffer(offer.id, state),
      },
      capability: null,
      boundaries: ['CABEZON Preview projects source availability but cannot authorize payment, issue credentials, or widen the source contract.'],
    }
  })
}

function buildX402Products(): FederatedProduct[] {
  return X402_OFFERS.map((offer): FederatedProduct => {
    const state: FederatedProductState = offer.status === 'available' && offer.availability.payableInProduction ? 'payable' : 'withheld'
    const isMachineBook = offer.id.startsWith('book-section-') || offer.id.startsWith('book-edition-')
    return {
      productId: offer.id,
      namespace: 'maha-strategies',
      family: isMachineBook ? 'knowledge-and-books' : 'machine-utilities',
      title: offer.serviceName,
      description: offer.description,
      state,
      discoveryUrl: `${SITE}/api/discovery/x402-offers/${offer.id}`,
      source: { authority: 'x402-catalog', sourceId: offer.id, sourceSha256: sha256Canonical(offer) },
      access: {
        mode: state === 'payable' ? 'self-service-purchase' : 'withheld',
        enquiryEnabled: false,
        purchaseEnabledInSource: state === 'payable',
        purchaseEnabledThroughCabezonPreview: false,
        deliveryMode: state === 'payable' ? (isMachineBook ? 'mcp' : 'api') : 'none',
      },
      capability: null,
      boundaries: [...offer.capabilityBoundaries, 'CABEZON Preview cannot create, sign, settle, or replay an x402 payment.'],
    }
  })
}

function physicalProduct(offer: typeof SAMLEY_CINNAMON_TEA_RFQ_OFFER | typeof BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER): FederatedProduct {
  return {
    productId: offer.offeringRef,
    namespace: 'maha-strategies',
    family: 'physical-goods',
    title: offer.title,
    description: offer.descrip,
    state: 'inquiry_available',
    discoveryUrl: `${SITE}/.well-known/carp/seller.json`,
    source: { authority: 'carp-seller', sourceId: offer.offeringRef, sourceSha256: sha256Canonical(offer) },
    access: {
      mode: 'bounded-enquiry', enquiryEnabled: true, purchaseEnabledInSource: false,
      purchaseEnabledThroughCabezonPreview: false, deliveryMode: 'physical-rfq',
    },
    capability: null,
    boundaries: [...offer.capabilityBoundaries, 'An enquiry is not an order, reservation, accepted quote, payment instruction, shipment, or delivery.'],
  }
}

function internalProducts(): FederatedProduct[] {
  const developer = MCP_EVIDENCE_LICENSE_PLANS['evidence-developer-v1']
  return [
    {
      productId: 'licensed-evidence-mcp', namespace: 'maha-strategies', family: 'evidence-and-governance',
      title: 'Licensed Evidence MCP',
      description: 'Entitlement-gated retrieval of exact active canonical releases with claim-level provenance and explicit boundaries.',
      state: 'licensed', discoveryUrl: `${SITE}/developers`,
      source: { authority: 'mcp-license-registry', sourceId: `${developer.planId}@${developer.planVersion}`, sourceSha256: sha256Canonical(developer) },
      access: { mode: 'licensed-tool', enquiryEnabled: true, purchaseEnabledInSource: false, purchaseEnabledThroughCabezonPreview: false, deliveryMode: 'mcp' },
      capability: `${MCP_EVIDENCE_CAPABILITY}:${MCP_EVIDENCE_TOOL_NAME}`,
      boundaries: ['A license changes machine access only; it never upgrades evidence quality, review assurance, empirical support, or release state.', 'The MCP endpoint remains private by discovery and requires a separately issued credential and active grant.'],
    },
    {
      productId: 'machine-evidence-dossier', namespace: 'maha-strategies', family: 'evidence-and-governance',
      title: 'Machine Evidence Dossier',
      description: 'A deterministic JSON-LD and PDF evidence package compiled from inspected passages, bounded claims, limitations, calculations, and runtime receipts when available.',
      state: 'withheld', discoveryUrl: `${SITE}/evidence-audit`,
      source: { authority: 'internal-product-contract', sourceId: 'maha-evidence-package/0.1', sourceSha256: sha256Canonical({ package: 'maha-evidence-package/0.1', offerReady: false }) },
      access: { mode: 'withheld', enquiryEnabled: false, purchaseEnabledInSource: false, purchaseEnabledThroughCabezonPreview: false, deliveryMode: 'none' },
      capability: null,
      boundaries: ['The current package is an internal rehearsal and is not marked ready for a fixed-fee commercial offer.', 'No dossier certifies truth, legal clearance, scientific validity, regulatory compliance, or independent reproduction.'],
    },
    {
      productId: 'computational-provenance-witness', namespace: 'maha-strategies', family: 'computational-provenance',
      title: 'Computational Provenance Witness',
      description: 'Tenant-scoped verification and retention of deterministic runtime receipts from Python, Docker, SLURM, and Qiskit workloads.',
      state: 'licensed', discoveryUrl: `${SITE}/api/docs/openapi`,
      source: { authority: 'internal-product-contract', sourceId: 'maha-computational-witness/1.0', sourceSha256: sha256Canonical({ endpoint: '/api/v1/witness/receipts', retention: 'explicit-consent' }) },
      access: { mode: 'licensed-tool', enquiryEnabled: true, purchaseEnabledInSource: false, purchaseEnabledThroughCabezonPreview: false, deliveryMode: 'api' },
      capability: 'witness:verify,witness:submit,witness:read,witness:purge',
      boundaries: ['A runtime receipt proves declared execution identity and committed bytes, not scientific correctness or independent reproduction.', 'Receipt persistence requires explicit retention consent and tenant authorization.'],
    },
    {
      productId: 'maha-knowledge', namespace: 'maha-strategies', family: 'knowledge-and-books',
      title: 'Maha Knowledge', description: 'Public, source-bound technical knowledge records and substantial references released through Maha governance.',
      state: 'informational', discoveryUrl: `${SITE}/knowledge`,
      source: { authority: 'internal-product-contract', sourceId: 'maha-epistemic/1.0', sourceSha256: sha256Canonical({ route: '/knowledge', releaseGate: 'canonical-only' }) },
      access: { mode: 'public-read', enquiryEnabled: false, purchaseEnabledInSource: false, purchaseEnabledThroughCabezonPreview: false, deliveryMode: 'web' },
      capability: null, boundaries: ['Public inclusion certifies the recorded provenance and release path, not truth, predictive validity, safety, or fitness.'],
    },
    {
      productId: 'maha-celestial-reports', namespace: 'maha-celestial', family: 'celestial',
      title: 'Maha Celestial', description: 'Reproducible celestial computation and tradition-aware reports kept separate from enterprise decision infrastructure.',
      state: 'informational', discoveryUrl: `${SITE}/knowledge/astrology`,
      source: { authority: 'internal-product-contract', sourceId: 'maha-celestial-brand-boundary/1.0', sourceSha256: sha256Canonical({ namespace: 'maha-celestial', route: '/knowledge/astrology' }) },
      access: { mode: 'public-read', enquiryEnabled: false, purchaseEnabledInSource: false, purchaseEnabledThroughCabezonPreview: false, deliveryMode: 'web' },
      capability: null, boundaries: ['Astrological interpretation is a cultural or reflective tradition, not scientifically validated prediction.', 'This namespace is not part of Maha enterprise evidence or technical decision methodology.'],
    },
  ]
}

function assertFederatedProducts(products: FederatedProduct[]): void {
  if (new Set(products.map((product) => product.productId)).size !== products.length) throw new Error('Federated product ids must be unique.')
  for (const product of products) {
    if (product.access.purchaseEnabledThroughCabezonPreview !== false) throw new Error('CABEZON Preview purchase must remain disabled.')
    if (product.state === 'payable' && !product.access.purchaseEnabledInSource) throw new Error(`Payable product ${product.productId} is not payable in its source.`)
    if (product.state === 'licensed' && (!product.capability || product.access.mode !== 'licensed-tool')) throw new Error(`Licensed product ${product.productId} lacks a capability contract.`)
    if (product.state === 'withheld' && (product.access.enquiryEnabled || product.access.purchaseEnabledInSource)) throw new Error(`Withheld product ${product.productId} exposes acquisition.`)
    if (product.namespace === 'maha-celestial' && product.family !== 'celestial') throw new Error('The Maha Celestial namespace cannot be merged into an enterprise family.')
  }
}

export function buildProductFederation(seller: ProductFederationIdentity): ProductFederationProjection {
  const products = [
    ...buildAgentProducts(), ...buildX402Products(),
    physicalProduct(SAMLEY_CINNAMON_TEA_RFQ_OFFER), physicalProduct(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER),
    ...internalProducts(),
  ].sort((left, right) => left.productId < right.productId ? -1 : left.productId > right.productId ? 1 : 0)
  assertFederatedProducts(products)
  const counts = Object.fromEntries((['informational', 'inquiry_available', 'licensed', 'payable', 'withheld'] as const).map((state) => [state, products.filter((product) => product.state === state).length])) as Record<FederatedProductState, number>
  const base = {
    schemaVersion: PRODUCT_FEDERATION_VERSION, mode: 'preview-read-only-federation' as const,
    effectiveAt: PRODUCT_FEDERATION_EFFECTIVE_AT, seller, products, counts,
    authority: { discoveryOnly: true as const, paymentEnabled: false as const, escrowEnabled: false as const, entitlementMutationEnabled: false as const, corpusInspectionEnabled: false as const, canonicalReleaseEnabled: false as const },
  }
  return { ...base, projectionSha256: sha256Canonical(base) }
}
