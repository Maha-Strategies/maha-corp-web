import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SITE_URL } from '@/lib/briefs-data'
import { MAYON_KNOWLEDGE_PATH } from '@/lib/mayon-knowledge'
import {
  TAMIL_CLASSICAL_CLAIMS,
  TAMIL_CLASSICAL_DATE,
  TAMIL_CLASSICAL_PATH,
  TAMIL_CLASSICAL_REGISTRY_PATH,
  TAMIL_CLASSICAL_SOURCES,
  TAMIL_CLASSICAL_TOPICS,
  getTamilClassicalAnswers,
  getTamilClassicalTopic,
  tamilClassicalTopicPath,
} from '@/lib/tamil-classical-traditions'

type PageProps = { params: Promise<{ slug: string }> }
export const dynamicParams = false // TAMIL_CLASSICAL_TOPICS are a reviewed, frozen route set.
export function generateStaticParams() { // TAMIL_CLASSICAL_TOPICS define this reviewed route family.
  return TAMIL_CLASSICAL_TOPICS.map((item) => ({ slug: item.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const item = getTamilClassicalTopic((await params).slug)
  if (!item) return {}
  const path = tamilClassicalTopicPath(item)
  return { metadataBase: new URL(SITE_URL), title: `${item.title} | Classical Tamil Religion`, description: item.description, alternates: { canonical: path }, openGraph: { type: 'article', title: item.title, description: item.description, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies' } } // TAMIL_CLASSICAL_PATH child route.
}

const answerClassLabels = { 'direct-text': 'Direct text', 'translation-bound': 'Translation-bound', 'attributed-interpretation': 'Attributed interpretation', 'passage-silence': 'Passage-level silence', 'reception-history': 'Reception history' } as const

export default async function TamilClassicalTopicPage({ params }: PageProps) {
  const item = getTamilClassicalTopic((await params).slug)
  if (!item) notFound()
  const path = tamilClassicalTopicPath(item)
  const claims = item.claimIds.map((id) => TAMIL_CLASSICAL_CLAIMS.find((candidate) => candidate.id === id)).filter((candidate) => candidate !== undefined)
  const sourceIds = [...new Set(claims.flatMap((claim) => claim.sourceIds))]
  const sources = sourceIds.map((id) => TAMIL_CLASSICAL_SOURCES.find((candidate) => candidate.id === id)).filter((candidate) => candidate !== undefined)
  const related = item.relatedSlugs.map(getTamilClassicalTopic).filter((candidate) => candidate !== undefined)
  const answers = getTamilClassicalAnswers(item.slug)
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ScholarlyArticle', headline: item.title, description: item.description,
    datePublished: TAMIL_CLASSICAL_DATE, dateModified: TAMIL_CLASSICAL_DATE, mainEntityOfPage: `${SITE_URL}${path}`, isPartOf: `${SITE_URL}${TAMIL_CLASSICAL_PATH}`,
    citation: sources.map((source) => source.url), about: item.keywords,
    hasPart: { '@type': 'FAQPage', mainEntity: answers.map((entry) => ({ '@type': 'Question', name: entry.question, acceptedAnswer: { '@type': 'Answer', text: entry.answer } })) },
  }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-teal-300 selection:text-black sm:px-12"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><div className="mx-auto max-w-6xl">
    <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge/religion" className="hover:text-white">Religion</Link><span className="px-2">/</span><Link href={TAMIL_CLASSICAL_PATH} className="hover:text-white">Classical Tamil traditions</Link><span className="px-2">/</span><span className="text-zinc-400">{item.shortTitle}</span></nav>
    <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">{answerClassLabels[item.answerClass]}</p><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{item.title}</h1><p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{item.description}</p></header>

    <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_320px]"><article>
      <section className="border-l-2 border-teal-500 bg-teal-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Direct answer</p><h2 className="mt-3 text-2xl font-semibold text-white">{item.question}</h2><p className="mt-4 font-serif text-lg leading-8 text-zinc-200">{item.directAnswer}</p></section>

      <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Claim-to-source map</p><h2 className="mt-3 text-3xl font-semibold text-white">What the inspected record supports</h2><div className="mt-7 space-y-6">{claims.map((claim) => <article key={claim.id} className="border border-zinc-800 p-6"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{claim.frame.replaceAll('-', ' ')} · {claim.id}</p><h3 className="mt-3 text-xl font-semibold text-white">{claim.heading}</h3><p className="mt-4 text-sm leading-7 text-zinc-300">{claim.statement}</p><div className="mt-5 space-y-3">{claim.sourceIds.map((sourceId) => { const source = TAMIL_CLASSICAL_SOURCES.find((candidate) => candidate.id === sourceId); return source ? <p key={sourceId} className="text-xs leading-5 text-zinc-500"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline underline-offset-4">{source.title}</a><span className="text-zinc-600"> · {claim.sourceLocators[sourceId]}</span></p> : null })}</div><p className="mt-5 border-l border-amber-700/60 pl-3 text-xs leading-5 text-amber-100/70"><span className="text-amber-300">Limit:</span> {claim.limitation}</p></article>)}</div></section>

      <section className="mt-14 grid gap-6 md:grid-cols-2"><div className="border border-teal-900/60 bg-teal-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">{item.comparison.left}</p><h2 className="mt-3 text-xl font-semibold text-white">{item.comparison.right}</h2><p className="mt-4 text-sm leading-6 text-zinc-400">{item.comparison.finding}</p></div><div className="border border-rose-900/60 bg-rose-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Do not infer</p><p className="mt-4 text-sm leading-6 text-zinc-400">{item.comparison.boundary}</p></div></section>

      <section className="mt-14 border-t border-zinc-800 pt-9"><h2 className="text-3xl font-semibold text-white">Questions this page answers</h2><div className="mt-7 space-y-5">{answers.map((entry) => <details key={entry.id} className="border border-zinc-800 p-5"><summary className="cursor-pointer text-sm font-semibold text-zinc-100">{entry.question}</summary><p className="mt-4 text-sm leading-7 text-zinc-400">{entry.answer}</p><p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-zinc-600">{entry.id} · {entry.citations.length} cited sources</p></details>)}</div></section>

      <section className="mt-14 grid gap-8 md:grid-cols-2"><div><h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Limitations</h2><ul className="mt-5 space-y-3">{item.limitations.map((value) => <li key={value} className="border-l border-rose-800/60 pl-3 text-sm leading-6 text-zinc-400">{value}</li>)}</ul></div><div><h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Still unresolved</h2><ul className="mt-5 space-y-3">{item.unresolvedQuestions.map((value) => <li key={value} className="border-l border-amber-800/60 pl-3 text-sm leading-6 text-zinc-400">{value}</li>)}</ul></div></section>
    </article><aside className="space-y-7"><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Evidence coverage</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-zinc-600">Claims</dt><dd className="mt-1 text-zinc-300">{claims.length} / {claims.length}</dd></div><div><dt className="text-zinc-600">Sources</dt><dd className="mt-1 text-zinc-300">{sources.length}</dd></div><div><dt className="text-zinc-600">Questions</dt><dd className="mt-1 text-zinc-300">{answers.length}</dd></div><div><dt className="text-zinc-600">Evidence class</dt><dd className="mt-1 text-zinc-300">{answerClassLabels[item.answerClass]}</dd></div></dl></div><div className="border border-teal-900/50 bg-teal-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Māyōṉ connections</p><div className="mt-4 space-y-3">{item.mayonSlugs.map((slug) => <Link key={slug} href={`${MAYON_KNOWLEDGE_PATH}/${slug}`} className="block text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white">{slug.replaceAll('-', ' ')} →</Link>)}</div></div><div className="border border-zinc-800 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Machine-readable answer</p><p className="mt-3 text-sm leading-6 text-zinc-400">Question variants, claim IDs, source-specific locators, frames, limits, and related paths are available in the public registry.</p><a href={TAMIL_CLASSICAL_REGISTRY_PATH} className="mt-4 inline-block text-xs text-teal-300 underline underline-offset-4 hover:text-white">Open JSON registry →</a></div></aside></div>

    <section className="mt-16 border-t border-zinc-800 pt-10"><h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Related classical Tamil guides</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map((candidate) => <Link key={candidate.slug} href={tamilClassicalTopicPath(candidate)} className="border border-zinc-800 p-5 hover:border-teal-500/50"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{answerClassLabels[candidate.answerClass]}</p><p className="mt-3 text-sm font-semibold text-white">{candidate.shortTitle}</p></Link>)}</div></section>
  </div></main>
}
