import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  ASTROLOGY_ANSWER_GRAPH_DATE,
  ASTROLOGY_ANSWER_GRAPH_PATH,
  ASTROLOGY_ANSWER_GRAPH_REGISTRY_PATH,
  ASTROLOGY_ANSWERS,
  astrologyAnswerPath,
  getAstrologyAnswer,
  getAstrologyAnswerAuthorities,
} from '@/lib/astrology-answer-graph'
import { ASTROLOGY_PATH } from '@/lib/astrology-traditions'
import { SITE_URL } from '@/lib/briefs-data'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false
export function generateStaticParams() { return ASTROLOGY_ANSWERS.map((answer) => ({ slug: answer.slug })) }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const answer = getAstrologyAnswer((await params).slug)
  if (!answer) return {}
  const path = astrologyAnswerPath(answer)
  return {
    metadataBase: new URL(SITE_URL),
    title: `${answer.question} | Maha Astrology Methods`,
    description: answer.directAnswer,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: answer.question, description: answer.directAnswer, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies' },
  }
}

export default async function AstrologyAnswerPage({ params }: PageProps) {
  const answer = getAstrologyAnswer((await params).slug)
  if (!answer) notFound()
  const path = astrologyAnswerPath(answer)
  const authorities = getAstrologyAnswerAuthorities(answer)
  const related = answer.relatedSlugs.map(getAstrologyAnswer).filter((value) => value !== undefined)
  const faq = [answer.question, ...answer.queryVariants].map((question) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer.directAnswer } }))
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'TechArticle', headline: answer.question, description: answer.directAnswer,
    datePublished: ASTROLOGY_ANSWER_GRAPH_DATE, dateModified: ASTROLOGY_ANSWER_GRAPH_DATE,
    mainEntityOfPage: `${SITE_URL}${path}`, isPartOf: `${SITE_URL}${ASTROLOGY_ANSWER_GRAPH_PATH}`, articleSection: answer.category,
    author: { '@type': 'Organization', name: 'Maha Strategies', url: SITE_URL }, publisher: { '@type': 'Organization', name: 'Maha Strategies', url: SITE_URL },
    citation: authorities.map((authority) => `${SITE_URL}${authority.path}`),
    hasPart: { '@type': 'FAQPage', mainEntity: faq },
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-violet-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href={ASTROLOGY_PATH} className="hover:text-white">Astrology</Link><span className="px-2">/</span><Link href={ASTROLOGY_ANSWER_GRAPH_PATH} className="hover:text-white">Questions</Link><span className="px-2">/</span><span className="text-zinc-400">{answer.shortTitle}</span></nav>

        <header className="mt-10 border-b border-zinc-800 pb-10"><div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="border border-violet-700/60 bg-violet-950/30 px-2 py-1 text-violet-300">{answer.category}</span><span className="text-cyan-300">{answer.frame.replaceAll('-', ' ')}</span><span className="text-rose-300">{answer.empiricalStatus.replaceAll('-', ' ')}</span></div><h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{answer.question}</h1><p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-300">{answer.directAnswer}</p></header>

        <section className="mt-10 border-l-2 border-violet-500 bg-violet-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Direct answer</p><p className="mt-4 font-serif text-lg leading-8 text-zinc-200">{answer.directAnswer}</p></section>

        <section className="mt-14"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Practical use</p><h2 className="mt-3 text-3xl font-semibold text-white">What to do with this answer</h2><p className="mt-5 max-w-4xl text-sm leading-7 text-zinc-300">{answer.practicalUse}</p></section>

        <section className="mt-14 grid gap-6 md:grid-cols-2"><div className="border border-cyan-900/60 bg-cyan-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Distinctions to preserve</p><ul className="mt-5 space-y-3">{answer.distinctions.map((item) => <li key={item} className="border-l border-cyan-800/70 pl-3 text-sm leading-6 text-zinc-300">{item}</li>)}</ul></div><div className="border border-rose-900/60 bg-rose-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Limitations</p><ul className="mt-5 space-y-3">{answer.limitations.map((item) => <li key={item} className="border-l border-rose-800/70 pl-3 text-sm leading-6 text-zinc-300">{item}</li>)}</ul></div></section>

        <section className="mt-14 border-t border-zinc-800 pt-10"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Authority graph</p><h2 className="mt-3 text-3xl font-semibold text-white">Which existing contracts carry the answer</h2><p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-500">These linked pages carry the underlying definition, method, or tradition record and its own sources. This page preserves their boundaries rather than becoming a new source of independent authority.</p><div className="mt-7 space-y-5">{authorities.map((authority) => <article key={authority.id} className="border border-zinc-800 p-6"><div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="text-violet-300">{authority.family}</span><span className="text-zinc-600">{authority.status.replaceAll('-', ' ')}</span></div><h3 className="mt-3 text-xl font-semibold text-white"><Link href={authority.path} className="hover:text-violet-200">{authority.title} →</Link></h3><p className="mt-4 text-sm leading-7 text-zinc-300"><span className="text-cyan-300">Establishes:</span> {authority.establishes}</p><p className="mt-3 text-sm leading-7 text-zinc-500"><span className="text-amber-300">Boundary:</span> {authority.boundary}</p></article>)}</div></section>

        <section className="mt-14"><h2 className="text-3xl font-semibold text-white">Equivalent questions</h2><p className="mt-3 text-sm leading-6 text-zinc-500">These query forms resolve to this same answer identity; they are not separate claims.</p><ul className="mt-6 grid gap-3 sm:grid-cols-2">{answer.queryVariants.map((question) => <li key={question} className="border border-zinc-800 p-4 text-sm leading-6 text-zinc-300">{question}</li>)}</ul></section>

        <section className="mt-14 border-l-2 border-rose-500 bg-rose-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Non-claim</p><p className="mt-4 text-sm leading-7 text-zinc-200">This answer is a method or tradition description. It is not a personalized reading and does not certify predictive validity, causation, medical outcomes, legal status, investment value, or guaranteed events.</p></section>

        <section className="mt-14 border-t border-zinc-800 pt-10"><h2 className="text-2xl font-semibold text-white">Related bounded answers</h2><div className="mt-6 grid gap-4 md:grid-cols-3">{related.map((item) => <Link key={item.slug} href={astrologyAnswerPath(item)} className="border border-zinc-800 p-5 hover:border-violet-500/60"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">{item.category}</p><p className="mt-3 text-sm font-semibold text-white">{item.question}</p></Link>)}</div></section>

        <section className="mt-10 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest"><Link href={ASTROLOGY_ANSWER_GRAPH_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-300 hover:border-violet-500 hover:text-violet-200">All questions</Link><a href={ASTROLOGY_ANSWER_GRAPH_REGISTRY_PATH} className="border border-zinc-700 px-4 py-3 text-zinc-300 hover:border-violet-500 hover:text-violet-200">Machine registry</a></section>
      </article>
    </main>
  )
}
