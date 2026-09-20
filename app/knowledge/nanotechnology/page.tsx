import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL } from '@/lib/entity'
import { NANO_ARTICLES, NANO_CANDIDATES, NANO_PATH, NANO_RELEASE_DATE, NANO_SOURCES } from '@/lib/nanotechnology-knowledge'

const title = 'Nanotechnology: evidence and evaluation | Maha Strategies'
const description =
  'How nanoscale materials are made, measured and claimed — and how to judge the evidence. Seventeen sourced explanations and a runnable surface-area calculation, from a publisher that makes no materials and certifies nothing.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: NANO_PATH },
  openGraph: { title, description, url: `${MAHA_SITE_URL}${NANO_PATH}`, type: 'website', siteName: 'Maha Strategies' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${MAHA_SITE_URL}${NANO_PATH}#collection`,
  url: `${MAHA_SITE_URL}${NANO_PATH}`,
  name: 'Nanotechnology: evidence and evaluation',
  description,
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  dateModified: NANO_RELEASE_DATE,
  hasPart: NANO_ARTICLES.map((article) => ({
    '@type': 'Article',
    '@id': `${MAHA_SITE_URL}${NANO_PATH}/${article.slug}`,
    headline: article.title,
    description: article.answer,
  })),
}

export default function NanotechnologyHub() {
  const implemented = NANO_CANDIDATES.filter((candidate) => candidate.status === 'implemented').length
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link className="evidence-link" href="/knowledge">Knowledge</Link>
          <span aria-hidden="true"> / </span>Nanotechnology
        </nav>

        <header className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Evidence and evaluation · not a laboratory ]</p>
          <h1 className="mt-4 text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl">Nanotechnology</h1>
          <p className="mt-6 text-xl leading-relaxed text-[var(--text-secondary)]">
            Small things behave differently, and that fact is used to sell a great deal. These pages explain the mechanisms that are
            real, show what a measurement of a nanomaterial actually measures, and give you the questions that separate a result from
            a claim about it.
          </p>
          <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">
            Maha Strategies makes no materials, runs no synthesis or characterisation, and certifies nothing. What we publish is
            explanation, method and the sources we read, each with the passage we read it at.
          </p>
        </header>

        <section className="mt-12" aria-labelledby="start">
          <h2 id="start" className="evidence-section-title text-xl">Start here</h2>
          <ul className="mt-4 list-none space-y-3 p-0">
            {['what-nanoscale-means', 'surface-area-to-volume', 'vendor-claim-checks'].map((slug) => {
              const article = NANO_ARTICLES.find((entry) => entry.slug === slug)!
              return (
                <li key={slug}>
                  <Link className="evidence-link" href={`${NANO_PATH}/${slug}`}>{article.title}</Link>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{article.answer}</p>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="all-articles">
          <h2 id="all-articles" className="evidence-section-title text-xl">All {implemented} explanations</h2>
          <ul className="mt-4 list-none space-y-5 p-0">
            {NANO_ARTICLES.map((article) => (
              <li key={article.slug} className="border-l border-[var(--border-strong)] pl-4">
                <Link className="evidence-link" href={`${NANO_PATH}/${article.slug}`}>{article.title}</Link>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{article.answer}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="run-it">
          <h2 id="run-it" className="evidence-section-title text-xl">Run the arithmetic yourself</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            The section ships a unit-aware surface-area-to-volume calculator for idealised particles, with its assumptions and
            dimensional checks printed beside every result. It refuses zero dimensions, unsupported units and zero density rather than
            returning a number that looks plausible.
          </p>
          <pre className="mt-5 overflow-x-auto border border-[var(--border-default)] p-4 text-sm">
{`node --experimental-strip-types scripts/nanoscale-surface-area.ts \\
  --shape sphere --size 10 --unit nm --density 4 --density-unit g/cm3`}
          </pre>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
            Geometry predicts area, not reactivity, toxicity or performance — see{' '}
            <Link className="evidence-link" href={`${NANO_PATH}/surface-area-example`}>what the calculator cannot tell you</Link>.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="elsewhere">
          <h2 id="elsewhere" className="evidence-section-title text-xl">Related sections</h2>
          <ul className="mt-4 list-none space-y-2 p-0">
            <li><Link className="evidence-link" href="/knowledge/suppliers">Semiconductor process and supplier map</Link> — top-down patterning, which this section does not restate.</li>
            <li><Link className="evidence-link" href="/knowledge/neuromorphic-biocomputing">Neuromorphic and biocomputing</Link> — memristive and in-memory devices built from these materials.</li>
            <li><Link className="evidence-link" href="/knowledge/physical-ai">Physical AI</Link> — the evaluation discipline applied to learned systems that act.</li>
            <li><Link className="evidence-link" href="/knowledge/robotics">Robotics evidence and evaluation</Link> — measurement and evidence records for machines.</li>
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="sources">
          <h2 id="sources" className="evidence-section-title text-xl">Sources read for this section</h2>
          <ul className="mt-4 list-none space-y-4 p-0">
            {Object.values(NANO_SOURCES).map((source) => (
              <li key={source.url}>
                <a className="evidence-link" href={source.url} target="_blank" rel="noreferrer noopener">{source.title} ↗</a>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">Read at: {source.locator} · inspected {source.inspected}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-[var(--text-muted)]">
            Nothing here is a safety assessment, an exposure limit, a product approval or medical advice. Regulatory questions belong
            to the relevant agency; workplace exposure belongs to qualified occupational-health practice.
          </p>
        </section>
      </article>
    </main>
  )
}
