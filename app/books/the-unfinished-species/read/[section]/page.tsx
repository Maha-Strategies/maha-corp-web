import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import BookManuscript from '@/components/BookManuscript'
import { getUnfinishedSpeciesSection, unfinishedSpeciesSections } from '@/lib/unfinished-species'

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
    author: { '@type': 'Person', name: 'Mayone Maha Rajan' }, publisher: { '@type': 'Organization', name: 'Maha Strategies LLC', url: SITE_URL },
    isAccessibleForFree: true, inLanguage: 'en', datePublished: '2026-07-22',
  }
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-indigo-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
        <Link href="/books/the-unfinished-species/read" className="inline-block font-mono text-xs text-indigo-300 hover:text-white tracking-widest uppercase transition-colors mb-12">← Complete edition</Link>
        <header className="border-b border-zinc-800 pb-10 mb-12">
          <p className="font-mono text-xs text-indigo-300 tracking-widest uppercase mb-5">[ Open edition · {found.section.articleSection} ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-[1.1] tracking-tight mb-5">{found.section.title}</h1>
          <p className="text-xl text-zinc-300 font-light leading-relaxed">{found.section.description}</p>
        </header>
        <BookManuscript markdown={found.markdown} />
        <footer className="mt-16 border-t border-zinc-800 pt-8"><Link href="/books/the-unfinished-species" className="text-sm text-zinc-300 hover:text-white">Return to the book’s table of contents ↗</Link></footer>
      </article>
    </main>
  )
}
