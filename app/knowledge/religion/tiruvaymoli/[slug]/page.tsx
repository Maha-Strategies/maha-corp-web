import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SITE_URL } from '@/lib/briefs-data'
import { MAYON_KNOWLEDGE_PATH } from '@/lib/mayon-knowledge'
import { TAMIL_CLASSICAL_PATH, getTamilClassicalTopic } from '@/lib/tamil-classical-traditions'
import {
  TIRUVAYMOLI_ATLAS_DATE,
  TIRUVAYMOLI_ATLAS_PATH,
  TIRUVAYMOLI_ATLAS_REGISTRY_PATH,
  TIRUVAYMOLI_ATLAS_SOURCES,
  TIRUVAYMOLI_ATLAS_TOPICS,
  getTiruvaymoliAtlasAnswers,
  getTiruvaymoliAtlasTopic,
  tiruvaymoliAtlasTopicPath,
} from '@/lib/tiruvaymoli-passage-atlas'

type PageProps = { params: Promise<{ slug: string }> }
export const dynamicParams = false
export function generateStaticParams() { return TIRUVAYMOLI_ATLAS_TOPICS.map((item) => ({ slug: item.slug })) }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const item = getTiruvaymoliAtlasTopic((await params).slug)
  if (!item) return {}
  const path = tiruvaymoliAtlasTopicPath(item)
  return { metadataBase: new URL(SITE_URL), title: `${item.title} | Tiruvāymoḻi Passage Atlas`, description: item.directAnswer, alternates: { canonical: path }, openGraph: { type: 'article', title: item.title, description: item.directAnswer, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies' } }
}

export default async function TiruvaymoliAtlasTopicPage({ params }: PageProps) {
  const item = getTiruvaymoliAtlasTopic((await params).slug)
  if (!item) notFound()
  const path = tiruvaymoliAtlasTopicPath(item)
  const answers = getTiruvaymoliAtlasAnswers(item.slug)
  const related = item.relatedSlugs.map(getTiruvaymoliAtlasTopic).filter((value) => value !== undefined)
  const classical = item.classicalSlugs.map(getTamilClassicalTopic).filter((value) => value !== undefined)
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ScholarlyArticle', headline: item.title, description: item.directAnswer,
    datePublished: TIRUVAYMOLI_ATLAS_DATE, dateModified: TIRUVAYMOLI_ATLAS_DATE, mainEntityOfPage: `${SITE_URL}${path}`, isPartOf: `${SITE_URL}${TIRUVAYMOLI_ATLAS_PATH}`,
    citation: TIRUVAYMOLI_ATLAS_SOURCES.map((source) => source.url), about: item.keywords,
    hasPart: { '@type': 'FAQPage', mainEntity: answers.map((entry) => ({ '@type': 'Question', name: entry.question, acceptedAnswer: { '@type': 'Answer', text: entry.answer } })) },
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-fuchsia-300 selection:text-black sm:px-12"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><div className="mx-auto max-w-6xl">
    <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/religion" className="hover:text-white">Religion</Link><span className="px-2">/</span><Link href={TIRUVAYMOLI_ATLAS_PATH} className="hover:text-white">Tiruvāymoḻi atlas</Link><span className="px-2">/</span><span className="text-zinc-400">{item.range}</span></nav>
    <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300">Named translation · pāsurams {item.range}</p><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{item.title}</h1><p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">{item.directAnswer}</p></header>

    <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_320px]"><article>
      <section className="border-l-2 border-fuchsia-500 bg-fuchsia-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300">Direct answer</p><h2 className="mt-3 text-2xl font-semibold text-white">{item.question}</h2><p className="mt-4 font-serif text-lg leading-8 text-zinc-200">{item.directAnswer}</p></section>

      <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Passage map</p><h2 className="mt-3 text-3xl font-semibold text-white">What the translated unit contains</h2><div className="mt-7 space-y-4">{item.observations.map((observation) => <p key={observation} className="border-l border-fuchsia-800/70 pl-4 text-sm leading-7 text-zinc-300">{observation}</p>)}</div></section>

      <section className="mt-14 grid gap-6 md:grid-cols-2"><div className="border border-zinc-800 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300">Poetic voice</p><p className="mt-4 text-sm leading-7 text-zinc-300">{item.voice}</p></div><div className="border border-zinc-800 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300">Indexed names</p><ul className="mt-4 flex flex-wrap gap-2">{item.names.map((name) => <li key={name} className="border border-zinc-700 px-3 py-2 text-xs text-zinc-300">{name}</li>)}</ul></div></section>

      <section className="mt-14 grid gap-6 md:grid-cols-2"><div className="border border-fuchsia-900/60 bg-fuchsia-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300">{item.comparison.left}</p><h2 className="mt-3 text-xl font-semibold text-white">{item.comparison.right}</h2><p className="mt-4 text-sm leading-6 text-zinc-400">{item.comparison.finding}</p></div><div className="border border-rose-900/60 bg-rose-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Does not establish</p><p className="mt-4 text-sm leading-6 text-zinc-400">{item.notEstablished}</p></div></section>

      <section className="mt-14"><h2 className="text-3xl font-semibold text-white">Questions this passage guide answers</h2><div className="mt-7 space-y-5">{answers.map((entry) => <details key={entry.id} className="border border-zinc-800 p-5"><summary className="cursor-pointer text-sm font-semibold text-zinc-100">{entry.question}</summary><p className="mt-4 text-sm leading-7 text-zinc-400">{entry.answer}</p><p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-zinc-600">{entry.id} · pāsurams {entry.passageRange}</p></details>)}</div></section>

      <section className="mt-14 grid gap-8 md:grid-cols-2"><div><h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Limits</h2><ul className="mt-5 space-y-3">{item.limitations.map((value) => <li key={value} className="border-l border-rose-800/60 pl-3 text-sm leading-6 text-zinc-400">{value}</li>)}</ul></div><div><h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Still unresolved</h2><ul className="mt-5 space-y-3">{item.unresolvedQuestions.map((value) => <li key={value} className="border-l border-amber-800/60 pl-3 text-sm leading-6 text-zinc-400">{value}</li>)}</ul></div></section>
    </article><aside className="space-y-7"><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence coverage</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-zinc-600">Passage</dt><dd className="mt-1 text-zinc-300">{item.range}</dd></div><div><dt className="text-zinc-600">Observations</dt><dd className="mt-1 text-zinc-300">{item.observations.length}</dd></div><div><dt className="text-zinc-600">Questions</dt><dd className="mt-1 text-zinc-300">{answers.length}</dd></div><div><dt className="text-zinc-600">Frame</dt><dd className="mt-1 text-zinc-300">Named English translation</dd></div></dl></div><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Primary source</p><a href={TIRUVAYMOLI_ATLAS_SOURCES[0].url} target="_blank" rel="noopener noreferrer" className="mt-3 block text-sm text-fuchsia-300 underline underline-offset-4 hover:text-white">Kausalya Hart translation ↗</a><p className="mt-3 text-xs leading-5 text-zinc-500">Exact locator: pāsurams {item.range}.</p></div><div className="border border-fuchsia-900/50 bg-fuchsia-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-300">Connected source graphs</p><div className="mt-4 space-y-3">{item.mayonSlugs.map((slug) => <Link key={slug} href={`${MAYON_KNOWLEDGE_PATH}/${slug}`} className="block text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white">{slug.replaceAll('-', ' ')} →</Link>)}{classical.map((value) => <Link key={value.slug} href={`${TAMIL_CLASSICAL_PATH}/${value.slug}`} className="block text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white">{value.shortTitle} →</Link>)}</div></div><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Machine-readable</p><p className="mt-3 text-sm leading-6 text-zinc-400">The public registry carries questions, source locators, range, frame, limitations, and related paths.</p><a href={TIRUVAYMOLI_ATLAS_REGISTRY_PATH} className="mt-4 inline-block text-xs text-fuchsia-300 underline underline-offset-4 hover:text-white">Open JSON registry →</a></div></aside></div>

    <section className="mt-16 border-t border-zinc-800 pt-10"><h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Related passage guides</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map((candidate) => <Link key={candidate.slug} href={tiruvaymoliAtlasTopicPath(candidate)} className="border border-zinc-800 p-5 hover:border-fuchsia-500/50"><p className="font-mono text-[9px] uppercase tracking-widest text-fuchsia-300">{candidate.range}</p><p className="mt-3 text-sm font-semibold text-white">{candidate.shortTitle}</p></Link>)}</div></section>
  </div></main>
}
