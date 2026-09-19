import type { Metadata } from 'next'
import Link from 'next/link'

import { MAHA_ORGANIZATION_ID, MAHA_SITE_URL } from '@/lib/entity'
import {
  PHYSICAL_AI_ARTICLES,
  PHYSICAL_AI_CANDIDATES,
  PHYSICAL_AI_PATH,
  PHYSICAL_AI_RELEASE_DATE,
  PHYSICAL_AI_SOURCES,
} from '@/lib/physical-ai-knowledge'

const title = 'Physical AI: learned systems that act | Maha Strategies'
const description =
  'What physical AI means, how world models, vision-language-action policies and demonstration learning actually work, and what their reported results establish. Twelve sourced explanations and a runnable perception–action fixture.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: PHYSICAL_AI_PATH },
  openGraph: { title, description, url: `${MAHA_SITE_URL}${PHYSICAL_AI_PATH}`, type: 'website', siteName: 'Maha Strategies' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${MAHA_SITE_URL}${PHYSICAL_AI_PATH}#collection`,
  url: `${MAHA_SITE_URL}${PHYSICAL_AI_PATH}`,
  name: 'Physical AI: learned systems that act',
  description,
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  dateModified: PHYSICAL_AI_RELEASE_DATE,
  hasPart: PHYSICAL_AI_ARTICLES.map((article) => ({
    '@type': 'Article',
    '@id': `${MAHA_SITE_URL}${PHYSICAL_AI_PATH}/${article.slug}`,
    headline: article.title,
    description: article.answer,
  })),
}

export default function PhysicalAiHub() {
  const implemented = PHYSICAL_AI_CANDIDATES.filter((candidate) => candidate.status === 'implemented').length
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="evidence-container evidence-container--narrow">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link className="evidence-link" href="/knowledge">Knowledge</Link>
          <span aria-hidden="true"> / </span>Physical AI
        </nav>

        <header className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Evidence and evaluation · no robots operated here ]</p>
          <h1 className="mt-4 text-4xl font-light leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl">Physical AI</h1>
          <p className="mt-6 text-xl leading-relaxed text-[var(--text-secondary)]">
            Learned models are being asked to act in the physical world, where the system’s own actions decide what it sees next and a
            mistake has consequences. These pages explain the methods — world models, vision-language-action policies, learning from
            demonstration, domain randomization, uncertainty and monitoring — and say plainly what each published result establishes.
          </p>
          <p className="mt-5 leading-relaxed text-[var(--text-secondary)]">
            This section is the learning and modelling companion to{' '}
            <Link className="evidence-link" href="/knowledge/robotics">robotics evidence and evaluation</Link>, which owns the
            hardware, the evidence records and the safety boundaries. Where a subject belongs to both, robotics keeps the evidence
            record and these pages link to it rather than publishing a second version.
          </p>
        </header>

        <section className="mt-12" aria-labelledby="start">
          <h2 id="start" className="evidence-section-title text-xl">Start here</h2>
          <ul className="mt-4 list-none space-y-3 p-0">
            {['what-physical-ai-means', 'perception-action-loops', 'vision-language-action-models'].map((slug) => {
              const article = PHYSICAL_AI_ARTICLES.find((entry) => entry.slug === slug)!
              return (
                <li key={slug}>
                  <Link className="evidence-link" href={`${PHYSICAL_AI_PATH}/${slug}`}>{article.title}</Link>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{article.answer}</p>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="all-articles">
          <h2 id="all-articles" className="evidence-section-title text-xl">All {implemented} explanations</h2>
          <ul className="mt-4 list-none space-y-5 p-0">
            {PHYSICAL_AI_ARTICLES.map((article) => (
              <li key={article.slug} className="border-l border-[var(--border-strong)] pl-4">
                <Link className="evidence-link" href={`${PHYSICAL_AI_PATH}/${article.slug}`}>{article.title}</Link>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{article.answer}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="run-it">
          <h2 id="run-it" className="evidence-section-title text-xl">Run the fixture yourself</h2>
          <p className="mt-4 leading-relaxed text-[var(--text-secondary)]">
            A deterministic one-dimensional perception–action loop with observation noise, actuation delay, a monitor and an
            intervention path. It reports autonomous success, assisted success, failure or abort — and splits monitor firings into
            those an injected disturbance explains and those it does not.
          </p>
          <pre className="mt-5 overflow-x-auto border border-[var(--border-default)] p-4 text-sm">
{`node --experimental-strip-types scripts/physical-ai-loop.ts run --actuationDelaySteps 3
node --experimental-strip-types scripts/physical-ai-loop.ts counterexamples`}
          </pre>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
            It is a simulation with no physics, contact, hardware or people. See{' '}
            <Link className="evidence-link" href={`${PHYSICAL_AI_PATH}/evaluation-fixture-example`}>what the fixture is not</Link>.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="elsewhere">
          <h2 id="elsewhere" className="evidence-section-title text-xl">Related sections</h2>
          <ul className="mt-4 list-none space-y-2 p-0">
            <li><Link className="evidence-link" href="/knowledge/robotics">Robotics evidence and evaluation</Link> — hardware, evidence intake, safety and the 40-page evaluation corpus.</li>
            <li><Link className="evidence-link" href="/knowledge/neuromorphic-biocomputing">Neuromorphic and biocomputing</Link> — event-driven sensing and in-memory computing for embodied systems.</li>
            <li><Link className="evidence-link" href="/knowledge/nanotechnology">Nanotechnology</Link> — the same evidence discipline applied to materials claims.</li>
            <li><Link className="evidence-link" href="/knowledge/mathematics">Mathematics knowledge system</Link> — the formal layer under estimation and control.</li>
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="sources">
          <h2 id="sources" className="evidence-section-title text-xl">Sources read for this section</h2>
          <ul className="mt-4 list-none space-y-4 p-0">
            {Object.values(PHYSICAL_AI_SOURCES).map((source) => (
              <li key={source.url}>
                <a className="evidence-link" href={source.url} target="_blank" rel="noreferrer noopener">{source.title} ↗</a>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">Read at: {source.locator} · inspected {source.inspected}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-[var(--text-muted)]">
            Every performance figure on these pages is the original authors’ own reported result on their own evaluation, attributed
            as such. Maha has replicated none of them, operates no robot, and endorses no system or vendor.
          </p>
        </section>
      </article>
    </main>
  )
}
