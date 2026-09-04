import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import { MAYON_KNOWLEDGE_PATH } from '@/lib/mayon-knowledge'
import {
  TAMIL_CLASSICAL_ANSWERS,
  TAMIL_CLASSICAL_CLAIMS,
  TAMIL_CLASSICAL_DATE,
  TAMIL_CLASSICAL_PATH,
  TAMIL_CLASSICAL_REGISTRY_DIGEST,
  TAMIL_CLASSICAL_REGISTRY_PATH,
  TAMIL_CLASSICAL_SOURCES,
  TAMIL_CLASSICAL_TOPICS,
  TAMIL_CLASSICAL_VERSION,
  tamilClassicalTopicPath,
} from '@/lib/tamil-classical-traditions'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Classical Tamil Religion: Landscape Deities, Paripāṭal, and Āḻvār Reception',
  description: 'A source-bound guide to Sangam landscape deities, Paripāṭal, Tamil divine epithets, the Āḻvārs, and later reception, with primary text, translation, commentary, and scholarship kept separate.',
  alternates: { canonical: TAMIL_CLASSICAL_PATH },
  openGraph: { type: 'website', title: 'Classical Tamil religion and reception', description: 'Sixteen source-bound guides and eighty bounded answers across early Tamil poetics and later devotional reception.', url: `${SITE_URL}${TAMIL_CLASSICAL_PATH}`, siteName: 'Maha Strategies' },
}

const frameLabels = {
  'primary-text': 'Primary Tamil text',
  'primary-text-in-translation': 'Named English translation',
  'scholarly-interpretation': 'Attributed scholarship',
} as const

export default function TamilClassicalTraditionsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Classical Tamil religion and reception',
    description: metadata.description,
    url: `${SITE_URL}${TAMIL_CLASSICAL_PATH}`,
    datePublished: TAMIL_CLASSICAL_DATE,
    dateModified: TAMIL_CLASSICAL_DATE,
    isPartOf: `${SITE_URL}/knowledge/religion`,
    about: ['Tamil religion', 'Sangam literature', 'Paripāṭal', 'Āḻvārs', 'Tamil bhakti'],
    hasPart: TAMIL_CLASSICAL_TOPICS.map((item) => ({ '@type': 'ScholarlyArticle', name: item.title, url: `${SITE_URL}${tamilClassicalTopicPath(item)}` })),
    citation: TAMIL_CLASSICAL_SOURCES.map((source) => source.url),
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-teal-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><Link href="/knowledge/religion" className="hover:text-white">Religion</Link><span className="px-2">/</span><span className="text-zinc-400">Classical Tamil traditions</span></nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-300">Source-bound cluster · {TAMIL_CLASSICAL_VERSION}</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">From landscape poetics to devotional reception—without collapsing the layers.</h1>
          <p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">This cluster begins with the Tolkāppiyam’s landscape-deity stanza, opens the Paripāṭal as an anthology with subjects and music metadata, follows Tamil divine names occurrence by occurrence, and then studies the later Āḻvār corpus. Primary wording, translation, commentary, and scholarly history remain visibly different kinds of evidence.</p>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="border border-teal-900/60 bg-teal-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{TAMIL_CLASSICAL_TOPICS.length} topic guides</p><p className="mt-3 text-sm leading-6 text-zinc-400">Tiṇai, named landscape deities, Paripāṭal, divine epithets, Āḻvārs, and reception history.</p></div>
          <div className="border border-amber-900/60 bg-amber-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">{TAMIL_CLASSICAL_ANSWERS.length} bounded answers</p><p className="mt-3 text-sm leading-6 text-zinc-400">Each answer carries claim IDs, source-specific locators, limitations, and an explicit non-inference.</p></div>
          <div className="border border-rose-900/60 bg-rose-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">No identity shortcut</p><p className="mt-3 text-sm leading-6 text-zinc-400">A recurring name or literary form does not prove an unchanged deity, cult, institution, or theology.</p></div>
        </section>

        <section className="mt-14 border border-teal-800/60 bg-teal-950/10 p-7">
          <p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Connected foundational dossier</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5"><div className="max-w-3xl"><h2 className="text-3xl font-semibold text-white">Māyōṉ in early Tamil literature</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Use the Māyōṉ cluster for the focused questions about mullai, Tirumāl, Vishnu, Krishna, Vāliyoṉ, Cēyōṉ, and the strict Mayon Volcano disambiguation.</p></div><Link href={MAYON_KNOWLEDGE_PATH} className="font-mono text-[10px] uppercase tracking-widest text-teal-300 hover:text-white">Open Māyōṉ dossier →</Link></div>
        </section>

        <section className="mt-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Question-led guides</p><h2 className="mt-3 text-3xl font-semibold text-white">Explore the source graph</h2></div><a href={TAMIL_CLASSICAL_REGISTRY_PATH} className="border border-teal-700 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-teal-300 hover:bg-teal-300 hover:text-black">Open answer registry →</a></div>
          <div className="mt-7 grid gap-5 md:grid-cols-2">{TAMIL_CLASSICAL_TOPICS.map((item) => <Link key={item.slug} href={tamilClassicalTopicPath(item)} className="group border border-zinc-800 p-6 hover:border-teal-600/60"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{item.answerClass.replaceAll('-', ' ')}</p><h3 className="mt-3 text-xl font-semibold text-white group-hover:text-teal-200">{item.title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{item.description}</p><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-zinc-600 group-hover:text-teal-300">5 questions · {item.claimIds.length} claims →</p></Link>)}</div>
        </section>

        <section className="mt-16 border-t border-zinc-800 pt-10"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence architecture</p><h2 className="mt-3 text-3xl font-semibold text-white">Five inspected sources, three authority frames</h2><div className="mt-7 space-y-5">{TAMIL_CLASSICAL_SOURCES.map((source) => <article key={source.id} className="border border-zinc-800 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{frameLabels[source.frame]}</p><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 underline underline-offset-4 hover:text-white">Open source ↗</a></div><h3 className="mt-3 text-lg font-semibold text-white">{source.title}</h3><p className="mt-3 text-xs leading-5 text-zinc-500"><span className="text-zinc-300">Inspected:</span> {source.inspectedLocator}</p><div className="mt-5 grid gap-5 md:grid-cols-2"><p className="text-sm leading-6 text-zinc-400"><span className="text-teal-300">Establishes:</span> {source.establishes}</p><p className="text-sm leading-6 text-zinc-400"><span className="text-amber-300">Boundary:</span> {source.boundary}</p></div></article>)}</div></section>

        <section className="mt-14 border border-zinc-800 p-6"><div className="grid gap-6 sm:grid-cols-3"><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Claims</p><p className="mt-2 text-2xl font-semibold text-white">{TAMIL_CLASSICAL_CLAIMS.length}</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Answer entries</p><p className="mt-2 text-2xl font-semibold text-white">{TAMIL_CLASSICAL_ANSWERS.length}</p></div><div><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Registry digest</p><p className="mt-2 break-all font-mono text-xs text-zinc-400">{TAMIL_CLASSICAL_REGISTRY_DIGEST}</p></div></div></section>
      </div>
    </main>
  )
}
