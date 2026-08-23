import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_SITE_URL } from '@/lib/entity'
import { getPublicContentPublications } from '@/lib/public-content-publications'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Insights | Maha Strategies',
  description: 'Human-approved, evidence-led articles released through the Maha Strategies editorial workflow.',
  alternates: { canonical: '/insights' },
  openGraph: {
    type: 'website',
    url: `${MAHA_SITE_URL}/insights`,
    title: 'Insights | Maha Strategies',
    description: 'Human-approved, evidence-led articles released through the Maha Strategies editorial workflow.',
  },
}

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Publication date unavailable' : new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long', timeZone: 'UTC',
  }).format(date)
}

export default async function InsightsIndexPage() {
  const publications = await getPublicContentPublications()
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${MAHA_SITE_URL}/insights#collection`,
    name: 'Maha Strategies Insights',
    description: 'Human-approved, evidence-led articles released through the Maha Strategies editorial workflow.',
    isPartOf: { '@id': `${MAHA_SITE_URL}/#website` },
    publisher: { '@id': `${MAHA_SITE_URL}/#organization` },
    hasPart: publications.map((publication) => ({
      '@type': 'Article',
      headline: publication.title,
      url: `${MAHA_SITE_URL}/insights/${publication.slug}`,
      datePublished: publication.published_at,
      dateModified: publication.updated_at,
    })),
  }

  return (
    <main className="evidence-page">
      <div className="evidence-container">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd).replace(/</g, '\\u003c') }} />
        <div className="mx-auto max-w-5xl">
          <header className="max-w-3xl evidence-section">
            <p className="evidence-kicker">[ Insights // public editorial releases ]</p>
            <h1 className="evidence-title mt-5">Evidence-led articles, released by a human.</h1>
            <p className="evidence-lede mt-7">Each article here was created through Maha&rsquo;s evidence-to-editorial workflow, reviewed before release, and published only through an explicit human confirmation. Sources and limits remain on the article itself.</p>
            <div className="evidence-inset mt-9 grid gap-4 border-t border-[var(--border-default)] pt-7 sm:grid-cols-3">
              <div><p className="evidence-kicker">01 · Answer</p><p className="evidence-copy mt-2">Start with the decision-relevant conclusion, in plain language.</p></div>
              <div><p className="evidence-kicker">02 · Evidence</p><p className="evidence-copy mt-2">Open the linked sources and supporting artifact; do not take a synthesis on faith.</p></div>
              <div><p className="evidence-kicker">03 · Limits</p><p className="evidence-copy mt-2">Read what the analysis cannot establish before carrying it into a decision.</p></div>
            </div>
          </header>

          {publications.length > 0 ? (
            <section className="evidence-section mt-12" aria-label="Published insights">
              <p className="evidence-kicker">{publications.length} published {publications.length === 1 ? 'insight' : 'insights'}</p>
              <div className="mt-5 grid gap-4">
                {publications.map((publication) => (
                  <article key={publication.slug} className="evidence-card">
                    <p className="evidence-kicker">Evidence-led insight · {displayDate(publication.published_at)}</p>
                    <h2 className="evidence-card-title mt-4">
                      <Link href={`/insights/${publication.slug}`} className="hover:text-[var(--text-primary)]">{publication.title}</Link>
                    </h2>
                    <p className="evidence-copy mt-4 max-w-3xl">{publication.summary}</p>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] pt-5">
                      <p className="evidence-kicker">Editorial review: {publication.editorial_reviewer}</p>
                      <Link href={`/insights/${publication.slug}`} className="evidence-link">Read insight ↗</Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="evidence-section mt-12">
              <p className="evidence-kicker">No releases yet</p>
              <h2 className="evidence-title mt-4">The next human-approved article will appear here.</h2>
              <p className="evidence-copy mt-4 max-w-3xl">Private candidates, drafts, and withheld publication handoffs are intentionally not listed. In the meantime, explore Maha&rsquo;s independently maintained intelligence library.</p>
              <Link href="/intelligence" className="evidence-link mt-6 inline-block">Explore intelligence ↗</Link>
            </section>
          )}

          <section className="evidence-section mt-16" aria-labelledby="editorial-standard">
            <p className="evidence-kicker">[ Editorial standard ]</p>
            <h2 id="editorial-standard" className="evidence-section-title mt-4">Publication is a decision, not an automatic output.</h2>
            <p className="evidence-copy mt-4 max-w-3xl">This library does not publish private drafts, rejected candidates, or automated summaries. Each release identifies its reviewer, evidence, method, and limitations so readers can judge the work on its merits.</p>
            <div className="mt-6 flex flex-wrap gap-5">
              <Link href="/method" className="evidence-link">Read the method ↗</Link>
              <Link href="/about" className="evidence-link">About the publisher ↗</Link>
              <Link href="/feed.xml" className="evidence-link">Subscribe by feed ↗</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
