import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/briefs-data'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'
import {
  getKnowledgeArticle,
  getKnowledgeSource,
  knowledgeArticlePath,
} from '@/lib/knowledge-data'
import {
  SEMICONDUCTOR_CROSS_CUTTING_CONTROLS,
  SEMICONDUCTOR_PROCESS_MAP_DATE,
  SEMICONDUCTOR_PROCESS_MAP_PATH,
  SEMICONDUCTOR_PROCESS_PHASES,
  getProcessMapStepCount,
  type ProcessMapCategory,
} from '@/lib/semiconductor-process-map'

export const metadata: Metadata = {
  title: 'Complete Semiconductor Manufacturing Process Map | Maha Knowledge',
  description: 'A complete, cited design-to-qualified-package semiconductor process map covering chip design, masks, wafers, FEOL, MEOL, BEOL, wafer sort, packaging, final test, reliability, and yield feedback.',
  alternates: { canonical: SEMICONDUCTOR_PROCESS_MAP_PATH },
  openGraph: {
    type: 'article',
    title: 'Complete Semiconductor Manufacturing Process Map',
    description: 'Follow the complete semiconductor lifecycle from product requirements and tape-out through wafer fabrication, packaging, qualification, and field feedback.',
    url: `${SITE_URL}${SEMICONDUCTOR_PROCESS_MAP_PATH}`,
    siteName: 'Maha Strategies',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'Complete semiconductor manufacturing process map' }],
  },
}

