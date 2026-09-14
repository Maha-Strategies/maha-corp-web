import { MAHA_CARP_DIGITAL_OFFERS, MAHA_CARP_SELLER_URL } from './seller.ts'
import { offerById } from '../x402/offers.ts'

/** Array-shaped service menu matching the public Octopus menu convention.
 * Free discovery never delegates signing, purchasing or encrypted CARP access.
 */
export const mahaServiceMenu = Object.freeze([
  {
    service: 'about', descrip: 'Read Maha seller identity, catalogue and fulfillment boundaries. Free; no purchase.',
    'http-request': 'GET /.well-known/carp/seller.json',
    authentication: false, synchronous: true, fee: null,
    'http-response': { status: '200 OK', contenttype: 'application/json', content: { url: MAHA_CARP_SELLER_URL, offersField: 'offers' } },
  },
  {
    service: 'catalog', descrip: 'List current digital products and separate enquiry-only physical offers. Free; no purchase.',
    'http-request': 'GET /api/discovery/carp/catalog',
    authentication: false, synchronous: true, fee: null,
    'http-response': { status: '200 OK', contenttype: 'application/json', content: 'Array of seller offerings; prices and purchase boundaries are per offering.' },
  },
  ...MAHA_CARP_DIGITAL_OFFERS.map(product => {
    const offer = offerById(product.offerId)!
    return {
      service: offer.id, descrip: product.descrip,
      'http-request': { method: offer.method, url: offer.path, body: offer.discovery.input },
      authentication: false, synchronous: !offer.requiresIdempotency,
      paymentRequired: true, paymentProtocol: 'x402-v2', price: product.price,
      directSettlement: product.directSettlement,
      offeringRef: product.offeringRef, title: product.title,
      declarationUrl: product.inputSchema,
      inputSchema: offer.discovery.inputSchema,
      'http-response': { status: '402 Payment Required', contenttype: 'application/json', content: 'An unpaid valid request returns the authoritative x402 quote. Only sign after separate budget approval. Job acceptance is not completed delivery.' },
      capabilityBoundaries: product.capabilityBoundaries,
    }
  }),
])
