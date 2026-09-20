import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EvidenceArticle } from '@/components/EvidenceArticle'
import { MAHA_SITE_URL } from '@/lib/entity'
import { NANO_ARTICLES, NANO_PATH, NANO_SOURCES } from '@/lib/nanotechnology-knowledge'

export const dynamicParams = false

export function generateStaticParams() {
  return NANO_ARTICLES.map((article) => ({ slug: article.slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = NANO_ARTICLES.find((entry) => entry.slug === slug)
  if (!article) notFound()
  const canonical = `${NANO_PATH}/${slug}`
  return {
    title: `${article.title} | Maha Strategies`,
    description: article.answer.slice(0, 300),
    alternates: { canonical },
    openGraph: { title: article.title, description: article.answer.slice(0, 300), url: `${MAHA_SITE_URL}${canonical}`, type: 'article', siteName: 'Maha Strategies' },
  }
}

export default async function NanotechnologyArticlePage({ params }: Props) {
  const { slug } = await params
  const article = NANO_ARTICLES.find((entry) => entry.slug === slug)
  if (!article) notFound()
  return (
    <EvidenceArticle
      article={article}
      sources={NANO_SOURCES}
      sectionPath={NANO_PATH}
      sectionLabel="Nanotechnology"
      titleOf={(related) => NANO_ARTICLES.find((entry) => entry.slug === related)?.title ?? related}
      sectionBoundary="Maha Strategies publishes explanation and evaluation method. We make no nanomaterials, run no characterisation, certify nothing, and give no medical or legal advice."
    />
  )
}
