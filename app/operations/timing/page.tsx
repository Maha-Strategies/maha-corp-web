import type { Metadata } from 'next'
import Link from 'next/link'

import TransitOperationsBoard from '@/components/TransitOperationsBoard'
import { BACKGROUND_TRANSITS, TRANSIT_PHASES, formatDate } from '@/lib/transit-alignment'

export const metadata: Metadata = {
  title: 'Maha Timing Board | Maha Strategies',
  description: 'A reflective operating calendar that maps Maha Strategies priorities to a Cancer-ascendant Vedic transit cycle.',
  alternates: { canonical: '/operations/timing' },
}

export default function TimingBoardPage() {
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28">
    <div className="mx-auto max-w-5xl">
      <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Maha Strategies // Private operating lens ]</p>
      <h1 className="mt-5 max-w-4xl text-4xl font-light leading-[1.08] tracking-tight text-white sm:text-6xl">A timing board for building with intention.</h1>
      <p className="mt-7 max-w-3xl text-xl font-light leading-relaxed text-zinc-300">A Cancer-ascendant, Lahiri-sidereal planning lens for Maha Strategies. Use it to sequence work; use demand, revenue, operational evidence, and judgment to decide.</p>

      <TransitOperationsBoard />

      <section className="mt-16">
        <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Jupiter cycle // commercial sequencing ]</p>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {TRANSIT_PHASES.map((phase) => <article key={phase.id} className="border border-zinc-800 bg-zinc-950/40 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">{phase.planet} in {phase.sign} · House {phase.house}</p><p className="mt-3 font-mono text-xs text-zinc-500">{formatDate(phase.startsOn)} — {formatDate(phase.endsOn)}</p><h2 className="mt-4 text-2xl font-light text-white">{phase.title}</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">{phase.operatingTheme}</p><div className="mt-6 border-t border-zinc-800 pt-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Prioritize</p><ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-300">{phase.focus.map((item) => <li key={item} className="border-l border-indigo-500 pl-3">{item}</li>)}</ul></div><div className="mt-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Protect against</p><ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-500">{phase.protect.map((item) => <li key={item}>{item}</li>)}</ul></div></article>)}
        </div>
      </section>

      <section className="mt-16 border-t border-zinc-800 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Background constraints ]</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">{BACKGROUND_TRANSITS.map((phase) => <article key={phase.id} className="border border-zinc-800 p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{phase.planet} in {phase.sign} · House {phase.house}</p><h2 className="mt-3 text-xl text-white">{phase.title}</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">{phase.operatingTheme}</p></article>)}</div>
      </section>

      <section className="mt-16 border border-indigo-900/50 bg-indigo-950/20 p-8"><p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300">[ Decision discipline ]</p><p className="mt-4 max-w-3xl text-lg font-light leading-relaxed text-zinc-200">Every meaningful move still needs a buyer signal, a scoped cost, a named owner, a risk review, and a measurable outcome. Timing can help sequence the work; it cannot create demand or replace accountability.</p><div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs uppercase tracking-widest"><Link href="/admin/operations" className="text-zinc-300 hover:text-white">Open operations controls ↗</Link><Link href="/admin/revenue" className="text-zinc-300 hover:text-white">Open revenue metrics ↗</Link><Link href="/evidence-audit" className="text-zinc-300 hover:text-white">Evidence Audit offer ↗</Link></div></section>
    </div>
  </main>
}
