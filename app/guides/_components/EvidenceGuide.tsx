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

  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <article className="mx-auto max-w-4xl">
      <nav><Link href={backHref} className="font-mono text-[10px] uppercase tracking-widest text-cyan-200 hover:text-white">← {backLabel}</Link></nav>
      <header className="mt-8 border-b border-zinc-800 pb-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">[ {eyebrow} ]</p>
        <h1 className="mt-5 text-4xl font-light leading-tight text-white sm:text-6xl">{title}</h1>
        <p className="mt-7 max-w-3xl text-xl leading-relaxed text-zinc-400">{summary}</p>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Published August 8, 2026 · Maha Strategies LLC</p>
      </header>
      {children}
    </article>
  </main>
}

export function GuideMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="border border-zinc-800 bg-zinc-950/60 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-3 text-3xl text-white">{value}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p></article>
}

export function CodeBlock({ children }: { children: string }) {
  return <pre className="mt-6 overflow-x-auto border border-zinc-800 bg-black p-5 text-sm leading-7 text-cyan-100"><code>{children}</code></pre>
}
