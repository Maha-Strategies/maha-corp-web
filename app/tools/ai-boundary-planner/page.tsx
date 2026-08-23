import type { Metadata } from 'next'
import Link from 'next/link'

import AiBoundaryPlanner from './AiBoundaryPlanner'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'AI Boundary Planner | Local, Cloud & Hybrid Decision Tool',
  description: 'A browser-local planning tool for comparing on-device, cloud, and hybrid AI boundaries by data flow, capability, latency, resilience, cost, and device fit.',
  alternates: { canonical: '/tools/ai-boundary-planner' },
  openGraph: { type: 'website', url: `${SITE_URL}/tools/ai-boundary-planner`, title: 'AI Boundary Planner | Maha Strategies', description: 'Create a transparent local, cloud, or hybrid AI planning record—without vendor rankings or security certification.' },
}

export default function AiBoundaryPlannerPage() {
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Maha AI Boundary Planner', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: `${SITE_URL}/tools/ai-boundary-planner`,
    description: 'A browser-local planning aid that makes local, cloud, and hybrid AI trade-offs explicit. It does not select vendors, assess security, or authorize operational decisions.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Maha Strategies LLC' },
  }
  return <main className="evidence-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\u003c') }} /><div className="evidence-container"><Link href="/tools" className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)]">← Tools &amp; API</Link><header className="mt-12 max-w-4xl"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ Deployment planning · browser local ]</p><h1 className="mt-5 text-4xl font-light leading-[1.06] tracking-tight text-[var(--text-primary)] sm:text-6xl">Choose an AI boundary you can explain and test.</h1><p className="mt-7 text-lg leading-relaxed text-[var(--text-secondary)]">The AI Boundary Planner turns a stated workload into a transparent local, cloud, or hybrid planning recommendation. It shows the inputs that shaped the result and exports a reviewable decision record. Your entries stay in this browser.</p></header><section className="mt-10 grid gap-5 border-y border-[var(--border-default)] py-7 text-sm leading-relaxed sm:grid-cols-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ What it does ]</p><p className="mt-3 text-[var(--text-secondary)]">Makes data movement, capability needs, operational constraints, and testing gaps visible in one decision brief.</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ What it exports ]</p><p className="mt-3 text-[var(--text-secondary)]">A machine-readable planning record with recommendation logic, open questions, and a review date.</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--status-sourced)]">[ What it does not do ]</p><p className="mt-3 text-[var(--text-secondary)]">It does not rank vendors, certify privacy or security, measure your system, or make an operational decision.</p></div></section><AiBoundaryPlanner /><section className="mt-16 max-w-3xl border-t border-[var(--border-default)] pt-8"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Use the result well</p><p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">A planner result is a starting hypothesis. Validate it with representative inputs, real target devices and networks, data-flow review, and an accountable owner before expanding. Read the <Link href="/mps/learn/implementation" className="text-[var(--status-sourced)] underline underline-offset-4 hover:text-[var(--text-primary)]">AI implementation framework</Link> for the underlying method.</p></section></div></main>
}
