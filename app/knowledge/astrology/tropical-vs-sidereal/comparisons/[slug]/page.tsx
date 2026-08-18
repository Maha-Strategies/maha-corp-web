import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import TropicalSiderealComparisonPage from '@/app/knowledge/astrology/tropical-vs-sidereal/comparisons/TropicalSiderealComparisonPage'
import { SITE_URL } from '@/lib/briefs-data'
import { TROPICAL_SIDEREAL_COMPARISONS, getTropicalSiderealComparison, tropicalSiderealComparisonPath } from '@/lib/tropical-sidereal-comparisons'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() { return TROPICAL_SIDEREAL_COMPARISONS.map((entry) => ({ slug: entry.slug })) }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const comparison = getTropicalSiderealComparison(slug)
  if (!comparison) return {}
  const path = tropicalSiderealComparisonPath(comparison)
  return {
    metadataBase: new URL(SITE_URL), title: `${comparison.title} | Maha Celestial`, description: comparison.description,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: comparison.title, description: comparison.description, url: `${SITE_URL}${path}`, siteName: 'Maha Celestial' },
  }
}

export default async function TropicalSiderealComparisonRoute({ params }: PageProps) {
  const { slug } = await params
  const comparison = getTropicalSiderealComparison(slug)
  if (!comparison) notFound()
  return <TropicalSiderealComparisonPage comparison={comparison} />
}
