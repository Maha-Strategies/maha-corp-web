import type { Metadata } from 'next'
import Link from 'next/link'
import {
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_KIND_META,
  SEMICONDUCTOR_STAGES,
  SEMICONDUCTOR_STAGE_META,
  knowledgeArticlePath,
} from '@/lib/knowledge-data'
import { SITE_URL } from '@/lib/briefs-data'
import { SEMICONDUCTOR_PROCESS_MAP_PATH, getProcessMapStepCount } from '@/lib/semiconductor-process-map'

export const metadata: Metadata = {
  title: 'Knowledge | Maha Strategies',
  description: 'A cited technical knowledge graph of semiconductor processes, materials, equipment, and concepts that supports Maha Strategies Intelligence.',
  alternates: { canonical: '/knowledge' },
  openGraph: {
    title: 'Knowledge | Maha Strategies',
    description: 'Trace complex technologies from process inputs and controls to failure modes, evidence, and strategic implications.',
    url: `${SITE_URL}/knowledge`,
    siteName: 'Maha Strategies',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies Knowledge' }],
  },
}

const kindOrder = ['domain', 'process', 'material', 'equipment', 'concept'] as const

export default function KnowledgePage() {
  const sortedArticles = [...KNOWLEDGE_ARTICLES].sort((a, b) => {
    const firstStage = Math.min(...a.stageIds.map((id) => SEMICONDUCTOR_STAGE_META[id].order))
    const secondStage = Math.min(...b.stageIds.map((id) => SEMICONDUCTOR_STAGE_META[id].order))
    return firstStage - secondStage || a.title.localeCompare(b.title)
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Maha Strategies Knowledge',
    description: metadata.description,
    url: `${SITE_URL}/knowledge`,
    hasPart: KNOWLEDGE_ARTICLES.map((article) => ({
      '@type': 'TechArticle',
      name: article.title,
      url: `${SITE_URL}${knowledgeArticlePath(article)}`,
    })),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] text-zinc-300 selection:bg-cyan-400 selection:text-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <section className="border-b border-zinc-800 px-6 py-20 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-300">[ Technical knowledge graph // v0.1 ]</p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Understand the machinery beneath the brief.</h1>
              <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">Knowledge decomposes complex industries into processes, materials, equipment, controls, and failure modes. Every technical claim carries a citation or an explicit analytical boundary; every article links back to the Intelligence decisions it supports.</p>
              <Link href={SEMICONDUCTOR_PROCESS_MAP_PATH} className="mt-8 inline-block border border-cyan-500 px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-400 hover:text-black">
                Explore the complete {getProcessMapStepCount()}-node semiconductor process map →
              </Link>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-5 font-mono text-xs leading-6 text-zinc-500">
              <p className="text-zinc-200">{KNOWLEDGE_ARTICLES.length} published nodes</p>
              <p>{SEMICONDUCTOR_STAGES.length} lifecycle stages</p>
              <p>Claim-level evidence status</p>
              <p>Bidirectional Intelligence links</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-900 px-6 py-14 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Taxonomy</p>
          <div className="mt-5 grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-2 lg:grid-cols-5">
            {kindOrder.map((kind) => {
              const meta = KNOWLEDGE_KIND_META[kind]
              const count = KNOWLEDGE_ARTICLES.filter((article) => article.kind === kind).length
              return (
                <div key={kind} className="bg-[#0a0a0c] p-5">
                  <p className="font-mono text-xs uppercase tracking-widest text-cyan-300">{meta.label} · {count}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">{meta.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[240px_1fr]">
            <aside>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Semiconductor lifecycle</p>
              <ol className="mt-5 space-y-3 border-l border-zinc-800 pl-5">
                {SEMICONDUCTOR_STAGES.map((stage) => (
                  <li key={stage}>
                    <a href={`#${stage}`} className="font-mono text-xs text-zinc-400 transition-colors hover:text-cyan-300">{String(SEMICONDUCTOR_STAGE_META[stage].order).padStart(2, '0')} · {SEMICONDUCTOR_STAGE_META[stage].label}</a>
                  </li>
                ))}
              </ol>
              <div className="mt-9 border-l-2 border-amber-500/60 pl-4 text-xs leading-5 text-zinc-500">
                Articles may span several stages. They appear at the earliest stage they materially explain.
              </div>
            </aside>

            <div className="space-y-14">
              {SEMICONDUCTOR_STAGES.map((stage) => {
                const stageOrder = SEMICONDUCTOR_STAGE_META[stage].order
                const articles = sortedArticles.filter((article) => Math.min(...article.stageIds.map((id) => SEMICONDUCTOR_STAGE_META[id].order)) === stageOrder)
                return (
                  <section key={stage} id={stage} className="scroll-mt-24">
                    <div className="flex items-baseline gap-4 border-b border-zinc-800 pb-3">
                      <span className="font-mono text-xs text-cyan-400">{String(stageOrder).padStart(2, '0')}</span>
                      <div>
                        <h2 className="text-xl font-semibold text-white">{SEMICONDUCTOR_STAGE_META[stage].label}</h2>
                        <p className="mt-1 text-sm text-zinc-500">{SEMICONDUCTOR_STAGE_META[stage].description}</p>
                      </div>
                    </div>
                    {articles.length > 0 ? (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {articles.map((article) => (
                          <Link key={article.id} href={knowledgeArticlePath(article)} className="group border border-zinc-800 bg-zinc-950/60 p-5 transition-colors hover:border-cyan-500/50">
                            <div className="flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-widest">
                              <span className="text-cyan-300">{KNOWLEDGE_KIND_META[article.kind].label}</span>
                              <span className="text-zinc-600">{article.status}</span>
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-cyan-200">{article.shortTitle}</h3>
                            <p className="mt-3 text-sm leading-6 text-zinc-500">{article.description}</p>
                            <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-cyan-400">Open technical article →</p>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-5 border border-dashed border-zinc-800 p-5 font-mono text-xs text-zinc-600">Research queue open.</div>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
