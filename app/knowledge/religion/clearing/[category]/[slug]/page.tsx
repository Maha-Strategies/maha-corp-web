import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EpistemicClearingGuidePage } from '@/components/EpistemicClearingGuidePage'
import { MAHA_SITE_URL } from '@/lib/entity'
import { clearingGuidesForLane, getClearingGuide } from '@/lib/epistemic-clearing-batch-one'

type PageProps = { params: Promise<{ category: string; slug: string }> }
const base = '/knowledge/religion/clearing'
const pages = clearingGuidesForLane('tamil-religion')

export const dynamicParams = false
export function generateStaticParams() { return pages.map((page) => { const [category, slug] = page.path.slice(base.length + 1).split('/'); return { category, slug } }) }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, slug } = await params
  const page = getClearingGuide(`${base}/${category}/${slug}`)
  if (!page) return {}
  return { metadataBase: new URL(MAHA_SITE_URL), title: `${page.title} | Tamil Religion`, description: page.summary, alternates: { canonical: page.path }, openGraph: { type: 'article', title: page.title, description: page.summary, url: `${MAHA_SITE_URL}${page.path}` } }
}
export default async function TamilClearingPage({ params }: PageProps) {
  const { category, slug } = await params
  const page = getClearingGuide(`${base}/${category}/${slug}`)
  if (!page) notFound()
  return <EpistemicClearingGuidePage guide={page} />
}
