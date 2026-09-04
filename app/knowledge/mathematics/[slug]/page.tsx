import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EvidenceStatus } from '@/components/EvidenceStatus'
import { UpliftSections } from '@/components/UpliftSections'

import { SITE_URL } from '@/lib/briefs-data'
import {
  MATHEMATICAL_CONCEPTS,
  MATHEMATICS_DOMAIN_META,
  MATHEMATICS_KNOWLEDGE_PATH,
  MATHEMATICS_KNOWLEDGE_RELEASE_DATE,
  MATHEMATICS_SOURCES,
  getConceptBridges,
  getMathematicalConcept,
  mathematicsConceptPath,
} from '@/lib/mathematics-knowledge'

type PageProps = { params: Promise<{ slug: string }> }
export const dynamicParams = false
export function generateStaticParams() { return MATHEMATICAL_CONCEPTS.map((concept) => ({ slug: concept.slug })) }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const concept = getMathematicalConcept((await params).slug)
  if (!concept) return {}
  const path = mathematicsConceptPath(concept)
  return { metadataBase: new URL(SITE_URL), title: `${concept.name} | Maha Mathematics`, description: concept.description, alternates: { canonical: path }, openGraph: { type: 'article', title: concept.name, description: concept.description, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies' } }
}

const List = ({ title, items, tone = 'emerald' }: { title: string; items: string[]; tone?: 'emerald' | 'sky' | 'amber' }) => <section><h2 className={`font-mono text-[10px] uppercase tracking-widest ${{ emerald: 'text-emerald-300', sky: 'text-sky-300', amber: 'text-amber-300' }[tone]}`}>{title}</h2><ul className="mt-4 space-y-3">{items.map((item) => <li key={item} className="border-l border-zinc-700 pl-3 text-sm leading-6 text-zinc-400">{item}</li>)}</ul></section>

export default async function MathematicalConceptPage({ params }: PageProps) {
  const concept = getMathematicalConcept((await params).slug)
  if (!concept) notFound()
  const path = mathematicsConceptPath(concept)
  const bridges = getConceptBridges(concept.id)
  const sources = concept.sourceIds.map((id) => MATHEMATICS_SOURCES.find((source) => source.id === id)).filter((source) => source !== undefined)
  const related = concept.relatedSlugs.map(getMathematicalConcept).filter((item) => item !== undefined)
  const jsonLd = { '@context': 'https://schema.org', '@type': 'TechArticle', headline: concept.name, description: concept.description, datePublished: MATHEMATICS_KNOWLEDGE_RELEASE_DATE, dateModified: MATHEMATICS_KNOWLEDGE_RELEASE_DATE, mainEntityOfPage: `${SITE_URL}${path}`, isPartOf: `${SITE_URL}${MATHEMATICS_KNOWLEDGE_PATH}`, citation: sources.map((source) => source.url), about: [concept.category, ...bridges.map((bridge) => MATHEMATICS_DOMAIN_META[bridge.domain].label)] }

  return (
    <main className="min-h-screen bg-[#08090b] px-6 py-16 text-zinc-300 selection:bg-emerald-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><Link href={MATHEMATICS_KNOWLEDGE_PATH} className="hover:text-white">Mathematics</Link><span className="px-2">/</span><span className="text-zinc-400">{concept.name}</span></nav>
        <header className="mt-10 border-b border-zinc-800 pb-10"><div className="flex flex-wrap gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="border border-emerald-700/50 px-2 py-1 text-emerald-300">{concept.proofStatus}</span><span className="px-2 py-1 text-zinc-500">{concept.category}</span></div><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{concept.name}</h1><p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{concept.description}</p></header>
        <EvidenceStatus route={path} />

        <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_330px]">
          <article>
            <section className="border-l-2 border-emerald-500 bg-emerald-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Working definition</p><p className="mt-3 font-serif text-lg leading-8 text-zinc-200">{concept.definition}</p></section>
            <section className="mt-10 border border-zinc-800 bg-zinc-950/50 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Notation</p><div className="mt-4 flex flex-wrap gap-3">{concept.notation.map((item) => <code key={item} className="border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-zinc-200">{item}</code>)}</div></section>
            <div className="mt-10 grid gap-8 md:grid-cols-2"><List title="Assumptions" items={concept.assumptions} tone="amber" /><List title="Invariants" items={concept.invariants} /></div>
            <div className="mt-12 grid gap-8 md:grid-cols-2"><List title="Reproducible procedure" items={concept.procedure} tone="sky" /><List title="Error and boundary controls" items={concept.errorBounds} tone="amber" /></div>
            <section className="mt-12 border border-rose-900/60 bg-rose-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">What this does not establish</p><p className="mt-3 text-sm leading-6 text-zinc-300">{concept.doesNotEstablish}</p></section>

            <section className="mt-14 border-t border-zinc-800 pt-8"><div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Explicit applications</p><h2 className="mt-3 text-2xl font-semibold text-white">{bridges.length} cross-domain bridges</h2></div></div>{bridges.length ? <div className="mt-6 space-y-5">{bridges.map((bridge) => <div key={bridge.id} className="border border-zinc-800 p-6"><div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="text-emerald-300">{MATHEMATICS_DOMAIN_META[bridge.domain].label}</span><span className="text-zinc-600">{bridge.evidenceRole.replaceAll('-', ' ')}</span></div><h3 className="mt-3 text-lg font-semibold text-white">{bridge.title}</h3><p className="mt-3 text-sm leading-6 text-zinc-400">{bridge.application}</p><div className="mt-5 grid gap-5 md:grid-cols-2"><List title="Inputs" items={bridge.inputs} tone="sky" /><List title="Outputs" items={bridge.outputs} /></div><p className="mt-5 border-l border-sky-700/60 pl-3 text-sm leading-6 text-zinc-400"><span className="text-sky-300">Transformation:</span> {bridge.transformation}</p><p className="mt-3 border-l border-amber-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-amber-300">Limit:</span> {bridge.limitations}</p><Link href={bridge.targetPath} className="mt-5 inline-block font-mono text-[9px] uppercase tracking-widest text-emerald-300 hover:text-white">Open connected system →</Link></div>)}</div> : <p className="mt-5 text-sm text-zinc-500">This foundational concept currently supports related concepts; a direct domain bridge is scheduled for a later registry version.</p>}</section>

            <section className="mt-14 border-t border-zinc-800 pt-8"><h2 className="text-2xl font-semibold text-white">Authoritative references</h2><ol className="mt-6 space-y-5">{sources.map((source, index) => <li key={source.id} className="border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400"><span className="mr-2 font-mono text-xs text-emerald-300">[{index + 1}]</span><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a><span className="text-zinc-600"> · {source.publisher}</span><p className="mt-2 text-xs text-zinc-500"><span className="text-zinc-300">Establishes:</span> {source.establishes}</p><p className="mt-2 text-xs text-amber-200/70"><span className="text-amber-300">Boundary:</span> {source.boundary}</p></li>)}</ol></section>
          <UpliftSections route={path} /></article>
          <aside className="space-y-8"><div className="border border-zinc-800 bg-zinc-950/60 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Concept contract</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-zinc-600">Category</dt><dd className="mt-1 text-zinc-300">{concept.category}</dd></div><div><dt className="text-zinc-600">Status</dt><dd className="mt-1 text-zinc-300">{concept.proofStatus}</dd></div><div><dt className="text-zinc-600">Bridge count</dt><dd className="mt-1 text-zinc-300">{bridges.length}</dd></div><div><dt className="text-zinc-600">Source count</dt><dd className="mt-1 text-zinc-300">{sources.length}</dd></div></dl></div><div className="border border-rose-900/50 bg-rose-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Epistemic firewall</p><p className="mt-3 text-sm leading-6 text-zinc-400">A mathematical operation keeps the evidence status of the domain record it consumes. It cannot upgrade tradition into observation or association into causation.</p></div></aside>
        </div>
        <section className="mt-16 border-t border-zinc-800 pt-10"><h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Related mathematical concepts</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map((item) => <Link key={item.id} href={mathematicsConceptPath(item)} className="border border-zinc-800 p-5 hover:border-emerald-500/50"><p className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">{item.category}</p><p className="mt-3 text-sm font-semibold text-white">{item.name}</p></Link>)}</div></section>
      </div>
    </main>
  )
}
