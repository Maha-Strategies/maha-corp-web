import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import { CELESTIAL_FACT_PATH } from '@/lib/celestial-facts'
import {
  ASTRONOMY_ARTICLES,
  ASTRONOMY_EVIDENCE_STATES,
  ASTRONOMY_KNOWLEDGE_PATH,
  ASTRONOMY_KNOWLEDGE_RELEASE_DATE,
  ASTRONOMY_KNOWLEDGE_VERSION,
  ASTRONOMY_REGISTRY_PATH,
  ASTRONOMY_SCHEMA_PATH,
  ASTRONOMY_SOURCES,
  ASTRONOMY_TRACKS,
  ASTRONOMY_TRACK_META,
  astronomyArticlePath,
} from '@/lib/astronomy-knowledge'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Astronomy Knowledge | Maha Strategies',
  description: 'A cited Astronomy knowledge graph that keeps observations, calibrated measurements, model-dependent inferences, and open questions distinct.',
  alternates: { canonical: ASTRONOMY_KNOWLEDGE_PATH },
  openGraph: {
    type: 'website', title: 'Astronomy Knowledge | Maha Strategies',
    description: 'Observation → model → boundary. A provenance-aware map of how Astronomy knows what it knows.',
    url: `${SITE_URL}${ASTRONOMY_KNOWLEDGE_PATH}`, siteName: 'Maha Strategies',
    images: [{ url: '/og-astronomy.png', width: 1731, height: 909, alt: 'Astronomy Knowledge — Observation to model to boundary' }],
  },
  twitter: { card: 'summary_large_image', title: 'Astronomy Knowledge | Maha Strategies', description: 'Observation → model → boundary.', images: ['/og-astronomy.png'] },
}

const evidenceMeta = {
  'direct-observation': ['Direct observation', 'A detector record before physical interpretation.'],
  'calibrated-measurement': ['Calibrated measurement', 'An observable after instrument and reference calibration.'],
  'method-basis': ['Method basis', 'A standard, transformation, or measurement procedure.'],
  'model-dependent': ['Model-dependent', 'A parameter or explanation conditional on stated assumptions.'],
  'consensus-summary': ['Consensus summary', 'A bounded synthesis supported across established evidence.'],
  'open-question': ['Open question', 'A live uncertainty, degeneracy, or unresolved mechanism.'],
} as const

