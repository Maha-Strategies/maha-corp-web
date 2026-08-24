import type { Metadata } from 'next'
import Link from 'next/link'

import ArticleTableOfContents from '@/components/ArticleTableOfContents'
import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'
const PATH = '/books/the-volcanic-engine/is-yellowstone-overdue'
const URL = `${SITE_URL}${PATH}`

const sources = [
  {
    title: 'Is Yellowstone overdue for an eruption? When will Yellowstone erupt?',
    author: 'U.S. Geological Survey, Volcano Hazards Program',
    href: 'https://www.usgs.gov/faqs/yellowstone-overdue-eruption-when-will-yellowstone-erupt',
    note: 'Official explanation of why Yellowstone is not overdue and why two intervals cannot define a schedule.',
  },
  {
    title: 'Questions About Future Volcanic Activity at Yellowstone',
    author: 'Yellowstone Volcano Observatory, U.S. Geological Survey',
    href: 'https://www.usgs.gov/volcanoes/yellowstone/questions-about-future-volcanic-activity-yellowstone',
    note: 'Official answers about recurrence arithmetic, possible future activity, and the limits of prediction.',
  },
  {
    title: 'What type of eruption will Yellowstone have if it erupts again?',
    author: 'U.S. Geological Survey',
    href: 'https://www.usgs.gov/faqs/what-type-eruption-will-yellowstone-have-if-it-erupts-again',
    note: 'Explains that most past Yellowstone eruptions were not caldera-forming supereruptions.',
  },
]

