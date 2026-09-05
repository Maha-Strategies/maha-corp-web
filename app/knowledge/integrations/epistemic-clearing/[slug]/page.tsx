import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EpistemicClearingGuidePage } from '@/components/EpistemicClearingGuidePage'
import { MAHA_SITE_URL } from '@/lib/entity'
import { clearingGuidesForLane, getClearingGuide } from '@/lib/epistemic-clearing-batch-one'

type PageProps = { params: Promise<{ slug: string }> }
const base = '/knowledge/integrations/epistemic-clearing'
const pages = clearingGuidesForLane('cross-domain-synthesis')

export const dynamicParams = false
export function generateStaticParams() { return pages.map((page) => ({ slug: page.path.slice(base.length + 1) })) }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const page = getClearingGuide(`${base}/${slug}`)
  if (!page) return {}
  return { metadataBase: new URL(MAHA_SITE_URL), title: `${page.title} | Epistemic Integration`, description: page.summary, alternates: { canonical: page.path }, openGraph: { type: 'article', title: page.title, description: page.summary, url: `${MAHA_SITE_URL}${page.path}` } }
}
export default async function CrossDomainClearingPage({ params }: PageProps) {
  const { slug } = await params
  const page = getClearingGuide(`${base}/${slug}`)
  if (!page) notFound()
  return <EpistemicClearingGuidePage guide={page} />
}
