import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { UpliftSections } from '@/components/UpliftSections'

import { SITE_URL, getBriefBySlug } from '@/lib/briefs-data'
import { getKnowledgeArticle, getKnowledgeSource, knowledgeArticlePath } from '@/lib/knowledge-data'
import {
  KNOWLEDGE_SUPPLIERS,
  getKnowledgeSupplierBySlug,
  knowledgeSupplierPath,
} from '@/lib/knowledge-process-profiles'
import { getIntelligenceBriefSlugsForKnowledgeObject } from '@/lib/intelligence-knowledge-links'

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() { return KNOWLEDGE_SUPPLIERS.map((supplier) => ({ slug: supplier.slug })) }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supplier = getKnowledgeSupplierBySlug((await params).slug)
  if (!supplier) return {}
  const path = knowledgeSupplierPath(supplier)
  return {
    title: `${supplier.name} Semiconductor Capability Profile | Maha Knowledge`,
    description: `${supplier.summary} Evidence boundary: ${supplier.boundary}`,
    alternates: { canonical: path },
    openGraph: { title: `${supplier.name} Semiconductor Capability Profile`, description: supplier.summary, url: `${SITE_URL}${path}`, siteName: 'Maha Strategies', images: [{ url: '/og-master.png', width: 1200, height: 630, alt: `${supplier.name} capability profile` }] },
  }
}

export default async function SupplierProfilePage({ params }: PageProps) {
  const supplier = getKnowledgeSupplierBySlug((await params).slug)
  if (!supplier) notFound()
  const upliftRoute = knowledgeSupplierPath(supplier)
  const processes = supplier.processIds.map(getKnowledgeArticle).filter((article) => article !== undefined)
  const sources = supplier.sourceIds.map(getKnowledgeSource).filter((source) => source !== undefined)
  const relatedBriefs = getIntelligenceBriefSlugsForKnowledgeObject(supplier.id).map(getBriefBySlug).filter((brief) => brief !== undefined)
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ProfilePage',
    mainEntity: { '@type': 'Organization', name: supplier.name, description: supplier.summary },
    url: `${SITE_URL}${knowledgeSupplierPath(supplier)}`,
    citation: sources.map((source) => source.url),
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-cyan-400 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><Link href="/knowledge/suppliers" className="hover:text-white">Suppliers</Link><span className="px-2">/</span><span className="text-zinc-400">{supplier.name}</span>
        </nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <div className="flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest">
            <span className="border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-300">Supplier profile</span>
            <span className="px-2 py-1 text-zinc-600">{supplier.headquarters}</span>
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">{supplier.name}</h1>
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-cyan-300">{supplier.supplierType}</p>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">{supplier.summary}</p>
        </header>

        <section className="mt-10 grid gap-px border border-zinc-800 bg-zinc-800 md:grid-cols-2">
          <div className="bg-zinc-950 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">What public evidence supports</p>
            <p className="mt-4 text-sm leading-7 text-zinc-300">{supplier.capabilityEvidence}</p>
          </div>
          <div className="bg-zinc-950 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Evidence boundary</p>
            <p className="mt-4 text-sm leading-7 text-zinc-300">{supplier.boundary}</p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-white">Linked process capabilities</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-500">The links below show where the documented capability fits in the chip lifecycle. They are not customer or qualification claims.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {processes.map((process) => (
              <Link key={process.id} href={knowledgeArticlePath(process)} className="border border-zinc-800 bg-zinc-950/60 p-5 hover:border-cyan-500/50">
                <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">Process</p>
                <h3 className="mt-3 font-semibold text-white">{process.shortTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-500">{process.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {relatedBriefs.length > 0 && (
          <section className="mt-14 border-t border-zinc-800 pt-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">Applied in Intelligence</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Briefs using this capability context</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">These links identify where the supplier&rsquo;s public capability profile supports an analytical brief. They do not imply endorsement, customer status, or process-of-record qualification.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {relatedBriefs.map((brief) => (
                <Link key={brief.slug} href={`/intelligence/briefs/${brief.slug}`} className="border border-zinc-800 bg-indigo-950/10 p-5 hover:border-indigo-500/50">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-indigo-300">Intelligence brief</p>
                  <h3 className="mt-3 font-semibold text-white">{brief.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">{brief.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-14 border-t border-zinc-800 pt-8">
          <h2 className="text-2xl font-semibold text-white">Sources</h2>
          <ol className="mt-6 space-y-4">
            {sources.map((source, index) => (
              <li key={source.id} className="border-l border-zinc-700 pl-4 text-sm leading-6 text-zinc-400">
                <span className="mr-2 font-mono text-xs text-cyan-300">[{index + 1}]</span>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a>
                <span className="text-zinc-600"> · {source.publisher}{source.year ? ` · ${source.year}` : ''} · accessed {source.accessed}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    <UpliftSections route={upliftRoute} /></main>
  )
}
