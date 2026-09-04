import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import { TAMIL_CLASSICAL_PATH } from '@/lib/tamil-classical-traditions'
import { TAMIL_SOURCE_ATLAS_PATH } from '@/lib/tamil-source-atlas'
import {
  TIRUVAYMOLI_ATLAS_ANSWERS,
  TIRUVAYMOLI_ATLAS_DATE,
  TIRUVAYMOLI_ATLAS_PATH,
  TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST,
  TIRUVAYMOLI_ATLAS_REGISTRY_PATH,
  TIRUVAYMOLI_ATLAS_SOURCES,
  TIRUVAYMOLI_ATLAS_TOPICS,
  TIRUVAYMOLI_ATLAS_VERSION,
  tiruvaymoliAtlasTopicPath,
} from '@/lib/tiruvaymoli-passage-atlas'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Tiruvāymoḻi Passage Atlas: 20 Source-Bound Guides',
  description: 'Twenty passage-led guides and one hundred bounded answers to Tiruvāymoḻi 2791–3012 in Kausalya Hart’s named translation.',
  alternates: { canonical: TIRUVAYMOLI_ATLAS_PATH },
  openGraph: { type: 'website', title: 'Tiruvāymoḻi passage atlas', description: 'Speaker, divine names, poetic structure, exact pāsuram range, evidence frame, and limits kept visible.', url: `${SITE_URL}${TIRUVAYMOLI_ATLAS_PATH}`, siteName: 'Maha Strategies' },
}

export default function TiruvaymoliAtlasPage() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Tiruvāymoḻi passage atlas', description: metadata.description,
    url: `${SITE_URL}${TIRUVAYMOLI_ATLAS_PATH}`, datePublished: TIRUVAYMOLI_ATLAS_DATE, dateModified: TIRUVAYMOLI_ATLAS_DATE,
    isPartOf: `${SITE_URL}${TAMIL_CLASSICAL_PATH}`, about: ['Tiruvāymoḻi', 'Nammāḻvār', 'Tamil bhakti', 'Tamil literature'],
    hasPart: TIRUVAYMOLI_ATLAS_TOPICS.map((item) => ({ '@type': 'ScholarlyArticle', name: item.title, url: `${SITE_URL}${tiruvaymoliAtlasTopicPath(item)}` })),
    citation: TIRUVAYMOLI_ATLAS_SOURCES.map((source) => source.url),
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-fuchsia-300 selection:text-black sm:px-12"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><div className="mx-auto max-w-6xl">
    <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/religion" className="hover:text-white">Religion</Link><span className="px-2">/</span><Link href={TAMIL_CLASSICAL_PATH} className="hover:text-white">Classical Tamil traditions</Link><span className="px-2">/</span><span className="text-zinc-400">Tiruvāymoḻi atlas</span></nav>
    <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fuchsia-300">Passage atlas · {TIRUVAYMOLI_ATLAS_VERSION}</p><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Read the unit before answering the doctrine.</h1><p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">Twenty consecutive Tiruvāymoḻi units are indexed by exact pāsuram range, speaker, names, themes, and explicit limits. The atlas reports what Kausalya Hart’s translation says; it does not present the translation as unmediated Tamil or devotional claims as externally verified facts.</p></header>

    <section className="mt-10 grid gap-4 md:grid-cols-3"><div className="border border-fuchsia-900/60 bg-fuchsia-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-fuchsia-300">{TIRUVAYMOLI_ATLAS_TOPICS.length} complete units</p><p className="mt-3 text-sm leading-6 text-zinc-400">Pāsurams 2791–3012, including the printed twelve-verse exception rather than forcing a false template.</p></div><div className="border border-amber-900/60 bg-amber-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">{TIRUVAYMOLI_ATLAS_ANSWERS.length} bounded answers</p><p className="mt-3 text-sm leading-6 text-zinc-400">Each answer retains passage range, evidence frame, source link, and non-inference.</p></div><div className="border border-rose-900/60 bg-rose-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">Named translation</p><p className="mt-3 text-sm leading-6 text-zinc-400">No answer silently converts translated wording into a critical Tamil reading or a universal doctrine.</p></div></section>

    <section className="mt-8 border border-amber-900/60 bg-amber-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Earlier Tamil sources and reception</p><p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400">Follow Māyan, Māl, Kaṇṇan, Nārāyaṇa, and Neṭumāl into occurrence-level maps and compare later devotional language with Paripāṭal and the Tolkāppiyam without claiming unchanged descent.</p><Link href={TAMIL_SOURCE_ATLAS_PATH} className="mt-4 inline-block text-xs text-amber-300 underline underline-offset-4 hover:text-white">Open the cross-corpus atlas →</Link></section>

    <section className="mt-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Passage-led guides</p><h2 className="mt-3 text-3xl font-semibold text-white">Twenty bounded units</h2></div><a href={TIRUVAYMOLI_ATLAS_REGISTRY_PATH} className="border border-fuchsia-700 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-fuchsia-300 hover:bg-fuchsia-300 hover:text-black">Open answer registry →</a></div><div className="mt-7 grid gap-5 md:grid-cols-2">{TIRUVAYMOLI_ATLAS_TOPICS.map((item) => <Link key={item.slug} href={tiruvaymoliAtlasTopicPath(item)} className="group border border-zinc-800 p-6 hover:border-fuchsia-600/60"><div className="flex items-center justify-between gap-4"><p className="font-mono text-[9px] uppercase tracking-widest text-fuchsia-300">Pāsurams {item.range}</p><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">5 questions</p></div><h3 className="mt-3 text-xl font-semibold text-white group-hover:text-fuchsia-200">{item.title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{item.directAnswer}</p><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-zinc-600 group-hover:text-fuchsia-300">{item.names.length} indexed names · {item.observations.length} observations →</p></Link>)}</div></section>

    <section className="mt-16 border-t border-zinc-800 pt-10"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence contract</p><h2 className="mt-3 text-3xl font-semibold text-white">Translation and scholarship remain separate</h2><div className="mt-7 grid gap-5 lg:grid-cols-2">{TIRUVAYMOLI_ATLAS_SOURCES.map((source) => <article key={source.id} className="border border-zinc-800 p-6"><p className="font-mono text-[9px] uppercase tracking-widest text-fuchsia-300">{source.frame.replaceAll('-', ' ')}</p><h3 className="mt-3 text-xl font-semibold text-white">{source.title}</h3><p className="mt-3 text-xs leading-5 text-zinc-500"><span className="text-zinc-300">Inspected:</span> {source.inspectedLocator}</p><p className="mt-5 text-sm leading-6 text-zinc-400"><span className="text-fuchsia-300">Establishes:</span> {source.establishes}</p><p className="mt-4 text-sm leading-6 text-zinc-400"><span className="text-amber-300">Boundary:</span> {source.boundary}</p><a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-xs text-zinc-400 underline underline-offset-4 hover:text-white">Open source ↗</a></article>)}</div></section>

    <section className="mt-14 border border-zinc-800 p-6"><div className="grid gap-6 sm:grid-cols-3"><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Passage pages</p><p className="mt-2 text-2xl font-semibold text-white">{TIRUVAYMOLI_ATLAS_TOPICS.length}</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Answer entries</p><p className="mt-2 text-2xl font-semibold text-white">{TIRUVAYMOLI_ATLAS_ANSWERS.length}</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Registry digest</p><p className="mt-2 break-all font-mono text-xs text-zinc-400">{TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST}</p></div></div></section>
  </div></main>
}
