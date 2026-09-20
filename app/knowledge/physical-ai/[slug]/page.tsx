import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EvidenceArticle } from '@/components/EvidenceArticle'
import { MAHA_SITE_URL } from '@/lib/entity'
import { PHYSICAL_AI_ARTICLES, PHYSICAL_AI_PATH, PHYSICAL_AI_SOURCES } from '@/lib/physical-ai-knowledge'

export const dynamicParams = false

export function generateStaticParams() {
  return PHYSICAL_AI_ARTICLES.map((article) => ({ slug: article.slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = PHYSICAL_AI_ARTICLES.find((entry) => entry.slug === slug)
  if (!article) notFound()
  const canonical = `${PHYSICAL_AI_PATH}/${slug}`
  return {
    title: `${article.title} | Maha Strategies`,
    description: article.answer.slice(0, 300),
    alternates: { canonical },
    openGraph: { title: article.title, description: article.answer.slice(0, 300), url: `${MAHA_SITE_URL}${canonical}`, type: 'article', siteName: 'Maha Strategies' },
  }
}

export default async function PhysicalAiArticlePage({ params }: Props) {
  const { slug } = await params
  const article = PHYSICAL_AI_ARTICLES.find((entry) => entry.slug === slug)
  if (!article) notFound()
  return (
    <EvidenceArticle
      article={article}
      sources={PHYSICAL_AI_SOURCES}
      sectionPath={PHYSICAL_AI_PATH}
      sectionLabel="Physical AI"
      titleOf={(related) => PHYSICAL_AI_ARTICLES.find((entry) => entry.slug === related)?.title ?? related}
      sectionBoundary="Maha Strategies publishes explanation and evaluation method. We build no robots, run no physical experiments, and report no benchmark results of our own. Hardware, safety and evidence-intake questions live in the robotics section."
    />
  )
}
