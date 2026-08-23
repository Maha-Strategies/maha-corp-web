import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import BookManuscript from '@/components/BookManuscript'
import { OpenBookSectionNavigation } from '@/components/OpenBookReader'
import { getUnfinishedSpeciesSection, unfinishedSpeciesSections } from '@/lib/unfinished-species'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'

type PageProps = { params: Promise<{ section: string }> }

export function generateStaticParams() {
  return unfinishedSpeciesSections.map((section) => ({ section: section.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { section: slug } = await params
  const found = getUnfinishedSpeciesSection(slug)
  if (!found) return {}
  const url = `${SITE_URL}/books/the-unfinished-species/read/${found.section.slug}`
  return {
    title: `${found.section.title} | The Unfinished Species`,
    description: found.section.description,
    alternates: { canonical: `/books/the-unfinished-species/read/${found.section.slug}` },
    openGraph: { type: 'article', url, title: found.section.title, description: found.section.description, images: [{ url: '/og-master.png', width: 1200, height: 630, alt: found.section.title }] },
  }
}

export default async function UnfinishedSpeciesSectionPage({ params }: PageProps) {
  const { section: slug } = await params
  const found = getUnfinishedSpeciesSection(slug)
  if (!found) notFound()
  const url = `${SITE_URL}/books/the-unfinished-species/read/${found.section.slug}`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Chapter', name: found.section.title, description: found.section.description,
    url, isPartOf: { '@id': `${SITE_URL}/books/the-unfinished-species#book` },
    author: { '@type': 'Person', name: 'Mayone Maha Rajan' }, publisher: { '@id': MAHA_ORGANIZATION_ID },
    isAccessibleForFree: true, inLanguage: 'en', datePublished: '2026-07-22',
  }
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <Link href="/books/the-unfinished-species/read" className="inline-block font-mono text-xs text-[var(--status-sourced)] hover:text-[var(--text-primary)] tracking-widest uppercase transition-colors mb-12">← All chapters</Link>
        <header className="border-b border-[var(--border-default)] pb-10 mb-12">
          <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Open edition · {found.section.articleSection} ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-[var(--text-primary)] leading-[1.1] tracking-tight mb-5">{found.section.title}</h1>
          <p className="text-xl text-[var(--text-secondary)] font-light leading-relaxed">{found.section.description}</p>
        </header>
        <BookManuscript markdown={found.markdown} />
        <OpenBookSectionNavigation book={{ slug: 'the-unfinished-species', title: 'The Unfinished Species', subtitle: 'How Intelligence Learned to Redesign Its Own Substrate', sections: unfinishedSpeciesSections }} section={found.section} />
        <footer className="mt-16 border-t border-[var(--border-default)] pt-8"><Link href="/books/the-unfinished-species" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Return to the book’s table of contents ↗</Link></footer>
      </article>
    </main>
  )
}
