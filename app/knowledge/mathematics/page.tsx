import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  MATHEMATICAL_BRIDGES,
  MATHEMATICAL_CONCEPTS,
  MATHEMATICS_CATEGORIES,
  MATHEMATICS_DOMAINS,
  MATHEMATICS_DOMAIN_META,
  MATHEMATICS_KNOWLEDGE_PATH,
  MATHEMATICS_KNOWLEDGE_RELEASE_DATE,
  MATHEMATICS_KNOWLEDGE_VERSION,
  MATHEMATICS_REGISTRY_PATH,
  mathematicsConceptPath,
} from '@/lib/mathematics-knowledge'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Mathematics Knowledge System | Maha Strategies',
  description: 'Twenty-four mathematical concepts and forty-two explicit bridges connecting semiconductor engineering, celestial calculations, astronomy, astrology traditions, timing, and empirical validation.',
  alternates: { canonical: MATHEMATICS_KNOWLEDGE_PATH },
  openGraph: { type: 'website', title: 'Mathematics Knowledge System', description: 'The connective grammar beneath Maha’s calculations, models, rules, and tests.', url: `${SITE_URL}${MATHEMATICS_KNOWLEDGE_PATH}`, siteName: 'Maha Strategies' },
}

export default function MathematicsKnowledgePage() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Maha Mathematics Knowledge System', description: metadata.description,
    url: `${SITE_URL}${MATHEMATICS_KNOWLEDGE_PATH}`, dateModified: MATHEMATICS_KNOWLEDGE_RELEASE_DATE,
    hasPart: MATHEMATICAL_CONCEPTS.map((concept) => ({ '@type': 'TechArticle', name: concept.name, url: `${SITE_URL}${mathematicsConceptPath(concept)}` })),
  }

  return (
    <main className="min-h-screen bg-[#08090b] px-6 py-16 text-zinc-300 selection:bg-emerald-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><span className="text-zinc-400">Mathematics</span></nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Connective grammar · {MATHEMATICS_KNOWLEDGE_VERSION}</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">The same mathematics, with different evidentiary roles.</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">This layer defines the geometry, time, numerical methods, statistics, networks, and decision procedures shared across Maha’s knowledge systems. Every bridge says exactly what goes in, what transformation occurs, what comes out, and where the inference must stop.</p>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="border border-emerald-900/60 bg-emerald-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">Shared method</p><p className="mt-3 text-sm leading-6 text-zinc-400">Coordinate transforms, uncertainty propagation, graphs, and scores can serve several domains without making those domains epistemically equivalent.</p></div>
          <div className="border border-sky-900/60 bg-sky-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-sky-300">Typed bridge</p><p className="mt-3 text-sm leading-6 text-zinc-400">Each of the {MATHEMATICAL_BRIDGES.length} records declares inputs, transformation, outputs, evidence role, destination, and limitations.</p></div>
          <div className="border border-rose-900/60 bg-rose-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No validity transfer</p><p className="mt-3 text-sm leading-6 text-zinc-400">Formalizing an astrological rule can establish consistency and provenance. Only prospective empirical tests can estimate predictive performance.</p></div>
        </section>

        <section className="mt-14 border-t border-zinc-800 pt-9">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Cross-domain bridge matrix</p><h2 className="mt-3 text-3xl font-semibold text-white">Six systems, one inspectable grammar</h2></div><a href={MATHEMATICS_REGISTRY_PATH} className="font-mono text-[10px] uppercase tracking-widest text-emerald-300 hover:text-white">Open JSON registry →</a></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MATHEMATICS_DOMAINS.map((domain) => {
              const bridges = MATHEMATICAL_BRIDGES.filter((bridge) => bridge.domain === domain)
              return <div key={domain} className="border border-zinc-800 bg-zinc-950/50 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">{bridges.length} explicit bridges</p><h3 className="mt-3 text-lg font-semibold text-white">{MATHEMATICS_DOMAIN_META[domain].label}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{MATHEMATICS_DOMAIN_META[domain].description}</p><ul className="mt-4 space-y-2 border-t border-zinc-800 pt-4">{bridges.map((bridge) => <li key={bridge.id} className="text-xs leading-5 text-zinc-400">{bridge.title}</li>)}</ul></div>
            })}
          </div>
        </section>

        {MATHEMATICS_CATEGORIES.map((category) => {
          const concepts = MATHEMATICAL_CONCEPTS.filter((concept) => concept.category === category)
          return (
            <section key={category} className="mt-14 border-t border-zinc-800 pt-8">
              <div className="flex items-baseline justify-between gap-4"><h2 className="text-2xl font-semibold text-white">{category}</h2><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{concepts.length} concepts</p></div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {concepts.map((concept) => {
                  const bridgeCount = MATHEMATICAL_BRIDGES.filter((bridge) => bridge.conceptId === concept.id).length
                  return <Link key={concept.id} href={mathematicsConceptPath(concept)} className="group border border-zinc-800 p-5 transition-colors hover:border-emerald-600/60"><div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest"><span className="text-emerald-300">{concept.proofStatus}</span><span className="text-zinc-600">{bridgeCount} bridges</span></div><h3 className="mt-3 text-lg font-semibold text-white group-hover:text-emerald-200">{concept.name}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{concept.description}</p><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-zinc-600 group-hover:text-emerald-300">Inspect concept and applications →</p></Link>
                })}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