export default function AstronomyKnowledgePage() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Maha Astronomy Knowledge', description: metadata.description,
    url: `${SITE_URL}${ASTRONOMY_KNOWLEDGE_PATH}`, datePublished: ASTRONOMY_KNOWLEDGE_RELEASE_DATE, dateModified: ASTRONOMY_KNOWLEDGE_RELEASE_DATE,
    isBasedOn: `${SITE_URL}${CELESTIAL_FACT_PATH}`,
    hasPart: ASTRONOMY_ARTICLES.map((article) => ({ '@type': 'TechArticle', name: article.title, url: `${SITE_URL}${astronomyArticlePath(article)}` })),
  }

  return (
    <main className="min-h-screen bg-[#07090e] text-zinc-300 selection:bg-sky-300 selection:text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <section className="relative overflow-hidden border-b border-sky-950 px-6 py-20 sm:px-12">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(56,189,248,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.05)_1px,transparent_1px),radial-gradient(circle_at_72%_20%,rgba(99,102,241,0.16),transparent_26%)] [background-size:48px_48px,48px_48px,auto]" />
        <div className="relative mx-auto max-w-6xl">
          <nav className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><span className="text-sky-300">Astronomy</span></nav>
          <div className="mt-10 grid gap-12 lg:grid-cols-[1.55fr_0.8fr] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-sky-300">[ Explanatory layer // {ASTRONOMY_KNOWLEDGE_VERSION} ]</p>
              <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">The universe, with the inference chain left intact.</h1>
              <p className="mt-7 max-w-3xl font-serif text-lg leading-8 text-zinc-400">Astronomy begins with recorded signals, not conclusions. This layer shows what was observed, how it was calibrated, which model converts it into a physical claim, and where uncertainty remains.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#map" className="border border-sky-400 bg-sky-400 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white">Explore {ASTRONOMY_ARTICLES.length} explainers ↓</a>
                <Link href={CELESTIAL_FACT_PATH} className="border border-zinc-700 px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-zinc-300 hover:border-sky-500 hover:text-sky-200">Inspect the fact substrate →</Link>
              </div>
            </div>
            <div className="border border-sky-900/60 bg-sky-950/10 p-6 font-mono text-xs leading-7 text-zinc-500">
              <p className="text-sky-200">Layer status: foundational</p>
              <p>{ASTRONOMY_TRACKS.length} knowledge tracks</p>
              <p>{ASTRONOMY_ARTICLES.length} cited explainers</p>
              <p>{ASTRONOMY_SOURCES.length} registered sources</p>
              <p>{ASTRONOMY_EVIDENCE_STATES.length} epistemic states</p>
              <p className="mt-4 border-t border-zinc-800 pt-4 text-amber-300">Astrological interpretation: outside this layer</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 px-6 py-14 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Epistemic ladder</p><h2 className="mt-3 text-3xl font-semibold text-white">Every sentence has a type.</h2></div><div className="flex gap-3"><a href={ASTRONOMY_REGISTRY_PATH} className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-sky-300">JSON registry →</a><a href={ASTRONOMY_SCHEMA_PATH} className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-sky-300">Schema →</a></div></div>
          <div className="mt-7 grid gap-px border border-zinc-800 bg-zinc-800 md:grid-cols-2 lg:grid-cols-3">
            {ASTRONOMY_EVIDENCE_STATES.map((state, index) => <article key={state} className="bg-[#07090e] p-5"><p className="font-mono text-[10px] text-sky-300">{String(index + 1).padStart(2, '0')}</p><h3 className="mt-3 font-semibold text-white">{evidenceMeta[state][0]}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{evidenceMeta[state][1]}</p></article>)}
          </div>
        </div>
      </section>

      <section id="map" className="px-6 py-16 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[230px_1fr]">
            <aside>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Knowledge map</p>
              <ol className="mt-5 space-y-3 border-l border-zinc-800 pl-5">{ASTRONOMY_TRACKS.map((track) => <li key={track}><a href={`#${track}`} className="font-mono text-xs text-zinc-400 hover:text-sky-300">{String(ASTRONOMY_TRACK_META[track].order).padStart(2, '0')} · {ASTRONOMY_TRACK_META[track].label}</a></li>)}</ol>
              <div className="mt-9 border-l-2 border-amber-500/60 pl-4 text-xs leading-5 text-zinc-500">The Celestial layer supplies reproducible positions and time. Astronomy adds explanations and models without rewriting those facts.</div>
            </aside>
            <div className="space-y-16">
              {ASTRONOMY_TRACKS.map((track) => {
                const articles = ASTRONOMY_ARTICLES.filter((article) => article.track === track)
                const meta = ASTRONOMY_TRACK_META[track]
                return <section key={track} id={track} className="scroll-mt-24"><div className="flex items-baseline gap-4 border-b border-zinc-800 pb-4"><span className="font-mono text-xs text-sky-400">{String(meta.order).padStart(2, '0')}</span><div><h2 className="text-2xl font-semibold text-white">{meta.label}</h2><p className="mt-1 text-sm leading-6 text-zinc-500">{meta.description}</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2">{articles.map((article) => <Link key={article.id} href={astronomyArticlePath(article)} className="group border border-zinc-800 bg-zinc-950/60 p-5 hover:border-sky-500/50"><div className="flex justify-between gap-4 font-mono text-[9px] uppercase tracking-widest"><span className="text-sky-300">{article.kind.replace('-', ' ')}</span><span className="text-zinc-600">{article.status}</span></div><h3 className="mt-4 text-lg font-semibold text-white group-hover:text-sky-200">{article.shortTitle}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{article.description}</p><div className="mt-5 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-zinc-600"><span>{article.claims.length} bounded claims</span><span className="group-hover:text-sky-300">Open explainer →</span></div></Link>)}</div></section>
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
