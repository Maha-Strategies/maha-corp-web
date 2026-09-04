import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SITE_URL } from '@/lib/briefs-data'
import { MAYON_CLAIMS, MAYON_KNOWLEDGE_DATE, MAYON_KNOWLEDGE_PATH, MAYON_SOURCES } from '@/lib/mayon-knowledge'
import {
  MAYON_ANSWER_ENTRIES,
  MAYON_TOPIC_QUALITY,
  MAYON_TOPICS,
  getMayonConnection,
  getMayonModernBridge,
  getMayonTopic,
  mayonTopicPath,
} from '@/lib/mayon-topics'
import { RELIGION_KNOWLEDGE_PATH } from '@/lib/religion-knowledge'

type PageProps = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return MAYON_TOPICS.map((topic) => ({ slug: topic.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const topic = getMayonTopic((await params).slug)
  if (!topic) return {}
  const path = mayonTopicPath(topic)
  return {
    metadataBase: new URL(SITE_URL),
    title: `${topic.title} | Māyōṉ Source Guide`,
    description: topic.description,
    alternates: { canonical: path },
    openGraph: { type: 'article', title: topic.title, description: topic.description, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies' },
  }
}

const answerClassLabels = {
  'direct-attestation': 'Direct textual attestation',
  'source-bound-interpretation': 'Source-bound interpretation',
  'disputed-or-ambiguous': 'Disputed or ambiguous',
  'not-established': 'Not established',
  'modern-disambiguation': 'Modern disambiguation',
} as const

export default async function MayonTopicPage({ params }: PageProps) {
  const topic = getMayonTopic((await params).slug)
  if (!topic) notFound()
  const quality = MAYON_TOPIC_QUALITY.find((candidate) => candidate.topicSlug === topic.slug)
  if (!quality?.eligible) notFound()
  const path = mayonTopicPath(topic)
  const claims = topic.claimIds.map((id) => MAYON_CLAIMS.find((claim) => claim.id === id)).filter((claim) => claim !== undefined)
  const sourceIds = [...new Set(claims.flatMap((claim) => claim.sourceIds))]
  const sources = sourceIds
    .map((id) => MAYON_SOURCES.find((source) => source.id === id))
    .filter((source): source is NonNullable<typeof source> => source !== undefined && source.contentInspected && source.explanatoryEligible)
  const bibliographicSources = (topic.bibliographicSourceIds ?? [])
    .map((id) => MAYON_SOURCES.find((source) => source.id === id))
    .filter((source): source is NonNullable<typeof source> => source !== undefined && source.frame === 'bibliographic-record')
  const connections = topic.connectionNames.map(getMayonConnection).filter((connection) => connection !== undefined)
  const modernBridges = (topic.modernBridgePaths ?? []).map(getMayonModernBridge).filter((bridge) => bridge !== undefined)
  const related = topic.relatedSlugs.map(getMayonTopic).filter((candidate) => candidate !== undefined)
  const topicAnswers = MAYON_ANSWER_ENTRIES.filter((entry) => entry.topicSlug === topic.slug)
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ScholarlyArticle',
      headline: topic.title,
      description: topic.description,
      datePublished: MAYON_KNOWLEDGE_DATE,
      dateModified: MAYON_KNOWLEDGE_DATE,
      mainEntityOfPage: `${SITE_URL}${path}`,
      isPartOf: `${SITE_URL}${MAYON_KNOWLEDGE_PATH}`,
      citation: sources.map((source) => source.url),
      about: topic.keywords,
      articleSection: ['Direct answer', 'Evidence record', 'Bounded comparison', 'Limitations', 'Unresolved questions', 'Related topics'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: topicAnswers.map((entry) => ({ '@type': 'Question', name: entry.question, acceptedAnswer: { '@type': 'Answer', text: entry.answer } })),
    },
  ]

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-teal-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span>
          <Link href={RELIGION_KNOWLEDGE_PATH} className="hover:text-white">Religion</Link><span className="px-2">/</span>
          <Link href={MAYON_KNOWLEDGE_PATH} className="hover:text-white">Māyōṉ</Link><span className="px-2">/</span>
          <span className="text-zinc-400">{topic.shortTitle}</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em]">
            <span className="text-teal-300">{answerClassLabels[topic.answerClass]}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">{quality.claimCoverage} source-bound claims · {quality.informationDimensions} dimensions</span>
          </div>
          <h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{topic.title}</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{topic.description}</p>
        </header>

        <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_330px]">
          <article>
            <section className="border-l-2 border-teal-500 bg-teal-950/10 p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Direct answer</p>
              <h2 className="mt-3 text-xl font-semibold text-white">{topic.question}</h2>
              <p className="mt-4 font-serif text-lg leading-8 text-zinc-200">{topic.directAnswer}</p>
            </section>

            <section className="mt-14">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Claim-level provenance</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Evidence record</h2>
              <div className="mt-7 space-y-6">
                {claims.map((claim, index) => (
                  <section key={claim.id} id={claim.id} className="scroll-mt-24 border border-zinc-800 bg-zinc-950/50 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest">
                      <span className="text-teal-300">Claim {index + 1} · {claim.frame.replaceAll('-', ' ')}</span>
                      <span className="text-zinc-600">{claim.id}</span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">{claim.heading}</h3>
                    <p className="mt-4 text-sm leading-7 text-zinc-300">{claim.statement}</p>
                    <p className="mt-5 border-l border-amber-700/70 pl-4 text-xs leading-6 text-amber-100/70"><span className="text-amber-300">Limit:</span> {claim.limitation}</p>
                    <div className="mt-5 border-t border-zinc-800 pt-4">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Exact locator</p>
                      <div className="mt-3 space-y-2">
                        {claim.sourceIds.map((sourceId) => {
                          const source = MAYON_SOURCES.find((candidate) => candidate.id === sourceId)
                          return source ? <p key={sourceId} className="text-xs leading-5 text-zinc-400"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-teal-300 underline decoration-teal-900 underline-offset-4 hover:text-white">{source.title}</a><span className="text-zinc-600"> · </span>{claim.sourceLocators[sourceId]}</p> : null
                        })}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </section>

            <section className="mt-14 border-y border-zinc-800 py-9">
              <p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Bounded comparison</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="border border-sky-900/50 bg-sky-950/10 p-5"><p className="text-xs text-sky-300">A</p><h3 className="mt-2 text-lg font-semibold text-white">{topic.comparison.left}</h3></div>
                <div className="border border-violet-900/50 bg-violet-950/10 p-5"><p className="text-xs text-violet-300">B</p><h3 className="mt-2 text-lg font-semibold text-white">{topic.comparison.right}</h3></div>
              </div>
              <p className="mt-5 text-sm leading-7 text-zinc-300">{topic.comparison.finding}</p>
              <p className="mt-4 border-l border-rose-700/60 pl-4 text-sm leading-6 text-zinc-400"><span className="text-rose-300">Do not infer:</span> {topic.comparison.boundary}</p>
            </section>

            {connections.length > 0 && <section className="mt-14">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">Typed historical graph</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Connected gods and concepts</h2>
              <div className="mt-7 grid gap-4 md:grid-cols-2">{connections.map((connection) => <div key={connection.name} className="border border-violet-900/50 bg-violet-950/10 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">{connection.relationship.replaceAll('-', ' ')}</p><h3 className="mt-3 text-lg font-semibold text-white">{connection.name}{connection.tamil ? ` · ${connection.tamil}` : ''}</h3><p className="mt-3 text-sm leading-6 text-zinc-400">{connection.basis}</p><p className="mt-3 text-xs leading-5 text-amber-100/70"><span className="text-amber-300">Boundary:</span> {connection.boundary}</p></div>)}</div>
            </section>}

            {modernBridges.length > 0 && <section className="mt-14 border border-sky-900/60 bg-sky-950/10 p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Modern namesake layer</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Mayon Volcano and Maha’s modern products</h2>
              <div className="mt-6 space-y-5">{modernBridges.map((bridge) => <div key={bridge.path}><Link href={bridge.path} className="text-base font-semibold text-white underline decoration-sky-800 underline-offset-4 hover:text-sky-200">{bridge.name}</Link><p className="mt-2 text-sm leading-6 text-zinc-400">{bridge.basis}</p><p className="mt-2 text-xs leading-5 text-amber-100/70">{bridge.boundary}</p></div>)}</div>
            </section>}

            <div className="mt-14 grid gap-10 md:grid-cols-2">
              <section><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Limitations</p><ul className="mt-5 space-y-3">{topic.limitations.map((limitation) => <li key={limitation} className="border-l border-rose-800/60 pl-4 text-sm leading-6 text-zinc-400">{limitation}</li>)}</ul></section>
              <section><p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Unresolved questions</p><ul className="mt-5 space-y-3">{topic.unresolvedQuestions.map((question) => <li key={question} className="border-l border-amber-800/60 pl-4 text-sm leading-6 text-zinc-400">{question}</li>)}</ul></section>
            </div>

            <section className="mt-14 border-t border-zinc-800 pt-9">
              <p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Generative-answer coverage</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Questions this guide answers</h2>
              <ul className="mt-5 space-y-3">{topicAnswers.map((entry) => <li key={entry.id} className="border-l border-teal-800/60 pl-4 text-sm leading-6 text-zinc-400">{entry.question}</li>)}</ul>
              <p className="mt-5 text-xs leading-5 text-zinc-600">All five phrasings resolve to the same source-bound answer contract for this topic. A wording variant cannot widen its evidence.</p>
            </section>

            <section className="mt-14 border-t border-zinc-800 pt-9">
              <h2 className="text-2xl font-semibold text-white">Inspected sources used on this page</h2>
              <ol className="mt-6 space-y-5">{sources.map((source) => <li key={source.id} className="border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a><span className="text-zinc-600"> · {source.publisher}</span><p className="mt-2 text-xs text-zinc-500"><span className="text-zinc-300">Inspected:</span> {source.inspectedLocator}</p><p className="mt-2 text-xs text-amber-100/70"><span className="text-amber-300">Boundary:</span> {source.boundary}</p></li>)}</ol>
              {bibliographicSources.length > 0 && <div className="mt-8 border border-zinc-800 p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Bibliographic controls · not explanatory evidence</p>{bibliographicSources.map((source) => <p key={source.id} className="mt-3 text-xs leading-5 text-zinc-500"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline underline-offset-4">{source.title}</a> records catalogue and edition metadata only.</p>)}</div>}
            </section>
          </article>

          <aside className="space-y-8">
            <div className="border border-zinc-800 bg-zinc-950/60 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Page contract</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-zinc-600">Answer class</dt><dd className="mt-1 text-zinc-300">{answerClassLabels[topic.answerClass]}</dd></div><div><dt className="text-zinc-600">Claim coverage</dt><dd className="mt-1 text-zinc-300">{quality.claimCoverage} / {topic.claimIds.length}</dd></div><div><dt className="text-zinc-600">Inspected sources</dt><dd className="mt-1 text-zinc-300">{sources.length}</dd></div><div><dt className="text-zinc-600">Information dimensions</dt><dd className="mt-1 text-zinc-300">{quality.informationDimensions} / 9</dd></div></dl></div>
            <div className="border border-rose-900/50 bg-rose-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Frame rule</p><p className="mt-3 text-sm leading-6 text-zinc-400">Primary text establishes wording in a located passage. Scholarship may interpret relationships. A catalogue can reconcile editions. None inherits the authority of another.</p></div>
            <div className="border border-teal-900/50 bg-teal-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Machine-readable answer</p><p className="mt-3 text-sm leading-6 text-zinc-400">This page’s direct answer, claim IDs, locators, limitations, and related routes are available in the public Māyōṉ answer registry.</p><Link href="/knowledge/religion/mayon/registry" className="mt-4 inline-block text-xs text-teal-300 underline underline-offset-4 hover:text-white">Open JSON registry →</Link></div>
          </aside>
        </div>

        <section className="mt-16 border-t border-zinc-800 pt-10"><h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Related Māyōṉ topics</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map((candidate) => <Link key={candidate.slug} href={mayonTopicPath(candidate)} className="border border-zinc-800 p-5 hover:border-teal-500/50"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{answerClassLabels[candidate.answerClass]}</p><p className="mt-3 text-sm font-semibold text-white">{candidate.shortTitle}</p></Link>)}</div></section>
      </div>
    </main>
  )
}
