import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import CorporateMundaneReferencePage from '@/app/knowledge/astrology/corporate-mundane/CorporateMundaneReferencePage'
import { SITE_URL } from '@/lib/briefs-data'
import { CORPORATE_MUNDANE_REFERENCES, corporateMundaneReferencePath, getCorporateMundaneReference } from '@/lib/corporate-mundane-references'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() { return CORPORATE_MUNDANE_REFERENCES.map((entry) => ({ slug: entry.slug })) }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const reference = getCorporateMundaneReference(slug)
  if (!reference) return {}
  const path = corporateMundaneReferencePath(reference)
  return {
    metadataBase: new URL(SITE_URL), title: `${reference.title} | Maha Celestial`, description: reference.description,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: reference.title, description: reference.description, url: `${SITE_URL}${path}`, siteName: 'Maha Celestial' },
  }
}

export default async function CorporateMundaneReferenceRoute({ params }: PageProps) {
  const { slug } = await params
  const reference = getCorporateMundaneReference(slug)
  if (!reference) notFound()
  return <CorporateMundaneReferencePage reference={reference} />
}
