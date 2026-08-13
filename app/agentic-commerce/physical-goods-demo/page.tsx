import type { Metadata } from 'next'

import PhysicalGoodsDemo from './PhysicalGoodsDemo'

export const metadata: Metadata = {
  title: 'Physical-Goods Agent Commerce Demo | Maha Strategies',
  description: 'Run a zero-funds CARP/CABEZON Seller demonstration from agent enquiry through quote approvals, simulated escrow, shipment evidence, delivery, and release.',
  alternates: { canonical: '/agentic-commerce/physical-goods-demo' },
  openGraph: {
    title: 'Maha Physical-Goods Agent Commerce Demonstration',
    description: 'A transparent, non-commercial simulation of governed agent-to-agent physical fulfillment. No inventory, payment, export, or shipment occurs.',
    url: '/agentic-commerce/physical-goods-demo',
    type: 'website',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Maha Physical-Goods Agent Commerce Demonstration',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/OnlineOnly' },
  description: 'A free technical simulation of a governed CARP/CABEZON Seller workflow. It is not a product listing or commercial tea offer.',
  url: 'https://www.mahastrategies.com/agentic-commerce/physical-goods-demo',
  isAccessibleForFree: true,
}

export default function PhysicalGoodsDemoPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <PhysicalGoodsDemo />
    </>
  )
}
