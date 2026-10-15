import { id, digest, hash } from './batch5-core.ts'
import { publicRecordSuite } from './batch18-core.ts'

const boundary = 'Caller-supplied public or synthetic nonpersonal merchant/SKU manifest declarations only. No buyer identity, inventory lookup, checkout, purchase, shipping, marketplace indexing, rights clearance or sales forecast. Presence and matching pins do not establish availability, authenticity, fulfillment or permission.'
export const MARKET_CATALOGUE_AUDITS = publicRecordSuite({ category: 'market-catalogues', noun: 'merchant/catalogue/SKU/revision-pinned public product declarations', boundary,
  pins: { merchantRef: id, catalogueRef: id, skuRef: id, catalogueRevision: digest, productDigest: digest, scopeRef: id },
  sample: { id: 'product1', merchantRef: 'merchant1', catalogueRef: 'catalogue1', skuRef: 'synthetic-sku1', catalogueRevision: hash, productDigest: hash, scopeRef: 'public-metadata' },
  owner: 'merchantRef', subject: 'skuRef', revision: 'catalogueRevision', content: 'productDigest', units: ['minor-units', 'major-units'], unitMeaning: 'caller-declared price denomination' })
export const BATCH18_MARKET = MARKET_CATALOGUE_AUDITS.slice(0, 2)
