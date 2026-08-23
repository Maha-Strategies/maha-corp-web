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
  return <main className="evidence-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><div className="evidence-container"><Link href="/tools" className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">← Tools &amp; API</Link><header className="mt-12 max-w-4xl"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ Decision specification · browser local ]</p><h1 className="mt-5 text-4xl font-light leading-[1.06] tracking-tight text-[var(--text-primary)] sm:text-6xl">Turn a messy decision into a reviewable constraint pack.</h1><p className="mt-7 text-lg leading-relaxed text-[var(--text-secondary)]">Maha Constraint Studio helps you specify an optimization problem before anyone writes solver code: objective, variables, non-negotiable limits, preferences, assumptions, and data gaps. Export the result as JSON for review or a future Z3/OR-Tools adapter.</p></header><section className="mt-10 grid gap-5 border-y border-[var(--border-default)] py-7 text-sm leading-relaxed sm:grid-cols-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ What it does ]</p><p className="mt-3 text-[var(--text-secondary)]">Checks structural completeness, duplicate variables, undefined references, and missing boundaries.</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ What it exports ]</p><p className="mt-3 text-[var(--text-secondary)]">A machine-readable Constraint Pack with explicit limits and a human-review status.</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">[ What it does not do ]</p><p className="mt-3 text-[var(--text-secondary)]">It does not infer facts, solve an optimization, access your systems, or make operational decisions.</p></div></section><ConstraintCompiler /><section className="mt-16 max-w-3xl border-t border-[var(--border-default)] pt-8"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Next layer</p><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">A valid Constraint Pack is a starting point for a bounded solver implementation, scenario model, or human-reviewed research brief—not a substitute for domain expertise, current data, or accountable approval.</p></section></div></main>
}
