import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_URL } from '@/lib/briefs-data'
import { KNOWLEDGE_ARTICLES, knowledgeArticlePath } from '@/lib/knowledge-data'
import { KNOWLEDGE_SUPPLIERS, knowledgeSupplierPath } from '@/lib/knowledge-process-profiles'

export const metadata: Metadata = {
  title: 'Semiconductor Supplier Profiles | Maha Knowledge',
  description: 'Evidence-bounded profiles of semiconductor design, materials, equipment, foundry, packaging, and test suppliers, connected to the processes they support.',
  alternates: { canonical: '/knowledge/suppliers' },
  openGraph: {
    title: 'Semiconductor Supplier Profiles | Maha Knowledge',
    description: 'Map public supplier capabilities to semiconductor process requirements without treating portfolio evidence as customer qualification.',
    url: `${SITE_URL}/knowledge/suppliers`,
    siteName: 'Maha Strategies',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Maha Strategies semiconductor supplier profiles' }],
  },
}

export default function SupplierIndexPage() {
  const processMap = new Map(KNOWLEDGE_ARTICLES.map((article) => [article.id, article]))
  const types = [...new Set(KNOWLEDGE_SUPPLIERS.map((supplier) => supplier.supplierType))].sort()

  return (
    <main className="min-h-screen bg-[#0a0a0c] px-6 py-16 text-zinc-300 selection:bg-cyan-400 selection:text-black sm:px-12">
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><span className="text-zinc-400">Suppliers</span>
        </nav>
        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-300">[ Capability evidence // not a ranking ]</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Semiconductor supplier profiles</h1>
          <p className="mt-6 max-w-3xl font-serif text-lg leading-8 text-zinc-400">Public capability evidence connected to the materials, equipment, inspection, assembly, and test processes it may support. Every profile states what the evidence does—and does not—establish.</p>
          <div className="mt-7 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <span className="border border-zinc-800 px-3 py-2">{KNOWLEDGE_SUPPLIERS.length} profiles</span>
            <span className="border border-zinc-800 px-3 py-2">{types.length} capability classes</span>
            <span className="border border-zinc-800 px-3 py-2">18 linked process explainers</span>
          </div>
        </header>

        <section className="mt-10 border-l-2 border-amber-600/70 bg-amber-950/10 p-5 text-sm leading-6 text-zinc-400">
          Inclusion is not an approved-vendor-list entry. Before a sourcing decision, verify the legal entity, exact product and site, technical fit, customer qualification, capacity, service model, change control, and commercial terms directly.
        </section>

        <div className="mt-12 space-y-14">
          {types.map((type) => {
            const suppliers = KNOWLEDGE_SUPPLIERS.filter((supplier) => supplier.supplierType === type)
            return (
              <section key={type}>
                <div className="flex items-baseline justify-between gap-4 border-b border-zinc-800 pb-3">
                  <h2 className="text-xl font-semibold text-white">{type}</h2>
                  <span className="font-mono text-[10px] text-zinc-600">{suppliers.length} profile{suppliers.length === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {suppliers.map((supplier) => {
                    const processes = supplier.processIds.map((id) => processMap.get(id)).filter((article) => article !== undefined)
                    return (
                      <article key={supplier.id} className="border border-zinc-800 bg-zinc-950/60 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">{supplier.headquarters}</p>
                            <h3 className="mt-2 text-lg font-semibold text-white"><Link href={knowledgeSupplierPath(supplier)} className="hover:text-cyan-200">{supplier.name}</Link></h3>
                          </div>
                          <Link href={knowledgeSupplierPath(supplier)} className="font-mono text-xs text-zinc-600 hover:text-cyan-300">→</Link>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-zinc-500">{supplier.summary}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {processes.slice(0, 4).map((process) => <Link key={process.id} href={knowledgeArticlePath(process)} className="border border-zinc-800 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-zinc-500 hover:text-cyan-300">{process.shortTitle}</Link>)}
                          {processes.length > 4 && <span className="px-2 py-1 font-mono text-[8px] text-zinc-700">+{processes.length - 4}</span>}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </main>
  )
}
