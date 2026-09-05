import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EpistemicClearingGuidePage } from '@/components/EpistemicClearingGuidePage'
import { MAHA_SITE_URL } from '@/lib/entity'
import { clearingGuidesForLane, getClearingGuide } from '@/lib/epistemic-clearing-batch-one'

type PageProps = { params: Promise<{ slug: string }> }
const base = '/developers/epistemic-clearing'
const pages = clearingGuidesForLane('machine-integrations')

export const dynamicParams = false
export function generateStaticParams() { return pages.map((page) => ({ slug: page.path.slice(base.length + 1) })) }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = getClearingGuide(`${base}/${(await params).slug}`)
  if (!page) return {}
  return { metadataBase: new URL(MAHA_SITE_URL), title: `${page.title} | Maha Epistemic Clearing`, description: page.summary, alternates: { canonical: page.path }, openGraph: { type: 'article', title: page.title, description: page.summary, url: `${MAHA_SITE_URL}${page.path}` } }
}
export default async function MachineClearingPage({ params }: PageProps) {
  const page = getClearingGuide(`${base}/${(await params).slug}`)
  if (!page) notFound()
  return <EpistemicClearingGuidePage guide={page} />
}
