import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import { MAYON_KNOWLEDGE_PATH } from '@/lib/mayon-knowledge'
import {
  RELIGION_CATEGORIES,
  RELIGION_COMPARISONS,
  RELIGION_COMPARISONS_PATH,
  RELIGION_CONCEPTS,
  RELIGION_KNOWLEDGE_PATH,
  RELIGION_KNOWLEDGE_RELEASE_DATE,
  RELIGION_KNOWLEDGE_VERSION,
  RELIGION_MATHEMATICS_BRIDGES,
  RELIGION_REGISTRY_PATH,
  religionConceptPath,
} from '@/lib/religion-knowledge'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Religion and Contemplative Traditions | Maha Strategies',
  description: 'A methodology-first knowledge system separating textual authority, translation, historical evidence, lived practice, theology, experience, and empirical claims.',
  alternates: { canonical: RELIGION_KNOWLEDGE_PATH },
  openGraph: { type: 'website', title: 'Religion and contemplative traditions', description: 'Eighteen foundational methods, eight bounded comparisons, and explicit mathematical bridges.', url: `${SITE_URL}${RELIGION_KNOWLEDGE_PATH}`, siteName: 'Maha Strategies' },
}

export default function ReligionKnowledgePage() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Religion and contemplative traditions', description: metadata.description,
    url: `${SITE_URL}${RELIGION_KNOWLEDGE_PATH}`, dateModified: RELIGION_KNOWLEDGE_RELEASE_DATE,
    hasPart: RELIGION_CONCEPTS.map((item) => ({ '@type': 'ScholarlyArticle', name: item.name, url: `${SITE_URL}${religionConceptPath(item)}` })),
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-teal-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><span className="text-zinc-400">Religion and contemplative traditions</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-300">Methodology layer · {RELIGION_KNOWLEDGE_VERSION}</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Study authority, practice, and experience without collapsing them into one kind of truth.</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">This opening collection starts before individual beliefs. It defines how to handle texts, translations, material evidence, institutions, living communities, theology, first-person reports, and measurable outcomes—with provenance and limits attached.</p>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="border border-teal-900/60 bg-teal-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">Tradition-relative authority</p><p className="mt-3 text-sm leading-6 text-zinc-400">A canon or theology can be authoritative within a community without being mislabeled as a scientific result.</p></div>
          <div className="border border-amber-900/60 bg-amber-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">Evidence by type</p><p className="mt-3 text-sm leading-6 text-zinc-400">Manuscripts, artifacts, participant testimony, and experiments answer different questions and retain different uncertainty.</p></div>
          <div className="border border-rose-900/60 bg-rose-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No metaphysical certification</p><p className="mt-3 text-sm leading-6 text-zinc-400">Mathematics can model transmission or test measurable outcomes. It cannot prove revelation, divine agency, liberation, or sacred worth.</p></div>
        </section>

        <section className="mt-14 border border-teal-800/60 bg-teal-950/10 p-7">
          <p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Focused source dossier</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl"><h2 className="text-3xl font-semibold text-white">Māyōṉ in early Tamil literature</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Begin with the Tolkāppiyam and Paripāṭal, then follow separately typed connections to Tirumāl, Vishnu, Krishna, Balarama, Cēyōṉ, Vēntaṉ, and Varuṇaṉ.</p></div>
            <Link href={MAYON_KNOWLEDGE_PATH} className="font-mono text-[10px] uppercase tracking-widest text-teal-300 hover:text-white">Open the dossier →</Link>
          </div>
        </section>

        <section className="mt-14 border-t border-zinc-800 pt-9">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Opening comparison corpus</p><h2 className="mt-3 text-3xl font-semibold text-white">Compare methods before beliefs</h2></div><Link href={RELIGION_COMPARISONS_PATH} className="font-mono text-[10px] uppercase tracking-widest text-teal-300 hover:text-white">Inspect {RELIGION_COMPARISONS.length} comparisons →</Link></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {RELIGION_COMPARISONS.slice(0, 4).map((item) => <Link key={item.id} href={`${RELIGION_COMPARISONS_PATH}/${item.slug}`} className="group border border-zinc-800 p-5 hover:border-teal-600/60"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">Bounded comparison</p><h3 className="mt-3 text-lg font-semibold text-white group-hover:text-teal-200">{item.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{item.question}</p></Link>)}
          </div>
        </section>

        {RELIGION_CATEGORIES.map((category) => {
          const concepts = RELIGION_CONCEPTS.filter((item) => item.category === category)
          return <section key={category} className="mt-14 border-t border-zinc-800 pt-8"><div className="flex items-baseline justify-between gap-4"><h2 className="text-2xl font-semibold text-white">{category}</h2><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">{concepts.length} concepts</p></div><div className="mt-6 grid gap-4 md:grid-cols-2">{concepts.map((item) => { const bridgeCount = RELIGION_MATHEMATICS_BRIDGES.filter((bridge) => bridge.religionConceptId === item.id).length; return <Link key={item.id} href={religionConceptPath(item)} className="group border border-zinc-800 p-5 transition-colors hover:border-teal-600/60"><div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest"><span className="text-teal-300">Method contract</span><span className="text-zinc-600">{bridgeCount} math {bridgeCount === 1 ? 'bridge' : 'bridges'}</span></div><h3 className="mt-3 text-lg font-semibold text-white group-hover:text-teal-200">{item.name}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-zinc-600 group-hover:text-teal-300">Inspect evidence and limits →</p></Link>})}</div></section>
        })}

        <section className="mt-14 border-t border-zinc-800 pt-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold text-white">Machine-readable methodology</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">The registry publishes every concept, comparison, source boundary, and mathematical bridge without participant data or claims about individual belief.</p></div><a href={RELIGION_REGISTRY_PATH} className="border border-teal-700 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-teal-300 hover:bg-teal-300 hover:text-black">Open JSON registry →</a></div></section>
      </div>
    </main>
  )
}
