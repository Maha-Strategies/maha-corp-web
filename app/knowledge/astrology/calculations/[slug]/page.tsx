import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import CalculationReferencePage from '@/app/knowledge/astrology/calculations/CalculationReferencePage'
import { SITE_URL } from '@/lib/briefs-data'
import {
  CALCULATION_REFERENCES,
  calculationReferencePath,
  getCalculationReference,
} from '@/lib/celestial-calculation-references'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return CALCULATION_REFERENCES.map((entry) => ({ slug: entry.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const reference = getCalculationReference(slug)
  if (!reference) return {}
  const path = calculationReferencePath(reference)
  return {
    metadataBase: new URL(SITE_URL),
    title: `${reference.title} | Maha Celestial`,
    description: reference.description,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: reference.title, description: reference.description, url: `${SITE_URL}${path}`, siteName: 'Maha Celestial' },
  }
}

export default async function CalculationReferenceRoute({ params }: PageProps) {
  const { slug } = await params
  const reference = getCalculationReference(slug)
  if (!reference) notFound()
  return <CalculationReferencePage reference={reference} />
}
