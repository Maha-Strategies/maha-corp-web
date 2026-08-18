import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import TimingReferencePage from '@/app/knowledge/astrology/timing/TimingReferencePage'
import { SITE_URL } from '@/lib/briefs-data'
import { TIMING_REFERENCES, getTimingReference, timingReferencePath } from '@/lib/celestial-timing-references'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() { return TIMING_REFERENCES.map((entry) => ({ slug: entry.slug })) }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const reference = getTimingReference(slug)
  if (!reference) return {}
  const path = timingReferencePath(reference)
  return {
    metadataBase: new URL(SITE_URL), title: `${reference.title} | Maha Celestial`, description: reference.description,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: reference.title, description: reference.description, url: `${SITE_URL}${path}`, siteName: 'Maha Celestial' },
  }
}

export default async function TimingReferenceRoute({ params }: PageProps) {
  const { slug } = await params
  const reference = getTimingReference(slug)
  if (!reference) notFound()
  return <TimingReferencePage reference={reference} />
}