const categoryMeta: Record<ProcessMapCategory, { label: string; className: string }> = {
  design: { label: 'Design', className: 'border-violet-500/40 bg-violet-500/10 text-violet-300' },
  mask: { label: 'Mask', className: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300' },
  substrate: { label: 'Substrate', className: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  pattern: { label: 'Pattern', className: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' },
  film: { label: 'Film', className: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
  modify: { label: 'Modify', className: 'border-teal-500/40 bg-teal-500/10 text-teal-300' },
  interconnect: { label: 'Interconnect', className: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  test: { label: 'Test', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  assembly: { label: 'Assembly', className: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
  quality: { label: 'Control', className: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
}

const allSourceIds = [...new Set(SEMICONDUCTOR_PROCESS_PHASES.flatMap((phase) => phase.sourceIds))]

export default function SemiconductorManufacturingProcessMapPage() {
  const sources = allSourceIds.map(getKnowledgeSource).filter((source) => source !== undefined)
  const sourceNumbers = new Map(sources.map((source, index) => [source.id, index + 1]))
  const stepCount = getProcessMapStepCount()
  const url = `${SITE_URL}${SEMICONDUCTOR_PROCESS_MAP_PATH}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: 'Complete Semiconductor Manufacturing Process Map',
        description: metadata.description,
        datePublished: SEMICONDUCTOR_PROCESS_MAP_DATE,
        dateModified: SEMICONDUCTOR_PROCESS_MAP_DATE,
        author: { '@id': MAHA_ORGANIZATION_ID },
        publisher: { '@id': MAHA_ORGANIZATION_ID },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        citation: sources.map((source) => source.url),
      },
      {
        '@type': 'ItemList',
        name: 'Semiconductor manufacturing phases',
        numberOfItems: SEMICONDUCTOR_PROCESS_PHASES.length,
        itemListElement: SEMICONDUCTOR_PROCESS_PHASES.map((phase) => ({
          '@type': 'ListItem',
          position: phase.order,
          name: phase.label,
          url: `${url}#${phase.id}`,
        })),
      },
    ],
  }

  return (
    <main className="min-h-screen bg-[#08080a] px-6 py-16 text-zinc-300 selection:bg-cyan-300 selection:text-black sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-7xl">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <Link href="/knowledge" className="hover:text-white">Knowledge</Link><span className="px-2">/</span><span>Maps</span><span className="px-2">/</span><span className="text-zinc-400">Semiconductor manufacturing</span>
        </nav>

        <header className="mt-10 border-b border-zinc-800 pb-12">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">[ Design → wafer → package → field ]</p>
          <h1 className="mt-6 max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Complete Semiconductor Manufacturing Process Map</h1>
          <p className="mt-6 max-w-4xl font-serif text-lg leading-8 text-zinc-400">A product-neutral map of the full manufacturing system—from requirements and RTL through masks, transistor formation, multilayer wiring, wafer sort, heterogeneous assembly, final test, qualification, and production feedback.</p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs uppercase tracking-widest text-zinc-500">
            <span><strong className="text-white">{SEMICONDUCTOR_PROCESS_PHASES.length}</strong> phases</span>
            <span><strong className="text-white">{stepCount}</strong> process nodes</span>
            <span><strong className="text-white">{SEMICONDUCTOR_CROSS_CUTTING_CONTROLS.length}</strong> continuous controls</span>
            <span>Updated {SEMICONDUCTOR_PROCESS_MAP_DATE}</span>
          </div>
        </header>

        <aside className="mt-8 border-l-2 border-amber-500/60 bg-amber-950/10 p-5 text-sm leading-6 text-zinc-400">
          <strong className="text-amber-300">Scope boundary.</strong> This is a complete reference architecture, not a universal recipe. Logic, memory, analog, power, photonic, MEMS, compound-semiconductor, and mature-node flows reorder, omit, or add modules. Individual products may require hundreds to thousands of operations because lithography, deposition, etch, clean, implant, anneal, CMP, inspection, and metrology repeat across many layers.
        </aside>

        <section aria-labelledby="map-overview" className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">System view</p>
              <h2 id="map-overview" className="mt-2 text-2xl font-semibold text-white">The primary value stream</h2>
            </div>
            <p className="max-w-xl text-right text-xs leading-5 text-zinc-600">Forward arrows carry a progressively more valuable physical or digital product. Feedback returns yield, reliability, and field evidence upstream.</p>
          </div>
          <ol className="mt-7 grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
            {SEMICONDUCTOR_PROCESS_PHASES.map((phase, index) => (
              <li key={phase.id} className="relative border border-zinc-800 bg-zinc-950/70 p-4 lg:min-h-40">
                <a href={`#${phase.id}`} className="group block">
                  <span className="font-mono text-[10px] text-cyan-400">{String(phase.order).padStart(2, '0')}</span>
                  <h3 className="mt-3 text-sm font-semibold leading-5 text-white group-hover:text-cyan-200">{phase.label}</h3>
                  <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-zinc-600">{phase.steps.length} nodes</p>
                </a>
                {index < SEMICONDUCTOR_PROCESS_PHASES.length - 1 && <span aria-hidden="true" className="absolute -bottom-3 left-1/2 z-10 text-lg text-cyan-500 sm:-right-3 sm:bottom-auto sm:left-auto sm:top-1/2 lg:-right-3">→</span>}
              </li>
            ))}
          </ol>
          <div className="border-x border-b border-rose-900/40 bg-rose-950/10 px-5 py-3 text-center font-mono text-[10px] uppercase tracking-widest text-rose-300">← Failure analysis, yield learning, reliability, and field feedback close the loop to design and process control ←</div>
        </section>

        <section className="mt-14 border-y border-zinc-800 py-10">
          <div className="flex flex-wrap gap-3">
            {(Object.keys(categoryMeta) as ProcessMapCategory[]).map((category) => (
              <span key={category} className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-widest ${categoryMeta[category].className}`}>{categoryMeta[category].label}</span>
            ))}
            <span className="border border-zinc-700 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500">↻ repeated or iterative</span>
          </div>
        </section>

        <div className="mt-16 space-y-24">
          {SEMICONDUCTOR_PROCESS_PHASES.map((phase) => (
            <section key={phase.id} id={phase.id} className="scroll-mt-24">
              <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
                <header>
                  <p className="font-mono text-4xl font-light text-cyan-400/50">{String(phase.order).padStart(2, '0')}</p>
                  <h2 className="mt-4 text-2xl font-semibold text-white">{phase.label}</h2>
                  <p className="mt-4 text-sm leading-6 text-zinc-500">{phase.objective}</p>
                  <div className="mt-5 flex flex-wrap gap-2 font-mono text-[9px] text-zinc-600">
                    {phase.sourceIds.map((sourceId) => {
                      const number = sourceNumbers.get(sourceId)
                      return number ? <a key={sourceId} href={`#source-${number}`} className="hover:text-cyan-300">[{number}]</a> : null
                    })}
                  </div>
                </header>

                <div>
                  <div className="grid gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-2">
                    <div className="bg-[#08080a] p-4">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Inputs</p>
                      <ul className="mt-3 space-y-1 text-xs leading-5 text-zinc-400">{phase.inputs.map((item) => <li key={item}>· {item}</li>)}</ul>
                    </div>
                    <div className="bg-[#08080a] p-4">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Outputs</p>
                      <ul className="mt-3 space-y-1 text-xs leading-5 text-zinc-400">{phase.outputs.map((item) => <li key={item}>· {item}</li>)}</ul>
                    </div>
                  </div>

                  <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {phase.steps.map((step, index) => {
                      const relatedArticle = step.articleId ? getKnowledgeArticle(step.articleId) : undefined
                      return (
                        <li key={step.id} className="border border-zinc-800 bg-zinc-950/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <span className={`border px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest ${categoryMeta[step.category].className}`}>{categoryMeta[step.category].label}</span>
                            <span className="font-mono text-[9px] text-zinc-700">{phase.order}.{index + 1}{step.repeat ? ' ↻' : ''}</span>
                          </div>
                          <h3 className="mt-3 text-sm font-semibold text-zinc-100">{step.label}</h3>
                          <p className="mt-2 text-xs leading-5 text-zinc-500">{step.description}</p>
                          {relatedArticle && <Link href={knowledgeArticlePath(relatedArticle)} className="mt-4 inline-block font-mono text-[9px] uppercase tracking-widest text-cyan-400 hover:text-white">Technical article →</Link>}
                        </li>
                      )
                    })}
                  </ol>

                  <div className="mt-5 border border-emerald-900/50 bg-emerald-950/10 p-4 text-sm leading-6 text-zinc-400">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-300">Release gate</span>
                    <p className="mt-2">{phase.releaseGate}</p>
                  </div>

                  {(phase.feedbackTo?.length ?? 0) > 0 && (
                    <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-rose-300/80">Feedback may return to: {phase.feedbackTo?.map((id) => SEMICONDUCTOR_PROCESS_PHASES.find((item) => item.id === id)?.label).join(' · ')}</p>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-24 border-t border-zinc-800 pt-12">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Continuous control plane</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">The systems running across every phase</h2>
          <div className="mt-8 grid gap-px border border-zinc-800 bg-zinc-800 md:grid-cols-2 lg:grid-cols-4">
            {SEMICONDUCTOR_CROSS_CUTTING_CONTROLS.map((control) => (
              <article key={control.label} className="bg-[#08080a] p-5">
                <h3 className="text-sm font-semibold text-white">{control.label}</h3>
                <p className="mt-3 text-xs leading-5 text-zinc-500">{control.description}</p>
                <p className="mt-4 font-mono text-[8px] uppercase tracking-widest text-cyan-400">{control.appliesTo}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 border-t border-zinc-800 pt-10">
          <h2 className="text-2xl font-semibold text-white">Sources and method</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">The map normalizes public descriptions from design, equipment, foundry, assembly, and test organizations into one product-neutral sequence. Sources support the existence and role of process families; exact recipes, limits, cycle times, masks, and insertions remain product- and manufacturer-specific.</p>
          <ol className="mt-7 grid gap-4 md:grid-cols-2">
            {sources.map((source, index) => (
              <li key={source.id} id={`source-${index + 1}`} className="scroll-mt-24 border-l border-zinc-700 pl-4 text-xs leading-5 text-zinc-400">
                <span className="mr-2 font-mono text-cyan-300">[{index + 1}]</span>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white">{source.title}</a>
                <span className="text-zinc-600"> · {source.publisher} · accessed {source.accessed}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-16 border-t border-zinc-900 pt-8 text-center">
          <Link href="/knowledge/domains/semiconductor-manufacturing" className="font-mono text-xs uppercase tracking-widest text-zinc-500 hover:text-white">Read the semiconductor manufacturing overview →</Link>
        </div>
      </div>
    </main>
  )
}
