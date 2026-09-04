import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SITE_URL } from '@/lib/briefs-data'
import {
  TAMIL_SOURCE_ATLAS_DATE,
  TAMIL_SOURCE_ATLAS_PATH,
  TAMIL_SOURCE_ATLAS_REGISTRY_PATH,
  TAMIL_SOURCE_ATLAS_TOPICS,
  getTamilSourceAtlasAnswers,
  getTamilSourceAtlasTopic,
  tamilSourceAtlasTopicPath,
} from '@/lib/tamil-source-atlas'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return TAMIL_SOURCE_ATLAS_TOPICS.map((topic) => ({ slug: topic.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const topic = getTamilSourceAtlasTopic((await params).slug)
  if (!topic) return {}
  const path = tamilSourceAtlasTopicPath(topic)
  return {
    metadataBase: new URL(SITE_URL),
    title: `${topic.title} | Tamil Religion Source Atlas`,
    description: topic.directAnswer,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: topic.title, description: topic.directAnswer, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies' },
  }
}

const categoryLabel = {
  'paripatal-passage': 'Paripāṭal passage guide',
  'landscape-relationship': 'Landscape relationship map',
  'divine-name-map': 'Divine epithet map',
  'reception-lineage': 'Reception lineage',
} as const

export default async function TamilSourceAtlasTopicPage({ params }: PageProps) {
  const topic = getTamilSourceAtlasTopic((await params).slug)
  if (!topic) notFound()
  const path = tamilSourceAtlasTopicPath(topic)
  const answers = getTamilSourceAtlasAnswers(topic.slug)
  const related = topic.relatedSlugs.map(getTamilSourceAtlasTopic).filter((candidate) => candidate !== undefined)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: topic.title,
    description: topic.directAnswer,
    datePublished: TAMIL_SOURCE_ATLAS_DATE,
    dateModified: TAMIL_SOURCE_ATLAS_DATE,
    mainEntityOfPage: `${SITE_URL}${path}`,
    isPartOf: `${SITE_URL}${TAMIL_SOURCE_ATLAS_PATH}`,
    citation: topic.evidence.map((item) => item.url),
    about: topic.keywords,
    hasPart: { '@type': 'FAQPage', mainEntity: answers.map((answer) => ({ '@type': 'Question', name: answer.question, acceptedAnswer: { '@type': 'Answer', text: answer.answer } })) },
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-amber-300 selection:text-black sm:px-12">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/religion" className="hover:text-white">Religion</Link><span className="px-2">/</span><Link href={TAMIL_SOURCE_ATLAS_PATH} className="hover:text-white">Tamil source atlas</Link><span className="px-2">/</span><span className="text-zinc-400">{topic.shortTitle}</span></nav>

      <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">{categoryLabel[topic.category]}</p><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{topic.title}</h1><p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">{topic.directAnswer}</p></header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_320px]"><article>
        <section className="border-l-2 border-amber-500 bg-amber-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Direct answer</p><h2 className="mt-3 text-2xl font-semibold text-white">{topic.question}</h2><p className="mt-4 font-serif text-lg leading-8 text-zinc-200">{topic.directAnswer}</p></section>

        <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence layers</p><h2 className="mt-3 text-3xl font-semibold text-white">What each source can carry</h2><div className="mt-7 space-y-5">{topic.evidence.map((item) => <article key={`${item.sourceId}:${item.locator}`} className="border border-zinc-800 p-6"><p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">{item.frame.replaceAll('-', ' ')}</p><h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3><p className="mt-3 text-xs leading-5 text-zinc-500"><span className="text-zinc-300">Exact locator:</span> {item.locator}</p><p className="mt-4 text-sm leading-7 text-zinc-300"><span className="text-emerald-300">Supports:</span> {item.supports}</p><p className="mt-3 text-sm leading-7 text-zinc-500"><span className="text-rose-300">Boundary:</span> {item.boundary}</p><a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs text-amber-300 underline underline-offset-4 hover:text-white">Open source ↗</a></article>)}</div></section>

        <section className="mt-14"><h2 className="text-3xl font-semibold text-white">Distinctions the answer preserves</h2><div className="mt-7 grid gap-4 md:grid-cols-3">{topic.distinctions.map((item) => <p key={item} className="border-l border-amber-700 pl-4 text-sm leading-7 text-zinc-300">{item}</p>)}</div></section>

        <section className="mt-14"><h2 className="text-3xl font-semibold text-white">Questions this guide answers</h2><div className="mt-7 space-y-5">{answers.map((answer) => <details key={answer.id} className="border border-zinc-800 p-5"><summary className="cursor-pointer text-sm font-semibold text-zinc-100">{answer.question}</summary><p className="mt-4 text-sm leading-7 text-zinc-400">{answer.answer}</p><p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-zinc-600">{answer.id}</p></details>)}</div></section>

        <section className="mt-14 grid gap-8 md:grid-cols-2"><div><h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Limits</h2><ul className="mt-5 space-y-3">{topic.limitations.map((item) => <li key={item} className="border-l border-rose-800/60 pl-3 text-sm leading-6 text-zinc-400">{item}</li>)}</ul></div><div><h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Still unresolved</h2><ul className="mt-5 space-y-3">{topic.unresolvedQuestions.map((item) => <li key={item} className="border-l border-amber-800/60 pl-3 text-sm leading-6 text-zinc-400">{item}</li>)}</ul></div></section>
      </article>

      <aside className="space-y-7"><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence coverage</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-zinc-600">Sources</dt><dd className="mt-1 text-zinc-300">{topic.evidence.length}</dd></div><div><dt className="text-zinc-600">Bounded answers</dt><dd className="mt-1 text-zinc-300">{answers.length}</dd></div><div><dt className="text-zinc-600">Evidence status</dt><dd className="mt-1 text-zinc-300">Content inspected</dd></div><div><dt className="text-zinc-600">Expert review</dt><dd className="mt-1 text-zinc-300">Not claimed</dd></div></dl></div><div className="border border-amber-900/50 bg-amber-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Connected source graphs</p><div className="mt-4 space-y-3">{topic.bridgePaths.map((bridge) => <Link key={bridge} href={bridge} className="block text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white">{bridge.split('/').at(-1)?.replaceAll('-', ' ')} →</Link>)}</div></div><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Machine-readable</p><p className="mt-3 text-sm leading-6 text-zinc-400">The registry carries exact locators, evidence frames, bounded answers, limitations, and typed cross-cluster links.</p><a href={TAMIL_SOURCE_ATLAS_REGISTRY_PATH} className="mt-4 inline-block text-xs text-amber-300 underline underline-offset-4 hover:text-white">Open JSON registry →</a></div></aside></div>

      <section className="mt-16 border-t border-zinc-800 pt-10"><h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Related source guides</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map((candidate) => <Link key={candidate.slug} href={tamilSourceAtlasTopicPath(candidate)} className="border border-zinc-800 p-5 hover:border-amber-500/50"><p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">{categoryLabel[candidate.category]}</p><p className="mt-3 text-sm font-semibold text-white">{candidate.shortTitle}</p></Link>)}</div></section>
    </div>
  </main>
}
