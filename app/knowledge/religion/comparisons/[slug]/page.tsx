import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { UpliftSections } from '@/components/UpliftSections'
import { SITE_URL } from '@/lib/briefs-data'
import { RELIGION_COMPARISONS, RELIGION_COMPARISONS_PATH, RELIGION_KNOWLEDGE_PATH, RELIGION_SOURCES, getReligionComparison, getReligionConcept, religionComparisonPath, religionConceptPath } from '@/lib/religion-knowledge'

type PageProps = { params: Promise<{ slug: string }> }
export const dynamicParams = false
export function generateStaticParams() { return RELIGION_COMPARISONS.map((item) => ({ slug: item.slug })) }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> { const item = getReligionComparison((await params).slug); if (!item) return {}; const path = religionComparisonPath(item); return { metadataBase: new URL(SITE_URL), title: `${item.title} | Method Comparison`, description: item.question, alternates: { canonical: path } } }

export default async function ReligionComparisonPage({ params }: PageProps) {
  const item = getReligionComparison((await params).slug)
  if (!item) notFound()
  const upliftRoute = religionComparisonPath(item)
  const sources = item.sourceIds.map((id) => RELIGION_SOURCES.find((source) => source.id === id)).filter((source) => source !== undefined)
  const concepts = item.relatedConceptSlugs.map(getReligionConcept).filter((value) => value !== undefined)
  return <main className="min-h-screen bg-[#09090b] px-6 py-16 text-zinc-300 sm:px-12"><div className="mx-auto max-w-5xl"><nav className="font-mono text-[10px] uppercase tracking-widest text-zinc-600"><Link href={RELIGION_KNOWLEDGE_PATH}>Religion and contemplative traditions</Link><span className="px-2">/</span><Link href={RELIGION_COMPARISONS_PATH}>Comparisons</Link><span className="px-2">/</span><span className="text-zinc-400">{item.title}</span></nav><header className="mt-10 border-b border-zinc-800 pb-10"><p className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Bounded method comparison</p><h1 className="mt-6 text-4xl font-semibold text-white sm:text-6xl">{item.title}</h1><p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-300">{item.question}</p></header>
    <section className="mt-10 grid gap-5 md:grid-cols-2">{item.perspectives.map((view) => <article key={view.label} className="border border-zinc-800 p-6"><p className="font-mono text-[9px] uppercase tracking-widest text-teal-300">{view.authorityType}</p><h2 className="mt-3 text-xl font-semibold text-white">{view.label}</h2><p className="mt-3 text-sm leading-6 text-zinc-400">{view.description}</p><p className="mt-5 border-l border-teal-600 pl-3 text-sm leading-6 text-zinc-300"><span className="text-teal-300">Valid claim:</span> {view.validClaim}</p><UpliftSections route={upliftRoute} /></article>)}</section>
    <div className="mt-12 grid gap-10 md:grid-cols-2"><section><h2 className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Shared comparison axes</h2><ul className="mt-4 space-y-3">{item.sharedAxes.map((value) => <li key={value} className="border-l border-zinc-700 pl-3 text-sm text-zinc-400">{value}</li>)}</ul></section><section><h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Non-equivalences to preserve</h2><ul className="mt-4 space-y-3">{item.nonEquivalences.map((value) => <li key={value} className="border-l border-amber-800 pl-3 text-sm text-zinc-400">{value}</li>)}</ul></section></div>
    <section className="mt-12 border border-zinc-800 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-teal-300">Comparison procedure</h2><ol className="mt-4 space-y-3">{item.comparisonMethod.map((value, index) => <li key={value} className="flex gap-3 text-sm leading-6 text-zinc-400"><span className="font-mono text-teal-300">{index + 1}.</span>{value}</li>)}</ol></section>
    <section className="mt-8 border border-rose-900/60 bg-rose-950/10 p-6"><h2 className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Prohibited inference</h2><p className="mt-3 text-sm leading-6 text-zinc-300">{item.prohibitedInference}</p></section>
    <section className="mt-12 border-t border-zinc-800 pt-8"><h2 className="text-2xl font-semibold text-white">Connected concepts and sources</h2><div className="mt-5 flex flex-wrap gap-3">{concepts.map((value) => <Link key={value.id} href={religionConceptPath(value)} className="border border-teal-900 px-3 py-2 text-xs text-teal-200 hover:border-teal-400">{value.name}</Link>)}</div><ol className="mt-8 space-y-4">{sources.map((source) => <li key={source.id} className="text-sm text-zinc-500"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline underline-offset-4">{source.title}</a> · {source.publisher}</li>)}</ol></section>
  </div></main>
}
