import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SITE_URL, getBriefBySlug } from '@/lib/briefs-data'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'
import {
  KNOWLEDGE_KIND_META,
  SEMICONDUCTOR_STAGE_META,
  getKnowledgeArticle,
  getKnowledgeByRoute,
  getKnowledgeRouteParams,
  getKnowledgeSource,
  knowledgeArticlePath,
  type KnowledgeEvidenceStatus,
} from '@/lib/knowledge-data'
import { SEMICONDUCTOR_PROCESS_MAP_PATH } from '@/lib/semiconductor-process-map'
import {
  getKnowledgeSupplier,
  getProcessExpansion,
  knowledgeSupplierPath,
} from '@/lib/knowledge-process-profiles'
import { getIntelligenceBriefSlugsForKnowledgeObject } from '@/lib/intelligence-knowledge-links'

type PageProps = { params: Promise<{ kind: string; slug: string }> }

export function generateStaticParams() {
  return getKnowledgeRouteParams()
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { kind, slug } = await params
  const article = getKnowledgeByRoute(kind, slug)
  if (!article) return {}
  const path = knowledgeArticlePath(article)
  return {
    metadataBase: new URL(SITE_URL),
    title: `${article.title} | Maha Knowledge`,
    description: article.description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}${path}`,
      siteName: 'Maha Strategies',
      title: article.title,
      description: article.description,
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
      images: [{ url: '/og-master.png', width: 1200, height: 630, alt: article.title }],
    },
  }
}

const evidenceMeta: Record<KnowledgeEvidenceStatus, { label: string; className: string }> = {
  'source-supported': { label: 'Source-supported', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  'method-basis': { label: 'Method basis', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' },
  'bounded-inference': { label: 'Bounded inference', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  'open-question': { label: 'Open question', className: 'border-zinc-600 bg-zinc-900 text-zinc-400' },
}

function DataList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="border-t border-zinc-800 pt-5">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-400">
        {items.map((item) => <li key={item} className="border-l border-zinc-700 pl-3">{item}</li>)}
      </ul>
    </section>
  )
}

export default async function KnowledgeArticlePage({ params }: PageProps) {
  const { kind, slug } = await params
  const article = getKnowledgeByRoute(kind, slug)
  if (!article) notFound()

  const path = knowledgeArticlePath(article)
  const sources = article.sourceIds.map(getKnowledgeSource).filter((source) => source !== undefined)
  const sourceNumbers = new Map(sources.map((source, index) => [source.id, index + 1]))
  const claims = new Map(article.claims.map((claim) => [claim.id, claim]))
  const relatedArticles = article.relatedArticleIds.map(getKnowledgeArticle).filter((item) => item !== undefined)
  const relatedBriefSlugs = [...new Set([
    ...article.intelligenceSlugs,
    ...getIntelligenceBriefSlugsForKnowledgeObject(article.id),
  ])]
  const relatedBriefs = relatedBriefSlugs.map(getBriefBySlug).filter((brief) => brief !== undefined)
  const processExpansion = getProcessExpansion(article.id)
  const suppliers = processExpansion?.supplierIds.map(getKnowledgeSupplier).filter((supplier) => supplier !== undefined) ?? []
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: article.title,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: { '@id': MAHA_ORGANIZATION_ID },
    publisher: { '@id': MAHA_ORGANIZATION_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${path}` },
    citation: sources.map((source) => source.url),
    about: article.stageIds.map((stage) => SEMICONDUCTOR_STAGE_META[stage].label),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-cyan-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link>
          <span className="px-2">/</span>
          <span>{KNOWLEDGE_KIND_META[article.kind].label}</span>
          <span className="px-2">/</span>
          <span className="text-zinc-400">{article.shortTitle}</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest">
            <span className="border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-300">{KNOWLEDGE_KIND_META[article.kind].label}</span>
            <span className="text-zinc-600">Status: {article.status}</span>
            <span className="text-zinc-700">Updated {article.dateModified}</span>
          </div>
          <h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">{article.title}</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">{article.description}</p>
          {article.id === 'domain-semiconductor-manufacturing' && (
            <Link href={SEMICONDUCTOR_PROCESS_MAP_PATH} className="mt-7 inline-block border border-cyan-500 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-cyan-300 hover:bg-cyan-400 hover:text-black">
              Open the complete process map →
            </Link>
          )}
        </header>

        <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article>
            <section className="border-l-2 border-cyan-500 bg-cyan-950/10 p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Definition</p>
              <p className="mt-3 font-serif text-lg leading-8 text-zinc-200">{article.definition}</p>
            </section>

            <section className="mt-12">
              <h2 className="text-2xl font-semibold text-white">Process position</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {article.stageIds.map((stage) => (
                  <Link key={stage} href={`/knowledge#${stage}`} className="border border-zinc-800 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-300">
                    {String(SEMICONDUCTOR_STAGE_META[stage].order).padStart(2, '0')} · {SEMICONDUCTOR_STAGE_META[stage].label}
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-12 grid gap-8 sm:grid-cols-2">
              <DataList title="Inputs" items={article.inputs} />
              <DataList title="Outputs" items={article.outputs} />
            </section>

            <section className="mt-12">
              <h2 className="text-2xl font-semibold text-white">How it works</h2>
              <ol className="mt-6 space-y-0 border-l border-zinc-800">
                {article.processSteps.map((step, index) => (
                  <li key={step} className="relative pb-6 pl-8 text-sm leading-6 text-zinc-400 before:absolute before:-left-[5px] before:top-2 before:h-2 before:w-2 before:bg-cyan-400">
                    <span className="mr-3 font-mono text-[10px] text-zinc-600">{String(index + 1).padStart(2, '0')}</span>{step}
                  </li>
                ))}
              </ol>
            </section>

            {processExpansion && (
              <section className="mt-14 border-t border-zinc-800 pt-10">
                <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Process control profile</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Materials, equipment, defects, and metrology</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">These records connect a physical input and tool module to its failure mechanism, detection method, and release decision. They complement the broader inventories in the control surface.</p>
                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  {processExpansion.materialFocus.map((item) => (
                    <div key={item.name} className="border border-zinc-800 bg-zinc-950/60 p-5">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">Material focus</p>
                      <h3 className="mt-3 font-semibold text-white">{item.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">{item.role}</p>
                      <p className="mt-4 border-l border-zinc-700 pl-3 text-xs leading-5 text-zinc-500"><span className="text-zinc-300">Control:</span> {item.control}</p>
                      <p className="mt-3 border-l border-amber-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-amber-300">Failure link:</span> {item.failureLink}</p>
                    </div>
                  ))}
                  {processExpansion.equipmentFocus.map((item) => (
                    <div key={item.name} className="border border-zinc-800 bg-zinc-950/60 p-5">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">Equipment module</p>
                      <h3 className="mt-3 font-semibold text-white">{item.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">{item.role}</p>
                      <p className="mt-4 border-l border-zinc-700 pl-3 text-xs leading-5 text-zinc-500"><span className="text-zinc-300">Control variables:</span> {item.controlVariables}</p>
                      <p className="mt-3 border-l border-amber-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-amber-300">Integration risk:</span> {item.integrationRisk}</p>
                    </div>
                  ))}
                  {processExpansion.defectFocus.map((item) => (
                    <div key={item.name} className="border border-zinc-800 bg-zinc-950/60 p-5">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-rose-300">Defect mechanism</p>
                      <h3 className="mt-3 font-semibold text-white">{item.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">{item.mechanism}</p>
                      <p className="mt-4 border-l border-zinc-700 pl-3 text-xs leading-5 text-zinc-500"><span className="text-zinc-300">Detection:</span> {item.detection}</p>
                      <p className="mt-3 border-l border-amber-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-amber-300">Downstream effect:</span> {item.downstreamEffect}</p>
                    </div>
                  ))}
                  {processExpansion.metrologyFocus.map((item) => (
                    <div key={item.name} className="border border-zinc-800 bg-zinc-950/60 p-5">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-violet-300">Metrology gate</p>
                      <h3 className="mt-3 font-semibold text-white">{item.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">{item.measurement}</p>
                      <p className="mt-4 border-l border-zinc-700 pl-3 text-xs leading-5 text-zinc-500"><span className="text-zinc-300">Release decision:</span> {item.releaseDecision}</p>
                      <p className="mt-3 border-l border-amber-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-amber-300">Limitation:</span> {item.limitation}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-8 space-y-12 font-serif text-lg leading-8">
              {article.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="font-sans text-2xl font-semibold text-white">{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-5 text-zinc-400">{paragraph}</p>)}
                  {(section.claimIds?.length ?? 0) > 0 && (
                    <div className="mt-6 space-y-3">
                      {section.claimIds?.map((claimId) => {
                        const claim = claims.get(claimId)
                        if (!claim) return null
                        const meta = evidenceMeta[claim.status]
                        return (
                          <div key={claim.id} className="border border-zinc-800 bg-zinc-950/70 p-4 font-sans text-sm leading-6">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${meta.className}`}>{meta.label}</span>
                              {claim.sourceIds.map((sourceId) => sourceNumbers.get(sourceId)).filter(Boolean).map((number) => (
                                <a key={number} href={`#source-${number}`} className="font-mono text-[10px] text-cyan-300 hover:text-white">[{number}]</a>
                              ))}
                            </div>
                            <p className="mt-3 text-zinc-300">{claim.statement}</p>
                            {claim.boundary && <p className="mt-2 border-l border-amber-600/50 pl-3 text-xs text-zinc-500"><span className="text-amber-400">Boundary:</span> {claim.boundary}</p>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>

            <section className="mt-14 border-t border-zinc-800 pt-8">
              <h2 className="text-2xl font-semibold text-white">Sources</h2>
              <p className="mt-2 text-sm text-zinc-500">Citations support the tagged claims above. Access dates record when Maha Strategies last checked the public source.</p>
              <ol className="mt-6 space-y-4">
                {sources.map((source, index) => (
                  <li key={source.id} id={`source-${index + 1}`} className="scroll-mt-24 border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400">
                    <span className="mr-2 font-mono text-xs text-cyan-300">[{index + 1}]</span>
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a>
                    <span className="text-zinc-600"> · {source.publisher}{source.year ? ` · ${source.year}` : ''} · accessed {source.accessed}</span>
                  </li>
                ))}
              </ol>
            </section>

            {suppliers.length > 0 && (
              <section className="mt-14 border-t border-zinc-800 pt-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Public capability landscape</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Supplier profiles</h2>
                  </div>
                  <Link href="/knowledge/suppliers" className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-cyan-300">Browse all suppliers →</Link>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">Named companies are research leads based on public evidence. Inclusion does not establish customer qualification, process-of-record status, available capacity, or supplier ranking.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {suppliers.map((supplier) => (
                    <Link key={supplier.id} href={knowledgeSupplierPath(supplier)} className="border border-zinc-800 bg-zinc-950/60 p-5 hover:border-cyan-500/50">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">{supplier.supplierType}</p>
                      <h3 className="mt-3 font-semibold text-white">{supplier.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-500">{supplier.summary}</p>
                      <p className="mt-4 font-mono text-[9px] uppercase tracking-widest text-zinc-600">Evidence profile →</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside className="space-y-8">
            <div className="border border-zinc-800 bg-zinc-950/60 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Control surface</p>
              <DataList title="Critical parameters" items={article.criticalParameters} />
              <div className="mt-7"><DataList title="Failure modes" items={article.failureModes} /></div>
              <div className="mt-7"><DataList title="Metrology" items={article.metrology} /></div>
              <div className="mt-7"><DataList title="Equipment" items={article.equipment} /></div>
              <div className="mt-7"><DataList title="Materials" items={article.materials} /></div>
            </div>

            {relatedBriefs.length > 0 && (
              <section className="border border-indigo-900/50 bg-indigo-950/10 p-5">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">Applied in Intelligence</h2>
                <div className="mt-4 space-y-4">
                  {relatedBriefs.map((brief) => (
                    <Link key={brief.slug} href={`/intelligence/briefs/${brief.slug}`} className="block text-sm leading-5 text-zinc-400 hover:text-white">{brief.title} <span className="text-indigo-400">→</span></Link>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>

        {relatedArticles.length > 0 && (
          <section className="mt-16 border-t border-zinc-800 pt-10">
            <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Continue through the graph</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedArticles.map((related) => (
                <Link key={related.id} href={knowledgeArticlePath(related)} className="border border-zinc-800 p-5 hover:border-cyan-500/50">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">{KNOWLEDGE_KIND_META[related.kind].label}</p>
                  <p className="mt-3 text-sm font-semibold text-white">{related.shortTitle}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
