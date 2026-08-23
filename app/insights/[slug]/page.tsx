import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'
import { getPublicContentPublication } from '@/lib/public-content-publications'

export const dynamic = 'force-dynamic'

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Publication date unavailable' : new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long', timeZone: 'UTC',
  }).format(date)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const publication = await getPublicContentPublication(slug)
  if (!publication) return {}

  const url = `${MAHA_SITE_URL}/insights/${publication.slug}`
  return {
    title: publication.title,
    description: publication.summary,
    alternates: { canonical: `/insights/${publication.slug}` },
    openGraph: {
      type: 'article',
      url,
      title: publication.title,
      description: publication.summary,
      publishedTime: publication.published_at,
      modifiedTime: publication.updated_at,
    },
    twitter: { card: 'summary_large_image', title: publication.title, description: publication.summary },
  }
}

export default async function PublishedInsightPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const publication = await getPublicContentPublication(slug)
  if (!publication) notFound()

  const url = `${MAHA_SITE_URL}/insights/${publication.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: publication.title,
    description: publication.summary,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: publication.published_at,
    dateModified: publication.updated_at,
    author: { '@id': MAYONE_MAHA_RAJAN_ID },
    publisher: { '@id': MAHA_ORGANIZATION_ID },
    citation: publication.evidence.map((source) => source.url),
    isAccessibleForFree: true,
  }

  return (
    <main className="evidence-page px-6 py-20 text-[var(--text-secondary)] sm:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-4xl">
        <nav className="border-b border-[var(--border-default)] pb-5">
          <Link href="/insights" className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] transition-colors hover:text-[var(--status-sourced)]">← All insights</Link>
        </nav>

        <header className="border-b border-[var(--border-default)] py-12 sm:py-16">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Evidence-led insight · human-approved release ]</p>
          <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-6xl">{publication.title}</h1>
          <p className="mt-7 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">{publication.summary}</p>
          <dl className="mt-8 grid gap-5 border-t border-[var(--border-default)] pt-6 text-sm sm:grid-cols-3">
            <div><dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Published</dt><dd className="mt-2 text-[var(--text-secondary)]"><time dateTime={publication.published_at}>{displayDate(publication.published_at)}</time></dd></div>
            <div><dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Updated</dt><dd className="mt-2 text-[var(--text-secondary)]"><time dateTime={publication.updated_at}>{displayDate(publication.updated_at)}</time></dd></div>
            <div><dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Editorial review</dt><dd className="mt-2 text-[var(--text-secondary)]">{publication.editorial_reviewer}</dd></div>
          </dl>
        </header>

        <section className="mt-12 border border-[var(--status-sourced)] bg-[var(--surface-subtle)] p-7 sm:p-9" aria-labelledby="answer-heading">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Reader&apos;s answer ]</p>
          <h2 id="answer-heading" className="mt-4 text-2xl text-[var(--text-primary)]">Direct answer</h2>
          <p className="mt-5 whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)]">{publication.direct_answer}</p>
        </section>

        <section className="mt-14" aria-labelledby="method-heading">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ Method ]</p>
          <h2 id="method-heading" className="mt-4 text-2xl text-[var(--text-primary)]">How this insight was assembled</h2>
          <p className="mt-5 whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)]">{publication.method}</p>
          <p className="mt-5 text-sm leading-relaxed text-[var(--text-muted)]">Maha&apos;s editorial workflow separates candidate material, drafting, evidence review, and human release. A published insight is an accountable synthesis, not a substitute for primary sources or professional advice.</p>
        </section>

        <section className="mt-14 border border-[var(--border-default)] bg-[var(--surface-raised)] p-7 sm:p-9" aria-labelledby="evidence-heading">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Evidence record ]</p>
          <h2 id="evidence-heading" className="mt-4 text-2xl text-[var(--text-primary)]">Sources used for this release</h2>
          <ol className="mt-6 space-y-5">
            {publication.evidence.map((source, index) => (
              <li key={source.url} className="border-l border-[var(--border-default)] pl-4">
                <p className="font-mono text-[10px] text-[var(--text-muted)]">{String(index + 1).padStart(2, '0')}</p>
                <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[var(--status-sourced)] underline decoration-cyan-800 underline-offset-4 hover:text-[var(--text-primary)]">{source.title}</a>
                {source.note && <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{source.note}</p>}
              </li>
            ))}
          </ol>
          <a href={publication.artifact_url} target="_blank" rel="noreferrer" className="mt-8 inline-block font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)] underline underline-offset-4 hover:text-[var(--text-primary)]">Open supporting artifact: {publication.artifact_label} ↗</a>
        </section>

        <section className="mt-14 border border-[var(--status-boundary)] bg-[var(--surface-subtle)] p-7 sm:p-9" aria-labelledby="limits-heading">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-boundary)]">[ Limits and decision boundary ]</p>
          <h2 id="limits-heading" className="mt-4 text-2xl text-[var(--text-primary)]">What this does not establish</h2>
          <p className="mt-5 whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)]">{publication.limitations}</p>
        </section>

        <footer className="mt-16 border-t border-[var(--border-default)] pt-8 text-sm leading-relaxed text-[var(--text-muted)]">
          Need a source-tagged analysis for a decision? <Link href="/consulting" className="text-[var(--status-sourced)] underline underline-offset-4">Explore consulting</Link>. Learn more about the publisher on <Link href="/about" className="text-[var(--status-sourced)] underline underline-offset-4">Maha Strategies</Link>.
        </footer>
      </article>
    </main>
  )
}
