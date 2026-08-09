import type { Metadata } from 'next'
import Link from 'next/link'

import NavigatorAssessment from './NavigatorAssessment'

const SITE_URL = 'https://www.mahastrategies.com'

export const metadata: Metadata = {
  title: 'Maha Navigator | Agent Infrastructure Readiness Brief',
  description: 'Create a bounded, self-reported readiness brief for MCP, A2A, x402, agent-tool, context, audit, and reliability controls.',
  alternates: { canonical: '/navigator' },
  openGraph: { type: 'website', url: `${SITE_URL}/navigator`, title: 'Maha Navigator | Agent Infrastructure Readiness Brief', description: 'Map one real agent workload into control gaps and a bounded technical pilot.' },
}

export default function NavigatorPage() {
  const structuredData = { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Maha Navigator', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: `${SITE_URL}/navigator`, description: 'A consent-based, self-reported agent-infrastructure readiness assessment that produces a control-gap brief and bounded pilot recommendation.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Maha Strategies LLC' } }
  return <main className="min-h-screen bg-[#0a0a0c] px-6 py-20 text-zinc-300 sm:py-28"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\u003c') }} /><div className="mx-auto max-w-6xl"><Link href="/developers" className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-white">← Developer infrastructure</Link><header className="mt-12 max-w-4xl"><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">[ Maha Navigator · opt-in technical intake ]</p><h1 className="mt-5 text-4xl font-light leading-[1.06] tracking-tight text-white sm:text-6xl">Turn one agent deployment into a reviewable control brief.</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-400">Navigator asks about the system you are actually deploying, maps six operating controls, and recommends one bounded compatibility or governance pilot. You receive the brief immediately; a human follows up only if you request it.</p></header><section className="mt-10 grid gap-4 border-y border-zinc-800 py-6 text-sm sm:grid-cols-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Useful immediately</p><p className="mt-2 leading-6 text-zinc-400">A downloadable control-gap register, even if you never engage Maha.</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Consent bounded</p><p className="mt-2 leading-6 text-zinc-400">Assessment processing and human follow-up are separate choices.</p></div><div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">No autonomous commitments</p><p className="mt-2 leading-6 text-zinc-400">Navigator cannot send outreach, accept work, price a contract, or authorize payment.</p></div></section><NavigatorAssessment /></div></main>
}
