import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import {
  TAMIL_SOURCE_ATLAS_ANSWERS,
  TAMIL_SOURCE_ATLAS_DATE,
  TAMIL_SOURCE_ATLAS_PATH,
  TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST,
  TAMIL_SOURCE_ATLAS_REGISTRY_PATH,
  TAMIL_SOURCE_ATLAS_TOPICS,
  TAMIL_SOURCE_ATLAS_VERSION,
  tamilSourceAtlasTopicPath,
} from '@/lib/tamil-source-atlas'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Tamil Religion Source Atlas: Paripāṭal, Tiṇai, Divine Names, and Reception',
  description: 'Forty-eight source-led guides that keep Tamil primary text, named translation, commentary, historical inference, and theology separate.',
  alternates: { canonical: TAMIL_SOURCE_ATLAS_PATH },
  openGraph: { type: 'website', title: 'Tamil religion source atlas', description: 'Passage, landscape, divine-name, and reception questions answered from inspected sources with exact locators.', url: `${SITE_URL}${TAMIL_SOURCE_ATLAS_PATH}`, siteName: 'Maha Strategies' },
}

const categoryDetails = [
  { id: 'paripatal-passage', title: 'Paripāṭal passage guides', description: 'Twenty line-bounded guides. The Tamil edition supplies structure and wording; English semantic descriptions remain attributed.' },
  { id: 'landscape-relationship', title: 'Sangam landscape relationships', description: 'Twelve comparisons derived from one inspected fourfold stanza without converting literary association into genealogy or territory.' },
  { id: 'divine-name-map', title: 'Divine epithet maps', description: 'Eight occurrence-led identity maps that preserve the form, source, translator, and uncertainty behind each name.' },
  { id: 'reception-lineage', title: 'Māyōṉ-to-Āḻvār reception', description: 'Eight typed cross-period relations that separate shared names and forms from claims of direct descent.' },
] as const

export default function TamilSourceAtlasPage() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Tamil religion source atlas', description: metadata.description,
    url: `${SITE_URL}${TAMIL_SOURCE_ATLAS_PATH}`, datePublished: TAMIL_SOURCE_ATLAS_DATE, dateModified: TAMIL_SOURCE_ATLAS_DATE,
    about: ['Paripāṭal', 'Māyōṉ', 'Tamil religion', 'tiṇai', 'Āḻvār reception'],
    hasPart: TAMIL_SOURCE_ATLAS_TOPICS.map((topic) => ({ '@type': 'ScholarlyArticle', name: topic.title, url: `${SITE_URL}${tamilSourceAtlasTopicPath(topic)}` })),
    citation: [...new Set(TAMIL_SOURCE_ATLAS_TOPICS.flatMap((topic) => topic.evidence.map((item) => item.url)))],
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-amber-300 selection:text-black sm:px-12">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/religion" className="hover:text-white">Religion</Link><span className="px-2">/</span><span className="text-zinc-400">Tamil source atlas</span></nav>
      <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">Source atlas · {TAMIL_SOURCE_ATLAS_VERSION}</p><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Ask across centuries without flattening the sources.</h1><p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">This atlas starts from exact passages and evidence roles. It connects Māyōṉ, Tirumāl, landscape deities, divine epithets, Paripāṭal, and later Āḻvār reception while preserving the difference between primary Tamil wording, named translation, commentary, scholarly interpretation, and theology.</p></header>

      <section className="mt-10 grid gap-4 md:grid-cols-3"><div className="border border-amber-900/60 bg-amber-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">{TAMIL_SOURCE_ATLAS_TOPICS.length} guides</p><p className="mt-3 text-sm leading-6 text-zinc-400">Four families selected before implementation and held to a deterministic cohort.</p></div><div className="border border-fuchsia-900/60 bg-fuchsia-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-fuchsia-300">{TAMIL_SOURCE_ATLAS_ANSWERS.length} bounded answers</p><p className="mt-3 text-sm leading-6 text-zinc-400">Each answer carries source, locator, frame, limitation, and related paths.</p></div><div className="border border-rose-900/60 bg-rose-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No silent equivalence</p><p className="mt-3 text-sm leading-6 text-zinc-400">A later identification never becomes a word in an earlier passage, and a relation never becomes direct descent by default.</p></div></section>

      {categoryDetails.map((category) => {
        const topics = TAMIL_SOURCE_ATLAS_TOPICS.filter((topic) => topic.category === category.id)
        return <section key={category.id} className="mt-14 border-t border-zinc-800 pt-9"><div className="flex flex-wrap items-end justify-between gap-5"><div className="max-w-3xl"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{topics.length} source-led guides</p><h2 className="mt-3 text-3xl font-semibold text-white">{category.title}</h2><p className="mt-3 text-sm leading-7 text-zinc-500">{category.description}</p></div>{category.id === 'paripatal-passage' && <a href={TAMIL_SOURCE_ATLAS_REGISTRY_PATH} className="border border-amber-700 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-amber-300 hover:bg-amber-300 hover:text-black">Open registry →</a>}</div><div className="mt-7 grid gap-5 md:grid-cols-2">{topics.map((topic) => <Link key={topic.slug} href={tamilSourceAtlasTopicPath(topic)} className="group border border-zinc-800 p-6 hover:border-amber-600/60"><p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">{topic.evidence.length} evidence layers · 4 questions</p><h3 className="mt-3 text-xl font-semibold text-white group-hover:text-amber-200">{topic.title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{topic.directAnswer}</p><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-zinc-600 group-hover:text-amber-300">Inspect sources and limits →</p></Link>)}</div></section>
      })}

      <section className="mt-14 border border-zinc-800 p-6"><div className="grid gap-6 sm:grid-cols-3"><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Topic pages</p><p className="mt-2 text-2xl font-semibold text-white">{TAMIL_SOURCE_ATLAS_TOPICS.length}</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Bounded answers</p><p className="mt-2 text-2xl font-semibold text-white">{TAMIL_SOURCE_ATLAS_ANSWERS.length}</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Registry digest</p><p className="mt-2 break-all font-mono text-xs text-zinc-400">{TAMIL_SOURCE_ATLAS_REGISTRY_DIGEST}</p></div></div></section>
    </div>
  </main>
}
