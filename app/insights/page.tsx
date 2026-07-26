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
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl border-b border-zinc-800 pb-12">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Insights // public editorial releases ]</p>
          <h1 className="mt-5 text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl">Evidence-led articles, released by a human.</h1>
          <p className="mt-7 text-lg leading-relaxed text-zinc-400">Each article here was created through Maha&rsquo;s evidence-to-editorial workflow, reviewed before release, and published only through an explicit human confirmation. Sources and limits remain on the article itself.</p>
          <div className="mt-9 grid gap-4 border-t border-zinc-800 pt-7 sm:grid-cols-3">
            <div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">01 · Answer</p><p className="mt-2 text-sm leading-relaxed text-zinc-500">Start with the decision-relevant conclusion, in plain language.</p></div>
            <div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">02 · Evidence</p><p className="mt-2 text-sm leading-relaxed text-zinc-500">Open the linked sources and supporting artifact; do not take a synthesis on faith.</p></div>
            <div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">03 · Limits</p><p className="mt-2 text-sm leading-relaxed text-zinc-500">Read what the analysis cannot establish before carrying it into a decision.</p></div>
          </div>
        </header>

        {publications.length > 0 ? (
          <section className="mt-12" aria-label="Published insights">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{publications.length} published {publications.length === 1 ? 'insight' : 'insights'}</p>
            <div className="mt-5 grid gap-4">
              {publications.map((publication) => (
                <article key={publication.slug} className="border border-zinc-800 bg-zinc-950/50 p-6 transition-colors hover:border-cyan-800 sm:p-8">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Evidence-led insight · {displayDate(publication.published_at)}</p>
                  <h2 className="mt-4 text-2xl font-light leading-tight text-white sm:text-3xl">
                    <Link href={`/insights/${publication.slug}`} className="hover:text-cyan-100">{publication.title}</Link>
                  </h2>
                  <p className="mt-4 max-w-3xl leading-relaxed text-zinc-400">{publication.summary}</p>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Editorial review: {publication.editorial_reviewer}</p>
                    <Link href={`/insights/${publication.slug}`} className="font-mono text-[10px] uppercase tracking-widest text-cyan-100 underline underline-offset-4 hover:text-white">Read insight ↗</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-12 border border-zinc-800 bg-zinc-950/50 p-8 sm:p-10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">No releases yet</p>
            <h2 className="mt-4 text-2xl font-light text-white">The next human-approved article will appear here.</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-400">Private candidates, drafts, and withheld publication handoffs are intentionally not listed. In the meantime, explore Maha&rsquo;s independently maintained intelligence library.</p>
            <Link href="/intelligence" className="mt-6 inline-block font-mono text-xs uppercase tracking-widest text-cyan-100 underline underline-offset-4 hover:text-white">Explore intelligence ↗</Link>
          </section>
        )}

        <section className="mt-16 border-t border-zinc-800 pt-10" aria-labelledby="editorial-standard">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">[ Editorial standard ]</p>
          <h2 id="editorial-standard" className="mt-4 text-2xl font-light text-white">Publication is a decision, not an automatic output.</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-zinc-400">This library does not publish private drafts, rejected candidates, or automated summaries. Each release identifies its reviewer, evidence, method, and limitations so readers can judge the work on its merits.</p>
          <div className="mt-6 flex flex-wrap gap-5 font-mono text-[10px] uppercase tracking-widest">
            <Link href="/method" className="text-cyan-100 underline underline-offset-4 hover:text-white">Read the method ↗</Link>
            <Link href="/about" className="text-cyan-100 underline underline-offset-4 hover:text-white">About the publisher ↗</Link>
            <Link href="/feed.xml" className="text-cyan-100 underline underline-offset-4 hover:text-white">Subscribe by feed ↗</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
