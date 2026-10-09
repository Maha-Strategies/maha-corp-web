import { EVIDENCE_COMMERCIAL_OFFERS } from './evidence-commercial-offers.ts'
import { searchClickCopy } from './search-click-pilot.ts'

export function pilotNextSteps(path: string) {
  if (!searchClickCopy(path)) return null
  const documentPage = path.startsWith('/guides/') || path.startsWith('/knowledge/religion/')
  const free = EVIDENCE_COMMERCIAL_OFFERS.evidencePreflight
  const paid = documentPage ? EVIDENCE_COMMERCIAL_OFFERS.mpsDocumentPreflight : EVIDENCE_COMMERCIAL_OFFERS.verifiedEvidenceDossier
  return {
    heading: documentPage ? 'Check a claim or document of your own' : 'Take the next step with your evidence',
    offers: [free, paid].map((offer) => ({
      id: offer.offerId,
      name: offer.name,
      price: offer.priceUsd === 0 ? 'Free' : `$${offer.priceUsd} USD`,
      href: offer.path,
      scope: offer.scope,
      boundary: offer.evidenceBoundary,
      action: offer.state === 'qualification-first-purchase-disabled' ? 'Review scope — purchase unavailable' : 'Review scope and start',
      event: offer.offerId === free.offerId ? 'cta_pilot_free_preflight' : documentPage ? 'cta_pilot_document_preflight' : 'cta_pilot_dossier_scope',
    })),
    resource: path.startsWith('/knowledge/astrology/')
      ? { href: '/knowledge/astrology/calculations', label: 'Compare calculation references', event: 'cta_pilot_calculation_reference' }
      : path.includes('retrieval-augmented') || path.includes('mechanistic-interpretability')
        ? { href: '/developers', label: 'Explore developer tools and their boundaries', event: 'cta_pilot_developer_tools' }
        : { href: '/knowledge', label: 'Explore related knowledge domains', event: 'cta_pilot_knowledge' },
  }
}