export const metadata: Metadata = {
  title: 'Is Yellowstone Overdue for an Eruption? No—Here Is Why',
  description:
    'Yellowstone is not overdue. The claim treats two unequal intervals as a reliable eruption schedule. Here is the arithmetic, the statistical error, and the real boundary.',
  alternates: { canonical: PATH },
  openGraph: {
    type: 'article',
    url: URL,
    title: 'Is Yellowstone Overdue for an Eruption?',
    description: 'No. Two intervals do not make a reliable volcanic schedule.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Is Yellowstone Overdue? — The Volcanic Engine' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Is Yellowstone Overdue for an Eruption?',
    description: 'No. Two intervals do not make a reliable volcanic schedule.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Is Yellowstone Overdue for an Eruption? No—Here Is Why',
  description: metadata.description,
  url: URL,
  mainEntityOfPage: URL,
  isPartOf: { '@id': `${SITE_URL}/books/the-volcanic-engine#book` },
  author: { '@id': MAYONE_MAHA_RAJAN_ID },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  datePublished: '2026-08-24',
  dateModified: '2026-08-24',
  isAccessibleForFree: true,
  inLanguage: 'en',
  articleSection: 'Volcanic risk explainer',
  citation: sources.map((source) => source.href),
  about: [
    { '@type': 'Place', name: 'Yellowstone Caldera' },
    { '@type': 'Thing', name: 'Caldera-forming eruption' },
    { '@type': 'Thing', name: 'Volcanic hazard' },
  ],
}

export default function IsYellowstoneOverduePage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <Link href="/books/the-volcanic-engine" className="evidence-kicker evidence-link inline-block">← The Volcanic Engine</Link>

        <header className="mt-10 border-b border-[var(--border-default)] pb-10">
          <p className="evidence-kicker">[ Myth check · official-source calibration ]</p>
          <h1 className="evidence-title evidence-title--product mt-5">Is Yellowstone overdue for an eruption?</h1>
          <p className="evidence-lede mt-6">
            No. “Overdue” assumes a periodic schedule that Yellowstone does not exhibit. The popular countdown is built by averaging only two unequal intervals and treating the result like a recurrence law.
          </p>
          <p className="evidence-kicker mt-7">Mayone Maha Rajan · Companion to The Caldera Problem</p>
        </header>

        <ArticleTableOfContents contentId="article-content" />
        <div id="article-content" data-article-content className="prose prose-lg max-w-none prose-p:text-[var(--text-secondary)] prose-p:leading-[1.85] prose-p:mb-7 prose-strong:text-[var(--text-primary)] prose-a:text-[var(--status-sourced)] prose-a:no-underline hover:prose-a:text-[var(--text-primary)] prose-li:text-[var(--text-secondary)] prose-li:leading-relaxed">
          <h2>Short answer</h2>
          <p>
            The U.S. Geological Survey states directly that Yellowstone is not overdue. Its major caldera-forming eruptions occurred roughly 2.08 million, 1.3 million, and 631,000 years ago. Those dates provide only two intervals, and the intervals are not equal. Averaging them does not turn the volcanic system into a clock. <a href={sources[0].href}>[1]</a>
          </p>

          <h2>Where the countdown comes from</h2>
          <p>
            A common version of the claim says Yellowstone produces a very large eruption about every 600,000 years and that the last one occurred more than 600,000 years ago. The arithmetic sounds intuitive because it resembles a maintenance interval. But a volcano is not a machine with a scheduled service date.
          </p>
          <p>
            Even the arithmetic is misrepresented. The two observed gaps are of different lengths, and their average is longer than 600,000 years. More importantly, two intervals are far too little evidence from which to infer a periodic process. The average describes those two gaps; it does not establish the next one. <a href={sources[1].href}>[2]</a>
          </p>

          <h2>Not overdue does not mean inactive</h2>
          <p>
            Rejecting the countdown is not the same as declaring Yellowstone harmless or extinct. It remains an active volcanic and hydrothermal system, and another eruption is possible. The point is narrower: past caldera-forming eruptions do not provide a reliable timetable for the next event.
          </p>
          <p>
            Risk communication fails when it forces a choice between “a supereruption is imminent” and “nothing can happen.” Scientists can monitor earthquakes, ground deformation, thermal features, and gas without claiming a date the evidence cannot support.
          </p>

          <h2>A future eruption need not be a supereruption</h2>
          <p>
            The public image of Yellowstone often jumps directly from unrest to a continent-scale caldera event. The geological record is broader. USGS notes that most Yellowstone eruptions were not highly explosive caldera-forming events; lava flows are more common in the record than supereruptions. <a href={sources[2].href}>[3]</a>
          </p>
          <p>
            That does not make smaller volcanic or hydrothermal events trivial. It means the hazard should be described as a distribution of possible events rather than a single cinematic scenario.
          </p>

          <h2>The statistical mistake</h2>
          <p>
            An average recurrence interval is useful only when the process and the evidence justify treating events as repeated observations from a stable pattern. Here, the sample is two intervals from a changing geological system. The value has no demonstrated power to forecast the next caldera-forming eruption.
          </p>
          <p>
            Calling the system overdue adds a second unsupported assumption: that the probability rises sharply after the average interval passes. The observed dates do not establish such a threshold. A tail risk can be real without being periodic.
          </p>

          <h2>The decision boundary</h2>
          <div className="not-prose my-8 grid gap-5 sm:grid-cols-2">
            <div className="evidence-card border-l-4 border-l-[var(--status-verified)]">
              <p className="evidence-kicker text-[var(--status-verified)]">Supported</p>
              <p className="evidence-copy mt-4">Yellowstone has produced major eruptions, remains an active monitored system, and could erupt again.</p>
            </div>
            <div className="evidence-card border-l-4 border-l-[var(--status-boundary)]">
              <p className="evidence-kicker text-[var(--status-boundary)]">Not supported</p>
              <p className="evidence-copy mt-4">The three major eruption dates do not establish a deadline, a periodic schedule, or an imminent supereruption.</p>
            </div>
          </div>

          <h2>What to use instead of a countdown</h2>
          <p>
            Use the current assessments of the Yellowstone Volcano Observatory and local emergency authorities, not a recycled average. Monitoring evaluates the system that exists now. A recurrence myth substitutes an appealing story for that live evidence.
          </p>
          <p>
            Chapter 10 of <em>The Volcanic Engine</em> uses this case to make a broader argument: uncertainty becomes more useful when it is stated as uncertainty. A sober hazard is not made safer by exaggeration, and a correction is not a promise that nothing will happen.
          </p>
        </div>

        <section className="evidence-section" aria-labelledby="sources">
          <p className="evidence-kicker">[ Official sources ]</p>
          <h2 id="sources" className="evidence-section-title mt-4">Evidence used for this myth check</h2>
          <ol className="mt-7 space-y-5">
            {sources.map((source, index) => (
              <li key={source.href} className="grid grid-cols-[2rem_1fr] gap-4 text-sm leading-relaxed">
                <span className="font-mono text-[var(--text-muted)]">{index + 1}</span>
                <div>
                  <a href={source.href} className="evidence-link">{source.title}</a>
                  <span className="text-[var(--text-muted)]"> · {source.author}</span>
                  <p className="mt-1 text-[var(--text-muted)]">{source.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="evidence-section border-b-0">
          <p className="evidence-kicker">[ Continue reading ]</p>
          <div className="mt-5 flex flex-col gap-3">
            <Link href="/books/the-volcanic-engine/read/the-caldera-problem" className="evidence-link">Read Chapter 10: The Caldera Problem ↗</Link>
            <Link href="/books/the-volcanic-engine" className="evidence-link">Return to The Volcanic Engine ↗</Link>
          </div>
        </footer>
      </article>
    </main>
  )
}
