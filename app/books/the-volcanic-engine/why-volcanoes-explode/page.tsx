import type { Metadata } from 'next'
import Link from 'next/link'

import ArticleTableOfContents from '@/components/ArticleTableOfContents'
import { MAHA_ORGANIZATION_ID, MAYONE_MAHA_RAJAN_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'
const PATH = '/books/the-volcanic-engine/why-volcanoes-explode'
const URL = `${SITE_URL}${PATH}`

const sources = [
  {
    title: 'Volcanoes: The Nature of Volcanoes',
    author: 'U.S. Geological Survey',
    href: 'https://pubs.usgs.gov/gip/volc/nature.html',
    note: 'Official overview of magma composition, dissolved gas, viscosity, and explosive fragmentation.',
  },
  {
    title: 'Eruptions of Hawaiian Volcanoes: Eruptive Style',
    author: 'U.S. Geological Survey',
    href: 'https://pubs.usgs.gov/gip/hawaii/page26.html',
    note: 'Contrasts fluid basaltic lava with more viscous magma and explains why easy gas escape changes eruptive style.',
  },
  {
    title: 'Volcano Watch — When ash flows like a fluid',
    author: 'U.S. Geological Survey',
    href: 'https://www.usgs.gov/news/volcano-watch-when-ash-flows-a-fluid',
    note: 'Explains decompression, bubble growth, ash fragmentation, eruption columns, and ground-hugging pyroclastic flows.',
  },
]

export const metadata: Metadata = {
  title: 'Why Do Volcanoes Explode? Gas, Pressure, and Viscosity',
  description:
    'A plain-English explanation of why some volcanoes produce lava flows while others fragment magma into ash: dissolved gas, decompression, viscosity, and escape pathways.',
  alternates: { canonical: PATH },
  openGraph: {
    type: 'article',
    url: URL,
    title: 'Why Do Volcanoes Explode?',
    description: 'How dissolved gas, falling pressure, and magma viscosity shape an eruption.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Why Do Volcanoes Explode? — The Volcanic Engine' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Why Do Volcanoes Explode?',
    description: 'How dissolved gas, falling pressure, and magma viscosity shape an eruption.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Why Do Volcanoes Explode? Gas, Pressure, and Viscosity',
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
  articleSection: 'Volcanology explainer',
  citation: sources.map((source) => source.href),
  about: [
    { '@type': 'Thing', name: 'Volcanic eruption' },
    { '@type': 'Thing', name: 'Magma' },
    { '@type': 'Thing', name: 'Volcanic gas' },
  ],
}

export default function WhyVolcanoesExplodePage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <Link href="/books/the-volcanic-engine" className="evidence-kicker evidence-link inline-block">← The Volcanic Engine</Link>

        <header className="mt-10 border-b border-[var(--border-default)] pb-10">
          <p className="evidence-kicker">[ Plain-English volcanology guide ]</p>
          <h1 className="evidence-title evidence-title--product mt-5">Why do volcanoes explode?</h1>
          <p className="evidence-lede mt-6">
            Magma does not explode simply because it is hot. The central problem is gas: it is dissolved under pressure at depth, forms bubbles as magma rises, and may become trapped when the surrounding melt is too viscous to let it escape.
          </p>
          <p className="evidence-kicker mt-7">Mayone Maha Rajan · Companion guide to Chapter 2</p>
        </header>

        <ArticleTableOfContents contentId="article-content" />
        <div id="article-content" data-article-content className="prose prose-lg max-w-none prose-p:text-[var(--text-secondary)] prose-p:leading-[1.85] prose-p:mb-7 prose-strong:text-[var(--text-primary)] prose-a:text-[var(--status-sourced)] prose-a:no-underline hover:prose-a:text-[var(--text-primary)] prose-li:text-[var(--text-secondary)] prose-li:leading-relaxed">
          <h2>Short answer</h2>
          <p>
            Deep underground, pressure keeps water, carbon dioxide, and other volatile substances dissolved in magma. As magma rises, pressure falls. Gas comes out of solution and expands into bubbles. If those bubbles can escape through a fluid melt, the eruption can remain comparatively effusive. If the melt resists flow and traps the gas, pressure and bubble volume build until the magma fragments into ash, pumice, and larger pieces. <a href={sources[0].href}>[1]</a>
          </p>
          <p>
            This is why “hotter” does not automatically mean “more explosive.” Eruptive style emerges from an interacting system: composition, temperature, crystals, gas content, ascent rate, and the geometry through which gas and magma move.
          </p>

          <h2>The carbonated-drink analogy—and its limit</h2>
          <p>
            A sealed carbonated drink is a useful first model. Carbon dioxide stays dissolved while pressure is high. Opening the container lowers the pressure, bubbles form, and gas expands. Rising magma undergoes a related decompression process. The analogy helps explain why a liquid can carry hidden gas and then suddenly become a liquid–bubble mixture. <a href={sources[0].href}>[1]</a>
          </p>
          <p>
            But a volcanic conduit is not a bottle. Magma can crystallize and change viscosity while rising; bubbles can merge, deform, escape, or become trapped; surrounding rock can fail; and the pathway can open or close. The analogy supplies the mechanism, not a forecast.
          </p>

          <h2>Why viscosity matters</h2>
          <p>
            Viscosity is resistance to flow. A relatively fluid magma gives expanding gas more opportunity to separate and escape. A viscous magma can hold gas in the melt for longer, allowing pressure to build and making fragmentation more likely. Composition matters because silica-rich magmas tend to form structures that resist flow; temperature and crystal content also change the effective viscosity. <a href={sources[1].href}>[2]</a>
          </p>
          <p>
            This distinction helps explain the broad contrast between many Hawaiian eruptions, where fluid lava and gas can emerge through fountains and flows, and highly explosive eruptions from more viscous systems. It is a broad physical pattern, not a rule that identifies the outcome of every individual volcano.
          </p>

          <h2>Fragmentation changes the hazard</h2>
          <p>
            Once gas expansion tears magma apart, the eruption produces particles rather than a coherent lava flow. Fine ash can enter a rising column and travel far downwind. A hot mixture of ash, rock, and gas can also lose buoyancy, collapse, and move across the ground as a pyroclastic flow or surge. That is a different hazard regime from a lava flow: faster, hotter, and often far less survivable at close range. <a href={sources[2].href}>[3]</a>
          </p>

          <h2>What can trigger the final transition?</h2>
          <p>
            Decompression supplies the underlying gas-expansion mechanism, but the immediate transition to eruption can involve several changes: new magma entering a system, gas accumulating, a pathway opening, a flank failing, or pressure exceeding the strength of surrounding rock. The same volcano can also produce different styles at different times.
          </p>
          <p>
            That is why the honest object of monitoring is not a single magic trigger. Scientists combine earthquakes, ground deformation, gas chemistry, heat, and observations of past deposits to judge whether a system is departing from its background behavior. Those measurements improve decisions without turning a complex system into a clock.
          </p>

          <h2>What this explanation does not establish</h2>
          <div className="not-prose my-8 evidence-card border-l-4 border-l-[var(--status-boundary)]">
            <p className="evidence-kicker text-[var(--status-boundary)]">Boundary</p>
            <p className="evidence-copy mt-4">
              The gas-and-viscosity model explains why explosive behavior is physically possible. It does not, by itself, predict the time, size, direction, or consequence of a future eruption at a particular volcano. Those are site-specific questions that require current monitoring and local hazard maps.
            </p>
          </div>

          <h2>Where the book goes next</h2>
          <p>
            <em>The Volcanic Engine</em> begins by correcting the picture of a liquid mantle, then follows magma as it forms, rises, stores, and becomes legible only through indirect evidence. Chapter 2 develops the physical “cork”; Chapters 3 through 5 turn to the harder problem—how to warn people about a machine that cannot be instrumented from the inside.
          </p>
        </div>

        <section className="evidence-section" aria-labelledby="sources">
          <p className="evidence-kicker">[ Official sources ]</p>
          <h2 id="sources" className="evidence-section-title mt-4">Evidence used for this guide</h2>
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
            <Link href="/books/the-volcanic-engine/read/the-physics-of-the-cork" className="evidence-link">Read Chapter 2: The Physics of the Cork ↗</Link>
            <Link href="/books/the-volcanic-engine" className="evidence-link">Return to The Volcanic Engine ↗</Link>
          </div>
        </footer>
      </article>
    </main>
  )
}
