import type { Metadata } from 'next'
import Link from 'next/link'

import ConstraintCompiler from './ConstraintCompiler'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Constraint Studio | Decision specification preflight',
  description: 'Turn a planning problem into a structured, reviewable Constraint Pack with objectives, variables, hard limits, preferences, assumptions, and solver-handoff JSON.',
  alternates: { canonical: '/tools/constraint-studio' },
  openGraph: { type: 'website', url: `${SITE_URL}/tools/constraint-studio`, title: 'Constraint Studio | Maha Strategies', description: 'A browser-local preflight for structured decision and optimization problem specifications.' },
}

export default function ConstraintStudioPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Maha Constraint Studio',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}/tools/constraint-studio`,
    description: 'A browser-local tool that turns a planning problem into a reviewable, machine-readable Constraint Pack. It does not execute a solver or make decisions.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Maha Strategies LLC' },
  }
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><div className="mx-auto max-w-7xl"><Link href="/tools" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-white">← Tools &amp; API</Link><header className="mt-12 max-w-4xl"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Decision specification · browser local ]</p><h1 className="mt-5 text-4xl font-light leading-[1.06] tracking-tight text-white sm:text-6xl">Turn a messy decision into a reviewable constraint pack.</h1><p className="mt-7 text-lg leading-relaxed text-zinc-400">Maha Constraint Studio helps you specify an optimization problem before anyone writes solver code: objective, variables, non-negotiable limits, preferences, assumptions, and data gaps. Export the result as JSON for review or a future Z3/OR-Tools adapter.</p></header><section className="mt-10 grid gap-5 border-y border-zinc-800 py-7 text-sm leading-relaxed sm:grid-cols-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ What it does ]</p><p className="mt-3 text-zinc-400">Checks structural completeness, duplicate variables, undefined references, and missing boundaries.</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ What it exports ]</p><p className="mt-3 text-zinc-400">A machine-readable Constraint Pack with explicit limits and a human-review status.</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ What it does not do ]</p><p className="mt-3 text-zinc-400">It does not infer facts, solve an optimization, access your systems, or make operational decisions.</p></div></section><ConstraintCompiler /><section className="mt-16 max-w-3xl border-t border-zinc-800 pt-8"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Next layer</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">A valid Constraint Pack is a starting point for a bounded solver implementation, scenario model, or human-reviewed research brief—not a substitute for domain expertise, current data, or accountable approval.</p></section></div></main>
}
