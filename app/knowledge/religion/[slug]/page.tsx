import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { UpliftSections } from '@/components/UpliftSections'

import { SITE_URL } from '@/lib/briefs-data'
import { getMathematicalConcept, mathematicsConceptPath } from '@/lib/mathematics-knowledge'
import { RELIGION_CONCEPTS, RELIGION_KNOWLEDGE_PATH, RELIGION_KNOWLEDGE_RELEASE_DATE, RELIGION_SOURCES, getReligionConcept, getReligionConceptBridges, religionConceptPath } from '@/lib/religion-knowledge'

type PageProps = { params: Promise<{ slug: string }> }
export const dynamicParams = false
export function generateStaticParams() { return RELIGION_CONCEPTS.map((item) => ({ slug: item.slug })) }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const item = getReligionConcept((await params).slug)
  if (!item) return {}
  const path = religionConceptPath(item)
  return { metadataBase: new URL(SITE_URL), title: `${item.name} | Religion and Contemplative Traditions`, description: item.description, alternates: { canonical: path }, openGraph: { type: 'article', title: item.name, description: item.description, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies' } }
}

const List = ({ title, items, tone = 'teal' }: { title: string; items: string[]; tone?: 'teal' | 'amber' | 'rose' }) => <section><h2 className={`font-mono text-[10px] uppercase tracking-widest ${{ teal: 'text-teal-300', amber: 'text-amber-300', rose: 'text-rose-300' }[tone]}`}>{title}</h2><ul className="mt-4 space-y-3">{items.map((value) => <li key={value} className="border-l border-zinc-700 pl-3 text-sm leading-6 text-zinc-400">{value}</li>)}</ul></section>

export default async function ReligionConceptPage({ params }: PageProps) {
  const item = getReligionConcept((await params).slug)
  if (!item) notFound()
  const path = religionConceptPath(item)
  const sources = item.sourceIds.map((id) => RELIGION_SOURCES.find((source) => source.id === id)).filter((source) => source !== undefined)
  const bridges = getReligionConceptBridges(item.id)
  const related = item.relatedSlugs.map(getReligionConcept).filter((value) => value !== undefined)
  const jsonLd = { '@context': 'https://schema.org', '@type': 'ScholarlyArticle', headline: item.name, description: item.description, datePublished: RELIGION_KNOWLEDGE_RELEASE_DATE, dateModified: RELIGION_KNOWLEDGE_RELEASE_DATE, mainEntityOfPage: `${SITE_URL}${path}`, isPartOf: `${SITE_URL}${RELIGION_KNOWLEDGE_PATH}`, citation: sources.map((source) => source.url), about: [item.category, 'religious studies methodology'] }

  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 selection:bg-teal-300 selection:text-black sm:px-12"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><div className="mx-auto max-w-6xl">
    <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><Link href={RELIGION_KNOWLEDGE_PATH} className="hover:text-white">Religion and contemplative traditions</Link><span className="px-2">/</span><span className="text-zinc-400">{item.name}</span></nav>
    <header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">{item.category}</p><h1 className="mt-6 max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{item.name}</h1><p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{item.description}</p></header>
    <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_330px]"><article>
      <section className="border-l-2 border-teal-500 bg-teal-950/10 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Working definition</p><p className="mt-3 font-serif text-lg leading-8 text-zinc-200">{item.definition}</p></section>
      <div className="mt-10 grid gap-8 md:grid-cols-2"><List title="Questions this method asks" items={item.questions} /><List title="Evidence inputs" items={item.evidenceInputs} tone="amber" /></div>
      <section className="mt-12"><List title="Method" items={item.method} /></section>
      <div className="mt-12 grid gap-8 md:grid-cols-2"><List title="What it can establish" items={item.establishes} /><List title="What it cannot establish" items={item.doesNotEstablish} tone="rose" /></div>
      <section className="mt-12 border border-amber-900/60 bg-amber-950/10 p-6"><List title="Interpretive risks" items={item.interpretiveRisks} tone="amber" /></section>

      <section className="mt-14 border-t border-zinc-800 pt-8"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Mathematical connection</p><h2 className="mt-3 text-2xl font-semibold text-white">Formal structure without validity transfer</h2>{bridges.length ? <div className="mt-6 space-y-5">{bridges.map((bridge) => { const math = getMathematicalConcept(bridge.mathematicalConceptId); return <div key={bridge.id} className="border border-zinc-800 p-6"><div className="flex flex-wrap justify-between gap-3 font-mono text-[9px] uppercase tracking-widest"><span className="text-teal-300">{bridge.relation.replaceAll('-', ' ')}</span>{math && <Link href={mathematicsConceptPath(math)} className="text-emerald-300 hover:text-white">{math.name} →</Link>}</div><h3 className="mt-3 text-lg font-semibold text-white">{bridge.title}</h3><p className="mt-3 text-sm leading-6 text-zinc-400">{bridge.application}</p><div className="mt-5 grid gap-5 md:grid-cols-2"><List title="Inputs" items={bridge.inputs} tone="amber" /><List title="Outputs" items={bridge.outputs} /></div><p className="mt-5 border-l border-rose-700/60 pl-3 text-xs leading-5 text-zinc-500"><span className="text-rose-300">Limit:</span> {bridge.limitations}</p></div>})}</div> : <p className="mt-5 text-sm leading-6 text-zinc-500">Related mathematical concepts are listed in the contract, but no direct application bridge is asserted in this release.</p>}</section>

      <section className="mt-14 border-t border-zinc-800 pt-8"><h2 className="text-2xl font-semibold text-white">Methodology sources</h2><ol className="mt-6 space-y-5">{sources.map((source, index) => <li key={source.id} className="border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400"><span className="mr-2 font-mono text-xs text-teal-300">[{index + 1}]</span><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a><span className="text-zinc-600"> · {source.publisher}</span><p className="mt-2 text-xs text-zinc-500"><span className="text-zinc-300">Establishes:</span> {source.establishes}</p><p className="mt-2 text-xs text-amber-200/70"><span className="text-amber-300">Boundary:</span> {source.boundary}</p></li>)}</ol></section>
    <UpliftSections route={path} /></article><aside className="space-y-8"><div className="border border-zinc-800 bg-zinc-950/60 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Method contract</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-zinc-600">Category</dt><dd className="mt-1 text-zinc-300">{item.category}</dd></div><div><dt className="text-zinc-600">Sources</dt><dd className="mt-1 text-zinc-300">{sources.length}</dd></div><div><dt className="text-zinc-600">Math bridges</dt><dd className="mt-1 text-zinc-300">{bridges.length}</dd></div></dl></div><div className="border border-rose-900/50 bg-rose-950/10 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Epistemic boundary</p><p className="mt-3 text-sm leading-6 text-zinc-400">Historical, theological, experiential, and empirical claims remain separately typed. Agreement in one layer cannot silently certify another.</p></div></aside></div>
    <section className="mt-16 border-t border-zinc-800 pt-10"><h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Related methodology concepts</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map((value) => <Link key={value.id} href={religionConceptPath(value)} className="border border-zinc-800 p-5 hover:border-teal-500/50"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{value.category}</p><p className="mt-3 text-sm font-semibold text-white">{value.name}</p></Link>)}</div></section>
  </div></main>
}
