import { X402_OFFERS, type X402Offer } from './offers.ts'
import { isExpansionProduct, EXPANSION_SPECS } from './expansion-registry.ts'

export const PRODUCT_CATEGORIES = [
  { id: 'quantum', title: 'Quantum research utilities' },
  { id: 'biology', title: 'Biology research utilities' },
  { id: 'chemistry', title: 'Chemistry research utilities' },
  { id: 'materials', title: 'Materials science utilities' },
  { id: 'context', title: 'Context and evidence services' },
  { id: 'data-diagnostics', title: 'Data quality and live diagnostics' },
  { id: 'physical-ai', title: 'Physical AI and manufacturing planning' },
  { id: 'public-finance', title: 'Public finance checks' },
  { id: 'architecture', title: 'Architectural planning' },
  { id: 'research', title: 'Research and partnership planning' },
  { id: 'neural', title: 'Neural research metrics' },
  { id: 'books', title: 'Books and agent commerce' },
  { id: 'celestial', title: 'Celestial calculations and research' },
  { id: 'corpus', title: 'Attributed corpus lookups' },
  { id: 'numerical', title: 'Numerical and measurement utilities' },
  { id: 'contracts', title: 'Evidence and protocol checks' },
] as const
export type ProductCategoryId = typeof PRODUCT_CATEGORIES[number]['id']

export function categoryForOffer(offer: X402Offer): ProductCategoryId {
  if (offer.tags.includes('demand-20261012')) return offer.id.includes('research') || offer.id.includes('citation') ? 'research' : 'data-diagnostics'
  for (const category of ['quantum', 'biology', 'chemistry', 'materials'] as const) if (offer.tags.includes(category)) return category
  if (isExpansionProduct(offer.id)) return EXPANSION_SPECS[offer.id].category as ProductCategoryId
  if (['evidence-scope-check', 'evidence-version-selection-check', 'context-manifest-check'].includes(offer.id)) return 'context'
  if (offer.tags.includes('physical-ai')) return 'physical-ai'
  if (offer.tags.includes('campaign-finance') || offer.tags.includes('public-spending')) return 'public-finance'
  if (offer.id === 'area-program-check') return 'architecture'
  if (offer.id === 'neural-experiment-metrics') return 'neural'
  if (offer.id.startsWith('book-') || offer.id.startsWith('cabezon-')) return 'books'
  if (offer.id.startsWith('celestial-') || offer.id === 'astrology-experiment-plan-check') return 'celestial'
  if (['tiruvaymoli-context-packet', 'divine-name-disambiguation', 'edition-verse-resolution', 'reception-lineage-retrieval'].includes(offer.id)) return 'corpus'
  if (['dimensional-consistency-check', 'exact-interpolation-receipt', 'sampled-series-integration', 'unit-uncertainty-conversion', 'covariance-uncertainty', 'exact-linear-system', 'bracketed-polynomial-root'].includes(offer.id)) return 'numerical'
  if (!offer.tags.includes('microproduct')) return 'context'
  return 'contracts'
}

export function categorizedProducts() {
  return PRODUCT_CATEGORIES.map(category => ({ ...category, offers: X402_OFFERS.filter(o => categoryForOffer(o) === category.id)
    .sort((a, b) => Number(b.status === 'available') - Number(a.status === 'available') || Number(a.amount) - Number(b.amount) || a.id.localeCompare(b.id)) }))
}
