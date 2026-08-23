import type { ReactNode } from 'react'
import Link from 'next/link'

const SITE_URL = 'https://www.mahastrategies.com'

export function EvidenceGuide({
  path,
  eyebrow,
  title,
  summary,
  published = '2026-08-08',
  about,
  citations = [],
  backHref,
  backLabel,
  children,
}: {
  path: string
  eyebrow: string
  title: string
  summary: string
  published?: string
  about: string[]
  citations?: Array<{ name: string; url: string; datePublished: string; authors: string[] }>
  backHref: string
  backLabel: string
  children: ReactNode
}) {
  const url = `${SITE_URL}${path}`
  const article = {
    '@type': 'TechArticle',
    '@id': `${url}#article`,
    headline: title,
    description: summary,
    url,
    mainEntityOfPage: url,
    datePublished: published,
    dateModified: published,
    isAccessibleForFree: true,
    author: { '@id': `${SITE_URL}/about#mayone-maha-rajan` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    about,
    citation: citations.map((citation) => ({ '@id': `${citation.url}#scholarly-article` })),
  }
  const scholarlyArticles = citations.map((citation) => ({
    '@type': 'ScholarlyArticle',
    '@id': `${citation.url}#scholarly-article`,
    headline: citation.name,
    url: citation.url,
    datePublished: citation.datePublished,
    author: citation.authors.map((name) => ({ '@type': 'Person', name })),
    identifier: citation.url.includes('arxiv.org/abs/') ? {
      '@type': 'PropertyValue',
      propertyID: 'arXiv',
      value: citation.url.split('/').pop(),
    } : undefined,
  }))
  const jsonLd = { '@context': 'https://schema.org', '@graph': [article, ...scholarlyArticles] }

  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="evidence-container evidence-container--narrow">
        <article>
          <nav>
            <Link href={backHref} className="evidence-kicker evidence-link">← {backLabel}</Link>
          </nav>
          <header className="mt-8 border-t border-[var(--border-default)] pt-5">
            <p className="evidence-kicker">{eyebrow}</p>
            <h1 className="evidence-title evidence-title--product">{title}</h1>
            <p className="evidence-lede mt-7">{summary}</p>
            <p className="evidence-kicker mt-7 border-t border-[var(--border-subtle)] pt-5">Published August 8, 2026 · Maha Strategies LLC</p>
          </header>
          {children}
        </article>
      </div>
    </main>
  )
}

export function GuideMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="evidence-card">
      <p className="evidence-kicker">{label}</p>
      <p className="mt-3 font-[var(--font-newsreader)] text-3xl text-[var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p className="evidence-card-copy mt-2">{detail}</p>
    </article>
  )
}

export function CodeBlock({ children }: { children: string }) {
  return <pre className="evidence-code mt-6 overflow-x-auto p-5 text-sm leading-7"><code>{children}</code></pre>
}
